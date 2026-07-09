**Goal:** 추가 API 비용 0으로, 장소 카드의 카테고리 색이 (맵링크 포함) 항상 살아난다. 추출 LLM이 장소마다 coarse vibe(6택: food/cafe/nature/culture/shopping/other)를 부여하고, 맵링크 장소는 동명 LLM 후보의 vibe를 빌려오며, `places.category = primaryType ?? vibe`로 저장. iOS `vibeOf`/웹 `categoryVisual` 중복 매퍼를 `packages/core`의 단일 `placeVibe` resolver로 통일(아이콘은 클라이언트별 유지, 색 hex는 core VIBE_META 공유).
**Requirements**: EXTRACT-12
**Depends on:** Phase 14
**Plans:** 3 plans

Plans:

- [x] 15-01-PLAN.md — core 단일 resolver: placeVibe + Vibe + VIBE_META (TDD)
- [x] 15-02-PLAN.md — Edge 추출: LLM vibe 필드 + 맵링크 vibe 매칭 + category=primaryType??vibe (배포 v78 + 라이브 UAT ✅ 2026-06-15: 짧은 영상 추출→맛집/카페 색 카드 확인)
- [x] 15-03-PLAN.md — iOS/웹 클라이언트 매퍼를 core placeVibe 호출로 교체

### Phase 16: iOS share ingestion

**Goal:** 공유 시트로 유튜브/블로그/인스타 링크를 MOAJOA로 보내면 앱이 받아 보드에 링크 추가 + 추출 트리거까지 동작한다. 현재(2026-06-17 디버깅 확인): expo-share-intent 표준 네이티브 익스텐션(`ios/byMOAJOA`, App Group `group.com.serendipitylife.moajoa`)은 공유 데이터를 키 `moajoaShareKey`에 쓰고 `moajoa://dataUrl=moajoaShareKey?nonce=…` 딥링크로 앱을 열지만, JS 수신이 전무 — `app/+native-intent.tsx` 부재로 딥링크가 expo-router 직행→"Unmatched Route"이고, 커스텀 드레인 `lib/pending.ts`의 `drainPendingLinks()`는 다른 키 `SharedDefaultsKeys.PendingLinks`를 읽는데 익스텐션은 거기에 안 써서 네이티브 캡처↔JS 드레인이 끊겨 있음.
**결정 잠금 (discuss 완료):** D-05 A안 채택 — `+native-intent.tsx`(리다이렉트 전용) + 마운트된 `share-handler.tsx`(읽기/검증/라우팅) 두 조각으로 분해(`redirectSystemPath`는 앱 컨텍스트 밖이라 auth/Supabase 불가). 기존 큐·드레인·실패화면 인프라 전부 보존. D-01 스마트 라우팅(1개→자동, 2개+→인앱 피커), D-02 로그아웃/0보드→큐 머묾, D-03 자동시 보드 이동+추출 진행 표시, D-04 인앱 바텀시트 피커, D-06 표준 익스텐션 유지(app.config.ts 변경 없음, prebuild 불필요).
**Requirements**: D-01..D-06 (ROADMAP에 REQ-ID 미할당 — CONTEXT 결정으로 커버)
**Depends on:** Phase 15
**Plans:** 3 plans

Plans:

- [x] 16-01-PLAN.md — Wave 0 순수 기반: `decideShareRoute`(D-01/D-02) + `+native-intent.tsx` 리다이렉트(D-05) + 유닛 테스트 (TDD RED→GREEN, 11 신규 테스트 / iOS 풀스위트 54/54, tsc clean; jest는 이 환경에서 `--watchman=false` 필요)
- [x] 16-02-PLAN.md — 마운트 핸들러 `share-handler.tsx`: 페이로드 읽기·Zod http(s) 검증(V5)·라우팅 → enqueue 머묾(D-02) 또는 자동추가+추출+이동(D-03/D-05) + `_layout` ShareIntentProvider 래핑 (TDD RED→GREEN, 15 신규 테스트[9 share-payload + 6 share-handler] / iOS 풀스위트 69/69, tsc clean; `extractSharedUrl` V5 가드 + `handleSharedUrl` 테스트 가능 seam; 자동경로는 직접 addLink+startExtraction[D-03 가시], 드레인 triggerExtraction 아님; 프로바이더 reader-only·드레인 미변경)
- [~] 16-03-PLAN.md — **구현 ✅ / 디바이스 UAT ⏳ 대기.** Task 1(코드+유닛) 완료: `board-picker-sheet.tsx`(D-04 인앱 피커 — keep-mounted `shown` + 인라인 backgroundStyle + 내부 View className, pin-sheet 미러·Pitfall 6 첫오픈 no-op 회피; listMyBoardsWithPreview→title+place_count 행) + `share-handler.tsx` 피커 분기 배선(`addAndNavigate` 공유 헬퍼로 auto[1보드]·picker[2+] 단일 경로, `pickerUrl` state 보유 후 시트 마운트). TDD RED→GREEN 044cb1b/a82dffa, 5 신규 피커-셀렉트 와이어링 = iOS 풀스위트 74/74, tsc clean; Rule 3: 테스트가 BoardPickerSheet 모듈 stub(@gorhom→reanimated jest 미로드 회피, 설정/소스 변경 0). **Task 2 `checkpoint:human-verify` gate=blocking — 디바이스/심 UAT 4 시나리오(피커 첫오픈·1보드 자동이동·로그아웃 머묾·중복방지) 사용자 측 미수행 → 통과 전까지 fully-done 아님** (상세 16-03-SUMMARY.md "Pending: Device UAT")

