---
phase: 17-trip-foundation-ia
plan: 03
subsystem: database
tags: [supabase, postgres, rls, security-definer, migrations, trips, typescript]

# Dependency graph
requires:
  - phase: 17-trip-foundation-ia (Plan 01)
    provides: canonical Trip Zod contract (board.ts→trip.ts rename, representative_id, TripCreate)
provides:
  - single trips-native baseline migration 0016 (squash of 0001-0014; boards→trips, representative_id, booking_clicks)
  - 0001-0014 archived under supabase/migrations/_archive/ (history kept, out of apply set)
  - trips-native regenerated database.ts (no boards refs; confidence/source_kind/representative_id/booking_clicks present)
  - packages/api trip-vocab query layer (listMyTrips/createTrip/getPublicTripBySlug + trip_id columns + trip RPCs)
  - extract-youtube Edge Function repointed to trips/trip_id
affects: [17-04, 17-05, plan-phase, onboarding, packages/api, apps/ios, apps/web]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration squash baseline (one-time append-only override, D-03): single file reproduces full schema, olds archived to subdir so CLI globs only the baseline"
    - "API boundary vocab translation: core input still carries board_id, api maps it onto the renamed trip_id DB column at the query boundary (defers app cascade)"
    - "Loose-typed Supabase client (SupabaseClient<any,any,any>) means column/RPC renames are runtime-correctness changes, not type-checked ones"

key-files:
  created:
    - supabase/migrations/0016_trips_baseline.sql
    - packages/api/src/queries/trips.ts
  modified:
    - supabase/config.toml
    - packages/api/src/types/database.ts
    - packages/api/src/queries/index.ts
    - packages/api/src/queries/links.ts
    - packages/api/src/queries/places.ts
    - packages/api/src/queries/memberships.ts
    - supabase/functions/extract-youtube/index.ts

key-decisions:
  - "Archive 0001-0014 to migrations/_archive/ (Open Q1) — CLI globs only top-level *.sql, so 0016 applies alone; olds stay in git history"
  - "Disable analytics in config.toml — vector log container cannot bind-mount the colima docker.sock (~/.colima path); not needed for local dev/reset/typegen"
  - "Keep core LinkAdd/PlaceAddManual.board_id input fields; map to trip_id at the api boundary (renaming cascades into 4+ app call sites out of plan scope)"
  - "Delete boards.ts (D-13 clean break) per plan — breaks app importers, which migrate to trip vocab in the IA/nav plans (Plan 01 handoff)"
  - "Remote DB reset deferred (LOCAL ONLY scope this session) — to be authorized separately"

patterns-established:
  - "Squash + archive: only the new baseline lives in the active apply set; predecessors move to _archive/ subdir"
  - "DEFINER-helper-only cross-table RLS survives the squash (no direct EXISTS) — verified by a clean db reset (no 42P17)"

requirements-completed: [SETUP-02, NAV-04]

# Metrics
duration: ~92min (incl. multi-GB first-run Docker image pull)
completed: 2026-06-21
---

# Phase 17 Plan 03: Trips-Native Squash + API Vocab Migration Summary

**Single 0016 baseline (squash of 0001-0014, boards→trips + representative_id + booking_clicks) applies alone via `supabase db reset` with zero 42P17 recursion and zero dropped objects; regenerated trips-native types; packages/api query layer + extract-youtube EF repointed to trip vocabulary.**

## Performance

- **Duration:** ~92 min across the full plan (Task 1 in a prior session; Task 2/3 this continuation, including a multi-GB first-run Docker image pull)
- **Started:** 2026-06-21T12:08:23Z (Task 1 commit) / continuation resumed ~2026-06-21T12:10Z
- **Completed:** 2026-06-21T12:40:55Z
- **Tasks:** 3 (Task 1 prior; Task 2 + Task 3 this session)
- **Files modified:** 8 (1 created migration, 1 created query file, 6 modified)

## Accomplishments

- **0016 applies ALONE, clean.** `supabase db reset` reproduced the entire trips-native schema from the single 0016 baseline with no `42P17 infinite recursion` (the DEFINER-helper-only RLS port held) and no missing-function/column errors (every folded asset survived — Pitfall 4 cleared). Only benign NOTICEs (pgcrypto exists; drop-trigger-if-exists no-op).
- **Old migrations archived.** `0001-0014` moved into `supabase/migrations/_archive/` via `git mv` (history preserved); only `0016_trips_baseline.sql` remains in the active apply set.
- **Types regenerated trips-native.** `packages/api/src/types/database.ts` = 1628 lines, `trips:` table present, **0 `boards` references**, `confidence` (7), `source_kind` (7), `representative_id` (5), `booking_clicks` (4), `public_trip_view` (1) — folded columns + new entities all present.
- **API query layer migrated.** New `queries/trips.ts` (listMyTrips/listMyTripsWithPreview/getTrip/createTrip/updateTrip/deleteTrip/shareTrip/getPublicTripBySlug) using `.from('trips')` + `rpc('public_trip_view')`; `boards.ts` deleted; links/places/memberships DB column refs + RPC names switched to trip vocab; EF repointed (`board_id` count in EF now **0**).
- **`pnpm --filter @moajoa/api typecheck` passes.**

