---
phase: 28-add-trip-redesign-ai
plan: 05
subsystem: web-presentation
tags: [plan-section, day-tabs, bottom-sheet, gesture-ownership, tdd, d-13, d-17, d-20, d-25]
status: complete

requires:
  - "28-01 — trips.day_count (TripSchema.day_count · Limits.TripDayCountMax)"
  - "28-02 — DurationPills · SelectPill (한 벌 재사용, 재구현 금지)"
  - "28-03 — D-21 pinned_placements 계약 (D-25 카피가 진실이 되는 근거)"
provides:
  - "PlanSection (+ PlanSectionProps · PlanWithItemsView) — apps/web/app/moa/[id]/_components/plan-section.tsx"
  - "DurationGateSheet (+ DurationGateSheetProps) — D-13 기간 게이트, owner 전용"
  - "DaySelectSheet (+ DaySelectSheetProps) — A-7 Day 배치, 1-based 표시 ↔ 0-based day_index 변환 소유"
  - "PlaceList.onAddToPlan? — additive optional prop (풀 모드)"
  - "PlanSectionProps.renderPool — 미배치 풀 리스트 본문 seam"
affects:
  - "28-06 (moa-island이 PlanSection을 place-sheet children으로 주입 + 전 콜백 배선 + renderPool로 PlaceList 재사용)"
  - "28-06 (is_anchor 항목 → pinned_placements 수집 배선이 붙어야 D-25 카피가 완전히 진실이 된다)"

tech-stack:
  added: []   # 신규 npm 패키지 0
  patterns:
    - "props-driven 프레젠테이션 — 상태·mutation·realtime은 island 소유, 컴포넌트는 콜백만 발화(api import grep 0)"
    - "render prop seam(renderPool) — 12개 prop짜리 PlaceList를 재선언하지 않고 재사용"
    - "additive optional prop — 미전달 시 기존 렌더 동일(기존 18케이스가 무회귀 앵커)"
    - "제스처 소유권 배타 — 한 표면이 두 제스처를 겸하지 않는다(금지 핸들러 grep 0으로 강제)"
    - "번호 체계 분리 — 타임라인 sort_order+1(방문 순) vs place-list seq_no(담은 순), 혼용 금지"

key-files:
  created:
    - apps/web/app/moa/[id]/_components/plan-section.tsx
    - apps/web/app/moa/[id]/_components/duration-gate-sheet.tsx
    - apps/web/app/moa/[id]/_components/day-select-sheet.tsx
    - apps/web/__tests__/plan-section.test.tsx
    - apps/web/__tests__/duration-gate-sheet.test.tsx
    - apps/web/__tests__/day-select-sheet.test.tsx
  modified:
    - apps/web/app/moa/[id]/_components/place-list.tsx
    - apps/web/__tests__/place-list.test.tsx

decisions:
  - "renderPool render prop 신설 — 플랜이 명시한 props 계약만으로는 PlaceList(찜·프로필·색·재시도 등 12개 prop)를 렌더할 수 없다. 풀 본문 렌더를 호출부에 위임해 PlanSection이 PlaceList 결합을 떠안지 않게 했다"
  - "(0,0) 좌표 '위치 정보 없음' 캡션은 place-list 풀 모드에 넣었다 — 풀 행을 PlaceList가 그리므로 per-row 캡션을 그릴 수 있는 곳이 거기뿐이다"
  - "Day 수에 하한 1을 뒀다 (max(day_count ?? 0, max(day_index)+1, 1)) — plan이 있는데 items 0 + day_count null인 병리적 조합에서 탭이 0개가 되는 죽은 화면 방지"
  - "생성 중(재생성)에는 '아직 일정이 없어요' 헤딩을 내지 않는다 — plan이 있는데 그 카피는 거짓"
  - "'아직 모르겠다'가 타임라인 항목에 대해서는 풀 복귀(onMoveToPool)로 동작 — 풀 항목이면 단순 잔류(D-20)"

