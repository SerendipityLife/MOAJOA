---
phase: 20-affiliate-booking
verified: 2026-07-04T20:55:27Z
status: human_needed
score: 29/31 must-haves verified
behavior_unverified: 2 # 코드 존재+배선 완료, 실기기/외부서비스 의존이라 테스트로 exercise 불가 — behavior_unverified_items 참조
overrides_applied: 0
behavior_unverified_items:
  - truth: "예약 링크를 누르면 시스템 브라우저로 열려 제휴 쿠키가 보존되고, 클릭이 SubID로 기록된다 (ROADMAP SC4 / ATTR-02)"
    test: "실기기에서 [보기] 탭 → Safari 착지 → Travelpayouts 대시보드 SubID 집계 확인"
    expected: "시스템 Safari로 열리고(인앱 브라우저 아님), 착지 페이지가 검색결과이며, TP 통계에 marker.{token} SubID가 집계된다"
    why_human: "쿠키 보존·실착지·대시보드 집계는 외부 서비스+실기기 런타임 — Klook/KKday 봇차단(403)으로 자동 렌더 확인 불가 (VALIDATION A1/A2/A4). 코드 측(openURL 시스템 브라우저 호출·URL 조립·오픈-선행 순서·클릭 INSERT)은 테스트 24개로 exercise됨"
  - truth: "앱 복귀 시 팝업 없이 조용한 refetch — 클릭했던 행이 '확인함'으로 바뀌고 인라인 힌트만 표시 (20-07 D-15)"
    test: "실기기에서 [보기] → Safari → 앱 복귀"
    expected: "에러 화면/팝업 없이 해당 행이 '확인함' 배지 + '예약했으면 체크해주세요' 힌트로 조용히 갱신"
    why_human: "AppState 'active' → load({quiet}) 전이를 exercise하는 테스트가 없음 (badge/힌트 렌더는 book.test:151·checklist-row.test:65로 검증됨, 리스너 코드는 book.tsx:170-176 존재+배선). 실 DB round-trip + AppState 전이는 디바이스 필요"
human_verification:
  - test: "실기기 [보기] → 시스템 Safari 착지 (A1/A2)"
    expected: "숙소/액티비티/유심/교통 카드의 [보기]가 시스템 Safari로 열리고 착지 페이지가 해당 검색결과(장소명 포함)"
    why_human: "Klook/KKday 봇차단으로 자동 렌더 확인 불가, 쿠키 보존은 실브라우저 필요"
  - test: "Travelpayouts 대시보드 SubID 집계 (A4/A3)"
    expected: "실클릭 후 TP 통계에 marker-dot SubID(745749.c_...)가 집계됨"
    why_human: "외부 서비스 대시보드 — 첫 실클릭 후에만 확인 가능"
  - test: "복귀 '확인함' 전이 + D-13 보존 배지"
    expected: "[보기]→복귀 시 행이 조용히 '확인함' + 힌트; 플랜 재생성 후 체크된 항목 보존 + '플랜에 없음' 배지"
    why_human: "AppState 전이 + 실 DB round-trip 필요"
  - test: "수동 항목 추가/삭제"
    expected: "항목 추가 sheet에서 자유 텍스트(1~80자) 추가, 확장 후 항목 삭제 (auto+done 행은 삭제 숨김)"
    why_human: "sheet 인터랙션 실기기 확인"
  - test: "설정(me) 제휴 안내 화면"
    expected: "'제휴 안내' 섹션이 중립 톤으로 표시 — 브랜드·링크 없음"
    why_human: "시각 품질 확인"
  - test: "presence 2-브라우저 수렴 (GAP-19D)"
    expected: "/poll/[code] 2개 브라우저에서 양쪽 모두 '지금 2명 보는 중' 수렴 + iOS realtime 스모크 + 매직링크 회귀 0"
    why_human: "원격 realtime + 2 클라이언트 동시 접속 필요"
---

# Phase 20: Affiliate Booking (딥링크 제휴 예약) Verification Report

