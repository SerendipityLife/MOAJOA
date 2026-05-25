---
phase: 04-public-board-web
plan: 03
subsystem: ssr-page + map-options + viewport + metadata + not-found + error-boundary
tags:
  - ssr-page
  - viewport-meta
  - generate-metadata
  - public-board-map
  - gesture-handling
  - youtube-jump
  - not-found
  - error-boundary
  - typography-reassignment
dependency_graph:
  requires:
    - "04-01 helpers (getCachedPublicBoard, buildYouTubeWatchUrl, CITY_KO_MAP, getBaseUrl)"
    - "Existing PublicBoardMap script-tag loader pattern (data-moajoa-gmaps)"
  provides:
    - "VIEW-01 cache wrap on SSR page"
    - "VIEW-02 viewport export + mobile map options + h-[60vh]"
    - "VIEW-04 description / twitter / canonical / robots metadata"
    - "VIEW-05 pin click → YouTube `?t=Xs` new tab"
    - "not-found.tsx + error.tsx surfaces for /b/[slug]"
  affects:
    - "04-04 OG image (relative `/b/[slug]/opengraph-image` URL absolutized by metadataBase)"
    - "Visual lock for Phase 4 web — UI-SPEC reassignment audit applied"
tech_stack:
  added: []
  patterns:
    - "viewport export (Next 15) replaces metaviewport"
    - "PublicBoardMap accepts `links` for marker → YouTube lookup (D-16)"
    - "Vitest esbuild.jsx 'automatic' to render React 19 components without manual React import"
key_files:
  created:
    - "apps/web/app/b/[slug]/not-found.tsx"
    - "apps/web/app/b/[slug]/error.tsx"
    - "apps/web/__tests__/metadata.test.ts"
    - "apps/web/__tests__/map-options.test.ts"
  modified:
    - "apps/web/app/layout.tsx (viewport export + metadataBase)"
    - "apps/web/app/b/[slug]/page.tsx (cache wrap + extended generateMetadata + UI-SPEC reassignment)"
    - "apps/web/app/b/[slug]/_components/public-board-map.tsx (links prop + gestureHandling + pin onClick)"
    - "apps/web/vitest.config.ts (esbuild.jsx automatic)"
    - "apps/web/__tests__/cache-key.test.ts (Rule 3 fix — non-null assertions)"
decisions:
  - "viewport.maximumScale:5 (NOT 1) to preserve WCAG 1.4.4 — confirmed per D-13"
  - "Empty state (places.length===0) replaces the map container with the bg-neutral-50 card per UI-SPEC §4; PublicBoardMap fills 100% of its parent so the outer h-[60vh] md:h-[520px] lives on page.tsx"
  - "Marker click listener only registered when place.link_id maps to a link with a valid YouTube watch URL (defensive — buildYouTubeWatchUrl returns null on non-YouTube)"
  - "vitest esbuild.jsx:'automatic' added because React 19 components don't import React; without this, RTL render throws ReferenceError: React is not defined"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-26"
  tasks_total: 3
  tasks_completed: 2
  tasks_deferred: 1
  files_created: 4
  files_modified: 5
  tests_added: 8
  commits: 2
real_browser_uat_status: deferred
---

# Phase 4 Plan 3: SSR Page + Viewport + Map + Metadata Summary

**One-liner:** Phase 4 web의 viewer-facing 사양을 한 plan에 lock — viewport export(D-13), getCachedPublicBoard wrap(D-03 from 04-01), extended SEO meta (description templates + twitter:summary_large_image + canonical + robots, D-09), PublicBoardMap gestureHandling + clickableIcons + 핀 클릭 → YouTube 새 탭(D-12/D-14/D-15/D-16), UI-SPEC §1 typography reassignment audit 적용, not-found.tsx + error.tsx 신규.

---

## Tests Added (8 across 2 files)

| File | Tests | Coverage |
| --- | --- | --- |
| `apps/web/__tests__/metadata.test.ts` | 5 | description template (city 있음 + 없음), title format, twitter card = summary_large_image, alternates.canonical, robots.index — `notFound` short-circuit when slug missing |
| `apps/web/__tests__/map-options.test.ts` | 3 | Map init opts (gestureHandling 'greedy', clickableIcons false, disableDefaultUI, zoomControl), marker click listener registered when link_id valid, NOT registered when link_id null |