---

## Milestone v2.0 — 전면 개편 (발견→예약→정산 풀 루프)

**Defined:** 2026-06-21 · 출처: `.planning/research/SUMMARY.md` + `docs/PRODUCT.md`
**Goal:** 추출+투표 제품을 발견 → 결정 → 플랜 → 예약 → 정산 풀 루프로 확장하고, 네비게이션을 여행 4단계(지도·플랜·예약·가계부)로 재편한다. 수익(제휴 수수료)을 MVP에 내장.
**Granularity:** standard
**Phase 번호:** 기존 마지막(Phase 16)에서 이어감 → Phase 17~22 (reset 아님)

빌드 순서는 SUMMARY.md를 따른다: 기반(17) 비협상 첫 번째 → 플랜(18)·투표(19)·예약(20)·가계부(21) 병렬(예약은 플랜 의존, 가계부는 메일 인프라 리드타임으로 기반 직후 착수) → Android(22) 마지막.

### Phases

- [x] **Phase 17: Trip Foundation & IA 재편** — 0016 마이그레이션 + core 식별자 계약 + Expo Router 여행 4탭 + 진입분기 + 일정 정해짐 경로 (비협상 기반) — 5/5 plans 완료 + verify 통과 (6/6 criteria, 7/7 reqs, 2026-06-21)
- [x] **Phase 18: Auto Plan (사용자 트리거 AI 플랜)** — 추출로 장소를 모은 뒤 plan 탭 "플랜 만들기"로 AI 초안 생성(추출 직후 자동 아님). 동선·이동시간(Routes 그라운딩)·드래그 재배치·"초안" 명시 (completed 2026-06-22)
- [ ] **Phase 19: Date Voting (일정 미정 분기)** — 날짜 투표 + 비로그인 초대 링크 + 집계→여행 일정 전환
- [x] **Phase 20: Affiliate Booking (딥링크 제휴 예약)** — 인라인 예약 카드 + 통합 체크리스트 + SubID 어트리뷰션 + 시스템 브라우저 (completed 2026-07-04)
- [x] **Phase 21: Travel Ledger (메일 전달 가계부)** — 전용 전달주소 + AI 메일 파싱 + 통화·환율·결제시점 보존 + 수동 fallback (completed 2026-07-05)
- [ ] **Phase 22: Android Parity** — Android 빌드·실행·공유시트 + 핵심 4단계 동작 (대표/결제자 대응)

### Phase Details

### Phase 17: Trip Foundation & IA 재편

**Goal**: 여행이 일급 컨텍스트가 되고, 앱 진입이 여행 4탭으로 재편되며, 모든 후속 phase가 import할 트립 스코프 식별자 계약이 잠긴다. "일정 정해짐" 경로로 날짜·도시·대표를 입력해 여행을 만들 수 있다.
**Depends on**: Nothing (비협상 첫 번째 — SUMMARY Phase A. 의존 없음)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, ATTR-01, SETUP-01, SETUP-02
**Success Criteria** (what must be TRUE):

  1. 앱을 열면 여행이 0개면 온보딩, 1개면 그 여행으로 바로, 2개+면 마지막 본 여행으로 진입한다
  2. 여행 안에서 하단 탭(지도·플랜·예약·가계부)으로 단계를 전환할 수 있고 탭바가 항상 보인다
  3. 헤더에서 새 여행 만들기·여행 전환·내 정보에 접근할 수 있다 (새 여행은 별도 탭이 아님)
  4. 일정이 정해진 경우 날짜·도시를 입력하고 대표(결제자)를 지정해 여행을 생성할 수 있다
  5. (D-15 재해석 — 라우트 위생) 옛 라우트 패턴이 제거/이전되고 신규 공유 경로(웹 `/t/[slug]`, 앱 `/trip/[id]`)가 동작한다. 외부 사용자 0명 근거로 "옛 링크가 깨지지 않는다"는 문자 그대로의 게이트는 waive.
  6. 예약 딥링크가 trip(가능하면 place) 컨텍스트를 담은 SubID 포맷으로 생성된다 (`packages/core` 단일 헬퍼, Day1 포맷 확정)

**Plans**: 5 plans
Plans:

