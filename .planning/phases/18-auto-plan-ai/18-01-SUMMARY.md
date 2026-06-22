---
phase: 18-auto-plan-ai
plan: 01
subsystem: api
tags: [zod, schemas, contracts, realtime, typescript, monorepo, core]

# Dependency graph
requires:
  - phase: 17-trip-foundation-ia
    provides: trip_id 식별자 계약 (TripSchema), start/end_date N일 분배 입력, constants.ts 채널/스텝 idiom (extractChannelName/ExtractionStep/EXTRACT_STEP_KO)
provides:
  - "PlanSchema / PlanItemSchema — 0017 plans/plan_items 행 Zod 모델 (status, travel_mode, collaborative, day_index, sort_order, leg_travel_seconds, is_anchor)"
  - "GeneratePlanRequestSchema — generate-plan EF 요청 계약 (travel_mode=transit / anchor·removed 빈 배열 default)"
  - "GeneratePlanResultSchema — invoke 반환 형태 (plan_id, day/placed/unplaced count)"
  - "planChannelName(tripId) + PLAN_CHANNEL_PREFIX — trip 스코프 realtime broadcast 채널 단일 빌더 (client↔EF drift 방지)"
  - "PlanStep + PLAN_STEP_KO — 플랜 진행 broadcast 스텝 + 한국어 라벨 (done/error terminal)"
  - "TravelMode — transit/walk/drive enum-from-const"
affects: [18-02-migration, 18-03-generate-plan-ef, 18-04-api-queries, 18-05-ios-plan-ui, 19-date-vote]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "enum-from-const → z.enum(TravelMode) (TripVisibility idiom mirrored)"
    - "EF request schema with .default() (ResolvePlaceRequestSchema idiom)"
    - "trip-scoped realtime channel builder (extractChannelName → planChannelName)"
    - "broadcast step tuple + Korean label map with terminal-step omission (ExtractionStep/EXTRACT_STEP_KO mirror)"

key-files:
  created:
    - packages/core/src/schemas/plan.ts
    - packages/core/src/schemas/plan.test.ts
  modified:
    - packages/core/src/constants.ts
    - packages/core/src/schemas/index.ts

key-decisions:
  - "planChannelName(tripId) = 'plan:{tripId}' — trip-scoped (not link-scoped) so plan generation broadcasts to one channel per trip (D-02)"
  - "PlanSchema.status = z.enum(['generating','draft']) matching the planned 0017 status CHECK; tests gate accept 'draft' / reject 'bogus'"
  - "GeneratePlanRequestSchema defaults: travel_mode='transit' (D-08, 일본 도시 대중교통), anchor_place_ids=[] (D-10), removed_place_ids=[] (D-11)"
  - "leg_travel_seconds nullable → null renders '이동시간 —' (Routes failed / first item)"

patterns-established:
  - "Phase 18 shared contract source-of-truth in @moajoa/core — EF/api/iOS all import these, no exploration"
  - "Surgical append to constants.ts: new plan block added below TripKeys, extraction block untouched"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05]

# Metrics
duration: 2min
completed: 2026-06-22
---

# Phase 18 Plan 01: Plan Shared Contract Summary

