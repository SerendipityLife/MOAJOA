-- 0025_web_share.sql — Phase 23 Web-First Foundation (AUTH-08/SHARE-03/CHAT-01
-- 백엔드 기반). 웹 퍼스트 공유·참여·채팅의 스키마 seam: trips.share_mode/companion
-- 컬럼 + trip_messages 테이블(+RLS) + join_moa RPC. Phase 25(게스트 통합
-- 공유화면)·26(채팅)이 import한다. 전부 0016/0018의 검증된 idiom 미러 — 새 발명 0.
--
-- 결정 기록:
--   D-A1: join_moa role = share_mode in ('places','both') → 'editor',
--         그 외('dates'·null 레거시) → 'voter'. 클라이언트 role 인자 없음 —
--         서버가 share_mode로 결정 (T-23-04 escalation 가드).
--   D-A2: trip_messages.nickname 비정규화 (0018 date_comments 미러) — 발화 시점
--         스냅샷, 익명 유저 purge 후에도 조인 없이 히스토리 렌더 가능.
--   D-A4: 재-join 시 기존 role 유지 (on conflict do nothing — 모드 변경 후
--         자동 승격 없음, T-23-08 가드).
--
-- 42P17 가드: 크로스 테이블 RLS는 SECURITY DEFINER 헬퍼(can_read_trip /
-- can_vote_trip / am_trip_owner, 0016)만 경유 — 직접 EXISTS 0 (CLAUDE.md §4.4).
-- slug 생성은 0016 ensure_share_slug 트리거 재사용 — 여기서 손대지 않음.
-- 기존 join_shared_trip(0016)은 삭제하지 않음 (iOS 동결).
--
-- Append-only: 0016..0024 are NEVER modified.

-- 1) trips 확장 (nullable = 레거시 안전, §4.3)
alter table trips add column share_mode text
  check (share_mode in ('dates','places','both'));
alter table trips add column companion text
  check (char_length(companion) <= 20);

-- 2) trip_messages — 0018 date_comments shape 미러, device_token → user_id(익명도 profiles 행 보유).
--    nickname 비정규화 (D-A2): 발화 시점 스냅샷, 익명 유저 purge 후에도 히스토리 렌더 가능.
create table if not exists trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id),
  nickname text not null,
  body text not null check (char_length(body) between 1 and 140),
  reply_to_place_id uuid references places(id) on delete set null,
  created_at timestamptz not null default now()
);
create index trip_messages_trip_id_idx on trip_messages (trip_id, created_at);

alter table trip_messages enable row level security;

-- RLS: 크로스 테이블은 SECURITY DEFINER 헬퍼만 (42P17, §4.4). 직접 EXISTS 0.
create policy "trip_messages: read if can read trip"
  on trip_messages for select
  to authenticated
  using (can_read_trip(trip_id));

create policy "trip_messages: insert own if can vote trip"
  on trip_messages for insert
  to authenticated
  with check (user_id = auth.uid() and can_vote_trip(trip_id));

create policy "trip_messages: delete own or trip owner"
  on trip_messages for delete
  to authenticated
  using (user_id = auth.uid() or am_trip_owner(trip_id));

-- 3) join_moa — 0016 join_shared_trip(L631~665) 미러. 안전장치 전부 유지:
--    bearer slug 검증 · self-join only(auth.uid) · owner self-join 가드 ·
--    on conflict do nothing 멱등(D-A4: 자동 승격 없음) · DEFINER + search_path 핀.
--    변경점: role 하드코딩 'voter' → share_mode 분기 (D-A1). 클라이언트 role 인자 없음.
--    기존 join_shared_trip은 삭제하지 않음 (iOS 동결).
create or replace function join_moa(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
  v_share_mode text;
begin
  select id, owner_id, share_mode into v_trip_id, v_owner_id, v_share_mode
  from trips
  where share_slug = p_share_slug
    and visibility in ('shared','public')
  limit 1;

  if v_trip_id is null then
    raise exception 'trip not found or not shared';
  end if;

  if v_owner_id = auth.uid() then
    return v_trip_id;
  end if;

  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(),
          case when v_share_mode in ('places','both') then 'editor' else 'voter' end,
          now())
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

grant execute on function join_moa(text) to authenticated;
