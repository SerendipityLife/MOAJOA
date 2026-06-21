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

- [ ] **Phase 17: Trip Foundation & IA 재편** — 0016 마이그레이션 + core 식별자 계약 + Expo Router 여행 4탭 + 진입분기 + 일정 정해짐 경로 (비협상 기반)
- [ ] **Phase 18: Auto Plan (추출 즉시 AI 플랜)** — 추출 완료가 플랜 생성 트리거. 동선·이동시간(Routes 그라운딩)·드래그 재배치·"초안" 명시
- [ ] **Phase 19: Date Voting (일정 미정 분기)** — 날짜 투표 + 비로그인 초대 링크 + 집계→여행 일정 전환
- [ ] **Phase 20: Affiliate Booking (딥링크 제휴 예약)** — 인라인 예약 카드 + 통합 체크리스트 + SubID 어트리뷰션 + 시스템 브라우저
- [ ] **Phase 21: Travel Ledger (메일 전달 가계부)** — 전용 전달주소 + AI 메일 파싱 + 통화·환율·결제시점 보존 + 수동 fallback
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
- [ ] 17-01-PLAN.md — core foundation: vitest wiring + Trip/TripId/TripCreate Zod (board.ts→trip.ts) + TripKeys + decideEntryRoute (NAV-01/SETUP-01/02)
- [ ] 17-02-PLAN.md — affiliate contract: buildAffiliateUrl + BookingClickContext + opaque ClickToken (ATTR-01, TDD)
- [ ] 17-03-PLAN.md — 0016 squash baseline + RLS/trigger/view/join port + api trip-vocab rename + [BLOCKING] db push + types regen (SETUP-02/NAV-04)
- [ ] 17-04-PLAN.md — Expo Router 4-tab restructure + 0/1/N entry + trip header (no FAB) + share repoint + old-route delete (NAV-01/02/03/04)
- [ ] 17-05-PLAN.md — onboarding 정해짐/미정 branch + trip create UI (preset city/date range/auto-rep) + web /b/[slug]→/t/[slug] move (SETUP-01/02/NAV-04)
**UI hint**: yes

### Phase 18: Auto Plan (추출 즉시 AI 플랜)
**Goal**: 링크 추출이 끝나면 영상 속 장소로 AI 플랜 초안이 자동 생성되고, 사용자가 장소를 추가/제거/재배치하며, 일정에 이동시간이 그라운딩된다. "아하 순간"을 즉시 만든다.
**Depends on**: Phase 17 (식별자 계약 + 플랜 탭 라우팅). Phase 19와 병렬 가능
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):
  1. 추출 완료 직후 사용자 조작 없이 동선·날짜별 일정 플랜 초안이 플랜 탭에 나타난다
  2. 플랜이 "초안"으로 명시되고, 사용자가 장소를 추가/제거하고 순서를 드래그로 재배치할 수 있다
  3. '필수 장소'를 선택하면 그 주변으로 동선이 재구성된다
  4. 일정 항목 사이에 이동시간이 표시된다 (Google Routes API 그라운딩 — 좌표 없는 장소는 자동배치 제외)
  5. "친구와 같이 정하기"로 같은 플랜을 협업 투표 모드로 전환할 수 있다 (옵션)
**Plans**: TBD (~4 plans 추정: generate-plan EF[claude 클러스터링/순서 + Routes 행렬 후처리] / 플랜 데이터 모델 + 초안 상태 / plan.tsx 드래그 재배치 UI / 필수 장소 + 협업 전환 토글). Routes 비용 vs <$0.005 예산 plan-phase에서 검증
**UI hint**: yes

### Phase 19: Date Voting (일정 미정 분기)
**Goal**: 일정이 미정인 경우 날짜 투표를 만들어 초대 링크/코드로 일행을 부르고, 무설치(웹)로 투표받아, 집계된 날짜를 여행 일정으로 확정 전환한다.
**Depends on**: Phase 17 (트립 컨텍스트 + share_slug 재사용). Phase 18과 병렬 가능
**Requirements**: POLL-01, POLL-02, POLL-03
**Success Criteria** (what must be TRUE):
  1. 일정 미정 분기에서 날짜 투표를 만들고 초대 링크/코드로 일행을 부를 수 있다
  2. 초대받은 일행이 앱 설치 없이 웹에서 가능한 날짜에 투표할 수 있다
  3. 투표가 집계되어 보이고, 확정된 날짜가 해당 여행의 일정으로 전환된다
