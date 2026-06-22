---
phase: 18-auto-plan-ai
plan: 04
subsystem: api
tags: [queries, plans, supabase, tdd, vitest]
requires:
  - "@moajoa/core: Plan, PlanItem, GeneratePlanRequest, GeneratePlanResult, TravelModeType (18-01)"
  - "packages/api/src/types/database.ts: plans/plan_items Row types (18-02)"
  - "generate-plan Edge Function returning { plan_id, day_count, placed_count, unplaced_count } (18-03)"
  - "packages/api/src/queries/trips.ts: shareTrip read-then-flip"
provides:
  - "getPlanByTrip(client, tripId) -> PlanWithItems | null (draft plan + embedded plan_items)"
  - "generatePlan(client, body) -> GeneratePlanResult (functions.invoke('generate-plan'))"
  - "reorderPlanItem / setTravelMode / setAnchor (typed updates)"
  - "moveToPool (delete) / moveToDay (insert) — placed<->pool (D-13)"
  - "setCollaborative(client, planId, tripId) -> { collaborative, share_slug } (D-14 flag + shareTrip reuse)"
  - "packages/api now has a `test` script (vitest run) wired"
affects:
  - "apps/ios plan tab (Plan 05) — imports these queries via @moajoa/api barrel"
tech-stack:
  added: ["vitest devDependency on @moajoa/api (mirrors @moajoa/core)"]
  patterns:
    - "typed query wrapper: client-first arg, throw on { error }, RLS-only enforcement (mirror places.ts/renamePlace)"
    - "EF invoke: functions.invoke('generate-plan', { body }) (mirror links.ts triggerExtraction)"
    - "flag + reuse: setCollaborative flips a boolean then reuses shareTrip (no reimplementation)"
key-files:
  created:
    - "packages/api/src/queries/plans.ts"
    - "packages/api/src/queries/plans.test.ts"
  modified:
    - "packages/api/src/queries/index.ts (barrel re-export ./plans)"
    - "packages/api/package.json (test script + vitest devDep)"
decisions:
  - "getPlanByTrip uses maybeSingle (null = State A/B, no plan yet) scoped status='draft' (one-draft-per-trip)"
  - "moveToPool = delete the plan_item (D-13: unplaced = no row), not a status column"
  - "moveToDay defaults is_anchor:false + leg_travel_seconds:null (manual placement isn't an anchor; leg re-grounded on next regenerate)"
  - "setCollaborative makes NO votes query — D-14 scope is flag + share only; voting reuses votes infra in Phase 19"
metrics:
  duration: "~3min"
  completed: "2026-06-22"
  tasks: 2
  files: 4
---

# Phase 18 Plan 04: @moajoa/api Plans Query Layer Summary

Typed `@moajoa/api` query layer for plans — read the trip's draft plan + items, invoke the `generate-plan` EF, reorder/move/anchor items, toggle travel mode, and flip collaborative (reusing the existing `shareTrip`). These are the functions the iOS plan tab (Plan 05) calls. Implemented TDD (RED→GREEN) against a chainable mocked Supabase client.

## What Was Built

- **`getPlanByTrip(client, tripId): PlanWithItems | null`** — `.from('plans').select('*, plan_items(*)').eq('trip_id', …).eq('status','draft').maybeSingle()`. Returns the trip's single draft plan with placed items embedded (via `plans_trip_id_fkey`), or `null` when none generated yet. Unplaced places are derived client-side (places minus item place_ids — D-13). Exported `PlanWithItems = Plan & { plan_items: PlanItem[] }`.
- **`generatePlan(client, body: GeneratePlanRequest): GeneratePlanResult`** — mirrors `triggerExtraction` exactly: `functions.invoke('generate-plan', { body })`, throw on error, return `data as GeneratePlanResult`. (D-01: explicit "플랜 만들기" button trigger; progress streams over `plan:{trip_id}` broadcast separately.)
- **`reorderPlanItem(client, itemId, { day_index, sort_order })`** — `update(patch).eq('id', …).select('*').single()` (drag within/across days).
- **`setTravelMode(client, planId, mode: TravelModeType)`** — `update({ travel_mode }).eq('id', …)` (D-08 전철/도보/차).
- **`moveToPool(client, itemId): void`** — `delete().eq('id', …)` (D-13 placed→pool = remove the row).
- **`moveToDay(client, { plan_id, place_id, day_index, sort_order })`** — `insert({ …input, is_anchor:false, leg_travel_seconds:null }).select('*').single()` (pool→placed).
- **`setAnchor(client, itemId, isAnchor)`** — `update({ is_anchor }).eq('id', …)` (D-10 필수 표시; re-cluster happens via `generatePlan` anchor_place_ids on next regenerate).
- **`setCollaborative(client, planId, tripId): { collaborative: true; share_slug }`** — flips `plans.collaborative=true` then `await shareTrip(client, tripId)` to surface the slug. **NO votes query** (D-14 — flag + share only; voting reuses the shipped votes infra in Phase 19).

