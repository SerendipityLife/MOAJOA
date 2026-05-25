---
phase: 05-trust-ui-onboarding
plan: 05
subsystem: web
tags:
  - web-ui
  - marker-svg
  - trust-parity
  - vitest
  - google-maps

requires:
  - phase: 05-trust-ui-onboarding
    plan: 01
    provides: places.confidence column + public_board_view RPC appended source_kind+confidence + LOW_CONFIDENCE_THRESHOLD constant
  - phase: 04-public-board-web
    provides: PublicBoardMap component (Google Maps JS legacy Marker) + getCachedPublicBoard + UI-SPEC §Component States reassignment

provides:
  - "Visual TRUST-01 parity on /b/[slug] — AI/manual + low/high-confidence pins distinguishable at-a-glance"
  - "Pure-function buildMarkerIconUrl(input) reusable + unit-testable color/opacity matrix"
  - "PlaceSchema + PublicBoardView.places now carry source_kind + confidence (TS contract aligned with migration 0006 RPC)"

affects:
  - "05-06 (Onboarding card — no direct dep but shares /b/[slug] route surface)"
  - "Future v2 web confirm/reject UX — buildMarkerIconUrl already encodes the trust state visually; interaction layer can stack atop without re-deriving"

tech-stack:
  added: []
  patterns:
    - "Pure-function SVG-URL builder isolated from React component for vitest unit coverage (mirrors lib/static-maps.ts pattern from Phase 4)"
    - "Defensive `confidence?: number | null | undefined` accepting all three shapes — stale Vercel ISR payload safe (D-15)"
    - "Per-task fixture extension for test stubs when changing component contract (g.Size + g.Point stub added to map-options.test.ts in same commit as Marker icon wiring)"

key-files:
  created:
    - "apps/web/lib/marker-svg.ts"
    - "apps/web/__tests__/marker-svg.test.ts"
  modified:
    - "apps/web/app/b/[slug]/_components/public-board-map.tsx"
    - "apps/web/__tests__/map-options.test.ts"
    - "packages/core/src/schemas/place.ts"
    - "packages/core/src/types/index.ts"

key-decisions:
  - "Marker URL builder extracted as pure function (apps/web/lib/marker-svg.ts) — vitest coverage 8/8 matrix branches without booting Google Maps JS; mirrors Phase 4 static-maps.ts isolation"
  - "PlaceSchema gains source_kind + confidence as required fields (not `.optional()`) — migration 0006 makes source_kind NOT NULL DEFAULT 'manual' on existing rows; new pins always set it. Web RPC always returns both. Required types catch silent data drift at TS boundary"
  - "PublicBoardView.places Pick extended explicitly rather than spreading whole Place — Pick discipline preserved from Phase 4 (avoids exposing added_by/google_place_id/created_at to public anon clients accidentally)"
  - "`undefined` confidence on AI pin → high-conf visual (not low-conf) — D-15 lock plus stale ISR safety. Vercel may serve cached payload from before migration 0006 apply; degrading trusted markers to '?' badge during rollout would be a worse UX than briefly missing the low-conf treatment"
  - "Strict `<` comparison against LOW_CONFIDENCE_THRESHOLD (0.7) — exactly 0.7 is high-conf. Unit-tested explicitly; threshold lives in @moajoa/core (single source for iOS + web in Wave 4)"
  - "SVG built with only static color/opacity literals — `name_local` and other user-supplied strings NEVER interpolated into SVG (T-05-05-01 XSS mitigation)"
  - "Legacy `g.Marker` retained (NOT migrated to AdvancedMarkerElement) — Phase 4 04-03 already chose legacy Marker; surgical change per Karpathy §3.3"

patterns-established:
  - "Marker visual state is a pure transform of (source_kind, confidence) — any future per-pin badge (votes, ownership, etc.) should follow the same buildXxxIconUrl signature for unit testability"
  - "When extending a component's contract (props/inputs), bump fixtures of existing tests in the SAME commit — prevents wave-completion regressions surfacing in CI"

metrics:
  duration: ~4 minutes
  completed: 2026-05-26
---

# Phase 5 Plan 05 — Web Marker Parity (TRUST-01 Web) Summary

> Google Maps marker color + opacity + "?" badge 분기 by `source_kind` + `confidence` on `/b/[slug]` so the public board visually mirrors iOS trust treatment (TRUST-01).

---

## What Shipped

### `apps/web/lib/marker-svg.ts` (NEW, 45 lines)

Pure `buildMarkerIconUrl({ source_kind, confidence }): string` returning a `data:image/svg+xml;utf-8,<encoded svg>` URL ready for `g.Marker({ icon: { url } })`.

**Matrix (D-06 + D-24 + UI-SPEC §Component States):**

| source_kind | confidence              | fill      | fill-opacity | "?" badge |
|-------------|-------------------------|-----------|--------------|-----------|
| manual      | (any)                   | `#0F172A` | `1.0`        | no        |
| ai          | `null` / `undefined`    | `#F97316` | `1.0`        | no        |
| ai          | `>= 0.7`                | `#F97316` | `1.0`        | no        |
| ai          | `<  0.7`                | `#F97316` | `0.45`       | yes (white) |

SVG: 32×40 teardrop path. Badge: 14px sans-serif white "?" centered at (16, 22).

### `apps/web/__tests__/marker-svg.test.ts` (NEW, 8 tests — 8/8 PASS)

