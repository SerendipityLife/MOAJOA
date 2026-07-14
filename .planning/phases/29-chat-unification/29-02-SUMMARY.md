---
phase: 29-chat-unification
plan: 02
subsystem: ui
tags: [react, nextjs, guest-surface, moa-island, realtime-chat, tdd]

# Dependency graph
requires:
  - phase: 25-guest-share (25-03/25-06/25-07)
    provides: guest-surface share_mode 분기 + MoaIsland hideHostControls·pollSlot seam
  - phase: 26-realtime-chat
    provides: MoaIsland 채팅탭 (trip_messages·presence·멘션 — dates 게스트가 무료 재사용)
provides:
  - dates 공유 게스트 join 후 both과 동일 MoaIsland(채팅탭 포함) 마운트 (D-01, CHAT-04 웹 측)
  - dates 재방문 멤버 hydrate 경로 복원 (Pitfall 5 봉합 — poll-only 화면 감금 해소)
  - MoaIsland hidePlaceAdd additive optional prop (F-2 — voter 게스트 FAB 숨김)
  - guest-surface embedded 전달 라인 은퇴 (29-03 PollChat 제거 선행 정리)
affects: [29-03 poll surface unification, 29-04 verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "additive optional prop 무회귀 증명: 기존 테스트 무수정 그린 (CHAT-07, 25-06 hideHostControls 선례)"
    - "가드 N곳 동시 제거는 같은 커밋 (Pitfall 5 — 반쪽 회귀 방지)"

key-files:
  created: []
  modified:
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/__tests__/moa-island.test.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/guest-surface.test.tsx

key-decisions:
  - "hidePlaceAdd는 클라이언트 파생(shareMode==='dates')로 충분 — share_mode가 role 결정자(D-A1)이고 DB can_edit_trip RLS가 최종 방어 (심층방어 2겹, T-29-07)"
  - "과도기 상태 수용: embedded 미전달로 PollVoteIsland가 pollSlot 내부에 자체 한마디를 일시 렌더 가능 — 29-03이 PollChat 제거로 소멸, 배포는 phase 완료 후"

patterns-established:
  - "FAB 가드 조건 맨 앞 append: !hidePlaceAdd && 기존조건 — 나머지 조건·본문 diff 0"

requirements-completed: [CHAT-04, CHAT-07]

# Metrics
duration: 7min
completed: 2026-07-14
---

# Phase 29 Plan 02: dates→both 수렴 + hidePlaceAdd Summary

**dates 공유 게스트가 join 후 both과 동일하게 MoaIsland(채팅탭·presence·멘션)를 보게 수렴 — 가드 2곳 동시 제거 + dates 분기 both 미러 재작성 + voter FAB 숨김(hidePlaceAdd), 신규 컴포넌트 0·DB 변경 0**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-14T00:46:15Z
- **Completed:** 2026-07-14T00:53:00Z
- **Tasks:** 2 (TDD 2사이클, 커밋 4)
- **Files modified:** 4

## Accomplishments

- **CHAT-04 웹 측:** dates 게스트 join 후 MoaIsland 마운트 = 채팅탭(trip_messages 영속 이력)·presence·멘션 전부 기존 코드 무료 재사용 (신규 realtime/채팅 로직 0)
- **Pitfall 5 봉합:** `shareMode !== 'dates'` 가드 2곳(세션 effect + handleConfirmNickname)을 같은 커밋에서 제거 — dates 재방문 멤버도 hydrate 후 곧장 MoaIsland (테스트 단언)
- **F-2:** MoaIsland `hidePlaceAdd` additive optional prop — dates voter 게스트에게 장소 추가 FAB 미노출 (실패하는 버튼 금지). UI 숨김 + DB `can_edit_trip` RLS = 심층방어 2겹 (T-29-07)
- **CHAT-07 무회귀 증명:** 기존 moa-island 34케이스 무수정 그린 (RED 커밋 diff 삭제 라인 0 — append-only 검증), both joined는 hidePlaceAdd 미전달(editor FAB 유지) 앵커 테스트
- **Pitfall 8 방어:** joined 시 pollSection은 pollSlot에만 — sibling 중복 렌더 0 테스트 단언 (`poll:{tripId}` 2채널 배달 탈취 차단, T-29-10)

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1 RED: failing FAB hide cases** - `c77d015` (test)
2. **Task 1 GREEN: MoaIsland hidePlaceAdd prop** - `6e166ab` (feat — 3줄 surgical: prop 선언·destructure·FAB 가드)
3. **Task 2 RED: rewrite dates-branch cases for both-convergence** - `7025489` (test — embedded 스텁 은퇴 + dates 수렴 4케이스, Test 1·3 현행 실패 확인)
4. **Task 2 GREEN: converge dates share onto the both MoaIsland path (D-01)** - `314f4f0` (feat — 가드 2곳 동시 제거 + dates 분기 both 미러 + embedded 라인 은퇴)

## Files Created/Modified

- `apps/web/app/moa/[id]/_components/moa-island.tsx` - `hidePlaceAdd?: boolean` additive prop (미전달=기존 렌더 동일), FAB 조건 맨 앞 `!hidePlaceAdd` append
- `apps/web/__tests__/moa-island.test.tsx` - Test 35/36 append-only (hidePlaceAdd 숨김·미전달 유지) — 기존 34케이스 무수정
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` - 가드 2곳 제거(무조건 hydrateMember), embedded+한마디 주석 2줄 은퇴, dates 분기를 both 미러(`MoaIsland + hideHostControls + hidePlaceAdd + pollSlot`)로 재작성 — 비join은 현행 유지(A-2)
- `apps/web/__tests__/guest-surface.test.tsx` - PollVoteIsland 스텁 embedded 제거 + onRequireMember 하네스 버튼, MoaIsland 스텁 hidePlaceAdd data 속성, dates→both 수렴 4케이스(재방문·비join·첫 join·both 미전달 앵커)

## Decisions Made

None — plan 원안 그대로. hydrateMember 순서 불변(완료 → setJoined → gateResolve, Q4-2), both/places 분기·ensureGuestMember·readOnlyPlaces 무접촉.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None in this plan's files. **과도기 상태 (의도됨, plan 명시):** embedded 미전달로 PollVoteIsland가 pollSlot 내부에 자체 한마디 UI를 일시 렌더할 수 있음 — 29-03(Wave 2)이 PollChat 자체를 제거하며 소멸. 중간 커밋 스위트 그린이며 배포는 phase 완료 후.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **29-03 (Wave 2) 언블록:** guest-surface의 embedded 소비 라인이 선은퇴되어 PollVoteIsland `embedded` prop·PollChat 제거가 이 파일과 충돌 없음. HC-7 "한마디" grep 앵커의 guest-surface 몫 선소진.
- **검증 상태:** web 전 스위트 272 그린 · typecheck 0 · build PASS (`ƒ /t/[slug]` 3.85kB/252kB) · iOS/migrations/packages 무접촉 · 삭제 0
- **라이브 검증:** dates 게스트 실 채팅 참여(두 브라우저)는 phase 완료 배포 후 verify-work 몫 (0032는 29-01에서 로컬 적용, 원격은 main push 시 자동)

## Requirements Marking Note

`requirements mark-complete CHAT-04 CHAT-07` → not_found — CHAT-04 계열 ID는 phase 29가 ROADMAP Success Criteria에서 발급한 축으로 REQUIREMENTS.md 미등록 (29-01 선례 동일). REQUIREMENTS.md 등록·완료 마킹은 phase verify-work 몫으로 이관. 이 plan은 CHAT-04의 웹 측(코드 경로)과 CHAT-07(additive prop 무회귀)을 전달.

## Self-Check: PASSED

- 4 수정 파일 + SUMMARY 전부 존재 확인
- 커밋 4개(c77d015·6e166ab·7025489·314f4f0) git log 존재 확인
- TDD 게이트: 두 사이클 모두 test→feat 순서 정합

---
*Phase: 29-chat-unification*
*Completed: 2026-07-14*
