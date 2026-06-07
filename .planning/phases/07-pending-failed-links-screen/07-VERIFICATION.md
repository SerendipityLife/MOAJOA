---
phase: 07-pending-failed-links-screen
verified: 2026-06-07T05:05:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
deferred_uat:
  - test: "실기기 동선 통과: 배너 탭 → 화면 진입 → 단일/전체 재시도 시 행 사라짐 + '다시 시도 중' 토스트 → 왼쪽 스와이프 삭제 + '삭제됨 [실행취소]' 토스트 복구 → 목록 비면 empty state + 뒤로가기 시 배너 자동 소멸"
    why_deferred: "Gesture/animation/navigation·토스트 타이밍은 실기기 상호작용에서만 확인 가능. Phase 3/4/5와 동일하게 end-of-phase UAT batch로 이연 — 코드 레벨 목표 달성은 충족."
---

# Phase 7: Pending-Failed Links Screen Verification Report

**Phase Goal:** 저장 대기열(pending) 링크가 4회 재시도 후 실패하면, 사용자가 boards 탭의 "저장 실패 N개" 배너를 탭해 실패 목록 화면을 열고 각 항목의 실패 사유를 확인한 뒤 재시도하거나 삭제할 수 있다. (Phase 3에서 배너만 만들고 목적지 화면이 누락돼 생긴 깨진 동선을 완성한다.)
**Verified:** 2026-06-07T05:05:00Z
**Status:** passed (코드 레벨 목표 달성 — 실기기 상호작용 UAT는 end-of-phase batch로 의도적 이연)
**Re-verification:** No — initial verification

## Goal Achievement