**Phase Goal:** 플랜의 숙소·액티비티·교통·유심 슬롯에 맥락형 인라인 예약 카드가 뜨고, 대표가 통합 예약 체크리스트에서 한 번에 진행한다. 모든 클릭이 SubID로 어트리뷰션되고 시스템 브라우저로 열려 제휴 쿠키가 보존된다.
**Verified:** 2026-07-04T20:55:27Z
**Status:** human_needed (코드 must-have 29/31 검증, 실기기/외부서비스 항목 6건 → 20-HUMAN-UAT.md)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | 플랜의 숙소/액티비티/교통/유심 슬롯에 맥락형 인라인 예약 카드(딥링크) 표시 | ✓ VERIFIED | plan.tsx:1064-1130 여행 준비 클러스터(숙소 full 카드 + esim/transport 행) + :978-1020 renderBookingStrip. plan.test.tsx:351(클러스터 렌더)/:362(seoul 미커버 행 부재)/:373(플랜 없음 게이트)/:396(맛집 strip 금지) 전부 green |
| SC2 | 통합 예약 체크리스트에서 진행 + 완료/미완료 상태 확인 | ✓ VERIFIED | book.tsx 상태머신(loading/error/빈2종/활성) + ChecklistRow 3단 상태 + 수동 추가/삭제. book.test.tsx 5 + checklist-row.test.tsx 6 green. reconcile-on-load가 core deriveChecklistAutos에 위임 (book.tsx:90-101) |
| SC3 | 숙소·액티비티 비교 링크 1~2곳 제시 (실시간 가격비교 위젯 범위 외) | ✓ VERIFIED | CompareFrameCard: 숙소 Agoda+Booking 2행, 액티비티 Klook(+KKday env 시) 2행, 가격 자리 spacer(:132-133). compare-frame-card.test.tsx 6 green. 가격 위젯 없음 확인 |
| SC4 | 예약 링크 → 시스템 브라우저 + 제휴 쿠키 보존 + SubID 기록 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 코드 완전 배선: expo-linking Linking.openURL(시스템 Safari, 인앱 브라우저 import 0), marker.{token}+sub_id 이중 주입(booking.ts:81-83), booking_clicks INSERT(logBookingClick). 오픈-선행 순서 invocationCallOrder 테스트(booking-open.test.ts:102) green. 그러나 실기기 쿠키 보존·착지·TP 집계는 테스트 불가 → Human UAT |

**Score:** 29/31 truths verified (2 present, behavior-unverified — 실기기/외부서비스 의존)

### Observable Truths — Plan must_haves (27)