**`@moajoa/core` plans/plan_items Zod models + generate-plan EF request schema (transit/[]/[] defaults) + trip-scoped `planChannelName` builder + PlanStep/PLAN_STEP_KO/TravelMode constants — the Wave 1 foundation every Phase 18 downstream plan imports.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-22T06:36:31Z
- **Completed:** 2026-06-22T06:38:06Z
- **Tasks:** 2 (TDD RED → GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `GeneratePlanRequestSchema` with `.default()` defaults (transit / empty anchor / empty removed) — rejects bad travel_mode + non-uuid trip_id/anchor ids at the EF boundary (T-18-01 mitigation supplied).
- `planChannelName(tripId)` single channel builder so the EF and the iOS client cannot drift on the broadcast channel name (T-18-02 mitigation).
- `PlanSchema` / `PlanItemSchema` modeling the planned 0017 columns (status, travel_mode, collaborative, day_index, sort_order, leg_travel_seconds nullable, is_anchor).
- `PlanStep` (loading/clustering/routing/done/error) + `PLAN_STEP_KO` Korean labels (done/error terminal, omitted) + `TravelMode` enum-from-const — all mirroring the shipped extraction idiom.
- Barrel re-export `export * from './plan'` so `@moajoa/core` surfaces every symbol to api/iOS/EF-mirror.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1: RED — plan.test.ts** - `3dde029` (test) — 12 `it()` cases, failed because `./plan` module + plan constants did not exist.
2. **Task 2: GREEN — plan.ts + constants append + barrel** - `ad26409` (feat) — schemas + constants + barrel; plan.test.ts 12/12, full core suite 62/62, typecheck clean.

No REFACTOR commit — the implementation is minimal (pure schema + const declarations); nothing to clean up.

**Plan metadata:** (this commit) `docs(18-01): complete plan shared contract plan`

## Files Created/Modified
- `packages/core/src/schemas/plan.ts` - Plan/PlanItem/GeneratePlanRequest/GeneratePlanResult Zod schemas + inferred types.
- `packages/core/src/schemas/plan.test.ts` - vitest coverage: request defaults + reject cases, channel builder, step/label/travel-mode constants, plan/item row accept+reject.
- `packages/core/src/constants.ts` - appended PLAN_CHANNEL_PREFIX, planChannelName, PlanStep, PLAN_STEP_KO, TravelMode below TripKeys (extraction block untouched).
- `packages/core/src/schemas/index.ts` - appended `export * from './plan'`.

## Decisions Made
- Followed the plan's locked spec exactly. `PlanSchema.status` uses `z.enum(['generating','draft'])` (the planned 0017 CHECK set); Test 9 ("accepts status:'draft', rejects status:'bogus'") passes under this enum.
- `z.enum(TravelMode)` reuses the `as const` tuple directly (same idiom as `z.enum(TripVisibility)` in trip.ts) — no separate literal list, so the EF body / Plan row / iOS toggle share one TravelMode source.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED failed for the expected reason (missing `./plan` module), GREEN passed on first run, typecheck clean, no pre-existing core test regressed (50 → 62).

## TDD Gate Compliance
- RED gate: `test(18-01): ...` commit `3dde029` (suite failing, no test passed unexpectedly).
- GREEN gate: `feat(18-01): ...` commit `ad26409` after RED.
- REFACTOR gate: not needed (minimal declarations).

## User Setup Required
None - no external service configuration required. (Google Routes API enablement + Anthropic key are Plan 03 EF concerns.)

## Next Phase Readiness
- **Plan 02 (0017 migration):** `PlanSchema`/`PlanItemSchema` column shapes (status CHECK, travel_mode CHECK, collaborative default, day/sort/is_anchor) are the contract for the `plans`/`plan_items` table DDL.
- **Plan 03 (generate-plan EF):** must re-declare the request schema locally (Deno cannot import `@moajoa/core`) but mirror `GeneratePlanRequestSchema` exactly; emit broadcasts via the `planChannelName(tripId)` literal `plan:{tripId}`; broadcast steps per `PlanStep`.
- **Plan 04 (api queries):** `generatePlan` invoke returns `GeneratePlanResult`; `setTravelMode` accepts `TravelMode` values.
- **Plan 05 (iOS UI):** `subscribePlanProgress` subscribes to `planChannelName(tripId)`; progress card labels come from `PLAN_STEP_KO`; travel-mode toggle uses `TravelMode`.

## Self-Check: PASSED

- FOUND: packages/core/src/schemas/plan.ts
- FOUND: packages/core/src/schemas/plan.test.ts
- FOUND: .planning/phases/18-auto-plan-ai/18-01-SUMMARY.md
- FOUND: commit 3dde029 (RED)
- FOUND: commit ad26409 (GREEN)

---
*Phase: 18-auto-plan-ai*
*Completed: 2026-06-22*
