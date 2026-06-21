# Requirements: MOAJOA

**Defined:** 2026-05-25
**Core Value:** 링크 → 30초 안에 지도 위의 핀
**Milestone:** v1.1 (추출 고도화 + 협업) — active. v1(MVP) requirements는 아래 "## v1 Requirements"에 보존.

리서치 산출물(`.planning/research/SUMMARY.md`)에서 도출. v1은 **단독 저장 + 공개 열람** 범위. 협업·투표는 Phase 1.5.

## v1 Requirements

각 요구사항은 **observable user behavior**로 기술. roadmap phase 매핑은 하단 Traceability에서.

### Build & Tooling (BUILD)

iOS 빌드 블로커 해소 + 셸 동작. dogfooding의 prerequisite.

- [ ] **BUILD-01**: iOS 앱이 실기기(아이폰)에서 로컬·EAS 둘 중 하나로 빌드되어 실행됨
- [ ] **BUILD-02**: iOS 빌드 시 NativeWind className이 적용되어 보임 (silent failure 없음)
- [ ] **BUILD-03**: App icon · launch splash · 워드마크가 실기기 홈/스플래시에 정상 표시됨

### Save Flow (SAVE) — iOS 핵심 입력

링크 → 핀의 흐름이 카톡·사파리에서 완결되어야 dogfooding 성립.

- [x] **SAVE-01**: iOS 로그인 → 보드 목록 → 보드 상세까지 실기기에서 막힘 없이 진입됨
- [x] **SAVE-02**: 보드 상세에서 YouTube URL을 붙여 넣으면 30초 안에 핀이 지도에 나타남 (p90) — code complete (03-05: broadcast subscribe + spinner overlay + done/error toast + mapErrorReason); p90 timing via Phase 6 SQL aggregate (D-11)
- [x] **SAVE-03**: 카톡/사파리 공유 시트에서 MOAJOA를 선택하면 보드 선택 화면이 뜨고, "마지막 사용 보드"가 default로 들어와 1탭에 저장됨 — code complete (03-02 + 03-05 last_board_id mirror); real-device share-sheet UAT deferred
- [x] **SAVE-04**: Share Extension 저장이 오프라인일 때 enqueue되고, 메인 앱 launch 시 자동 drain됨
- [x] **SAVE-05**: 사용자가 핀을 수동으로 추가·편집·삭제할 수 있음 (장소 검색은 google_place_id resolve로 처리) — code complete (03-03 backend + 03-05 PinAddModal D-07/D-08 + PinBottomSheet D-09 rename/delete actions)

### Extraction Pipeline (EXTRACT) — Backend

추출 정확도·신뢰도·비용을 측정 가능한 수준으로.

- [x] **EXTRACT-01**: Edge Function이 추출 단계별 진행 상태를 Supabase Realtime Broadcast 채널 `extract:{link_id}`로 송신 (metadata/transcript/llm/places/done)
- [x] **EXTRACT-02**: Claude 응답의 모든 place 후보는 `transcript_quote` 필드 포함이 필수이며, 없으면 폐기됨
- [x] **EXTRACT-03**: 각 place 행에 `source_kind` (ai/manual), `video_offset_sec`, `quote`, `inferred_city` 컬럼이 저장됨
- [x] **EXTRACT-04**: 모든 추출 호출이 `extraction_costs` 테이블에 (provider, model, tokens, cost_usd, duration_ms)로 로깅됨
- [x] **EXTRACT-05**: Google Places API 호출이 명시적 FieldMask(`places.id,places.displayName,places.formattedAddress,places.location`)만 사용 (와일드카드 금지)
- [x] **EXTRACT-06**: Google Cloud billing alert가 $5/$20/$50 threshold로 셋업되어 있음
- [ ] **EXTRACT-07**: sample 영상 10~20개에 대한 expected/actual 비교 baseline 측정 결과가 문서화됨 (개선은 v2)

### Public Board Viewing (VIEW) — Web

카톡 공유 → 비로그인 SSR 열람 = 핵심 acquisition.

