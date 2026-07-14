---
phase: 29-chat-unification
fixed_at: 2026-07-14T13:26:50Z
review_path: .planning/phases/29-chat-unification/29-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-07-14T13:26:50Z
**Source review:** .planning/phases/29-chat-unification/29-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (fix_scope: critical_warning — 5 Info findings out of scope)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: 0032 RPC executable by sessionless `anon` — session-required intent not enforced at grant level

**Files modified:** `supabase/migrations/0033_revoke_anon_definer_rpcs.sql` (new, append-only)
**Commit:** 051b807
**Applied fix:** New migration 0033 revokes EXECUTE from `public, anon` on all four session-required DEFINER RPCs named in the finding: `join_moa_by_poll_code(text)` (0032), `join_moa(text)` (0025), `cast_date_vote_authed(text, text, uuid, date, text)` and `hide_place_as_member(uuid)` (0029). 0016~0032 untouched (append-only §4.3).

**Verification:**
- `supabase db reset` — all migrations 0016→0033 applied with no errors (no 42P17)
- `pg_proc.proacl` for all four functions now shows only `postgres`, `authenticated`, `service_role` — `anon`/`public` removed
- `pnpm supabase:types` regenerated → `packages/api/src/types/database.ts` zero diff (schema-neutral confirmed)

**Pending human/deploy action:** local `main` is ahead of `origin` — pushing 0033 to remote is NOT done here. 0033 will auto-apply on the next `main` push via the Supabase↔GitHub integration.

### WR-02: Gate promise bridge leaks unsettled promise when a second concurrent `requireMember` overwrites the pending resolver

**Files modified:** `apps/web/app/poll/[code]/_components/poll-guest-island.tsx`, `apps/web/app/t/[slug]/_components/guest-surface.tsx`
**Commit:** dac955a
**Applied fix:** In both `requireMember()` implementations, added `gateReject.current?.();` before installing the new resolver refs — settles any previous pending caller so no promise is ever leaked (the rejected first caller follows its normal cancel path: draft restore + error toast). One line per file, matching existing style.

**Verification:**
- `CI=true pnpm --filter web test` — 32 files, 278 tests passed
- `pnpm -r typecheck` — exit 0 (all packages)

## Full-Suite Regression Sweep

`CI=true pnpm -r test` — exit 0:
- packages/core: 192 passed
- packages/api: 111 passed
- apps/web: 278 passed
- apps/ios: 128 passed (no iOS source changes — jest only run as part of the sweep)

---

_Fixed: 2026-07-14T13:26:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
