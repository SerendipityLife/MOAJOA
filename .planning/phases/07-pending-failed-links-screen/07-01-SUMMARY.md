---
phase: 07-pending-failed-links-screen
plan: 01
subsystem: ui
tags: [expo-router, react-native, nativewind, gesture-handler, swipeable, jest-expo, pending-queue]

# Dependency graph
requires:
  - phase: 03-ios-save-flow
    provides: "lib/pending.ts drain 상태머신 + listFailedPending/retryFailedPending/deleteFailedPending + boards.tsx 저장-실패 배너 + SharedDefaultsKeys.PendingLinksFailed"
  - phase: 05-trust-ui-onboarding
    provides: "toast.tsx action slot(showToast options.action) — 실행취소 토스트에 재사용"
provides:
  - "app/boards/failed.tsx — 저장 실패 링크 목록 풀스크린 라우트(리스트 · 사유배지 · 상대시각 · 행별/전체 재시도 · 스와이프 삭제 · 실행취소 · empty state)"
  - "lib/failed-format.ts — mapFailReason(D-04 한국어 사유) + formatRelativeTime(상대시각) 순수 헬퍼"
  - "lib/pending.ts FailedPendingLink export + restoreFailedPending(실행취소 단일 진입점)"
  - "boards.tsx 배너 동선 복구(/boards/_failed not-found → /boards/failed)"
