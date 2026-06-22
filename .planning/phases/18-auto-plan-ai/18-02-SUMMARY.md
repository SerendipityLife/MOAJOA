---
phase: 18-auto-plan-ai
plan: 02
subsystem: database
tags: [supabase, migration, rls, security-definer, postgres, types, monorepo]

# Dependency graph
requires:
  - phase: 18-auto-plan-ai
    provides: PlanSchema / PlanItemSchema column shapes (status CHECK, travel_mode CHECK, collaborative default, day_index/sort_order/leg_travel_seconds/is_anchor) — 0017 DDL contract (18-01)
  - phase: 17-trip-foundation-ia
    provides: 0016 trips baseline — can_read_trip/can_edit_trip SECURITY DEFINER helpers, set_updated_at trigger fn, places/votes RLS idioms, extraction_costs provider CHECK
provides:
  - "plans table — trip_id FK, status (generating|draft), travel_mode (transit|walk|drive), collaborative, one-draft-per-trip partial unique index"
  - "plan_items table — plan_id FK, place_id FK, day_index, sort_order, leg_travel_seconds (nullable), is_anchor, unique(plan_id, place_id)"
  - "RLS on plans/plan_items via 0016 can_read_trip/can_edit_trip DEFINER helpers (plan_items routes through parent plan trip_id — 42P17 guard)"
  - "extraction_costs.provider CHECK accepts 'google_routes' (Routes legs cost attribution)"
  - "packages/api/src/types/database.ts regenerated with plans/plan_items Row/Insert/Update + plans_trip_id_fkey -> trips relationship"
affects: [18-03-generate-plan-ef, 18-04-api-queries, 18-05-ios-plan-ui, 20-booking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "append-only migration (new 0017_*; 0016 never modified) — CLAUDE.md §4.3"
    - "RLS via SECURITY DEFINER helper reuse (can_read_trip/can_edit_trip) — no new direct cross-table EXISTS, 42P17 recursion guard (CLAUDE.md §4.4)"
    - "plan_items policies = votes->places permitted-EXISTS idiom (inner can_*_trip IS the DEFINER boundary, routed through parent plan's trip_id)"
    - "one-draft-per-trip partial unique index (mirror places_trip_idx partial-index idiom)"
    - "additive CHECK extension (drop + re-add with extended set) for extraction_costs.provider"
    - "non-destructive local apply: supabase migration up (applies pending 0017 only, not a full reset)"

key-files:
  created:
    - supabase/migrations/0017_plans.sql
  modified:
    - packages/api/src/types/database.ts

key-decisions:
  - "Used `supabase migration up --local` (non-destructive, applies only pending 0017) instead of `supabase db reset` — local DB already had 0016 applied, no need to re-run baseline. Zero 42P17 recursion."
  - "Verified the live local constraint name was exactly `extraction_costs_provider_check` (psql pg_constraint introspection) BEFORE relying on the DROP — matched the plan's assumed Postgres-default name, so no DROP-name adjustment needed."
  - "plans table uses direct can_*_trip(trip_id) (owns the column); plan_items routes via exists(...where p.id=plan_items.plan_id and can_edit_trip(p.trip_id)) (parent-plan routing, the one permitted EXISTS shape)."
  - "Remote `supabase db push` DEFERRED to phase verification / user-side (17-03 remote-deferred pattern: needs SUPABASE_ACCESS_TOKEN + linked project + interactive confirm). Local types are the build contract for downstream plans 03/04."

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05]

# Metrics
duration: 3min
completed: 2026-06-22
---

# Phase 18 Plan 02: 0017 Plans Migration Summary