## Task Commits

1. **Task 1: Author 0016 trips-native squash baseline** — `a6f911b` (feat) + `a93bd50` (docs progress) — *prior session*
2. **Task 2: Apply squash locally + archive 0001-0014 + regen types** — `789caf1` (feat)
3. **Task 3: Rename packages/api query layer + repoint extract-youtube EF** — `30f1f33` (feat)

## Files Created/Modified

- `supabase/migrations/0016_trips_baseline.sql` (created, Task 1) — single trips-native baseline (810 lines)
- `supabase/migrations/_archive/0001-0014_*.sql` (moved) — predecessors kept in history, out of apply set
- `supabase/config.toml` (modified) — `[analytics] enabled = false` (colima socket workaround)
- `packages/api/src/types/database.ts` (regenerated) — trips-native types
- `packages/api/src/queries/trips.ts` (created) — trip CRUD + share + public_trip_view RPC
- `packages/api/src/queries/index.ts` (modified) — barrel exports `./trips`
- `packages/api/src/queries/links.ts` (modified) — listLinksByTrip + trip_id insert
- `packages/api/src/queries/places.ts` (modified) — listPlacesByTrip + p_trip_id RPC arg + stale doc fixes
- `packages/api/src/queries/memberships.ts` (modified) — joinSharedTrip/getMyTripRole + trip_id refs
- `supabase/functions/extract-youtube/index.ts` (modified) — .from('trips'), trip_id rows + onConflict, trip row var

## Decisions Made

- **Open Q1 = archive (not delete).** Moved 0001-0014 to `_archive/` so the Supabase CLI (which globs only top-level `migrations/*.sql`) sees only 0016 as the apply set, while git history retains the originals. `supabase db reset` confirmed this works without demanding contiguous history.
- **Remote reset DEFERRED.** This session is LOCAL ONLY per the execution objective — the linked remote was never touched (`--linked` not used). The destructive remote reset to the 0016 baseline is a separate, human-authorized step (RESEARCH A3 migration-repair order to be confirmed at that time).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Disabled analytics (vector) in config.toml so the local stack can start under colima**
- **Found during:** Task 2 (`pnpm supabase:start`)
- **Issue:** `supabase start` crashed: `failed to start docker container "supabase_vector_moajoa": error while creating mount source path '/Users/wcb/.colima/default/docker.sock': operation not supported`. The vector log-aggregator bind-mounts the host Docker socket, but colima cannot mount a unix socket living under `~/.colima` (non-shared VM path). This blocked the entire Task 2 gate.
- **Fix:** Added `[analytics]\nenabled = false` to `supabase/config.toml`. Analytics/log-shipping is not needed for local dev, `db reset`, or type generation. Stack then started clean and `db reset` ran.
- **Files modified:** `supabase/config.toml`
- **Verification:** `pnpm supabase:start` and `pnpm supabase:reset` both succeed; 0016 applies clean.
- **Committed in:** `789caf1` (Task 2 commit)

**2. [Rule 1 - Bug / scope boundary] `createTrip` rewritten to match the Plan-01 `TripCreate` shape**
- **Found during:** Task 3 (creating `trips.ts` from `boards.ts`)
- **Issue:** The old `createBoard` read `input.description` and `input.visibility`, but Plan 01's `TripCreateSchema` ("일정 정해짐" create) dropped those and made `city_code`/`start_date`/`end_date` required. Copying the old body verbatim would fail typecheck (fields don't exist on `TripCreate`).
- **Fix:** `createTrip` inserts only `title`/`city_code`/`start_date`/`end_date`; visibility defaults to `'private'` at the DB level and `representative_id` is set by the `trips_default_representative` trigger (SETUP-02).
- **Files modified:** `packages/api/src/queries/trips.ts`
- **Verification:** `pnpm --filter @moajoa/api typecheck` passes.
- **Committed in:** `30f1f33` (Task 3 commit)

