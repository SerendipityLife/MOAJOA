---
phase: 24-host-flow
plan: 02
subsystem: api
tags: [ui-tokens, design-tokens, pure-functions, supabase, typed-queries, vitest, tdd]

# Dependency graph
requires:
  - phase: 23-web-share
    provides: TripCreateDraftSchema (companion) + join_moa/share_mode contracts + supabase-js 2.110
  - phase: 24-host-flow (24-01)
    provides: realtime publication + react-day-picker 9.14 (local applied)
provides:
  - colors.member 6-color palette in ui-tokens (D-20, shared web/iOS)
  - memberColor pure fn (host=brand[500], joiners cyclic by join order — MOA-06)
  - sortByLove comparator (love desc, tie seq_no asc, non-mutating — MOA-02)
  - buildMarkerIconUrl optional fill override (ui-tokens literal only, T-24-04)
  - createMoaDraft typed query (companion-bearing trips INSERT — ONBOARD-03)
  - listTripMembers typed query (accepted members, created_at asc — D-20 pin data source)
  - getProfileNames typed query (added_by → display_name map — MOA-06)
affects: [24-04-onboarding, 24-05-list-tab, 24-06-map-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function contract seam locked by unit tests before parallel-wave consumption"
    - "ui-tokens append-only palette shared across web/iOS (colors.member)"
    - "Typed query append alongside existing house contract ({error} throw, client-first arg)"

key-files:
  created:
    - apps/web/lib/member-color.ts
    - apps/web/lib/place-sort.ts
    - packages/api/src/queries/profiles.ts
    - apps/web/__tests__/member-color.test.ts
    - apps/web/__tests__/place-sort.test.ts
    - packages/api/src/queries/profiles.test.ts
  modified:
    - packages/ui-tokens/src/index.ts
    - apps/web/lib/marker-svg.ts
    - packages/api/src/queries/trips.ts
    - packages/api/src/queries/memberships.ts
    - packages/api/src/queries/index.ts

key-decisions:
  - "member palette placed as colors.member array (A-2 exact 6 values) beside category palette, append-only"
  - "buildMarkerIconUrl fill is optional; omitting/undefined yields byte-identical legacy output"
  - "listTripMembers returns TripMember[] (user_id, created_at) — owner has no memberships row by design"

patterns-established:
  - "memberColor: index % palette.length cyclic assignment with defensive index<0 → 0 fallback"
  - "getProfileNames: empty-array short-circuit (no from() call) → {} to avoid an empty .in() query"

requirements-completed: [MOA-02, MOA-06, ONBOARD-03]

# Metrics
duration: 6min
completed: 2026-07-08
---

# Phase 24 Plan 02: Shared Contract Layer Summary

**member palette (6-color, D-20) + memberColor/sortByLove pure fns + marker fill override + 3 typed queries (createMoaDraft/listTripMembers/getProfileNames) — the single-definition seam Waves 2–4 import without exploration.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-08T18:28:00Z
- **Completed:** 2026-07-08T18:33:00Z
- **Tasks:** 3 (all TDD RED→GREEN)
- **Files modified:** 11 (5 created, 6 modified — plus 3 new test files)

## Accomplishments
- ui-tokens `colors.member` 6-color palette locked to UI-SPEC A-2 exact values (`#FF7043` first), shared web/iOS, append-only
- `memberColor` (host=brand[500], joiners cyclic by join order) + `sortByLove` (love desc, tie seq_no asc, non-mutating) pure fns fixed by unit tests
- `buildMarkerIconUrl` gains optional `fill` override for member pins; default path byte-identical (no-injection contract T-24-04 preserved)
- 3 typed queries added — `createMoaDraft` (companion INSERT), `listTripMembers` (D-20 pin data source), `getProfileNames` (MOA-06 nickname map) — existing `createTrip`/`shareMoa`/`getMyTripRole` untouched

## Task Commits

Each task was TDD (test → feat):

1. **Task 1: member palette + memberColor** — `39a5567` (test) → `cba50b7` (feat)
2. **Task 2: sortByLove + marker fill param** — `1f28a20` (test) → `55097c2` (feat)
3. **Task 3: api queries createMoaDraft/listTripMembers/getProfileNames** — `7fee947` (test) → `f401c78` (feat)

## Files Created/Modified
- `packages/ui-tokens/src/index.ts` - append `colors.member` 6-color palette (D-20)
- `apps/web/lib/member-color.ts` - `memberColor` pure fn (join-order cyclic assignment)
- `apps/web/lib/place-sort.ts` - `sortByLove` comparator (love desc, seq_no asc)
- `apps/web/lib/marker-svg.ts` - optional `fill` override on `buildMarkerIconUrl`
- `packages/api/src/queries/trips.ts` - append `createMoaDraft`; import TripCreateDraft
- `packages/api/src/queries/memberships.ts` - append `TripMember` + `listTripMembers`
- `packages/api/src/queries/profiles.ts` - new `getProfileNames`
- `packages/api/src/queries/index.ts` - barrel export `./profiles` (no `.js` ext)
- `apps/web/__tests__/{member-color,place-sort}.test.ts` - new pure-fn suites
- `apps/web/__tests__/marker-svg.test.ts` - append 2 fill cases (existing cases untouched)
- `packages/api/src/queries/{trips,memberships}.test.ts` - append query tests; `profiles.test.ts` new

## Decisions Made
- **member palette shape = array (`colors.member`)** not nested object — cyclic `% length` indexing reads cleanest and matches UI-SPEC A-2 list form.
- **`getProfileNames([])` short-circuits before any `from()`** — avoids an empty `.in()` round-trip and keeps callers free to pass unfiltered `added_by` sets.
- **`listTripMembers` filters `accepted_at is not null`** (mirrors `getMyTripRole` idiom) and orders `created_at asc` so join-order maps directly to palette index.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. All three RED phases failed as expected (import-resolution failures + one assertion failure), all GREEN phases passed on first implementation.

## Test Results
- `@moajoa/web`: 13 files / **77 tests** green (was 65 → +12: member-color 5, place-sort 5, marker-svg +2)
- `@moajoa/api`: 7 files / **88 tests** green (was 81 → +7: createMoaDraft 2, listTripMembers 2, getProfileNames 3) + typecheck exit 0
- `@moajoa/ios`: **128 tests** green — no regression from the ui-tokens palette append
- No `.js` extensions in workspace imports (grep 0); existing `createTrip`/`shareMoa` bodies diff-clean

## Threat Model Compliance
- **T-24-04** (marker fill injection): `fill` doc-comment restricts input to ui-tokens literals; SVG assembly unchanged — no user-string path. ✓
- **T-24-05** (createMoaDraft forge): insert limited to 5 explicit fields; no `seq_no`/`visibility`/`share_slug` sent (grep-asserted). ✓
- **T-24-06** (getProfileNames disclosure): accepted per plan — profiles RLS is read-all-authenticated (0016), nickname exposure is product requirement MOA-06. ✓

## Next Phase Readiness
- Contract seam complete: 24-04 (onboarding) imports `createMoaDraft`; 24-05 (list) imports `sortByLove` + `getProfileNames`; 24-06 (map) imports `memberColor` + `listTripMembers` + `buildMarkerIconUrl` fill.
- No blockers. Waves 2–4 can build against these definitions without exploration.

## Self-Check: PASSED

All 7 declared files exist on disk and all 6 task commits (3 RED + 3 GREEN) resolve in git history.

---
*Phase: 24-host-flow*
*Completed: 2026-07-08*
