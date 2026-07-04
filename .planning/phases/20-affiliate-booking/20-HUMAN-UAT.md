---
status: pending
phase: 20-affiliate-booking
source: [20-VERIFICATION.md, 20-VALIDATION.md]
started: 2026-07-04T20:55:27Z
updated: 2026-07-04T20:55:27Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 실기기 [보기] → 시스템 Safari 착지 (A1/A2, ATTR-02/BOOK-03)
expected: `pnpm sim` 또는 실기기에서 날짜 확정 + 플랜 초안 있는 일본 도시 trip 열기 →
  1. plan 탭 '여행 준비' 클러스터의 숙소 [보기](Agoda/Booking) → 시스템 Safari로 열림 (인앱 브라우저 아님)
  2. 액티비티 항목 아래 '예약 비교' strip의 Klook [보기] → Safari 착지 페이지가 해당 장소명 검색결과
  3. KKday [보기](env 배선 시) / 유심 Airalo / 교통 패스 행도 각각 정상 착지
  4. URL이 tracking 도메인(c137.travelpayouts.com 또는 tp.media) 경유 후 목적지 도달 — 한글 장소명 인코딩 파손 없음
result: [pending]

### 2. Travelpayouts 대시보드 SubID 집계 (A4/A3, ATTR-02)
expected: 위 실클릭 1건 이상 발생 후 →
  1. TP 대시보드 통계에 클릭이 집계됨 (marker 745749)
  2. SubID가 marker-dot 형식(745749.c_XXXXXXXXXXXXXXXX)으로 붙어 booking_clicks의 click_token과 대조 가능
result: [pending]

### 3. 복귀 '확인함' 전이 + D-13 보존 배지 (BOOK-02, D-11/D-13/D-15)
expected:
  1. book 탭에서 항목 [보기] → Safari → 앱 복귀 시 팝업/에러 화면 없이 해당 행이 조용히 '확인함' 배지 + '예약했으면 체크해주세요' 인라인 힌트로 갱신
  2. plan 탭에서 클릭해도 book 탭 동일 항목이 '확인함' (데이터는 하나, D-03)
  3. 액티비티 항목을 체크(완료) 후 플랜 다시 만들기로 해당 장소가 빠져도 그 행이 '플랜에 없음' 배지와 함께 보존됨
  4. auto+완료 행은 확장해도 '항목 삭제' 버튼이 숨겨짐 (돈 쓴 기록 보존)
result: [pending]

### 4. 수동 항목 추가/삭제 (D-10)
expected:
  1. book 탭 '항목 추가' → sheet에서 자유 텍스트(예: 항공권) 입력·추가 → 목록에 '직접 추가' 행 생성
  2. 빈 문자열/81자 이상은 추가 불가
  3. 수동 행은 확장 후 '항목 삭제'로 제거 가능 (완료 상태여도 삭제 가능 — manual은 예외)
  4. 플랜 다시 만들기 후에도 수동 행은 그대로 유지 (reconcile 무접촉)
result: [pending]

### 5. 설정(me) 제휴 안내 화면 (D-16)
expected: 설정 화면에 '제휴 안내' 섹션 — "MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요." 중립 톤, 브랜드 색·외부 링크 없음
result: [pending]

### 6. presence 2-브라우저 수렴 (GAP-19D)
expected: supabase-js 2.110.0 업그레이드 후 →
  1. `/poll/[code]`를 브라우저 2개로 열면 양쪽 모두 "지금 2명 보는 중"으로 수렴 (기존 GAP-19D: 한쪽만 집계되던 presence_state 프로토콜 버그 해소 확인)
  2. iOS realtime 스모크 (플랜 협업 반영) 정상
  3. 매직링크 로그인 회귀 0
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0
