---
phase: 18-auto-plan-ai
plan: 03
subsystem: api
tags: [deno, edge-function, supabase, anthropic, claude, google-routes, zod, realtime, rls]

# Dependency graph
requires:
  - phase: 18-01
    provides: GeneratePlanRequest/Plan/PlanItem Zod contracts + planChannelName + TravelMode (redeclared locally in the Deno EF)
  - phase: 18-02
    provides: plans + plan_items tables, plans_one_draft_per_trip partial unique, extraction_costs google_routes provider
  - phase: 17
    provides: trips/memberships/places tables + can_edit_trip DEFINER helper (replicated as service-role membership check), extract-youtube EF analog
provides:
  - generate-plan Edge Function (auth + can_edit_trip gate, (0,0) filter, Claude geo-cluster, Routes adjacent legs, plans/plan_items write, broadcast, cost log)
  - pipeline/claude.ts (buildPlanPrompt + callClaudePlan + PlanLLMOutput zod + validatePlanIds defensive id-validation)
  - pipeline/routes.ts (computeRoutesLeg → seconds|null, FieldMask routes.duration only, (0,0) short-circuit)
  - 23 Deno pipeline tests (FieldMask assertion, (0,0) skip, null-on-failure, id-intersection/never-drop/dedup)
affects: [18-04, 18-05, phase-18-verify, 20-booking]

# Tech tracking
tech-stack:
  added: [Google Routes API v2 computeRoutes (routes.googleapis.com/directions/v2:computeRoutes)]
  patterns:
    - "EF cost-abuse gate cloned verbatim from extract-youtube: auth.getUser rejects anon/service tokens"
    - "Service-role can_edit_trip equivalent (owner OR accepted owner/editor member) before any paid call — auth.uid() is null under service role so the RLS helper is replicated as an explicit query"
    - "Defensive LLM id-validation: intersect with input set, dedup, never-drop (auto-append to pool)"
    - "Routes Essentials-tier cost guard: FieldMask routes.duration ONLY, DRIVE→TRAFFIC_UNAWARE"
    - "Idempotent draft overwrite (delete draft → insert) instead of a server claim guard"

key-files:
  created:
    - supabase/functions/generate-plan/index.ts
    - supabase/functions/generate-plan/pipeline/claude.ts
    - supabase/functions/generate-plan/pipeline/claude.test.ts
    - supabase/functions/generate-plan/pipeline/routes.ts
    - supabase/functions/generate-plan/pipeline/routes.test.ts
    - supabase/functions/generate-plan/deno.json
  modified: []

key-decisions:
  - "can_edit_trip replicated as a service-role query (owner_id === caller OR accepted owner/editor membership) because the RLS helper relies on auth.uid() which is null under the service role"
  - "leg_travel_seconds is the leg INTO each item (first item of a day = null); legs computed per adjacent pair within each validated day after sort_order normalization"
  - "(0,0)-coord places never reach Claude or Routes; they are appended to the unplaced pool after validatePlanIds"
  - "computeDayCount falls back to 1 day when trip start/end dates are null or invalid so clustering still runs"
  - "Routes API confirmed ENABLED (WALK/DRIVE return durations); TRANSIT returns empty 200 → live transit gate flagged for user (see Live Routes Result)"

patterns-established:
  - "Pipeline TDD on Deno with mocked globalThis.fetch capturing url/headers/body for FieldMask + routing-preference assertions"
  - "Channel literal 'plan:' + tripId kept in sync with @moajoa/core planChannelName (Deno cannot import the workspace package)"

requirements-completed: [PLAN-01, PLAN-03, PLAN-04]

# Metrics
duration: 6min
completed: 2026-06-22
---

# Phase 18 Plan 03: generate-plan Edge Function Summary

**generate-plan EF: auth + service-role can_edit_trip gate, (0,0)/hidden place filter, Claude geo-cluster → days+order+unplaced pool with defensive id-validation, Google Routes adjacent-only legs (Essentials FieldMask), idempotent plans/plan_items write, trip-scoped broadcast, and Anthropic+Routes cost logging.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-22T06:49:42Z
- **Completed:** 2026-06-22T06:55:46Z
- **Tasks:** 2
- **Files modified:** 6 created

## Accomplishments
- `pipeline/routes.ts` + `pipeline/claude.ts` with 23 passing Deno tests (TDD RED→GREEN): FieldMask `routes.duration` assertion, (0,0) short-circuit without fetch, null-on-failure, id-intersection / never-drop / dedup.
- `index.ts` handler: cloned the extract-youtube cost-abuse gate verbatim, added a service-role `can_edit_trip` equivalent before any paid call, partitioned (0,0) places to the pool, orchestrated Claude → Routes → `plans`/`plan_items` write, broadcast `loading/clustering/routing/done`+`error` on `plan:{trip_id}`, logged Anthropic + each Routes leg to `extraction_costs` with `link_id: null`.
- Live Routes API enablement confirmed working for WALK/DRIVE; TRANSIT gap surfaced (see below).

## Task Commits

1. **Task 1: pipeline claude.ts + routes.ts with Deno tests (TDD)** - `c1d654e` (feat) — single GREEN commit (tests + impl verified in one cycle).
2. **Task 2: index.ts handler (auth+edit gate, orchestration, write, broadcast, cost) + live Routes check** - `e58bc31` (feat)

**Plan metadata:** (this commit) `docs(18-03): complete generate-plan plan`

