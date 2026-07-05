---
status: partial
phase: 20-affiliate-booking
source: [20-VERIFICATION.md, 20-VALIDATION.md]
started: 2026-07-04T20:55:27Z
updated: 2026-07-05T04:07:37Z
updated_by: sim-automation (idb + simctl, iPhone 17 Pro, 원격 Supabase)
---

## Current Test

[Test 5 완료(PASS). Test 3/4는 예약 탭 무한 로딩 버그로 BLOCKED. Test 1/2/6은 미실행(플랜 초안 필요·외부 로그인·2브라우저).]

## Tests

### 1. 실기기 [보기] → 시스템 Safari 착지 (A1/A2, ATTR-02/BOOK-03)
expected: `pnpm sim` 또는 실기기에서 날짜 확정 + 플랜 초안 있는 일본 도시 trip 열기 →
  1. plan 탭 '여행 준비' 클러스터의 숙소 [보기](Agoda/Booking) → 시스템 Safari로 열림 (인앱 브라우저 아님)
  2. 액티비티 항목 아래 '예약 비교' strip의 Klook [보기] → Safari 착지 페이지가 해당 장소명 검색결과
  3. KKday [보기](env 배선 시) / 유심 Airalo / 교통 패스 행도 각각 정상 착지
  4. URL이 tracking 도메인(c137.travelpayouts.com 또는 tp.media) 경유 후 목적지 도달 — 한글 장소명 인코딩 파손 없음
result: [not-run] — 전제조건(날짜 확정 + **플랜 초안 있는** trip) 미충족. 현재 원격에 장소·플랜이 있는 trip이 없어 plan 탭 인라인 예약 카드가 노출되지 않음(D-04: 플랜 초안 없으면 카드 숨김). 검증하려면 링크 추출 → 장소 → 플랜 생성 선행 필요(별도 세션). ATTR-02의 "실기기 크로스세션 쿠키 보존"은 원리상 시뮬레이터로 검증 불가(실기기 필요).

### 2. Travelpayouts 대시보드 SubID 집계 (A4/A3, ATTR-02)
expected: 위 실클릭 1건 이상 발생 후 →
  1. TP 대시보드 통계에 클릭이 집계됨 (marker 745749)
  2. SubID가 marker-dot 형식(745749.c_XXXXXXXXXXXXXXXX)으로 붙어 booking_clicks의 click_token과 대조 가능
result: [not-run / 자동화 불가] — Travelpayouts 대시보드는 외부 서비스 로그인 필요, sim 자동화 범위 밖. 사람 검증 필수. Test 1 실클릭 선행 필요.

### 3. 복귀 '확인함' 전이 + D-13 보존 배지 (BOOK-02, D-11/D-13/D-15)
expected:
  1. book 탭에서 항목 [보기] → Safari → 앱 복귀 시 팝업/에러 화면 없이 해당 행이 조용히 '확인함' 배지 + '예약했으면 체크해주세요' 인라인 힌트로 갱신
  2. plan 탭에서 클릭해도 book 탭 동일 항목이 '확인함' (데이터는 하나, D-03)
  3. 액티비티 항목을 체크(완료) 후 플랜 다시 만들기로 해당 장소가 빠져도 그 행이 '플랜에 없음' 배지와 함께 보존됨
  4. auto+완료 행은 확장해도 '항목 삭제' 버튼이 숨겨짐 (돈 쓴 기록 보존)
result: [blocked] — **예약(book) 탭이 무한 로딩(FINDING F-20-1)으로 진입 불가.** 체크리스트 자체가 렌더되지 않아 검증 불가.

### 4. 수동 항목 추가/삭제 (D-10)
expected:
  1. book 탭 '항목 추가' → sheet에서 자유 텍스트(예: 항공권) 입력·추가 → 목록에 '직접 추가' 행 생성
  2. 빈 문자열/81자 이상은 추가 불가
  3. 수동 행은 확장 후 '항목 삭제'로 제거 가능 (완료 상태여도 삭제 가능 — manual은 예외)
  4. 플랜 다시 만들기 후에도 수동 행은 그대로 유지 (reconcile 무접촉)
