# Phase 20: Affiliate Booking (딥링크 제휴 예약) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

플랜의 **숙소·액티비티·교통·유심** 슬롯에 맥락형 인라인 예약 카드가 뜨고, book 탭의 **통합 예약 체크리스트**에서 멤버가 예약을 한 곳에서 진행·관리한다. 모든 클릭이 **SubID(클릭 토큰)로 어트리뷰션**되어 `booking_clicks`에 기록되고, 예약 링크는 **시스템 브라우저**로 열려 제휴 쿠키가 보존된다. (BOOK-01/02/03 + ATTR-02)

**In scope:** plan 탭 인라인 예약 카드(맥락 삽입) · book 탭 체크리스트(자동 파생 + 수동 추가 + 3단 상태) · 클릭 토큰 발행 + booking_clicks INSERT 경로 + 제휴 URL 조립(리다이렉트 EF 또는 동등 구조 — planner 재량) · 실 제휴값 env 배선(Travelpayouts marker) · 시스템 브라우저 오픈 · 비교 프레임 카드(Klook/KKday) · 숙소 비제휴 딥링크 · 유심/교통 정적 매핑 테이블 · supabase-js 업그레이드(GAP-19D, folded).

**Out of scope:** 실시간 가격비교 위젯(ROADMAP 명시 제외 — deferred) · 예약 전환 postback 자동 완료 처리(제휴 네트워크가 실시간 미제공) · 웹 공유 페이지 예약 카드(deferred) · 항공권 검색 · 인앱 결제.

**⚠️ 제휴 현실 (2026-07-02 실측):** Travelpayouts 계정 활성(프로젝트 Moajoa-web, **marker 745749**). 연결된 프로그램 = **Klook·KKday(액티비티/교통 일부)·Airalo(유심)**. Agoda·Trip.com 등 대형 브랜드는 트래픽 게이트로 거절(재신청 가능, 성장 후). Stay22 미가입 → **숙소 슬롯은 제휴 없이 시작**. 상세: 시종장 메모리 `affiliate-setup.md`.

</domain>

<decisions>
## Implementation Decisions

### 예약 카드 노출 규칙 (Area 1)
- **D-01:** 카드 위치 = **plan 탭 일정 흐름 안 맥락 삽입.** 액티비티성 장소 항목 아래 그 장소의 예약 카드, Day 1 시작 전에 숙소·유심 카드. "맥락형 인라인"(BOOK-01)의 직해.
- **D-02:** 노출 밀도 = **슬롯당 자리 고정.** 숙소·유심 = 여행 전체 1번(Day 1 상단), 교통(패스류) = 여행당 1번, 액티비티 = 예약성 장소 항목에만 작은 버튼/컴팩트 카드. **큼직한 카드는 최대 2~3장** — 일정이 광고판이 되지 않게.
- **D-03:** **book 탭 = 체크리스트 홈**(관리 지점: 완료/미완료 상태), plan 인라인 카드 = 발견 지점(맥락에서 바로 예약). 데이터는 하나, 표면만 둘. 17-04 스텁(`book.tsx` "곧 제공돼요")을 이 phase가 채운다.
- **D-04:** 노출 시점 = **플랜 초안 생성 후.** 플랜 없는 trip·날짜 미정(투표 중) trip에서는 카드·체크리스트 모두 숨김(빈 상태 안내). 날짜 없이는 숙소 검색 프리필도 무의미.

