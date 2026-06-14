---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Expo SDK 54 → 56 업그레이드
status: in_progress
last_updated: "2026-06-12T00:00:00.000Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 66
---

# STATE: MOAJOA v1.2

**Last updated:** 2026-06-12
**Milestone:** v1.2 (Expo SDK 54 → 56 업그레이드)

---

## Project Reference

- **Core Value:** 링크 → 30초 안에 지도 위의 핀
- **Out of Scope (v1):** 협업 투표 UI · `/discover` 피드 · 블로그/IG 자동 추출 · OAuth · i18n · 다크 모드 · 에러 트래킹 · CI · Flutter 코드 참조
- **Dogfooding Gate:** 본인 일본/서울 여행 7일 연속 사용 + 보드 10핀+ + 친구 카톡 공유 모바일 열림

자세한 컨텍스트: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

---

## Current Position

**Milestone:** v1.2 (Expo SDK 54 → 56 업그레이드) — **진행 중 (2026-06-13)**
Branch: `gsd/v1.2-sdk-upgrade`
Phase: 13 — 워크어라운드 유지 + EAS UAT + 문서 (재정의) — **자율 부분 ✅ · EAS 실기기 UAT는 사용자 측 · main 머지 대기**

- **13 자율 완료:** 메모리 `ios-local-build`(SDK 56서도 expo run:ios 깨짐 정정 + maps plugin) · CLAUDE.md §4.1(SDK 56 + pnpm sim/EAS) · scripts/ios-sim.sh 주석 · EAS 설정 검증(eas.json development + appExtensions ↔ share-intent 7 정합).
- **13 사용자 측 [대기]:** EAS dev build(eas login + 실폰) = release/Hermes 검증(hermesc OTEL 최종 확정) + 공유시트 추출 UAT. 체크리스트: `.planning/phases/13-workaround-eas-docs/13-01-PLAN.md`.
- **main 머지:** EAS release/Hermes 검증을 권장 게이트로 (사용자 선택 시 선머지 가능 — 시뮬레이터 빌드·실행은 검증됨).

이전 Phase: 12 — SDK 56 bump ✅ (expo run:ios 복귀 ❌ Xcode 26 한계, 위 발견 참조)

- **11-01~03 (SDK 54→55) ✅ COMPLETE (커밋 fa9c1c2/70b3e8a/997d855):** Hermes 복귀(OTEL 회귀 0) + expo 55.0.26/RN 0.83.6 + react-native-maps 1.27 Google Maps config plugin 픽스. 상세는 아래 Decisions + ROADMAP.
- **12-01 (SDK 56 lockstep) ✅ (커밋 334cea1):** expo 56.0.11 / RN 0.85.3 / react 19.2.3 / react-dom 19.2.3(expo-router 56 peer) / expo-* 56.x / share-intent 7.0.0. tsconfig `types:["jest","node"]`(SDK 56 base서 @types/jest 자동포함 깨짐 보정). expo install --check up-to-date + tsc + jest 38/38.
- **12-02 (prebuild + 빌드 + 회귀) ✅ 부분:** SDK 56 prebuild --clean + pod install + deployment target **16.4** + 네이티브 보존(GMSApiKey/App Group/Hermes/maps subspec) + **pnpm sim BUILD SUCCEEDED + 웰컴/보드 화면 렌더(New Arch 등록 OK, JS 에러 0)**. 추적 코드 변경 0(prebuild는 gitignored ios/).

### ⚠️ 핵심 발견 (마일스톤 전제 수정)
**`expo run:ios`는 SDK 56 + Xcode 26.5 + @expo/cli 56.1.15에서도 여전히 깨짐** — 시뮬레이터(UDID 명시해도)를 물리 기기로 오인해 `No code signing certificates`. 2회 재현(`/tmp/run-ios.log`, `run-ios2.log`). **즉 "SDK 56이 expo run:ios를 고친다"는 전제가 틀렸다.** UPGRADE-04의 "표준 경로 복귀(로컬)"는 **미달성**. → **로컬 시뮬레이터는 pnpm sim(xcodebuild 직접) 우회를 계속 사용해야 함.** 단 SDK 업그레이드 자체의 가치는 유효(SDK 최신화 + Hermes + EAS 클라우드 빌드는 이 로컬 Xcode 버그 무관 → 실기기 share-sheet UAT는 EAS로 진행 가능).

**Phase 13 재정의 필요:** 기존 "pnpm sim 우회 제거"는 **불가**(로컬 expo run:ios 미수정) → 우회 유지 + 왜 필요한지 문서화 + EAS dev build로 실기기 share-sheet UAT + 메모리/CLAUDE.md를 "SDK 56이지만 로컬 우회 여전히 필요"로 갱신. **사용자 확인 대기.**

**Phase deferred (Phase 13):** 실제 MapView 타일+핀 렌더(로그인 필요) · release/EAS hermesc Hermes 정밀 검증 · 실기기 share-sheet UAT.

**discuss 잠금 결정 (2026-06-12):** JS 엔진 Hermes 복귀 · 풀 범위 · 마일스톤 브랜치.

상세: `.planning/phases/11-sdk-55-upgrade/11-CONTEXT.md` · ROADMAP "Milestone v1.2" 섹션.

### v1.1 종료 상태 (직전 마일스톤)

**Milestone v1.1 (추출 고도화 + 협업) — 라이브 검증 완료 (3/3 phases).** 유일 잔여였던 **iOS 실기기 share-sheet 추출 트리거 UAT**는 EAS 표준 빌드가 필요해 미검증 → **v1.2 Phase 13으로 흡수**(SDK 56 표준 경로 복귀 후 검증).
Phase: 10 — 웹 투표 — 라이브 PASS (브라우저 검증 + 버그 2건 수정)
Plan: v1.1 전 phase 라이브 검증 통과.

- **Phase 8 (② 추출 깊이):** ✅ 라이브 PASS — 유튜브 9곳 ready(conf 0.85, 환각 0, 타임스탬프 정확) + 블로그 10곳(conf 0.94). VIEW-08 해설/요약 웹 노출 확인.
- **Phase 9 (① 소스 넓이):** ✅ 라이브 PASS — 블로그(디에디트) 풀 추출, IG 명시적 실패, 트리거 코드 검증(grep+tsc+jest 38/38). drain의 blog 처리는 시뮬레이터에서 부분 확인(addLink까지). **잔여: 실기기 share-sheet.**
- **Phase 10 (웹 투표):** ✅ 라이브 PASS — join_shared_board + 투표 2계정 + 확정 뱃지/필터 + shared 가시성. **브라우저 검증 중 버그 2건 발견·수정**(0012: votes UPDATE RLS 누락, owner self-join 이중계산; +멤버십/내-투표 하이드레이션).
- **모닝 게이트 (2026-06-12 자율 세션):** db push 0008~0012 ✅ · types 재생성 ✅ · extract-youtube 배포 ✅ · YOUTUBE_API_KEY 설정 ✅(사용자 원격) · 보안(anon 401/ready 409) ✅. 상세: `docs/SESSION-NOTES-2026-06-12.md`.
- **v1.1 progress:** 라이브 검증 3/3 통과 · 잔여 1건(실기기 share-sheet, EAS).

