# Dogfooding Incidents Log (D-17 / D-18 lock)

> Production 실패 발생 즉시 1행 append. 7일 종료 후 "End-of-Week Tally"를 Plan 06-05 pass-evaluator의 입력으로.
>
> **Append-only:** 발견 즉시 추가. 본 파일 row 수정/삭제 X (감사 추적). resolution이 늦게 결정되면 별도 commit으로 update.

---

## Label policy (D-17)

| Label | Definition | Trigger |
|-------|-----------|---------|
| `P0` | Core flow가 막힘. dogfooding 진행 불가 또는 신뢰 0 | "링크 추가했는데 핀 0개 영구 / 앱 cold launch 흰 화면 / RLS 거부로 본인 보드 접근 불가" |
| `P1` | Core flow 동작은 하지만 UX 손상. dogfooding은 계속 진행 가능 | "OG 카드 한글 깨짐 / step indicator 안 보임 / toast retry 무한 loop / 핀 누락 일부" |
| `expected-v1-limit` | 알려진 v1 범위 한계. 새로 발견된 게 아님 | "협업 투표 미구현 / OAuth 미지원 / 다크모드 X / `/discover` 피드 X" |
| `noise` | 추출 LLM의 일회성 hallucination — pattern 아닌 random | "한 영상에서 wrong_place 1건, 재시도 시 정상 — 재현 불가" |

## Pass impact (D-20 / D-21)

- **P0 ≤ 1** (당일 fix 완료) → Pass 가능
- **P0 ≥ 2** → **Fail** → Phase 6.2 안정성 보강 추천 (per Plan 06-05 pass-evaluator)
- **P1** → 모두 v2 backlog 또는 GitHub issue 등록 → Pass 시 그대로 v2 시드
- **expected-v1-limit** → 그냥 기록만 (Pass 영향 X)
- **noise** → 1~2건 정상, ≥ 3건이면 P1으로 reclassify

---

## Incidents

| # | Date | Label | Description | Resolution or v2-backlog ref |
|---|------|-------|-------------|------------------------------|
| 1 | 2026-05-28 | P0 (pre-dogfooding gate) | Web `/b/<slug>` returned HTTP 500 — `cookies()` (Next.js dynamic API) called inside `unstable_cache` scope in `apps/web/lib/cache.ts`. Every public board fetch broke. | **FIXED same-day commit `bba2cb9`** — rebuilt anon `createClient` inside cache callback (RPC is SECURITY DEFINER, cookies irrelevant). Web tests 49/49 pass after fix. Verified `/b/nonexistent-test` → 404 (was 500). |
| 2 | 2026-05-28 | P0 (pre-dogfooding gate) | iOS Metro bundle failed — `@gorhom/portal@1.0.14` is a transitive dep of `@gorhom/bottom-sheet@5.2.14` but pnpm's flat `.pnpm/` store does not nest transitives under the workspace's own `node_modules`, so Metro's `nodeModulesPaths` walk couldn't resolve it. | **FIXED same-day commit `2945fbe`** — added `@gorhom/portal@1.0.14` as explicit dependency in `apps/ios/package.json`. Metro bundle then succeeds (1686 modules). |
| 3 | 2026-05-29 | P0 (pre-dogfooding gate) | iOS Release build failed at "Bundle React Native code and images" with `Invalid expression encountered`. Hoisted `@supabase/supabase-js@2.106.1` wraps OpenTelemetry trace-context loader in `import(/* webpackIgnore */ /* turbopackIgnore */ /* @vite-ignore */ OTEL_PKG)` — magic-comment syntax that Hermes/JSC bundler validation rejects. | **FIXED same-day commit `2945fbe`** — pinned `@supabase/supabase-js: 2.45.4` via root `pnpm.overrides` (2.45.x has no OpenTelemetry path). Also added belt-and-suspenders `jsEngine: 'jsc'` in `app.config.ts`. Exposed a secondary transitive `@supabase/node-fetch@2.6.15` (2.45.x dep) — added as explicit dependency. v2-backlog: re-enable Hermes once babel transform strips magic comments or Hermes adopts the grammar. |
| 4 | 2026-05-29 | P0 (pre-dogfooding gate) | iOS Release build install + launched but immediately crashed with JS runtime exception `Cannot find native module 'SharedDefaults'`. Local Expo native module at `apps/ios/modules/shared-defaults/` was created in Phase 3 with `expo-module.config.json` + `SharedDefaultsModule.swift` but missing `package.json` and `.podspec` — `expo-modules-autolinking resolve` excluded it. | **FIXED same-day commit `2945fbe`** — registered `apps/ios/modules/*` as a pnpm workspace path (symlink lands at `apps/ios/node_modules/shared-defaults`). Added minimal `package.json` (name/version/license/author/homepage). Added `SharedDefaultsModule.podspec` mirroring `expo-share-intent` structure. `npx expo-modules-autolinking resolve --platform ios --json` now lists `shared-defaults`; `SharedDefaultsModule (0.0.0)` appears in Podfile.lock; iPhone 16 Pro sim cold launch shows the login screen with NativeWind styling intact. |
| 5 | 2026-05-29 | P0 (dogfooding day 1) | `/b/<slug>/opengraph-image` route returns `content-type: image/png` headers + HTTP 200 on HEAD, but GET returns HTML `Internal Server Error 500` page as body (Vercel `x-vercel-cache: MISS`). Friend share preview (E-3 카톡 OG) will show a broken/placeholder image. Reproduced on slug `gkaswquxpyic`. | **OPEN — fix deferred** — Vercel runtime logs (error/fatal level) empty for the 500, suggesting an uncaught throw inside ImageResponse rendering. Fonts (`apps/web/public/fonts/Pretendard-*.subset.woff2`) are git-tracked and load OK locally. Likely candidates: `process.cwd()` resolving differently on Vercel monorepo lambdas vs local dev, or `ImageResponse` choking on font buffer. **Fix plan:** wrap `loadPretendardFonts()` + `ImageResponse(...)` in try/catch with `console.error('[og-image]', err.stack)`, redeploy, inspect logs, then patch the root cause (likely path via `path.resolve(__dirname, ...)` or font import via `next/font` instead of fs read). User-actionable on return — dogfooding can proceed because the public board page itself (`/b/<slug>`) renders fine; only the OG card image is broken. |

*(Pre-dogfooding gate incidents (#1-#4) all P0 by definition (production-blocking), all fixed same-day per checklist D-02 P0 policy. Per project convention these are "build-readiness" P0s discovered by Phase 6 — they don't count against the dogfooding "P0 ≤ 1" criterion below, which measures dogfooding-week incidents only. Distinction documented here so future review understands why End-of-Week Tally may show 0 P0 while incidents list has 4.)*

---

## End-of-Week Tally (Day 7 종료 시 본인이 집계)

- **P0 incidents:** ___ 건 (모두 fix complete? Y/N)
- **P1 incidents:** ___ 건 (모두 v2-backlog 등록? Y/N)
- **expected-v1-limit:** ___ 건 (기록만 — Pass 영향 X)
- **noise:** ___ 건 (≥ 3이면 P1으로 reclassify 필요)

→ Plan 06-05 `pass-evaluator.md` Criterion 5a / 5b 입력.

---

## Reclassification log (선택)

발견 시점 label을 나중에 바꾸는 경우 (예: noise였는데 같은 pattern 3번 발생 → P1):

| # | Reclassified date | From → To | Reason |
|---|------|-----------|--------|

---

*Incidents log per Phase 6 D-17 / D-18. Append-only — row 수정 X.*
*Document created: 2026-05-26 (Plan 06-03 Task 1)*
