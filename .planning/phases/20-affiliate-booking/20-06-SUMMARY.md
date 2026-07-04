---
phase: 20-affiliate-booking
plan: 06
subsystem: ios
tags: [expo, booking, affiliate, plan-tab, nativewind, compare-frame, checklist]
requires:
  - "20-03: @moajoa/core BOOKING_REGION_MAP/COMPARE_LABELS/isBookableActivity/deriveChecklistAutos + buildSearchDestUrl/buildAiraloDestUrl"
  - "20-04: @moajoa/api listChecklist/reconcileChecklist (checklist item id 연결)"
  - "20-05: @/lib/booking openBooking/openDirectSearch/kkdayAvailable + CompareFrameCard full/compact"
provides:
  - "plan.tsx 여행 준비 클러스터 — showBookingCluster 게이트(plan && start_date), 숙소 full 카드 + 유심/교통 BookingRowCard 행"
  - "day-section.tsx renderBookingStrip optional prop — booking-blind 슬롯 (드래그/reorder 무접촉)"
  - "plan 탭 클릭 → checklist item id 동반 openBooking/openDirectSearch (D-03 데이터는 하나)"
affects:
  - "20-07 book 탭이 동일 checklist 행을 읽어 '확인함' 전이를 표면화 (같은 listChecklist seam)"
tech-stack:
  added: []
  patterns:
    - "surgical 조건 분기 삽입: 19-03 관리카드 선례 그대로 — 상태머신 A–F·19 분기 diff 0"
    - "reconcile-on-load: deriveChecklistAutos diff 있을 때만 reconcileChecklist → 재조회, 실패는 console.warn 보조 데이터 idiom"
    - "booking-blind 컴포넌트 슬롯: DaySection이 renderBookingStrip 콜백만 호출 — 게이트/핸들러 지식은 부모 소유"
key-files:
  created: []
  modified:
    - apps/ios/app/trip/[id]/(tabs)/plan.tsx
    - apps/ios/components/plan/day-section.tsx
    - apps/ios/__tests__/plan.test.tsx
key-decisions:
  - "유심/교통 행은 CompareFrameCard가 아닌 로컬 BookingRowCard(단일행 카드) — UI-SPEC Screen 1의 single-provider row 해부도(칩+타이틀 블록+[보기] 한 행)가 full variant(헤더+행 2층)와 다른 shape"
  - "userId는 load()의 supabase.auth.getUser()로 1회 확보 — 탭 시점 await 금지(D-14 오픈-선행)라 핸들러 내 fetch 불가"
  - "strip도 showBookingCluster 게이트 공유 — dateless+plan(투표 없음/마감) trip이 State D로 떨어져도 예약 표면 0 유지 (D-04)"
metrics:
  duration: "~12min"
  completed: "2026-07-04"
  tasks: 3
  tests: "iOS 15 suites / 112 tests green (plan.test 9 기존 + 5 신규)"
status: complete
---

# Phase 20 Plan 06: plan 탭 인라인 예약 카드 Summary

**One-liner:** plan 탭 State D/E에 '여행 준비' 클러스터(숙소 Agoda/Booking full 카드 + Airalo 유심·교통 패스 행, D-09 미커버시 행 부재)와 예약성 항목 하단 Klook/KKday '예약 비교' compact strip을 surgical 삽입 — 모든 [보기]가 checklist item id를 갖고 mint→open→log로 발화, 상태머신·19 분기 diff 0.

## What Was Built

### Task 1 — 여행 준비 클러스터 (f617e33)

`plan.tsx` (삽입만, 기존 상태머신·19-03 관리카드 분기 무수정):

- **게이트:** `const showBookingCluster = !!plan && !!trip?.start_date;` — 19 관리카드(`isDateless && poll open`)와 상호배타 (D-04). 렌더 위치는 PATTERNS 지정 seam(TravelModeToggle ↔ Day sections).
- **데이터:** `load()` Promise.all에 `listChecklist`(실패시 warn + `[]` — 보조 데이터) + `supabase.auth.getUser()`(클릭 귀속 userId) 추가. 모듈 함수 `reconcileTripChecklist`가 D-04 게이트 통과시 배치된 예약성 장소 × `BOOKING_REGION_MAP[city_code]` 커버리지로 `deriveChecklistAutos` 계산 → **diff 있을 때만** `reconcileChecklist` 후 재조회, 실패는 console.warn (카드 렌더 계속).
- **렌더:** 섹션 라벨 '여행 준비' → CompareFrameCard full(bed-outline, '숙소 예약', caption `{도시} · {MM.DD–MM.DD}`, Agoda/Booking rows — `COMPARE_LABELS`, onView=`openDirectSearch`(city는 `CITY_KO_MAP` 한글명, checkIn/Out=trip 날짜, stay 항목 id)) → 유심 행(`esimSlug` 존재시: BookingRowCard cellular-outline + '여행 유심' + Airalo, onView=`openBooking({program:'airalo', destUrl: buildAiraloDestUrl(...), checklistItemId: esim id})`) → 교통 행(transport 존재시: train-outline + labelKo, onView=`openBooking({program: provider, destUrl: buildSearchDestUrl(provider, searchQuery), checklistItemId: transport id})` — **교통 행도 checklist id 연결**, D-11). 매핑 null이면 행 자체 미렌더 (빈 셸·준비중 금지 — D-09).
- 밀도(D-02): 큰 카드 정확히 1 + 컴팩트 행 ≤2, trip당 1회, 브랜드는 [보기]에만.
- `BookingRowCard` 로컬 컴포넌트: plan-item-row 해부도(ROW_SHADOW + neutral 칩 + 타이틀 블록 + brand-50 [보기], hitSlop ≥44px, a11y `{provider}에서 보기`).