affects: [pending-queue, ios-save-flow, dogfooding-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-native-gesture-handler Swipeable를 root GestureHandlerRootView 없이 화면-로컬로 래핑(surgical — root _layout.tsx 불변)"
    - "테스트에서 react-native-gesture-handler/jestSetup import으로 GestureHandlerRootView/Swipeable 렌더 가능화"

key-files:
  created:
    - apps/ios/app/boards/failed.tsx
    - apps/ios/lib/failed-format.ts
    - apps/ios/__tests__/failed-format.test.ts
    - apps/ios/__tests__/failed-screen.test.tsx
  modified:
    - apps/ios/lib/pending.ts
    - apps/ios/app/(tabs)/boards.tsx

key-decisions:
  - "FailedPendingLink는 ReturnType 트릭이 아니라 interface에 export 키워드 추가로 노출(화면 타입 가독성)"
  - "실행취소는 restoreFailedPending(item) 단일 진입점으로 — 화면이 SharedDefaults/constants를 직접 import하는 우회 회피"
  - "Swipeable는 화면-로컬 GestureHandlerRootView로 래핑(root layout 불변, Karpathy §3.3)"
  - "테스트 native 게이트는 react-native-gesture-handler/jestSetup import으로 해소(신규 패키지 0)"

patterns-established:
  - "화면-로컬 GestureHandlerRootView: gesture 의존 컴포넌트를 쓰는 화면이 그 리스트 컨테이너만 감싸 root layout 변경 없이 동작"
  - "gesture-handler 컴포넌트 렌더 테스트: import 'react-native-gesture-handler/jestSetup' 한 줄로 native install() 회피"

requirements-completed: []  # Phase 7 공식 requirement ID 미할당 — must_haves는 ROADMAP Phase 7 Goal + 07-CONTEXT D-01..D-08에서 도출

# Metrics
duration: 5min
completed: 2026-06-07
---

# Phase 7 Plan 01: Pending-Failed Links Screen Summary

**저장 실패 링크 목록 풀스크린 라우트 신설 — URL·한국어 사유배지·상대시각 리스트 + 행별/전체 재시도(재큐잉+즉시 drain) + 스와이프 삭제+실행취소 + empty state, 그리고 boards 배너의 not-found 동선 복구**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-07T04:28:23Z
- **Completed:** 2026-06-07T04:32:53Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Phase 3에서 만든 "저장 실패 N개" 배너의 누락된 목적지 화면을 구현해 깨진 동선(배너 탭 → not-found) 복구
- 각 실패 행: URL 1줄 말줄임 + 한국어 사유 배지(D-04) + 상대시각("3시간 전" 등)
- 행별 [재시도] + 상단 [전체 재시도] = retryFailedPending 재큐잉 → 즉시 drainPendingLinks + "다시 시도 중" 토스트(D-05/D-06)
- 왼쪽 스와이프 삭제 + "삭제됨 [실행취소]" 토스트 → restoreFailedPending 복구(D-07/D-08)
- 목록 비면 자동 pop 없이 "저장 실패한 링크가 없어요" empty state(D-02)
- 신규 도메인 로직 거의 0 — 기존 pending.ts 함수에 UI 배선 + 순수 표시 헬퍼 2개

## Task Commits

각 task를 atomic하게 커밋:

1. **Task 1: FailedPendingLink export + 사유/상대시각 헬퍼 + 단위 테스트 (TDD)** - `beca22d` (feat)
2. **Task 2: failed.tsx 실패 목록 라우트 화면** - `3049f0c` (feat)
3. **Task 3: 배너 타깃 수정 + 화면 렌더 스모크 테스트** - `104f410` (fix)

_Task 1은 TDD였으나 RED(failed-format 테스트 실패 확인)→GREEN을 단일 feat 커밋으로 합쳤다 — pending.ts export/restore 변경과 헬퍼 신규가 한 논리 단위라서. RED는 commit 전 jest로 확인(module not found)._

## Files Created/Modified
- `apps/ios/lib/failed-format.ts` (created) - mapFailReason(D-04 4종+폴백) + formatRelativeTime(방금/분/시/일) 순수 함수
- `apps/ios/app/boards/failed.tsx` (created) - 실패 목록 풀스크린 라우트(default export), 리스트/재시도/스와이프 삭제/실행취소/empty state
- `apps/ios/__tests__/failed-format.test.ts` (created) - 사유 4종+폴백 + 상대시각 4경계 결정론 단언(now 주입)
- `apps/ios/__tests__/failed-screen.test.tsx` (created) - empty state + 1-row(URL + "네트워크 오류" + "3시간 전") 렌더 스모크
- `apps/ios/lib/pending.ts` (modified) - FailedPendingLink interface export + restoreFailedPending 추가(drain/classifyError/enqueue 본문 불변)
- `apps/ios/app/(tabs)/boards.tsx` (modified) - 배너 onPress 타깃 1줄 수정(/boards/_failed → /boards/failed)

## Decisions Made
- **FailedPendingLink export 방식:** 07-CONTEXT가 제시한 두 옵션(export 키워드 추가 vs `ReturnType<typeof listFailedPending>[number]`) 중 export 선택 — 화면 타입 가독성이 더 좋고 surgical(1줄).
- **실행취소 단일 진입점:** deleteFailedPending와 대칭인 restoreFailedPending(item)을 pending.ts에 추가 — 화면이 SharedDefaults/constants를 직접 import하는 어색한 우회를 피함(배선만).
- **Swipeable 화면-로컬 래핑:** root _layout.tsx가 GestureHandlerRootView로 트리를 감싸지 않으므로(side-effect import만), 이 화면의 리스트 컨테이너만 GestureHandlerRootView로 감쌌다. root layout 불변(Karpathy §3.3).
- **Task 1 TDD 커밋 합침:** RED→GREEN을 별도 커밋으로 쪼개지 않고 단일 feat 커밋 — export/restore(pending.ts)와 헬퍼 신규가 한 논리 단위. RED는 commit 전 `pnpm jest failed-format`으로 module-not-found 실패 확인 후 GREEN 진행.

## Deviations from Plan

None - plan executed exactly as written.

(신규 패키지 설치 0 — react-native-gesture-handler ~2.28 + @testing-library/react-native 모두 기설치. T-07-03 mitigate 충족, Package Legitimacy Gate 불필요.)

## Issues Encountered
- **failed-screen 테스트에서 GestureHandlerRootView native install() throw:** jest-expo 환경에서 `react-native-gesture-handler`의 `GestureHandlerRootView`가 native 모듈 `install()`을 호출하다 실패. 표준 해법인 `import 'react-native-gesture-handler/jestSetup'` 한 줄을 테스트 상단에 추가해 해소(신규 패키지/설정 변경 없음 — 기존 패키지가 제공하는 jest setup). 두 케이스 모두 통과.

## User Setup Required
None - no external service configuration required.

## Threat Surface
- 새 trust boundary / 엔드포인트 / auth path / 스키마 변경 없음. failed.tsx는 이 앱 자신의 drain 로직(classifyError)이 쓴 already-typed 로컬 SharedDefaults 데이터만 렌더(T-07-01 accept). reason 미지값은 mapFailReason 폴백으로 안전. 신규 위협 surface 없음 → Threat Flags 섹션 생략.

## Known Stubs
None - 모든 화면 데이터가 lib/pending.ts(listFailedPending) 실데이터에 배선됨. 하드코딩 빈 값/placeholder 없음.

## Next Phase Readiness
- Phase 7 단일 plan 완료 — 코드 측면 done. jest 38/38 green(+8 신규, 회귀 0), typecheck clean.
- 실기기 UAT(배너 탭 → 화면 진입 → 단일/전체 재시도 행 사라짐 + 토스트 → 스와이프 삭제 + 실행취소 → 빈 목록 empty state + 뒤로가기 시 배너 사라짐)는 end-of-phase / Phase 6 dogfooding batch로 deferred — 다른 iOS 화면들과 동일 정책.
- Blocker 없음.

## Self-Check: PASSED

**Created files exist:**
- FOUND: apps/ios/lib/failed-format.ts
- FOUND: apps/ios/app/boards/failed.tsx
- FOUND: apps/ios/__tests__/failed-format.test.ts
- FOUND: apps/ios/__tests__/failed-screen.test.tsx

**Commits exist:**
- FOUND: beca22d (Task 1)
- FOUND: 3049f0c (Task 2)
- FOUND: 104f410 (Task 3)

**Verification:** `pnpm jest` 38/38 pass (8 suites), `pnpm tsc --noEmit` exit 0, `router.push('/boards/failed')` ×1 / `/boards/_failed` ×0, D-04 카피 4종 + empty state + '실행취소' + '다시 시도 중' 모두 존재.

---
*Phase: 07-pending-failed-links-screen*
*Completed: 2026-06-07*
