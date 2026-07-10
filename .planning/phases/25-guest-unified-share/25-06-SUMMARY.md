---
phase: 25-guest-unified-share
plan: 06
subsystem: ui
tags: [nextjs, react, vitest, travelpayouts, fab, guest-share]

# Dependency graph
requires:
  - phase: 25-guest-unified-share (25-03)
    provides: guest-surface.tsx MoaIsland 재사용 마운트 (D-08)
  - phase: 24-host-flow (24-07)
    provides: moa-island FAB + [함께 정하기] ShareSheet 배선
provides:
  - TP(emrldco) 스크립트 전면 제거 — 전 페이지 클릭 하이재킹/popunder 소멸 (T-25G-01)
  - FAB collapsed 시트 위 16px(calc(30vh+16px)) 재배치 + expanded 시 숨김 — 첫 행 하트 탭 타깃 노출
  - MoaIsland hideHostControls prop — 게스트 /t 마운트에서 [함께 정하기] 숨김 (T-25G-02)
affects: [25-guest-unified-share verify-work, 25-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "게스트/호스트 표면 분기는 병렬 컴포넌트가 아니라 MoaIsland optional prop 1개로 (D-08 유지)"

key-files:
  created: []
  modified:
    - apps/web/app/layout.tsx
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/moa-island.test.tsx
    - apps/web/__tests__/guest-surface.test.tsx

key-decisions:
  - "TP 스크립트는 스코프 제한이 아닌 전면 제거 (사용자 잠금 결정) — Phase 20 인앱 딥링크는 무의존이라 무접촉"
  - "expanded 시트에서 FAB는 재배치가 아니라 숨김 — 풀스크린 리스트 위 어디든 하트와 겹치므로 숨김이 최소·안전 픽스"
  - "[함께 정하기] 숨김은 오버레이 div만 조건부 — ShareSheet 마운트는 shareOpen 불가라 그대로 둠 (surgical)"

patterns-established:
  - "호스트 컨트롤 게이팅: hideHostControls?: boolean (미전달=false=호스트 무변경)"

requirements-completed: [SHARE-02, SHARE-03]

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 25 Plan 06: UAT Gap Closure (클릭 도달 2종 + 호스트 컨트롤 노출) Summary

**emrldco 제휴 스크립트 전면 제거 + FAB calc(30vh+16px) 재배치/expanded 숨김 + MoaIsland hideHostControls prop으로 게스트 찜 클릭 도달 블로커 2건과 호스트 컨트롤 노출 polish 1건 종결**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-10T15:53:38Z
- **Completed:** 2026-07-10T15:58:41Z
- **Tasks:** 3 (Task 2·3은 TDD RED→GREEN)
- **Files modified:** 5

## Accomplishments

- **Gap 2 (TP 하이재킹, blocker):** layout.tsx에서 emrldco Script 라인 + TP 주석 블록 + 고아 `next/script` import 제거. apps/web 전체 emrldco 참조 0건 — link_switcher/popunder 클릭 납치(Kiwi.com 리다이렉트) 로드 경로 소멸 (T-25G-01 mitigate).
- **Gap 3 (FAB/하트 겹침, blocker):** FAB `bottom-[136px]` → `bottom-[calc(30vh+16px)]` (place-sheet collapsed peek 30vh + 16px 오프셋) + 렌더 조건에 `sheetAnchor !== 'expanded'` 추가. 모바일 폭에서 place-list 첫 행 하트 탭 타깃 노출 (UAT SC3 (b)항).
- **Gap 4 (호스트 컨트롤 노출, minor):** `MoaIslandProps.hideHostControls?: boolean` 추가, [함께 정하기] 오버레이 조건부 렌더, guest-surface MoaIsland render 2곳(both/places)에 전달. D-08 재사용 유지 — 병렬 게스트 컴포넌트 0. 호스트 /moa 기본 렌더 무회귀 (Test 18 앵커).
- web 153 → **159 그린**(+6 신규, 무회귀) · tsc 0 · guest-surface diff 2줄(render 라인만 — 게이트·hydrate·poll fetch 무변경).

## Task Commits

1. **Task 1: TP 스크립트 전면 제거** - `292e553` (fix)
2. **Task 2: FAB 재배치 + expanded 숨김** - RED `59ab35d` (test) → GREEN `28babe1` (feat)
3. **Task 3: hideHostControls prop** - RED `ce08562` (test) → GREEN `1b91c95` (feat)

_TDD tasks: RED 커밋에서 behavior 테스트 실패 확인 후 GREEN (Task 2: Test 17 실패 → 17/17 · Task 3: Test 19 + Test E ×2 실패 → 27/27)._

## Files Created/Modified

- `apps/web/app/layout.tsx` - emrldco Script + TP 주석 + next/script import 삭제 (5줄 삭제만)
- `apps/web/app/moa/[id]/_components/moa-island.tsx` - FAB 위치/조건 + hideHostControls prop + 주석 갱신
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` - MoaIsland render 2곳에 hideHostControls (2줄)
- `apps/web/__tests__/moa-island.test.tsx` - Test 16~19 (FAB collapsed 노출/expanded 숨김·호스트 버튼 무회귀·게스트 숨김)
- `apps/web/__tests__/guest-surface.test.tsx` - MoaIsland 스텁 data-hide-host 확장 + Test E ×2 (places/both)

## Decisions Made

None - followed plan as specified (plan의 잠금 결정 3건을 그대로 집행: 전면 제거·expanded 숨김·최소 prop 1개).

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `! grep -rn "emrldco" apps/web --include="*.tsx" --include="*.ts"` → 0건 PASS
- `! grep -n "next/script" apps/web/app/layout.tsx` → 0건 PASS
- `grep "calc(30vh+16px)"` present / `bottom-[136px]` absent → PASS
- `hideHostControls` moa-island present / guest-surface count 2 → PASS
- `CI=true pnpm --filter @moajoa/web test` → 23 files / **159 tests 전부 그린** PASS
- `pnpm --filter @moajoa/web exec tsc --noEmit` → exit 0 PASS
- guest-surface 회귀 금지: `git diff --stat` 2줄(MoaIsland render 라인만) PASS
- iOS/core/migrations 무접촉 · 라이브 검증 통과분(찜 API·닉네임 게이트·재접속·D-12·SSR) 코드 경로 diff 0

## TDD Gate Compliance

- Task 2: `test(59ab35d)` RED → `feat(28babe1)` GREEN ✓
- Task 3: `test(ce08562)` RED → `feat(1b91c95)` GREEN ✓
- REFACTOR 커밋 없음(정리 불필요 — surgical diff)

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. (기존 25-USER-SETUP 게이트 2종은 이미 pass — 본 plan 무관.)

## Next Phase Readiness

- 25-07(웹 날짜투표 full flow)이 남은 UAT blocker(둘다/날짜 모드 date_poll 생성) 담당 — 본 plan과 파일 겹침 없음
- 라이브 재검증(UAT Test 3 재실행)은 배포 후: TP 하이재킹 소멸·찜 하트 클릭 도달·게스트 화면 [함께 정하기] 부재 확인

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*

## Self-Check: PASSED

- 수정 파일 4종 존재 확인 · 커밋 5개(292e553·59ab35d·28babe1·ce08562·1b91c95) 존재 확인 · 파일 삭제 0