- [ ] **VIEW-01**: 공개 보드 URL(`/b/[slug]`)이 비로그인 상태에서 SSR로 즉시 렌더링됨 (p90 TTFB < 800ms)
- [ ] **VIEW-02**: 공개 보드 페이지가 모바일(iPhone Safari) viewport에서 정상 사용 가능 (지도 핀치줌, 핀 탭 동작)
- [x] **VIEW-03**: `/b/[slug]/opengraph-image`가 보드 제목 + 미니맵(Static Maps) + Pretendard 한글 폰트로 동적 생성됨
- [ ] **VIEW-04**: 보드 페이지의 `<head>`에 보드 제목·도시·핀 수 기반 SEO meta(title, description, og:*, twitter:*) 포함
- [ ] **VIEW-05**: 핀을 탭하면 해당 영상이 정확한 타임스탬프(`?t=Xs`)로 열림
- [x] **VIEW-06**: 추출이 완료되면 보드 페이지가 자동으로 갱신됨 (Edge Function → `/api/revalidate?slug=...` webhook → `revalidateTag`) — 04-02 (2026-05-26)

### Trust UI (TRUST) — Cross-platform

AI 추출 결과를 사용자가 믿을 수 있어야 dogfooding 성립.

- [ ] **TRUST-01**: AI가 추출한 핀과 사용자가 수동으로 추가한 핀이 시각적으로 구분됨 (점선·실선, 아이콘 색)
- [x] **TRUST-02**: 추출 진행 중인 링크에 진행 단계가 UI에 표시됨 (`extract:{link_id}` 구독)
- [x] **TRUST-03**: 추출 실패 시 사유가 노출되고 1탭 retry 가능
- [ ] **TRUST-04**: `confidence < 0.7`인 핀은 시각적으로 약하게(low_confidence) 표시되고 사용자가 명시적으로 confirm 또는 reject 가능

### Onboarding (ONBOARD)

첫 인상 lock. 첫 보드 없이 빈 상태 피하기.

- [ ] **ONBOARD-01**: 신규 가입자에게 첫 로그인 시 "내 첫 여행" 보드가 자동 생성됨
- [x] **ONBOARD-02**: 첫 진입 시 "유튜브 링크를 붙여넣어 보세요" 안내 카드가 보드 상세에 1회 표시됨

### Web Hygiene (WEB)

웹의 역할을 "열람 + 공유 랜딩"으로 고정. dev tool은 격리.

- [ ] **WEB-01**: 현재 Web에 있는 "보드 생성·링크 추가" 폼이 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`일 때만 노출됨
- [ ] **WEB-02**: 공개 환경(`NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정)에서 web의 1차 진입은 `/b/[slug]` 또는 로그인 페이지에 한정됨

## v1.1 Requirements (Active Milestone — 추출 고도화 + 협업)

**Defined:** 2026-06-07. 근거: `docs/SESSION-NOTES-2026-06-07.md`. 순서 ② → ① → 투표. 자세한 phase 매핑은 하단 Traceability.

### Extraction Depth (EXTRACT) — ② 추출 깊이

자막·설명 근거 기반 "사람이 읽는 해설"을 출력 계약에 추가. 단일 Claude 호출 확장(새 호출/레이턴시 X). 반환각 규칙 유지.

- [ ] **EXTRACT-12**: 추출된 각 장소에 자막·설명 근거 범위 내 1~2문장 한국어 해설(`places.summary_ko`)이 생성됨 (근거 없으면 짧거나 비움, 환각 금지)
- [ ] **EXTRACT-13**: 각 영상(link)에 2~3문장 한국어 TL;DR 요약(`links.summary_ko`)이 생성됨
- [ ] **EXTRACT-14**: 해설/요약 생성 실패가 장소 추출 자체를 실패시키지 않음 (누락 시 NULL 저장, 기존 confidence 필터·source_quote 필수 유지)

### Depth Exposure (VIEW) — 해설 노출