- AI high conf — brand fill, full opacity, no "?"
- AI exactly at threshold (0.7) — NOT low (strict `<`)
- AI low conf (0.4) — brand fill @ 0.45 + "?" white badge
- AI null conf — high (D-15: null != low)
- AI undefined conf — high (stale-ISR safety)
- Manual + null — neutral fill, no badge
- Manual + stray numeric 0.2 — still neutral, no badge (defensive)
- SVG geometry: 32×40 viewBox confirmed

### `apps/web/app/b/[slug]/_components/public-board-map.tsx` (MODIFIED, +13 lines)

`g.Marker(...)` constructor now receives `icon: { url, scaledSize: g.Size(32,40), anchor: g.Point(16,40) }`. Click listener for YouTube new tab unchanged (Phase 4 D-14/D-15/D-16 regression-free).

### `apps/web/__tests__/map-options.test.ts` (MODIFIED)

- Stubbed `g.Size` + `g.Point` ctors (new dependencies introduced by the icon wiring).
- Extended fixture objects with `source_kind` + `confidence` (now required on the props type).

### `packages/core/src/schemas/place.ts` (MODIFIED, +21 lines)

PlaceSchema gains:

```ts
source_kind: z.enum(['ai', 'manual']),
confidence: z.number().min(0).max(1).nullable(),
```

### `packages/core/src/types/index.ts` (MODIFIED)

`PublicBoardView.places` Pick extended with `'source_kind' | 'confidence'`.

---

## Commits (atomic, in order)

1. `8e35322` — `feat(05-05): add source_kind + confidence to Place + PublicBoardView (TRUST-01)`
2. `2464a12` — `feat(05-05): web marker color + opacity differentiation (TRUST-01 web parity)`

---

## Verification

| Check | Result |
|---|---|
| `pnpm -F @moajoa/core typecheck` | PASS |
| `pnpm -F @moajoa/web typecheck` | PASS |
| `pnpm exec vitest run` (apps/web) | 49/49 PASS (8 new + 41 existing) |
| `pnpm -F @moajoa/web build` | green — `/b/[slug]` 2.76 kB / 118 kB First Load |
| OG image route (`opengraph-image.tsx`) | UNCHANGED (D-25 lock) |
| Phase 4 marker click → YouTube new tab | UNCHANGED (D-14 regression-free) |
| Phase 4 map options (gestureHandling/clickableIcons) | UNCHANGED (asserts pass) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Test-stub regression] map-options.test.ts stubbed only `Map` + `Marker`**

- **Found during:** Task 2 (running full vitest suite after marker icon wiring)
- **Issue:** Adding `icon: { scaledSize: new g.Size(...), anchor: new g.Point(...) }` to the Marker ctor broke 3 existing tests because the test stub set `window.google.maps = { Map, Marker }` only — `g.Size` / `g.Point` were undefined.
- **Fix:** Added `Size` + `Point` factory stubs returning plain objects (only ctor identity matters for the existing assertions). Also added `source_kind` + `confidence` to the 2 fixture objects since `PublicBoardView['places']` now requires them at the TS type level.
- **Files modified:** `apps/web/__tests__/map-options.test.ts`
- **Commit:** `2464a12` (same commit as the component change — same wave to keep change atomic)

No Rule 2 or Rule 4 deviations. Plan executed essentially as written; only the test-stub adjustment was emergent from running the suite.

---

## Out of Scope (deferred per plan)

- Web confirm/reject interaction (D-17 readonly lock)
- Web step indicator (iOS-only — TRUST-02)
- Onboarding card (iOS-only — ONBOARD-01)
- OG image AI/manual breakdown — v2

---

## Threat Surface — STRIDE Disposition

| Threat ID | Disposition | Verified |
|-----------|-------------|----------|
| T-05-05-01 (SVG injection via place name_local) | mitigate | YES — `buildMarkerIconUrl` interpolates only static color/opacity literals; `name_local` flows only to the `title` attribute via Google Maps SDK escaping (no inline render path) |
| T-05-05-02 (confidence numeric value leak) | accept | YES — value flows from public RPC (anon-callable) into client SVG opacity only; raw number never rendered as text |

No new threat flags introduced.

---

## Real-Browser UAT (deferred to end-of-phase batch per auto mode)

- [ ] Load `/b/<test-public-slug>` with 1× AI/high + 1× AI/low + 1× manual pin
- [ ] Visually verify: 진한 주황 (AI high), 옅은 주황 + ? (AI low), 진한 검정 (manual)
- [ ] Click each marker → YouTube new tab opens at correct `&t=Xs` (AI pins) / no listener (manual)
- [ ] Mobile Safari iPhone viewport — no marker misalignment (anchor 16,40)
- [ ] OG image (`/b/<slug>/opengraph-image`) byte-identical pre/post 05-05 (D-25)

These require a live RPC payload with non-null confidence values, which depends on user-side `supabase db push` of migration 0006 (still pending from 05-01).

---

## Self-Check: PASSED

- File `apps/web/lib/marker-svg.ts` — FOUND
- File `apps/web/__tests__/marker-svg.test.ts` — FOUND
- File `packages/core/src/schemas/place.ts` modified (source_kind + confidence) — FOUND
- File `packages/core/src/types/index.ts` modified (Pick extended) — FOUND
- File `apps/web/app/b/[slug]/_components/public-board-map.tsx` modified (buildMarkerIconUrl import + icon prop) — FOUND
- Commit `8e35322` — FOUND
- Commit `2464a12` — FOUND
- 49/49 vitest pass — FOUND
- typecheck + build green — FOUND
