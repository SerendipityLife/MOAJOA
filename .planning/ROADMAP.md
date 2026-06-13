# Roadmap: MOAJOA v1 (MVP — self-dogfooding 가능선)

**Created:** 2026-05-25
**Milestone:** v1
**Core Value:** 링크 → 30초 안에 지도 위의 핀
**Granularity:** standard (5-8 phases) → **6 phases**
**Requirements covered:** 29/29 ✓

---

## Phase 결정 근거 요약

Architecture 리서치는 A→B(병렬 3트랙)→C(병렬 2트랙)→D 4 phase를 제안했다. 그러나:

1. **Granularity = standard** → 5~8 phase 권장. 4 phase는 너무 coarse (각 phase가 너무 큼)
2. **2인 팀 × 5 워크스트림 (iOS / Web / Backend / Design / Auth)** → 동시 2개 phase가 한 사람씩 맡을 수 있는 단위로 잘게 쪼개야 진행 추적이 됨
3. **파일 경계가 거의 겹치지 않게 설계됨** (WORKSTREAMS.md) → workstream 단위로 phase를 끊으면 cross-track 충돌 최소
4. **B 트랙들 (B1 iOS / B2 Backend / B3 Web)을 분리하면** 각 트랙이 독립적으로 시작·완료·verify 가능

따라서 Architecture의 "Phase B 3트랙 병렬"을 **Phase 2(Backend) / Phase 3(iOS save) / Phase 4(Web public)** 3개 phase로 펼친다. 의존 그래프가 직렬이 아니라 fork-join이므로, 1 완료 후 2/3/4는 어느 순서로든 가능 (단 5는 2,3 둘 다 필요).

## Phases

- [x] **Phase 1: Build Unblock & Hygiene** — iOS 빌드 통과 + NativeWind silent failure 차단 + app icon/splash + web dev tool 격리 (completed 2026-05-25; 01-04 EAS fallback not needed — Path A succeeded)
- [x] **Phase 2: Extraction Pipeline Hardening** — Realtime progress + cost logging + LLM citation + Places FieldMask + billing alert (completed 2026-05-25)
- [ ] **Phase 3: iOS Save Flow** — 로그인→보드→링크→핀 e2e + Share Extension + 수동 핀
- [~] **Phase 4: Public Board (Web)** — SSR 캐싱 + revalidate webhook + OG 이미지 + SEO + 모바일 + 타임스탬프 jump (code-complete 4/4; real-browser UAT deferred to end-of-phase batch)
- [x] **Phase 5: Trust UI & Onboarding** — AI vs 수동 시각 구분 + 진행상태 UI + 실패 retry + low_confidence + 첫 보드 자동 + 안내 카드 (code-complete 6/6 — live device UAT deferred to end-of-phase batch)
- [ ] **Phase 6: Dogfooding Gate** — 추출 정확도 baseline (sample 10~20개) + 7일 본인 여행 실사용 증명

---

## Phase Details

### Phase 1: Build Unblock & Hygiene