### 숙소 슬롯 + 비교링크 (Area 2)
- **D-05:** 숙소 슬롯 = **비제휴 링크로 일단 완성.** 숙소 제휴 부재 상태에서 일반 검색 딥링크(도시·날짜 프리필, 수익 없음)로 카드·체크리스트 UX를 완성한다. 제휴(Stay22/Agoda) 승인 시 **provider만 스왑** — buildAffiliateUrl 구조가 이를 전제.
- **D-06:** 액티비티 비교 = **비교 프레임 카드.** 한 카드 안에 Klook·KKday를 나란히 + 정적 성격 라벨(예: 즉시확정/한국어 상품 강세) + 각각 [보기] 버튼. "버튼 두 개 던지기"가 아니라 비교 구도로 읽히게. **실시간 가격 표시는 명시 제외**(사용자와 논의 후 확정 — API 게이트·상품 매칭 난이도·가격 불일치 신뢰 리스크). 단, **카드 프레임은 나중에 가격이 끼워질 수 있는 구조**로 설계.
- **D-07:** 비교의 실질 편의 = **장소 타깃 검색 딥링크.** 버튼이 플랫폼 홈이 아니라 **해당 장소명 검색 결과 페이지로 직접 착지**(탭 1번에 가격 확인). 두 플랫폼 총 2탭으로 비교 완료. 플랫폼별 검색 URL 규격은 plan 단계 실측.
- **D-08:** 액티비티 버튼 대상 = **예약성 카테고리만.** places.category가 관광명소·액티비티·테마파크 계열일 때만 노출. 맛집·카페 제외(어색한 매칭 방지). 정확한 판정 경계는 기존 카테고리 체계(`packages/core/src/category.ts`) 기반 Claude 재량.
- **D-09:** 유심·교통 카드 = **도시/국가 기반 정적 매핑.** trip `city_code` → 국가 → Airalo 해당 국가 eSIM 딥링크; 교통은 국가/도시별 대표 패스 정적 테이블(일본 = JR패스 Klook/KKday 딥링크 등). 커버 안 되는 도시는 카드 숨김(억지 추천 금지).

### 체크리스트 동작 (Area 3)
- **D-10:** 항목 생성 = **플랜에서 자동 파생 + 수동 추가.** 플랜 초안 생성 시 숙소 1·유심 1·교통 1 + 예약성 장소들이 자동 항목화. 불필요 항목 삭제 가능, 자유 텍스트 항목 직접 추가 가능(앱 밖 예약 — 항공권·레스토랑 등).
- **D-11:** 완료 처리 = **수동 체크 + 클릭 흔적 3단 상태.** `미완료 → 확인함(예약 링크 클릭 시 booking_clicks 기반 자동 표시) → 완료(사용자 수동 체크)`. 전환 postback이 없으므로 완료의 원천은 항상 사용자.
- **D-12:** 조작 권한 = **멤버 모두.** trip 편집 권한(can_edit_trip) 있는 멤버 누구나 진행·체크(공동 예약 현실). 대표 독점 권한 없음 — "대표가 진행"(BOOK-02)은 주 사용자 시나리오이지 권한 게이트가 아님. 기존 RLS 헬퍼 그대로.
- **D-13:** 플랜 변경 동기화 = **체크된 항목 보존.** 완료/확인함 항목은 플랜 재생성·장소 제거에도 유지(실제 돈 쓴 기록). 플랜에서 빠진 장소면 '플랜에 없음' 배지. 미체크 자동 항목은 새 플랜 기준 재파생.

### 클릭 순간 UX (Area 4)
- **D-14:** 열기 = **탭 즉시 시스템 브라우저.** 중간 확인 시트 없음(비교 프레임에 행선지 정보가 이미 있음). 클릭 토큰 발행·booking_clicks 로깅은 백그라운드에서, **브라우저 오픈을 블록하지 않게.**
- **D-15:** 복귀 UX = **조용한 유도.** 앱 복귀 시 팝업 없이, 해당 항목이 '확인함' 상태로 바뀌고 체크리스트에 "예약했으면 체크해주세요" 인라인 힌트만. 방해 없이 기록 유도.
- **D-16:** 제휴 고지 = **설정/안내 페이지에만.** 카드 UI는 깨끗하게. ⚠️ planner 주의: Travelpayouts/각 프로그램 ToS의 최소 고지 요건을 plan 단계에서 확인 — 링크 인접 고지가 규정상 필수로 판명되면 카드 하단 최소 문구로 승격(사용자 재확인 없이 규정 준수 우선).