ROADMAP Phase 7의 `success_criteria`는 빈 배열이므로(SDK 확인), must_haves는 PLAN frontmatter의 5개 truth(ROADMAP Goal + 07-CONTEXT D-01..D-08에서 도출)를 계약으로 채택했다. 5개 모두 실제 코드에서 검증했다 — SUMMARY 주장 신뢰 없이 파일을 직접 읽고, git diff로 surgical 제약을 확인하고, jest/tsc 게이트를 직접 실행했다.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | boards 탭 "저장 실패 N개" 배너 탭이 not-found가 아니라 실패 목록 화면을 연다 (깨진 동선 복구) | ✓ VERIFIED | `boards.tsx:58` `router.push('/boards/failed')` (1회). `app/boards/failed.tsx` 실제 라우트 파일 존재(default export). `_failed*` stub 파일 잔존 0 (`find` 결과 없음). `boards/_layout.tsx`는 file-based Stack이라 `failed.tsx` 자동 등록 |
| 2 | 각 실패 행에 URL(1줄 말줄임) + 한국어 사유 배지 + 상대시각이 표시된다 | ✓ VERIFIED | `failed.tsx:119-128` URL `numberOfLines={1} ellipsizeMode="tail"` + `mapFailReason(item.reason)` 배지(bg-danger/10) + `formatRelativeTime(item.failed_at)`. 렌더 테스트(`failed-screen.test.tsx:65-67`)가 URL + "네트워크 오류" + "3시간 전" 실제 렌더 단언, 통과 |
| 3 | 행별 [재시도]/상단 [전체 재시도]가 재큐잉 + 즉시 drain 트리거, 성공 시 행 사라짐, "다시 시도 중" 토스트 (D-05/D-06, 자동 재시도 0 유지) | ✓ VERIFIED | `failed.tsx:37-42` `onRetry`: `retryFailedPending(url)` → `void drainPendingLinks()` → `showToast('다시 시도 중','info')` → `setItems(listFailedPending())`. `onRetryAll`(45-50) 전체 반복 + drain 1회. drain은 사용자 명시 행동 → D-06 위배 아님. pending.ts drain 상태머신 본문 불변(아래 surgical 확인) |
| 4 | 왼쪽 스와이프 삭제 + "삭제됨 [실행취소]" 토스트 → 복구 (D-07/D-08) | ✓ VERIFIED | `failed.tsx:104-141` `Swipeable` + `renderRightActions` 삭제 Pressable. `onDelete`(54-66): `deleteFailedPending` → `showToast('삭제됨','info',{action:{label:'실행취소', onPress: restoreFailedPending(item)}})`. toast.tsx action slot 실재(label+onPress, Pressable 렌더 107-118). `restoreFailedPending`만 호출 — 화면이 SharedDefaults 직접 import 안 함 |
| 5 | 목록 비면 자동 pop 없이 "저장 실패한 링크가 없어요" empty state (D-02) | ✓ VERIFIED | `failed.tsx:99-103` `ListEmptyComponent`에 정확 문자열. 자동 pop 코드(router.back 자동 호출) 없음. 렌더 테스트(`failed-screen.test.tsx:44-48`)가 빈 큐 시 empty state 렌더 단언, 통과 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/ios/app/boards/failed.tsx` | 실패 목록 라우트 화면 (default export, ≥60줄) | ✓ VERIFIED | 147줄, `export default function FailedLinksScreen()`. 리스트·재시도·전체재시도·스와이프삭제·실행취소·empty state 모두 배선 |
| `apps/ios/lib/failed-format.ts` | mapFailReason + formatRelativeTime 순수 함수 | ✓ VERIFIED | 두 함수 export. D-04 카피 4종 모두 존재(grep -c == 4). 외부 입력 없음 → Zod 불필요(주석 명시) |
| `apps/ios/lib/pending.ts` | FailedPendingLink export | ✓ VERIFIED | `export interface FailedPendingLink`(line 13). 대칭 `restoreFailedPending`(140-144) 신규 추가 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `boards.tsx` 배너 onPress | `/boards/failed` | `router.push` | ✓ WIRED | grep `router.push('/boards/failed')` == 1, `/boards/_failed` == 0 |
| `failed.tsx` | `lib/pending.ts` | listFailedPending/retryFailedPending/deleteFailedPending/restoreFailedPending/drainPendingLinks 호출 | ✓ WIRED | 5개 함수 모두 import(`failed.tsx:6-13`) 및 호출. restoreFailedPending은 실행취소 onPress(61) |
| `failed.tsx` | `lib/failed-format.ts` | mapFailReason/formatRelativeTime import | ✓ WIRED | line 14 import, 124/127 사용 |
| `failed.tsx` | `lib/toast.tsx` | showToast action slot | ✓ WIRED | toast.tsx action 렌더 path(107-118) 실재 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `failed.tsx` | `items` (useState) | `listFailedPending()` → `SharedDefaults.get(PendingLinksFailed)` (pending.ts:114) | Yes — App Group SharedDefaults 실데이터(drain의 classifyError가 기록) | ✓ FLOWING |

화면이 렌더하는 `items`는 하드코딩 빈 배열이 아니라 useFocusEffect + 각 액션 후 `listFailedPending()` 재읽기로 실제 SharedDefaults 큐에서 흐른다. 하드코딩/placeholder 없음.

### Surgical-Constraint Verification (CLAUDE.md §3.3)

| Constraint | Status | Evidence |
| --- | --- | --- |
| pending.ts: `export` 추가 + 신규 `restoreFailedPending`만, enqueue/drain/classifyError/DrainResult 본문 불변 | ✓ PASS | `git show beca22d -- pending.ts` diff = `interface`→`export interface` 1줄 + restoreFailedPending 11줄 신규. drain 상태머신 본문 diff 없음 |
| boards.tsx: 정확히 한 줄 변경(router.push 타깃), 배너 카피/스타일/조건 불변 | ✓ PASS | `git show 104f410 -- boards.tsx` diff = `'/boards/_failed'`→`'/boards/failed'` 단일 라인. 배너 문구 "저장 실패 ${failedCount}개 — 탭하여 확인" 불변 |
| root `app/_layout.tsx` 불변 | ✓ PASS | phase 7 커밋 범위(beca22d^..104f410)에서 `app/_layout.tsx` 변경 없음. Swipeable은 화면-로컬 GestureHandlerRootView로 래핑(failed.tsx:94) |
| `boards/_layout.tsx` 불변 | ✓ PASS | 동일 범위에서 변경 없음 |

### Gate Outputs (verifier가 직접 실행)

| Gate | Expected | Result | Status |
| --- | --- | --- | --- |
| `pnpm jest --silent` | 38/38, 8 suites | `Test Suites: 8 passed`, `Tests: 38 passed` (failed-format + failed-screen 신규 포함, 회귀 0) | ✓ PASS |
| `pnpm tsc --noEmit -p tsconfig.json` | exit 0 | exit code 0 | ✓ PASS |
| grep `router.push('/boards/failed')` | == 1 | 1 | ✓ PASS |
| grep `router.push('/boards/_failed')` | == 0 | 0 | ✓ PASS |
| grep D-04 카피 4종 (failed-format.ts) | 4 | 4 | ✓ PASS |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 순수 헬퍼 결정론 (사유 4종+폴백, 상대시각 4경계) | `pnpm jest failed-format` | 통과(전체 suite 내) | ✓ PASS |
| 화면 렌더 — empty state + 1-row(URL+배지+상대시각) | `pnpm jest failed-screen` | 통과(전체 suite 내) | ✓ PASS |

### Requirements Coverage

Phase 7에 공식 requirement ID 미할당(ROADMAP `Requirements: 미할당`, PLAN `requirements: []`). must_haves는 ROADMAP Goal + 07-CONTEXT D-01..D-08에서 도출 — 위 5개 truth가 곧 계약. ORPHANED requirement 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | — | — | phase 7 변경 4개 파일 모두 TODO/FIXME/XXX/HACK/TBD/placeholder 0, empty handler(`() => {}`)·`return null` stub 0 |

### Human Verification Required

이 phase의 코드 레벨 목표는 정적 검사 + jest 렌더 테스트로 검증 완료. 다만 다음 실기기 상호작용은 grep/jest로 검증 불가하며, Phase 3/4/5와 동일 정책으로 **end-of-phase UAT batch로 의도적 이연**된 항목(실패가 아님):

### 1. 실패 링크 화면 실기기 동선

**Test:** boards 탭에서 "저장 실패 N개" 배너 탭 → 화면 진입 확인 → 행별 [재시도]/상단 [전체 재시도] 눌러 행이 사라지고 "다시 시도 중" 토스트 표시 → 행을 왼쪽으로 스와이프해 삭제 → "삭제됨 [실행취소]" 토스트의 실행취소 눌러 항목 복구 → 목록 비면 "저장 실패한 링크가 없어요" empty state 표시 → 뒤로가기 시 배너 자동 소멸
**Expected:** 위 동선이 끊김/크래시 없이 동작, gesture/토스트 타이밍 자연스러움
**Why human:** Swipeable gesture·navigation 전환·토스트 auto-dismiss 타이밍·drain 후 실제 Supabase 왕복은 실기기 상호작용에서만 확인 가능

### Gaps Summary

없음. 5개 observable truth 전부 실제 코드에서 검증됐고, key link·data-flow(Level 4)·surgical 제약·jest(38/38)·tsc(exit 0)·grep 게이트가 모두 통과했다. SUMMARY의 Self-Check 주장(38/38, _failed 잔존 0, D-04 4종)은 verifier가 독립 재실행으로 사실 확인했다 — 과장 없음. stub/placeholder/하드코딩 빈 데이터 없음.

유일한 미결은 실기기 상호작용 UAT이며, 이는 Phase 3/4/5의 "real-device UAT deferred"와 동일하게 end-of-phase batch로 이연된 follow-up이지 목표 미달이 아니다. 코드 레벨 phase 목표(깨진 동선 복구 + 사유 확인 + 재시도/삭제/실행취소)는 달성됐다.

---

_Verified: 2026-06-07T05:05:00Z_
_Verifier: Claude (gsd-verifier)_