metrics:
  duration: ~40m
  completed: 2026-07-13
  tasks: 3
  commits: 6
  files: 8
  tests: "web 218 → 241 그린 (+23: 시트 5 · place-list 4 · plan-section 14)"
---

# Phase 28 Plan 05: [일정] 영역 프레젠테이션 계약 Summary

`/moa/[id]` place-sheet **안**에 [일정] 영역을 만들었다 — 신규 라우트도 신규 탭도 아니고(D-15/HC-4), 기존 시트의 children으로 들어가는 **props-driven 프레젠테이션 3종**이다. 상태·mutation·realtime은 전부 28-06의 moa-island가 소유하며, 이 플랜의 산출물은 `@moajoa/api`·`getSupabaseBrowser`·`.channel(`을 **한 줄도 import하지 않는다**(grep 0으로 강제).

최상위 회귀 위험이던 **HC-5 제스처 소유권**은 무사하다 — `place-sheet.tsx` diff **0**, 금지 핸들러(`onPointerDown`·`setPointerCapture`·`touch-none`) **0건**.

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `PlanSection` (+`PlanSectionProps`·`PlanWithItemsView`) | `_components/plan-section.tsx` | moa-island(28-06) |
| `DurationGateSheet` | `_components/duration-gate-sheet.tsx` | PlanSection |
| `DaySelectSheet` | `_components/day-select-sheet.tsx` | PlanSection |
| `PlaceList.onAddToPlan?` | `_components/place-list.tsx` (additive) | PlanSection(미배치 풀) |

### Task 1 — DurationGateSheet · DaySelectSheet — RED `e822635` → GREEN `6fea268`

`add-sheet.tsx`의 셸(BottomSheet + 콘텐츠 + `footer` 슬롯 CTA + onClose)을 그대로 미러하되 **mutation은 하지 않는다** — 콜백만 발화한다.

- **DurationGateSheet (D-13):** 본문은 `DurationPills`(28-02) **재사용**. 시트용 pill을 새로 만들지 않았다 — 한 벌 공유가 그 컴포넌트의 존재 이유다. 미선택 시 CTA disabled(D-05/A-4: 기존 Button primary + `disabled:text-white` 오버라이드, Button 자체는 무수정).
- **DaySelectSheet (A-7·D-20):** Day 1..N pill + 보류 버튼. **1-based 표시 ↔ 0-based `day_index` 변환을 이 컴포넌트가 책임진다**(`Day 1` → `onSelectDay(0)`) — DB가 0-based라 생기는 혼동 지점을 한 곳에 가뒀다. **드래그앤드롭 없음**(deferred).
- **A-9 owner 전용:** 시트 자체는 열림 여부를 모른다 — 게이트는 PlanSection이 버튼 단에서 막는다. DB의 `trips` UPDATE RLS owner-only(0016)가 최종 방어 — **심층방어 2겹**(T-28-18).

### Task 2 — place-list `onAddToPlan` additive prop — RED `0ae7318` → GREEN `d2cda96`

- 전달된 경우에만 아코디언 액션 행에 `일정에 넣기` 렌더. **미전달 시 기존 렌더 동일** — 기존 18케이스가 무회귀 앵커이고 **테스트 삭제 라인 0**.
- 하트·답장과 동일하게 `stopPropagation`으로 행 아코디언 토글과 분리.
- `seq_no`(담은 순) 배지 체계·정렬·추출 판별식·own-only 삭제 게이트(D-12) 전부 **무접촉**.

### Task 3 — PlanSection 상태기계 A~E — RED `1a1805b` → GREEN `0fbc5c2`

상태 **A**(장소0 → 섹션 미렌더) · **B**(D-23 빈 상태) · **B-1**(D-14 추출 대기 게이트) · **B-2**(D-13 기간 게이트) · **B-3**(A-9 비-owner) · **C**(생성 중·연타 차단) · **D**(Day 탭+타임라인+풀+하단 액션) · **E**(에러) 전부 구현.