### 잔여 작업 (v1.1 닫기 전 또는 후속)

- **[실기기] iOS share-sheet 추출 트리거** — 공유시트로 youtube/blog/insta 링크 던지기 → 추출 발화 확인. 시뮬레이터에 share extension 없음 → EAS dev build(`eas build -p ios --profile development`) + 폰 설치 필요. `eas login` 상태 확인 선행. 09-05 in-app 트리거 코드는 검증됨, share-sheet 경로만 미검증.

> v1.0 도그푸딩 게이트 의도적 병행/나중. v1.0 phase 1~7 보존 — 아래 archived.

### v1.0 Phase History (archived)

Phase: 07 (pending-failed-links-screen) — EXECUTING
Plan: 1 of 1

- **Phase 1:** ✓ COMPLETE 2026-05-25 (01-01 design assets · 01-02 iOS smoke screen on real device · 01-03 web dev-tool gate · 01-04 N/A EAS fallback unused). BUILD-01/02/03 + WEB-01/02 모두 통과.
- **Phase 2:** ✓ COMPLETE 2026-05-25 (동료: migration 0004, Edge Function broadcast/citation/cost-logging, schema push + billing alert). EXTRACT-01~06 모두 통과.
- **Phase 3 Wave 1:** ✓ 03-01 완료 2026-05-26 (foundation — migration 0005 nullable link_id, packages/core APP_GROUP_ID + SharedDefaultsKeys + extractChannelName, apps/ios jest-expo infra, docs/manual-uat-phase3.md 5 scenarios + N1/N2).
- **Phase 3 Wave 2:** ✓ 2026-05-26 (parallel)
  - 03-02 ✓ Share Extension config plugin via expo-share-intent@^5.1.1 (SDK 54 호환 라인; APP_GROUP_ID 6x 참조; EAS appExtensions; eas.json 신규). Prebuild + 실기기 share-sheet smoke test는 end-of-phase UAT로 deferred (auto mode).
  - 03-03 ✓ resolve-place Edge Function (FIELD_MASK 5 fields, max 5, extraction_costs link_id=null) + ResolvePlace schemas in @moajoa/core (lines 86/103/117) + renamePlace/deletePlace helpers in @moajoa/api. Deno tests 8/8 pass. Deploy + live curl smoke deferred to user-side UAT.
- **Phase 3 Wave 3:** ✓ 2026-05-26
  - 03-04 ✓ SharedDefaults Expo Module (Swift bridge over UserDefaults(suiteName:APP_GROUP_ID)) + lib/shared-defaults.ts JSON wrapper + lib/pending.ts drainPendingLinks state machine (D-04 dual triggers, D-05 PendingLink shape, D-06 retry-budget→failed migration, Pitfall 7 dedup via module-level inFlight) + lib/realtime.ts subscribeExtractProgress + lib/toast.tsx single-instance host + _layout.tsx AppState wiring (cold-launch + foreground 'active', arrow-wrap cleanup, useRef inFlight) + index.tsx D-13 auth gate restoration (getSession + onAuthStateChange) + login.tsx UI-SPEC §6 (email+password primary + magic-link toggle + Korean error mapping) + boards.tsx UI-SPEC §5 failed-banner (useFocusEffect + bg-danger/5). TDD RED→GREEN: 6/6 unit tests pass. Three Rule 1 fixes to Plan 03-01 jest config + gitignore (anchored ignore patterns, setupFilesAfterEnv, pnpm-aware transformIgnorePatterns). iOS native build smoke deferred (pattern from 03-02). Commits: 667fb20, 5223be1, b6a8da4, cc1b7cd, 2ec3a2f.
- **Phase 3 Wave 4:** ✓ 2026-05-26 — 03-05 (@gorhom/bottom-sheet@5.2.14 + PinBottomSheet D-09 single sheet [snap 25%/50%, link_id signal for AI/manual] + PinAddModal D-07/D-08 [300ms debounce + resolve-place + max 5 + addManualPlace] + boards/[id].tsx surgical extension [broadcast subscribe + supabase.removeChannel cleanup + spinner overlay brand-500 + 분석 중 + + 핀 header + Marker onPress + Modal pageSheet wrap + SharedDefaults.set(LastBoardId)] + realtime.test.ts 3/3 PASS + 4-branch mapErrorReason). Commits: bb70256, aa20be7. Real-device UAT (scenarios 1-5) + N2 SQL RLS substitute test deferred to end-of-phase UAT batch (supabase CLI not authenticated in this session).
- **Phase 4 Wave 1:** ✓ 04-01 완료 2026-05-26 (~7분, 3 tasks TDD RED→GREEN; commits f155efb + d790bfc + 5647451 + 3257f35 + 55b64d4). Vitest+jsdom infra + youtube/static-maps/cache/env helpers + CITY_KO_MAP shipped. 20/20 unit tests pass.
- **Phase 4 Wave 2:** ✓ 2026-05-26
  - 04-02 완료 2026-05-26 (~3분, 3 tasks TDD; commits 3cf1899 RED + 9d5164f GREEN + 060484f cache-key + c87fd59 Edge Function webhook). /api/revalidate Node-runtime route + timing-safe secret + Edge Function fire-and-forget POST after done broadcast. 9/9 new tests (8 api-revalidate matrix + 1 cache-key Pitfall 1 guard).
  - 04-03 완료 2026-05-26 (~12분, 2 implemented tasks + 1 deferred UAT checkpoint; commits ef951e0 + 4704faa). layout.tsx viewport (maximumScale:5 WCAG-safe) + metadataBase; page.tsx surgical rewrite — getCachedPublicBoard wrap, extended generateMetadata (description templates city有/無 + twitter:summary_large_image + alternates.canonical + robots.index=true), UI-SPEC §1 reassignment audit on 7 sites (text-3xl→2xl, font-medium→semibold, uppercase 제거, h-[420px]→h-[60vh], video card hover, footer brand-500 wordmark + "이 보드는 MOAJOA로 만들었어요"), empty state (places.length===0); PublicBoardMap +links prop + gestureHandling 'greedy' + clickableIcons false + marker click → window.open(buildYouTubeWatchUrl(...)) D-14/D-15/D-16; not-found.tsx + error.tsx (UI-SPEC §5/§6); 8 new vitest (metadata 5 + map-options 3) — 37/37 total pass; typecheck + build clean. Rule 3 fixes: vitest esbuild.jsx 'automatic' (React 19 auto JSX runtime), cache-key.test.ts non-null assertions (pre-existing 04-02 strict-TS gap). Real-browser UAT deferred to end-of-phase batch per auto mode.
