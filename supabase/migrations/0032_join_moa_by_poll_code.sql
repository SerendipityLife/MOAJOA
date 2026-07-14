-- BREAKING DB CHANGE (§4.6) — Phase 29 채팅 단일화(CHAT-05) 유일 신규 백엔드.
-- Append-only (§4.3): 0016~0031 절대 무수정. 이 파일은 create-or-replace 함수
-- 1개만 추가한다(스키마-중립 — 테이블/컬럼/정책 변경 없음, 신규 RLS 정책 0).
--
--   join_moa_by_poll_code(p_code) — poll_code bearer → trip에 voter로 self-join.
--
-- 결정 기록:
--   D-03a: /poll 방문자는 poll_code 자체를 bearer로 사용 (slug 미경유).
--          poll_view_by_code에 share_slug를 노출하면 poll_code 보유자가 /t 링크
--          (더 넓은 권한 표면)를 획득 — bearer 스코프 분리(0018) 붕괴라 기각.
--   visibility 게이트 없음: 레거시 dateless-poll trip(0018 create_dateless_trip_
--          with_poll 경로)은 visibility='private'·share_slug null — slug 경유
--          join이 구조적으로 불가한 유일 표면을 이 RPC가 커버 (RESEARCH Q1).
--   role 고정 'voter': poll_code는 dates 시맨틱 (join_moa D-A1 dates 분기 미러).
--   poll status 게이트 없음: 채팅은 trip 소속(A-8) — 마감 후에도 대화 유지 (A1).
--
-- 안전장치 5종 (0025 join_moa 계승): bearer 검증 · self-join only(auth.uid,
-- 클라이언트 uid 인자 0) · owner self-join 가드 · on conflict do nothing 멱등
-- (D-A4: 재-join 자동 승격 없음) · DEFINER + search_path 핀 + authenticated grant만.
-- 크로스 테이블 조인은 DEFINER 함수 본문 내부 — RLS 정책 아님(42P17 무관, §4.4).

create or replace function join_moa_by_poll_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
begin
  -- bearer 코드 검증: poll_code 보유 = 이 trip의 dates-scope 참여 자격.
  -- status 게이트 없음: 채팅은 trip 소속(A-8) — poll 마감 후에도 대화 유지 (Assumptions A1).
  -- visibility 게이트 없음: 레거시 dateless-poll trip은 private·slug null (RESEARCH Q1).
  select p.trip_id, t.owner_id into v_trip_id, v_owner_id
  from date_polls p join trips t on t.id = p.trip_id
  where p.poll_code = p_code
  limit 1;

  if v_trip_id is null then
    raise exception 'poll not found';
  end if;

  if v_owner_id = auth.uid() then
    return v_trip_id;
  end if;

  -- poll_code는 dates 시맨틱 → role 고정 'voter' (join_moa D-A1 dates 분기 미러).
  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(), 'voter', now())
  on conflict (trip_id, user_id) do nothing;  -- 멱등, 자동 승격 없음 (D-A4)

  return v_trip_id;
end;
$$;

grant execute on function join_moa_by_poll_code(text) to authenticated;
-- anon grant 없음: 익명이라도 세션 필수 (0029 cast_date_vote_authed 선례)