All wrappers take `client` first, throw on `{ error }`, and do **no redundant client-side membership check** — RLS (`can_*_trip`, 0016/0017) is the enforcement, mirroring `renamePlace`/`confirmAiPlace`.

**Barrel:** `export * from './plans'` appended to `packages/api/src/queries/index.ts`.

**Test infra:** `packages/api` had no `test` script; added `"test": "vitest run"` + `"test:watch": "vitest"` + `vitest@^1.6.0` devDependency (mirrors how Phase 17 wired `@moajoa/core`). Vitest is hoisted at repo root, so the filtered run resolves it.

## Verification

- `pnpm --filter @moajoa/api test` → **16/16 GREEN** (plans.test.ts).
- `pnpm --filter @moajoa/api typecheck` → **exit 0** (against the 18-02 regenerated `database.ts` plans/plan_items types).
- grep gates: `functions.invoke('generate-plan'` (1), `shareTrip` (3), `collaborative: true` (3), `travel_mode` (3) in plans.ts; `export * from './plans'` (1) in index.ts.
- `from('votes')` in plans.ts → **0** (D-14 flag + share only, no votes coupling).
- Test 7 explicitly asserts `fromCalls.not.toContain('votes')` and that the `shareTrip` `trips` read-then-flip path is invoked, returning the slug.

## TDD Gate Compliance

- **RED** (`a811402`, `test(18-04)`): 16 cases over a chainable mocked `MoajoaSupabaseClient`; suite failed because `./plans` did not exist. Test script wiring landed in the same RED commit.
- **GREEN** (`6c9e60a`, `feat(18-04)`): plans.ts + barrel; 16/16 pass, typecheck clean.
- REFACTOR: not needed — code mirrors the shipped `places.ts`/`links.ts`/`trips.ts` analogs directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Over-strict mock typing broke `tsc` on the test file**
- **Found during:** Task 2 (GREEN typecheck).
- **Issue:** The mock chain was typed `Record<string, ReturnType<typeof vi.fn>>` then assigned heterogeneous members (`.single`/`.maybeSingle` return Promises, `.then` is a thenable, builder methods return the chain), which `tsc --noEmit` rejected (11 TS2322 errors — all in `plans.test.ts`, none in `plans.ts`). The api `tsconfig` includes `src/**/*` so test files are typechecked.
- **Fix:** Introduced a local `type MockChain = Record<string, any>` (the production `MoajoaSupabaseClient` is itself `SupabaseClient<any,any,any>`, so this matches the existing loose-generic stance) for the three mock-builder objects. No change to assertions or production code.
- **Files modified:** `packages/api/src/queries/plans.test.ts`
- **Commit:** `6c9e60a` (folded into GREEN — the test only needed to compile for the GREEN gate).

### Note (not a deviation)

- The plan's `<read_first>` referenced `TravelMode` for the mode type; the exported type is `TravelModeType` (from `@moajoa/core` constants, re-exported via the barrel) — used as-is.
- `packages/api` has exactly one test file (this one), so the "full api suite" and "plans.test.ts" are the same 16 tests — no regression surface.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-18-15/16/17 dispositions hold: wrappers add no bypass and no false security; `getPlanByTrip` is `trip_id`-scoped; `setCollaborative` only flips a boolean + reuses `shareTrip`. RLS (`can_*_trip`, 0017) is the enforcement boundary.

## Handoff

- **Plan 05 (iOS plan tab):** import all queries from `@moajoa/api`. `getPlanByTrip` returns `{ ...plan, plan_items: [...] }`; render `plan_items` by `day_index`/`sort_order`, `leg_travel_seconds === null` → "이동시간 —". Derive the unplaced pool from `listPlacesByTrip` minus the embedded `plan_items[].place_id`. "플랜 만들기" → `generatePlan`; subscribe `subscribePlanProgress(plan:{trip_id})` for progress. Drag → `reorderPlanItem`; pool↔day → `moveToDay`/`moveToPool`; 필수 → `setAnchor`; 모드 → `setTravelMode` (+ re-`generatePlan`); "친구와 같이 정하기" → `setCollaborative` (returns share_slug; voting itself is Phase 19).
- **transit-time caveat (from 18-03):** with `travel_mode='transit'` (default), Routes currently returns empty legs on the GCP project/key → all transit legs render "이동시간 —" until Routes transit capability is enabled (user-side gate). walk/drive return real times. Not a code bug; getPlanByTrip/iOS handle null legs gracefully.

## Commits

- `a811402` — `test(18-04): add failing plans query tests + wire api vitest`
- `6c9e60a` — `feat(18-04): implement @moajoa/api plans query layer`

## Self-Check: PASSED
