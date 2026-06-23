---
phase: 19-date-voting
plan: 01
subsystem: database
tags: [postgres, supabase, rls, security-definer, anon-grant, migration, date-voting, realtime]

# Dependency graph
requires:
  - phase: 17-trips-ia
    provides: "0016_trips_baseline.sql — trips(start/end_date nullable), am_trip_owner/can_read_trip/can_edit_trip DEFINER helpers, ensure_share_slug entropy idiom, join_shared_trip bearer-validate template, vote_counts_for_places anon-grant template, set_updated_at, trips_default_representative trigger"
  - phase: 18-plan
    provides: "0017_plans.sql — append-only header/table/index/RLS/trigger-reuse house style; plan_items parent-routed RLS idiom"
provides:
  - "supabase/migrations/0018_date_polls.sql — 4 tables (date_polls, date_poll_options, date_votes, date_comments) + ensure_poll_code trigger + date_votes_dedup unique index (NULLS NOT DISTINCT)"
  - "5 anon-grant SECURITY DEFINER RPCs: cast_date_vote, poll_view_by_code, poll_vote_tally, post_poll_comment, delete_poll_comment"
  - "confirm_poll_date (SECURITY INVOKER, am_trip_owner guard, host-only, atomic trip-dates + poll-close)"
  - "create_dateless_trip_with_poll (SECURITY INVOKER, owner RLS + representative trigger fire normally)"
  - "Regenerated packages/api/src/types/database.ts (+187 lines): new Row/Insert/Update + 7 RPC signatures — the build contract for plans 02-04"
  - "Proven anon-write security model (psql set role anon matrix): code=bearer, device-token dedup, poll-open gate, host-only confirm"
affects: [19-02-core-api, 19-03-ios, 19-04-web-poll-island]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anon-write SECURITY DEFINER RPC (validate bearer poll_code -> controlled write -> grant to authenticated, anon) — the new security surface, mirrors join_shared_trip"
    - "Per-mode nullable dedup via PG17 NULLS NOT DISTINCT unique index + matching ON CONFLICT target"
    - "Information-disclosure-safe aggregation RPC (shaped jsonb counts + nicknames only, never device_token)"
    - "Host confirm = SECURITY INVOKER + am_trip_owner guard, atomic trip-date write + poll close"

key-files:
  created:
    - "supabase/migrations/0018_date_polls.sql"
  modified:
    - "packages/api/src/types/database.ts"

key-decisions:
  - "poll_code is an independent server-minted bearer code (NOT share_slug-derived) so closing the poll revokes anon writes without touching trip sharing"
  - "Anon writes go through DEFINER RPCs only — date_votes/date_comments grant NO direct anon INSERT and have NO anon RLS policy"
  - "Tables READ policies for authenticated host route cross-table checks through reused can_*_trip DEFINER helpers (42P17 guard); helpers never redefined"
  - "Dedup index uses NULLS NOT DISTINCT (PG17) so range (vote_date NULL) and grid (option_id NULL) votes dedup per (poll, device, option/date)"

patterns-established:
  - "Anon bearer-code DEFINER write RPC (cast/comment/delete) granted to authenticated, anon"
  - "Anon-grant shaped-jsonb aggregation RPC returning no PII (no device_token)"
  - "INVOKER owner-guarded atomic confirm RPC (am_trip_owner) granted to authenticated only"

requirements-completed: [POLL-01, POLL-02, POLL-03]

# Metrics
duration: 6min
completed: 2026-06-23
---

# Phase 19 Plan 01: Date-Poll Data + Security Surface Summary

