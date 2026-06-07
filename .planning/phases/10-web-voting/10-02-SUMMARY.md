---
phase: 10-web-voting
plan: 02
subsystem: web
tags: [web, client-island, voting, memberships, rtl, vitest, collab]
requires:
  - "10-01 joinSharedBoard / getAcceptedMemberCount api helpers"
  - "existing castVote / retractVote / getVoteCounts (votes.ts)"
  - "@moajoa/core isPlaceConfirmed (shared 확정 rule)"
provides:
  - "VoteIsland 'use client' component on /b/[slug] (COLLAB-01 join + COLLAB-02 vote/확정)"
  - "page.tsx mounts the island without touching the SSR cache"
affects:
  - "Plan 10-03 (live browser flow gate — needs 0009 applied + supabase:types regen)"
tech-stack:
  added: []
  patterns:
    - "client island session branch via auth.getUser() in useEffect — keeps user state out of the unstable_cache anon fetcher"
    - "idempotent join CTA instead of a membership-probe RPC (non-destructive)"
    - "optimistic ❤️ count with rollback on error; server truth via router.refresh()/getVoteCounts"
key-files:
  created:
    - "apps/web/app/b/[slug]/_components/vote-island.tsx"
    - "apps/web/__tests__/vote-island.test.tsx"
  modified:
    - "apps/web/app/b/[slug]/page.tsx"
decisions:
  - "Membership is modeled as island state flipped after a successful (idempotent) joinSharedBoard, rather than a destructive castVote probe or a not-yet-provided is-member RPC. An already-member join is a server-side no-op that still returns boardId, so offering the Join CTA to any logged-in non-member is safe and correct."
  - "Test seams (initialJoined / initialMyVotes props) let RTL render the member view deterministically without faking the full async session+count hydration; runtime path still detects session via auth.getUser()."
metrics:
  duration: "~6 min"
  tasks: 2
  files: 3
  completed: 2026-06-08
requirements: [COLLAB-01, COLLAB-02]
---

# Phase 10 Plan 02: Web Voting Island on /b/[slug] Summary

Added the web voting surface as a `'use client'` island on the public board page. It branches client-side via `auth.getUser()`: logged-out → "참여해서 투표하기" link to `/login`; logged-in non-member → "이 보드에 참여하기" calling the idempotent `joinSharedBoard(slug)`; logged-in member → per-place ❤️ toggle (`castVote`/`retractVote`) with love counts and a "확정만 보기" filter driven by the shared `isPlaceConfirmed`. The page edit mounts the island between the map and the place list and adds no server-side session read, so the cookies-free `unstable_cache` SSR fetcher (`cache.ts`) is untouched. Fully offline-verified (RTL + tsc + next build); the live login→join→vote flow is the 10-03 morning gate.

## What Was Built

### Task 1 — vote-island component (TDD: RED `feca28e` → GREEN `17c517a`)
- **RED:** `apps/web/__tests__/vote-island.test.tsx` — 7 RTL/vitest cases (logged-out / non-member click→join / member-voted click→retract / member-unvoted click→cast / 확정 true 1-of-2 / 확정 false 1-of-3 / legacy 0-members). Mocks `@/lib/supabase/browser` (`auth.getUser`), `@moajoa/api` (join/count/vote helpers), `next/navigation`, and `@/components`. Committed failing (module unresolved).
- **GREEN:** `apps/web/app/b/[slug]/_components/vote-island.tsx` (`'use client'`, ~220 lines). Props `{ slug, boardId, places, initialJoined?, initialMyVotes? }`. `useEffect` reads `getSupabaseBrowser().auth.getUser()` → sets `userId`/`resolved`; if logged in, hydrates `getAcceptedMemberCount(boardId)` + `getVoteCounts(place_ids)`. Branches as above. Member view: per-place ❤️/🤍 toggle button (`aria-pressed`), love count, `isPlaceConfirmed(love, memberCount)` 확정 badge + "확정만 보기" filter. Optimistic vote with rollback + error toast. Reuses page Tailwind tokens (`text-brand-500`, `hover:border-brand-300`, `hover:bg-brand-50`, `border-neutral-200 rounded-lg`, `text-lg font-semibold text-neutral-900`). No new create/add-link UI. No `.js` imports. No local 확정 rule copy.
- REFACTOR: none needed.