result: [blocked] — **예약(book) 탭 무한 로딩(F-20-1)으로 진입 불가.**

### 5. 설정(me) 제휴 안내 화면 (D-16)
expected: 설정 화면에 '제휴 안내' 섹션 — "MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요." 중립 톤, 브랜드 색·외부 링크 없음
result: [pass] — 2026-07-05 sim 검증. 내 정보(me) 화면 하단에 "제휴 안내" 카드. 본문 "MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요." 문구 정확 일치. 흰 카드 + 중립 회색 텍스트, 브랜드 색·외부 링크 chevron 없음(위 메뉴 행들과 달리 순수 안내 카드) — 중립 톤 계약 충족.

### 6. presence 2-브라우저 수렴 (GAP-19D)
expected: supabase-js 2.110.0 업그레이드 후 →
  1. `/poll/[code]`를 브라우저 2개로 열면 양쪽 모두 "지금 2명 보는 중"으로 수렴 (기존 GAP-19D: 한쪽만 집계되던 presence_state 프로토콜 버그 해소 확인)
  2. iOS realtime 스모크 (플랜 협업 반영) 정상
  3. 매직링크 로그인 회귀 0
result: [not-run] — 2브라우저 realtime presence 수렴은 sim 자동화 범위 밖(19 Test 2와 동일 사유). 사람 또는 브라우저 자동화 세션 필요.

## Summary

total: 6
passed: 1 (Test 5)
issues: 1 (F-20-1 버그, blocker)
pending: 3 (Test 1/2/6 미실행)
skipped: 0
blocked: 2 (Test 3/4 — F-20-1로 진입 불가)

## Findings

- **F-20-1** (버그, BLOCKER, `apps/ios/app/trip/[id]/(tabs)/book.tsx`): **예약(book) 탭이 로딩 스피너("진행 중")에 무한 정지.** 플랜 초안 없는 trip에서 D-04 빈 상태("먼저 플랜을 만들어주세요")가 떠야 하는데 스피너가 20초+ 사라지지 않음. 오사카·도쿄 2개 trip(둘 다 플랜 없음)에서 재현. book.tsx `load()`는 `Promise.all([getTrip, listPlacesByTrip, getPlanByTrip, listChecklist, listClickedChecklistItemIds, auth.getUser])` + `reconcileTripChecklist` 후 `finally { setLoaded(true) }` 구조 — 에러가 나도 finally가 스피너를 걷어야 정상. 무한 스피너 = **6개 쿼리(또는 reconcile 쓰기) 중 하나가 영영 settle되지 않음.** listClickedChecklistItemIds는 `.catch`로 항상 settle. 유력 원인 = `listChecklist`(booking_checklist_items 조회) 또는 `reconcileTripChecklist`의 booking_checklist_items 쓰기(둘 다 phase 20 / migration 0021)가 원격 DB에서 반환 안 됨. **원격 DB의 booking_checklist_items 테이블/RLS(0021) 상태 점검 필요**(0021이 원격에 완전 적용됐는지, RLS가 재귀/타임아웃 없이 동작하는지). 지도·플랜·가계부(스텁) 탭은 같은 원격에서 정상 로드 → 예약 탭 고유 문제. 이 버그가 Test 3·4를 블록.

## Gaps

- Test 1(플랜 인라인 예약 카드 → Safari): 플랜 초안 있는 trip 선행 셋업(링크 추출→장소→플랜) 필요. 실기기 쿠키 보존은 sim 불가.
- Test 2(TP 대시보드): 외부 로그인 — 사람 검증 필수.
- Test 6(presence 2브라우저): 2브라우저 realtime — 사람/브라우저 자동화 필요.
- Test 3·4: F-20-1 해소 후 재검증.
