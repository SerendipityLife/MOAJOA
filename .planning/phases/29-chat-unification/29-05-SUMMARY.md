---
phase: 29-chat-unification
plan: 05
subsystem: ui
tags: [date-poll, host-surface, pollSlot, react-server-component, supabase-rls]

# Dependency graph
requires:
  - phase: 25-guest-share
    provides: getPollByTrip/getPollOptions owner 래퍼 + PollVoteIsland 임베드 seam (deviceToken/nickname/onRequireMember)
  - phase: 29-chat-unification
    provides: MoaIslandProps.pollSlot seam (moa-island.tsx:68/587), 게스트 both 분기 pollSlot idiom
provides:
  - 호스트 /moa/[id] 본화면 날짜 투표 현황 섹션 (후보 날짜·집계·투표자 nickname 칩)
  - guest-surface getPublicTripPoll 실패 진단 로깅 (both-mode 무음 catch 해소)
affects: [chat-unification, host-flow, date-poll-visibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "호스트 owner-RLS direct-read(getPollByTrip)로 RSC seed → pollSlot(PollVoteIsland 현황 뷰) MoaIsland 전달"
    - "게스트 pollSlot idiom을 호스트 표면에 재사용 — 신규 컴포넌트 0, MoaIsland/PollVoteIsland 무변경"

key-files:
  created: []
  modified:
    - apps/web/app/moa/[id]/page.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx

key-decisions:
  - "호스트 헤딩은 '날짜 투표 현황'(게스트 '날짜 정하기'와 구분 — 호스트는 세팅이 아니라 현황을 본다)"
  - "poll?.poll_code 가드로 pollSlot 조건부 — poll 없는 트립은 seam undefined 유지(무회귀)"
  - "nickname={profileNames[user.id] ?? '나'} 주입으로 호스트 inline 닉네임 게이트 스킵 → 즉시 현황 노출"

patterns-established:
  - "owner poll 현황 뷰: getPollByTrip → getPollOptions → PollVoteIsland(nickname 주입) → pollSlot"

requirements-completed: [CHAT-08]

# Metrics
duration: 12min
completed: 2026-07-14
---

# Phase 29 Plan 05: 호스트 /moa 날짜 투표 현황 (Gap 3 종결) Summary

**호스트가 /moa/[id] 본화면에서 poll 존재 시 "날짜 투표 현황" 섹션(후보 날짜·집계 bar·투표자 nickname 칩)을 pollSlot seam으로 보게 만든 gap closure — MoaIsland/PollVoteIsland 무변경, 배선 2줄 + 진단 로깅 1줄**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-14T14:50:00Z
- **Completed:** 2026-07-14T14:58:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 호스트 /moa/[id] RSC가 owner-RLS로 poll을 조회(getPollByTrip/getPollOptions)하고 poll이 있을 때만 PollVoteIsland 현황 뷰를 pollSlot으로 MoaIsland에 전달 (UAT Gap 3 truth: "호스트가 /moa 본화면에서 날짜 투표 현황을 볼 수 있다").
- poll 없는 트립은 seam이 undefined로 남아 기존 렌더와 동일 (빈 트립 무회귀).
- guest-surface both-mode poll 조회 무음 catch에 console.error 진단 로깅 추가 (재발 관측성).

## Task Commits

1. **Task 1: 호스트 /moa page.tsx pollSlot 배선** - `c9b8c3d` (feat)
2. **Task 2: guest-surface 무음 catch 진단 로깅** - `a5e2701` (fix)

## Files Created/Modified
- `apps/web/app/moa/[id]/page.tsx` - getPollByTrip/getPollOptions/PollVoteIsland import + pollSlot 구성 + `pollSlot={pollSlot}` 전달 (owner RLS direct-read, poll_code null 가드, nickname 주입으로 게이트 스킵)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` - poll 조회 catch를 `catch (err)`로 확장 + `console.error('[guest-surface] getPublicTripPoll failed', err)` 1줄 (setPollMeta 스킵 동작 무변경)

## Decisions Made
- 호스트 헤딩은 "날짜 투표 현황"으로 게스트 "날짜 정하기"와 구분 (결정 문구, 호스트는 현황을 본다).
- `poll?.poll_code` 가드 필수 — poll_code는 `string | null`이고 PollVoteIsland.code는 required `string`. 타입 안전 + poll 부재 무회귀 이중 목적.
- nickname 주입으로 PollVoteIsland inline 닉네임 게이트(:343 `!nickname && !onRequireMember`) 스킵. onRequireMember는 미전달(호스트는 이미 owner 멤버).
- `hideHostControls` 미전달 유지 → 호스트는 pollSlot(현황) + PlanSection([일정])을 둘 다 본다 (surgical, MoaIsland·ShareSheet 무접촉).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. 신규 마이그레이션·RPC 0 (getPollByTrip/getPollOptions는 기존 owner RLS 래퍼).

## Verification
- `CI=true pnpm --filter web typecheck` exit 0 (poll_code null 가드·mode/status/options 타입 정합).
- `CI=true pnpm --filter web test` 32 files / 278 tests 그린 (무회귀 — moa-island·guest-surface 포함).
- `CI=true pnpm --filter web build` PASS (`ƒ /moa/[id]` 247 kB First Load JS — PollVoteIsland client 번들 포함, 정상).
- acceptance grep 전종 통과 (getPollByTrip(supabase·getPollOptions·PollVoteIsland·pollSlot={pollSlot}·날짜 투표 현황·console.error).
- `git diff apps/web/app/moa/[id]/_components/moa-island.tsx` 빈 diff (MoaIsland 무변경 — seam 재사용).
- `git diff --stat apps/ios packages/core supabase/migrations` 0 (iOS·core·migrations 무접촉).
- `.js` 워크스페이스 import 0건.
- guest-surface :157-159 카운트 catch 빈 diff (범위 밖 무접촉).

## Next Phase Readiness
- Gap 3 코드 종결. 라이브 UAT 재검증 시: 호스트가 /moa/[id]에서 poll 있는 트립 접속 → PlaceSheet 상단 "날짜 투표 현황" 확인. both-mode 게스트 poll 실패 시 브라우저 콘솔에 `[guest-surface] getPublicTripPoll failed` 기록 관측.
- 잔여 UAT: Test 1/2 게스트 채팅 표면 재검증(needs_retest, 배포 후 실 join 액션 필요), Test 3 presence 2인극(blocked, 게스트 픽스 후).

## Self-Check: PASSED

- FOUND: apps/web/app/moa/[id]/page.tsx
- FOUND: .planning/phases/29-chat-unification/29-05-SUMMARY.md
- FOUND: commit c9b8c3d (Task 1)
- FOUND: commit a5e2701 (Task 2)

---
*Phase: 29-chat-unification*
*Completed: 2026-07-14*
