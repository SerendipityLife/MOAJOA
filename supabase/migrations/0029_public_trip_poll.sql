-- BREAKING DB CHANGE (§4.6) — Phase 25 게스트 통합 공유화면 백엔드 전제 4종.
-- Append-only (§4.3): 0016~0028 절대 무수정. 이 파일은 네 개의 create-or-replace
-- 함수만 추가한다(스키마-중립 — 테이블/컬럼 변경 없음).
--
--   1. public_trip_view(p_slug)       — 0016 본문 verbatim + share_mode 한 줄(additive)
--   2. public_trip_poll(p_slug)        — slug→poll anon-read DEFINER RPC (SHARE-02, dates/both)
--   3. cast_date_vote_authed(...)      — device_token := auth.uid() 서버파생 (spoof 차단, T-25-02)
--   4. hide_place_as_member(p_place_id)— D-12 own-only 소프트삭제 (Pitfall 5 봉합, T-25-08)
--
-- 크로스테이블은 전부 DEFINER 헬퍼(am_trip_owner) 경유 — 직접 EXISTS 금지(§4.4).

-- =============================================================================
-- 1. public_trip_view(p_slug) — 0016 L689-756 본문 verbatim, 'trip' 객체에
--    share_mode 한 줄만 추가(additive — 기존 소비자 무영향, grant 동일).
-- =============================================================================
create or replace function public_trip_view(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_owner profiles%rowtype;
  v_result jsonb;
begin
  select * into v_trip from trips
  where share_slug = p_slug and visibility in ('public','shared')
  limit 1;

  if not found then return null; end if;

  select * into v_owner from profiles where id = v_trip.owner_id;

  v_result := jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'description', v_trip.description,
      'city_code', v_trip.city_code,
      'cover_image_url', v_trip.cover_image_url,
      'updated_at', v_trip.updated_at,
      'share_mode', v_trip.share_mode
    ),
    'owner_display_name', coalesce(v_owner.display_name, 'MOAJOA user'),
    'links', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'source_kind', l.source_kind,
        'url', l.url,
        'title', l.title,
        'thumbnail_url', l.thumbnail_url,
        'author_name', l.author_name,
        'summary_ko', l.summary_ko
      ) order by l.created_at desc)
      from links l where l.trip_id = v_trip.id and l.extraction_status = 'ready'),
      '[]'::jsonb
    ),
    'places', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'link_id', p.link_id,
        'name_local', p.name_local,
        'name_ko', p.name_ko,
        'name_en', p.name_en,
        'lat', p.lat,
        'lng', p.lng,
        'category', p.category,
        'source_timestamp_sec', p.source_timestamp_sec,
        'source_kind', p.source_kind,
        'confidence', p.confidence,
        'summary_ko', p.summary_ko,
        'google_place_id', p.google_place_id,
        'address', p.address
      ) order by p.created_at)
      from places p where p.trip_id = v_trip.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_trip_view(text) to authenticated, anon;

-- =============================================================================
-- 2. public_trip_poll(p_slug) — 비멤버 익명이 slug로 poll을 얻는 anon-read
--    DEFINER RPC. date_polls direct-read RLS(can_read_trip)를 우회해 dates/both
--    임베드를 게이트(T-25-01: poll_code/mode/status/options만 반환, voter PII 미노출).
--    옵션 집계는 0018 poll_view_by_code(L154-157) idiom verbatim.
-- =============================================================================
create or replace function public_trip_poll(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_poll date_polls%rowtype;
  v_options jsonb;
begin
  select * into v_trip from trips
  where share_slug = p_slug and visibility in ('public','shared')
  limit 1;
  if not found then return null; end if;

  select * into v_poll from date_polls where trip_id = v_trip.id limit 1;
  if v_poll.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'start_date', o.start_date, 'end_date', o.end_date
  ) order by o.start_date), '[]'::jsonb)
  into v_options from date_poll_options o where o.poll_id = v_poll.id;

  return jsonb_build_object(
    'poll_code', v_poll.poll_code,
    'mode', v_poll.mode,
    'status', v_poll.status,
    'options', v_options
  );
end;
$$;

grant execute on function public_trip_poll(text) to authenticated, anon;

-- =============================================================================
-- 3. cast_date_vote_authed(...) — 서버파생 device_token 날짜투표(Open Q2, T-25-02).
--    0018 cast_date_vote(L125-144) 본문 미러하되 p_device_token 인자를 제거하고
--    insert에서 auth.uid()::text를 device_token 자리에 사용 → 클라이언트가
--    device_token을 위조 불가. grant는 to authenticated만(anon 아님 — 익명이라도
--    세션 필수, 서버가 auth.uid 파생). /poll 레거시 cast_date_vote는 무변경(별도 함수).
-- =============================================================================
create or replace function cast_date_vote_authed(
  p_code text, p_nickname text,
  p_option_id uuid default null, p_vote_date date default null,
  p_availability text default 'available'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_poll date_polls;
begin
  select * into v_poll from date_polls where poll_code = p_code and status = 'open' limit 1;
  if v_poll.id is null then raise exception 'poll not found or closed'; end if;
  if p_nickname is null or char_length(btrim(p_nickname)) = 0 then raise exception 'nickname required'; end if;
  if v_poll.mode = 'range' and p_option_id is null then raise exception 'option required'; end if;
  if v_poll.mode = 'grid'  and p_vote_date is null then raise exception 'date required'; end if;
  if p_availability not in ('available','unavailable') then raise exception 'bad availability'; end if;
  insert into date_votes (poll_id, device_token, nickname, option_id, vote_date, availability)
  values (v_poll.id, auth.uid()::text, p_nickname, p_option_id, p_vote_date, p_availability)
  on conflict (poll_id, device_token, option_id, vote_date)
  do update set availability = excluded.availability, nickname = excluded.nickname;
end; $$;
grant execute on function cast_date_vote_authed(text, text, uuid, date, text) to authenticated;

-- =============================================================================
-- 4. hide_place_as_member(p_place_id) — D-12 own-only 소프트삭제(Pitfall 5 봉합,
--    T-25-08). 소프트삭제 유일 경로가 되어(Task 2에서 hidePlace 전환) API가 raw
--    places UPDATE hidden_at(RLS=can_edit_trip, 남의 것도 가능)을 더는 쓰지 않는다.
--    호스트(am_trip_owner)면 전체 hide, 그 외(게스트-에디터 포함)는 자기 장소
--    (added_by=auth.uid)만 — D-12를 DB에서 airtight하게 강제. am_trip_owner 0016
--    DEFINER 헬퍼 재사용(직접 EXISTS 금지 §4.4). grant는 to authenticated만.
-- =============================================================================
create or replace function hide_place_as_member(p_place_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_place places%rowtype;
begin
  select * into v_place from places where id = p_place_id;
  if not found then raise exception 'place not found'; end if;
  if am_trip_owner(v_place.trip_id) or v_place.added_by = auth.uid() then
    update places set hidden_at = now() where id = p_place_id;
  else
    raise exception 'not authorized to hide this place';
  end if;
end;
$$;

grant execute on function hide_place_as_member(uuid) to authenticated;
