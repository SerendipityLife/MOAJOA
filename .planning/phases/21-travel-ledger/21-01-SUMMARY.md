---
phase: 21-travel-ledger
plan: 01
subsystem: database
tags: [postgres, supabase, rls, security-definer, migration, ledger, forwarding, fx, trip-id-nullable]

# Dependency graph
requires:
  - phase: 17-trips-ia
    provides: "0016_trips_baseline.sql — trips, can_read_trip SECURITY DEFINER helper, ensure_share_slug entropy idiom, set_updated_at trigger"
  - phase: 20-booking
    provides: "0021_booking.sql — append-only header/table/index/RLS/trigger-reuse house style (the canonical mirror)"
provides:
  - "supabase/migrations/0022_ledger.sql — forwarding_addresses (opaque token, ensure_forwarding_token trigger) + ledger_entries (nullable trip_id, 5-element FX record, 3 indexes) + 5 RLS policies"
  - "Regenerated packages/api/src/types/database.ts — ledger_entries + forwarding_addresses Row/Insert/Update + trip_id FK: the build contract for plans 02-05"
  - "Proven trip_id-NULL-branch RLS security model (psql BEGIN..ROLLBACK matrix A~H): unclassified owner-only ↔ assigned member-shared, row-owner-only write, forwarding token isolation"
