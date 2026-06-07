# Phase 7: Pending-Failed Links Screen - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

저장 대기열(pending) 링크가 4회 재시도 후 실패하면 `PendingLinksFailed`로 이동하고, boards 탭의 "저장 실패 N개 — 탭하여 확인" 배너가 이 실패 목록 화면을 연다. Phase 3에서 배너(진입점)와 큐 로직(`retryFailedPending`/`deleteFailedPending`)은 만들었으나 **목적지 화면이 누락**되어 배너 탭 시 not-found로 빠지는 깨진 동선이 남았다.

이 phase는 그 **실패 목록 화면 하나**를 구현해 동선을 완성한다:
- 실패 항목 리스트 (URL · 실패 사유 · 실패 시각)
- 항목별/전체 재시도
- 항목 삭제

**스코프 밖:** `board_id` 없는 *pending*(D-03 board-picker 필요) 항목 해소 UI는 별개 — 이 화면은 *failed*만 다룬다. 백그라운드 자동 재시도도 밖 (Phase 5 D-12 = 자동 재시도 0, v2로 이연).

</domain>

<decisions>
## Implementation Decisions

### 화면 형태 & 라우트
- **D-01:** **풀스크린 라우트.** 새 파일 `apps/ios/app/boards/failed.tsx` — default export 라우트 컴포넌트. boards.tsx 배너의 `router.push('/boards/_failed')` 타깃을 **`/boards/failed`로 수정**(깨진 동선 복구의 핵심). 뒤로가기로 boards 복귀.
- **D-02:** **목록이 비면 자동 pop 안 함 + empty state 표시** ("저장 실패한 링크가 없어요"). boards.tsx는 이미 `useFocusEffect`로 `failedCount`를 재계산하므로, 화면에서 모두 처리 후 뒤로가면 배너가 자동 갱신/사라짐 — 기존 동작 그대로, 추가 배선 불필요.

### 행 표시 & 실패 사유 카피
- **D-03:** **각 행 = URL(1줄 말줄임) + 사유 배지 + 상대시각**("3시간 전").
- **D-04:** **reason → 한국어 카피 매핑** (`[id].tsx`의 `mapErrorReason` 패턴 재사용, 별도 매핑 함수):
  - `network` → "네트워크 오류"
  - `auth` → "로그인 필요"
  - `api` → "서버 처리 실패"
  - `unknown` → "알 수 없는 오류"

### 재시도 UX
- **D-05:** **행별 [재시도] 버튼 + 상단 "전체 재시도" 버튼.** 단일 재시도 = `retryFailedPending(url)`(재큐잉 + retry_count 0 리셋) → **즉시 `drainPendingLinks()` 트리거** → 성공 시 행이 목록에서 사라짐 + "다시 시도 중" 토스트. 전체 재시도 = 모든 실패 항목 `retryFailedPending` 후 drain 1회.
- **D-06:** **자동 재시도 0 유지** (Phase 5 D-12 lock). 사용자 명시 행동만. 즉시 drain은 "사용자가 누른 것"이라 D-12 위배 아님.

### 삭제 UX
- **D-07:** **왼쪽 스와이프 → 삭제** (`react-native-gesture-handler`의 `Swipeable`). 대기열 항목(저장 데이터 아님)이라 `Alert` 확인 생략.
- **D-08:** **삭제 시 "삭제됨 [실행취소]" 토스트** (`toast.tsx` action slot 재사용). 실행취소 = 방금 삭제한 항목을 `PendingLinksFailed`에 재추가(복구). Phase 3 D-09(영구삭제 Alert)와 달리 가볍게 — 복구 가능하므로.

### Claude's Discretion
- 상대시각 포맷 세부 문자열("방금"/"N분 전"/"N시간 전"/"N일 전") — 헬퍼 신규 작성(기존 없음).
- 사유 배지 색/스타일 (danger 토큰 계열), 스와이프/전체재시도 reanimated 애니메이션 디테일.
- "전체 재시도" 버튼 노출 위치(헤더 vs 리스트 상단).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7가 완성하는 Phase 3 큐 로직
- `apps/ios/lib/pending.ts` — `listFailedPending()` / `retryFailedPending(url)` / `deleteFailedPending(url)` / `drainPendingLinks()` + `FailedPendingLink` 타입(`url`, `board_id`, `failed_at`, `reason`, `retry_count`). 이 화면이 직접 호출하는 API.
- `.planning/phases/03-ios-save-flow/03-CONTEXT.md` — pending 큐 / drain / `retry_count ≤ 3` 정책(D-04~D-06)의 출처.