**`0017_plans.sql` ships the `plans` + `plan_items` persistence layer (D-12) with one-draft-per-trip semantics, RLS that reuses the proven 0016 `can_read_trip`/`can_edit_trip` SECURITY DEFINER helpers (zero 42P17 recursion), and an additive `extraction_costs.provider` CHECK extension for `google_routes` — applied to the local DB and `database.ts` regenerated so downstream plans 03/04 build against real types.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-22T06:43:07Z
- **Completed:** 2026-06-22T06:48:00Z (approx)
- **Tasks:** 2 (both `type="auto"`, Task 2 [BLOCKING])
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `plans` table: `trip_id` FK (cascade), `status` CHECK (`generating`|`draft`), `travel_mode` CHECK (`transit`|`walk`|`drive`), `collaborative` default false, timestamps — matches 18-01 `PlanSchema` exactly.
- `plans_one_draft_per_trip` partial unique index (`where status='draft'`) — D-11 overwrite semantics (one draft per trip).
- `plans_set_updated_at` trigger reusing the 0016 `set_updated_at()` function (not redefined).
- `plan_items` table: `plan_id`/`place_id` FKs (cascade), `day_index`/`sort_order` (≥0 CHECKs), `leg_travel_seconds` (nullable + ≥0), `is_anchor`, `unique(plan_id, place_id)` — matches 18-01 `PlanItemSchema`.
- 8 RLS policies (4 plans + 4 plan_items): plans gate directly on `can_*_trip(trip_id)`; plan_items route through the parent plan's `trip_id` via the votes→places permitted-EXISTS idiom (T-18-04/05/06 mitigations).
- `extraction_costs.provider` CHECK extended additively to `('anthropic','google_places','google_routes')` (T-18-07 cost-attribution).
- Applied 0017 to the local DB with `supabase migration up` — **zero 42P17 recursion errors**. Tables, partial index, RLS-enabled flags, 8 policies, and the extended constraint all verified directly via psql.
- Regenerated `packages/api/src/types/database.ts` (+86 lines: plans/plan_items Row/Insert/Update + `plans_trip_id_fkey` → trips relationship). `pnpm --filter @moajoa/api typecheck` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write 0017_plans.sql** - `45cbe29` (feat) — plans + plan_items + 8 RLS policies + extraction_costs CHECK extension; 0016 untouched. grep gate 9 matches; zero helper redefinitions; plan_items routes via `p.trip_id` (5 occurrences, no direct-trip_id bypass).
2. **Task 2: [BLOCKING] Apply locally + regenerate database.ts** - `140b7ca` (feat) — `supabase migration up` applied 0017 (zero 42P17); `database.ts` regenerated; api typecheck exit 0.

**Plan metadata:** (final commit) `docs(18-02): complete 0017 plans migration plan`

## Files Created/Modified
- `supabase/migrations/0017_plans.sql` - plans + plan_items tables, 8 RLS policies (DEFINER-helper reuse), extraction_costs provider CHECK extension. Append-only (0016 untouched).
- `packages/api/src/types/database.ts` - regenerated from local DB; +plans/+plan_items Row/Insert/Update + plans_trip_id_fkey relationship.

## Decisions Made
- **Non-destructive apply path:** Chose `supabase migration up --local` over `supabase db reset`. The local stack already had 0016 applied (migration list confirmed 0016 Local=Remote, 0017 pending), so applying only the pending 0017 avoided an unnecessary baseline re-run. Applied cleanly, "Local database is up to date", exit 0.
- **Constraint name pre-verification:** Before trusting the plan's `DROP CONSTRAINT extraction_costs_provider_check`, queried `pg_constraint` on the live local DB — confirmed the actual generated name is exactly `extraction_costs_provider_check`. No DROP-name adjustment needed (the plan flagged this as a possible deviation; it was not one here).
- **RLS routing:** `plans` owns `trip_id` directly → policies call `can_read_trip(trip_id)`/`can_edit_trip(trip_id)`. `plan_items` has no `trip_id` → policies route through the parent plan: `exists(select 1 from plans p where p.id = plan_items.plan_id and can_edit_trip(p.trip_id))`. This is the votes→places idiom (0016 L529) — the only permitted EXISTS shape because the inner `can_*_trip` call is itself the DEFINER boundary.

## Deviations from Plan

### Clarifications (no code change; documenting expected behavior)

