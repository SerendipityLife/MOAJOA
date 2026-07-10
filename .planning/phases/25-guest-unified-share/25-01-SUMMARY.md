---
phase: 25-guest-unified-share
plan: 01
subsystem: database
tags: [supabase, migration, rls, security-definer, anon-rpc, date-polls, soft-delete]

# Dependency graph
requires:
  - phase: 23-web-share-foundation
    provides: "share_mode 컬럼·join_moa RPC·익명 세션(is_anonymous)·public_trip_view"
  - phase: 18-date-polls
    provides: "date_polls/date_poll_options/date_votes·cast_date_vote·poll_view_by_code idiom"
provides:
  - "public_trip_poll(slug) — 비멤버 익명이 slug로 poll(code/mode/status/options)을 얻는 anon-grant DEFINER RPC"
  - "public_trip_view에 share_mode 노출 — SSR 게스트 화면 D-09 모드 분기 seed"
  - "cast_date_vote_authed — device_token := auth.uid() 서버파생 날짜투표(spoof 차단, authenticated-only)"
  - "hide_place_as_member — D-12 DB-airtight own-only 소프트삭제 RPC(호스트 전체·그 외 자기 장소만)"
  - "getPublicTripPoll·castDateVoteAuthed api 래퍼 + hidePlace RPC 전환 + PublicBoardView.board.share_mode"