- [x] 17-01-PLAN.md — core foundation: vitest wiring + Trip/TripId/TripCreate Zod (board.ts→trip.ts) + TripKeys + decideEntryRoute (NAV-01/SETUP-01/02)
- [x] 17-02-PLAN.md — affiliate contract: buildAffiliateUrl + BookingClickContext + opaque ClickToken (ATTR-01, TDD)
- [x] 17-03-PLAN.md — 0016 squash baseline + RLS/trigger/view/join port + api trip-vocab rename + local db reset + types regen (SETUP-02/NAV-04) — remote reset deferred
- [x] 17-04-PLAN.md — Expo Router 4-tab restructure + 0/1/N entry + trip header (no FAB) + share repoint + old-route delete (NAV-01/02/03/04)
- [x] 17-05-PLAN.md — onboarding 정해짐/미정 branch + trip create UI (preset city/date range/auto-rep) + web /b/[slug]→/t/[slug] move (SETUP-01/02/NAV-04)

**UI hint**: yes

### Phase 18: Auto Plan (사용자 트리거 AI 플랜)

**Goal**: 추출로 모은 장소로 사용자가 plan 탭에서 "플랜 만들기"를 누르면 AI가 동선·날짜별 일정 초안을 짜고, 사용자가 장소를 추가/제거/재배치하며, 일정에 이동시간이 그라운딩된다. AI가 초안을 대신 짜주는 "아하 순간"을 만든다. (추출 직후 자동 생성 아님 — 한 trip에 링크 여러 개를 모은 뒤 사용자가 생성. CONTEXT D-01)
**Depends on**: Phase 17 (식별자 계약 + 플랜 탭 라우팅). Phase 19와 병렬 가능
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):

  1. plan 탭의 "플랜 만들기"를 누르면 그 시점 trip의 추출 장소로 동선·날짜별 일정 플랜 초안이 생성되어 나타난다 (D-01 재해석 — 추출 직후 자동이 아니라 사용자 트리거)
  2. 플랜이 "초안"으로 명시되고, 사용자가 장소를 추가/제거하고 순서를 드래그로 재배치할 수 있다
  3. '필수 장소'를 선택하면 그 주변으로 동선이 재구성된다
  4. 일정 항목 사이에 이동시간이 표시된다 (Google Routes API 그라운딩 — 좌표 없는 장소는 자동배치 제외)
  5. "친구와 같이 정하기"로 같은 플랜을 협업 투표 모드로 전환할 수 있다 (옵션)

**Plans**: 5 plans
Plans:

- [x] 18-01-PLAN.md — core 계약: plan/plan_items Zod + GeneratePlanRequest + planChannelName/PlanStep/TravelMode (TDD, Wave 1)
- [x] 18-02-PLAN.md — [BLOCKING] 0017_plans.sql (plans/plan_items + RLS DEFINER 재사용 + extraction_costs google_routes) + 로컬 적용 + 타입 재생성 (Wave 1)
- [x] 18-03-PLAN.md — generate-plan EF: auth+can_edit_trip 게이트 + (0,0) 필터 + Claude 클러스터링 + Routes 인접 leg(Essentials) + 브로드캐스트/비용 (Wave 2)
- [x] 18-04-PLAN.md — @moajoa/api plans 쿼리: getPlanByTrip/generatePlan invoke/reorder/move/setTravelMode/setCollaborative(flag+share) (TDD, Wave 2)
- [x] 18-05-PLAN.md — plan.tsx States A–F(버튼→스켈레톤→초안) + 드래그 재배치 + 미배치 풀 + 필수 앵커 + 협업 토글 + 디바이스 UAT (Wave 3) — 코드 완료(jest 79/79 + typecheck 0, commits 5a454b9/cb63909/b461d05) + 디바이스 UAT 사용자 승인 ✅ (2026-06-22)

**UI hint**: yes

### Phase 19: Date Voting (일정 미정 분기)

**Goal**: 일정이 미정인 경우 날짜 투표를 만들어 초대 링크/코드로 일행을 부르고, 무설치(웹)로 투표받아, 집계된 날짜를 여행 일정으로 확정 전환한다.
**Depends on**: Phase 17 (트립 컨텍스트 + share_slug 재사용). Phase 18과 병렬 가능
**Requirements**: POLL-01, POLL-02, POLL-03
**Success Criteria** (what must be TRUE):

  1. 일정 미정 분기에서 날짜 투표를 만들고 초대 링크/코드로 일행을 부를 수 있다
  2. 초대받은 일행이 앱 설치 없이 웹에서 가능한 날짜에 투표할 수 있다
  3. 투표가 집계되어 보이고, 확정된 날짜가 해당 여행의 일정으로 전환된다

**Plans**: 4 plans
Plans:

- [x] 19-01-PLAN.md — 0018_date_polls.sql (4 tables + ensure_poll_code trigger + 6 anon/owner RPCs) + [BLOCKING] 로컬 적용 + 타입 재생성 + psql 보안 단언 (Wave 1)
- [x] 19-02-PLAN.md — @moajoa/core 스키마(date-poll + contiguousBlock) + constants(pollChannelName) + @moajoa/api RPC 래퍼 (Wave 2, TDD)
- [x] 19-03-PLAN.md — iOS 호스트: 온보딩 미정 활성화 + 날짜없는 trip create + plan 탭 관리 카드 + 호스트 확정 + subscribePollChannel (Wave 3) — 코드+자동테스트 완료(13 suites/87 green, typecheck 0), 디바이스 UAT 대기
- [x] 19-04-PLAN.md — 웹 비로그인 투표 island(/poll/[code]: 닉네임 게이트·두 모드·실시간 집계·presence·채팅·확정 결과 전환 CTA) (Wave 3) — 코드+자동테스트 완료(web 11 suites/65 green, typecheck 0, build PASS /poll/[code]), 크로스브라우저 UAT 대기

