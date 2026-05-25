---
phase: 05-trust-ui-onboarding
plan: 01
subsystem: database
tags:
  - migration
  - supabase
  - postgres-trigger
  - rpc
  - edge-function
  - constants
  - typescript

requires:
  - phase: 02-extraction-pipeline-hardening
    provides: places.source_kind/inferred_city columns + Zod confidence field in LLM output (D-04)
  - phase: 04-public-board-web
    provides: public_board_view jsonb shape consumed by /b/[slug] SSR

provides:
  - "places.confidence numeric(3,2) column with CHECK 0..1"
  - "public_board_view RPC returning source_kind + confidence per place"
  - "profiles_create_first_board AFTER INSERT trigger (SECURITY DEFINER, idempotent)"
  - "Backfill: every existing profile owns at least one '내 첫 여행' board"
  - "extract-youtube edge function wires per-place confidence into upsert"
  - "@moajoa/core: EXTRACT_STEP_KO + LOW_CONFIDENCE_THRESHOLD + OnboardKeys"
  - "@moajoa/api: confirmAiPlace (source_kind→manual) + rejectAiPlace (=hidePlace)"

affects:
  - "05-02 (StepIndicator uses EXTRACT_STEP_KO)"
  - "05-03 (retry path reuses LOW_CONFIDENCE_THRESHOLD reasoning)"
  - "05-04 (iOS marker + low-conf sheet consume confidence + confirmAiPlace/rejectAiPlace)"
  - "05-05 (web marker reads source_kind + confidence from public_board_view)"
  - "05-06 (onboarding card uses OnboardKeys.LinkCardDismissed)"

tech-stack:
  added: []
  patterns:
    - "Single-migration multi-part lock (column + RPC + trigger + backfill in one file)"
    - "SECURITY DEFINER trigger with NEW.id-only guard (T-05-03 mitigation pattern)"
    - "Soft-delete via alias export (rejectAiPlace = hidePlace; mirrors deletePlace pattern from Phase 3)"

key-files:
  created:
    - "supabase/migrations/0006_trust_ui_onboarding.sql"
  modified:
    - "supabase/functions/extract-youtube/index.ts"
    - "packages/core/src/constants.ts"
    - "packages/api/src/queries/places.ts"

key-decisions:
  - "Single migration 0006 file holds Part 1-4 atomically (column + RPC + trigger + backfill) so apply is all-or-nothing — prevents RPC returning confidence before column exists"
  - "RPC redefinition uses full CREATE OR REPLACE with explicit SELECT list (not jsonb_build_object || extension) so diff is reviewable against 0001_init.sql"
  - "profiles_create_first_board guard uses `NOT EXISTS (select 1 from boards where owner_id = NEW.id)` — idempotent for replay; ON CONFLICT not viable since boards has no unique (owner_id) constraint"
  - "rejectAiPlace exported as alias of hidePlace (mirrors deletePlace = hidePlace from Phase 3 03-03) — Karpathy §3.2: no duplicated soft-delete logic"
  - "confirmAiPlace sets confidence: null (not 1.0) when flipping to source_kind='manual' — D-15 null != low-confidence semantics ensure UI no longer renders the badge after confirm"

patterns-established:
  - "Phase-5 cross-cut constants live in packages/core/src/constants.ts alongside Phase-3 SharedDefaultsKeys (single namespace for shared client/edge state)"
  - "Per-place LLM signal wiring requires only one line at the upsert object (confidence: r.cand.confidence) when Zod validation is already in pipeline/claude.ts"

requirements-completed:
  - TRUST-01
  - TRUST-04
  - ONBOARD-01

duration: 4min
completed: 2026-05-26
---

# Phase 5 Plan 01: Foundation — Migration 0006 + Core Constants + Edge Function wire Summary

**`places.confidence numeric(3,2)` + `public_board_view` redefinition (source_kind + confidence) + `profiles_create_first_board` trigger with backfill, plus EXTRACT_STEP_KO/LOW_CONFIDENCE_THRESHOLD/OnboardKeys constants and confirmAiPlace/rejectAiPlace helpers — single foundation that unblocks 05-02 through 05-06.**