- **Phase 4 Wave 3:** ✓ 2026-05-26
  - 04-04 완료 2026-05-26 (~3분, 2 tasks + 1 deferred UAT checkpoint; commits 9bec7e2 + 1b6fed1). Pretendard KS X 1001 subset woff2 (Regular 156KB + SemiBold 160KB = 317KB combined, well under ImageResponse 500KB 하드 limit) via fontTools.subset + text-file (2,350 한글 + ASCII + Latin-1 + jamo + CJK punct). apps/web/app/b/[slug]/opengraph-image.tsx Next 파일 컨벤션 OG route (runtime='nodejs', 1200×630 ImageResponse, 좌측 텍스트 stack 보드제목 48/600 + city_ko 28/400 + 핀 N개 24/400 + MOAJOA wordmark 24/600 brand-500, 우측 Static Maps grayscale PNG ≤10마커 brand-500 또는 '지도 미리보기 준비 중' fallback, 3중 fallback view-null/key-missing/places-empty, title 80-char substring clamp Satori CJK-safe). lib/og/pretendard.ts 모듈 캐시 readFile loader (한 번만 readFile per process, process.cwd() 기반 hardcoded path). og-image.test.ts 4/4 PASS — 전체 apps/web 41/41 (4 신규 + 37 기존). typecheck exit 0; build green (route 131B 103kB First Load, no 500KB warning). Rule 1 fix on vi.mock('node:fs/promises') needing both default + named export (vitest CJS interop). Rule 1 documented: 한글 KS X 1001 2,350글자 밀도 floor — per-file 156/160KB로 plan soft target 150KB 약간 초과하지만 combined < 500KB 하드 게이트는 만족. 실제 브라우저 UAT (Kakao 미리보기, GCP Maps Static API enable 확인, dev fetch) end-of-phase batch로 deferred per auto mode.