### Phase 20: Affiliate Booking (딥링크 제휴 예약)

**Goal**: 플랜의 숙소·액티비티·교통·유심 슬롯에 맥락형 인라인 예약 카드가 뜨고, 대표가 통합 예약 체크리스트에서 한 번에 진행한다. 모든 클릭이 SubID로 어트리뷰션되고 시스템 브라우저로 열려 제휴 쿠키가 보존된다.
**Depends on**: Phase 17 (식별자 계약) + Phase 18 (플랜 슬롯). Phase 19와 병렬 가능
**Requirements**: BOOK-01, BOOK-02, BOOK-03, ATTR-02
**Success Criteria** (what must be TRUE):

  1. 플랜의 숙소/액티비티/교통/유심 슬롯에 맥락형 인라인 예약 카드(딥링크)가 표시된다
  2. 통합 '예약 체크리스트'에서 대표가 필요한 예약을 한 곳에서 진행하고 완료/미완료 상태를 본다
  3. 숙소·액티비티 비교 링크(1~2곳)가 제시된다 (실시간 가격비교 위젯은 범위 외)
  4. 예약 링크를 누르면 시스템 브라우저로 열려 제휴 쿠키가 보존되고, 클릭이 SubID로 기록된다

**Plans**: 7/7 plans complete
Plans:

- [x] 20-01-PLAN.md — supabase-js 2.45.4→2.110.0 + @supabase/ssr 0.12.0 (GAP-19D presence, 독립 wave 1 — 정당성 체크포인트 + 전체 회귀 게이트)
- [x] 20-02-PLAN.md — 0021_booking.sql (booking_clicks 토큰·정책 + booking_checklist_items) + [BLOCKING] 라이브 적용·typegen·RLS 매트릭스 (Wave 2, pooler 체크포인트)
- [x] 20-03-PLAN.md — @moajoa/core: buildAffiliateUrl 실규격(라이브 실측) + buildDirectSearchUrl + BOOKING_REGION_MAP + isBookableActivity + checklist 파생 순수함수 (Wave 2)
- [x] 20-04-PLAN.md — @moajoa/api bookings.ts (체크리스트 CRUD + reconcile + logBookingClick '확인함' 전이, TDD) (Wave 3)
- [x] 20-05-PLAN.md — iOS 기반: TP env 배선 + 클릭 핸들러(mint→open→log, 오픈-선행 계약) + CompareFrameCard + KKday 템플릿 체크포인트 (Wave 4)
- [x] 20-06-PLAN.md — plan 탭 '여행 준비' 클러스터 + 예약성 항목 비교 strip (Wave 5, ∥ 20-07)
- [x] 20-07-PLAN.md — book 탭 체크리스트 홈 + ChecklistRow + me 제휴 안내 (Wave 5, ∥ 20-06)

**UI hint**: yes

### Phase 21: Travel Ledger (메일 전달 가계부)

**Goal**: 각 사용자에게 개인 전용 전달 주소가 발급되고, 예약 메일을 전달하면 AI가 파싱해 가계부에 자동 정리한다. 외화 결제의 통화·환율·결제 시점이 원자적으로 보존되고, 앱을 거치지 않은 예약도 메일만 오면 포착되며, 애매하면 1탭 수정한다.
**Depends on**: Phase 17 (식별자 계약 — ledger 행이 trip_id 보유). 메일 인프라 리드타임이 길어 기반 직후 착수 권장 (SUMMARY Phase E)
**Requirements**: LEDGER-01, LEDGER-02, LEDGER-03, LEDGER-04, LEDGER-05, LEDGER-06
**Success Criteria** (what must be TRUE):

  1. 각 사용자에게 개인 전용 전달 주소(opaque To 토큰)가 발급된다
  2. 예약 메일을 전달하면 AI가 플랫폼·카드·통화·금액·결제일을 파싱해 가계부에 자동 정리한다
  3. 외화 결제는 (원통화 금액 + 통화코드 + 환율 + fx_source + fx_as_of)가 원자적으로 보존되어 환율 차이를 확인할 수 있다
  4. 앱을 거치지 않은 예약(직접 예약 항공권 등)도 메일만 오면 가계부에 포착된다
  5. 등록된 주소(To 토큰 매칭 + SPF/DKIM 검증)에서 온 메일만 수신·처리한다
  6. 파싱이 애매하면 사용자가 1탭으로 확인·수정한다

**Plans** (planned 2026-07-05, 4 waves):