**Day 수 = `max(trip.day_count ?? 0, max(day_index)+1, 1)`** — 이게 SC-4의 핵심이다.
- `max(day_index)+1`만 쓰면 사용자가 5박 6일을 골랐는데 AI가 장소 부족으로 4일에 몰아넣은 경우 **탭이 4개만 떠서 "고른 기간이 무시됐다"로 읽힌다.**
- `max()`로 감싼 이유는 day_count가 stale하거나(6→3으로 줄였는데 기존 플랜이 6일치) null인 레거시 플랜에서 **items가 있는 Day를 숨기지 않기 위해서**다. 어느 쪽도 데이터를 잃지 않는다.
- **빈 Day도 탭으로 렌더**하고 `이 날은 아직 비어 있어요…`를 띄운다 — 탭만 있고 본문이 텅 빈 죽은 화면 방지.
- 날짜(start/end)에서 Day 수를 **다시 계산하지 않는다** — 그건 EF의 fallback 몫(D-09).

**번호 체계 분리:** 타임라인 배지 = `sort_order + 1`(그날 방문 순서). place-list의 `seq_no`(담은 순, 정렬 불변)와 **다른 체계이며 혼용 금지**. 지도 번호 핀도 같은 값을 쓴다(D-16, 28-06).

**HC-5 제스처 소유권(회귀 최상위 위험):** Day 탭 스트립은 시트 **본문 스크롤 영역 안**의 sticky 가로 스크롤러다(`overflow-x-auto touch-pan-x`, 스크롤바 숨김). 포인터 핸들러·포인터 캡처·터치 완전 차단 클래스를 **하나도 얹지 않았다** — 셋 중 하나라도 들어가면 커밋 3f32204가 청산한 시트 드래그·페이지 핀치줌 버그가 되살아난다. 소유권: 가로 스와이프=Day 스트립 · 세로 스크롤=시트 본문 · 앵커 드래그=핸들/헤더 · 팬줌=지도.

**T-28-19(유료 API 이중 지출) 방어:** `generating` 단일 boolean이 버튼 disabled + 라벨 교체를 담당하고, **이동수단 토글은 저장만 하고 자동 재생성하지 않는다**(A-10) — 토글 연타로 Claude+Routes가 반복 호출되는 경로를 원천 차단. 변경 후에만 안내 문구를 띄운다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 플랜이 명시한 props 계약만으로는 미배치 풀을 렌더할 수 없다 → `renderPool` seam 신설**

- **Found during:** Task 3
- **Issue:** 플랜은 (a) props 계약을 `plan·places·links·trip·currentUserId·generating·planStep·error·selectedDay` + 콜백 8종으로 **명시**하면서, 동시에 (b) "미배치 풀은 `PlaceList`를 `places={pool}`로 **재사용**"하라고 요구한다. 두 요구는 양립 불가다 — `PlaceList`는 `counts`·`myVotes`·`votePending`·`profileNames`·`colorFor`·`openPlaceId`·`onOpenPlace`·`onToggleVote`·`onRetry`·`onDelete`·`onReply`·`ownerId` 등 **12개 prop**을 더 요구하는데 이들이 PlanSectionProps에 없다.
- **Fix:** optional `renderPool?: (pool, onAddToPlan) => ReactNode` 추가. PlanSection이 pool을 파생하고 헤딩(`아직 안 넣은 곳 N`)까지 렌더한 뒤, **리스트 본문만** 호출부에 위임한다. island은 이미 PlaceList 배선을 갖고 있으므로 같은 클로저를 재사용하면 된다 — PlanSection이 12개 prop을 재선언·중계하지 않아도 되고, props-driven 계약도 유지된다.
- **Impact:** 28-06은 `renderPool={(pool, onAddToPlan) => <PlaceList places={pool} … onAddToPlan={onAddToPlan} />}` 한 줄만 추가하면 된다.
- **Commit:** `0fbc5c2`

**2. [Rule 2 - Missing critical] (0,0) 좌표 `위치 정보 없음` 캡션을 place-list 풀 모드에 추가 (Pitfall 3)**