affects: [25-02, 25-03, 25-05, guest-surface, poll-embed, place-delete-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "anon-grant DEFINER RPC로 slug→하위리소스 노출(RLS 우회 열람, 0016/0018 idiom)"
    - "서버파생 device_token(auth.uid()::text) — 클라이언트 위조 불가 write 래퍼"
    - "own-only 소프트삭제를 DEFINER RPC 유일 경로로 강제(raw UPDATE 제거로 D-12 airtight)"

key-files:
  created:
    - supabase/migrations/0029_public_trip_poll.sql
    - supabase/tests/public_trip_poll_smoke.sh
  modified:
    - packages/api/src/queries/date-polls.ts
    - packages/api/src/queries/date-polls.test.ts
    - packages/api/src/queries/places.ts
    - packages/api/src/queries/places.test.ts
    - packages/core/src/types/index.ts
    - packages/api/src/types/database.ts

key-decisions:
  - "public_trip_poll은 trip_id로 date_polls를 조회(slug→trip→poll) — poll_code/mode/status/options만 반환(voter PII 미노출)"
  - "cast_date_vote_authed·hide_place_as_member grant는 authenticated만(anon 아님) — 익명이라도 세션 필수, 서버가 auth.uid 파생"
  - "hidePlace를 raw places UPDATE에서 hide_place_as_member RPC로 전환 — deletePlace·rejectAiPlace 별칭 자동 승계"

patterns-established:
  - "own-only 권한 경계는 API 래퍼가 아니라 DEFINER RPC 본문에서 DB-airtight하게 강제(Pitfall 5 봉합)"
  - "새 anon-read seam은 0016 public_trip_view + 0018 poll_view_by_code 집계 idiom을 verbatim 미러"

requirements-completed: []  # SHARE-02/03·AUTH-08은 백엔드 seam만 — 라이브/e2e 마킹은 원격 push + Plan 03 몫(26-01 선례)

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 25 Plan 01: Guest Unified Share Backend Seam Summary

**게스트 통합 공유화면의 백엔드 전제 4종을 한 append-only 마이그레이션(0029)으로 봉합 — anon slug→poll RPC · public_trip_view share_mode 노출 · 서버파생 device_token 날짜투표 · D-12 own-only 소프트삭제.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-10T11:01:08Z
- **Completed:** 2026-07-10T11:07:06Z
- **Tasks:** 3 (2 autonomous + 1 [BLOCKING] — 로컬 완료, 원격 push 게이트 open)
- **Files created/modified:** 8

## Accomplishments

- **0029 마이그레이션** — 4개 `create or replace function`: (1) `public_trip_view` 본문 verbatim + `share_mode` 한 줄(additive) (2) `public_trip_poll(slug)` anon-grant DEFINER RPC (3) `cast_date_vote_authed`(device_token := `auth.uid()::text`, authenticated-only) (4) `hide_place_as_member`(D-12 own-only, `am_trip_owner` 헬퍼 재사용). 기존 0016~0028 무수정.
- **api 래퍼 2종 + hidePlace 전환** — `getPublicTripPoll`·`castDateVoteAuthed`(device_token 인자 없음) 추가, `hidePlace`가 raw `places UPDATE`에서 `hide_place_as_member` RPC로 전환(`deletePlace`·`rejectAiPlace` 별칭 자동 승계). `PublicBoardView.board` Pick에 `share_mode` 추가.
- **로컬 적용 + 스모크** — `supabase db reset` 0016→0029 클린(42P17=0) → `pnpm supabase:types` 재생성(public_trip_poll·cast_date_vote_authed·hide_place_as_member 반영) → `public_trip_poll_smoke.sh` exit 0(anon poll read + share_mode=dates + hide own-only: 남의 장소 HTTP 400 거부·자기 장소 HTTP 204 성공).

## Task Commits

1. **Task 1: 0029 마이그레이션** — `e0d6567` (feat)
2. **Task 2 RED: 실패 테스트** — `0ccd10b` (test)
3. **Task 2 GREEN: 래퍼 + hidePlace 전환 + share_mode** — `52cebb1` (feat)
4. **Task 3 (autonomous): typegen + 스모크** — `4aa01c6` (chore)

**Plan metadata:** (아래 docs 커밋)

## Files Created/Modified

- `supabase/migrations/0029_public_trip_poll.sql` - 4 DEFINER 함수 (public_trip_view+share_mode·public_trip_poll·cast_date_vote_authed·hide_place_as_member)
- `supabase/tests/public_trip_poll_smoke.sh` - anon poll read + share_mode + hide own-only 프로브 (exit 0)
- `packages/api/src/queries/date-polls.ts` - getPublicTripPoll·castDateVoteAuthed 래퍼
- `packages/api/src/queries/places.ts` - hidePlace가 hide_place_as_member RPC 경유
- `packages/core/src/types/index.ts` - PublicBoardView.board.share_mode
- `packages/api/src/types/database.ts` - 0029 함수 시그니처 재생성
- `packages/api/src/queries/{date-polls,places}.test.ts` - 5 신규 케이스 (RED→GREEN)

## Decisions Made

- **public_trip_poll의 poll 조회 키:** slug→trip 후 `date_polls where trip_id = v_trip.id`(0018엔 slug 진입이 없어 trip_id 경유). 반환은 `poll_code/mode/status/options`만 — voter PII·device_token 미노출(T-25-01).
- **grant 경계:** `public_trip_poll`·`public_trip_view`는 `authenticated, anon`(열람), `cast_date_vote_authed`·`hide_place_as_member`는 `authenticated`만(write — 익명이라도 세션 필요, 서버가 auth.uid 파생).
- **requirements 마킹 보류:** SHARE-02/03·AUTH-08은 이 backend seam이 전제만 제공 — 라이브 게스트 참여·삭제 UI는 원격 0029 배포 + Plan 03/02 몫이라 REQUIREMENTS Pending 유지(26-01 CHAT-01 선례).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `supabase db reset` 0016→0029 클린(42P17=0), 스모크 exit 0, api 103 tests 그린, api+core tsc 0.

## Known Stubs

None. 모든 산출물이 실 데이터 경로에 배선됨(smoke가 anon read·own-only write 실증).

## User Setup Required

**원격 Supabase에 0029 적용은 사용자 몫(human-action 게이트).** 두 경로: `main` push 시 Supabase↔GitHub 자동 적용(0028 선례) 또는 사용자 터미널 `supabase db push`. **라이브 dates/both 게스트 투표·D-12 own-only 소프트삭제·share_mode SSR 분기는 이 적용 후에만 동작** — Plan 02/03/05의 라이브 검증 전제. 상세: `25-USER-SETUP.md`.

## Next Phase Readiness

- **Plan 02/03이 탐색 없이 import할 계약 완비:** `getPublicTripPoll`·`castDateVoteAuthed`·`hidePlace(RPC)`·`PublicBoardView.board.share_mode`.
- **블로커:** 원격 0029 미배포 — 라이브 게스트 참여·삭제 경로는 push 후 동작. 로컬 스모크·unit은 전부 그린.

## Self-Check: PASSED

- Created files present: `0029_public_trip_poll.sql`, `public_trip_poll_smoke.sh`
- Task commits present: e0d6567 (feat), 0ccd10b (test), 52cebb1 (feat), 4aa01c6 (chore)
- Local reset 42P17=0 · smoke exit 0 · api 103 tests green · api+core tsc 0

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*
