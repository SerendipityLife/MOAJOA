-- Phase 29 code review WR-01 — 스키마-중립 (테이블/컬럼/정책 변경 없음).
-- Append-only (§4.3): 0016~0032 절대 무수정.
--
-- 0025/0029/0032가 authenticated에만 grant하며 "세션 필수"를 의도했지만,
-- Supabase 기본 default privileges는 public 스키마의 신규 함수 EXECUTE를
-- anon(및 public)에도 부여한다 — 명시 grant가 기본 grant를 제거하지 않는다.
-- 세션 필수 의도를 grant 레벨에서 실제로 강제하기 위해 명시적으로 revoke한다.
-- 검증: select proname, proacl from pg_proc where proname = 'join_moa_by_poll_code';

revoke execute on function join_moa_by_poll_code(text) from public, anon;
revoke execute on function join_moa(text) from public, anon;
revoke execute on function cast_date_vote_authed(text, text, uuid, date, text) from public, anon;
revoke execute on function hide_place_as_member(uuid) from public, anon;