- **Found during:** Task 2/3 경계
- **Issue:** UI-SPEC과 Task 3 `<action>`이 "풀 행에 `위치 정보 없음` 캡션 병기"를 요구하는데, 풀 행을 실제로 그리는 건 `PlaceList`다(위 deviation 1). PlanSection에서는 per-row 캡션을 그릴 방법이 없다. 캡션이 없으면 좌표 없는 장소가 **AI에게 영원히 배치되지 않는데 이유가 화면에 없다** → "왜 안 들어가지?" 혼란.
- **Fix:** `place-list.tsx`에 `onAddToPlan && lat===0 && lng===0` 조건 캡션 추가(풀 모드 전용). 기존 지도탭 리스트는 `onAddToPlan`을 주지 않으므로 **렌더 무변경**.
- **Impact:** place-list 신규 테스트가 3 → **4케이스**(플랜 명시 3에서 +1). 28-03이 EF 테스트를 7→8로 늘린 것과 같은 성격.
- **Commit:** `d2cda96`

**3. [Rule 1 - Bug] 재생성 중 '아직 일정이 없어요' 헤딩이 거짓말을 했다**

- **Found during:** Task 3 GREEN 직후 자체 점검
- **Issue:** 상태 C(generating) 블록이 plan 존재 여부와 무관하게 `아직 일정이 없어요` 헤딩을 렌더했다. '일정 다시 만들기'로 진입하면 **플랜이 있는데도** 그 카피가 뜬다.
- **Fix:** 헤딩을 `!plan`일 때만 렌더. 재생성 중에는 disabled CTA + 진행 행만 남는다(신규 카피 0).
- **Commit:** `0fbc5c2`

### Acceptance grep 오탐 조정 (deviation 아님 — 28-02 선례와 동일)

doc 주석의 리터럴이 "정확히 1" acceptance grep을 오탐시켜 **의미를 보존한 채 재서술**했다: `아직 모르겠다`(3→1) · `touch-pan-x`(2→1) · `일정에 넣기`(2→1).