**Goal:** iOS 실기기에서 앱이 정상 빌드·실행되고, 빌드 후 NativeWind className이 적용되며, web의 dev tool은 운영 환경에서 숨겨진다.
**Depends on:** Nothing (foundation)
**Why first:** iOS 빌드 블로커가 풀려야 Phase 3·5의 모든 iOS 작업이 검증 가능. NativeWind 4.2 silent failure는 빌드 디버깅과 섞이면 시간이 2배. Web dev tool 격리는 dogfooding 중 친구에게 web URL 보낼 때 혼란 방지 — 코드 1줄 수준이라 같이 묶음.
**Requirements:** BUILD-01, BUILD-02, BUILD-03, WEB-01, WEB-02
**Owners:** iOS (BUILD-01, BUILD-02), Design (BUILD-03), Web (WEB-01, WEB-02)
**Success Criteria** (what must be TRUE):
  1. iOS 앱이 실기기(아이폰)에서 로컬 또는 EAS 빌드로 실행되어 첫 화면이 뜬다
  2. iOS 첫 화면의 NativeWind `className` 스타일(색·간격·타이포)이 실기기에서 시각적으로 적용되어 보인다 (silent failure 없음)
  3. iOS 빌드 시도가 4시간을 넘기면 즉시 EAS Build로 전환된 기록이 남는다 (Pitfall 6 시간박스 검증)
  4. 실기기 홈/스플래시에 MOAJOA app icon · launch splash · 워드마크가 default Expo 아이콘이 아닌 실제 자산으로 표시된다
  5. `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정 상태로 web을 띄우면 "보드 생성"·"링크 추가" 폼이 보이지 않고, 1차 진입은 `/b/[slug]` 또는 로그인 페이지에만 한정된다
**Plans:** 4 plans
  - [x] 01-01-PLAN.md — Brand asset SVG sources + sharp export script + Pretendard 폰트 (iOS+Web) + pnpm hoist scope + NativeWind 4.2 upgrade [BUILD-03] (2026-05-25)
  - [x] 01-02-PLAN.md — app.config.ts wire-up (icon/splash/expo-font) + NativeWind smoke screen + Path A 실기기 빌드 + SESSION-NOTES timeline [BUILD-01/02/03] (2026-05-25, Path A 14min prebuild + smoke screen visually verified)
  - [x] 01-03-PLAN.md — next/font/local Pretendard + lib/env.ts + dev-tool 이중 게이트 (page redirect + component null) [WEB-01/02 + BUILD-03 web] (2026-05-25, V6 curl 307 + V2 build + Pretendard `<html class="__variable_*">` confirmed)
  - [~] 01-04-PLAN.md — (조건부, **N/A**) EAS Build development profile fallback — 01-02 Path A가 14분만에 성공해서 EAS 전환 불필요. Phase 3+ 단계에서 EAS가 필요해지면 그때 plan 재활성화. [BUILD-01/03]
**UI hint:** yes

---

### Phase 2: Extraction Pipeline Hardening

**Goal:** Edge Function이 진행 상태를 broadcast하고, 모든 호출의 비용이 로깅되며, LLM이 만들어낸 가짜 장소(citation 없는 후보)는 폐기되고, Places API 비용 폭주를 막는 방어선이 셋업된다.
**Depends on:** Nothing (backend 독립 — Phase 1과 병렬 가능)
**Why now:** Phase 3 (iOS save flow)에서 사용자가 링크를 보냈을 때 "되고 있긴 한가" 확인하려면 Realtime broadcast가 먼저 있어야 함. Phase 5 (trust UI)에서 "AI vs 수동" 구분과 low_confidence 표시는 `source_kind`/`confidence`/`quote` 컬럼이 먼저 있어야 함. Pitfall 2(FieldMask)·3(citation)·4(RLS)·5(비용)은 비용 없는 방어선이라 일찍 굳히는 게 회복비용 최소.
**Requirements:** EXTRACT-01, EXTRACT-02, EXTRACT-03, EXTRACT-04, EXTRACT-05, EXTRACT-06
**Owners:** Backend
**Success Criteria** (what must be TRUE):
  1. 링크 추출 중 클라이언트가 `extract:{link_id}` Realtime 채널을 구독하면 5개 단계(metadata/transcript/llm/places/done) 메시지를 순서대로 수신한다
  2. Claude 응답에서 `transcript_quote` 없는 place 후보는 모두 폐기되고 DB에 저장되지 않는다 (Pitfall 1 citation 강제)
  3. 모든 추출 호출이 `extraction_costs` 테이블에 `(provider, model, tokens, cost_usd, duration_ms)` 행으로 남아 영상당 평균/p95 비용을 SQL 한 번으로 집계할 수 있다
  4. Google Places API 호출이 명시적 FieldMask(`places.id,places.displayName,places.formattedAddress,places.location`)만 사용하고, 와일드카드 호출이 grep으로 발견되지 않는다 (Pitfall 2)
  5. Google Cloud billing alert가 $5/$20/$50 threshold에서 활성화되어 있고, 발송 테스트 메일이 수신되었다 (Pitfall 5)
  6. `places` 테이블에 `source_kind`(ai/manual), `video_offset_sec`, `quote`, `inferred_city` 컬럼이 존재하고, 신규 추출 결과가 4개 모두 채워서 저장된다
**Plans:** 3/3 plans complete
  - [x] 02-01-PLAN.md — Migration 0004 (extraction_costs table + places columns) + shared constants + FieldMask verification [EXTRACT-03/04/05]
  - [x] 02-02-PLAN.md — Edge Function hardening: broadcast, citation filter, cost logging, source_kind/inferred_city wiring [EXTRACT-01/02/04]
  - [x] 02-03-PLAN.md — Schema push + type regeneration + GCP billing alert setup [EXTRACT-06]

---

### Phase 3: iOS Save Flow

**Goal:** 사용자가 iOS 실기기에서 로그인→보드 목록→보드 상세→링크 붙여넣기로 핀을 띄울 수 있고, 카톡/사파리 공유 시트에서 URL을 받아 1탭에 저장할 수 있으며, 오프라인 저장이 손실되지 않는다.
**Depends on:** Phase 1 (iOS 빌드), Phase 2 (Realtime broadcast — 추출 progress UI 토대로 사용)
**Why now:** dogfooding의 입력 경로 #1. 빌드(P1)와 추출 observability(P2)가 둘 다 있어야 Share Extension UX가 "묵묵부답" 없이 동작. 수동 핀 추가는 영상에 없는 호텔/공항을 위해 필수.
**Requirements:** SAVE-01, SAVE-02, SAVE-03, SAVE-04, SAVE-05
**Owners:** iOS
**Success Criteria** (what must be TRUE):
  1. 사용자가 실기기에서 로그인 → 보드 목록 → 보드 상세까지 막힘 없이 진입한다
  2. 보드 상세에서 YouTube URL을 붙여 넣으면 30초 이내(p90)에 핀이 지도에 나타난다
  3. 카톡/사파리 공유 시트에서 MOAJOA를 선택하면 "마지막 사용 보드"가 default로 들어와 1탭에 저장된다
  4. Share Extension 시도 중 비행기 모드면 URL이 App Group SharedDefaults에 enqueue되고, 메인 앱 launch 시 자동으로 drain되어 추출이 트리거된다
  5. 사용자가 핀을 수동으로 추가·편집·삭제할 수 있고, 추가 시 좌표는 서버 측 `resolve-place` 흐름으로 검증된 google_place_id를 통해서만 들어간다
**Plans:** 5 plans (5/5 complete — real-device UAT deferred to end-of-phase batch)
  - [x] 03-01-PLAN.md — Migration 0005 (extraction_costs.link_id nullable) + packages/core APP_GROUP_ID + SharedDefaultsKeys + extractChannelName + jest-expo test infra + docs/manual-uat-phase3.md [SAVE-04, SAVE-05] (2026-05-26)
  - [x] 03-02-PLAN.md — expo-share-intent@^5.1.1 (SDK 54 호환 라인; PLAN의 ^6.1.1은 SDK 55 요구로 자동 보정) + app.config.ts plugin + App Group entitlement + EAS appExtensions + eas.json 신규. Prebuild + real-device share-sheet smoke test deferred to end-of-phase UAT (auto mode). [SAVE-03, SAVE-04] (2026-05-26)
  - [x] 03-03-PLAN.md — resolve-place Edge Function (FIELD_MASK 5 fields, max 5 results, extraction_costs link_id=null) + Zod ResolvePlace schemas + renamePlace/deletePlace helpers. Deploy + live curl smoke deferred to user-side UAT. [SAVE-05] (2026-05-26)
  - [x] 03-04-PLAN.md — SharedDefaults Swift module (Expo Module API) + lib/pending.ts drainPendingLinks state machine (D-04/D-05/D-06) + lib/shared-defaults TS bridge + lib/realtime.ts subscribeExtractProgress + lib/toast.tsx single-instance host + AppState dual-trigger drain in _layout.tsx + auth gate restore (index.tsx D-13 + login.tsx UI-SPEC §6) + failed-banner in boards.tsx (UI-SPEC §5). TDD: 6/6 unit tests pass. Native build smoke deferred to end-of-phase UAT (pattern from 03-02). [SAVE-01, SAVE-04] (2026-05-26)
  - [x] 03-05-PLAN.md — @gorhom/bottom-sheet@^5.2.14 + boards/[id].tsx integration (broadcast subscribe with removeChannel cleanup + spinner overlay + + 핀 button + last_board_id mirror) + PinBottomSheet (D-09 single sheet, snap 25%/50%, link_id signal for AI/manual) + PinAddModal (D-07/D-08 300ms debounce → resolve-place → max 5) + realtime.test.ts 3/3 PASS. Real-device UAT + N2 SQL RLS test deferred to end-of-phase batch. [SAVE-01, SAVE-02, SAVE-03, SAVE-04, SAVE-05] (2026-05-26)
**UI hint:** yes

---

### Phase 4: Public Board (Web)

**Goal:** 비로그인 사용자가 카톡으로 받은 `/b/[slug]` URL을 모바일 브라우저에서 즉시 열람할 수 있고, 카톡 미리보기에 보드 제목·미니맵 OG 카드가 뜨며, 핀을 탭하면 영상 정확한 타임스탬프로 이동한다.
**Depends on:** Phase 2 (Edge Function에서 `/api/revalidate` webhook 호출하려면 추출 pipeline refactor 완료 필요)
**Why now:** 공유 = acquisition. iOS만 있고 web이 모바일에서 깨지면 친구한테 보여줄 수 없음 = dogfooding 한 면이 안 굴러감. Phase 3와 병렬 가능 (파일 경계 `apps/web/**`로 완전 격리).
**Requirements:** VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06
**Owners:** Web
**Success Criteria** (what must be TRUE):
  1. 공개 보드 URL을 비로그인 상태로 열면 SSR로 즉시 렌더링되고 (p90 TTFB < 800ms), Vercel Edge Cache hit 비율이 두 번째 요청부터 측정 가능하다
  2. iPhone Safari viewport에서 보드 페이지가 정상 사용된다 (지도 핀치줌·핀 탭 동작, 가로 스크롤 없음)
  3. 보드 페이지를 카톡 채팅창에 붙여 넣으면 OG 카드에 보드 제목 + 미니맵 썸네일(Pretendard 한글) + 핀 수가 표시된다
  4. 보드 페이지 `<head>`에 보드 제목·도시·핀 수 기반 SEO meta(title, description, og:*, twitter:*)가 포함된다
  5. 핀을 탭하면 해당 YouTube 영상이 정확한 타임스탬프(`?t=Xs`)로 새 탭에서 열린다
  6. Edge Function 추출 완료 시 `/api/revalidate?slug=...` webhook이 호출되어 보드 페이지가 자동으로 갱신된다
**Plans:** 4 plans
  - [x] 04-01-PLAN.md — Vitest + jsdom infra + lib/youtube.ts (extract+buildWatchUrl TDD) + lib/og/static-maps.ts (URL builder TDD) + lib/cache.ts (BOARD_REVALIDATE_TAG + getCachedPublicBoard) + lib/env.ts extension (REVALIDATE_SECRET/BASE_URL/MAPS_KEY) + packages/core CITY_KO_MAP [VIEW-03, VIEW-05] (Wave 1) ✓ 2026-05-26
  - [x] 04-02-PLAN.md — /api/revalidate Node-runtime route (zod + node:crypto timingSafeEqual + revalidateTag) + cache-key isolation guard test + extract-youtube Edge Function fire-and-forget webhook after done broadcast [VIEW-01, VIEW-06] (Wave 2, depends 04-01) (2026-05-26)
  - [x] 04-03-PLAN.md — layout.tsx viewport (maximumScale:5) + metadataBase + /b/[slug]/page.tsx SSR rewrite (getCachedPublicBoard + generateMetadata template + UI-SPEC reassignment) + PublicBoardMap gestureHandling + pin click YouTube + not-found.tsx + error.tsx + metadata/map-options tests [VIEW-01, VIEW-02, VIEW-04, VIEW-05] (Wave 2, depends 04-01) ✓ 2026-05-26 (UAT deferred to end-of-phase batch)
  - [x] 04-04-PLAN.md — Pretendard Korean-subset woff2 (KS X 1001 fontTools.subset; Regular 156KB + SemiBold 160KB = 317KB combined < 500KB ImageResponse limit) + opengraph-image.tsx (1200×630 ImageResponse, Pretendard ArrayBuffer fonts, 좌측 텍스트 stack + 우측 Static Maps grayscale embed, 3중 fallback view-null/key-missing/places-empty) + lib/og/pretendard.ts (모듈 캐시 fs.readFile loader) + og-image.test.ts 4 smoke tests [VIEW-03] (Wave 3, depends 04-01 + 04-03) ✓ 2026-05-26 (UAT deferred to end-of-phase batch)
**UI hint:** yes

---

### Phase 5: Trust UI & Onboarding

**Goal:** AI가 추출한 핀과 사용자가 수동으로 추가한 핀이 시각적으로 구분되고, 추출 중 진행 단계와 실패 사유·retry가 노출되며, 신규 가입자는 빈 상태가 아닌 "내 첫 여행" 보드로 진입한다.
**Depends on:** Phase 2 (`source_kind`/`confidence`/`quote` 컬럼, broadcast 채널), Phase 3 (iOS 보드 상세 화면), Phase 4 (web 보드 페이지)
**Why now:** confident-wrong이 dogfooding 신뢰의 1번 위협 (Pitfall 1). AI 신뢰 UX가 없으면 본인 7일 사용 중 한 번의 hallucination에 신뢰 영구 손실. 첫 보드 자동 생성은 빈 상태 마찰 제거 (Empty State UX). iOS와 Web 양쪽 UI를 동시에 손대므로 트랙 분리가 어려워 별도 phase.
**Requirements:** TRUST-01, TRUST-02, TRUST-03, TRUST-04, ONBOARD-01, ONBOARD-02
**Owners:** iOS + Web + Design (cross-cut UI)
**Success Criteria** (what must be TRUE):
  1. 보드 상세 지도에서 AI가 추출한 핀(점선·옅은 색)과 사용자가 수동 추가한 핀(실선·진한 색)이 한눈에 구분된다 (iOS + Web 양쪽)
  2. 추출 진행 중인 링크에 현재 단계(메타데이터 → transcript → 장소 추출 → 지도 표시)가 UI에 텍스트 또는 progress bar로 표시된다
  3. 추출 실패 시 실패 사유(자막 없음 / 장소 없음 / 할당량 초과 등)가 노출되고 1탭으로 retry 가능하다
  4. `confidence < 0.7`인 핀이 시각적으로 약하게(low_confidence 음영) 표시되고, 사용자가 명시적으로 confirm 또는 reject 할 수 있다
  5. 신규 가입자가 첫 로그인하면 "내 첫 여행" 보드가 자동 생성되어 보드 목록에 1개가 있다 (빈 상태 없음)
  6. 신규 사용자가 첫 보드 상세에 들어가면 "유튜브 링크를 붙여넣어 보세요" 안내 카드가 1회 표시되고, 닫으면 다시 뜨지 않는다
**Plans:** 6 plans (5 waves — Wave 1 foundation → Wave 2 parallel UI [iOS step indicator ∥ Web marker] → Wave 3 iOS retry → Wave 4 iOS low-conf sheet → Wave 5 iOS onboarding card)
  - [x] 05-01-PLAN.md — Migration 0006 (places.confidence numeric(3,2) CHECK 0..1 + public_board_view RPC redef append source_kind+confidence + profiles_create_first_board AFTER INSERT trigger SECURITY DEFINER + backfill existing profiles) + extract-youtube confidence wire (1 line) + @moajoa/core constants (EXTRACT_STEP_KO / LOW_CONFIDENCE_THRESHOLD=0.7 / OnboardKeys.LinkCardDismissed) + @moajoa/api confirmAiPlace + rejectAiPlace alias. T2 type regen deferred (Docker daemon not running + no supabase access token — user-side `supabase db push` + `pnpm supabase:types`). 4 commits ef8e842 + c206097 + 5d3f194 + 3732511. Rule 1 fix on `pnpm supabase:types` shell-redirect zeroing database.ts (restored via git checkout). [TRUST-01, TRUST-04, ONBOARD-01] (2026-05-26)
  - [x] 05-02-PLAN.md — iOS StepIndicator component + [id].tsx broadcast subscribe 5-stage wire (TRUST-02) [Wave 2 ∥ 05-05] ✓ 2026-05-26 (3aac855, 3c2c113; 5 jest tests + typecheck clean)
  - [x] 05-03-PLAN.md — Toast action slot + error 8s default + [id].tsx broadcast 'error' retry + onAddLink catch retry + link list row 5-status copy + failed-row tap retry (TRUST-03) [Wave 3 — sequential w.r.t. [id].tsx] ✓ 2026-05-26 (f7c7938 + aa62d8c + fc2dad1; 6 new jest tests = 20/20 ios PASS; SafeAreaProvider test wrapper; D-12 user-explicit only — 자동 retry 0)
  - [x] 05-04-PLAN.md — iOS marker source_kind+confidence visual + PinBottomSheet low_confidence variant ([확인]/[잘못됨]) (TRUST-01 iOS + TRUST-04) [Wave 4] ✓ 2026-05-26 (80c2e88 marker + 4702bc7 sheet variant; 20/20 jest PASS; typecheck clean; Apple Maps Pitfall 3 hedged via children View fallback at rgba(249,115,22,0.5); strict-< boundary D-15; no deviations)
  - [x] 05-05-PLAN.md — Web public-board-map.tsx Marker SVG color/opacity + ? badge via pure buildMarkerIconUrl + PlaceSchema/PublicBoardView source_kind+confidence (TRUST-01 web parity) [Wave 2 ∥ 05-02] ✓ 2026-05-26 (8e35322 + 2464a12; 8 new vitest = 49/49 web; typecheck + build green; Rule 3 g.Size+g.Point stubs in map-options.test.ts)
  - [x] 05-06-PLAN.md — lib/onboarding.ts AsyncStorage wrapper + OnboardCard component + [id].tsx visibility wire (ONBOARD-02) [Wave 5] ✓ 2026-05-26 (9fb828a + 06b0a60 + 858bf51; 10 new jest tests = 30/30 ios PASS; typecheck clean; Rule 2 a11y add — accessibilityRole/Label on × Pressable for VoiceOver; tri-state linkCardDismissed prevents flicker; optimistic dismiss with fire-and-forget AsyncStorage write)
**UI hint:** yes

---

### Phase 6: Dogfooding Gate

**Goal:** 본인이 일본 또는 서울 여행 계획에 MOAJOA를 실제로 7일간 사용하여 10개 이상의 핀을 추출·확정하고, 친구에게 보드 URL을 카톡으로 공유했을 때 모바일 브라우저에서 정상 열림을 증명한다. + 추출 정확도 baseline을 sample 영상으로 측정해 문서화한다.
**Depends on:** Phase 1~5 모두
**Why last:** Karpathy goal-driven execution의 정점. Phase 1.5(협업·투표)로 넘어가기 전 "Core Value가 실제로 작동하는가"의 단일 게이트. Baseline 측정도 여기서 — 7일 사용 중 발견된 hallucination/wrong city를 sample에 반영하면 첫 eval set 자체가 dogfooding과 짝지어짐.
**Requirements:** EXTRACT-07
**Owners:** 2인 팀 전체 (사용자 본인 dogfooding + 기록)
**Success Criteria** (what must be TRUE):
  1. 본인이 일본 또는 서울 여행 계획에 MOAJOA를 7일 연속(달력 기준) 사용한 로그가 남는다 (보드 생성 시각, 링크 추가 시각 분포)
  2. 본인의 여행 보드 1개 이상에 10개 이상의 핀이 추출 또는 수동으로 확정되어 있다
  3. 친구에게 보드 URL을 카톡으로 공유했고, 친구의 모바일 브라우저에서 정상 열림이 스크린샷으로 증명된다
  4. sample 영상 10~20개에 대한 expected vs actual 비교 결과가 `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md`에 precision/recall·실패 케이스 분석으로 기록된다
  5. Dogfooding 중 발견된 신규 pitfall이 `.planning/research/PITFALLS.md` 또는 v2 백로그에 추가되었다
**Plans:** 5 plans (2 waves — Wave 1 file-disjoint parallel 06-01 ~ 06-04 → Wave 2 06-05 종합 평가)
  - [x] 06-01-PLAN.md — Pre-dogfooding deferred consolidation (Phase 3/4/5 인프라+UAT 단일 체크리스트 + manual-uat-phase3.md N2 SQL 보강) [EXTRACT-07 prerequisite] (2026-05-26 templates ready — actual checklist close is dogfooding-time)
  - [x] 06-02-PLAN.md — Sample 12 영상 매트릭스 + samples.json + ground-truth template + README [EXTRACT-07 input] (2026-05-26)
  - [x] 06-03-PLAN.md — Daily log template + incidents.md 양식 + p90/daily-aggregate/measure-accuracy SQL 3종 + scripts README [EXTRACT-07 tracking] (2026-05-26)
  - [x] 06-04-PLAN.md — Friend share checklist (2명 D-15 5체크) + screenshots 명명 규약 [Success Criterion 3] (2026-05-26)
  - [x] 06-05-PLAN.md — Pass-evaluator (D-20/D-21) + extraction-baseline-TEMPLATE (D-09 5-part) + PASS-TEMPLATE (D-22) + PITFALLS.md Phase 6 anchor [EXTRACT-07 final + Success Criterion 4-5] (2026-05-26)

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build Unblock & Hygiene | 3/4 (01-04 N/A) | Complete    | 2026-05-25 |
| 2. Extraction Pipeline Hardening | 3/3 | Complete    | 2026-05-25 |
| 3. iOS Save Flow | 5/5 (UAT pending) | Code complete | 2026-05-26 |
| 4. Public Board (Web) | 4/4 (UAT pending) | Code complete | 2026-05-26 |
| 5. Trust UI & Onboarding | 6/6 | Complete (code) — UAT deferred | - |
| 6. Dogfooding Gate | 5/5 (templates) | Templates complete — dogfooding execution pending | 2026-05-26 |
| 7. Pending-Failed Links Screen | 1/1 | Complete   | 2026-06-07 |

---

## Phase Ordering Rationale (전체 그래프)

```
Phase 1 (Foundation: iOS build + design assets + web hygiene)
   │
   ├──> Phase 2 (Backend: extraction hardening) ──┐
   │       │                                       │
   │       ▼                                       ▼
   ├──> Phase 3 (iOS: save flow)              Phase 4 (Web: public board)
   │       │                                       │
   │       └───────────────┬───────────────────────┘
   │                       ▼
   └────────────────> Phase 5 (Trust UI + Onboarding — cross-cut)
                           │
                           ▼
                      Phase 6 (Dogfooding Gate)
```

**핵심 의존 관계:**

- **1 → 2,3,4:** 빌드 못 하면 iOS 작업 검증 X. 빌드와 무관한 Phase 2 (Backend)는 사실 1과 병렬 가능하지만, 본 로드맵에서는 사람 1명이 1을 끝낸 직후 2~4를 fork-out하는 직렬-then-병렬 흐름을 권장 (2인 팀 컨텍스트 스위칭 비용)
- **2 → 3:** iOS의 추출 progress UI(P3 안)는 P2의 broadcast 채널이 있어야 의미 있음. SAVE-02 30초 p90도 P2의 cost/citation 안정성이 전제
- **2 → 4:** P4의 `/api/revalidate` webhook은 P2의 Edge Function이 호출. P4 OG 이미지는 P2의 `source_kind`/`quote` 컬럼 활용 가능
- **2,3,4 → 5:** Trust UI는 P2의 컬럼·broadcast, P3의 iOS 화면, P4의 web 보드 화면을 모두 손댐. 이 셋이 안정화된 후 cross-cut polish가 자연
- **1~5 → 6:** Dogfooding 게이트는 모든 흐름이 e2e로 동작해야 시작 가능
- **3 → 7:** Pending-Failed 화면은 P3의 pending 큐(lib/pending.ts)와 boards.tsx 배너 진입점이 전제. P3에서 누락된 목적지 화면을 완성

**병렬 권장 페어 (2인 팀 동시 진행 가능):**

- Phase 2 ∥ Phase 1 끝부분 (Backend 사람이 P2 시작 가능)
- Phase 3 ∥ Phase 4 (iOS vs Web 파일 경계 완전 분리)
- Phase 5는 단독 — cross-cut이라 둘이 같이 또는 차례로

---

## Coverage

✓ All 29 v1 requirements mapped
✓ No orphaned requirements
✓ No duplicate mappings

| Category | Requirements | Phase |
|----------|--------------|-------|
| BUILD | 3 | 1 |
| WEB | 2 | 1 |
| EXTRACT | 6 (01~06) | 2 |
| EXTRACT | 1 (07 baseline) | 6 |
| SAVE | 5 | 3 |
| VIEW | 6 | 4 |
| TRUST | 4 | 5 |
| ONBOARD | 2 | 5 |
| **Total** | **29** | -- |

### Phase 7: 저장 실패 링크 목록 화면 (Pending-Failed Links Screen)

**Goal:** 저장 대기열(pending) 링크가 4회 재시도 후 실패하면, 사용자가 boards 탭의 "저장 실패 N개" 배너를 탭해 실패 목록 화면을 열고 각 항목의 실패 사유를 확인한 뒤 재시도하거나 삭제할 수 있다. (Phase 3에서 배너만 만들고 목적지 화면이 누락돼 생긴 깨진 동선을 완성한다.)
**Requirements**: 미할당 (must_haves는 ROADMAP Goal + 07-CONTEXT D-01..D-08에서 도출 — 신규 화면 1개로 깨진 동선 복구)
**Depends on:** Phase 3 (ios-save-flow — pending 큐 + 배너 진입점)
**Plans:** 1/1 plans complete

Plans:
- [x] 07-01-PLAN.md — FailedPendingLink export + 순수 표시 헬퍼(사유 한국어 매핑 D-04 + 상대시각) + failed.tsx 라우트 화면(리스트·사유배지·재시도·전체재시도·스와이프 삭제·실행취소·empty state, D-01~D-08) + boards.tsx 배너 타깃 수정(/boards/_failed → /boards/failed) + 단위/렌더 테스트 [Wave 1]

---

*Roadmap created: 2026-05-25 by roadmapper*
*Phase 3 planned: 2026-05-26 (5 plans in 4 waves)*
*Phase 4 planned: 2026-05-26 (4 plans in 3 waves)*
*Phase 5 planned: 2026-05-26 (6 plans in 5 waves)*
*Phase 6 planned: 2026-05-26 (5 plans in 2 waves)*
*Phase 7 planned: 2026-06-07 (1 plan in 1 wave)*
*Next: `/gsd-execute-phase 7`*

---

# Milestone v1.1 — 추출 고도화 + 협업

**Created:** 2026-06-07
**Milestone:** v1.1
**Core Value:** 링크 → 30초 안에 지도 위의 핀 (+ 사람이 읽는 해설 + 친구가 무설치로 투표)
**Granularity:** standard (5-8 phases) → **3 phases** (좁은 증분 마일스톤 — 작업량이 3개 자연 경계로 떨어짐, 패딩 금지)
**Requirements covered:** 8/8 v1.1 ✓
**Design source:** `docs/SESSION-NOTES-2026-06-07.md` (§2 = ② 설계 잠금, §3 = 웹 범위, §4 = 라우팅) · 결정 로그 `.planning/AUTONOMOUS-LOG-2026-06-08.md`

> v1.0 (Phase 1~7) 내용은 위에 보존됨. 이 마일스톤은 Phase **8**부터 번호를 이어간다.

## v1.1 결정 근거 요약

순서 **② → ① → 투표** (SESSION-NOTES §1 모으기 우선). ②(추출 깊이)가 "좋은 추출 결과물 = 장소 + 해설"이라는 출력 계약을 먼저 정의하면, ①(소스 넓이)이 그 계약을 그대로 재사용한다 → 9는 8에 의존. 웹 투표(10)는 추출 파이프라인과 직교(협업 surface)라 8/9와 거의 독립적으로 진행 가능하다.

## Phases (v1.1)

- [ ] **Phase 8: 추출 깊이 (장소·영상 해설)** — 단일 Claude 호출 확장으로 `places.summary_ko` + `links.summary_ko` 생성, nullable 추가형, 반환각 규칙 유지, 해설 실패가 추출을 실패시키지 않음, 웹 조건부 노출
- [ ] **Phase 9: 소스 넓이 (블로그·인스타)** — 블로그/인스타 URL을 동일 파이프라인(장소+해설)으로 자동 추출, 추출 불가 소스는 명시적 실패 사유 반환
- [ ] **Phase 10: 웹 투표 (협업)** — 공유 보드 slug로 멤버 참여 + 웹에서 핀 ❤️ 투표 + love/멤버 ≥ 0.5 "확정" 필터

---

## Phase Details (v1.1)

### Phase 8: 추출 깊이 (장소·영상 해설)

**Goal:** 추출 파이프라인이 장소별 1~2문장 한국어 해설과 영상 TL;DR을 출력 계약에 추가해, 사용자가 핀마다 "여기가 어떤 곳인지"를 자막 근거 기반으로 읽을 수 있고, 공개 보드(web)에 그 해설이 노출된다. 해설은 부가 기능이라 절대 추출 자체를 실패시키지 않는다.
**Depends on:** Nothing (v1.1 첫 phase — 기존 v1 추출 파이프라인 위에 증분)
**Why first:** "좋은 추출 결과물 = 장소 + 해설"이라는 출력 계약을 정의해야 Phase 9(블로그·인스타)가 그 계약을 재사용할 수 있다. 설계가 SESSION-NOTES §2에 잠겨 있어 회색지대가 적고 저위험.
**Requirements:** EXTRACT-12, EXTRACT-13, EXTRACT-14, VIEW-08
**Owners:** Backend (EXTRACT-12/13/14), Web (VIEW-08)
**Design lock (SESSION-NOTES §2):** 단일 Claude 호출 출력 스키마 확장(새 호출/레이턴시 X). 새 nullable text 컬럼 2개(`places.summary_ko`, `links.summary_ko`)를 **새 append-only 마이그레이션** `supabase/migrations/NNNN_extraction_summaries.sql`로 추가. 반환각 규칙(자막 근거 범위 내, 근거 없으면 비움) + 기존 `source_quote` 필수·confidence 필터 유지. 한국어 출력(영상이 JP/EN이어도). 손댈 파일: `supabase/functions/extract-youtube/pipeline/claude.ts`, `.../index.ts`, `packages/core/src/schemas/{place,link,extraction}.ts`, 새 마이그레이션, 웹 공개 보드 UI.
**Success Criteria** (what must be TRUE):
  1. 자막 있는 여행 영상을 추출하면 각 장소에 비어있지 않은 `places.summary_ko`(1~2문장 한국어)가 채워지고, 해당 영상(link)에 2~3문장 한국어 TL;DR(`links.summary_ko`)이 생성된다
  2. 생성된 해설이 자막·설명 근거 범위 내에 머무른다 (스팟체크 시 환각 없음 — 근거 없는 장소는 해설이 짧거나 비어있음)
  3. 자막이 빈약한 영상은 해설이 짧거나 비어도 장소 추출 자체는 성공한다 (해설/요약 누락 시 NULL 저장, 기존 confidence 필터·source_quote 필수 유지)
  4. 공개 보드(web)에서 장소 해설과 영상 요약이 노출되며, summary_ko 값이 없는 레거시 데이터에서도 레이아웃이 깨지지 않는다 (조건부 렌더)
**Plans:** 4 plans (3 autonomous + 1 blocking morning gate)
- [ ] 08-01-PLAN.md — 스키마·마이그레이션 기반 (0008 컬럼 + public_board_view RPC 재발행 + Zod/타입 4-link 계약)
- [ ] 08-02-PLAN.md — 백엔드 LLM 파이프라인 (claude.ts 출력 스키마/프롬프트 확장 + index.ts ?? null 저장 + deno 테스트)
- [x] 08-03-PLAN.md — 웹 노출 (장소 해설 리스트 + 영상 TL;DR 조건부 렌더 + vitest, VIEW-08) ✓ 2026-06-08 (7889a4a test + db01535 component + 16bd93c page; place-summary-list.test.tsx 4/4 PASS; tsc + build green; T-08-06 XSS 완화 grep-asserted; 표시 전용 CLAUDE.md §5; 라이브 UAT는 08-04 게이트)
- [ ] 08-04-PLAN.md — [BLOCKING, autonomous:false] supabase db push + supabase:types 재생성 + 라이브 스팟체크
**UI hint:** yes

---

### Phase 9: 소스 넓이 (블로그·인스타)

**Goal:** 사용자가 유튜브 외에 블로그(네이버/티스토리 등)와 인스타그램 게시물 URL을 던져도, MOAJOA가 본문·캡션 텍스트를 추출해 동일한 파이프라인으로 장소 + 해설을 생성한다. 추출 불가능한 소스는 묵묵부답 대신 명시적 실패 사유를 돌려준다.
**Depends on:** Phase 8 (②의 출력 계약 — `summary_ko` 포함 장소+해설 스키마 — 을 재사용)
**Why now:** "모으기" 입구를 유튜브 너머로 넓혀 acquisition surface를 키운다. Phase 8이 출력 계약을 먼저 굳혀야 소스별 파서가 같은 결과 shape로 수렴한다.
**Requirements:** SRC-01, SRC-02
**Owners:** Backend
**Note:** 기존 v2-defer의 EXTRACT-10(manual-queue 운영진 추출)과 구분 — v1.1 SRC는 **자동** 추출.
**Success Criteria** (what must be TRUE):
  1. 블로그(네이버/티스토리 등) URL을 던지면 본문 텍스트가 추출되어 유튜브와 동일한 파이프라인으로 장소 + `summary_ko` 해설이 생성된다
  2. 인스타그램 게시물 URL을 던지면 캡션/본문에서 장소 + 해설이 생성된다
  3. 추출 불가능한 소스(로그인 벽·본문 없음 등)는 추출이 묵묵부답으로 멈추지 않고 명시적 실패 사유를 반환한다 (TRUST-03 실패 사유 노출 동선 재사용)
**Plans:** 5 plans (4 autonomous + 1 blocking morning gate · 4 waves)
  - [ ] 09-01-PLAN.md — source.ts 계약(SourceContent + SSRF guard) + instagram.ts graceful-fail + claude.ts optional sourceKind(youtube 회귀 0) + deno 테스트 [SRC-02] (Wave 1)
  - [ ] 09-02-PLAN.md — blog.ts 어댑터(deno-dom WASM + @mozilla/readability + naver PostView rewrite + EUC-KR + SSRF) + mocked-fetch deno 테스트 [SRC-01] (Wave 2, depends 09-01)
  - [ ] 09-03-PLAN.md — index.ts source-router(youtube 그대로 + blog/insta 분기 + manual→400) [SRC-01/02] (Wave 3, depends 09-01·02)
  - [ ] 09-04-PLAN.md — 웹 dev-tool add-link 트리거 확장(youtube→blog/insta) + 안내문구 [SRC-01/02] (Wave 1, file-disjoint)
  - [ ] 09-05-PLAN.md — [BLOCKING, autonomous:false] iOS 트리거 확장 + 라이브 blog/insta 스팟체크(실기기 + 실네트워크, 08-04 선행) [SRC-01/02] (Wave 4, depends 09-03·04)

---

### Phase 10: 웹 투표 (협업)

**Goal:** 공유 보드 링크를 받은 친구가 앱 설치 없이 웹에서 멤버로 참여하고, 보드의 핀에 ❤️로 투표해 "같이 갈 곳"을 함께 고를 수 있다. 충분한 지지(love/멤버 ≥ 0.5)를 받은 핀은 "확정"으로 필터되어 한눈에 보인다.
**Depends on:** Nothing hard (8/9와 거의 독립 — 협업 surface). 단 의미 있는 투표 대상이 되려면 추출된 핀이 보드에 있어야 하므로 v1 추출·열람 위에 얹힌다.
**Why now:** SESSION-NOTES §3 웹 범위 결정 — 웹 = 조회+공유+**투표**. 초대받은 친구가 무설치로 "여기 가자" 참여하는 것이 소셜 루프(같이 고르기)의 핵심. iOS는 캡처/편집 전담으로 남는다.
**Requirements:** COLLAB-01, COLLAB-02
**Owners:** Web + Backend (멤버십 RLS)
**Note (CLAUDE.md 갱신 플래그):** 실제 빌드 시 CLAUDE.md `web/ = 열람·공개 보드` → `열람·공개 + 투표 참여`로 확장. 단 하드룰(웹에 보드 생성·링크 추가 UI 금지)은 **유지** — 추가하는 건 투표/참여지 생성이 아님 (SESSION-NOTES §3).
**Success Criteria** (what must be TRUE):
  1. 공유 보드 링크(slug)로 들어온 사용자가 멤버로 참여(수락)할 수 있고, 멤버 목록에 반영된다
  2. 멤버가 웹에서 보드의 핀에 ❤️ 투표할 수 있고, 투표가 즉시(또는 새로고침 시) 반영된다
  3. love/총멤버 ≥ 0.5인 핀이 "확정"으로 필터·표시되어, 멤버가 합의된 장소를 한눈에 구분할 수 있다
**Plans:** 3 plans (2 autonomous + 1 blocking morning gate)
- [ ] 10-01-PLAN.md — 백엔드: 마이그레이션 0009 (join_shared_board + accepted_member_count + public_board_view 재발행: id 노출 + shared 가시성) + api 헬퍼 memberships.ts (joinSharedBoard, getAcceptedMemberCount)
- [ ] 10-02-PLAN.md — 웹 투표 island: /b/[slug] 클라 컴포넌트 (비로그인/멤버/비멤버 분기 + ❤️ 토글 + 확정 필터, isPlaceConfirmed·castVote 재사용) + page 배선 + vitest
- [ ] 10-03-PLAN.md — [BLOCKING, autonomous:false] supabase db push (0009) + supabase:types 재생성 + 라이브 브라우저 흐름(로그인→참여→투표→확정) + 가시성 확장 사용자 확인 + CLAUDE.md 웹 역할 문서 갱신(추천 diff)
**UI hint:** yes

---

## Progress Table (v1.1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. 추출 깊이 (장소·영상 해설) | 3/4 | Code complete · 08-04 모닝 게이트 | 2026-06-08 (code) |
| 9. 소스 넓이 (블로그·인스타) | 4/5 | Code complete · 09-05 모닝 게이트 | 2026-06-08 (code) |
| 10. 웹 투표 (협업) | 2/3 | Code complete · 10-03 모닝 게이트 | 2026-06-08 (code) |

---

## Phase Ordering Rationale (v1.1)

```
Phase 8 (② 추출 깊이 — 출력 계약 정의: 장소+해설)
   │
   ▼
Phase 9 (① 소스 넓이 — ②의 출력 계약 재사용: 블로그·인스타)

Phase 10 (웹 투표 — 협업 surface, 8/9와 거의 독립)
```

**핵심 의존 관계:**

- **8 → 9:** Phase 9의 소스별 파서가 Phase 8이 정의한 "장소 + summary_ko" 출력 계약으로 수렴해야 함. 8 없이 9를 하면 출력 shape이 두 번 바뀐다.
- **10 독립:** 웹 투표는 추출 파이프라인이 아니라 멤버십·투표 surface. 8/9와 파일 경계가 거의 겹치지 않아 병렬 가능. 단 투표 대상 핀은 기존 v1 추출·열람으로 이미 존재.

**병렬 권장 (2인 팀):**

- Phase 10 ∥ Phase 8/9 (협업 surface vs 추출 파이프라인 — 파일 경계 분리)

---

## Coverage (v1.1)

✓ All 8 v1.1 requirements mapped
✓ No orphaned requirements
✓ No duplicate mappings

| Category | Requirements | Phase |
|----------|--------------|-------|
| EXTRACT (12/13/14) | 3 | 8 |
| VIEW (08) | 1 | 8 |
| SRC (01/02) | 2 | 9 |
| COLLAB (01/02) | 2 | 10 |
| **Total** | **8** | -- |

---

*v1.1 Roadmap created: 2026-06-07 by roadmapper (autonomous mode — recommended defaults)*
*Design source: `docs/SESSION-NOTES-2026-06-07.md` §2/§3/§4*
*Next: `/gsd-discuss-phase 8` 또는 `/gsd-plan-phase 8`*

---

# Milestone v1.2 — Expo SDK 54 → 56 업그레이드

**Created:** 2026-06-12
**Milestone:** v1.2
**Core Value:** iOS 표준 빌드 경로(`expo run:ios` / EAS) 복귀 — Xcode 26에서 깨진 추출·공유 동선을 막던 커스텀 우회를 제거하고 최신 SDK 기반으로 정렬
**Granularity:** standard → **3 phases** (54→55 / 55→56 / 정리·검증 — RN 메이저 경계가 자연 분기)
**Requirements covered:** 5/5 v1.2 ✓
**Design source:** 2026-06-12 discuss 세션 (사용자 3개 결정 잠금) · Phase 11 CONTEXT

> v1.0(Phase 1~7) / v1.1(Phase 8~10) 위에 보존됨. 이 마일스톤은 Phase **11**부터 번호를 이어간다.

## v1.2 결정 근거 요약 (배경)

`expo run:ios`가 Xcode 26에서 사이닝 에러로 깨짐(@expo/cli devicectl 버그, SDK 56에만 수정) → 현재는 `pnpm sim`(xcodebuild 직접) 우회로만 빌드 가능하고, 실기기 share-sheet 추출 트리거(v1.1 잔여)는 EAS 표준 경로가 필요해 미검증 상태. **SDK 56까지 올리면 표준 경로가 복귀**하여 우회 제거 + v1.1 잔여 UAT 완료가 가능. Expo는 한 메이저씩(54→55→56) 권장 → 3 phase.

**사용자 잠금 결정 (2026-06-12 discuss):**
- **JS 엔진:** JSC → **Hermes 복귀** (JSC는 RN 0.81+ first-party 제거; SDK 56 Hermes v1 기본). supabase-js OTEL 회귀는 babel transform fallback.
- **범위:** 풀 — 업그레이드 + 우회 제거 + 실기기 share-sheet UAT + 메모리/CLAUDE.md 갱신.
- **브랜치:** `gsd/v1.2-sdk-upgrade` (RN 2메이저 점프 위험도 → main 보호).

**리스크 흡수 사실:** 앱은 **이미 New Architecture 사용 중**(Reanimated 4) → SDK 55의 Legacy Arch 폐지가 무해. 가장 큰 마이그레이션 리스크는 이미 지나감.

## Phases (v1.2)

- [x] **Phase 11: SDK 54 → 55** — New Arch 확정 + Hermes 복귀(supabase OTEL 회귀 0) + RN 0.83/React 19.2 lockstep + expo-share-intent 6.1.1 + react-native-maps 1.27 maps 설정 픽스 + 네이티브 회귀 0 (completed 2026-06-13, 3/3 plans)
- [~] **Phase 12: SDK 55 → 56** — RN 0.85 + Hermes v1 + deployment target 16.4 **✅ (커밋 334cea1)** · 단 표준 `expo run:ios` Xcode 26 복귀는 **❌ 미달성**(@expo/cli 56.1.15도 시뮬레이터를 물리기기로 오인 — SDK 56 미해결). 앱은 pnpm sim으로 빌드·실행 검증됨.
- [ ] **Phase 13 (재정의): 워크어라운드 유지 문서화 + 실기기 EAS UAT + 문서/메모리 갱신** — (당초 "pnpm sim 제거"는 expo run:ios 미수정으로 불가) pnpm sim 유지 사유 명시 + EAS dev build 실기기 share-sheet UAT(v1.1 잔여) + 메모리/CLAUDE.md 갱신(SDK 56이지만 로컬 우회 필요) + main 머지

---

## Phase Details (v1.2)

### Phase 11: SDK 54 → 55 (New Arch 확정 + Hermes 복귀 + RN 0.83)

**Goal:** apps/ios가 Expo SDK 55(RN 0.83/React 19.2)에서 빌드·실행되고, JS 엔진이 JSC→Hermes로 전환되어 supabase 인증·쿼리가 런타임에서 회귀 없이 동작하며, 핵심 네이티브 기능(구글맵·애플로그인·share extension·bottom-sheet·gesture)이 회귀 0으로 동작한다.
**Depends on:** Nothing (마일스톤 첫 phase)
**Why first:** JSC는 RN 0.81부터 first-party 제거 → SDK 55(RN 0.83)에선 커뮤니티 패키지 없이 불가. SDK 55가 Legacy Arch도 폐지하므로 New Arch 확정 + Hermes 전환을 같은 단계에서 흡수. Hermes/OTEL 변수를 SDK bump와 분리하기 위해 엔진 전환을 SDK 54 위에서 먼저 검증.
**Requirements:** UPGRADE-01(부분), UPGRADE-02, UPGRADE-03
**Owners:** iOS
**Success Criteria** (what must be TRUE):
  1. SDK 54 위에서 jsEngine을 Hermes로 전환한 빌드가 시뮬레이터에서 실행되고, 로그인(매직링크/애플) + 보드 쿼리가 런타임 에러(OTEL 동적 import 등) 없이 동작한다 (실패 시 babel transform으로 magic comment 제거 적용)
  2. package.json이 expo ~55 / react-native 0.83 / react 19.2로 lockstep 상향되고 expo-share-intent가 6.x로 올라가며, `npx expo install --check`가 잔여 불일치 0을 보고한다
  3. `expo prebuild --clean` 재생성 후 ios/ 네이티브 설정(GMSApiKey, App Group entitlement, ShareExtension target)이 보존되고 grep으로 확인된다
  4. 시뮬레이터 빌드(pnpm sim)가 통과하고 구글맵 렌더링 + 핀 + bottom-sheet + gesture가 회귀 없이 동작한다
  5. jest(jest-expo 55) + `tsc --noEmit`가 통과한다
**Plans:** 3/3 complete
  - [x] 11-01-PLAN.md — Hermes 격리 검증 (SDK 54 위 jsEngine 제거 + prebuild + 빌드 + 웰컴 렌더, OTEL 회귀 0) ✓ 2026-06-13 (커밋 fa9c1c2)
  - [x] 11-02-PLAN.md — SDK 55 lockstep (expo 55.0.26/RN 0.83.6/react 19.2.0 + 전체 expo-* 55.x + share-intent 6.1.1, expo install --check up-to-date + tsc + jest 38/38) ✓ 2026-06-13 (커밋 70b3e8a)
  - [x] 11-03-PLAN.md — prebuild --clean + 네이티브 보존 + BUILD SUCCEEDED + 회귀(웰컴/보드 렌더, New Arch 등록 OK) + react-native-maps 1.27 Google Maps config plugin 픽스 ✓ 2026-06-13 (커밋 997d855)
**UI hint:** no (인프라 — 시각 회귀 확인은 있으나 새 UI 없음)
**Deferred to Phase 13:** 실제 MapView 타일+핀 렌더(로그인 필요) · release/EAS Hermes hermesc 정밀 검증

---

### Phase 12: SDK 55 → 56 (RN 0.85 + Hermes v1 + expo run:ios 복귀)

**Goal:** apps/ios가 Expo SDK 56(RN 0.85/React 19.2, Hermes v1 기본)에서 빌드·실행되고, iOS deployment target이 16.4로 상향되며, 표준 `expo run:ios`(또는 EAS dev build)가 Xcode 26 시뮬레이터에서 사이닝 에러 없이 동작한다.
**Depends on:** Phase 11
**Why now:** @expo/cli의 devicectl/CoreDevice 사이닝 버그 수정이 SDK 56에 있음 → `expo run:ios` 복귀의 분기점. RN 0.85는 0.83 위 증분.
**Requirements:** UPGRADE-01(완료), UPGRADE-04
**Owners:** iOS
**Success Criteria** (what must be TRUE):
  1. package.json이 expo ~56 / react-native 0.85로 상향되고 `npx expo install --check` 잔여 불일치 0
  2. iOS deployment target이 16.4로 상향된다 (커스텀 모듈 podspec 포함)
  3. ~~`expo run:ios`가 Xcode 26 시뮬레이터에서 사이닝 에러 없이 빌드·실행~~ — **❌ 미달성:** @expo/cli 56.1.15가 Xcode 26.5 시뮬레이터를 물리기기로 오인 → `No code signing certificates`(UDID 명시해도 2회 재현). SDK 56 미해결. **로컬은 pnpm sim 유지**(앱은 pnpm sim으로 BUILD SUCCEEDED + 실행 검증).
  4. 구글맵(빌드/링크)·share extension(소스생성)·bottom-sheet·gesture 회귀 0, jest + `tsc --noEmit` 통과 ✓
  5. Hermes에서 앱 부팅 + 웰컴/보드 렌더(supabase import 크래시 0) ✓
**Plans:** 2/2 (12-01 lockstep ✓ 334cea1 · 12-02 prebuild+build+회귀 ✓ 추적변경0). 성공기준 #3은 Xcode 26 한계로 미달 → Phase 13에서 워크어라운드 유지로 재정의.
**UI hint:** no
**핵심 발견:** SDK 56이 expo run:ios의 Xcode 26 시뮬레이터 오인을 못 고침 → 마일스톤 전제(UPGRADE-04 로컬 복귀) 수정. EAS 클라우드 빌드는 무관(실기기 UAT는 Phase 13 EAS로 가능).

---

### Phase 13: 우회 제거 + 실기기 검증 + 문서 갱신

**Goal:** SDK 56 표준 빌드 경로가 확정됐으니 pnpm sim 우회 스크립트를 제거·정리하고, v1.1의 잔여였던 실기기 share-sheet 추출 트리거 UAT를 EAS dev build로 완료하며, 관련 메모리/CLAUDE.md를 갱신하고 마일스톤 브랜치를 main에 머지한다.
**Depends on:** Phase 12
**Why last:** 표준 경로가 실제 동작해야 우회 제거·실기기 검증이 의미 있음.
**Requirements:** UPGRADE-04(스크립트 제거), UPGRADE-05
**Owners:** iOS
**Success Criteria** (what must be TRUE):
  1. `scripts/ios-sim.sh` 제거 + package.json `sim` 스크립트 정리(또는 `expo run:ios`로 재정의)되고, 빌드 문서/메모가 표준 경로로 갱신된다
  2. EAS dev build(`eas build -p ios --profile development`)로 실기기 설치 후, 카톡/사파리 공유시트에서 youtube/blog/insta 링크를 던지면 추출이 발화한다 (v1.1 잔여 UAT 통과)
  3. `ios-local-build-on-this-mac` 메모리가 "우회 불필요 — 표준 경로 복귀"로 갱신되고, CLAUDE.md의 "local build 보류 중" 문구가 갱신된다
  4. `gsd/v1.2-sdk-upgrade` 브랜치가 main에 머지된다
**Plans:** TBD (`/gsd-plan-phase 13`에서 생성)
**UI hint:** no

---

## Progress Table (v1.2)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. SDK 54 → 55 | 3/3 | Complete | 2026-06-13 |
| 12. SDK 55 → 56 | 2/2 | SDK 56 bump 완료 · expo run:ios 복귀 미달(Xcode 26 한계) | 2026-06-13 |
| 13. 워크어라운드 유지 + 실기기 EAS UAT + 문서 (재정의) | 0/TBD | Not started · 사용자 확인 대기 | - |

---

## Phase Ordering Rationale (v1.2)

```
Phase 11 (54 → 55: New Arch 확정 + Hermes 복귀 + RN 0.83)
   │  (Hermes/OTEL 변수를 SDK bump와 분리 검증)
   ▼
Phase 12 (55 → 56: RN 0.85 + Hermes v1 + expo run:ios 복귀)
   │  (표준 빌드 경로 복귀 = 우회 제거의 전제)
   ▼
Phase 13 (우회 제거 + 실기기 share-sheet UAT + 문서 갱신 + main 머지)
```

**핵심 의존 관계:**
- **11 → 12:** Expo 권장 = 한 메이저씩. JSC→Hermes·New Arch 확정을 55에서 먼저 흡수해야 56 점프가 단순 증분이 됨.
- **12 → 13:** `expo run:ios` 복귀(56)가 실제 동작해야 우회 스크립트 제거·실기기 EAS UAT가 의미. v1.1 잔여(실기기 share-sheet)를 여기서 닫음.

**병렬 불가:** 직렬 의존 체인(각 SDK 위에 다음 SDK). 단일 트랙(apps/ios) 작업.

---

## Coverage (v1.2)

✓ All 5 v1.2 requirements mapped
✓ No orphaned requirements

| Requirement | 설명 | Phase |
|----------|--------------|-------|
| UPGRADE-01 | 앱이 Expo SDK 56 / RN 0.85에서 빌드·실행 | 11(부분)·12 |
| UPGRADE-02 | JS 엔진 Hermes 전환 + supabase 런타임 회귀 0 | 11 |
| UPGRADE-03 | 핵심 네이티브 기능(맵·로그인·share·sheet·gesture) 회귀 0 | 11 |
| UPGRADE-04 | 표준 `expo run:ios` 복귀 + pnpm sim 우회 제거 | 12·13 |
| UPGRADE-05 | v1.1 잔여 실기기 share-sheet 추출 UAT 통과 | 13 |

---

*v1.2 Roadmap created: 2026-06-12 (discuss 기반 — 사용자 3개 결정 잠금)*
*Next: `/gsd-plan-phase 11`*