- [x] 21-01-PLAN.md — `0022_ledger.sql` (forwarding_addresses opaque 토큰 + ledger_entries[5요소 환율 원자저장 + nullable trip_id] + RLS[trip_id NULL 분기: 미분류 본인·배정 멤버] + 행소유자 write) + 라이브 적용·typegen·RLS 매트릭스 A~H (Wave 1, autonomous:false) — ✅ 2026-07-05 (local apply, 42P17=0, RLS A~H PASS)
- [x] 21-02-PLAN.md — @moajoa/core `schemas/ledger.ts` (LedgerEntrySchema + LedgerParseOutputSchema[LLM 계약] + deriveAmountKrw/needsReview 순수함수) (Wave 2, ∥ 21-03)
- [x] 21-03-PLAN.md — @moajoa/api `ledger.ts`/`forwarding.ts` (list/assign/update/delete + getOrCreateForwardingAddress, house 계약, TDD) (Wave 2, ∥ 21-02)
- [~] 21-04-PLAN.md — CF Email Worker(얇은 raw→EF) + `inbound-email` EF(시크릿+To토큰 게이트+저장+fire-forget) + `parse-email` EF(postal-mime + claude 재활용 + Frankfurter 환율 fallback + trip 매칭) + config.toml verify_jwt=false (Wave 3, autonomous:false) — 🟡 CODE-COMPLETE 2026-07-05 (Task 1–4 done, deno test 21 green·양 EF check clean; commits a07f118·ef91f2b·17e8054·519b1b1). **Task 5 PENDING**(human-action): CF 인프라 배포·DNS 이전·INGEST_SECRET
- [~] 21-05-PLAN.md — ledger.tsx(book 상태머신 미러 + 미분류/needs_review 1탭 흐름) + LedgerRow(환율 출처 3색) + LedgerEntrySheet + me.tsx 전달주소 카드 + expo-clipboard 복사 (Wave 4) — 🟡 CODE-COMPLETE 2026-07-05 (Task 1–4 done, jest 127 green·typecheck 0; commits 8924ce0·efc0e72·4284941·e34aa40). **Task 5 PENDING**(human-verify): 디바이스 + 실메일 UAT, 21-04 Task 5 CF 배포 전제 → phase-verify 이관

**메일 인프라 결정** (discuss 2026-07-05): Cloudflare Email Routing + Email Worker (SendGrid/Mailgun 기각). SPF/DKIM은 CF 수신 거부(2025-07-03~)에 위임, To 토큰 매칭 + 미매칭 drop. 환율 = 메일 명시값 우선 + Frankfurter(무료·키없음·historical) fallback. trip = AI 매칭 + 미분류 인박스. 가계부 = 멤버 공유 열람.
**⚠️ 외부 준비물** (사용자, 리드타임): moajoa.app DNS → Cloudflare 이전 + Email Routing 활성화 + Worker 배포.
**UI hint**: yes

### Phase 22: Android Parity

**Goal**: 대표(결제자)가 Android일 수 있으므로 Android에서 앱이 빌드·실행되고 핵심 4단계(여행·플랜·예약·가계부)가 동작하며, Android 공유시트로 링크를 보낼 수 있다. (Expo라 재작성 아님)
**Depends on**: Phase 17~21 (전 phase 완료 — 패리티 검증 대상이 존재해야 함. SUMMARY Phase F)
**Requirements**: AND-01, AND-02
**Success Criteria** (what must be TRUE):

  1. Android 실기기에서 앱이 빌드·실행되고 핵심 흐름(여행·플랜·예약·가계부)이 동작한다
  2. Android 공유시트(ACTION_SEND)로 링크를 MOAJOA에 보낼 수 있다

**Plans**: 5/5 plans complete

- [x] 21-04-PLAN.md

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Trip Foundation & IA 재편 | 5/5 | Complete | 2026-06-21 |
| 18. Auto Plan | 5/5 | Complete    | 2026-06-22 |
| 19. Date Voting | 4/4 | UAT Pending |  |
| 20. Affiliate Booking | 7/7 | Complete   | 2026-07-04 |
| 21. Travel Ledger | 5/5 | Complete   | 2026-07-05 |
| 22. Android Parity | 0/~2 | Not started | - |

---

## Milestone v2.1 — 웹 퍼스트 지도탭 테스트

**Defined:** 2026-07-07 · 출처: 승인된 웹 퍼스트 구현 설계 (온보딩 4단계·스키마 0024/0025·통합 공유화면·채팅) + `docs/PRODUCT.md`
**Goal:** 유저 반응을 빠르게 관찰하기 위해, 웹에서 입력·저장·편집이 모두 가능한 지도탭(발견+결정) 테스트 버전을 출시한다. 기존 "웹 생성 UI 금지"(D26) 룰 공식 반전. iOS는 전면 동결.
**Granularity:** standard
**Phase 번호:** 기존 마지막(Phase 22)에서 이어감 → Phase 23~27. v2.0 잔여(Phase 19 UAT sign-off · 21 CF 배포 · 22 미착수)는 이 마일스톤 **밖에** 보존 — 번호·내용 무변경.