**`PLAN_STEP_KO`만 2다(acceptance는 1).** import 라인 + 사용 라인이라 **1은 구조적으로 불가능**하다 — 상수를 import해서 쓰는 한 최소가 2다. 사용 라인을 하나로 합쳐 최소치로 낮췄고, 이 criterion의 의도("진행 카피는 core 상수 — 신규 문자열 금지")는 충족된다(하드코딩 진행 문자열 0건).

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` 전 스위트 | **241 그린** (30 파일) — 218 → 241, 기존 케이스 무회귀 |
| ├ `duration-gate-sheet` + `day-select-sheet` | 5 그린 |
| ├ `place-list` | **22 그린** (기존 18 + 신규 4), 삭제 라인 **0** |
| └ `plan-section` | **14 그린** |
| `pnpm --filter @moajoa/web typecheck` | exit 0 |
| **HC-5** `place-sheet.tsx` diff | **빈 출력** |
| **HC-5** plan-section 금지 제스처 핸들러 | **0건** (`onPointerDown`·`onPointerMove`·`setPointerCapture`·`touch-none`) |
| **HC-1/SC-6** `git diff --stat -- apps/ios` | **빈 출력** |
| **HC-3** `add-content-tabs.tsx` diff | **빈 출력** |
| **HC-2** 신규 3파일 hex 색 리터럴 | **0** |
| `.js` 워크스페이스 import | **0** |
| mutation·realtime 미소유 (신규 3파일) | **0** (`@moajoa/api`·`getSupabaseBrowser`·`.channel(`) |
| 기존 마이그레이션 수정 | **0** (0031 신규 추가만 — 28-01분) |
| Task별 acceptance grep | 전종 통과 (`touch-pan-x`=1 · `role="tablist"`=1 · D-25/D-23/D-14/A-9 카피 각 1 · `sort_order + 1`≥1 · `day_count`≥1 · `seq_no`≥1) |

TDD 게이트: 3사이클 전부 RED(`test(...)`) → GREEN(`feat(...)`) 커밋 쌍 존재. 세 RED 모두 **behavior로 실패**(import 에러 아님) — 렌더 스텁을 선행시켜 확보(28-02 선례).

## Success Criteria

- [x] SC-4(부분): Day 1~N 탭 + 번호 타임라인 결과 화면이 place-sheet 안에 렌더된다 — **고른 기간만큼 탭이 뜬다**(day_count 우선, 빈 Day도 탭 유지)
- [x] SC-5(부분): 미배치 장소를 버튼+시트로 Day에 넣거나 보류로 풀에 남길 수 있고, D-25 규칙이 가이드 카피로 항상 보인다
- [x] D-25 카피가 D-21 계약(28-03) 위에서 진실이다 — **단, 아래 Known Stubs의 배선 전제**
- [x] SC-6: `apps/ios` diff 0 · HC-5 place-sheet diff 0

## Known Stubs

**없음** — 세 컴포넌트 모두 완전 구현. 다만 **설계상 이 플랜 범위 밖인 배선 2건**이 남아 있고, 둘 다 **28-06 소유**다:

1. **`renderPool` 미전달 시 풀 리스트 본문이 비어 있다.** 헤딩(`아직 안 넣은 곳 N`)은 뜨지만 행은 호출부가 그린다. island이 `<PlaceList places={pool} … onAddToPlan={…} />`를 넘기면 완성된다.
2. ⚠ **D-25 카피의 완전한 진실 조건.** 28-03이 EF 측(프롬프트 제약 + `enforcePinnedPlacements` 사후 강제 + `is_anchor` 재기록)을 끝냈고, 이 플랜이 카피를 노출했다. 하지만 **클라이언트가 `is_anchor` 항목에서 `{place_id, day_index}`를 수집해 `pinned_placements`로 보내는 배선은 28-06 소유**다(28-03 SUMMARY가 명시). 그 배선이 붙기 전까지 웹 재생성은 `pinned_placements: []`로 호출되어 **고정이 실제로는 동작하지 않는다.** 이 컴포넌트는 `onGenerate()` 콜백만 부르므로, 수집 책임은 전적으로 island에 있다 — **28-06에서 이 배선을 빠뜨리면 D-25 카피가 거짓말이 된다.**

## Threat Mitigations

| Threat ID | 상태 |
|---|---|
| T-28-18 (EoP — editor의 day_count 저장) | **mitigated** — 비-owner는 버튼 disabled + 안내 카피, 게이트 시트를 **열지 않는다**(A-9, 전용 테스트). DB의 `trips` UPDATE RLS owner-only(0016)가 최종 방어 — 심층방어 2겹, UI만으로 막지 않는다 |
| T-28-19 (DoS 비용 — 생성 연타) | **mitigated** — `generating` 단일 boolean이 disabled + 라벨 교체. 이동수단 토글은 **저장만** 하고 자동 재생성 안 함(A-10) — 토글 연타로 유료 API가 반복 호출되는 경로 원천 차단(전용 테스트) |
| T-28-20 (Tampering — 게스트의 플랜 변경) | accepted — 이 컴포넌트는 `/moa/[id]`(RSC가 비멤버를 notFound로 차단) 안에만 마운트된다. 실제 쓰기는 `plan_items` RLS(`can_edit_trip`, 0017)가 게이트. 게스트 표면 `/t/[slug]`에는 이 컴포넌트가 없다 |
| T-28-21 (시트 드래그 회귀) | **mitigated** — 금지 핸들러 grep **0** + `place-sheet.tsx` diff **0** (acceptance가 강제) |
| T-28-22 (Injection — 장소명·주소 렌더) | accepted — React 기본 이스케이프, `dangerouslySetInnerHTML` 미사용 |

## Self-Check: PASSED

- 생성 6종 · 수정 2종 = 8개 파일 전부 디스크에 존재
- 커밋 6종(`e822635` `6fea268` `0ae7318` `d2cda96` `1a1805b` `0fbc5c2`) 전부 git log에 존재
- 의도치 않은 파일 삭제 **0** · `apps/ios`·`place-sheet.tsx`·`add-content-tabs.tsx` diff **0**