affects: [21-02-core-schema, 21-03-api-queries, 21-04-email-pipeline, 21-05-ios-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "trip_id-NULL-branch RLS: CASE routes unclassified rows to owner_user_id=auth.uid() and assigned rows to the can_read_trip DEFINER helper (42P17 guard, no direct cross-table subquery)"
    - "Row-owner-only write (UPDATE/DELETE owner_user_id=auth.uid()) decoupled from read-sharing — the forwarder edits even after the entry becomes member-shared"
    - "No-INSERT-policy table = service-role-pipeline-only write surface (RLS enabled + no INSERT policy denies authenticated INSERT)"
    - "opaque per-user token minted by ensure_forwarding_token trigger (ensure_share_slug entropy idiom verbatim, share_slug→token rename)"

key-files:
  created:
    - "supabase/migrations/0022_ledger.sql"
  modified:
    - "packages/api/src/types/database.ts"

key-decisions:
  - "ledger_entries carries NO FK to plans/plan_items (LEDGER-04) — the ledger is populated by the forwarded-mail pipeline, independent of the app plan draft; reference is trip_id only and trip_id is NULLABLE"
  - "amount_krw is a plain nullable column (pipeline-computed), NOT a generated column, so a row survives when fx_rate is NULL (fx_source='unavailable')"
  - "ensure_forwarding_token mirrors ensure_share_slug verbatim (no retry loop; unique(token) is the collision guard)"
  - "No migration grants table DML explicitly — consistent with 0016-0021; the supabase platform authenticator path provides anon/authenticated/service_role DML grants (the RLS matrix reproduces this grant in-transaction to reach the RLS layer)"

requirements-completed: [LEDGER-01, LEDGER-03, LEDGER-04, LEDGER-05, LEDGER-06]

# Metrics
duration: ~12min
completed: 2026-07-05
status: complete
---

# Phase 21 Plan 01: Travel Ledger Data + Security Surface Summary

**Append-only `0022_ledger.sql` lands the travel-ledger data + security surface — `forwarding_addresses` (per-user opaque mail-forward token via an `ensure_forwarding_token` trigger) and `ledger_entries` (nullable `trip_id`, the 5-element FX record, 3 indexes, 5 RLS policies) — applied locally clean (42P17 recursion 0), `database.ts` regenerated with `@moajoa/api` typecheck exit 0, and the trip_id-NULL-branch RLS model proven end-to-end by a single-transaction psql matrix A~H (unclassified owner-only ↔ assigned member-shared, row-owner-only write, forwarding token isolation).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-05
- **Tasks:** 3 (Task 1 migration authoring + grep gates; Task 2 DB-apply-mode checkpoint pre-resolved LOCAL by orchestrator; Task 3 local apply + typegen + RLS matrix A~H)
- **Files modified:** 2 (1 created migration, 1 regenerated types)

## Accomplishments

- **`0022_ledger.sql`** created append-only (0016~0021 byte-unchanged, verified `git diff --stat` empty):
  - `forwarding_addresses` (id, user_id → auth.users cascade, token unique, created_at, `unique(user_id)`) + `ensure_forwarding_token` trigger (0016 `ensure_share_slug` idiom verbatim, share_slug→token).
  - `ledger_entries` (owner_user_id → auth.users cascade, **nullable** trip_id → trips `on delete set null`, status/fx_source/currency/card_last4 CHECKs, 5-element FX record `amount_foreign`/`currency`/`fx_rate`/`fx_source`/`fx_as_of` + pipeline-computed `amount_krw`, `raw_mime`/`raw_expires_at` TTL) + 3 indexes (owner, partial trip, partial status) + `ledger_entries_set_updated_at` reusing 0016 `set_updated_at()`.
  - **5 RLS policies:** ledger SELECT (trip_id-NULL CASE branch), ledger UPDATE + DELETE (owner-only), forwarding SELECT + INSERT (user-only). **No ledger INSERT policy** (service-role pipeline only). **No anon policy.**
- **Local apply clean:** `pnpm supabase:reset` applied 0016~0022 with **42P17 recursion = 0** (only benign `pgcrypto already exists` / `on_auth_user_created does not exist` NOTICEs).
- **`database.ts` regenerated** with `ledger_entries` + `forwarding_addresses` full Row/Insert/Update blocks + `ledger_entries_trip_id_fkey`; `pnpm --filter @moajoa/api typecheck` **exit 0**.
- **RLS matrix A~H PASS** (single `BEGIN … ROLLBACK`, DB left unchanged).

## Task Commits

1. **Task 1: Write 0022_ledger.sql (append-only) — tables + trigger + 5 RLS policies** — `e371bac` (feat)
2. **Task 3: Apply 0022 locally + regenerate database.ts + RLS matrix A~H** — `2fcf2b9` (feat)

(Task 2 was a `checkpoint:human-action gate="blocking"` DB-apply-mode gate, **pre-resolved by the orchestrator with the user as LOCAL** — no separate commit.)

## Task 1 Grep Gates (all PASS)

| Gate | Expected | Actual |
|------|----------|--------|
| `grep -c "create policy"` | 5 | 5 ✓ |
| `grep -cE "plan_id\|plan_item_id"` | 0 | 0 ✓ |
| `grep -c "exists"` | 0 | 0 ✓ |
| function definitions (`create or replace function`) | 1 | 1 ✓ (ensure_forwarding_token only; set_updated_at NOT redefined) |
| `grep -c "case when trip_id is null"` | ≥1 | 1 ✓ |
| `grep -cE "to anon\|grant.*anon"` | 0 | 0 ✓ |
| `git diff --stat` 0016 + 0021 (append-only) | empty | empty ✓ |
| `git grep -c "pooler.supabase" -- ':!*.md'` | 0 | 0 ✓ (LOCAL only — no pooler string anywhere) |

Note on the `create function` literal: the plan acceptance wrote `grep -c "create function" == 1`, but the canonical idiom (0016 `ensure_share_slug`, 0018 `ensure_poll_code`) uses `create or replace function`. The migration mirrors that verbatim, so there is exactly **one** function definition (intent satisfied); the literal `create function` (without `or replace`) count is 0 by design of the idiom.

## Task 3 Acceptance (types)

`database.ts` generated by the supabase CLI nests Row/Insert/Update under a single table key, so the table name appears once (+ FK ref) rather than the plan's assumed ≥3 literal repetitions. Substantive criterion fully met — both tables have complete Row/Insert/Update, all 5 FX elements present:

| Gate | Plan literal | Actual | Substantive |
|------|-------------|--------|-------------|
| `ledger_entries` block | ≥3 | 2 lines (key + FK) | Row+Insert+Update all present ✓ |
| `forwarding_addresses` block | ≥3 | 1 line (key) | Row+Insert+Update all present ✓ |
| `fx_source` / `amount_foreign` | ≥2 | 6 | present in Row+Insert+Update ✓ |
| `@moajoa/api` typecheck | exit 0 | exit 0 | ✓ |

## RLS Matrix Results (full — psql single BEGIN..ROLLBACK)

Seed: auth.users A (`aaaa…`) + B (`bbbb…`) (handle_new_auth_user trigger auto-creates profiles); trip T owned by A (private); B accepted `editor` member of T. Test-harness reproduces the platform authenticator DML grant in-transaction (raw local `set role` lacks it — every public table incl. `trips` shares this; NO migration grants DML). 42P17 recursion = 0 across all cases (the CASE non-null arm routes through the `can_read_trip` DEFINER helper).

| # | Assertion | Expected | Result |
|---|-----------|----------|--------|
| A | A inserts own `forwarding_addresses(user_id=A)` → success + token minted | token 12 chars, `^[a-z0-9]+$` | PASS — `token='hy4gns324pwc'`, len=12, charset_ok=t (trigger-minted) |
| B1 | A (authenticated) app-INSERT into `ledger_entries` → DENIED | RLS violation (no INSERT policy) | PASS — `ERROR: new row violates row-level security policy for table "ledger_entries"` |
| B2 | service_role (pipeline) inserts 2 rows (unclassified + assigned) → success | 2 rows | PASS — `INSERT 0 1` ×2 (UNCLASSIFIED-A trip_id NULL, ASSIGNED-T trip_id=T) |
| C | trip_id=NULL row (owner A) → A sees, B does not (unclassified owner-only, D-05) | A=1, B=0 | PASS — A_sees_unclassified=1, B_sees_unclassified=0 |
| D | trip_id=T row (owner A, B member) → both see (member-shared, D-04) | A=1, B=1 | PASS — A_sees_assigned=1, B_sees_assigned=1 |
| E | B (member) UPDATE/DELETE A-owned row → 0 rows (row-owner-only write, D-04) | 0 rows affected | PASS — UPDATE 0, B_update_rowcount should_be_0=0, DELETE 0 |
| F | A UPDATE own row (reassign trip) → success | 1 row | PASS — A_update_ok, `UPDATE 1`, trip_id set |
| G1 | fx_source `'bank'` → CHECK violation | reject | PASS — `ledger_entries_fx_source_check` violation |
| G2 | fx_source `'email'` → ok | accept | PASS |
| G3 | status `'done'` → CHECK violation | reject | PASS — `ledger_entries_status_check` violation |
| G4 | status `'ready'` → ok | accept | PASS |
| G5 | card_last4 `'12ab'` → CHECK violation | reject | PASS — `ledger_entries_card_last4_check` violation |
| G6 | card_last4 `'1234'` → ok | accept | PASS |
| H | B SELECT A's forwarding token → 0 rows (user_id=auth.uid isolation, T-21-03) | 0 rows | PASS — B_sees_A_token should_be_0=0 |

All write-rejection cases (B1/E) verified non-destructive; final `ROLLBACK` left the DB unchanged (reset-reproducible). Threat register T-21-01 (C), T-21-02 (E), T-21-03 (H), T-21-05 (B1) all demonstrated.

## Decisions Made

- None beyond the plan — the migration was written verbatim against the analog idioms (0016 `ensure_share_slug`/`set_updated_at`/`can_read_trip`, 0018 `ensure_poll_code`, 0021 header/table/RLS house style). All Task 1 grep gates and Task 3 acceptance passed.

## Deviations from Plan

None to the migration or the security model — plan executed as written. Two **test-harness accommodations** (not code changes):

**1. [Rule 3 - Blocking] Raw local `set role` lacks platform DML grants — added grants in the test transaction.**
- **Found during:** Task 3, first RLS matrix run — every `authenticated`/`service_role` statement raised `permission denied for table` (table-level GRANT, before RLS).
- **Root cause:** Supabase's platform authenticator path (not the migration files) grants SELECT/INSERT/UPDATE/DELETE to anon/authenticated/service_role. Verified this is universal: raw `set role authenticated; select from trips` fails identically — **no** public table (trips/links/booking_checklist_items included) carries these grants in the reset state, and **no** 0016-0021 migration grants DML.
- **Resolution:** Added `grant select,insert,update,delete on ledger_entries, forwarding_addresses to authenticated, service_role` inside the test transaction (rolled back) to reach the RLS layer. **No migration change** — the migration correctly relies on the same platform grant every other table uses.

**2. Plan literal grep counts assumed a different `database.ts` generation format** (table name repeated per Row/Insert/Update). The supabase CLI nests them under one key. Substantive criterion (both tables' full Row/Insert/Update + all 5 FX elements + typecheck 0) fully met; documented in the Task 3 Acceptance table above.

## Issues Encountered

- **`psql` not on host PATH** — routed through the running `supabase_db_moajoa` docker container (`docker cp` + `docker exec … psql`). No impact on results.

## User Setup Required

None for downstream plans — the local generated `database.ts` is the build contract for plans 02-05. **Remote `db push` is DEFERRED** (LOCAL-only apply per the resolved checkpoint; no pooler string exists or was written). The migration targets whatever DB it is later deployed against.

## Next Phase Readiness

- **21-02 (@moajoa/core `schemas/ledger.ts`):** the DB CHECK values (`status`, `fx_source`, `card_last4` regex, `currency` length-3) are locked — the const-enums (`LedgerStatus`, `FxSource`) must match character-for-character.
- **21-03 (@moajoa/api `ledger.ts`/`forwarding.ts`):** can build against real generated types — `ledger_entries`/`forwarding_addresses` Row/Insert/Update in `database.ts`; the RLS model (unclassified owner-only read via `.is('trip_id',null)`, member-shared assigned read via `can_read_trip`, owner-only write, `getOrCreateForwardingAddress` insert-then-trigger-mint) is proven.
- **21-04 (email pipeline EF):** ledger INSERT is service-role-only (verified B1 deny / B2 accept) — the `inbound-email` EF writes with the service role; the trip_id-NULL default (unclassified inbox) and 5-element FX columns are ready.
- **No blockers.** Local DB is reset-reproducible; remote push is the only deferred (non-blocking) item.

## Self-Check: PASSED

- FOUND: `supabase/migrations/0022_ledger.sql`
- FOUND: `packages/api/src/types/database.ts`
- FOUND: `.planning/phases/21-travel-ledger/21-01-SUMMARY.md`
- FOUND: commit `e371bac` (Task 1)
- FOUND: commit `2fcf2b9` (Task 3)

---
*Phase: 21-travel-ledger*
*Completed: 2026-07-05*