### Claude's Discretion
- 클릭 토큰 발행·로깅 아키텍처: 클라 직접 INSERT vs 리다이렉트 EF(ROADMAP 추정은 booking-redirect EF — marker/URL 조립 + 'clicked' 로깅). 단 **D-14의 "오픈 논블로킹" 제약** 하에 결정.
- 시스템 브라우저 구현: iOS에서 제휴 쿠키가 실제 보존되는 API 선택(`Linking.openURL` vs SFSafariViewController 계열 — 쿠키 격리 여부 실측). ATTR-02의 본질은 "쿠키 보존"이지 특정 API가 아님.
- 체크리스트 데이터 모델(테이블 신설 vs plan_items 확장), 자동 파생 시점·재파생 규칙 세부.
- Klook/KKday/Airalo 딥링크 URL 규격 + sub_id 파라미터 실측(tp.st 단축링크가 아니라 직접 조립 — 17-02 계약).
- 정적 매핑 테이블의 위치(packages/core 상수)와 초기 커버리지(일본 우선).
- 비교 프레임 카드의 정적 라벨 문구.
- booking_clicks 스키마 확장 필요 여부(0016 빈 테이블 → INSERT 경로 + 마이그레이션은 append-only 새 번호).

### Folded Todos
- **supabase-js 업그레이드 (GAP-19D presence)** — Phase 19 UAT에서 발견된 realtime presence 관련 supabase-js 업그레이드 대기 건(`.planning/todos/pending/supabase-js-upgrade-presence.md`). 사용자 결정으로 이번 phase에 포함. 예약 도메인과 무관한 인프라 작업이므로 **독립 wave/plan으로 분리** 권장(예약 코드와 커플링 금지).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·로드맵
- `.planning/ROADMAP.md` §"Phase 20: Affiliate Booking" — goal, 성공기준 4개, plans 추정(~3)
- `.planning/REQUIREMENTS.md` — BOOK-01(인라인 카드), BOOK-02(체크리스트), BOOK-03(비교 1~2곳), ATTR-02(시스템 브라우저); ATTR-01은 17-02에서 Done

### 어트리뷰션 계약 (17-02에서 락 — 재논의 금지)
- `packages/core/src/booking.ts` — `buildAffiliateUrl`(유일한 링크 조립 지점), `ClickTokenSchema`(c_base62 8-30), `BookingClickContextSchema`(tripId+userId 필수, placeId optional), `AffiliateProvider` enum. **PLACEHOLDER 슬롯에 실값 env 주입이 이번 phase 몫.**
- `packages/core/src/booking.test.ts` — 계약 테스트(깨지 말 것)
- `supabase/migrations/0016_trips_baseline.sql` — `booking_clicks` 빈 테이블(owner-read RLS). INSERT 경로 + 필요 시 append-only 확장은 이번 phase.

### 제휴 실측값 (외부 준비물)
- Travelpayouts marker **745749**, 연결 프로그램 Klook·KKday·Airalo (2026-07-02). tp.st 단축링크 샘플: klook.tp.st/4wgIelSO·RLrgjTRj, airalo.tp.st/kAh38D3L, kkday.tp.st/gVbA69Yv — **참고용**(실제 조립은 buildAffiliateUrl + marker + sub_id 직접). Drive 스크립트는 웹 채널용(apps/web/app/layout.tsx, 커밋 ae52afe) — 이번 phase와 무관.
- 실값(marker 등)은 **env 배선**, 하드코딩 금지(CLAUDE.md §4.7).

### 클라이언트 통합 지점
- `apps/ios/app/trip/[id]/(tabs)/plan.tsx` — 인라인 카드 삽입 지점(18 상태머신 + 19 투표카드 분기 위 surgical 확장)
- `apps/ios/app/trip/[id]/(tabs)/book.tsx` — 17-04 neutral 스텁 → 체크리스트 홈으로 교체
- `packages/core/src/category.ts` — 예약성 카테고리 판정(D-08)의 기반 체계
- `packages/api/src/queries/plans.ts` — plan_items 조회 하우스 계약(체크리스트 파생 입력)

### 이전 phase 결정
- `.planning/phases/17-trip-foundation-ia/17-CONTEXT.md` — D-06/D-07(affiliate 계약 + booking_clicks는 17 scope-only, 배선은 Phase 20), trips 식별자 계약
- `.planning/phases/18-auto-plan-ai/18-CONTEXT.md` — plan_items 구조(day/order), plan 탭 상태머신, "초안" 개념
- `.planning/phases/19-date-voting/19-CONTEXT.md` — dateless trip(D-04 게이트 대상), plan 탭 관리 카드 분기 선례