| # | Truth (요약) | Status | Evidence |
| --- | ----------- | ------ | -------- |
| 01-1 | supabase-js 모노레포 전체 2.110.0 단일 해석 | ✓ VERIFIED | root package.json:34 override "2.110.0", pnpm-lock에 2.110.0 단일 해석, 각 패키지 ^2.110.0 |
| 01-2 | 전체 테스트 베이스라인 업그레이드 후 green | ✓ VERIFIED | 이번 검증에서 직접 재실행: core 125 / api 59 / web 65 / ios 123 (17 suites) 전부 green — SUMMARY 주장과 정확히 일치 |
| 01-3 | @supabase/ssr 0.12.0 peer 정합 | ✓ VERIFIED | lockfile: `@supabase/ssr@0.12.0(@supabase/supabase-js@2.110.0)` |
| 02-1 | 라이브 DB booking_checklist_items + RLS 헬퍼 게이트 (D-12) | ✓ VERIFIED | 0021_booking.sql:45-57 정책 4개 can_read/can_edit_trip 직호출 (cross-table EXISTS 0). 라이브 적용: 20-02-SUMMARY 기록(post-apply policies=4, rls_enabled=true, versions 0016~0021) — 오케스트레이터 제공 근거, 라이브 재실행 생략 |
| 02-2 | booking_clicks member INSERT(user_id=auth.uid() AND can_read_trip) + SELECT (D-11) | ✓ VERIFIED | 0021:70-78 두 정책 존재. RLS 매트릭스 A~F 6/6 PASS (BEGIN…ROLLBACK, 20-02-SUMMARY 기록) |
| 02-3 | database.ts에 booking 타입 존재 | ✓ VERIFIED | database.ts:12 booking_checklist_items, :65-66 checklist_item_id/click_token, :96-99 FK 관계 |
| 03-1 | buildAffiliateUrl 라이브 실측 규격 (Klook click형 c137/4110, Airalo media형 8310/541) | ✓ VERIFIED | booking.ts:26-30 TP_PROGRAMS + :76-96 분기. booking.test.ts 34 green |
| 03-2 | 한글 장소명 정확히 1회 인코딩 (Pitfall 7) | ✓ VERIFIED | buildSearchDestUrl 내부 1회 + buildAffiliateUrl dest 레이어 1회 (per-layer nesting). 테스트가 DEST 레이어 이중인코딩 단정 |
| 03-3 | 기존 booking.test 15 케이스 무파손 (17-02 계약) | ✓ VERIFIED | booking.test.ts 34/34 green (17-02 generic passthrough 분기 보존, booking.ts:117-120) |
| 03-4 | deriveChecklistAutos D-10 파생 + D-13 보존 순수함수 | ✓ VERIFIED | checklist.ts:59-105 (clicked/done skip :93, manual 미방출 :71). checklist.test.ts:142 "clicked/done rows NEVER deleted" green |
| 03-5 | isBookableActivity: 관광명소·테마파크 true / 맛집·카페 false (D-08) | ✓ VERIFIED | category.ts:52-57 + category.test.ts 27 green |
| 04-1 | 체크리스트 CRUD + 클릭 로깅 래퍼 house 계약 | ✓ VERIFIED | bookings.ts 7개 함수 client-first + {error} throw. queries/index.ts:8 barrel export. bookings.test.ts 17 green |
| 04-2 | logBookingClick: INSERT 후 todo→clicked 전이 (D-11) | ✓ VERIFIED | bookings.ts:155-176, `.eq('status','todo')` 가드. bookings.test.ts:174-199 전이+가드 단정 green |
| 04-3 | reconcileChecklist는 core 파생 결과만 미러 (재구현 0) | ✓ VERIFIED | bookings.ts:120-144 — 조건부 파생 로직 0, diff 입력만 반영 |
| 05-1 | [보기] → Linking.openURL 즉시 호출, 로깅이 오픈을 막지 않음 (D-14) | ✓ VERIFIED | lib/booking.ts:106 openURL 후 :107 log .catch(()=>{}) — 사이 await 0. booking-open.test.ts:102 "openURL strictly BEFORE logBookingClick" + :111 "log pending forever에도 resolve" green |
| 05-2 | 클릭 토큰 expo-crypto CSPRNG + ClickTokenSchema 16자 base62 | ✓ VERIFIED | lib/booking.ts:42-47 Crypto.getRandomValues 16바이트→16자. booking-open.test.ts:80/:86 green |
| 05-3 | CompareFrameCard 비교 구도 (2행 + 정적 라벨 + 가격 spacer, D-06) | ✓ VERIFIED | compare-frame-card.tsx:123-136 rows map + :133 price slot spacer. 테스트 6 green |
| 05-4 | marker/trs env→extra만 (하드코딩 0) | ✓ VERIFIED | app.config.ts:95-99 5키 process.env만. 앱 소스에 745749/545555/9074/633 grep 0건 (테스트 제외) |
| 06-1 | 여행 준비 클러스터: 숙소 큰 카드 1 + 유심/교통 행 ≤2, TravelModeToggle과 Day 사이 (D-01/02/04) | ✓ VERIFIED | plan.tsx:1056-1130 (Toggle → 클러스터 → Day sections 순). plan.test.tsx:351 green |
| 06-2 | 플랜 없음·날짜 미정 trip → 클러스터·strip 렌더 0 (19-03 관리카드 상호배타) | ✓ VERIFIED | plan.tsx:957 `showBookingCluster = !!plan && !!trip?.start_date` + strip도 동일 게이트(:979). plan.test.tsx:373/:382(상호배타) green |
| 06-3 | 예약 비교 strip은 예약성 항목만, 맛집·카페 절대 없음 (D-08) | ✓ VERIFIED | plan.tsx:981 isBookableActivity 게이트. plan.test.tsx:396 green |
| 06-4 | 미커버 도시(kr) → 유심/교통 행 부재 (disabled 아님, D-09) | ✓ VERIFIED | plan.tsx:1097/:1114 `esimSlug !== null &&` / `transport !== null &&` — 조건부 미렌더. plan.test.tsx:362 green. booking-map.ts kr 3도시 null |
| 07-1 | book 탭 = 체크리스트 홈 (자동 파생 + 수동 추가 + 3단 상태) | ✓ VERIFIED | book.tsx 전체 상태머신 + ManualItemTitleSchema 게이트(:236) + setItemStatus/deleteChecklistItem 배선. book.test.tsx:142/:161 green |
| 07-2 | 플랜에서 빠진 체크 항목 '플랜에 없음' 배지 보존 (D-13) | ✓ VERIFIED | isDesynced(core, 렌더타임 계산) + book.tsx:488 + checklist-row.tsx:113-117. checklist-row.test.tsx:81/:110(삭제숨김) green |
| 07-3 | 앱 복귀 시 조용한 refetch — '확인함' 전이 + 인라인 힌트 (D-15) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | AppState 리스너 존재+배선(book.tsx:170-176, quiet 실패 시 에러화면 미전환 :151-153). 배지/힌트 렌더는 테스트 green — 그러나 AppState 'active'→quiet load 전이 자체를 exercise하는 테스트 없음 → Human UAT |
| 07-4 | 날짜 미정/플랜 없음 각각의 빈 상태 카피 (D-04) | ✓ VERIFIED | book.tsx:285(dateless) + :334 전 no-plan 분기. book.test.tsx:126/:134 green |
| 07-5 | 설정(me) 제휴 고지 섹션 (D-16) | ✓ VERIFIED | me.tsx:251-256 '제휴 안내' 정적 섹션 ("수수료를 받을 수 있어요… 결제 금액은 달라지지 않아요") |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0021_booking.sql` | checklist 테이블 + clicks 컬럼/정책 | ✓ VERIFIED | 82줄, CHECK 값이 core enum과 문자 단위 일치, 부분 유니크 2 + 트리거 + 정책 6 |
| `packages/api/src/types/database.ts` | booking 타입 재생성 | ✓ VERIFIED | Row/Insert/Update + FK 3종 존재 |
| `packages/core/src/booking.ts` | 실규격 TP 분기 + dest 빌더 3종 | ✓ VERIFIED | 177줄, 테스트 34 green |
| `packages/core/src/booking-map.ts` | BOOKING_REGION_MAP 9키 + COMPARE_LABELS | ✓ VERIFIED | CITY_KO_MAP 9 city_code 정합, 테스트 8 green |
| `packages/core/src/checklist.ts` | Schema + deriveChecklistAutos + isDesynced | ✓ VERIFIED | 115줄, 테스트 16 green |
| `packages/core/src/category.ts` | isBookableActivity | ✓ VERIFIED | surgical append, 테스트 27 green |
| `packages/api/src/queries/bookings.ts` | CRUD 7함수 + makeChain 테스트 | ✓ VERIFIED | 196줄 + 테스트 17 green, barrel export |
| `apps/ios/lib/booking.ts` | mintClickToken/openBooking/openDirectSearch/kkdayAvailable | ✓ VERIFIED | 140줄, 테스트 12 green |
| `apps/ios/components/booking/compare-frame-card.tsx` | full/compact/embedded 변형 | ✓ VERIFIED | 146줄, URL-blind, 테스트 6 green |
| `apps/ios/components/booking/checklist-row.tsx` | 3단 상태 + 배지 2종 + 삭제 규칙 | ✓ VERIFIED | 151줄, 테스트 6 green |
| `apps/ios/app.config.ts` | extra 5키 (tpMarker/tpTrs/tpKkday*) | ✓ VERIFIED | :95-99 env 참조만 |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` | 여행 준비 클러스터 + strip | ✓ VERIFIED | 게이트/조립/체크리스트 id 연결 전부 배선 |
| `apps/ios/app/trip/[id]/(tabs)/book.tsx` | 체크리스트 홈 (17-04 스텁 대체) | ✓ VERIFIED | 스텁 흔적 0, 전체 상태머신 구현 |
| `apps/ios/components/plan/day-section.tsx` | renderBookingStrip optional prop | ✓ VERIFIED | :51/:125/:144 — booking-blind 슬롯, 드래그 로직 무접촉 |
| `apps/ios/app/me.tsx` | 제휴 안내 섹션 | ✓ VERIFIED | :251-256 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| lib/booking.ts openBooking | @moajoa/core buildAffiliateUrl | 유일 조립 지점 | ✓ WIRED | :104, 컴포넌트는 URL 미인지 (테스트 :125 "opens EXACTLY the buildAffiliateUrl output") |
| openBooking | Linking.openURL → logBookingClick.catch | 오픈-선행 (D-14) | ✓ WIRED | :106-114, ordering 테스트 green |
| bookings.ts | core deriveChecklistAutos | 파생 위임 (단일 정의) | ✓ WIRED | api에 파생 로직 0 |
| bookings.ts | database.ts booking 타입 | 20-02 재생성분 | ✓ WIRED | typed client 경유 |
| plan.tsx [보기] | openBooking + checklistItemId | plan 탭 클릭도 '확인함' 전이 (D-03) | ✓ WIRED | :994/:1009/:1103 autoItemId/activity itemId 동반 |
| book.tsx load | listChecklist + deriveChecklistAutos + reconcileChecklist | plan 탭과 동일 데이터 | ✓ WIRED | book.tsx:76-101 (plan.tsx:149-165와 동일 seam) |
| ChecklistRow 확장 | CompareFrameCard embedded | [보기] → openBooking 경유 | ✓ WIRED | book.tsx:370-468 kind별 embedded frame |
| 0021 정책 | 0016 can_read/can_edit_trip DEFINER 헬퍼 | 42P17 가드 | ✓ WIRED | 직접 EXISTS 0건 |
| ChecklistItemSchema enum | 0021 CHECK 제약 | kind/status/source 문자 일치 | ✓ WIRED | 육안 대조 완전 일치 |
| strip 게이트 | isBookableActivity | D-08 | ✓ WIRED | plan.tsx:981 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| book.tsx | checklist/clickedIds | listChecklist/listClickedChecklistItemIds → 실 supabase 쿼리 | Yes (booking_checklist_items/booking_clicks SELECT) | ✓ FLOWING |
| plan.tsx 클러스터 | checklist | listChecklist + reconcile-on-load | Yes | ✓ FLOWING |
| CompareFrameCard | rows | 부모가 COMPARE_LABELS(core) + onView 핸들러 주입 | Yes (하드코딩 빈 props 0) | ✓ FLOWING |
| lib/booking.ts | marker/trs/kkday | Constants.expoConfig.extra ← env | Yes (미배선 시 graceful skip + warn) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| D-14 오픈-선행 순서 (openURL이 log보다 먼저, log 실패/지연 무영향) | `npx jest __tests__/booking-open.test.ts` | 12/12 PASS (invocationCallOrder 단정 포함) | ✓ PASS |
| D-11 todo→clicked 전이 + `.eq('status','todo')` 가드 | `npx vitest run src/queries/bookings.test.ts` | 17/17 PASS | ✓ PASS |
| D-13 clicked/done 불가침 + D-10 manual 미방출 | `npx vitest run src/checklist.test.ts` | 16/16 PASS | ✓ PASS |
| D-04/D-09/D-08 게이팅 (클러스터/행 부재/맛집 strip 금지) | `npx jest __tests__/plan.test.tsx __tests__/book.test.tsx` | 19/19 PASS | ✓ PASS |
| 전체 워크스페이스 회귀 (20-01 업그레이드 후, 1회 실행) | core+api+web vitest, ios jest 각 full 1회 | core 125 / api 59 / web 65 / ios 123 전부 PASS | ✓ PASS |

