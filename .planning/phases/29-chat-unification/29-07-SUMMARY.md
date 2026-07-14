---
phase: 29-chat-unification
plan: 07
subsystem: database
tags: [supabase, rls, security-definer, anon-rpc, react, chat, guest-surface]

# Dependency graph
requires:
  - phase: 25-guest-share
    provides: public_trip_poll(0029) anon-grant DEFINER read RPC idiom + getPublicTripPoll wrapper
  - phase: 26-realtime-chat
    provides: trip_messages table (0025) + chat.ts query module
  - phase: 29-06-gap-closure
    provides: guest-surface chatTeaser (empty-state + openChatGate/pendingChatIntent/initialTab wiring)
provides:
  - public_trip_messages(p_slug) anon-grant DEFINER read RPC (0034) — slug→trip_messages snapshot, user_id PII excluded, limit 200
  - getPublicTripMessages(client, slug) api wrapper
  - guest-surface chatTeaser renders real snapshot messages (닉네임·본문) before join, empty-state fallback
affects: [30-chat-unification, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "anon-read DEFINER RPC mirror of public_trip_poll for a second trust-boundary read surface (chat history)"
    - "join-전 snapshot: 1회 fetch (no realtime — WALRUS member-gated), live updates deferred to MoaIsland post-join"

key-files:
  created:
    - supabase/migrations/0034_public_trip_messages.sql
    - supabase/tests/public_trip_messages_smoke.sh
  modified:
    - packages/api/src/queries/chat.ts
    - packages/api/src/queries/chat.test.ts
    - packages/api/src/types/database.ts
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/guest-surface.test.tsx

key-decisions:
  - "join 전 게스트도 /t에서 실제 채팅 메시지를 읽는다 (사용자 잠금 결정 2026-07-15) — /t의 기존 anon-with-link 열람 경계(public_trip_poll/view)와 동일 정책"
  - "user_id(auth.uid PII)는 반환 shape에서 제외 — nickname은 공개 비정규화 필드(D-A2)"
  - "reply_to_place 칩은 스냅샷에서 생략 (placesById 불필요, 최소 렌더)"

patterns-established:
  - "0034: public_trip_poll(0029) 미러 — slug→trip 해석(visibility 게이트)·search_path 핀·grant authenticated,anon·limit 200·jsonb_build_object PII 통제"
  - "guest-surface snapshot useEffect: pollMeta/counts anon-read idiom 미러 (getSupabaseBrowser·active flag·try/catch console.error·test seam 우회)"

requirements-completed: [CHAT-10]

# Metrics
duration: 7min
completed: 2026-07-15
---

# Phase 29 Plan 07: Guest join-전 채팅 스냅샷 읽기 Summary

**anon-grant DEFINER RPC(0034)로 /t 게스트가 join 전에 실제 채팅 메시지 스냅샷(닉네임·본문)을 읽고, teaser empty-state를 스냅샷 렌더로 교체 — 입력 게이트(29-06) 무회귀.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-14T23:41:40Z
- **Completed:** 2026-07-14T23:48:12Z
- **Tasks:** 3 of 4 (Task 4 = human-action checkpoint, origin/main push — 미실행)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `0034_public_trip_messages.sql` — public_trip_poll(0029) 미러 anon-read DEFINER RPC. slug→trip_messages 스냅샷(최근 200, created_at asc), user_id PII 제외, grant authenticated,anon (0033 read RPC 미revoke 정책 일관).
- `getPublicTripMessages(client, slug)` 래퍼 (chat.ts) — getPublicTripPoll house contract 미러.
- `public_trip_messages_smoke.sh` — anon slug→messages len==2·asc 순서·user_id PII 미노출·없는 slug=null [BLOCKING] 로컬 검증 exit 0.
- guest-surface chatTeaser: empty-state `<p>` → 스냅샷 메시지 말풍선 렌더(닉네임·본문), 메시지 없으면 empty-state 폴백. 입력 게이트(openChatGate/pendingChatIntent/initialTab) 무회귀.

## Task Commits

1. **Task 1 (RED): getPublicTripMessages 실패 테스트** - `d44ec49` (test)
2. **Task 1 (GREEN): 0034 RPC + getPublicTripMessages 래퍼** - `67634cc` (feat)
3. **Task 2: 로컬 db reset + typegen + smoke** - `6871764` (test)
4. **Task 3 (RED): guest 스냅샷 렌더 실패 테스트** - `77ac311` (test)
5. **Task 3 (GREEN): guest-surface 스냅샷 렌더** - `9968ba1` (feat)

## Files Created/Modified
- `supabase/migrations/0034_public_trip_messages.sql` - public_trip_messages(p_slug) anon-read DEFINER RPC (append-only, 0016~0033 무수정)
- `supabase/tests/public_trip_messages_smoke.sh` - anon 읽기 + user_id PII 미노출 + 없는 slug=null smoke
- `packages/api/src/queries/chat.ts` - getPublicTripMessages 래퍼 append
- `packages/api/src/queries/chat.test.ts` - rpc mock 추가 + getPublicTripMessages 2케이스
- `packages/api/src/types/database.ts` - typegen (public_trip_messages 반영)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` - SnapshotMessage type·state·useEffect·teaser 조건부 렌더
- `apps/web/__tests__/guest-surface.test.tsx` - CHAT-10 Test A~E (스냅샷 렌더·empty 폴백·게이트 무회귀·join 전환)

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification
- `CI=true pnpm --filter @moajoa/api test` → 113/113 (getPublicTripMessages 케이스 포함)
- `bash supabase/tests/public_trip_messages_smoke.sh` → exit 0 (anon 읽기·user_id 미노출·없는 slug=null)
- `CI=true pnpm --filter web test -- guest-surface` → 27/27 (Test A~E + 29-06 게이트 무회귀)
- `CI=true pnpm -r test` → aggregate exit 0 (web 343/343, api/core/ios green)
- web typecheck 0 · api typecheck 0 · web build PASS (`ƒ /t/[slug]` 4.25 kB)
- `git diff --stat apps/ios packages/core apps/web/app/moa/[id]` → 빈 출력 (동결·무회귀 영역 무접촉)
- migrations diff = 0034만 (0016~0033 append-only 무수정)
- `.js` 워크스페이스 import = 0 (§4.5)
- 로컬 db reset 0016→0034 42P17=0

## User Setup Required (Task 4 — human-action: RESOLVED)
**원격 0034 push 완료 (orchestrator, 사용자 상시 배포 권한).** origin/main이 `d44ec49..5c5a21c`로 fast-forward(분기 없음). Supabase↔GitHub 연동이 0034를 원격 적용 중/확인 완료(orchestrator가 백그라운드로 `supabase migration list` 0034|0034 정합 폴링). 라이브 게스트 스냅샷 읽기는 원격 0034 적용 완료 시점부터 동작한다.

**잔여(사용자 재검증):** 시크릿 브라우저로 실 `/t/{slug}` (호스트가 메시지 남긴 trip) 열기 → join 전 채팅 섹션에 호스트 메시지 표시(empty-state 아님) 확인 + 입력창 focus → 닉네임 게이트 무회귀 확인. verify-work 몫.

## Next Phase Readiness
- 코드·로컬 검증 완료. 원격 0034 push + 라이브 스냅샷 재검증(Task 4)은 verify-work / 사용자 몫.
- CHAT-10 코드 전달 완료.

## Self-Check: PASSED

All created files exist (0034 migration, smoke, guest-surface, chat.ts, SUMMARY). All 5 task commits present (d44ec49, 67634cc, 6871764, 77ac311, 9968ba1).

## TDD Gate Compliance

Task 1: test(29-07) d44ec49 (RED) → feat(29-07) 67634cc (GREEN). Task 3: test(29-07) 77ac311 (RED) → feat(29-07) 9968ba1 (GREEN). Both TDD cycles have RED→GREEN gate commits in order.

---
*Phase: 29-chat-unification*
*Completed: 2026-07-15*