**Append-only `0018_date_polls.sql` lands the entire date-voting data + security surface — 4 tables, an `ensure_poll_code` bearer trigger, a PG17 `NULLS NOT DISTINCT` dedup index, 5 anon-grant SECURITY DEFINER RPCs (vote/comment/tally/view), a host-only INVOKER confirm, and a dateless-trip create RPC — applied locally (42P17=0) with `database.ts` regenerated and the full anon-write security model proven by psql `set role anon`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-23T04:12:58Z
- **Completed:** 2026-06-23T04:18:41Z
- **Tasks:** 2 (Task 1 migration authoring + grep gates, Task 2 local apply + typegen + psql security matrix)
- **Files modified:** 2 (1 created, 1 regenerated)

## Accomplishments
- **0018_date_polls.sql** created append-only (0016/0017 never touched): `date_polls`, `date_poll_options`, `date_votes`, `date_comments`; `ensure_poll_code` trigger; `date_votes_dedup` `NULLS NOT DISTINCT` unique index.
- **6 RPCs:** 5 anon-grant DEFINER (`cast_date_vote`, `poll_view_by_code`, `poll_vote_tally`, `post_poll_comment`, `delete_poll_comment`) + `confirm_poll_date` (INVOKER, host-only) + `create_dateless_trip_with_poll` (INVOKER).
- **Local apply clean:** `pnpm supabase:reset` applied 0016+0017+0018 with **42P17 recursion count = 0** and **zero dropped-object errors**.
- **`database.ts` regenerated** (+187 lines) with new tables + all 7 RPC signatures; `pnpm --filter @moajoa/api typecheck` exit 0 — the build contract for plans 02-04.
- **Full psql `set role anon` security matrix asserted** (results below).

## Task Commits

1. **Task 1: Write 0018_date_polls.sql — tables + trigger + 6 RPCs** — `be3232e` (feat)
2. **Task 2: Apply 0018 locally + regenerate types + psql security assertions** — `e3a8e9f` (feat)

## Files Created/Modified
- `supabase/migrations/0018_date_polls.sql` — date-voting data + security surface (4 tables, `ensure_poll_code` trigger, dedup index, 5 anon DEFINER RPCs, host confirm, dateless create). 269 lines.
- `packages/api/src/types/database.ts` — regenerated (+187 lines): `date_polls`/`date_poll_options`/`date_votes`/`date_comments` Row/Insert/Update + 7 RPC function signatures.

## psql Security Matrix Results (full)

Seed: owner user (`aaaa…1`) + non-owner user (`bbbb…2`) + dateless GRID poll. `poll_code` minted by trigger.

| # | Assertion | Result | Evidence |
|---|-----------|--------|----------|
| A | `poll_code` minted >=8 chars, `^[a-z0-9]+$` | PASS | `poll_code='9kcyabstdcqc'`, len=12, len_ok=t, charset_ok=t (server-minted via `gen_random_bytes`) |
| B | anon `cast_date_vote(valid grid)` succeeds | PASS | returns void under `set role anon` |
| C | dedup upsert: 2nd call same (poll, device, date) → 1 row | PASS | `dev1_rows=1`, `dedup_ok=t`, `availability_after_upsert='unavailable'` (upsert, not duplicate) |
| D | anon direct `insert into date_votes` → denied | PASS | `ERROR: new row violates row-level security policy for table "date_votes"` (no anon INSERT policy/grant) |
| E | anon `cast_date_vote(bad code)` → raises | PASS | `ERROR: poll not found or closed` (bearer validation) |
| F | closed poll → `cast_date_vote` raises | PASS | after `status='closed'`: `ERROR: poll not found or closed` (poll-open gate) |
| G | `poll_vote_tally` shape (grid) + no `device_token` | PASS | `{"mode":"grid","tally":[{"nicknames":["둘째"],"vote_date":"2026-07-01","available_count":1}, …],"status":"open"}`; `leaks_device_token=f` |
| H1 | non-owner **member** confirm → raises `host only` | PASS | authenticated non-owner editor (can read poll) → `ERROR: host only`; trip dates stay NULL, poll stays open (write rolled back) |
| H2 | owner confirm → atomic trip-dates + poll-close | PASS | authenticated owner → `start_date=2026-07-10`, `end_date=2026-07-12`, `poll_status=closed` |
| H1' | non-owner **non-member** confirm → rejected | PASS (stronger) | rejected by RLS before owner guard → `ERROR: poll not found`; write rolled back |