Full suite: `pnpm --filter @moajoa/web test:run` → **37/37 PASS** (cache-key 1 + static-maps 6 + youtube-id 13 + map-options 3 + metadata 5 + cache-tag 1 + api-revalidate 8).

---

## UI-SPEC §1 Reassignment Audit Applied

All 6 reassignments from UI-SPEC active-scale lock (4 sizes / 2 weights):

| Use site | Before | After |
| --- | --- | --- |
| owner 라벨 | `text-xs uppercase tracking-wide text-neutral-500` | `text-sm text-neutral-500` |
| 보드 제목 H1 | `text-3xl font-semibold` | `text-2xl font-semibold text-neutral-900 leading-tight` |
| 보드 description | `text-neutral-600 mt-2` | `text-base text-neutral-600 mt-2` |
| 섹션 헤더 | `text-sm font-medium text-neutral-700 mb-3` + `"영상 출처 ({N})"` | `text-lg font-semibold text-neutral-900 mb-3` + `"영상 출처 N개"` |
| 카드 제목 | `text-sm font-medium truncate` | `text-base font-semibold text-neutral-900 line-clamp-2` |
| 카드 작성자 | `text-xs text-neutral-500 mt-1` | `text-sm text-neutral-500 mt-1` |
| Map 높이 | `h-[420px] md:h-[520px]` | `h-[60vh] md:h-[520px]` (D-11) |
| 영상 카드 hover | (없음) | `hover:border-brand-300 hover:bg-brand-50 transition-colors` (brand reserved-for #3) |
| Footer | (없음) | brand-500 wordmark + `이 보드는 MOAJOA로 만들었어요` neutral-500 |

`text-xs`, `text-3xl`, `font-medium`, `font-bold` weight 모두 의도적으로 사용 안 함 — active set 잠금 유지.

---

## VIEW Requirements Status

| Req | Status | Evidence |
| --- | --- | --- |
| VIEW-01 (SSR + cache p90<800ms) | code-complete | page.tsx + generateMetadata 모두 `getCachedPublicBoard(slug)` 사용 — 04-01 unstable_cache + tag로 cache hit 후 RPC skip. p90 TTFB는 실측 시 Phase 6 측정 |
| VIEW-02 (모바일 viewport + 지도) | code-complete | layout.tsx `maximumScale:5`, PublicBoardMap `gestureHandling 'greedy' + clickableIcons false`, map container `h-[60vh] md:h-[520px]` |
| VIEW-04 (SEO meta) | code-complete | description / twitter:summary_large_image / alternates.canonical / robots.index — 5 vitest로 회귀 가드 |
| VIEW-05 (핀 탭 → YouTube `?t=Xs`) | code-complete | marker.addListener('click') → window.open(buildYouTubeWatchUrl(...), '_blank', 'noopener,noreferrer'). link_id null이면 등록 안 함 |

VIEW-03(OG image)은 04-04 scope. VIEW-06(webhook)은 04-02 완료.

---

## Verification Greps (all pass)

```
maximumScale: 5 in apps/web/app/layout.tsx                      → 1 hit
gestureHandling in public-board-map.tsx                         → 1 hit (option)
clickableIcons: false in public-board-map.tsx                   → 1 hit
buildYouTubeWatchUrl in public-board-map.tsx                    → 1 hit (call)
getCachedPublicBoard in page.tsx                                → 3 hits (import + generateMetadata + page)
summary_large_image in page.tsx                                 → 1 hit
robots: { in page.tsx                                            → 1 hit
alternates: { in page.tsx                                        → 1 hit
metadataBase in layout.tsx                                       → 1 hit
h-[60vh] md:h-[520px] in page.tsx                                → 1 hit
"이 보드는 MOAJOA로 만들었어요" in page.tsx                       → 1 hit
.js extension on @moajoa/* imports in apps/web/                  → 0 hits ✓ (CLAUDE.md §4.5)
not-found.tsx exists                                             → ✓
error.tsx exists                                                 → ✓
```

`pnpm --filter @moajoa/web typecheck` → exit 0.
`pnpm --filter @moajoa/web build` → success, `/b/[slug]` listed as `ƒ` (dynamic), 1.17 kB route.

---

## Deviations from Plan

### Rule 3 — Vitest JSX runtime needed `esbuild.jsx: 'automatic'`

**Found during:** Task 2 first `pnpm test:run -- map-options` execution.

**Issue:** Rendering `<PublicBoardMap />` via @testing-library/react threw `ReferenceError: React is not defined` because the component file (`public-board-map.tsx`) doesn't import React (Next/SWC injects react/jsx-runtime automatically; React 19 + Next 15 standard). Vitest's default esbuild jsx transform doesn't auto-inject.

**Fix:** Added `esbuild: { jsx: 'automatic' }` to `apps/web/vitest.config.ts`. Single 3-line block (Karpathy §3.2 — minimum surgical change).

**Files modified:** `apps/web/vitest.config.ts`.

**Commit:** `4704faa` (bundled with Task 2 implementation).

**Rationale:** This is a Rule 3 (blocking — couldn't run map-options.test.ts otherwise) auto-fix. The fix is also forward-compat — future TSX tests in this repo will work without manual React imports.

### Rule 3 — Pre-existing `cache-key.test.ts` strict TS errors

**Found during:** Task 1 `pnpm typecheck` after page.tsx rewrite.

**Issue:** 7 TS2532 ("Object is possibly 'undefined'") errors on `calls[0].keyParts` / `calls[1].keyParts` in the cache-key isolation test (created by Plan 04-02). The errors pre-existed my changes — confirmed by checking `git log` shows the file in commit `060484f` (Plan 04-02 RED). The test passed runtime because the array length is asserted first.

**Fix:** Single-line — add `!` non-null assertion after `calls[0]`/`calls[1]`. Safe because `expect(calls.length).toBe(2)` is asserted on line 37 before any indexed access.

**Files modified:** `apps/web/__tests__/cache-key.test.ts`.

**Commit:** `4704faa` (bundled with Task 2 — vitest config fix touches similar surface).

**Rationale:** Rule 3 (blocking — my success criteria required `pnpm typecheck` clean). Fix is one character per line, no logic change. Plan 04-02 should have caught this in its own checker step; logging in Phase 4 deferred-items would be appropriate, but the fix is so small that fixing inline is the lower-friction option.

### Rule 1 — `@ts-expect-error` was unused in map-options.test.ts

**Found during:** Same typecheck pass.

**Issue:** Plan provided a `// @ts-expect-error cleanup` comment above `delete (window as ...).google;`, but the surrounding `as unknown as { google?: unknown }` cast already satisfies strict TS — the directive was unused (TS2578).

**Fix:** Removed the dangling `// @ts-expect-error` line. The cast itself is preserved.

**Commit:** `4704faa`.

**Rationale:** Rule 1 — defect in plan example; fix is removal of a single comment.

### Other deviations
None. UI-SPEC reassignments applied verbatim; D-09 description templates verbatim; D-12 map options verbatim.

---

## Architecture Decisions

### 1. PublicBoardMap fills 100% of parent
Outer `h-[60vh] md:h-[520px]` container lives in `page.tsx` (next to the empty-state replacement block). The map component renders `<div className="w-full h-full">`. This is intentional: empty-state uses the same height envelope as the map without inheriting map-specific CSS — UI-SPEC §4 + §1 layout-symmetry constraint.

### 2. Marker click registers only on valid YouTube URLs
The handler is guarded twice: `if (p.link_id)` → `if (link?.url)` → `if (youtubeUrl !== null)`. Non-YouTube source URLs (D-16 manual pins or blog/IG links) produce silent no-op pins, matching D-14 lock ("핀 = 영상 확인 용도"). Phase 5 Trust UI may add source_kind-specific marker styling later.

### 3. Empty-state copy NOT differentiated for "분석 완료 + 0건"
Both "추출 진행 중" and "추출 끝, 0 places resolved" surface the same copy ("아직 분석 중이에요" / "잠시 후 다시 열어주세요"). UI-SPEC §4 lock — differentiation deferred to Phase 5 Trust UI.

### 4. Footer wordmark uses text (not SVG)
UI-SPEC §"Visual Reference" allows either text "MOAJOA" or SVG wordmark. Text route chosen — minimum bundle delta, brand-500 `text-base font-semibold` already in the type/color contract.

---

## Real-Browser UAT — Deferred (Auto Mode)

Per plan Task 3 `checkpoint:human-verify` and the auto-mode dispatch, the manual UAT is **deferred to end-of-phase batch**.

`real_browser_uat_status: deferred`

When unblocked, the UAT script (from 04-03-PLAN Task 3) covers:
1. Mobile viewport (iPhone 14 Pro DevTools) — page renders px-4 gutter, H1 24px, owner 14px, map h-[60vh], pinch-zoom works.
2. Desktop ≥768px — max-w-5xl center, h-[520px] map, video card hover state.
3. Pin tap → YouTube new tab (`?t=Xs` when timestamp present).
4. SEO meta (view-source check) — title, description template, viewport=device-width+initial-scale=1+maximum-scale=5, og:*, twitter:card=summary_large_image, canonical, robots=index,follow.
5. /b/nonexistent → "보드를 찾을 수 없어요".
6. Forced throw → "문제가 생겼어요" + "다시 시도" reset button.

No production board with public slug currently exists for this dev environment; UAT requires either dev-tool board creation + manual visibility flip OR a real iOS-Phase-3 produced board. Both pathways are unblocked but require the user to step in (auth + manual data).

---

## Open Issues for 04-04 (OG Image)

1. **`/b/{slug}/opengraph-image` URL is referenced in generateMetadata** (`images: [`/b/${slug}/opengraph-image`]`) but the route doesn't exist yet. Until 04-04 lands, scraper requests for og:image will 404. metadataBase makes the URL absolute (`https://moajoa.app/b/.../opengraph-image`); browsers ignore 404 og:image gracefully, so this is not a regression for the page itself.

2. **Pretendard `.otf` 4-weight bundle size check** — RESEARCH §"Open Issues for Downstream Plans" #1 flagged ~520KB. 04-04 will verify and possibly switch to subset/woff2.

3. **Empty-state copy ambiguity** — "아직 분석 중이에요" applies both during extraction and after 0-result completion. UX confusion may surface in Phase 6 dogfooding — flagged for Phase 5 Trust UI redesign.

---

## TDD Gate Compliance

Plan is `type: execute` (not `type: tdd`) — no plan-level RED/GREEN/REFACTOR gate. Tests were added alongside implementation; both metadata.test.ts (5/5) and map-options.test.ts (3/3) pass GREEN on first run after implementation. The gate sequence applies to test+feat ordering across the two commits:

| Commit | Type | Files |
| --- | --- | --- |
| `ef951e0` | feat | page.tsx + layout.tsx + not-found + error + metadata.test.ts |
| `4704faa` | feat | public-board-map.tsx + map-options.test.ts + vitest.config + cache-key fix |

---

## Self-Check: PASSED

**Files verified to exist:**
- `apps/web/app/layout.tsx` (modified — viewport + metadataBase) ✓
- `apps/web/app/b/[slug]/page.tsx` (modified — cache + extended metadata + reassignment) ✓
- `apps/web/app/b/[slug]/_components/public-board-map.tsx` (modified — links + gestureHandling + onClick) ✓
- `apps/web/app/b/[slug]/not-found.tsx` (new) ✓
- `apps/web/app/b/[slug]/error.tsx` (new, 'use client') ✓
- `apps/web/__tests__/metadata.test.ts` (new, 5 tests) ✓
- `apps/web/__tests__/map-options.test.ts` (new, 3 tests) ✓
- `apps/web/vitest.config.ts` (modified — esbuild.jsx automatic) ✓
- `apps/web/__tests__/cache-key.test.ts` (modified — non-null assertions) ✓

**Commits verified in git log:**
- `ef951e0` feat(04-03): SSR page + viewport + metadata templates + not-found + error boundary ✓
- `4704faa` feat(04-03): PublicBoardMap gestureHandling + pin click YouTube jump ✓

**Verification commands:**
- `pnpm --filter @moajoa/web test:run` → 37/37 pass (8 new + 29 existing)
- `pnpm --filter @moajoa/web typecheck` → exit 0
- `pnpm --filter @moajoa/web build` → success, /b/[slug] route registered
- `grep -rn "from '@moajoa/.*\.js'" apps/web/` → 0 hits (CLAUDE.md §4.5 compliance)