### Folded todo
- `.planning/todos/pending/supabase-js-upgrade-presence.md` — GAP-19D 원문

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildAffiliateUrl` + `ClickTokenSchema`(17-02) — 링크 조립·토큰 검증 완성. 이번 phase는 실값 주입 + 호출부 + 토큰 발행·로깅.
- `booking_clicks` 테이블(0016) — 존재함. INSERT 경로만 신설.
- plan 탭 상태머신(18-05) + 날짜투표 관리 카드 분기(19-03) — 조건부 카드 삽입의 검증된 surgical 패턴.
- `join_shared_trip`/anon-grant RPC idiom — EF에서 검증 후 INSERT하는 패턴(리다이렉트/로깅 EF 참고).
- book 탭 스텁(17-04) — 교체 대상 자리 확보됨.

### Established Patterns
- RLS = SECURITY DEFINER 헬퍼 경유(직접 cross-table EXISTS 금지, 42P17 가드).
- 마이그레이션 append-only — 새 번호만(현재 0020까지 사용됨 → **이번 phase는 0021부터**).
- 외부 입력 Zod validate(@moajoa/core), 워크스페이스 import `.js` 금지.
- 서비스롤은 EF 안에서만, 클라는 anon 키.

### Integration Points
- plan.tsx 일정 렌더 → 인라인 카드(D-01/D-02) — plan_items + places.category 입력.
- book.tsx → 체크리스트(D-10~13) — 플랜 파생 + 수동 항목.
- 클릭 → 토큰 발행 → booking_clicks INSERT → 시스템 브라우저(D-14) — buildAffiliateUrl 경유.
- env: Travelpayouts marker 등 실값 배선(eas.json/env 규약 — 클라 노출 가능 여부는 marker가 공개값이므로 planner 판단).

### ⚠️ 주의
- **SFSafariViewController는 iOS 11+에서 Safari와 쿠키 미공유** — "시스템 브라우저 = 쿠키 보존"을 만족하는 실제 API를 plan 단계에서 검증(ATTR-02의 본질 충족이 기준).
- 숙소 비제휴 딥링크(D-05)도 buildAffiliateUrl 경로 밖의 "손조립"이 되지 않게 — 비제휴 provider 분기 또는 별도 헬퍼로 일원화(Pitfall 1 정신 유지).

</code_context>

<specifics>
## Specific Ideas

- 비교 프레임 레퍼런스(사용자 합의안): 카드 안에 `Klook ─ 즉시확정 [보기] / KKday ─ 한국어 상품 [보기]` 식의 나란한 2행 — "따로따로 버튼"이 아니라 비교 구도.
- 타깃 사용자 = 한국인 일본 여행 중심 → KKday의 한국어 상품 강세가 비교 가치의 실체. 정적 라벨도 이 결에서.
- 편의성의 핵심은 "탭 수 최소 + 정확한 착지"(장소 검색 결과 직행) — 홈에 떨궈 재검색시키는 것이 최악이라는 합의.

</specifics>

<deferred>
## Deferred Ideas

- **실시간 가격 비교** — API 파트너십(트래픽 게이트)·상품 매칭·가격 신뢰 문제로 명시 제외. 비교 프레임 카드에 가격 자리가 들어갈 수 있는 구조만 유지. 트래픽 성장 + API 접근 확보 후 재검토.
- **웹 공유 페이지(/t/[slug]) 예약 카드** — 익명 방문자 대상 제휴 노출 + Travelpayouts 재심사용 트래픽 실적에 유리하나 이번 phase 범위 밖(로드맵은 plan 슬롯 = iOS). 후속 phase 후보.
- **대형 브랜드 제휴 재신청**(Agoda·Trip.com) — 2026-07-03 이후 재제출 가능, 실사용·공유 보드 축적 후.
- **예약 전환 자동 추적** — Travelpayouts postback/API로 전환 데이터를 당겨와 완료 자동화. 지금은 대시보드 수동 확인.

</deferred>

---

*Phase: 20-affiliate-booking*
*Context gathered: 2026-07-02*