**1. [Verification-gate clarification] `grep "google_routes" database.ts` cannot match by Supabase type-gen design — substantive criterion met another way**
- **Found during:** Task 2 verification.
- **Issue:** The plan's automated gate `grep -c "google_routes" packages/api/src/types/database.ts` returns 0. Supabase's `gen types typescript` does NOT introspect Postgres CHECK constraints into TS string-literal unions — it types ALL CHECK-constrained text columns as plain `string`. This is consistent across the whole generated file: `extraction_costs.provider`, `plans.status`, `plans.travel_mode`, and (in 0016) `links.extraction_status` are all `string`.
- **Resolution:** No code fix — this is a documented characteristic of the type generator, not a regression. The substantive acceptance is met via two other channels: (a) the DB constraint was verified directly to include all three providers — `CHECK (provider = ANY (ARRAY['anthropic','google_places','google_routes']))`; (b) the app-level string-literal contract lives in the `@moajoa/core` Zod schemas (`PlanSchema.status = z.enum(['generating','draft'])`, `TravelMode` enum), shipped by 18-01, which is the real type narrowing layer downstream code uses. `plans`/`plan_items` Row/Insert/Update types ARE present (the other half of the same gate, `grep "plans:|plan_items:"`, returns 2).
- **Files modified:** none.
- **Commit:** n/a (documentation only).

Otherwise: plan executed exactly as written.

## Issues Encountered
None blocking. Local apply was clean on first run (zero 42P17). The CLI emitted only a benign "new version available" notice (v2.107.0 vs installed v2.101.0) — informational, no action taken (out of scope, logged here not as a deviation).

## Threat Model Compliance
- **T-18-04 (cross-trip plan read):** `plans` SELECT = `can_read_trip(trip_id)`; `plan_items` SELECT routes through parent plan's trip_id. Verified RLS enabled + policies present.
- **T-18-05 (cross-trip plan write):** INSERT/UPDATE/DELETE = `can_edit_trip(...)` on both tables (8 policies total).
- **T-18-06 (42P17 recursion):** Reused 0016 DEFINER helpers; plan_items uses the votes→places permitted-EXISTS idiom. **Verified zero 42P17 on local apply** (`supabase migration up` exit 0, "Local database is up to date").
- **T-18-07 (Routes cost mis-attribution):** `'google_routes'` provider value added to the extraction_costs CHECK (verified live).

No new threat surface beyond the plan's `<threat_model>` introduced — no Threat Flags.

## Remote Deferral (follow-up gate, NOT a blocker for downstream plans)
- `supabase db push` to the remote project is **DEFERRED** to phase verification / user-side (mirrors the 17-03 remote-deferred pattern). It needs `SUPABASE_ACCESS_TOKEN` / a linked project + interactive confirmation, which are not available in this autonomous session.
- This does NOT block Plan 03 (generate-plan EF) or Plan 04 (api queries): local types (`database.ts`) are the build contract, and the EF runs against whichever DB is targeted at deploy time. The remote 0017 push should ride along with the EF deploy at phase verification.

## User Setup Required
- **At phase verification / deploy:** run `supabase db push` to apply 0017 to the linked remote project (after confirming the migration diff). No other configuration required for this plan.

## Next Phase Readiness
- **Plan 03 (generate-plan EF):** `plans`/`plan_items` tables exist locally; the EF upserts the single draft plan (`plans_one_draft_per_trip` unique) and inserts `plan_items`; logs Routes legs under `provider='google_routes'`, `link_id=null`.
- **Plan 04 (api queries):** `getPlanByTrip` queries `.from('plans').select('*, plan_items(*)')` against the regenerated types; the `plans_trip_id_fkey` relationship lets the embedded select resolve.
- **Plan 05 (iOS UI):** renders plan_items by `day_index`/`sort_order`; `leg_travel_seconds=null` → "이동시간 —".

## Self-Check: PASSED

- FOUND: supabase/migrations/0017_plans.sql
- FOUND: packages/api/src/types/database.ts (contains plans + plan_items Row/Insert/Update)
- FOUND: .planning/phases/18-auto-plan-ai/18-02-SUMMARY.md
- FOUND: commit 45cbe29 (Task 1 — migration)
- FOUND: commit 140b7ca (Task 2 — apply + types regen)
- VERIFIED: 0016_trips_baseline.sql unchanged (append-only honored)
- VERIFIED: zero 42P17 recursion on local apply

---
*Phase: 18-auto-plan-ai*
*Completed: 2026-06-22*