빌드 순서: 기반(23)이 비협상 첫 번째(스키마·인증 스위치·계약 seam) → 호스트 플로우(24) → 게스트 통합 공유화면(25, 24의 공유링크 필요) → 채팅(26, 25의 join·화면 필요) → 마감(27, 전 기능 위에서 게이트·카피·UAT).

### Phases

- [x] **Phase 23: Web-First Foundation** (2026-07-08 완료) — 0024 순번 채번 + 0025 share_mode/채팅/join_moa + 익명 sign-in·카카오 provider 스위치 + core/api 계약 + CLAUDE.md D26 반전
- [ ] **Phase 24: Host Flow (온보딩·지도탭)** — 카카오 버튼 + `/onboarding` 4단계 + `/moa`·`/moa/[id]` 지도탭 + 링크·장소 추가 + 함께 정하기 시트
- [ ] **Phase 25: Guest Unified Share (통합 공유화면)** — `/t/[slug]` share_mode 통합 + 닉네임→익명인증→join_moa + 익명 찜 + 날짜투표 임베드 + 게스트 장소 추가
- [ ] **Phase 26: Realtime Chat** — trip_messages + `moa:{tripId}` 단일 채널 + presence + 장소 멘션 답장 칩
- [ ] **Phase 27: Hardening & 마감** — 추출 멤버십 게이트(비용 남용 차단) + 모아/찜 카피 스윕 마무리 + 문서 + 2인극 UAT

### Phase Details

### Phase 23: Web-First Foundation