## Performance

- **Duration:** ~4 min (199s wall)
- **Started:** 2026-05-25T22:43:35Z
- **Completed:** 2026-05-25T22:46:54Z
- **Tasks:** 5 (T1 migration + T2 type regen [deferred] + T3 constants + T4 edge wire + T5 helpers)
- **Files modified:** 4 (1 created + 3 edited) + 1 deferred (database.ts)

## Accomplishments

- **Atomic 0006 migration:** 4 parts (column ADD + RPC redef + trigger + backfill) in one file, append-only per CLAUDE.md §4.3. CHECK constraint enforces T-05-01 (`confidence is null or 0..1`).
- **`public_board_view` web parity:** RPC now returns `source_kind` and `confidence` in places jsonb so Plan 05-05 web marker can branch on AI/manual and high/low conf without further RPC changes.
- **Onboarding trigger + backfill:** New profile inserts auto-create '내 첫 여행' (visibility=private) in the same transaction as `handle_new_auth_user`. Existing dogfooders get one board via backfill SELECT — both paths idempotent.
- **Constants single source:** `EXTRACT_STEP_KO` (D-09 한국어 fixture), `LOW_CONFIDENCE_THRESHOLD = 0.7` (D-15), `OnboardKeys.LinkCardDismissed` (D-20) — exported from `@moajoa/core` so Plans 02–06 import without drift.
- **Edge function wire:** One line (`confidence: r.cand.confidence`) added to places upsert. Zod schema in `pipeline/claude.ts` already validates 0..1 default 0.5 (Phase 2 D-04) — no schema work needed.
- **Helpers:** `confirmAiPlace` (UPDATE source_kind='manual', confidence=null) and `rejectAiPlace` (alias of hidePlace) appended to `packages/api/src/queries/places.ts`, mirroring Phase 3 `deletePlace` alias pattern.

## Task Commits

1. **T1 — Migration 0006** — `ef8e842` (feat)
2. **T3 — Core constants** — `c206097` (feat)
3. **T4 — Edge function confidence wire** — `5d3f194` (feat)
4. **T5 — confirmAiPlace + rejectAiPlace** — `3732511` (feat)

T2 (type regen) deferred — see User Setup Required below. No separate commit.

## Files Created/Modified

- **Created:** `supabase/migrations/0006_trust_ui_onboarding.sql` — column + RPC redef + trigger + backfill (129 lines)
- **Modified:** `supabase/functions/extract-youtube/index.ts` — +1 line in places upsert object (`confidence: r.cand.confidence`)
- **Modified:** `packages/core/src/constants.ts` — +31 lines (EXTRACT_STEP_KO + LOW_CONFIDENCE_THRESHOLD + OnboardKeys)
- **Modified:** `packages/api/src/queries/places.ts` — +31 lines (confirmAiPlace + rejectAiPlace alias)
- **Deferred (NOT modified):** `packages/api/src/types/database.ts` — needs `pnpm supabase:types` after migration apply (Docker / linked-project login required)

## Decisions Made

- See `key-decisions` frontmatter. All decisions follow CONTEXT.md D-01 through D-25 verbatim — no new architectural calls during execution.
- **`pg_trigger` name `profiles_first_board_trigger`** chosen for symmetry with existing `places_default_added_by` convention (subject + action).
- **Backfill placed AFTER trigger creation** so a brand-new database init also gets idempotent behavior (trigger fires first on any inserts in seed, then backfill is a no-op).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored `packages/api/src/types/database.ts` from HEAD after T2 shell-redirect zeroed it**
- **Found during:** T5 typecheck (`pnpm -F @moajoa/api typecheck`)
- **Issue:** T2's `pnpm supabase:types` runs `supabase gen types typescript --local > packages/api/src/types/database.ts`. The shell redirect creates the empty file before the command runs, and when `supabase gen` failed (Docker daemon not running locally), only the empty file was left — wiping the previously committed 1545-line type definitions (last regenerated in commit `dd10982`). Typecheck failed: `File ... is not a module`.
- **Fix:** `git checkout HEAD -- packages/api/src/types/database.ts` to restore the committed types unchanged. The migration-aware regen still owes itself for `places.confidence` and `source_kind` RPC fields — deferred as a user action (Docker or linked project login required, see User Setup Required).
- **Files modified:** `packages/api/src/types/database.ts` (restored to HEAD)
- **Verification:** `wc -l` returns 1545 (matches HEAD); `pnpm -F @moajoa/api typecheck` passes.
- **Committed in:** N/A — restoration only undoes accidental working-tree pollution from the executor's own T2 attempt; no logical change to commit.

