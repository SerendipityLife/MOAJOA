---
status: complete
phase: 20-affiliate-booking
source: [20-VERIFICATION.md, 20-VALIDATION.md]
started: 2026-07-04T20:55:27Z
updated: 2026-07-05T06:25:00Z
updated_by: sim-automation (idb + simctl, iPhone 17 Pro) + web 2-browser (Playwright, localhost:3001) · 원격 Supabase
---

## Current Test

[전 항목 완료. Test 1/3/4 PASS(sim, 플랜 초안 셋업 후) · Test 5 PASS · Test 6 PASS(웹 2브라우저 Playwright, presence 2.110.0 수렴). Test 2만 skip(외부 로그인 — 사용자 직접 확인).]

## Tests

### 1. 실기기 [보기] → 시스템 Safari 착지 (A1/A2, ATTR-02/BOOK-03)
expected: `pnpm sim` 또는 실기기에서 날짜 확정 + 플랜 초안 있는 일본 도시 trip 열기 →
  1. plan 탭 '여행 준비' 클러스터의 숙소 [보기](Agoda/Booking) → 시스템 Safari로 열림 (인앱 브라우저 아님)
  2. 액티비티 항목 아래 '예약 비교' strip의 Klook [보기] → Safari 착지 페이지가 해당 장소명 검색결과
  3. KKday [보기](env 배선 시) / 유심 Airalo / 교통 패스 행도 각각 정상 착지
  4. URL이 tracking 도메인(c137.travelpayouts.com 또는 tp.media) 경유 후 목적지 도달 — 한글 장소명 인코딩 파손 없음
result: [pass-with-findings] — 2026-07-05 sim 검증. **셋업**: 오사카 trip(7/18–20)에 유튜브 링크(도톤보리 가이드 `j-EilTC4cbQ`) 추출 → 장소 5개(도톤보리 운하/글리코 러닝맨 사인/호젠지 요코초/도톤보리 다리/쇼치쿠자 극장) → generate-plan으로 초안(Day1–3 + "여행 준비" 예약 클러스터) 생성. 전 [보기] 버튼이 **시스템 Safari로 열림**(`Linking.openURL`, 인앱 아님 — 상단 "◀ MOAJOA" + Safari 툴바 확인):
  - 항목 1 PASS: 숙소 [보기] **Agoda·Booking.com** 둘 다 시스템 Safari 착지. **Booking.com은 도시·날짜 완벽 프리필**(오사카 · 체크인 2026-07-18 토 · 체크아웃 2026-07-20 월 · 성인2/객실1 → 오사카 호텔 629개). ⚠️ **FINDING F-20-2(경미)**: Agoda 딥링크(`agoda.com/ko-kr/search?textToSearch=오사카&checkIn/Out=…`)는 홈으로 리다이렉트되며 날짜가 오늘(7/5)로 리셋 — MOAJOA는 도시·날짜를 정확히 전달(Booking 프리필로 입증), Agoda 측 by-name textToSearch 딥링크 수용 문제(city ID 필요 가능성). 개선 시 core `buildDirectSearchUrl(agoda)`에서 수정.
  - 항목 2 PASS: 액티비티(쇼치쿠자 극장) 아래 '예약 비교' strip **Klook [보기]** → 시스템 Safari `klook.com/ko/search` 착지, "쇼치쿠자 극장" 검색결과 15개.
  - 항목 3 PASS: **KKday [보기]** → `kkday.com` 검색결과("쇼치쿠 가부키자 극장" 매칭, 검색창에 "쇼치쿠자 극장" 원문 그대로) · **Airalo [보기]** → `airalo.com` **Japan eSIM 페이지**(브레드크럼 eSIM Store › Local eSIMs › Japan) 정확 착지 · 간사이 패스 Klook 행도 렌더.
  - 항목 4 PASS: tracking 도메인 경유 확인 — Klook은 **c137.travelpayouts.com/click**, KKday·Airalo는 **tp.media/r**(marker 745749 배선). **한글 장소명 인코딩 파손 없음**(KKday 검색창에 "쇼치쿠자 극장" 원문 유지, 결과 정상). EXPO_PUBLIC_TP_MARKER/TRS/KKDAY env 전부 sim에 배선됨.
  - CAVEAT: ATTR-02의 "실기기 크로스세션 쿠키 보존"은 원리상 시뮬레이터로 검증 불가(실기기 필요) — 기존 gap 유지.

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
result: [pass] — 2026-07-05 sim 검증(Test 1 셋업 trip 재사용). 4개 항목 전부 통과:
  - 항목 1 PASS: book 탭 '글리코 러닝맨 사인' 펼침 → Klook [보기] → 시스템 Safari(klook.com) → 앱 복귀 시 **팝업/에러 없이 조용히** 해당 행이 [확인함] 배지 + "예약했으면 체크해주세요" 인라인 힌트로 갱신.
  - 항목 2 PASS(D-03): plan 탭 여행준비/예약비교에서 클릭한 항목(숙소=Agoda·Booking, 여행 유심=Airalo, 쇼치쿠자 극장=Klook·KKday)이 book 탭 동일 항목에 [확인함]으로 반영 — 데이터는 하나.
  - 항목 3 PASS(D-13): 액티비티 '글리코'를 완료 체크 → plan 탭에서 '미배치로 보내기'(플랜에서 제거) → 앱 재로드 후 book 탭에 글리코 행이 **보존**(초록 체크·완료) + **[플랜에 없음] 배지**(하단 정렬). reconcile `deriveChecklistAutos`는 status≠'todo'(클릭/완료) 항목을 삭제하지 않음(코드 확인 checklist.ts:93), 배지는 렌더타임 `isDesynced`.
  - 항목 4 PASS: auto+완료(글리코) 행을 확장하면 Klook/KKday [보기]는 남고 **'항목 삭제' 버튼은 숨겨짐**(돈 쓴 기록 보존). 대조: auto+미완료일 땐 삭제 버튼 노출됨.