**Plans**: TBD (~3 plans 추정: date_polls/options/votes 마이그레이션 + RLS 헬퍼 / 투표 생성 + 초대 링크[share_slug + join_shared_board 재사용] / 웹 비로그인 투표 island + 집계→일정 확정)

### Phase 20: Affiliate Booking (딥링크 제휴 예약)
**Goal**: 플랜의 숙소·액티비티·교통·유심 슬롯에 맥락형 인라인 예약 카드가 뜨고, 대표가 통합 예약 체크리스트에서 한 번에 진행한다. 모든 클릭이 SubID로 어트리뷰션되고 시스템 브라우저로 열려 제휴 쿠키가 보존된다.
**Depends on**: Phase 17 (식별자 계약) + Phase 18 (플랜 슬롯). Phase 19와 병렬 가능
**Requirements**: BOOK-01, BOOK-02, BOOK-03, ATTR-02
**Success Criteria** (what must be TRUE):
  1. 플랜의 숙소/액티비티/교통/유심 슬롯에 맥락형 인라인 예약 카드(딥링크)가 표시된다
  2. 통합 '예약 체크리스트'에서 대표가 필요한 예약을 한 곳에서 진행하고 완료/미완료 상태를 본다
  3. 숙소·액티비티 비교 링크(1~2곳)가 제시된다 (실시간 가격비교 위젯은 범위 외)
  4. 예약 링크를 누르면 시스템 브라우저로 열려 제휴 쿠키가 보존되고, 클릭이 SubID로 기록된다
**Plans**: TBD (~3 plans 추정: booking-redirect EF[marker/Stay22 URL 조립 + 'clicked' 로깅] / 인라인 예약 카드 + 카테고리 매핑 / 통합 체크리스트 + 시스템 브라우저 오픈). "가격비교 범위"·어트리뷰션 실측은 plan-phase에서
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
**Plans**: TBD (~4 plans 추정: 전용주소 발급 + ledger 마이그레이션 + RLS / inbound-email EF[To 토큰 매칭 + SPF/DKIM + raw MIME] / parse-email EF[claude 재활용 + 환율 원자 저장] / ledger.tsx + 수동 fallback UI). 메일 프로바이더 충돌은 Phase 21 discuss에서 결정 (Cloudflare Email Routing vs SendGrid/Mailgun)
**UI hint**: yes

### Phase 22: Android Parity
**Goal**: 대표(결제자)가 Android일 수 있으므로 Android에서 앱이 빌드·실행되고 핵심 4단계(여행·플랜·예약·가계부)가 동작하며, Android 공유시트로 링크를 보낼 수 있다. (Expo라 재작성 아님)
**Depends on**: Phase 17~21 (전 phase 완료 — 패리티 검증 대상이 존재해야 함. SUMMARY Phase F)
**Requirements**: AND-01, AND-02
**Success Criteria** (what must be TRUE):
  1. Android 실기기에서 앱이 빌드·실행되고 핵심 흐름(여행·플랜·예약·가계부)이 동작한다
  2. Android 공유시트(ACTION_SEND)로 링크를 MOAJOA에 보낼 수 있다
**Plans**: TBD (~2 plans 추정: EAS Android 프로파일 + Maps Android 키 분리 + 빌드 / 공유 인텐트 ACTION_SEND + 실기기 QA + Play Data Safety 폼)

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Trip Foundation & IA 재편 | 0/5 | Planned | - |
| 18. Auto Plan | 0/~4 | Not started | - |
| 19. Date Voting | 0/~3 | Not started | - |
| 20. Affiliate Booking | 0/~3 | Not started | - |
| 21. Travel Ledger | 0/~4 | Not started | - |
| 22. Android Parity | 0/~2 | Not started | - |
