---
phase: 26-realtime-chat
plan: 01
subsystem: database
tags: [supabase, realtime, postgres_changes, rls, trigger, publication, typed-query, vitest, tdd]

# Dependency graph
requires:
  - phase: 23-web-share
    provides: "trip_messages table + 3 RLS policies (0025), TripMessage/TripMessageCreate schemas (chat.ts, 23-05), moaChannelName (23-05)"
  - phase: 24-host-flow
    provides: "0026 realtime publication (places/links), moa-island single-channel realtime hub, votes.ts/places.ts direct-table query idiom"
provides:
  - "0028 migration: trip_messages added to supabase_realtime publication (postgres_changes now deliver INSERT events)"
  - "0028 migration: trip_messages_default_user_id BEFORE-INSERT trigger (fills user_id := auth.uid() when null)"
  - "listTripMessages(client, tripId): moa history oldest→newest, direct-table select"
  - "sendTripMessage(client, input): direct-table insert WITHOUT user_id (trigger pins it), returns row"
  - "chat.ts barrel-exported from @moajoa/api"
affects: [26-02, 26-03, 26-04, phase-25-guest-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Authenticated direct-table query idiom (votes.ts) for member chat — NOT the anon SECURITY-DEFINER RPC (date-polls postComment)"
    - "BEFORE-INSERT user_id default trigger mirrors votes_default_user_id (0016) — RLS with-check validates, trigger populates"

key-files:
  created:
    - supabase/migrations/0028_chat_realtime_publication.sql
    - packages/api/src/queries/chat.ts
    - packages/api/src/queries/chat.test.ts
  modified:
    - packages/api/src/queries/index.ts

key-decisions:
  - "sendTripMessage insert object OMITS user_id — the 0028 trigger fills auth.uid(); client-supplied user_id would be redundant and (if mismatched) rejected by the 0025 with-check RLS"
  - "Direct-table idiom (from('trip_messages').insert/select), not RPC — moa chat is authenticated members with direct-table RLS grants, unlike anon poll comments"
  - "No replica identity full and no pnpm supabase:types regen — INSERT-only chat works under default replica identity; publication membership + trigger do not change generated types (trip_messages already in database.ts since 0025)"

patterns-established:
  - "0028 append-only migration mirrors 0026 header idiom (decision + 무음 no-op rationale)"
  - "TDD RED via stub whose functions do not touch the client → assertions fail for the right reason (from/insert never called), not import errors"

requirements-completed: [CHAT-01]

# Metrics
duration: 4min
completed: 2026-07-10
---

# Phase 26 Plan 01: Realtime Chat Backend Foundation Summary

**0028 migration closes two invisible-in-code runtime gaps (trip_messages publication add + user_id auth.uid() default trigger) and adds the authenticated direct-table `listTripMessages`/`sendTripMessage` typed queries the chat island will call.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-09T16:49:42Z
- **Completed:** 2026-07-09T16:54:00Z
- **Tasks:** 2 (Task 1 auto, Task 2 TDD)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- **0028 publication add** — `trip_messages` now a member of `supabase_realtime`, so the island's postgres_changes INSERT subscription will deliver events instead of the SUBSCRIBED-but-0-events silent no-op (D-07 / Phase 24 D-14 / Pitfall 2).
- **0028 user_id default trigger** — `trip_messages_default_user_id()` BEFORE-INSERT sets `new.user_id := auth.uid()` when null (SECURITY DEFINER, `search_path=public`), mirroring `votes_default_user_id` (0016). Without it, `sendTripMessage` (which omits user_id) would hit the `not null` constraint.
- **Verified locally** — `supabase db reset` applied 0016→0028 clean (42P17=0); `pg_publication_tables` row for `trip_messages`=1, `trip_messages_user_id_default` trigger=1, function=1.
- **chat.ts typed queries** — `listTripMessages` (asc created_at) + `sendTripMessage` (insert without user_id) built via TDD, barrel-exported; chat.test 6/6 green, full api suite 97 green, tsc exit 0.

## Task Commits

1. **Task 1: Migration 0028 — publication add + user_id default trigger** - `ff6e8b9` (feat)
2. **Task 2 (RED): failing test for chat queries** - `a453cea` (test)
3. **Task 2 (GREEN): implement chat queries + barrel** - `2fd2006` (feat)

_Task 2 followed RED → GREEN; no REFACTOR commit (implementation already minimal)._

## Files Created/Modified
- `supabase/migrations/0028_chat_realtime_publication.sql` - publication add for trip_messages + user_id default trigger/function
- `packages/api/src/queries/chat.ts` - `listTripMessages` + `sendTripMessage` (direct-table, votes idiom)
- `packages/api/src/queries/chat.test.ts` - 6 unit tests: asc order, insert-without-user_id, reply_to_place_id mapping, error throws
- `packages/api/src/queries/index.ts` - added `export * from './chat';` (no `.js` extension)

## Decisions Made
None beyond the plan — decisions above are the plan's locked choices (D-06/D-07/D-08/D-09) applied as written.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED:** `a453cea` `test(26-01)` — 5/6 assertions failed for the right reason (client `from`/`insert` never called, promise did not reject); the 1 passing case was the null→`[]` path against the stub. No import/syntax failure.
- **GREEN:** `2fd2006` `feat(26-01)` — 6/6 pass, tsc exit 0.
- **REFACTOR:** none (implementation minimal).
- Gate sequence `test(...)` → `feat(...)` present and ordered. Compliant.

## Issues Encountered
None. Local Supabase stack (colima + docker) was already running, so the Task 1 automated verification ran fully rather than being deferred.

## Deploy Note (flag, not a blocker)
0028 takes effect in Preview/prod only after it reaches `main` — the repo's Supabase↔GitHub integration auto-applies migrations on push to `main` (confirmed in STATE, 2026-07-10 session). No manual `supabase db push` step added. `pnpm supabase:types` regen is NOT required (publication membership + trigger do not change generated types).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation for CHAT-01 complete and locally verified. Wave 1 sibling 26-02 (moa-chat / moa-tab-bar presentational) and Wave 2 26-03 (island wiring: 3rd postgres_changes binding before `.subscribe()`, presence, page seed) can now consume `listTripMessages`/`sendTripMessage`.
- Live realtime delivery + send-succeeds are provable only after 0028 reaches `main` (auto-apply) — this is the one out-of-code gate for CHAT-01 live behavior.

## Self-Check: PASSED

- All 4 key files present on disk (0028 migration, chat.ts, chat.test.ts, SUMMARY.md).
- All 3 task commits present in git log (ff6e8b9, a453cea, 2fd2006).
- Plan verification re-run green: api suite 97 pass, tsc exit 0, no edits to 0016-0027 or packages/core, no `.js` extensions, no user_id in the insert object (only doc comments).

---
*Phase: 26-realtime-chat*
*Completed: 2026-07-10*