### 4. 수동 항목 추가/삭제 (D-10)
expected:
  1. book 탭 '항목 추가' → sheet에서 자유 텍스트(예: 항공권) 입력·추가 → 목록에 '직접 추가' 행 생성
  2. 빈 문자열/81자 이상은 추가 불가
  3. 수동 행은 확장 후 '항목 삭제'로 제거 가능 (완료 상태여도 삭제 가능 — manual은 예외)
  4. 플랜 다시 만들기 후에도 수동 행은 그대로 유지 (reconcile 무접촉)
result: [pass] — 2026-07-05 sim 검증(Test 1 셋업 trip 재사용). 4개 항목 전부 통과:
  - 항목 1 PASS: book 탭 '항목 추가' → "예약 항목 추가" 시트 → 자유 텍스트 "항공권" 입력 → 추가하기 → 목록에 '**직접 추가**'(연필 아이콘) 행 생성.
  - 항목 2 PASS: 빈 문자열 → '추가하기' **비활성**(회색, canSubmit=trim().length>0). 81자 이상 → TextInput `maxLength={80}` 하드캡 + 제출 시 `ManualItemTitleSchema=z.string().min(1).max(80)` — 85자 붙여넣기가 80자로 잘려 저장(리스트에 "AAAA…" ellipsis로 표시).
  - 항목 3 PASS: 수동 행 확장 → '항목 삭제'는 **완료 상태여도 노출**(manual 예외 vs auto+완료 숨김). 삭제 → 확인 다이얼로그("이 항목을 삭제할까요?" 취소/삭제) → 삭제 시 목록에서 제거(8→7개).
  - 항목 4 PASS: '플랜 다시 만들기'(generate-plan 재실행 + 앱 재로드) 후에도 수동 행('항공권')이 **그대로 유지**(reconcile는 source='auto'만 처리, custom 무접촉 — checklist.ts:101).

### 5. 설정(me) 제휴 안내 화면 (D-16)
expected: 설정 화면에 '제휴 안내' 섹션 — "MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요." 중립 톤, 브랜드 색·외부 링크 없음
result: [pass] — 2026-07-05 sim 검증. 내 정보(me) 화면 하단에 "제휴 안내" 카드. 본문 "MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요." 문구 정확 일치. 흰 카드 + 중립 회색 텍스트, 브랜드 색·외부 링크 chevron 없음(위 메뉴 행들과 달리 순수 안내 카드) — 중립 톤 계약 충족.