### Probe Execution

해당 없음 — 이 phase는 probe 스크립트를 선언하지 않음 (scripts/*/tests/probe-*.sh 0건).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| BOOK-01 | 20-03, 20-06 | 플랜 슬롯 맥락형 인라인 예약 카드 | ✓ SATISFIED | SC1 evidence |
| BOOK-02 | 20-02, 20-04, 20-07 | 통합 예약 체크리스트 + 완료/미완료 | ✓ SATISFIED | SC2 evidence |
| BOOK-03 | 20-03, 20-05, 20-06, 20-07 | 비교 링크 1~2곳 | ✓ SATISFIED | SC3 evidence |
| ATTR-02 | 20-02, 20-04, 20-05 | 시스템 브라우저 + 쿠키 보존 + SubID | ? NEEDS HUMAN | 코드 측 완전 배선·테스트 green — 실기기 쿠키/TP 대시보드 집계만 잔여 (UAT 1·2) |
| GAP-19D | 20-01 | supabase-js presence 프로토콜 fix | ? NEEDS HUMAN | 2.110.0 업그레이드 + 전체 회귀 green — 2-브라우저 수렴 확인만 잔여 (UAT 6) |

고아 요구사항 없음 — REQUIREMENTS.md가 Phase 20에 매핑한 4개(BOOK-01..03, ATTR-02) 전부 플랜이 클레임.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| packages/core/src/booking.ts | 124 | `stay22.com/allez/PLACEHOLDER` | ℹ️ Info | Phase 20 산물 아님 — 17-02 커밋(35520a8)의 잠긴 stay22 분기, 20-03 key_link가 "stay22 분기 무수정"을 명시적으로 요구. stay22 env 주입은 후속 phase 몫 |

TBD/FIXME/XXX/TODO/HACK: phase 수정 파일 전체에서 0건. 스텁 패턴(빈 반환·하드코딩 빈 props·console.log 전용 구현) 0건.

### Human Verification Required

6건 — `.planning/phases/20-affiliate-booking/20-HUMAN-UAT.md`에 영속화 (phase 19 형식 동일).

1. **실기기 [보기] → Safari 착지 (A1/A2)** — 시스템 브라우저·검색결과 착지·쿠키 보존
2. **TP 대시보드 SubID 집계 (A4)** — marker-dot SubID 실집계
3. **복귀 '확인함' 전이 + D-13 보존 배지** — AppState quiet refetch + 플랜 재생성 보존
4. **수동 추가/삭제** — sheet 인터랙션
5. **제휴 안내 화면** — me 설정 시각 확인
6. **presence 2-브라우저 수렴 (GAP-19D)** — realtime 2클라이언트

### Gaps Summary

코드 gap 없음. 31개 must-have 중 29개 VERIFIED, 2개는 존재+배선 완료이나 런타임 행동이 실기기/외부서비스(Safari 쿠키, TP 대시보드, AppState 전이)에 의존해 테스트로 exercise 불가 — 전부 Human UAT로 라우팅. 라이브 DB 적용(0021)은 오케스트레이터 제공 근거(versions 0016~0021 기록 + RLS 매트릭스 A~F 6/6 PASS)로 교차 확인했고, 마이그레이션 SQL·database.ts·core enum의 3자 정합은 독립적으로 검증함.

---

_Verified: 2026-07-04T20:55:27Z_
_Verifier: Claude (gsd-verifier)_