### Task 2 — 예약 비교 compact strip (25071f0)

- `day-section.tsx`: `renderBookingStrip?: (placeId: string) => ReactNode` optional prop — 각 row 직후 호출부만 삽입 (map을 keyed `Fragment`로 감쌈). **드래그 Gesture.Pan/reorder 로직 변경 라인 0** (`git diff -U0 | grep -c "Gesture\|reorder"` == 0).
- `plan.tsx` 주입: `isBookableActivity(place.category)` && `showBookingCluster`일 때만 CompareFrameCard compact(Klook + `kkdayAvailable()`시 KKday, onView=`openBooking({program, destUrl: buildSearchDestUrl(program, place.name_ko ?? place.name_local), ctx: {…, placeId}, checklistItemId: activity 항목 id})` — D-07 장소명 검색결과 직행). 맛집·카페 절대 없음 (D-08). `ml-11`(드래그핸들 칼럼 클리어) + `mb-2.5` 리듬, 확장 상태 없음 (full frame은 book 탭 — D-03).

### Task 3 — plan.test.tsx 게이트 케이스 (3396d2f)

mock 하네스 확장(`listChecklist`/`reconcileChecklist` api mock + `@/lib/booking` 전체 stub(kkdayAvailable=true) + supabase `auth.getUser`) 후 5 케이스, 기존 케이스 무수정:

1. tokyo dated+plan → '여행 준비' + '숙소 예약' + '여행 유심' + 'JR 패스'
2. seoul → 클러스터는 뜨되 유심/교통 행 부재 (D-09)
3. plan null (State B) → '여행 준비' null (D-04)
4. dateless + open poll → 관리카드 렌더 + '여행 준비'/'예약 비교' null (상호배타)
5. tourist_attraction → '예약 비교' + Klook/KKday / ramen_restaurant → strip null (D-08)

## Verification Evidence

- `pnpm --filter @moajoa/ios test -- plan --watchman=false` → **14/14 green** (기존 9 무수정 + 신규 5)
- 전체 suite: **15 suites / 112 tests green** (기존 107 → +5, 무회귀), typecheck exit 0 (Task 1·2 각각)
- grep 게이트: `여행 준비` == 1 · `showBookingCluster` == 2 · `날짜 투표 진행 중` == 1 (19 무손상) · day-section `renderBookingStrip` == 3 (>=2) · plan.tsx `isBookableActivity` == 3 (>=1) · day-section 변경 라인 Gesture/reorder == 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] userId 확보 배선 (supabase.auth.getUser)**
- **Found during:** Task 1
- **Issue:** `openBooking`/`openDirectSearch`의 `ctx.userId`가 필수(booking_clicks WITH CHECK `user_id = auth.uid()`)인데 plan.tsx에 auth user가 없음. 탭 핸들러 안 fetch는 D-14(오픈-선행, await 금지) 위반.
- **Fix:** load() Promise.all에 `supabase.auth.getUser()` 추가 → `userId` state. 테스트 supabase mock에 `auth.getUser` 확장.
- **Files modified:** plan.tsx, plan.test.tsx
- **Commit:** f617e33 / 3396d2f

### Acceptance-gate 표기 차이 (코드 무결)

- `grep -c "reconcileChecklist"` == 1 기대 → **실측 2** (named import 라인 + 단일 호출 지점). 의도(산재 없는 단일 reconcile seam)는 충족 — 호출 지점은 `reconcileTripChecklist` 안 1곳뿐.
- `git diff day-section.tsx | grep -c "Gesture\|reorder"` == 0 기대 → 기본 diff는 컨텍스트 라인(gesture-handler import 근처의 신규 `Fragment` import) 1 매치. **변경 라인만(-U0)은 0** — 드래그 로직 무접촉 검증됨.
- plan.test.tsx 기존 케이스는 7이 아닌 **9** (18-05의 4 + 19-03의 3 + closed-poll 2… 실측 9) → 총 14. "기존 무수정 + 신규 5" 계약은 그대로 충족.

## UAT Items (phase verify로 배치 — Task 3 human-check)

- 실기기: tokyo trip plan 탭 [보기] 탭 → **시스템 Safari**가 열리고 Klook/KKday 검색결과에 장소명 착지 (A1/A2 [ASSUMED] — 봇차단으로 사람 눈이 유일 게이트, RESEARCH Pitfall 8)
- TP 대시보드에서 클릭·SubID 집계 확인 (A4)
- 유심/교통 행 [보기] → Airalo/Klook 착지 + book 탭(20-07 이후) 동일 항목 '확인함' 전이 확인

## Known Stubs

None — 클러스터/strip 모두 실 데이터(BOOKING_REGION_MAP·checklist·plan_items) 배선.

## 핸드오프 (20-07)

- checklist 행은 이미 plan 탭 load가 reconcile — book 탭은 `listChecklist`만 읽어도 auto 행(stay/esim/transport/activity)이 존재.
- plan 탭 클릭은 checklist item id를 갖고 로깅되므로 book 탭 '확인함' 배지가 즉시 정합 (D-03 한 데이터셋).
- `BookingRowCard`는 plan.tsx 로컬 — book 탭 확장 row는 UI-SPEC Screen 3의 checklist-row 해부도를 별도 구현 (공유 강요 없음).

## Self-Check: PASSED

- apps/ios/app/trip/[id]/(tabs)/plan.tsx — FOUND
- apps/ios/components/plan/day-section.tsx (renderBookingStrip) — FOUND
- apps/ios/__tests__/plan.test.tsx (14 tests) — FOUND
- commits f617e33 / 25071f0 / 3396d2f — FOUND