- [ ] **VIEW-08**: 공개 보드(web)에서 장소 해설(`summary_ko`)과 영상 요약이 노출되며, 값이 없는 레거시 데이터에서도 레이아웃이 깨지지 않음 (조건부 렌더)

### Source Breadth (SRC) — ① 소스 넓이

유튜브 외 소스로 입구 확장. ②의 출력 계약(장소+해설) 재사용. (기존 v2 EXTRACT-10 manual-queue와 구분 — v1.1은 자동 추출)

- [ ] **SRC-01**: 블로그(네이버/티스토리 등) URL을 던지면 본문 텍스트를 추출해 동일 파이프라인으로 장소+해설을 생성함
- [ ] **SRC-02**: 인스타그램 게시물 URL을 던지면 캡션/본문에서 장소+해설을 생성함 (추출 불가 소스는 명시적 실패 사유 반환)

### Web Collaboration (COLLAB) — 웹 투표

웹 = 조회+공유+투표. 초대받은 친구 무설치 참여. (v2-defer에서 v1.1로 승격)

- [ ] **COLLAB-01**: 공유 보드 링크(slug)로 들어온 사용자가 멤버로 참여(수락)할 수 있음
- [ ] **COLLAB-02**: 멤버가 웹에서 핀에 ❤️ 투표할 수 있고, love/총멤버 ≥ 0.5인 핀이 "확정"으로 필터됨

## v2 Requirements (defer)

- **EXTRACT-08**: 추출 정확도 evaluation 데이터셋 정형화 + 회귀 측정
- **EXTRACT-09**: LLM 프롬프트 자동 튜닝 (eval 기반)
- **EXTRACT-10**: 블로그·인스타 manual extraction queue (운영진 어드민)
- **EXTRACT-11**: `resolve-place` Edge Function 도입 (`add_manual_place` placeholder deprecate)
- **VIEW-07**: `/discover` 공개 보드 탐색 피드
- **AUTH-05**: Google OAuth 완료
- **AUTH-06**: Apple Sign In
- **I18N-01**: UI 다국어 (next-intl + expo-localization)
- **THEME-01**: 다크 모드 토큰 매핑
- **OBS-01**: Sentry/PostHog 에러 트래킹
- **CI-01**: GitHub Actions (typecheck + lint)
- **SMTP-01**: Resend custom SMTP (매직 링크 deliverability)

## Out of Scope (v1·v2 모두 X)

scope creep 방지용 명시 차단 목록.

| Feature | Reason |
|---------|--------|
| Day-by-day itinerary builder | 모든 여행 plan 앱이 빠지는 함정. Core Value(자동 추출)을 희석 |
| 항공·숙박·결제 통합 | 단일 도구 시장 (Skyscanner/Booking) 강자 존재. 차별 불가 |
| AI 챗봇 인터페이스 | "링크 한 번에 핀" 패러다임과 직접 충돌. confident-wrong risk 가중 |
| 자동 일정 최적화 (TSP) | 사용자가 핀 자체를 이미 신뢰 못 하는 단계. premature optimization |
| 소셜 피드·팔로우·좋아요 | 협업 보드(v2)와 별개의 큰 surface. 본 도구 정체성 흐림 |
| 댓글 스레드 | 협업은 ❤️ 투표(v2)로만. 댓글은 분쟁 surface 추가 |
| Push notification | dogfooding 단계에선 무가치. Apple Push 인프라 + permission 피로 |
| Flutter 코드 참조·재사용 | `_archive_asis/`는 영구 archive. 새 스택으로 통일 |
| Firebase·Firestore 재도입 | 피봇 결정 (RLS+PostGIS+Realtime+비용 모두 우위) |

## Traceability