- **Phase 5 Wave 1:** ✓ 05-01 완료 2026-05-26 (~4분, 4 commits ef8e842 + c206097 + 5d3f194 + 3732511; T2 type regen deferred). Migration 0006 (places.confidence + public_board_view RPC redef + first_board trigger + backfill) + @moajoa/core EXTRACT_STEP_KO/LOW_CONFIDENCE_THRESHOLD/OnboardKeys + extract-youtube confidence wire + @moajoa/api confirmAiPlace/rejectAiPlace. Foundation for 05-02~05-06 ready. User-side: supabase db push + supabase:types regen.
- **Phase 5 Wave 2:** ✓ 2026-05-26 (parallel — file-disjoint apps/ios ∥ apps/web)
  - 05-02 ✓ 2026-05-26 (~6분, 2 commits 3aac855 + 3c2c113). apps/ios/app/boards/_step-indicator.tsx (D-22 visual reassignment current/done/future + EXTRACT_STEP_KO 4-키 + ActivityIndicator always-spin) + [id].tsx surgical extend (currentStep state + 4-step branch + done/error cleanup setCurrentStep(null) + overlay 본문 <StepIndicator/> 교체 + ActivityIndicator import 제거) + __tests__/step-indicator.test.tsx 5 cases (14/14 PASS total, typecheck clean). TRUST-02 충족.
  - 05-05 ✓ 2026-05-26 (~4분, 2 commits 8e35322 + 2464a12). apps/web/lib/marker-svg.ts 신규 pure buildMarkerIconUrl (source_kind+confidence → SVG data URL: AI #F97316 / manual #0F172A / low-conf opacity 0.45 + white "?" badge per LOW_CONFIDENCE_THRESHOLD < 0.7; undefined/null=high-conf safe fallback per D-15; no XSS surface — static literals only) + 8 vitest cases (matrix + strict < boundary + SVG geometry). PublicBoardMap +13 lines icon wiring (scaledSize g.Size(32,40), anchor g.Point(16,40), 클릭 핸들러 D-14 unchanged). PlaceSchema source_kind z.enum(['ai','manual']) + confidence z.number().nullable() + PublicBoardView.places Pick 확장. Rule 3 inline: g.Size+g.Point stubs in map-options.test.ts + 픽스처 source_kind/confidence 추가. 49/49 web vitest PASS, typecheck + build green (/b/[slug] 2.76kB / 118kB First Load). TRUST-01 web parity 충족. Live UAT는 user-side supabase db push (05-01 deferred) 이후 end-of-phase batch로.
- **Phase 5 Wave 3:** ✓ 2026-05-26
  - 05-04 ✓ 2026-05-26 (~2분, 2 commits 80c2e88 + 4702bc7). apps/ios/app/boards/[id].tsx Marker isAi/isLowConf/pinColor/opacity branching + children View rgba(249,115,22,0.5) ? badge fallback (RESEARCH Pitfall 3 Apple Maps provider hedge). apps/ios/app/boards/_pin-sheet.tsx isLowConf variant — 신뢰도 낮음 amber badge (D-22 text-xs/font-medium) + hint line + [확인]/[잘못됨] inserted ABOVE 이름 수정 (trust-affordance ordering); onConfirm/onReject wire confirmAiPlace/rejectAiPlace with onChanged → onClose pattern. Strict-< 0.7 boundary, null safe fallback. 20/20 jest PASS, typecheck clean. Zero deviations. TRUST-01 iOS + TRUST-04 충족.
  - 05-03 ✓ 2026-05-26 (~3분, 3 commits f7c7938 + aa62d8c + fc2dad1). apps/ios/lib/toast.tsx 시그니처 backward-compatible 확장 — `showToast(message, kind, options?: { durationMs?, action? })` (grep 결과 numeric 3rd-arg 호출자 0 — 옵션화 안전). error kind 기본 duration 5000→8000ms (D-10 retry window). ToastHost current.action 있으면 우측 underline Pressable + flex-row 8px gap; action onPress가 hideToast() wrap (caller lifecycle free). [id].tsx broadcast 'error' 분기: linkId capture before setAnalyzing(null) → { label: '재시도', onPress } 전달 → retry는 setAnalyzing(linkId) 재진입 + triggerExtraction 재호출 + nested catch terminal toast. onAddLink catch도 동일 retry 패턴 mirror. renderItem 5-status 한국어 fixture (pending/processing/ready/failed/manual_review) inline; failed 행만 Pressable enabled (disabled={!isFailed}); failed status 단어만 text-danger. text-xs 사이즈 유지 (Karpathy §3.3 surgical, D-22 lock 활성 use site에 미포함). __tests__/toast.test.tsx 신규 6 cases (action 가시·onPress·Phase 3 회귀·error 8s default·info 3s·explicit override; SafeAreaProvider initialMetrics wrapper). 20/20 jest (4 suites), typecheck clean. D-12 ensured: 자동 retry 경로 0, 사용자 명시 탭만. TRUST-03 충족.
- **Next action:** Phase 5 Wave 5 — 05-06 (lib/onboarding.ts AsyncStorage wrapper + OnboardCard component + [id].tsx visibility wire — ONBOARD-02). After that, end-of-phase UAT batch covers all Phase 5 live verification.
- **Phase 6: Dogfooding Gate** — ✓ TEMPLATES COMPLETE 2026-05-26 (5/5 plans, ~14분 total, 10 commits 1137306+8591d0f+ed9f644+6df9283+c08802a+145d099+b654978+5b3a609+e11400c+97e225a). 06-01 pre-dogfooding-checklist (D-01 6 그룹 A~F + D-02 sign-off, 105 lines) + manual-uat-phase3.md N2 SQL substitute (set_config + 42501 expected) + 7 Evidence: 라인. 06-02 sample-videos.md 12-row matrix (D-04) + samples.json (D-05 schema, JSON.parse 12 entries) + ground-truth/_template.json (confidence_label high/medium/low) + ground-truth/README.md (per-video procedure, D-06 매칭, quality bar). 06-03 daily-log-template.md (7 Day blocks + End-of-Week SQL Snapshot + 7일 Pass/Fail Summary, D-10/D-11/D-12/D-13) + incidents.md (4-label policy P0/P1/expected-v1-limit/noise) + scripts/dogfooding/{p90-duration,daily-aggregate,measure-accuracy}.sql 3종 (percentile_cont + hidden_at IS NULL + jsonb_agg FILTER) + scripts/dogfooding/README.md (setup/args/output destinations). 06-04 friend-share-checklist.md (Friend A/B 양식 × D-15 5체크 + device meta + locale + 피드백, 97 lines) + screenshots/README.md (D-16 layout + NN-step.png 명명 + locale labeling). 06-05 pass-evaluator.md (D-20 11 criteria + D-21 4 fail → next phase mapping + decision tree) + extraction-baseline-TEMPLATE.md (D-09 5-part: Meta/Per-video/Aggregate/Top5/v2 시드) + PASS-TEMPLATE.md (D-22 sign-off 13 필드 + Phase 1.5 unlock) + PITFALLS.md §"Phase 6 — Dogfooding Gate" anchor append (D-19, idempotent). 모든 5 plans `autonomous: true` — production code 수정 0건, documentation/SQL templates only. Phase 6 dogfooding 실행 (7일 본인 여행 + 12 영상 ground truth + 친구 2명 share + baseline measurement)은 user-side work — 본 5 plans는 그 양식과 SQL을 미리 준비하는 것이 scope.
- **Next action:** Phase 6 dogfooding execution (user-side) — pre-dogfooding-checklist.md sign-off → 7일 daily-log + incidents append → Day 5~6 친구 share → Day 7+1 baseline 측정 + pass-evaluator 평가 → PASS.md (또는 FAIL-YYYY-MM-DD.md) 작성 → Phase 1.5 unlock (협업·투표).
- **Progress:** [██████████] 96%

---

## Performance Metrics

(채워질 항목 — phase 진행 중 추가)

- Phase 1 시작: 2026-05-25 (Wave 1 — plan 01-01)
- Phase 1 Wave 1 완료: 2026-05-25 (commits fbab9e2, f672279, 5cd4446)
- Phase 1 완료: TBD
- iOS 빌드 통과 시각: TBD
- Dogfooding 시작 일자: TBD
- Phase 3 Plan 03-01 완료: 2026-05-26 (~6분, 2 tasks, commits e7c389c + ca46b4e)
- Phase 3 Plan 03-02 완료: 2026-05-26 (~5분, 1/2 tasks; Task 2 real-device deferred; commit 56c61d8)
- Phase 3 Plan 03-03 완료: 2026-05-26 (~18분, 3 tasks TDD RED→GREEN→helpers; commits a617937 + 83a3b8f + ea2f0f0; Deno tests 8/8 pass; deploy + live curl deferred to UAT)
- Phase 3 Plan 03-04 완료: 2026-05-26 (~7분, 3 tasks TDD RED→GREEN + task 2 + task 3; commits 667fb20 + 5223be1 + b6a8da4 + cc1b7cd + 2ec3a2f; pending.test.ts 6/6 pass; native build smoke deferred to UAT)
- Phase 3 Plan 03-05 완료: 2026-05-26 (~4분, 2 automatable tasks + 1 deferred UAT checkpoint; commits bb70256 + aa20be7; realtime.test.ts 3/3 + pending.test.ts 6/6 = 9/9; real-device UAT + N2 SQL RLS deferred to end-of-phase batch)
- Phase 4 Plan 04-01 완료: 2026-05-26 (~7분, 3 tasks TDD RED→GREEN; commits f155efb + d790bfc + 5647451 + 3257f35 + 55b64d4; 20/20 vitest tests pass; Rule 1 fix on plan's contradictory 12-char YouTube ID fixture vs 11-char regex)
- Phase 4 Plan 04-02 완료: 2026-05-26 (~3분, 3 tasks TDD; commits 3cf1899 RED + 9d5164f GREEN + 060484f cache-key + c87fd59 Edge Function; 9/9 new vitest tests pass — 34/34 total; no deviations from plan; pre-existing deno check errors in extract-youtube/index.ts logged to deferred-items.md)
- Phase 4 Plan 04-03 완료: 2026-05-26 (~12분, 2 implemented tasks + 1 deferred UAT checkpoint; commits ef951e0 + 4704faa; metadata 5 + map-options 3 = 8 new vitest, 37/37 total pass; typecheck + build green; Rule 3 vitest esbuild.jsx automatic + Rule 3 cache-key non-null assertions; real-browser UAT deferred to end-of-phase batch per auto mode)
- Phase 4 Plan 04-04 완료: 2026-05-26 (~3분, 2 tasks + 1 deferred UAT checkpoint; commits 9bec7e2 + 1b6fed1; og-image 4/4 새로 = 41/41 total vitest pass; Pretendard KS X 1001 subset woff2 317KB combined < 500KB ImageResponse 하드 limit; opengraph-image.tsx Next 파일 컨벤션 OG route runtime='nodejs' + 좌측 텍스트 stack + 우측 Static Maps grayscale embed + 3중 fallback; lib/og/pretendard.ts 모듈 캐시 readFile loader; build 131B route 103kB First Load no 500KB warning; Rule 1 vi.mock node:fs/promises default+named exports + Rule 1 documented KS X 1001 density floor; real-browser UAT deferred per auto mode)
- Phase 5 Plan 05-01 완료: 2026-05-26 (~4분, 4 tasks T2 deferred; commits ef8e842 migration + c206097 constants + 5d3f194 edge wire + 3732511 helpers; @moajoa/core typecheck pass + @moajoa/api typecheck pass after Rule 1 fix restoring zeroed database.ts; T2 type regen blocked on Docker + access token → user-side `supabase db push` + `pnpm supabase:types` deferred; Rule 1 documented: `pnpm supabase:types`의 shell-redirect가 `supabase gen --local` 실패 시 빈 파일을 만들어 1545-line database.ts wipe — restore via git checkout)
- Phase 5 Plan 05-05 완료: 2026-05-26 (~4분, 2 tasks; commits 8e35322 type extension + 2464a12 marker SVG分岐; 8 new vitest marker-svg matrix = 49/49 web total PASS; typecheck + build green /b/[slug] 2.76kB/118kB; Rule 3 inline fix g.Size+g.Point stubs in map-options.test.ts + 픽스처에 source_kind/confidence 필드 추가 in same commit as component contract change; PlaceSchema + PublicBoardView.places Pick 확장 source_kind+confidence; pure buildMarkerIconUrl isolation mirrors Phase 4 static-maps.ts pattern; D-15 undefined safe fallback for stale Vercel ISR pre-0006-apply payload; XSS surface 0 — only static color/opacity literals in SVG)
- Phase 5 Plan 05-04 완료: 2026-05-26 (~2분, 2 tasks; commits 80c2e88 marker visual + 4702bc7 sheet variant; 20/20 jest PASS 4 suites — no regression; typecheck clean; zero deviations; isAi/isLowConf/pinColor/opacity branching at Marker render site + children View rgba(249,115,22,0.5) ? badge fallback for Apple Maps provider hedge per RESEARCH Pitfall 3; isLowConf variant on PinBottomSheet with 신뢰도 낮음 amber badge + hint + [확인]/[잘못됨] above 이름 수정; D-22 text-xs/font-medium reassignment applied to amber badge; strict-< 0.7 boundary + null/undefined safe fallback; trust-affordance ordering pattern established — schema-mutating actions precede inline-edit; high-conf AI + manual paths unchanged from Phase 3; live device UAT deferred to end-of-phase batch per auto mode)
- Phase 5 Plan 05-03 완료: 2026-05-26 (~3분, 3 tasks; commits f7c7938 toast action slot + aa62d8c [id].tsx error retry + fc2dad1 link list status; apps/ios/__tests__/toast.test.tsx 신규 6 cases = 20/20 jest 4 suites PASS; typecheck clean; D-10 error default 5s→8s + action slot underline Pressable; D-11 5-status 한국어 fixture inline + failed-row tap retry; D-12 user-explicit only — 자동 retry 0; SafeAreaProvider initialMetrics wrapper added in test (jest infra plumbing — useSafeAreaInsets requirement); linkId capture pattern before setAnalyzing(null) for stable closure binding; dual retry surface (toast within 8s + permanent failed-row fallback after dismiss); live device UAT deferred to end-of-phase batch per auto mode)
- Phase 6 Plan 06-01 완료: 2026-05-26 (~3분, 2 tasks; commit 1137306; .planning/dogfooding/pre-dogfooding-checklist.md 신규 105 lines D-01 6 그룹 A~F + D-02 sign-off, 4-column 표 inline evidence slot; docs/manual-uat-phase3.md surgical edit — N2 시나리오에 RLS SQL substitute (set_config + 42501) + 7 시나리오 모두에 Evidence: 라인; no production code change)
- Phase 6 Plan 06-02 완료: 2026-05-26 (~2분, 2 tasks; commit ed9f644; .planning/dogfooding/sample-videos.md 12-row matrix D-04 + TBD URL slots + selection procedure; samples.json 12 entries D-05 schema JSON-valid; ground-truth/_template.json + ground-truth/README.md per-video procedure D-06 매칭; URL/ground_truth 채움은 dogfooding 시점 deferred)
- Phase 6 Plan 06-03 완료: 2026-05-26 (~4분, 2 tasks; commit c08802a; .planning/dogfooding/daily-log-template.md 7 Day blocks + End-of-Week SQL Snapshot D-10/D-11/D-12/D-13; incidents.md 4-label policy D-17/D-18 + Pass impact; scripts/dogfooding/p90-duration.sql percentile_cont + daily-aggregate.sql window cumulative hidden_at IS NULL + measure-accuracy.sql jsonb_agg FILTER; scripts/dogfooding/README.md setup/args/output destinations/troubleshooting)
- Phase 6 Plan 06-04 완료: 2026-05-26 (~2분, 2 tasks; commit b654978; .planning/dogfooding/friend-share-checklist.md Friend A/B 양식 × D-15 5체크 + device meta + locale + Pitfall reminders; screenshots/README.md D-16 layout + NN-step.png naming convention + locale labeling rule + What NOT to include)
- Phase 6 Plan 06-05 완료: 2026-05-26 (~3분, 2 tasks; commit e11400c; .planning/dogfooding/pass-evaluator.md D-20 11 criteria + D-21 4 fail conditions → next phase mapping + decision tree + Conclusion slot; extraction-baseline-TEMPLATE.md D-09 5-part Meta/Per-video 12-row/Aggregate overall+category+city+source/Top 5 failure modes/v2 EXTRACT-08 시드; PASS-TEMPLATE.md D-22 sign-off 13 필드 + Phase 1.5 unlock checklist + Artifacts Index; .planning/research/PITFALLS.md §"Phase 6 — Dogfooding Gate" anchor append D-19 idempotent)
- Phase 8 Plan 08-03 완료: 2026-06-08 (~3분, 2 tasks TDD RED→GREEN; commits 7889a4a test + db01535 component + 16bd93c page; VIEW-08 — apps/web/app/b/[slug]/_components/place-summary-list.tsx 신규 server component [name_ko ?? name_local + {p.summary_ko && <p>} 조건부, no 'use client', Phase 4 토큰] + page.tsx wire [PlaceSummaryList 지도 아래 + 영상 출처 리스트에 {link.summary_ko && <p line-clamp-3>}]; place-summary-list.test.tsx 4 cases [present/null-legacy/name-preference/HTML-escape] = 4/4 PASS (첫 .test.tsx — 기존 vitest config 그대로, setup 변경 0); tsc --noEmit exit 0 + next build exit 0 /b/[slug] 2.83kB; raw HTML 미사용 grep-asserted → T-08-06 XSS 완화; Rule 3 doc-comment에서 dangerouslySetInnerHTML 토큰 제거 (acceptance grep-FAILS 충족); 표시 전용 새 생성 UI 없음 CLAUDE.md §5; out-of-scope marker-svg.test.ts 5 pre-existing fail [Phase5 #0F172A vs feat(ui) #111827] → deferred-items.md, 08-03 회귀 0; 라이브 브라우저 UAT는 08-04 게이트로 deferred)

---

## Accumulated Context

### Roadmap Evolution

- **Phase 15 추가 (2026-06-14): 장소 카테고리 보강 (LLM vibe).** UI 고도화 세션에서 장소 카드 색이 대부분 회색('장소')으로 뜨는 근본원인 발견 — 맵링크 장소(keyless, Places 검색 없음)는 `primaryType:null`이라 category 비어있음. 해결: 추출 LLM(claude.ts)에 coarse vibe 필드 추가 + 맵링크 장소를 동명 LLM 후보와 매칭해 vibe 부여(무료) + `places.category = primaryType ?? vibe` + iOS `vibeOf`/웹 `categoryVisual` 중복 매퍼를 `packages/core` 단일 resolver로 통일. 범위 외: 기존 데이터 백필(별도). [forward fix — 기존 보드는 재추출 전까지 회색 유지]
- **Milestone v1.3 시작 (2026-06-14): 추출→공유→투표 자연 흐름.** Phase 14 추가(번호 이어감). brainstorming spec 승인([docs/superpowers/specs/2026-06-14-extract-to-vote-flow-design.md]). iOS 보드 flat 장소 리스트 + 지도 fitToCoordinates + 장소 영상 인앱 임베드(react-native-webview) + "친구와 정하기"/상시 공유 → `share_board` RPC(0014) → 네이티브 공유. web vote-island 재사용. 4 plans(14-01 백엔드 / 14-02 리스트·지도 / 14-03 영상 / 14-04 공유). **GSD CLI(gsd-sdk) 미설치라 아티팩트 수동 생성.**
- **Milestone v1.1 시작 (2026-06-07): 추출 고도화 + 협업.** Phase 8~10 추가 (번호는 v1.0에서 이어감). Phase 8 ② 추출 깊이(EXTRACT-12/13/14 + VIEW-08) → Phase 9 ① 소스 넓이(SRC-01/02, depends 8) → Phase 10 웹 투표(COLLAB-01/02). 설계 source: SESSION-NOTES §2/§3/§4. v1.0 도그푸딩(Phase 6 실행)은 의도적 병행/나중.
- Phase 7 added: 저장 실패 링크 목록 화면 (Pending-Failed Links Screen) — Phase 3에서 만든 pending-failed 배너의 누락된 목적지 화면을 구현해 깨진 동선 완성. Depends on Phase 3.

### Decisions (Roadmap 단계에서 확정)

- **[v1.2 12-02] `expo run:ios`는 Xcode 26 + SDK 56에서도 시뮬레이터를 물리 기기로 오인 → 로컬은 pnpm sim 유지** — @expo/cli 56.1.15가 Xcode 26.5의 devicectl/CoreDevice 시뮬레이터를 device로 misidentify해 `No code signing certificates`. SDK 56이 고친다는 가정 오류(2회 재현). 로컬 시뮬레이터 = `pnpm sim`(xcodebuild 직접 + CODE_SIGNING_ALLOWED=NO). 실기기/배포 = EAS(클라우드 Xcode라 무관). **scripts/ios-sim.sh 제거하지 말 것.**
- **[v1.2 12-01] SDK 56 expo-router는 react-dom을 peer로 요구** — 네이티브 앱이어도 `react-dom`(react와 동일 버전)을 deps에 추가해야 expo install/빌드 통과. + tsconfig `types:["jest","node"]` 필요(SDK 56 base가 moduleResolution:bundler라 @types/jest 자동포함 안 됨 → TS2708/2593).
- **[v1.2 11-03] react-native-maps 1.27 Google Maps = 자체 config plugin (`iosGoogleMapsApiKey`), `ios.config.googleMapsApiKey` 금지** — 1.27은 별도 `react-native-google-maps.podspec`을 폐지하고 메인 podspec의 `Google` subspec(`pod 'react-native-maps/Google'`) + 자체 플러그인으로 전환. Expo built-in `ios.config.googleMapsApiKey`는 폐지된 `pod 'react-native-google-maps'`를 주입해 pod install 실패. app.config.ts에서 후자 제거 + `['react-native-maps', { iosGoogleMapsApiKey: env }]` 추가가 정답(플러그인이 GMSApiKey·AppDelegate·Podfile 전부 구성). **Phase 12(56)에서도 이 설정 유지.**
- **[v1.2 11-02] Expo SDK 메이저 업그레이드는 `pnpm add expo@~NN.x` 직접 핀 후 `expo install --fix`** — `expo install expo@^NN`은 현재 SDK CLI 기준이라 메이저를 안 넘는다. `expo install --fix`는 포그라운드 1회만(백그라운드 반복 시 좀비 프로세스가 node_modules 경합). 롤백: `git checkout HEAD -- package.json pnpm-lock.yaml` → `pnpm install --frozen-lockfile`.
- **Phase 수: 6 (architecture 제안 4에서 확장)** — granularity standard 적합. Backend / iOS save / Web public을 별도 phase로 펼쳐 2인 팀 fork-join 가능
- **Phase 1에 NativeWind 4.2 업그레이드 포함** — 빌드 디버깅과 silent failure 동시 회피 (Pitfall 6 + 11)
- **Phase 1에 web dev tool 격리(WEB-01/02) 포함** — 코드 한 줄 + dogfooding 중 친구 공유 혼란 방지
- **Phase 2를 Phase 3·4 이전에** — Realtime broadcast / cost / citation 모두 후속 phase의 토대. Pitfall 1·2·3·5 모두 비용 없는 방어선이라 일찍 굳힘
- **iOS 빌드 4시간 시간박스** — Pitfall 6: 박힘 시 EAS Build 즉시 전환. Phase 1 success criteria #3에 명시
- **EXTRACT-07 (baseline 측정)을 Phase 6으로** — 7일 dogfooding과 같이 진행해야 sample이 실제 사용 패턴 반영
- **App Group ID `group.com.serendipitylife.moajoa` 최종 lock** (Phase 3 03-01) — @moajoa/core `APP_GROUP_ID` 단일 상수로 노출. app.config.ts / entitlements / Swift `UserDefaults(suiteName:)` 모두 같은 상수 참조. Open Question 해소.
- **Migration 0005 idempotent guard pattern** (Phase 3 03-01) — DO block + IF NOT NULL check로 re-runnable. 향후 ALTER 위주 마이그레이션의 기본 패턴.
- **jest-expo + RNTL 12.7 + jest-native 5.4 채택** (Phase 3 03-01) — Expo SDK 54 호환 라인. apps/ios direct devDep 선언 (Phase 1 D-02 hoist 패턴 재사용).
- **expo-share-intent@^5.1.1 채택** (Phase 3 03-02) — RESEARCH가 6.1.1을 SDK 54 호환으로 주장했으나 npm peer 확인 시 6.x는 `expo: ^55` 요구. 5.1.1이 실제 SDK 54 호환 라인. Plugin API shape (iosAppGroupIdentifier/iosShareExtensionName/iosActivationRules) 동일하여 plan 코드 블록 수정 X. SDK 55 업그레이드(Phase 6+) 시 6.x로 이관.
- **app.config.ts에서 APP_GROUP_ID 리터럴 중복 허용** (Phase 3 03-02) — Expo CLI가 app.config.ts를 standalone 평가(workspace 모듈 import 불가). 로컬 const 선언 + grep 1회 gate로 drift 방지. diff against packages/core/src/constants.ts로 일치 확인.
- **resolve-place FIELD_MASK 5 fields lock** (Phase 3 03-03) — `places.id,places.displayName,places.formattedAddress,places.location,places.primaryType` (Phase 2 D-12 wildcard 금지 lock 준수). Deno test로 회귀 가드.
- **extraction_costs INSERT는 input_tokens/output_tokens split 사용** (Phase 3 03-03) — 0004 스키마 실제 컬럼명. PLAN의 `tokens` 단일 표기는 잘못 (Rule 1 inline fix). 비-LLM 호출은 둘 다 null.
- **`deletePlace = hidePlace` 상수 alias** (Phase 3 03-03) — soft-delete 로직 단일 소스 + UI 의도 일치 이름 제공 (Karpathy §3.2). 새 함수 중복 작성 X.
- **Defense-in-depth in-flight guards in drainPendingLinks + RootLayout** (Phase 3 03-04) — module-level `let inFlight` in pending.ts + useRef inFlight in _layout.tsx. Either alone catches the cold-launch vs AppState 'active' race; both together also catch future cross-call drains (e.g., URL-add path in Plan 03-05).
- **AppState listener cleanup is arrow-wrapped `() => sub.remove()`** (Phase 3 03-04) — RESEARCH Pitfall 4 lock. Bare `.remove` ref loses emitter `this` binding on hot reload.
- **Toast host = module-level `Set<Listener>` singleton, not React context** (Phase 3 03-04) — UI-SPEC §Toast specifies single instance + no queue. Module singleton matches that contract without prop-drilling; `showToast()` callable from any imperative caller including lib/pending.ts.
- **gitignore `ios/` / `android/` anchored with leading slash** (Phase 3 03-04) — unanchored patterns matched apps/ios/modules/shared-defaults/ios/ and silently dropped the Swift file from a feat commit. Always anchor prebuild output ignores.
- **jest infra Rule 1 fixes (testPathIgnorePatterns anchored, setupFiles→setupFilesAfterEnv, pnpm-aware transformIgnorePatterns)** (Phase 3 03-04) — three latent bugs in Plan 03-01's jest config surfaced when the first real test ran. All three fixed inline as Rule 1.
- **PinBottomSheet uses `place.link_id` as AI/manual signal** (Phase 3 03-05) — migration 0004 added `places.source_kind` but Phase 2 legacy INSERTs may not populate it consistently; `link_id IS NULL` is the contract-binding signal for manual pins (add_manual_place RPC leaves it null). Avoids legacy-data branch bugs.
- **"영상에서 위치 보기" v1 = youtube.com search results, not direct timestamp jump** (Phase 3 03-05) — PinBottomSheet receives `Place` only (no `link.url`), so true `&t=Xs` jump deferred to Phase 5 Trust UI. Acceptable per CONTEXT.md deferred #1.
- **min query length 2 chars + defensive `results.slice(0, 5)` in PinAddModal** (Phase 3 03-05) — UI-SPEC didn't lock min query; chosen as researcher discretion to avoid 1-char API noise. slice(0,5) is defense-in-depth against future resolve-place regressions even though D-07 already caps server-side.
- **CITY_KO_MAP in packages/core/src/constants.ts (web + iOS shared)** (Phase 4 04-01) — 9 ko-KR entries (tokyo/osaka/kyoto/seoul/busan/jeju/fukuoka/sapporo/okinawa). I18N-01 v2 deferred. Callers omit city line when city_code missing per D-09.
- **YouTube video_id regex enforces 11-char real-world constraint** (Phase 4 04-01) — `[\w-]{11}` matches actual YouTube ID length. Plan's RED fixture used 12-char `ABC123_def-1` which was a bug; Rule 1 fix replaced with `dQw4w9WgXcQ` (real 11-char ID). Regex unchanged.
- **Static Maps URL signing not applied in v1** (Phase 4 04-01) — D-07 lock honored. URL composed via URLSearchParams (Node encodes ',' as %2C, '|' as %7C — Google accepts both). Max 10 markers truncate caps URL <500 chars.
- **`BOARD_REVALIDATE_TAG` is factory function** (Phase 4 04-01) — `(slug) => 'board:${slug}'` enables type-safe consumers vs. string template. Same tag invalidates both `/b/[slug]` page and OG image per D-03/D-04.
- **Length-prefix guard before `timingSafeEqual`** (Phase 4 04-02) — `node:crypto.timingSafeEqual` THROWS on length mismatch; pre-check `a.length !== b.length` short-circuits without throwing. Leaks only length (acceptable per D-20). Secret length is a known constant (64 hex chars).
- **`/api/revalidate` runtime is `'nodejs'` (NOT edge)** (Phase 4 04-02) — `node:crypto.timingSafeEqual` unavailable in Edge runtime's WebCrypto. RESEARCH §Pitfall 9 lock. D-06 'Edge' references in earlier drafts corrected.
- **Edge Function webhook fires inside try-success branch ONLY** (Phase 4 04-02) — Block placed AFTER successful `broadcastStep('done')` but INSIDE outer try. Failure path's catch handler does NOT invalidate cache (stale-invalidate prevention).
- **`visibility==='public'` gates webhook firing** (Phase 4 04-02) — Private/shared boards skip the POST entirely (D-05 cost lock). `share_slug` presence also required (defensive double-check).
- **Migration 0006 holds 4 parts atomically (column + RPC redef + trigger + backfill)** (Phase 5 05-01) — single file ensures RPC never returns confidence before column exists. Append-only per CLAUDE.md §4.3. Full CREATE OR REPLACE of `public_board_view` with explicit SELECT list (not jsonb || extension) for diff reviewability against 0001_init.sql.
- **`profiles_create_first_board` trigger guard via `NOT EXISTS`** (Phase 5 05-01) — idempotent for replay. ON CONFLICT not viable since `boards` has no unique (owner_id) constraint. Trigger is SECURITY DEFINER + `search_path = public`; NEW.id-only insert limits T-05-03 scope (trigger can only ever insert for the new profile's own id).
- **`rejectAiPlace = hidePlace` alias** (Phase 5 05-01) — mirrors Phase 3 `deletePlace = hidePlace` pattern. Single source of soft-delete semantics, intent-aligned name for low-confidence UI (Karpathy §3.2).
- **`confirmAiPlace` sets `confidence: null` (not 1.0)** (Phase 5 05-01) — D-15 semantics: null != low confidence. After user confirms, UI's `confidence < 0.7` branch can't fire because field is null. Avoids fake high-confidence values polluting future analytics.
- **`pnpm supabase:types` shell-redirect destroys database.ts on failure** (Phase 5 05-01) — `supabase gen typescript --local > packages/api/src/types/database.ts` creates the empty file BEFORE the command runs. If `gen` fails (Docker not running, etc.), only the empty file remains. Always `git checkout HEAD -- packages/api/src/types/database.ts` to recover. Future-proofing: wrap as `supabase gen ... | tee` or a script that writes via tmp + mv.
- **Marker visual = pure function of (source_kind, confidence)** (Phase 5 05-05) — `apps/web/lib/marker-svg.ts buildMarkerIconUrl()` is a side-effect-free string builder; React component just calls it per-place. Enables 8-case vitest matrix without booting Google Maps JS. Mirrors `lib/static-maps.ts` isolation pattern from Phase 4. Future per-pin visual states (votes, ownership badges) should follow same `buildXxxIconUrl` signature.
- **Strict `<` comparison against LOW_CONFIDENCE_THRESHOLD (0.7)** (Phase 5 05-05) — exactly 0.7 is HIGH confidence. Unit-tested explicitly. Matches D-15 semantics: confidence 0.7 means "the LLM is 70% sure" which is the trust floor, not the ceiling of distrust.
- **`undefined` confidence on AI pin → high-conf visual (NOT low-conf)** (Phase 5 05-05) — D-15 plus stale-ISR safety. Vercel may serve cached `public_board_view` RPC payload from before migration 0006; degrading trusted markers to '?' badge during rollout would be worse UX than briefly missing the low-conf treatment. Distinct from `null` (which also means high-conf, but for manual pins and legacy AI pins).
- **PublicBoardView.places uses explicit Pick with new fields enumerated** (Phase 5 05-05) — NOT a spread of full Place. Preserves Phase 4's discipline of never exposing `added_by`/`google_place_id`/`created_at` to anon public clients accidentally. Each new field must be explicitly opted into the public surface.
- **SVG marker uses static literals only — no user-supplied strings** (Phase 5 05-05) — `name_local` flows only to Google Maps SDK `title` attribute (SDK-escaped). T-05-05-01 XSS mitigation by construction, not by sanitization. Any future per-pin label rendered IN SVG must be HTML-entity escaped before interpolation.
- **Provider-defensive marker children fallback** (Phase 5 05-04) — when a native prop (opacity, pinColor) has documented provider drift, encode the same visual intent in a children View as fallback. low-conf marker: opacity prop AND children View with rgba(249,115,22,0.5) circle + ? badge. On Apple Maps that ignores opacity, children carries the signal alone; on providers that honor opacity, both layers stack to obviously-degraded visual. Pattern applies to any future per-pin state (vote count, ownership badge).
- **Trust-action ordering rule** (Phase 5 05-04) — schema-mutating actions (confirm/reject/approve) precede inline-edit actions when both visible in the same sheet. In PinBottomSheet, [확인]/[잘못됨] sit ABOVE 이름 수정 — the schema mutation is the user's primary decision; rename is housekeeping. Margin-branch on 이름 수정 (mt-2 when low-conf, mt-4 otherwise) preserves visual rhythm without restructuring the render block (Karpathy §3.3 surgical).
- **Component contract bumps require fixture updates in the SAME commit** (Phase 5 05-05) — Adding `icon: { scaledSize: g.Size(...), anchor: g.Point(...) }` introduced new `g.Size`/`g.Point` dependencies that broke 3 existing map-options tests. Stubs + fixture extension landed in commit 2464a12 with the component change. Pattern: never let "wave-completion regression" land on a separate commit — they belong together because they encode the same contract change.

### Todos (next session 시작점)

1. `/gsd-discuss-phase 1` — Phase 1 회색지대 결정 (iOS hoisting 결정 트리: A 우선 vs 처음부터 B, NativeWind 4.2 upgrade 타이밍, dev tool 격리 방식)
2. 결정 잠근 후 `/gsd-plan-phase 1` → 승인 후 `/gsd-execute-phase 1`

### Blockers

(없음 — Apple Developer 계정은 가입됨 $99/yr, Share Extension/EAS 게이트 해소됨)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260612-0cx | 유튜브 추출 파이프라인 리뷰 픽스 #1~#6 (max_tokens 잘림·anon 어뷰즈·클레임 레이스/고착·cityHint·키 경고) | 2026-06-12 | f8919bd | [260612-0cx-youtube-pipeline-fixes](./quick/260612-0cx-youtube-pipeline-fixes/) |
| 260612-p0p1 | 도그푸딩 P0/P1: OG 이미지 500(Satori woff2+flex) + 로그인→/boards 루프(?next=+안내 페이지) — 라이브 검증 | 2026-06-12 | 08cb410 | v2-backlog #4·#6 해소 |
| 260612-place | 장소 상세 UX: 통합 리스트(해설+펼침+Google지도/영상점프+inline ❤️) + 0013 view 필드 — 라이브 검증 | 2026-06-12 | 1131357 | 사용자 결정: 투표는 인라인 |

### Open questions (research/SUMMARY.md gaps)

- Pretendard 4 weight 번들 확정 (Regular/Medium/SemiBold/Bold) — Phase 1 디자인
- ~~App Group identifier 최종 (`group.com.serendipitylife.moajoa`) — Phase 3 prebuild 전~~ ✓ resolved by 03-01 (locked in `@moajoa/core` APP_GROUP_ID)
- iOS Google Maps 키 도입 시점 — Phase 6 평가 후
- Resend/Postmark SMTP — Phase 1.5 외부 사용자 전
- Eval sample 영상 10~20개 선정 기준 — Phase 6 시작 시

---

## Session Continuity

다음 세션에서 이어할 때:

1. 본 파일 읽기
2. `.planning/ROADMAP.md` 현재 Phase 섹션 확인
3. `/gsd-resume-work` 또는 `/gsd-progress`
4. Phase 1이라면 `/gsd-discuss-phase 1`

---

## Phase Snapshot

### v1.1 (active milestone)

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 8 | 추출 깊이 (장소·영상 해설) | EXTRACT-12/13/14, VIEW-08 (4) | ✓ 라이브 PASS |
| 9 | 소스 넓이 (블로그·인스타) | SRC-01/02 (2) | ✓ 라이브 PASS (실기기 share-sheet 잔여) |
| 10 | 웹 투표 (협업) | COLLAB-01/02 (2) | ✓ 라이브 PASS (버그 2건 수정) |

**v1.1 Coverage:** 8/8 ✓ · 라이브 검증 3/3 (실기기 share-sheet 1건 후속)

### v1.0 (archived)

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Build Unblock & Hygiene | BUILD-01..03, WEB-01..02 (5) | ✓ Complete |
| 2 | Extraction Pipeline Hardening | EXTRACT-01..06 (6) | ✓ Complete |
| 3 | iOS Save Flow | SAVE-01..05 (5) | Code-complete (UAT pending) |
| 4 | Public Board (Web) | VIEW-01..06 (6) | Code-complete (UAT pending) |
| 5 | Trust UI & Onboarding | TRUST-01..04, ONBOARD-01..02 (6) | Complete (code) |
| 6 | Dogfooding Gate | EXTRACT-07 + 7일 실사용 (1) | Pending (의도적 병행/나중) |
| 7 | Pending-Failed Links Screen | (미할당) | ✓ Complete |

**v1.0 Coverage:** 29/29 ✓

---

## Phase 7 Execution Metrics

| Phase 7 P1 | 5min | 3 tasks | 6 files |

- Phase 7 Plan 07-01 완료: 2026-06-07 (~5분, 3 tasks; commits beca22d feat(헬퍼+export) + 3049f0c feat(failed.tsx 화면) + 104f410 fix(배너 동선 + 스모크 테스트); jest 38/38 PASS 8 suites — +8 신규 회귀 0; typecheck exit 0; zero deviations; 저장-실패 배너 not-found 동선 복구 + 실패 목록 화면 신설(리스트·사유배지·상대시각·행별/전체 재시도·스와이프 삭제·실행취소·empty state); FailedPendingLink export + restoreFailedPending 단일 진입점, drain/classifyError/enqueue 본문 불변; Swipeable는 화면-로컬 GestureHandlerRootView 래핑으로 root _layout.tsx 불변; react-native-gesture-handler/jestSetup import으로 native install() 회피 — 신규 패키지 0; 실기기 UAT는 end-of-phase batch deferred)

## Phase 7 Decisions

- [Phase 7]: FailedPendingLink interface에 export 추가(ReturnType 트릭 대신) — 화면 타입 가독성
- [Phase 7]: 실행취소는 restoreFailedPending(item) 단일 진입점 — 화면이 SharedDefaults/constants 직접 import 회피
- [Phase 7]: Swipeable는 화면-로컬 GestureHandlerRootView로 래핑 — root _layout.tsx 불변(Karpathy §3.3)
- [Phase 7]: gesture-handler 컴포넌트 렌더 테스트는 import 'react-native-gesture-handler/jestSetup' 한 줄로 native install() 회피(신규 패키지 0)

---

*STATE initialized: 2026-05-25 by roadmapper*
