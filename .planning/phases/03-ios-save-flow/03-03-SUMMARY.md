---
phase: 03-ios-save-flow
plan: 03
subsystem: backend
tags: [supabase, edge-function, google-places, zod, schemas, places-api, fieldmask, cost-logging]

requires:
  - phase: 03-ios-save-flow
    plan: 01
    provides: migration 0005 (extraction_costs.link_id nullable + partial index) — unblocks cost logging for manual searches
  - phase: 02-extraction-pipeline-hardening
    provides: extraction_costs table (0004), FieldMask pattern (D-12)

provides:
  - resolve-place Edge Function (POST /functions/v1/resolve-place)
  - ResolvePlaceRequestSchema + ResolvedPlaceSchema + ResolvePlaceResponseSchema in @moajoa/core
  - renamePlace + deletePlace helpers in @moajoa/api (places.ts)
  - FIELD_MASK 5-field whitelist constant (Phase 2 D-12 lock for new function)

affects: [03-04-pending-drain, 03-05-broadcast-ui]

tech-stack:
  added:
    - jsr:@std/assert@1 (Deno test stdlib)
  patterns:
    - "resolve-place Deno test self-contained schema mirror (workspace package import via bundle unnecessary)"
    - "Bearer JWT gate as 401 short-circuit before any Places API call (preserves cost ceiling)"
    - "extraction_costs INSERT with link_id=null marks manual searches; partial index from 0005 keeps link-keyed aggregations fast"

key-files:
  created:
    - supabase/functions/resolve-place/deno.json
    - supabase/functions/resolve-place/test.ts
    - supabase/functions/resolve-place/index.ts
    - supabase/functions/resolve-place/pipeline/places-search.ts
    - .planning/phases/03-ios-save-flow/03-03-SUMMARY.md
  modified:
    - packages/core/src/schemas/place.ts (appended 3 schemas + 3 types)
    - packages/api/src/queries/places.ts (appended renamePlace + deletePlace)

key-decisions:
  - "extraction_costs INSERT uses input_tokens:null + output_tokens:null (the actual 0004 schema), not a single tokens column as PLAN.md described — Rule 1 inline fix"
  - "deletePlace is a const alias of hidePlace (soft-delete) rather than a new function — keeps soft-delete semantics single-sourced and satisfies D-09 UI naming"
  - "Deno test mirrors schemas inline (not import workspace package) — keeps the test self-contained and avoids the workspace bundle gymnastics that an npm:@moajoa/core import would require under Deno runtime"
  - "Deno installed via Homebrew during execution (was missing) — adds deno 2.8.0 to dev toolchain; documented for future contributors"

requirements-completed:
  - SAVE-05

duration: ~18 min
completed: 2026-05-26
---

# Phase 3 Plan 03: resolve-place Edge Function Summary

**Server-side Google Places Text Search (max 5 results, explicit 5-field FieldMask) with per-call cost logging, plus the supporting Zod request/response schemas in `@moajoa/core` and `renamePlace`/`deletePlace` helpers in `@moajoa/api`. Unblocks SAVE-05 manual pin CRUD without exposing the Places API key on-device.**

## Performance

- **Duration:** ~18 minutes
- **Started:** 2026-05-26
- **Completed:** 2026-05-26
- **Tasks:** 3 / 3
- **Files modified:** 6 (4 created + 2 modified)
- **Commits:** 3 task commits (test → feat → feat) following TDD gate sequence

## Accomplishments

### `supabase/functions/resolve-place/`

- **`pipeline/places-search.ts`** — Google Places API v1 Text Search wrapper. Exports `FIELD_MASK` constant (joined string, 5 fields explicit), `ResolvedPlace` interface, `SearchOptions`/`SearchResult` types, and `searchPlaces(opts)` function. Sets `maxResultCount: 5` (D-07). Supports optional 50km `locationBias` from `lat/lng`. Returns up to 5 normalized places + measured `duration_ms`. Drops malformed entries (empty `google_place_id`) defensively.

  **Exact FIELD_MASK string committed:**
  ```
  places.id,places.displayName,places.formattedAddress,places.location,places.primaryType
  ```

- **`index.ts`** — `Deno.serve` handler:
  - `OPTIONS` → CORS preflight 204
  - `!POST` → 405 `method_not_allowed`
  - Missing/non-Bearer `Authorization` → 401 `unauthorized` (preserves cost ceiling by short-circuiting before any external API call)
  - Invalid JSON body → 400 `invalid_json`
  - Zod parse failure → 400 `invalid_body` with `parsed.error.flatten()` detail
  - Missing `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` → 500 `server_misconfigured`
  - Places API failure → 502 `places_api_failed`
  - Success → 200 with `{ places: ResolvedPlace[] }` (max 5)
  - Always: `extraction_costs` INSERT with `link_id=null, provider='google_places', model='text-search', input_tokens=null, output_tokens=null, cost_usd=0.032, duration_ms=<measured>` (failures only log a warning — never block the success response)

