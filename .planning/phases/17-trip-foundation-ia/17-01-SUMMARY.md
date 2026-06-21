---
phase: 17-trip-foundation-ia
plan: 01
subsystem: api
tags: [zod, vitest, trip-contract, entry-route, packages-core, monorepo]

# Dependency graph
requires:
  - phase: 16-ios-share-receive
    provides: existing packages/core Zod schemas (Board) + constants vocabulary
provides:
  - "@moajoa/core exports canonical Trip / TripId / TripCreateSchema / TripCreate / TripUpdate"
  - "TripCreateSchema enforces required dates + end>=start (SETUP-01); representative_id in TripSchema (SETUP-02)"
  - "decideEntryRoute pure function for 0/1/N entry branch with delete fallback (NAV-01)"
  - "TripKeys.LastTripId namespaced AsyncStorage key"
  - "vitest bound as the packages/core test runner"
affects: [18-plan-flow, 19-date-vote, 20-booking, 21-ledger, trip-rename-plan-03]

# Tech tracking
tech-stack:
  added: ["vitest ^1.6.0 (devDependency in packages/core, matches apps/web)"]
  patterns:
    - "Pure decision function placed in packages/core (no React Native dep) so vitest can gate NAV-01"
    - "Zod .refine for cross-field date validation at the trust boundary"
    - "Namespaced AsyncStorage key constant object (TripKeys mirrors OnboardKeys)"

key-files:
  created:
    - packages/core/vitest.config.ts
    - packages/core/src/schemas/trip.ts
    - packages/core/src/schemas/trip.test.ts
    - packages/core/src/entry-route.ts
    - packages/core/src/entry-route.test.ts
  modified:
    - packages/core/package.json
    - packages/core/src/schemas/index.ts
    - packages/core/src/constants.ts
    - packages/core/src/types/index.ts
    - packages/core/src/index.ts
  deleted:
    - packages/core/src/schemas/board.ts

key-decisions:
  - "Clean break: board.ts deleted, no Board alias kept (D-13 spirit) — Trip is the single canonical contract"
  - "vitest pinned to ^1.6.0 to match apps/web (plan offered ^2.1.0 OR apps/web version; chose consistency)"
  - "decideEntryRoute lives in packages/core (not apps/ios) so NAV-01 is automatable in vitest"
  - "Only the three Limits keys + BoardVisibility renamed in core; LinksPerBoard/MembersPerBoard/LastBoardId left for Plan 03 per plan verification note"

patterns-established:
  - "Cross-field Zod validation via .refine(end >= start) at the user-input trust boundary"
  - "Pure policy functions in core/ for unit-testability away from RN/jest"

requirements-completed: [NAV-01, SETUP-01, SETUP-02]

# Metrics
duration: ~7 min
completed: 2026-06-21
---

# Phase 17 Plan 01: Trip Foundation Contract Summary

**Canonical `Trip`/`TripId`/`TripCreateSchema` Zod contract (required dates + end>=start refine + `representative_id`), the `decideEntryRoute` 0/1/N pure function, and `TripKeys` namespace — all gated by a newly-wired vitest runner in `packages/core`.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-21T11:43:00Z (approx)
- **Completed:** 2026-06-21T11:49:33Z
- **Tasks:** 3
- **Files modified:** 11 (5 created, 5 modified, 1 deleted)

## Accomplishments
- Wired vitest as the `packages/core` test runner — the existing `category.test.ts` (22 tests) was previously unrunnable (Wave 0 blocker cleared).
- Renamed the trip-shaped `Board` Zod into the canonical `Trip` contract; added `representative_id` (SETUP-02) and a `TripCreateSchema` that requires `start_date`/`end_date` and rejects `end < start` while allowing day-trips (SETUP-01, D-09).
- Added `decideEntryRoute` — a pure 0→onboarding / 1→that-trip / N→last-viewed (with deleted-last fallback) function (NAV-01), unit-tested for all 5 branches.
- Added `TripKeys.LastTripId` (`@moajoa/trip:last_id`) AsyncStorage namespace key.
- Renamed `Limits.Boards*` → `Trips*` and `BoardVisibility` → `TripVisibility` in constants.

## Task Commits

Each task was committed atomically (TDD tasks use RED → GREEN):

1. **Task 1: Wire vitest in packages/core** — `84a353e` (chore)
2. **Task 2: Trip Zod contract + constants + TripKeys** — `5501f2a` (test/RED) → `a498858` (feat/GREEN)
3. **Task 3: decideEntryRoute + barrel export** — `a3ee35d` (test/RED) → `66faefc` (feat/GREEN)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified
- `packages/core/vitest.config.ts` — vitest runner config (node env, `src/**/*.test.ts`).
- `packages/core/src/schemas/trip.ts` — TripSchema (+`representative_id`), TripCreateSchema (required dates + refine), TripUpdateSchema; `Trip`/`TripId`/`TripCreate`/`TripUpdate` types.
- `packages/core/src/schemas/trip.test.ts` — 8 tests covering create-validation + full-row + TripId type.
- `packages/core/src/entry-route.ts` — `decideEntryRoute` pure function.
- `packages/core/src/entry-route.test.ts` — 5 tests covering 0/1/N + deleted-last edge.
- `packages/core/package.json` — `test: vitest run`, `test:watch: vitest`, `vitest ^1.6.0` devDep.
- `packages/core/src/schemas/index.ts` — barrel `./board` → `./trip`.
- `packages/core/src/constants.ts` — Limits `Trips*` rename, `TripVisibility`, new `TripKeys`.
- `packages/core/src/types/index.ts` — composite view types repointed `Board` → `Trip` (deletion fixup).
- `packages/core/src/index.ts` — added `export * from './entry-route'`.
- `packages/core/src/schemas/board.ts` — **deleted** (clean break, no alias).