## Files Created/Modified
- `supabase/functions/generate-plan/index.ts` — EF handler: auth gate, edit-rights check, place load+filter, Claude orchestration, Routes post-process, plans/plan_items write, broadcast, cost log.
- `supabase/functions/generate-plan/pipeline/claude.ts` — `buildPlanPrompt` + `callClaudePlan` (claude-sonnet-4-6, max_tokens 4096, temperature 0) + `PlanLLMOutput` zod + `validatePlanIds`.
- `supabase/functions/generate-plan/pipeline/routes.ts` — `computeRoutesLeg(o, d, mode, key) → seconds|null`, FieldMask routes.duration only, (0,0) short-circuit.
- `supabase/functions/generate-plan/pipeline/claude.test.ts` — 14 tests (prompt fragments, schema accept/reject, validatePlanIds).
- `supabase/functions/generate-plan/pipeline/routes.test.ts` — 9 tests (FieldMask, mode prefs, parse, null, (0,0) skip).
- `supabase/functions/generate-plan/deno.json` — copied from extract-youtube.

## Live Routes Result (A1/A2 — gate for PLAN-04 to show times)

A real two-point Tokyo `computeRoutes` smoke (Shibuya 35.6595,139.7005 → Shinjuku 35.6896,139.7006) was run against the live `GOOGLE_PLACES_SERVER_KEY` from `supabase/.env.local`:

| Mode    | HTTP | Result |
|---------|------|--------|
| WALK    | 200  | `routes[0].duration = "3310s"` ✅ |
| DRIVE   | 200  | `routes[0].duration = "864s"` ✅ (with `routingPreference: TRAFFIC_UNAWARE`) |
| TRANSIT | 200  | `{}` — empty body, no `routes` → `computeRoutesLeg` returns `null` → "이동시간 —" |

**Interpretation:**
- `routes.googleapis.com` **IS enabled** on the GCP project and the server key is permitted — WALK and DRIVE return valid durations with no 403/PERMISSION_DENIED. The A2 field-path hedge is resolved: `routes[0].duration` (route-level) is correct for single-leg requests.
- **TRANSIT returns an empty `200 {}`** for this Tokyo pair. The default `travel_mode` is `transit`, so with the key as-is every leg of a default plan renders "이동시간 —" even though Routes is enabled. This matches RESEARCH assumption **A1** (transit-data availability) and is the real **user-side gate for PLAN-04 to show transit times**.

**User-side action required (does NOT block this plan):** confirm the GCP project/key has the Routes **transit** capability enabled (the Routes Compute Routes transit SKU is billed/gated separately from walk/drive), or accept WALK/DRIVE as the modes that show times in dogfooding. The EF degrades gracefully — empty/null TRANSIT legs render "이동시간 —" exactly as designed (T-18-11/Pitfall 4 path verified live). End-to-end transit-time display is verified at 18-05 / phase verify.

## Decisions Made
- **can_edit_trip replicated, not RPC-called:** under the service role `auth.uid()` is null, so the 0016 `can_edit_trip` SQL helper would always be false. Replicated its logic (owner OR accepted owner/editor membership) as explicit service-role `trips`/`memberships` queries before any paid call.
- **leg attribution:** `leg_travel_seconds` on item *i* = travel time from item *i-1* into *i*; first item of a day is null. Legs computed only for adjacent pairs within a day (D-07).
- **Single GREEN commit for Task 1:** tests and implementation were written and verified within one TDD cycle for a new (non-regression) pipeline; committed together as `feat`.

## Deviations from Plan

None — plan executed exactly as written. The live Routes check produced a documented finding (TRANSIT empty for the test pair), which the plan explicitly anticipated (A1/A2) and instructed to record rather than treat as a failure; the code already handles it via the null-leg graceful path.

## Issues Encountered
- Initial TRANSIT-only live smoke returned `null` and looked like an enablement failure; a follow-up diagnostic (HTTP status + per-mode shape) showed HTTP 200 across all modes with WALK/DRIVE durations present and TRANSIT body empty — isolating the cause to transit-data/SKU availability, not API enablement or key restriction. No code change needed (the empty-routes → null path was already correct and is covered by `routes.test.ts`).

## User Setup Required
**Routes transit capability (optional, for transit travel times).** The Routes API is enabled and working for WALK/DRIVE. To display transit (전철) travel times in plans, verify the GCP project/server key has the Routes transit routing capability enabled. Until then, transit legs render "이동시간 —" (graceful). Walk/drive plans show times immediately. Billing alerts ($5/$20/$50, EXTRACT-06) already cover spend.

## Next Phase Readiness
- 18-04 (`queries/plans.ts` + invoke) can call `generate-plan` and read the `{ plan_id, day_count, placed_count, unplaced_count }` response shape; `getPlanByTrip` embeds via `plans_trip_id_fkey`.
- 18-05 (iOS plan tab) subscribes `plan:{trip_id}` and renders `plan_items` by `day_index`/`sort_order`; `leg_travel_seconds = null` → "이동시간 —".
- **Deferred to phase verify (per environment note):** EF deploy + end-to-end live plan generation; PLAN-01..05 remain Pending until verified at 18-05/phase verify. Transit-time display is gated on the user-side Routes transit capability above.

## Self-Check: PASSED

- All 6 created files present on disk.
- Both task commits (`c1d654e`, `e58bc31`) present in git history.
- 23/23 Deno pipeline tests GREEN; `deno check index.ts` clean.

---
*Phase: 18-auto-plan-ai*
*Completed: 2026-06-22*