### Task 2 — wire into page.tsx (commit `0c62429`)
- Added `import { VoteIsland } from './_components/vote-island';`.
- Mounted `{view.board.id && <VoteIsland slug={slug} boardId={view.board.id} places={view.places} />}` between the map block and `<PlaceSummaryList>`. The `view.board.id` guard renders nothing for a stale pre-0009 cache.
- No server-side session read added (SSR cache contract preserved).
- Same commit: typed the `@moajoa/api` test mocks (wrapper arrows matching helper arity, defer-access to dodge `vi.mock` hoisting) so `tsc --noEmit` passes (see Deviations).

## Verification

- **vote-island.test.tsx: 7/7 pass.** Full `apps/web` vitest: 55 pass + the 7 vote-island = the only failures are 5 pre-existing `marker-svg.test.ts` assertions, reproduced at base commit `19186a8` before any 10-02 change — out of scope, logged to `deferred-items.md`, not touched.
- **`pnpm --filter web typecheck` (tsc --noEmit): exit 0.**
- **`pnpm --filter web build`: green** — `✓ Compiled successfully`, `/b/[slug]` route built (4.11 kB).
- **Grep assertions pass:** island is `'use client'`, uses `auth.getUser()`, `isPlaceConfirmed` (no `function isPlaceConfirmed` local copy), `castVote|retractVote`, `joinSharedBoard`, both Korean CTAs; no `.js` imports. Page imports + mounts `<VoteIsland>` with `slug={slug}` + `boardId={view.board.id}`.
- **cache.ts untouched:** not present in `git diff --name-only feca28e~1 HEAD`. **isPlaceConfirmed reused:** no local definition in the island.
- **No accidental deletions** across the plan diff.
- **Live browser flow** (login → join → ❤️ → 확정 shows) deferred to Plan 10-03 morning gate (needs 0009 applied + `supabase:types` regen).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Typed the test-file `@moajoa/api` mocks so tsc passes**
- **Found during:** Task 2 (`tsc --noEmit`).
- **Issue:** Zero-arg `vi.fn` mocks gave `mock.calls[0]` an empty-tuple type → `[1]` element access was a TS2493/TS2532 error; naive fixes hit `vi.mock` top-level-hoist (`ReferenceError: Cannot access before initialization`) and spread-arity (TS2556) errors.
- **Fix:** Mock factory uses wrapper arrows with explicit param signatures matching each helper's arity (defers variable access past hoisting, preserves tuple types); call-site assertions use optional chaining `mock.calls[0]?.[1]`.
- **Files modified:** `apps/web/__tests__/vote-island.test.tsx` (committed in `0c62429`).
- **Scope:** entirely within this plan's own new test file.

## Known Stubs

None. The island wires real data: session via `auth.getUser()`, counts via `getAcceptedMemberCount`/`getVoteCounts`, mutations via `castVote`/`retractVote`/`joinSharedBoard`. The `initialJoined`/`initialMyVotes` props are documented test seams, not production stubs — the runtime path detects session and hydrates counts. Live data reflects only after 0009 is applied at the 10-03 gate (a known, documented cross-plan dependency, not a stub).

## Deferred Issues

- 5 pre-existing `apps/web/__tests__/marker-svg.test.ts` failures (marker SVG color/shape drift). Reproduced at base `19186a8`; unrelated to web voting. Logged to `.planning/phases/10-web-voting/deferred-items.md`. Not fixed (SCOPE BOUNDARY).

## Self-Check: PASSED

- FOUND: apps/web/app/b/[slug]/_components/vote-island.tsx
- FOUND: apps/web/__tests__/vote-island.test.tsx
- FOUND (modified): apps/web/app/b/[slug]/page.tsx
- FOUND commit: feca28e (RED test)
- FOUND commit: 17c517a (GREEN component)
- FOUND commit: 0c62429 (page wiring + test mock typing)