**Goal**: 웹 퍼스트에 필요한 데이터·인증·계약 기반이 잠긴다 — 장소 순번 영구 채번(0024), share_mode·companion·trip_messages·join_moa RPC(0025), 익명 sign-in + 카카오 provider 스위치, packages/core+api 계약(TripCreateDraft·chat 스키마·moaChannelName·joinMoa/shareMoa 쿼리), CLAUDE.md D26 룰 공식 반전. 이후 모든 phase가 import할 seam.
**Depends on**: Nothing within v2.1 (v2.0 산출물 — trips 스키마 0016~0022 · `/t/[slug]` OG/revalidate 인프라 · poll RPC — 위에서 시작)
**Requirements**: MOA-01
**Success Criteria** (what must be TRUE):

  1. `supabase db reset`이 0024·0025 포함 클린 통과하고(42P17 recursion 0), 재생성된 타입 위에서 core/api 테스트가 그린이다
  2. 동시에 여러 장소를 삽입해도 순번(#1, #2…)이 중복·결번 없이 채번되고, 소프트삭제·복원 후에도 원래 순번이 유지된다 (advisory-lock 트리거 SQL 동시성 테스트 — MOA-01)
  3. 익명 sign-in이 활성화되어 curl/클라이언트로 익명 세션(auth.uid)이 발급되고, `join_moa(slug)`가 share_mode에 따라 editor/voter 멤버십을 부여한다 (AUTH-08·SHARE-03의 백엔드 기반)
  4. 카카오 provider가 config.toml·대시보드에 설정되어 OAuth 플로우 시작이 가능하다 (버튼 UI·e2e 검증은 Phase 24)
  5. CLAUDE.md §5 D26 불릿이 반전되어 이후 세션이 웹 생성·편집 UI 작업을 거부하지 않는다

**Plans**: 7/7 plans complete

Plans:

- [x] 23-01-PLAN.md — 0024 순번 채번(seq_no+last_place_seq+backfill+advisory-lock DEFINER 트리거) + MOA-01 동시성 하네스 (Wave 1)
- [x] 23-02-PLAN.md — 0025 share_mode·companion·trip_messages(RLS 헬퍼-only)·join_moa(editor/voter 분기) + 익명/join/kakao smoke (Wave 1)
- [x] 23-03-PLAN.md — config.toml 익명 sign-in ON+[auth.external.kakao] + KAKAO placeholder + CLAUDE.md §5 D26 반전 (Wave 1)
- [x] 23-04-PLAN.md — [BLOCKING] 스택 재시작(config 로딩)+supabase db reset(42P17=0)+타입 재생성 + 하네스·smoke 실행 (Wave 2)
- [x] 23-05-PLAN.md — core 계약: ShareMode·moaChannelName·TripCreateDraft·chat.ts·PlaceSchema.seq_no (TDD, Wave 3) — RED→GREEN 2사이클 완료(core 169 tests 그린·api 무회귀, commits c307512·bf392b7·5b2c69d·3c24130)
- [x] 23-06-PLAN.md — api 계약: joinMoa(join_moa 래퍼)·shareMoa(visibility+share_mode 단일 UPDATE) (TDD, Wave 4) — RED→GREEN 2사이클 완료(api 81 tests 그린·기존 joinSharedTrip/shareTrip 무수정, commits e7d457f·fc0971a·20428e7·a599ea5)
- [x] 23-07-PLAN.md — 원격 마이그레이션 상태 확인(push는 범위 외) + Supabase 대시보드·Kakao console human-action (Wave 5, autonomous:false) — approved 완료(원격 0016~0023 정합·0024/0025 미적용 실측 + 프로덕션 익명 signup·kakao authorize 302 실증, KOE205→비즈 앱 전환 학습, commit 6cfc0ce)

### Phase 24: Host Flow (온보딩·지도탭)

**Goal**: 호스트가 웹에서 전 흐름을 완주한다 — 로그인(카카오 포함) → 4단계 온보딩으로 모아 생성 → `/moa/[id]` 지도탭에서 링크 자동 추출·장소 검색 추가 → 순번·찜순·아코디언·사람별 색 리스트 → [함께 정하기] 공유링크 생성·복사.
**Depends on**: Phase 23 (0024/0025 스키마 + core/api 계약 + provider 스위치)
**Requirements**: AUTH-07, ONBOARD-03, ONBOARD-04, ONBOARD-05, MOA-02, MOA-03, MOA-04, MOA-05, MOA-06, SHARE-01
**Success Criteria** (what must be TRUE):

  1. 카카오 계정으로 로그인할 수 있다 (기존 이메일·구글·애플 유지; 카카오 e2e는 Vercel Preview에서 확인 — 로컬은 이메일 대체)
  2. 로그인 직후 4단계 온보딩 — 어디로(도시 칩 9개+기타 직접입력) → 날짜(확정: 기간 입력 / 미정: 안내 한 줄 후 통과) → 누구랑 → 봐둔 곳(링크/장소검색/건너뛰기) — 을 거쳐 모아가 생성된다
  3. `/moa/[id]` 지도탭에서 유튜브·블로그 링크를 추가하면 자동 추출되어 핀이 지도에 뜨고, 구글 장소 검색으로 직접 추가할 수 있다
  4. 장소 리스트가 찜 수 내림차순(동률 시 순번 오름차순)으로 정렬되되 순번 표기는 불변이고, 행 탭 시 아코디언 상세(주소·구글맵·출처 타임스탬프·답장 버튼), 마커 탭 시 해당 행 스크롤+펼침, 추가자별 핀 색(호스트=브랜드색)과 "닉네임님이 담음"이 표시된다
  5. [함께 정하기]에서 날짜/장소/둘다 모드를 선택해 공유링크를 생성·복사할 수 있다 (날짜 확정된 모아는 '날짜 정하기' 숨김)

**Plans**: 7 plans (4 waves)

Plans:

- [~] 24-01-PLAN.md — [BLOCKING] 환경 게이트(supabase-js 2.110·react-day-picker 9.14.0) + 0026 realtime publication + 로컬 적용·스모크 exit 0 ✅ · **원격 push는 human-action 게이트 open** (Wave 1) — `24-01-SUMMARY.md`
- [x] 24-02-PLAN.md — 계약 레이어: ui-tokens member 팔레트 + memberColor·sortByLove·marker fill + api createMoaDraft·listTripMembers·getProfileNames (Wave 1) — `24-02-SUMMARY.md`
- [x] 24-03-PLAN.md — /moa 리스트 + D-01 진입 분기 + 카카오 버튼·로그인 목적지 /moa + login 테스트 (Wave 1) — `24-03-SUMMARY.md` (web 80 그린·build ƒ/moa)
- [x] 24-04-PLAN.md — /onboarding 4단계 위저드(칩·캘린더·시드 스테이징) + AddContentTabs 공유 컴포넌트 + buildDraft·제출 흐름 (Wave 2) — `24-04-SUMMARY.md` (web 88 그린·build ○/onboarding)
- [x] 24-05-PLAN.md — place-sheet 드래그 시트(D-09) + place-list(정렬·아코디언·하트·분석중/실패 행) + 테스트 (Wave 2) — `24-05-SUMMARY.md` (web 96 그린·typecheck 0·build PASS)
- [x] 24-06-PLAN.md — /moa/[id] RSC + moa-map(persistent·마커 diff·색) + moa-island(realtime postgres_changes·optimistic 찜·마커↔행 연동) (Wave 3) — `24-06-SUMMARY.md` (web 101 그린·typecheck 0·build PASS·`ƒ /moa/[id]`)
- [x] 24-07-PLAN.md — add-sheet(FAB)·share-sheet(함께 정하기) + island 배선 + phase 전체 게이트 (Wave 4) — `24-07-SUMMARY.md` (core 169·api 88·web 110·ios 128 그린·web build PASS·grep 6종 0·iOS diff 0)

**UI hint**: yes

### Phase 25: Guest Unified Share (통합 공유화면)

**Goal**: 게스트가 공유링크 하나로 무설치 참여를 완주한다 — `/t/[slug]`가 share_mode 인지 통합 화면으로 진화(기존 /t·/poll 분리 구조 통합), 닉네임만으로 익명 인증·join, 모드별 찜·장소/링크 추가·날짜투표, 호스트 화면 실시간 반영.
**Depends on**: Phase 24 (공유링크 생성 + place-list·add-link 컴포넌트 승격분). Phase 23 계약(join_moa·익명 인증) 사용
**Requirements**: AUTH-08, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):

  1. 공유링크(`/t/[slug]`)가 비로그인 상태에서 SSR로 즉시 렌더된다 (모아 이름·지도·장소 리스트; 첫 페인트만 캐시, 가변 데이터는 클라이언트 하이드레이션)
  2. 게스트 첫 상호작용 시 닉네임 바텀시트 → 익명 인증 → join_moa가 이어지고, 같은 브라우저로 재접속하면 동일 신원(찜·추가 이력)으로 식별된다
  3. 게스트가 share_mode에 따라 찜·장소/링크 추가·날짜 투표에 참여할 수 있다 (dates 모드 날짜투표는 기존 익명 poll RPC 임베드, device_token := auth.uid)
  4. 게스트의 찜·장소 추가가 호스트 화면에 실시간 반영되고, 게스트가 추가한 장소는 이어지는 순번(#N+1)을 받는다

**Plans**: TBD

**UI hint**: yes

### Phase 26: Realtime Chat

**Goal**: 같은 모아에 모인 사람들이 실시간으로 대화하며 장소를 순번으로 지칭해 결정한다 — trip_messages 히스토리 + `moa:{tripId}` 화면당 단일 채널(presence·message·vote·place_added 통합, "한 토픽 채널 2개 금지" 교훈 유지) + #N 장소 멘션 답장.
**Depends on**: Phase 25 (게스트 join 멤버십 — 채팅 히스토리 RLS SELECT 전제 — + 통합 공유화면 표면)
**Requirements**: CHAT-01, CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE):

  1. 같은 모아 공유화면에 접속한 사람들(호스트·게스트)이 실시간으로 채팅할 수 있고, 새로고침 후에도 히스토리가 유지된다
  2. "지금 N명 보는 중" 접속자 수가 입장·퇴장에 따라 실시간 갱신된다 (두 브라우저에서 수렴)
  3. 장소 행의 답장 버튼으로 메시지를 보내면 인용 칩(#N 장소명)이 붙고, 칩을 탭하면 해당 장소로 스크롤·하이라이트된다

**Plans** (planned 2026-07-10, 3 waves):

- [ ] 26-01-PLAN.md — 백엔드 기반: `0028_chat_realtime_publication.sql`(publication add + user_id 기본 트리거) + api `chat.ts`(listTripMessages·sendTripMessage) + barrel (Wave 1)
- [ ] 26-02-PLAN.md — 프레젠테이션: `moa-chat.tsx`(말풍선·입력바·presence 스트립·#N 칩/답장 배너) + `moa-tab-bar.tsx`([모으기][채팅] 하단 탭바) + moa-chat.test (Wave 1)
- [ ] 26-03-PLAN.md — island 배선(CHAT-01/02): trip_messages INSERT 바인딩(pre-subscribe)+presence track + 메시지 append/dedup + handleSend + page.tsx 히스토리 seed + island test 확장 (Wave 2)
- [ ] 26-04-PLAN.md — 멘션 루프(CHAT-03): place-list 답장→onReply + island reply 프리필·칩 탭 nav(openPlaceFromChat) + island test 확장 (Wave 3)

**UI hint**: yes

### Phase 27: Hardening & 마감

**Goal**: 테스트 버전을 외부 노출 가능한 상태로 마감한다 — 추출 트리거 멤버십 게이트(익명 세션 비용 남용 차단), 모아/찜 카피 스윕 완성(테스트 단언 동기화), WORKSTREAMS·ARCHITECTURE 문서 역할 기술 수정, revalidate 확인, 2인극 UAT 전체 통과.
**Depends on**: Phase 23~26 (전 기능이 존재해야 게이트·카피·UAT 검증 가능)
**Requirements**: SEC-01, NAME-01
**Success Criteria** (what must be TRUE):

  1. 해당 모아의 멤버가 아닌 사용자(익명 세션 포함)의 추출 트리거(Edge Function) 호출이 거부된다 — 멤버만 추출 가능
  2. 유저 대면 카피 전반(랜딩·로그인·공유화면·리스트·OG·poll 푸터)이 보드→"모아", 가고싶어→"찜"으로 표기되고, 관련 테스트 카피 단언이 같은 커밋에서 갱신된다 (코드 식별자는 유지)
  3. 2인극 UAT가 전체 통과한다 — 브라우저 A(호스트): 로그인→온보딩(여행지+미정+함께)→유튜브 링크→#1..#N 핀→함께 정하기 '둘다'→복사 / 브라우저 B(시크릿): 링크 열기→즉시 렌더→찜 시 닉네임 게이트→날짜투표+장소추가(#N+1)→채팅 "#3 어때?" / A 복귀: 실시간 반영·찜순 정렬·순번 불변

**Plans**: TBD

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 23. Web-First Foundation | 7/7 | ✅ Complete (verifier passed 12/12) | 2026-07-08 |
| 24. Host Flow (온보딩·지도탭) | 5/7 | 🔧 Executing (Wave 2 완료) | - |
| 25. Guest Unified Share | 0/TBD | Not started | - |
| 26. Realtime Chat | 0/TBD | Not started | - |
| 27. Hardening & 마감 | 0/TBD | Not started | - |