### 6. presence 2-브라우저 수렴 (GAP-19D)
expected: supabase-js 2.110.0 업그레이드 후 →
  1. `/poll/[code]`를 브라우저 2개로 열면 양쪽 모두 "지금 2명 보는 중"으로 수렴 (기존 GAP-19D: 한쪽만 집계되던 presence_state 프로토콜 버그 해소 확인)
  2. iOS realtime 스모크 (플랜 협업 반영) 정상
  3. 매직링크 로그인 회귀 0
result: [pass-with-findings] — 2026-07-05 웹 2브라우저 검증(Playwright 2 context, Chrome for Testing headless, localhost:3001 fresh `next dev` → 원격 Supabase realtime).
  - 항목 1 PASS: `/poll/lv7bbwzfbqoc`를 별도 컨텍스트(각자 device_token) 2개로 열면 양쪽 모두 **"지금 2명 보는 중"**으로 수렴(t+2.5s). GAP-19D(한쪽만 집계되던 presence_state 프로토콜 버그) 해소 확인.
  - 항목 2 PASS(스모크): iOS 호스트 plan-탭 폴 카드가 웹 투표를 realtime 반영 — "참여 2명 · 최다 후보 2026-07-11" 집계 수신.
  - 항목 3 PASS(무회귀 관찰): 앱 authed 세션(ydkim4782@gmail.com)으로 extract/generate/vote/confirm 등 전 작업 정상 — auth 회귀 없음. (fresh 매직링크 로그인은 실제 메일 발송이라 재현 생략.)
  - ⚠️ **FINDING F-20-3(환경/배포)**: presence는 선언된 **@supabase/supabase-js 2.110.0** 설치가 필요 — 이 로컬 환경의 node_modules가 **stale 2.45.4**(lockfile은 2.110.0인데 `pnpm install` 미실행)라, 2.45.4에선 presence viewers=0(GAP-19D 재현), `pnpm install`로 2.110.0 realize 후 양쪽 2명 수렴. 프로덕션(Vercel)은 lockfile로 빌드하므로 정상. broadcast(투표·채팅)는 2.45.4에서도 동작(GAP-19D는 presence 한정).

## Summary

total: 6
passed: 5 (Test 1 pass-with-findings · Test 3·4·5 pass · Test 6 pass-with-findings)
issues: 3 (F-20-2 Agoda 프리필·F-20-3 stale supabase-js — 모두 경미/환경; F-20-1 기수정)
pending: 0
skipped: 1 (Test 2 — TP 대시보드 외부 로그인, 사용자 직접 확인)
blocked: 0

## Findings

