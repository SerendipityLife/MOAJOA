---
phase: 10-web-voting
plan: 01
subsystem: backend
tags: [supabase, migration, rls, security-definer, voting, memberships, api]
requires:
  - "0001 boards/memberships tables, can_vote_board, vote_counts_for_places, ensure_share_slug"
  - "0008 public_board_view (verbatim base for re-issue)"
provides:
  - "join_shared_board(slug) RPC — slug self-join as 'voter' (COLLAB-01)"
  - "accepted_member_count(board_id) RPC — 확정 denominator, anon+auth (COLLAB-02)"
  - "public_board_view re-issue — resolves 'shared' slugs + exposes board.id"
  - "joinSharedBoard / getAcceptedMemberCount typed api helpers"
affects:
  - "Plan 10-02 (web island consumes the helpers)"
  - "Plan 10-03 (db push + supabase:types regen — morning gate)"
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER for rights-granting writes (join_shared_board) — not a broad RLS insert policy"
    - "anon+authenticated grant on read-count RPC, mirroring vote_counts_for_places"
key-files:
  created:
    - "supabase/migrations/0009_join_shared_board.sql"
    - "packages/api/src/queries/memberships.ts"
  modified:
    - "packages/api/src/queries/index.ts"
decisions:
  - "join_shared_board runs SECURITY DEFINER (bypasses RLS) rather than adding an 'anyone can insert membership' RLS policy — narrower, easier to reason about; safety rails (role literal, auth.uid(), visibility filter) live in the function body."
  - "public_board_view broadened to visibility in ('public','shared') — bearer-invite model; exposes shared title/pins to slug-holders. Flagged for human sanity-check at 10-03 db-push gate."
metrics:
  duration: "~1.5 min"
  tasks: 2
  files: 3
  completed: 2026-06-07
requirements: [COLLAB-01, COLLAB-02]
---

# Phase 10 Plan 01: Voting Backend (slug self-join + 확정 denominator) Summary

Added the Phase 10 web-voting backend: append-only migration `0009_join_shared_board.sql` with two SECURITY DEFINER RPCs (`join_shared_board`, `accepted_member_count`) plus a verbatim `public_board_view` re-issue that broadens slug resolution to `shared` boards, and the typed `memberships.ts` api helpers that call them. Fully offline-verified (grep + `tsc`); migration NOT applied (deferred to the 10-03 morning gate).

## What Was Built

### Task 1 — Migration 0009 (commit `c6c9df7`)
NEW append-only file `supabase/migrations/0009_join_shared_board.sql`, three `create or replace` blocks:

1. **`join_shared_board(p_share_slug text) returns uuid`** — `plpgsql security definer set search_path = public`, granted to `authenticated`. Resolves slug only for `visibility in ('shared','public')`, raises if not found, then `insert into memberships (board_id, user_id, role, accepted_at) values (v_board_id, auth.uid(), 'voter', now()) on conflict (board_id, user_id) do nothing`. Role is a hard-coded literal (no escalation), `user_id = auth.uid()` (join as self only), idempotent. Not `stable` (it writes).
2. **`accepted_member_count(p_board_id uuid) returns bigint`** — `sql stable security definer set search_path = public`, granted to `authenticated, anon`. `select count(*) from memberships where board_id = p_board_id and accepted_at is not null`.
3. **`public_board_view(p_slug text)` re-issue** — copied VERBATIM from 0008 (explicit jsonb field list), with exactly two changes: `board.id` retained, and WHERE broadened from `visibility = 'public'` to `visibility in ('public','shared')`. Phase 8 `summary_ko` on both links and places preserved. Re-granted to `authenticated, anon`.

File header documents the bearer-invite threat model, append-only rule, and the visibility-broadening privacy implication.

### Task 2 — memberships.ts api helpers + barrel (commit `245fc7c`)
NEW `packages/api/src/queries/memberships.ts` mirroring `votes.ts` (import `MoajoaSupabaseClient` from `../client`, `client.rpc(...)`, `if (error) throw error`, cast):
- `joinSharedBoard(client, shareSlug): Promise<string>` → `client.rpc('join_shared_board', { p_share_slug })`, returns `data as string`.
- `getAcceptedMemberCount(client, boardId): Promise<number>` → `client.rpc('accepted_member_count', { p_board_id })`, `(data as number | null) ?? 0`.

Barrel `index.ts` gains `export * from './memberships';`. No `.js` import extensions (CLAUDE.md §4.5). Casts carry the loosely-typed RPC names until the `supabase:types` regen in 10-03 — same approach votes.ts already uses.

## Verification

- **public_board_view re-issue confirmed:** kept `'id', v_board.id`; kept `summary_ko` on both links + places (proves the Phase 8 fields were preserved, no regression); only the WHERE visibility clause changed.
- **Migration NOT applied:** no `supabase db push`, no `supabase:types` run — deferred to the 10-03 morning gate per autonomous-mode instructions.
- **0001–0008 unchanged:** `git diff --name-only c6c9df7~1 HEAD` lists only the three intended files; grep for `000[1-8]_` in the diff returns nothing.
- **Grep assertions:** all Task 1 and Task 2 assertions pass (`join_shared_board`, `'voter'`, `on conflict ... do nothing`, `security definer`, `accepted_member_count`, `accepted_at is not null`, `to authenticated, anon`, `public_board_view`, `visibility in ('public','shared')`, `'id', v_board.id`, helper signatures, `?? 0`, no `.js` imports, barrel line).
- **`pnpm --filter @moajoa/api typecheck` (tsc --noEmit):** exits 0, clean.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The `as string` / `as number` casts in memberships.ts are not stubs — they mirror the existing votes.ts pattern and resolve to precise types when `supabase:types` regenerates the RPC signatures at the 10-03 gate (documented in the plan as acceptable).

## Self-Check: PASSED

- FOUND: supabase/migrations/0009_join_shared_board.sql
- FOUND: packages/api/src/queries/memberships.ts
- FOUND (modified): packages/api/src/queries/index.ts
- FOUND commit: c6c9df7 (migration 0009)
- FOUND commit: 245fc7c (memberships api helpers)