## Decisions Made
- **vitest version ^1.6.0** (not ^2.1.0): the plan permitted matching `apps/web`'s version for consistency — `apps/web` uses `^1.6.0`, so `packages/core` matches. vitest resolved to 1.6.1 from the hoisted store; no new download.
- **board.ts deleted with no `Board` alias** (D-13 spirit): downstream consumers migrate in Plan 03; keeping an alias would mask the rename and invite drift.
- **`types/index.ts` composite types repointed at `Trip`** rather than renamed: the broader `BoardWithContents`/`PublicBoardView` interface-name renames are owned by Plan 03 per this plan's verification note. Only their internal field types were changed to keep `packages/core` compiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed `types/index.ts` import after board.ts deletion**
- **Found during:** Task 2 (board.ts → trip.ts rename)
- **Issue:** `packages/core/src/types/index.ts` imported `Board` from `../schemas/board`. Deleting board.ts (a planned step) broke this import — `packages/core` would not typecheck, violating the plan's `<verification>` requirement of a clean core typecheck.
- **Fix:** Changed the import to `Trip` from `../schemas/trip` and substituted `Trip` for `Board` in the two composite view types (`BoardWithContents.board`, `PublicBoardView.board`). Interface names left unchanged (Plan 03 scope).
- **Files modified:** packages/core/src/types/index.ts
- **Verification:** `pnpm --filter @moajoa/core typecheck` exits 0.
- **Committed in:** `a498858` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Guarded `trips[0]` for `noUncheckedIndexedAccess`**
- **Found during:** Task 3 (decideEntryRoute)
- **Issue:** The RESEARCH Pattern 1 verbatim snippet used `trips[0].id` directly. This repo sets `noUncheckedIndexedAccess: true` in `tsconfig.base.json`, so `trips[0]` is `T | undefined` and `tsc` raised TS2532 ("Object is possibly 'undefined'") at two sites — failing the plan's core typecheck verification.
- **Fix:** Captured `const first = trips[0]` once and added `|| !first` to the empty-array guard; all subsequent uses reference the narrowed `first`. Behavior is identical (the same precedent — non-null/guarded index access — appears in Phase 4/5 work under this strict flag).
- **Files modified:** packages/core/src/entry-route.ts
- **Verification:** `pnpm --filter @moajoa/core typecheck` exits 0; all 5 entry-route tests still pass (incl. the empty-array → onboarding case).
- **Committed in:** `66faefc` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking import fixup, 1 strict-TS bug in the supplied snippet).
**Impact on plan:** Both were required for the plan's own `<verification>` (clean core typecheck). No scope creep — both confined to files the plan already owns; no behavior change.

## Issues Encountered
None — all three tasks executed as planned; the two deviations above were handled inline.

## Threat Model Compliance
- **T-17-01 (mitigate):** `TripCreateSchema` validates `city_code` (max 20) and `start_date`/`end_date` via `z.string().date()` + `.refine(end >= start)`. Out-of-order and malformed/missing dates are rejected at the contract boundary, asserted by `trip.test.ts` (4 rejection/acceptance cases).
- **T-17-02 (accept):** `decideEntryRoute` re-checks `lastTripId` membership against the `trips` array and falls back to `trips[0]` if absent — no trust placed in the stored value. Covered by the deleted-last-trip test case.

No new security surface beyond the plan's threat model.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `@moajoa/core` now exports the canonical trip contract (`Trip`, `TripId`, `TripCreateSchema`, `TripCreate`, `TripUpdate`), `decideEntryRoute`, and `TripKeys`. Phases 18–21 can import these directly.
- vitest is bound in `packages/core`, so future unit-testable contracts (NAV/SETUP) are automatable.
- **Expected handoff to Plan 03:** 3 downstream sites in `packages/api/src` and `apps/ios` still reference the old core symbols (`Limits.BoardTitleMax`, etc.). This is intentional and called out in this plan's `<verification>` — Plan 03 owns the boards→trips physical/table rename and will migrate those references plus the `BoardWithContents`/`PublicBoardView` interface names.

## Self-Check: PASSED

- All 5 created files present on disk; `board.ts` confirmed deleted.
- All 5 task commits found (`84a353e`, `5501f2a`, `a498858`, `a3ee35d`, `66faefc`).
- Plan-level verification re-run: core suite 35/35 green, `packages/core` typecheck clean, no `BoardVisibility`/`Boards*Max` references remain in `packages/core/src`.

## TDD Gate Compliance
- Task 2: RED `5501f2a` (test) → GREEN `a498858` (feat). Compliant.
- Task 3: RED `a3ee35d` (test) → GREEN `66faefc` (feat). Compliant.
- No REFACTOR commits needed (ports were clean).

---
*Phase: 17-trip-foundation-ia*
*Completed: 2026-06-21*