### 재사용할 UX 결정 (Phase 5)
- `.planning/phases/05-trust-ui-onboarding/05-CONTEXT.md` §TRUST-03 — 재시도 UX(D-10/D-11/D-12, 자동 재시도 0), destructive 비주얼(`text-danger`), reason→카피 선례.

### Phase 정의
- `.planning/ROADMAP.md` §"Phase 7: 저장 실패 링크 목록 화면" — goal / depends-on.

(외부 SPEC.md 없음 — 요구사항은 위 decisions에 모두 캡처됨.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/ios/lib/pending.ts` — 화면이 쓸 모든 함수 이미 존재(`listFailedPending`/`retryFailedPending`/`deleteFailedPending`/`drainPendingLinks`). **신규 도메인 로직 작성 거의 불필요** — UI 배선이 핵심.
- `apps/ios/lib/toast.tsx` — `showToast(msg, kind, { durationMs, action: { label, onPress } })`. undo(삭제) + 재시도 피드백에 그대로 사용. action slot은 Phase 5 D-10에서 추가됨.
- `apps/ios/app/boards/[id].tsx` `mapErrorReason()` — reason→한국어 매핑 패턴 선례(복사 대상, 재사용 아님 — reason enum이 다름).
- `packages/ui-tokens` — `danger`/`neutral`/`brand` 토큰(NativeWind `className`). 배너가 이미 `bg-danger/5 border-danger/20` 사용 — 화면도 동일 톤.
- `react-native-gesture-handler` ~2.28 — `Swipeable`로 스와이프 삭제(이미 설치, @gorhom/bottom-sheet 의존성).

### Established Patterns
- 스크린 = `SafeAreaView` + NativeWind `className` (boards.tsx / [id].tsx 동형).
- `useFocusEffect`로 `SharedDefaults` 재읽기 (boards.tsx `failedCount` 패턴) — failed 화면도 focus 시 `listFailedPending()` 재읽기 권장.
- **라우트 파일은 반드시 default export 컴포넌트** — `app/` 안 helper는 `_` 접두사로 숨길 수 없음(Phase 7 직전 정리에서 helper 4개를 `components/`로 이동). `failed.tsx`는 *진짜 라우트*이므로 `app/boards/`에 default export로 둔다.

### Integration Points
- **boards.tsx 배너 onPress**: `router.push('/boards/_failed')` → `'/boards/failed'` 수정 — 깨진 동선 복구의 단일 핵심 변경.
- `apps/ios/app/boards/_layout.tsx` — expo-router file-based라 `failed.tsx`는 자동 등록. header title("저장 실패") 옵션만 확인.
- `FailedPendingLink`는 pending.ts에서 **export 안 된 interface** → 화면에서 타입 필요 시 `export` 추가하거나 `ReturnType<typeof listFailedPending>[number]` 사용(surgical 선택).

</code_context>

<specifics>
## Specific Ideas

- 실패 사유 카피 4종 확정 문자열(D-04) — 변경 시 이 문서 갱신.
- 배너 문구 "저장 실패 N개 — 탭하여 확인"은 기존 유지(이 phase에서 안 바꿈).

</specifics>

<deferred>
## Deferred Ideas

- **백그라운드 자동 재시도** — Phase 5 D-12에서 v2로 이연(OBS-01 Sentry로 실패 패턴 측정 후). 이 phase는 사용자 명시 재시도만.
- **`board_id` 없는 pending 항목 해소 UI** (Phase 3 D-03 board-picker) — *pending*이지 *failed*가 아니라 이 화면 밖. 별도 작업.

</deferred>

---

*Phase: 7-pending-failed-links-screen*
*Context gathered: 2026-06-07*
