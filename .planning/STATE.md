---
gsd-state-version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-05-26T03:08:00.000Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 16
  completed_plans: 13
  partial_plans: 0
  percent: 81
stopped_at: Phase 4 Wave 2 partial — 04-02 ✓ 2026-05-26 (apps/web/app/api/revalidate/route.ts Node-runtime + zod body + node:crypto timingSafeEqual + revalidateTag(BOARD_REVALIDATE_TAG(slug)); supabase/functions/extract-youtube/index.ts +26 lines fire-and-forget POST after broadcastStep('done') with visibility='public' gate + Deno.env WEB_BASE_URL/REVALIDATE_SECRET guards; 9/9 new tests pass — 8 api-revalidate matrix + 1 cache-key isolation Pitfall 1 guard; total 34/34 tests pass; 4 commits 3cf1899 RED + 9d5164f GREEN + 060484f cache-key + c87fd59 webhook; deferred-items.md tracks 9 pre-existing deno check errors in extract-youtube/index.ts — unrelated to my changes). 04-03 still in progress (page.tsx/layout.tsx/metadata.test.ts uncommitted in working tree). Wave 3 (04-04 OG image) unblocked.
---

# STATE: MOAJOA v1

**Last updated:** 2026-05-25
**Milestone:** v1 (MVP — self-dogfooding 가능선)

---

## Project Reference

- **Core Value:** 링크 → 30초 안에 지도 위의 핀
- **Out of Scope (v1):** 협업 투표 UI · `/discover` 피드 · 블로그/IG 자동 추출 · OAuth · i18n · 다크 모드 · 에러 트래킹 · CI · Flutter 코드 참조
- **Dogfooding Gate:** 본인 일본/서울 여행 7일 연속 사용 + 보드 10핀+ + 친구 카톡 공유 모바일 열림

자세한 컨텍스트: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

---

## Current Position

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
- **Phase 4 Wave 2:** ⚙ 04-02 완료 2026-05-26 (~3분, 3 tasks TDD; commits 3cf1899 RED + 9d5164f GREEN + 060484f cache-key + c87fd59 Edge Function webhook). /api/revalidate Node-runtime route + timing-safe secret + Edge Function fire-and-forget POST after done broadcast. 9/9 new tests (8 api-revalidate matrix + 1 cache-key Pitfall 1 guard) — 34/34 total. 04-03 still in progress.
- **Next action:** Complete 04-03 (page.tsx + PublicBoardMap + layout viewport) then Wave 3 04-04 (OG image).
- **Progress:** [█████████] Overall 13/16 plans (Phase 1 + 2 완료 + Phase 3 5/5 code-complete + Phase 4 2/4 done; UAT-pending for Phase 3).

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

---

## Accumulated Context

### Decisions (Roadmap 단계에서 확정)

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

### Todos (next session 시작점)

1. `/gsd-discuss-phase 1` — Phase 1 회색지대 결정 (iOS hoisting 결정 트리: A 우선 vs 처음부터 B, NativeWind 4.2 upgrade 타이밍, dev tool 격리 방식)
2. 결정 잠근 후 `/gsd-plan-phase 1` → 승인 후 `/gsd-execute-phase 1`

### Blockers

(없음 — Apple Developer 계정은 가입됨 $99/yr, Share Extension/EAS 게이트 해소됨)

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

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Build Unblock & Hygiene | BUILD-01..03, WEB-01..02 (5) | ✓ Complete |
| 2 | Extraction Pipeline Hardening | EXTRACT-01..06 (6) | ✓ Complete |
| 3 | iOS Save Flow | SAVE-01..05 (5) | Code-complete (UAT pending) |
| 4 | Public Board (Web) | VIEW-01..06 (6) | **Current (Wave 1 done)** |
| 5 | Trust UI & Onboarding | TRUST-01..04, ONBOARD-01..02 (6) | Pending |
| 6 | Dogfooding Gate | EXTRACT-07 + 7일 실사용 (1) | Pending |

**Coverage:** 29/29 ✓

---

*STATE initialized: 2026-05-25 by roadmapper*