**3. [Rule 4-adjacent / scope boundary] Core `LinkAdd`/`PlaceAddManual.board_id` input fields NOT renamed; mapped at the api boundary instead**
- **Found during:** Task 3 (board_id grep = 0 acceptance)
- **Issue:** The plan's acceptance `grep -rci "board_id" packages/api/src/queries/` = 0 is unreachable without renaming the core `LinkAdd.board_id` / `PlaceAddManual.board_id` input fields that the api reads. But those fields are consumed by 4+ app call sites (`apps/web/.../add-link-form.tsx`, `apps/ios/.../new.tsx`, `lib/pending.ts`, `[id].tsx`, `pin-add-modal.tsx`) — all out of this plan's `files_modified`. Renaming core would cascade into apps/web + apps/ios (architectural blast radius → Rule 4 territory) and is owned by a later plan (Plan 01 handoff).
- **Fix:** Kept the core input field names; mapped `input.board_id` → `trip_id` (DB column) / `p_trip_id` (RPC arg) at the api boundary. Residual `board_id` literals in api queries = exactly 2 code lines (`trip_id: input.board_id`, `p_trip_id: input.board_id`) plus explanatory comments. The EF reaches `board_id` = 0 (it talks to the DB directly, no core input dependency).
- **Files modified:** `packages/api/src/queries/links.ts`, `packages/api/src/queries/places.ts`
- **Verification:** api typecheck passes; EF board_id grep = 0; the 2 residuals are the documented core-contract handoff.
- **Committed in:** `30f1f33` (Task 3 commit)

**4. [Carry-forward, pre-confirmed] No `signature_menu` / 0015 in the baseline**
- **Found during:** Task 1 (prior session) — re-affirmed here
- **Issue:** The plan/PATTERNS referenced folding a `0015 place signature_menu` migration, but the WIP `0015_place_signature_menu.sql` was intentionally discarded earlier this session (user-approved). The active set was `0001-0014`.
- **Fix:** 0016 folds `0001-0014` only; no `signature_menu` column exists, by design. A comment in 0016 notes the absence. (Documented in STATE.md Task 1 note.)
- **Files modified:** `supabase/migrations/0016_trips_baseline.sql`
- **Verification:** `db reset` applies clean without signature_menu; api typecheck green (no consumer of signature_menu).
- **Committed in:** `a6f911b` (Task 1 commit)

---

**Total deviations:** 4 (1 blocking infra fix, 1 schema-shape bug fix, 1 scope-boundary contract deferral, 1 carry-forward). 
**Impact on plan:** All necessary for correctness/in-scope completion. The board_id residual (Deviation 3) and boards.ts deletion intentionally leave apps/web + apps/ios referencing the old contract — that app migration is owned by the downstream IA/nav plans (Plan 01 handoff), not this plan. No scope creep into the apps.

## Issues Encountered

- **colima Docker socket mount failure** — resolved via Deviation 1 (disable analytics/vector). The DB, auth, storage, and realtime containers all start fine; only the log aggregator needed the host-socket mount that colima rejects.
- **`git commit` pathspec on already-`git rm`'d boards.ts** — the first Task 3 commit aborted its `git add` on a stale boards.ts path and committed only the deletion; amended to fold in all 6 renamed files atomically (final `30f1f33`). No intermediate broken commit was pushed.

## Known Stubs

- `booking_clicks` table is intentionally empty with owner-read-only RLS and **no INSERT path** this phase (D-07). Minting happens service-role-side in Phase 20 (affiliate redirect EF). This is a planned forward-reference, not an incomplete stub.

## Threat Flags

None — the squash exposes no new trust surface. `public_trip_view` keeps the 0013 curated column set (same fields already public). All cross-table RLS goes through DEFINER helpers (T-17-06 mitigated, verified by the clean `db reset`). `booking_clicks` is deny-by-default owner-read (T-17-07).

## User Setup Required

**Remote DB reset is DEFERRED and requires human authorization.** This session applied 0016 to the LOCAL stack only. Before the live web/SSR reflects the trips-native schema, the linked remote must be reset to the 0016 baseline (destructive, D-03 approved, external users = 0). The exact `supabase migration repair` / push order depends on the remote's `schema_migrations` state and should be confirmed at that time. Windows teammates must also `supabase db reset` locally.

## Next Phase Readiness

- **Ready:** trips-native schema, types, and api query layer are in place for the IA/nav plans (17-04, 17-05).
- **Blocker for the apps:** `apps/web` + `apps/ios` still import the removed `boards.ts` exports (`listMyBoards`, `getBoard`, `createBoard`, etc.) and still pass `board_id` — these app call sites must be migrated to trip vocab by the downstream IA/nav plans (expected per Plan 01 handoff; this plan deliberately scoped to packages/api + EF).
- **Pending:** remote DB reset (human-authorized).

## Self-Check: PASSED

- FOUND: `supabase/migrations/0016_trips_baseline.sql`
- FOUND: `packages/api/src/queries/trips.ts`
- FOUND: `packages/api/src/types/database.ts` (trips-native, 0 boards refs)
- FOUND: `.planning/phases/17-trip-foundation-ia/17-03-SUMMARY.md`
- REMOVED (intentional, D-13): `packages/api/src/queries/boards.ts`
- Commits exist: `a6f911b` (Task 1), `789caf1` (Task 2), `30f1f33` (Task 3)
- Gate: `supabase db reset` applied 0016 ALONE clean (no 42P17, no dropped objects)
- Gate: `pnpm --filter @moajoa/api typecheck` PASS

---
*Phase: 17-trip-foundation-ia*
*Completed: 2026-06-21*