---

**Total deviations:** 1 auto-fixed (1 bug — executor's own T2 shell redirect side effect)
**Impact on plan:** Zero scope creep. The deviation is purely housekeeping for the executor's tooling mishap. Type regen is the only remaining defer item, surfaced as User Setup below.

## Issues Encountered

- **Docker Desktop not running + Supabase access token not set** → local `supabase gen types --local` and remote `--linked` both unable to refresh `packages/api/src/types/database.ts`. The downstream plans 05-02 through 05-06 will read places rows with `confidence`/`source_kind` typed as `unknown` until user runs the regen. Workaround: callers can use `as Place` casts (Phase 3 pattern in `packages/api/src/queries/places.ts`) — non-blocking for development, but should be regenerated before merge.

## User Setup Required

**Type regen + migration push are user-side actions** (require auth/Docker):

1. **Push migration 0006** to linked Supabase project:
   ```bash
   supabase db push
   ```
   This applies Parts 1–4 to prod. Verify with `\d places` (confidence column present) and `SELECT public_board_view('<any-public-slug>')` (jsonb places[*] include `source_kind` + `confidence`).

2. **Regenerate types** after push:
   ```bash
   # Either: link + access token
   supabase login           # one-time, browser auth
   pnpm supabase:types      # currently runs --local; or use --linked
   # Or: start Docker Desktop and run supabase:types
   ```
   Verify: `grep -c confidence packages/api/src/types/database.ts` returns > 0.

3. **Verify trigger** (one-shot sanity SQL on prod):
   ```sql
   -- Should return 0 rows (every profile has ≥ 1 board after backfill)
   select p.id, p.display_name
   from profiles p
   where not exists (select 1 from boards where owner_id = p.id);
   ```

No env vars to add. No third-party dashboard config.

## Next Phase Readiness

- **05-02 (iOS step indicator):** import EXTRACT_STEP_KO from `@moajoa/core` ready.
- **05-03 (toast retry):** independent of this plan's surface but uses same broadcast channel — no blocker.
- **05-04 (iOS low-conf sheet):** `confirmAiPlace` / `rejectAiPlace` / LOW_CONFIDENCE_THRESHOLD all wired and importable. Type-narrowing requires database.ts regen (User Setup #2).
- **05-05 (web marker):** `public_board_view` jsonb now exposes `source_kind` + `confidence` — Plan 05-05 reads `place.confidence` / `place.source_kind` in `public-board-map.tsx` SVG branch logic.
- **05-06 (onboarding card):** `OnboardKeys.LinkCardDismissed` available; backfill ensures every existing dogfooder has at least one (empty) '내 첫 여행' board where the card surfaces.

**Blocker for verification (not for next plan code):** Migration not yet pushed to remote prod — Plans 02–06 can build and typecheck against `unknown`/casts, but live RPC behavior is not testable until User Setup #1 is done.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `supabase/migrations/0006_trust_ui_onboarding.sql` → FOUND (129 lines)
- `supabase/functions/extract-youtube/index.ts` confidence wire → present (1 line added)
- `packages/core/src/constants.ts` EXTRACT_STEP_KO + LOW_CONFIDENCE_THRESHOLD + OnboardKeys → all present
- `packages/api/src/queries/places.ts` confirmAiPlace + rejectAiPlace → present
- Commits ef8e842, c206097, 5d3f194, 3732511 → all FOUND in `git log`

---

*Phase: 05-trust-ui-onboarding*
*Completed: 2026-05-26*