- **`test.ts`** — 8 Deno tests:
  1. `RequestSchema rejects empty body (no query, no lat/lng)` — pass
  2. `RequestSchema accepts query only` — pass
  3. `RequestSchema accepts lat/lng without query` — pass
  4. `RequestSchema rejects query > 200 chars` — pass
  5. `RequestSchema rejects empty query string` — pass
  6. `FIELD_MASK has exactly five whitelisted fields and no wildcard` — pass (was RED until Task 2)
  7. `ResolvedSchema parses Google Places API v1 response shape` — pass
  8. `ResolvedSchema rejects when google_place_id missing` — pass

  **Final run:** `8 passed | 0 failed (~7ms)` with `deno test --allow-env --allow-net --allow-read`.

- **`deno.json`** — `imports` for `supabase-js`/`zod`, `test` task definition.

### `packages/core/src/schemas/place.ts` (appended)

Added at lines 84–121:

- **`ResolvePlaceRequestSchema`** (line 86) — `query?` (1–200 chars) ∪ `lat?`/`lng?` with `.refine(...)` enforcing "either query or (lat,lng) is required"; `language` defaults to `'ko'`
- **`type ResolvePlaceRequest`** (line 97)
- **`ResolvedPlaceSchema`** (line 103) — `google_place_id` + `displayName` + `formattedAddress` (nullable) + `location {lat,lng}` + `primaryType` (nullable)
- **`type ResolvedPlace`** (line 114)
- **`ResolvePlaceResponseSchema`** (line 117) — `z.array(ResolvedPlaceSchema).max(5)` (D-07)
- **`type ResolvePlaceResponse`** (line 121)

Existing exports (`PlaceSchema`, `PlaceAddManualSchema`, `ExtractedPlaceCandidateSchema`, `ExtractedPlacesPayloadSchema` + `type Place`/`type PlaceAddManual`/`type ExtractedPlaceCandidate`/`type ExtractedPlacesPayload`) all untouched.

### `packages/api/src/queries/places.ts` (appended)

```typescript
export async function renamePlace(
  client: MoajoaSupabaseClient,
  id: string,
  newName: string,
): Promise<Place>

export const deletePlace = hidePlace;
// type: (client: MoajoaSupabaseClient, id: string) => Promise<void>
```

- `renamePlace` validates: empty (after trim) → throws; > 200 chars → throws; otherwise `UPDATE places SET name_local = $trimmed WHERE id = $id` then returns the updated row. RLS `can_edit_board()` (0001_init.sql) enforces membership.
- `deletePlace` = `hidePlace` — single source of soft-delete semantics. The UI bottom sheet (Plan 03-05) calls `deletePlace(client, id)` for the intent-aligned name.

Existing exports (`listPlacesByBoard`, `listPlacesByLink`, `addManualPlace`, `hidePlace`, `unhidePlace`) all preserved.

## Task Commits

Each task committed atomically:

1. **Task 1 (RED — schemas + failing test):** `a617937` (test)
2. **Task 2 (GREEN — places-search.ts + index.ts):** `83a3b8f` (feat)
3. **Task 3 (helpers):** `ea2f0f0` (feat)

TDD gate sequence present in git log: `test(03-03)` → `feat(03-03)` → `feat(03-03)`.

## Decisions Made