All write-rejection cases verified to roll back (trip dates NULL / poll open) — no partial confirm.

## Decisions Made
- None beyond the plan — the plan locked all decisions. The migration was written verbatim against the analog idioms (RESEARCH Patterns 1-6, 0016/0017 line refs).

## Deviations from Plan

None — plan executed exactly as written. The migration matches the plan's specified bodies; all Task 1 grep gates and Task 2 acceptance criteria passed.

## Issues Encountered

**1. psql test-harness artifact (NOT a migration bug): `set_config(..., is_local=true)` does not survive autocommit statement boundaries.**
- **During:** Task 2 owner-guard assertion (H).
- **Symptom:** First run of the non-owner `confirm_poll_date` raised `'poll not found'` instead of `'host only'`, and the owner positive-control ALSO raised `'poll not found'`.
- **Root cause:** `confirm_poll_date` is `SECURITY INVOKER`; `auth.uid()` reads `request.jwt.claims`. In psql autocommit each statement is its own transaction, so a transaction-local `set_config(..., true)` set in one `SELECT` was gone by the next statement's RPC call → `auth.uid()` null → the inner `date_polls` SELECT (RLS `to authenticated`) returned 0 rows → `v_trip_id` NULL → `'poll not found'`.
- **Resolution:** Wrapped claim-set + RPC call in a single `BEGIN; set local role authenticated; … COMMIT;` block. Owner then confirms atomically (H2 PASS); a non-owner **member** (who can read the poll) reaches the `am_trip_owner` guard and raises exactly `'host only'` (H1 PASS); a non-owner **non-member** is rejected even earlier by RLS with `'poll not found'` (H1', strictly stronger). No change to the migration was required.
- **Note on the exact message:** the plan's expected `'host only'` string fires only for a non-owner who *can read* the poll (accepted member). A non-member non-owner is denied by RLS before the explicit guard — both reject the write, defense-in-depth. The migration behavior is correct and secure.

## User Setup Required

None for downstream plans (local types are the build contract). **Remote `db push` is DEFERRED** to phase-verify / user-side per the established 17-03 / 18-02 precedent (requires `SUPABASE_ACCESS_TOKEN` + linked project + interactive confirmation). Plans 02-04 are non-blocked: local generated `database.ts` is the build contract, and the RPCs target whatever DB they are deployed against.

## Next Phase Readiness
- **19-02 (@moajoa/core + @moajoa/api):** can build against real generated types — `date_polls`/`date_poll_options`/`date_votes`/`date_comments` + the 7 RPC signatures are in `database.ts`. The anon-grant/RLS/dedup matrix is proven, so the typed RPC wrappers (`pollByCode`, `castDateVote`, `getPollTally`, `postComment`, `deleteComment`, `confirmPollDate`, `createDatelessTrip`) have a verified backend contract.
- **19-04 (web anon island):** `cast_date_vote`/`poll_vote_tally`/`post_poll_comment`/`delete_poll_comment`/`poll_view_by_code` are anon-callable (verified `set role anon`); the public `/poll/[code]` island can call them with the anon key, no login.
- **19-03 (iOS host card):** `confirm_poll_date` (host-only) + `create_dateless_trip_with_poll` are authenticated-only; the host plan-tab card + onboarding dateless create build against them.
- **No blockers.** Local DB is reset-reproducible; remote push is the only deferred (non-blocking) item.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0018_date_polls.sql`
- FOUND: `packages/api/src/types/database.ts`
- FOUND: `.planning/phases/19-date-voting/19-01-SUMMARY.md`
- FOUND: commit `be3232e` (Task 1)
- FOUND: commit `e3a8e9f` (Task 2)

---
*Phase: 19-date-voting*
*Completed: 2026-06-23*