Roadmap (2026-05-25)에서 매핑됨. 자세한 phase 정의는 `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Pending |
| BUILD-02 | Phase 1 | Pending |
| BUILD-03 | Phase 1 | Pending |
| WEB-01 | Phase 1 | Pending |
| WEB-02 | Phase 1 | Pending |
| EXTRACT-01 | Phase 2 | Complete |
| EXTRACT-02 | Phase 2 | Complete |
| EXTRACT-03 | Phase 2 | Complete |
| EXTRACT-04 | Phase 2 | Complete |
| EXTRACT-05 | Phase 2 | Complete |
| EXTRACT-06 | Phase 2 | Complete |
| SAVE-01 | Phase 3 | Complete (03-04 — auth gate + login UI-SPEC §6; real-device verification deferred to end-of-phase UAT) |
| SAVE-02 | Phase 3 | Code complete (03-05 broadcast subscribe + spinner overlay + done/error toast); p90 timing via Phase 6 SQL aggregate (D-11) |
| SAVE-03 | Phase 3 | Code complete (03-02 Share Extension config + 03-05 last_board_id mirror); real-device share-sheet UAT deferred to end-of-phase batch |
| SAVE-04 | Phase 3 | Complete (03-01 nullable migration + 03-02 App Group entitlement + 03-04 drainPendingLinks + banner; native build smoke deferred to end-of-phase UAT) |
| SAVE-05 | Phase 3 | Code complete (03-03 backend + 03-05 PinAddModal D-07/D-08 + PinBottomSheet D-09 rename/delete) |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Code complete (04-04, 2026-05-26 — Pretendard KS X 1001 woff2 subset 317KB combined < 500KB ImageResponse limit + opengraph-image.tsx nodejs runtime + Static Maps grayscale embed + 3중 fallback; Kakao share preview UAT deferred to end-of-phase batch) |
| VIEW-04 | Phase 4 | Pending |
| VIEW-05 | Phase 4 | Pending |
| VIEW-06 | Phase 4 | Complete (04-02, 2026-05-26) |
| TRUST-01 | Phase 5 | Pending |
| TRUST-02 | Phase 5 | Complete (05-02, 2026-05-26) |
| TRUST-03 | Phase 5 | Complete (05-03, 2026-05-26) |
| TRUST-04 | Phase 5 | Pending |
| ONBOARD-01 | Phase 5 | Pending |
| ONBOARD-02 | Phase 5 | Complete (2026-05-26, 05-06) |
| EXTRACT-07 | Phase 6 | Pending |

### v1.1 Traceability (Milestone v1.1 — 추출 고도화 + 협업)

Roadmap (2026-06-07)에서 매핑됨. 자세한 phase 정의는 `.planning/ROADMAP.md` "# Milestone v1.1".

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTRACT-12 | Phase 8 | Code complete (waves 1-2; 라이브 @ 08-04) |
| EXTRACT-13 | Phase 8 | Code complete (waves 1-2; 라이브 @ 08-04) |
| EXTRACT-14 | Phase 8 | Code complete (waves 1-2; 라이브 @ 08-04) |
| VIEW-08 | Phase 8 | Code complete (waves 1-2; 라이브 @ 08-04) |
| SRC-01 | Phase 9 | Code complete (blog 자동·IG graceful; 라이브 @ 09-05) |
| SRC-02 | Phase 9 | Code complete (blog 자동·IG graceful; 라이브 @ 09-05) |
| COLLAB-01 | Phase 10 | Code complete (backend+web island; 라이브 @ 10-03) |
| COLLAB-02 | Phase 10 | Code complete (backend+web island; 라이브 @ 10-03) |

**Coverage:**
- v1 requirements: 29 total → mapped to phases 1~6: 29 ✓
- v1.1 requirements: 8 total → mapped to phases 8~10: 8 ✓
- Unmapped: 0
- Duplicate mappings: 0

## Dogfooding Gate

Phase 6 완료 조건 (Karpathy goal-driven execution):

> **본인이 일본 또는 서울 여행 계획에 MOAJOA를 7일 연속 사용했고, 보드에 10개 이상의 핀이 추출·확정되었으며, 친구에게 그 보드 URL을 카톡으로 공유했을 때 모바일 브라우저에서 정상 열림.**

이 게이트 전엔 Phase 1.5 (협업·투표) 코드 X.

---

## v2.0 Requirements — 전면 개편 (발견→예약→정산)

**Defined:** 2026-06-21 · 출처: `.planning/research/SUMMARY.md` + `docs/PRODUCT.md`. 신규 카테고리(REQ-ID 충돌 없음). MVP 범위. 각 항목은 observable behavior. phase 매핑은 v2.0 roadmap 생성 후 하단 Traceability에.

### Navigation & IA (NAV)

- [x] **NAV-01**: 앱 진입 시 여행이 1개면 목록 없이 그 여행으로 바로 들어간다 (0개→온보딩, 2개+→마지막 본 여행)
- [ ] **NAV-02**: 여행 안에서 하단 탭(지도·플랜·예약·가계부)으로 단계를 전환하며, 탭바가 항상 보인다
- [ ] **NAV-03**: 새 여행·여행 전환·내 정보를 헤더에서 접근한다 (새 여행은 별도 탭이 아니라 온보딩/여행 종료 후/헤더 +)
- [ ] **NAV-04**: 재편 이후에도 기존 공유 링크(웹 `/b/[slug]`, 보드 딥링크)가 깨지지 않고 열린다

### Attribution & 수익 계약 (ATTR)

- [ ] **ATTR-01**: 모든 예약 딥링크가 trip(가능하면 place) 컨텍스트를 담은 SubID로 생성되어, 전환이 어느 여행/장소에서 났는지 식별된다
- [ ] **ATTR-02**: 예약 링크는 시스템 브라우저로 열려 제휴 쿠키가 보존된다 (인앱 WebView 격리 회피)

### Trip Setup & Date Voting (SETUP)

- [x] **SETUP-01**: 새 여행 시작 시 "일정 정해졌나요?" 분기에서, 정해졌으면 날짜·도시를 바로 입력해 여행을 만든다
- [x] **SETUP-02**: 여행에 대표(결제자)가 지정된다
- [ ] **POLL-01**: 일정 미정이면 날짜 투표를 만들어 초대 링크/코드로 일행을 부른다
- [ ] **POLL-02**: 초대받은 일행이 무설치(웹)로 가능한 날짜에 투표한다
- [ ] **POLL-03**: 투표가 집계되어 확정된 날짜가 여행 일정으로 전환된다

### Auto Plan (PLAN)

- [ ] **PLAN-01**: 링크 추출이 끝나면 영상 속 장소로 AI 플랜(동선·날짜별 일정) 초안이 자동 생성된다
- [ ] **PLAN-02**: 플랜은 "초안"으로 명시되고, 사용자가 장소를 추가/제거/재배치할 수 있다
- [ ] **PLAN-03**: '필수 장소'를 선택하면 그 주변으로 동선이 구성된다
- [ ] **PLAN-04**: 일정 항목에 이동시간이 표시된다 (Routes 그라운딩)
- [ ] **PLAN-05**: "친구와 같이 정하기"로 같은 플랜을 협업 투표 모드로 전환한다 (옵션)

### Booking (BOOK)

- [ ] **BOOK-01**: 플랜의 숙소/액티비티/교통/유심 슬롯에 맥락형 인라인 예약 카드(딥링크)가 표시된다
- [ ] **BOOK-02**: 통합 '예약 체크리스트'에서 대표가 필요한 예약을 한 곳에서 진행하고 완료/미완료 상태를 본다
- [ ] **BOOK-03**: 숙소·액티비티 비교 링크(1~2곳)를 제시한다 (실시간 가격비교 위젯은 범위 외)

### Ledger / 가계부 (LEDGER)

- [ ] **LEDGER-01**: 각 사용자에게 개인 전용 전달 주소가 발급된다
- [ ] **LEDGER-02**: 예약 메일을 전달하면 AI가 파싱해 가계부에 자동 정리된다 (플랫폼·카드·통화·금액·결제일)
- [ ] **LEDGER-03**: 외화 결제는 통화·환율·결제 시점이 보존되어 환율 차이를 확인할 수 있다
- [ ] **LEDGER-04**: 앱을 거치지 않은 예약(직접 예약 항공권 등)도 메일만 오면 가계부에 포착된다
- [ ] **LEDGER-05**: 등록된 주소에서 온 메일만 수신·처리한다 (식별·보안)
- [ ] **LEDGER-06**: 파싱이 애매하면 사용자가 1탭으로 확인·수정한다 (fallback)

### Android (AND)

- [ ] **AND-01**: Android에서 앱이 빌드·실행되고 핵심 흐름(여행·플랜·예약·가계부)이 동작한다
- [ ] **AND-02**: Android 공유시트(ACTION_SEND)로 링크를 MOAJOA에 보낼 수 있다

## v2.0 Future Requirements (deferred)

- 여행 당일 실시간 레이어 (항공 게이트·지연·수하물, 공항 주차 혼잡도) — phase 2 프리미엄
- 실시간 가격비교 위젯 (검색 API) — 트래픽 확보 후
- 로컬 상점 광고 · 데이터 라이선싱 — 장기
- 프리미엄 구독 과금 — 실시간 레이어와 함께

## v2.0 Out of Scope (명시 제외)

- **방문 인증(GPS·영수증)** — 제거. 신뢰 근거는 실제 예약·결제(가계부) 데이터로 대체
- **인앱 네이티브 결제(MOR)** — 딥링크 제휴로 충분. OTA 전환은 장기
- **별칭 투표 시스템 · 포인트/레벨/리워드 · 장소 리뷰 시스템** — 보류 (자동 추출·보드가 가치)

## v2.0 Traceability

Roadmap (2026-06-21)에서 매핑됨. 자세한 phase 정의는 `.planning/ROADMAP.md` "## Milestone v2.0". Phase 번호는 기존 마지막(Phase 16)에서 이어감.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 17 | Complete |
| NAV-02 | Phase 17 | Pending |
| NAV-03 | Phase 17 | Pending |
| NAV-04 | Phase 17 | Pending |
| ATTR-01 | Phase 17 | Pending |
| SETUP-01 | Phase 17 | Complete |
| SETUP-02 | Phase 17 | Complete |
| PLAN-01 | Phase 18 | Pending |
| PLAN-02 | Phase 18 | Pending |
| PLAN-03 | Phase 18 | Pending |
| PLAN-04 | Phase 18 | Pending |
| PLAN-05 | Phase 18 | Pending |
| POLL-01 | Phase 19 | Pending |
| POLL-02 | Phase 19 | Pending |
| POLL-03 | Phase 19 | Pending |
| BOOK-01 | Phase 20 | Pending |
| BOOK-02 | Phase 20 | Pending |
| BOOK-03 | Phase 20 | Pending |
| ATTR-02 | Phase 20 | Pending |
| LEDGER-01 | Phase 21 | Pending |
| LEDGER-02 | Phase 21 | Pending |
| LEDGER-03 | Phase 21 | Pending |
| LEDGER-04 | Phase 21 | Pending |
| LEDGER-05 | Phase 21 | Pending |
| LEDGER-06 | Phase 21 | Pending |
| AND-01 | Phase 22 | Pending |
| AND-02 | Phase 22 | Pending |

**Coverage:**
- v2.0 requirements: 27 total → mapped to phases 17~22: 27 ✓
- Unmapped: 0
- Duplicate mappings: 0

**Phase별 매핑 요약:**
- Phase 17 (Trip Foundation & IA): NAV-01..04, ATTR-01, SETUP-01/02 — 7
- Phase 18 (Auto Plan): PLAN-01..05 — 5
- Phase 19 (Date Voting): POLL-01..03 — 3
- Phase 20 (Affiliate Booking): BOOK-01..03, ATTR-02 — 4
- Phase 21 (Travel Ledger): LEDGER-01..06 — 6
- Phase 22 (Android Parity): AND-01/02 — 2

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-06-21 — v2.0 roadmap 생성 (Phase 17~22) + v2.0 Traceability 채움 (27 reqs, 100% coverage, 중복 0). 이전: 2026-06-07 v1.1*