- **`tokens: null` → `input_tokens: null, output_tokens: null` (Rule 1 inline fix).** PLAN.md proposed `tokens: null` in the `extraction_costs` INSERT body, but migration 0004 declared the schema with separate `input_tokens int, output_tokens int` columns — there is no `tokens` column. Using the PLAN.md literal would have raised a Postgres "column 'tokens' does not exist" error at runtime. Fixed inline to match the actual schema; documented in commit body.
- **Deno test schema mirror.** Importing `@moajoa/core` from a Deno test would require a bundle step (npm: imports work for runtime deps but the workspace package isn't published). The test re-declares the request/response Zod schemas inline. Tradeoff: drift risk if `packages/core/src/schemas/place.ts` changes shape; mitigated by keeping the comment block at the top of `test.ts` pointing at the source-of-truth file.
- **`deletePlace = hidePlace` const alias (Karpathy §3.2).** Could have written a duplicate function with a `console.log('soft-delete')` or distinct semantics. Chose the alias — soft-delete logic lives in one place; the UI gets the intent-aligned name; zero duplication.
- **Deno installed (toolchain side effect).** `deno` was not in PATH at executor start. Installed via `brew install deno` (deno 2.8.0). This is a one-time dev-machine setup; CI does not need it because we don't run Deno tests in CI yet (Plan 03-03 has no CI hook — the Deno test is verified locally during execution).
- **CORS preflight included.** PLAN.md didn't strictly require OPTIONS handling but the iOS app calls Edge Functions via `supabase.functions.invoke` which the runtime issues as POST. Web app may eventually call this too. Included CORS headers preemptively (Karpathy §3.2 borderline — judged correctness/security, not speculative feature).
- **`places.slice(0, 5)` in `searchPlaces`.** Google API already enforces `maxResultCount: 5`, but the array slice + Zod `.max(5)` on the response form a belt-and-suspenders guard against API drift returning 6+ in some edge case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `tokens: null` schema mismatch in extraction_costs INSERT**
- **Found during:** Task 2 (cross-checking PLAN's INSERT body against migration 0004)
- **Issue:** PLAN.md's snippet uses `tokens: null`, but `extraction_costs` (0004) has columns `input_tokens int, output_tokens int` — no `tokens` column. Runtime would fail.
- **Fix:** Used `input_tokens: null, output_tokens: null` to match the real schema.
- **Files modified:** `supabase/functions/resolve-place/index.ts`
- **Commit:** `83a3b8f`

**2. [Rule 3 — Blocking] Deno CLI missing from local toolchain**
- **Found during:** Task 1 verification (running the Deno test scaffold)
- **Issue:** `deno` not in PATH; cannot run the RED test or verify the GREEN gate.
- **Fix:** `brew install deno` (deno 2.8.0).
- **Files modified:** None (toolchain only)
- **Commit:** No code change required

### Plan-aligned but slightly enriched
- Added `OPTIONS` CORS preflight to `index.ts` (PLAN was silent on CORS). Required for browser-origin invokes; iOS native invokes don't need it.
- `searchPlaces` returns `{ places, duration_ms }` instead of `ResolvedPlace[]` directly — let `index.ts` log the precise API call duration (vs. measuring around the whole pipeline call). Cleaner separation.

## Authentication Gates

None during execution — the function code itself adds an auth gate (Bearer JWT required), but no auth was needed during *executing* this plan. **Live curl smoke and Supabase functions deploy were intentionally deferred** to the real-device UAT pass (per executor prompt's `<additional_context>`: "DO NOT push schema changes ... User will run supabase db push + supabase functions deploy during real-device UAT"). The user will:

1. `supabase db push` (applies migration 0005 from Plan 03-01)
2. `supabase functions deploy resolve-place`
3. Verify `supabase secrets list | grep GOOGLE_PLACES_SERVER_KEY` returns the Phase 2 secret
4. Live curl smoke per PLAN Task 2 step D
5. SQL check: `select provider, model, link_id, duration_ms from extraction_costs where provider='google_places' order by created_at desc limit 3`

The Edge Function code is committed and ready; smoke verification happens at the same time the iOS bottom sheet (Plan 03-05) starts calling it.

## Issues Encountered

- **Deno not installed.** Resolved via `brew install deno` (deno 2.8.0, ~150MB). Recorded as a deviation; future contributors may want a `docs/DEV-SETUP.md` note.
- **PLAN's "grep guard" expression is a tautology.** The PLAN proposed `grep -rn "X-Goog-FieldMask" supabase/functions/ | grep -v "places.id"` as a wildcard check, but both extract-youtube and resolve-place reference the FIELD_MASK via a *variable* on the header line, so `places.id` is never on the same line. The real intent (no wildcard anywhere in any FIELD_MASK definition) was verified manually — both definitions list exactly 5 fields, no `*`. Not a deviation, but worth noting that the literal grep guard in the PLAN's acceptance is incorrect.
- **`Wildcard check` grep finds the test file.** `grep -rn "FIELD_MASK" supabase/functions/ | grep -E "(\*|wildcard|all)"` matches `test.ts` because that file *mentions* "wildcard" in a test name/comment. The actual FIELD_MASK *values* contain no wildcards. Verified manually.

## Threat Flags

None — the function exactly matches the threat register from PLAN.md:
- **T-03-03-01** (key leak): `GOOGLE_PLACES_SERVER_KEY` only read via `Deno.env.get` in `pipeline/places-search.ts`. No client refs. Verified: `grep -rn "GOOGLE_PLACES_SERVER_KEY" apps/` returns empty.
- **T-03-03-02** (wildcard FieldMask drift): Both extract-youtube and resolve-place use explicit 5-field lists. New Deno test guards regression.
- **T-03-03-03** (DoS by junk queries): Bearer auth gate + per-call cost log surfaces abuse; billing alert caps blast radius.
- **T-03-03-04** (non-member rename/delete): RLS `can_edit_board()` enforces membership; manual UAT scenario N2 covers.

## User Setup Required

To activate this function in production:

1. **Run migration 0005** (if not already): `supabase db push`
2. **Deploy the function:** `supabase functions deploy resolve-place`
3. **Verify secret:** `supabase secrets list | grep GOOGLE_PLACES_SERVER_KEY` (should be set from Phase 2)
4. **Smoke test:**
   ```bash
   SUPABASE_URL=$(grep EXPO_PUBLIC_SUPABASE_URL apps/ios/.env.local | cut -d= -f2)
   SUPABASE_ANON_KEY=$(grep EXPO_PUBLIC_SUPABASE_ANON_KEY apps/ios/.env.local | cut -d= -f2)
   curl -s -X POST "$SUPABASE_URL/functions/v1/resolve-place" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "content-type: application/json" \
     -d '{"query":"스타벅스 도쿄","language":"ko"}'
   ```
   Expected: HTTP 200 with `{"places": [...up to 5 items...]}`.
5. **Verify cost row:** Open Supabase Studio → SQL editor →
   ```sql
   select provider, model, link_id, duration_ms
   from extraction_costs
   where provider='google_places'
   order by created_at desc limit 3;
   ```
   Expected: at least 1 row with `link_id IS NULL` matching the smoke call.

## TDD Gate Compliance

Plan executed with `tdd="true"` on Tasks 1 & 2:

- **RED gate (test commit):** `a617937 test(03-03): add resolve-place schemas + failing FIELD_MASK test` — verified that the FIELD_MASK test failed because `pipeline/places-search.ts` did not yet exist (module-not-found error).
- **GREEN gate (feat commit):** `83a3b8f feat(03-03): implement resolve-place Edge Function with FieldMask + cost logging` — all 8 Deno tests pass.
- **REFACTOR gate:** Not needed — implementation came out clean on first pass.

Task 3 (helpers) was not TDD-marked; standard feat commit `ea2f0f0`.

## Next Phase Readiness

Wave 2 complete on this side:

- **Plan 03-04 (pending drain + native module):** Can import `ResolvePlaceRequest`/`ResolvedPlace` types from `@moajoa/core` if the drain path needs to manually re-resolve a place (it shouldn't — drain replays `addLink` which triggers `extract-youtube`).
- **Plan 03-05 (UI integration / bottom sheet):** All three pieces are ready:
  - `supabase.functions.invoke('resolve-place', { body: { query, language: 'ko' } })` → returns `{ places }` (max 5)
  - `addManualPlace(client, { board_id, google_place_id, note? })` for the pin-add path (already existed)
  - `renamePlace(client, id, newName)` for "이름 수정" action
  - `deletePlace(client, id)` for "삭제" action

No blockers carried forward.

## Self-Check

Created files verified to exist:
- `supabase/functions/resolve-place/deno.json` — FOUND
- `supabase/functions/resolve-place/test.ts` — FOUND
- `supabase/functions/resolve-place/index.ts` — FOUND
- `supabase/functions/resolve-place/pipeline/places-search.ts` — FOUND

Modified files contain expected additions:
- `packages/core/src/schemas/place.ts` lines 86, 103, 117 — three new schema exports present
- `packages/api/src/queries/places.ts` — `renamePlace` + `deletePlace` exports present, existing helpers preserved

Commits verified in git log:
- `a617937` (test 03-03 RED) — FOUND
- `83a3b8f` (feat 03-03 GREEN Edge Function) — FOUND
- `ea2f0f0` (feat 03-03 helpers) — FOUND

Automated gates passing:
- `deno test --allow-env --allow-net --allow-read supabase/functions/resolve-place/test.ts` — 8 passed | 0 failed
- `pnpm --filter @moajoa/core typecheck` — exits 0
- `pnpm --filter @moajoa/api typecheck` — exits 0
- `grep "from '.*\.js'" packages/api/src/queries/places.ts` — no matches (CLAUDE.md §4.5)
- `grep -rn "GOOGLE_PLACES_SERVER_KEY" apps/` — no matches (T-03-03-01 mitigation)

## Self-Check: PASSED

---
*Phase: 03-ios-save-flow*
*Completed: 2026-05-26*