- **F-20-1** (버그 → **FIXED**, `apps/ios/app/trip/[id]/(tabs)/book.tsx` + `map.tsx`): **예약(book) 탭 무한 로딩. 원격 DB/0021 문제 아님 — expo-router 파라미터 전파 버그였음.**
  - **증상:** 플랜 없는 trip에서 book 탭이 로딩 스피너에 20초+ 무한 정지(D-04 "먼저 플랜을 만들어주세요"가 안 뜸). 오사카·도쿄 2 trip 재현.
  - **진단 경로:** ① 0021 원격 적용 확인 — `booking_checklist_items` 테이블·`booking_clicks.checklist_item_id` 컬럼 존재. ② 앱과 동일한 6개 쿼리를 실사용자 JWT(sim AsyncStorage에서 추출) + 실 trip_id로 REST 직접 호출 → **전부 0.1~0.4s 빠른 200 응답**, /auth/v1/user도 0.12s. 서버·RLS·환율 어디에도 hang 없음. ③ book.tsx에 임시 stage 계측 렌더 주입 → 스피너에 **"DBG stage: start · id=[undefined]"** — `load()`가 첫 줄도 못 가고 `if (!id) return;`에서 즉시 반환. ④ `moajoa://trip/<id>/book` 딥링크(id 명시)로 직접 진입 → **정상 로드**("먼저 플랜을 만들어주세요"). 계측 되돌림.
  - **근본 원인:** 탭바 **탭 탭으로 진입**하면 `useLocalSearchParams`가 부모 `[id]` 세그먼트를 못 넘겨받아 `id=undefined`. book.tsx `load()`의 `if (!id) return;`이 `finally { setLoaded(true) }` **전에** 반환 → `loaded`가 영영 false → 무한 스피너. plan 탭은 **앱 기본 착지 라우트**라 초기 URL에서 id를 받아 정상(그래서 같은 훅인데 plan만 됨).
  - **수정:** book.tsx·map.tsx의 `id`를 `useLocalSearchParams` → **`useGlobalSearchParams`**(전체 URL에서 읽어 탭 진입 방식 무관하게 부모 param 확보). book.test.tsx mock에 `useGlobalSearchParams` 추가. **검증:** 탭 탭으로 book 진입 → "먼저 플랜을 만들어주세요" 정상. `pnpm --filter @moajoa/ios typecheck` 0, iOS 17 suites/123 tests GREEN. map.tsx도 동일 잠재버그(탭 진입 시 핀 미표시 — loaded 게이트 없어 hang은 아니나 데이터 누락)라 함께 수정.
  - **잔여 권고:** plan.tsx는 기본 착지라 동작하나 동일 훅 사용 — 향후 tab 순서 변경 시 리스크. **Phase 21 ledger.tsx는 `useGlobalSearchParams`로 작성**(21 plan PATTERNS에 반영 권장). ※ C-19-1(확정 후 헤더 날짜 미표시)은 별개 이슈로 잔존 — trip.start/end_date는 DB에 정상 기록됨(REST로 도쿄 trip 7/15~17 확인) → 헤더 렌더 갱신 문제.

- **F-20-2** (경미, 외부 서비스): Agoda 직접검색 딥링크(`buildDirectSearchUrl('agoda')` = `agoda.com/ko-kr/search?textToSearch=<도시명>&checkIn/Out=…`)가 Agoda 모바일 홈으로 리다이렉트되며 날짜·도시 프리필 유실(관측 시 오늘 날짜로 리셋). MOAJOA는 파라미터를 정확히 전달함(동일 city·date로 **Booking.com은 완벽 프리필** — ss/checkin/checkout 방식). Agoda는 by-name `textToSearch` 대신 city ID를 기대할 가능성. 20-1 계약(시스템 Safari 착지)은 충족 — 프리필 품질만 개선 여지. 수정 시 core `packages/core/src/booking.ts` `buildDirectSearchUrl`에서만.
- **F-20-3** (환경/배포, 코드 아님): 웹 presence(GAP-19D) 검증 시 로컬 `node_modules`가 stale `@supabase/supabase-js@2.45.4`였음 — `package.json`/`pnpm-lock.yaml`은 이미 **2.110.0** 선언인데 이 환경에서 `pnpm install` 미실행 상태. 2.45.4에선 presence viewers=0(버그 재현), `pnpm install`로 2.110.0 realize 후 "지금 2명 보는 중" 양쪽 수렴. **조치**: 이번 세션에서 `pnpm install` 실행함(lockfile 불변, node_modules만 정렬). CI/배포는 lockfile 기준이라 영향 없음.

## Gaps

- Test 2(TP 대시보드 SubID 집계): 외부 서비스 로그인 — **사용자 직접 확인 필요**(marker 745749, SubID=745749.c_XXXX 형식으로 booking_clicks.click_token 대조). Test 1에서 Klook/KKday/Airalo 실클릭 다수 발생시켜 둠.
- ATTR-02 실기기 크로스세션 쿠키 보존: 시스템 Safari cookie store가 앱-격리 아님을 실기기에서만 확인 가능(sim/자동화 범위 밖).
- 매직링크 fresh 로그인(20-6 항목3): 실제 메일 발송 부작용으로 재현 생략 — authed 세션 전 작업 정상으로 무회귀 간접 확인.
