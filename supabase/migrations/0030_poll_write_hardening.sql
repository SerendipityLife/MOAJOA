-- 0030_poll_write_hardening.sql
-- BREAKING DB CHANGE: date_polls/date_poll_options 쓰기를 trip OWNER로 좁힌다
-- (기존 can_edit_trip = owner|editor). join_moa(0025 D-A1)가 places/both 게스트에
-- 'editor'를 부여하므로, 익명 게스트가 poll을 생성·mode 변조·DELETE할 수 있었다 —
-- DELETE는 options→votes→comments cascade로 복구 불가 소멸 (CR-01, 25-REVIEW-GAPS).
-- 정당한 poll 쓰기(웹 share-sheet·iOS plan 탭)는 전부 owner가 수행하므로 기능 영향 0.
-- 게스트 투표는 anon DEFINER RPC(0018 cast_date_vote / 0029 cast_date_vote_authed)
-- 경유라 테이블 RLS 무영향. D-12와 동일 정책 방향: 호스트=모더레이션, 그 외=own-only.
-- Append-only: 0016~0029 무수정.

drop policy if exists date_polls_write on date_polls;
create policy date_polls_write on date_polls for all to authenticated
  using (am_trip_owner(trip_id)) with check (am_trip_owner(trip_id));

drop policy if exists date_poll_options_write on date_poll_options;
create policy date_poll_options_write on date_poll_options for all to authenticated
  using (exists (
    select 1 from date_polls p
    where p.id = date_poll_options.poll_id and am_trip_owner(p.trip_id)
  ))
  with check (exists (
    select 1 from date_polls p
    where p.id = date_poll_options.poll_id and am_trip_owner(p.trip_id)
  ));

-- WR-01: date_polls.trip_id에 unique가 없어 share 더블탭이 createDatePoll을 2회
-- 레이스시키면 trip당 poll 2행 → getPollByTrip maybeSingle()이 영구 에러.
-- 중복(있다면 최신 행)을 정리한 뒤 unique로 봉인. 클라이언트 in-flight 가드는
-- share-sheet에서 별도 처리 — 이 인덱스는 DB 최종 방어선.
delete from date_polls a
  using date_polls b
  where a.trip_id = b.trip_id
    and (a.created_at, a.id) > (b.created_at, b.id);
create unique index if not exists date_polls_trip_id_key on date_polls (trip_id);
