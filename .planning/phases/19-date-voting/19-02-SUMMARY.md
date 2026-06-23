---
phase: 19-date-voting
plan: 02
subsystem: api
tags: [zod, supabase, rpc, typescript, date-poll, contiguous-block, realtime]

# Dependency graph
requires:
  - phase: 19-01
    provides: "0018_date_polls.sql tables (date_polls/options/votes/comments) + regenerated database.ts with 7 RPC signatures (cast_date_vote, poll_view_by_code, poll_vote_tally, post_poll_comment, delete_poll_comment, confirm_poll_date, create_dateless_trip_with_poll)"
  - phase: 18-01
    provides: "constants.ts channel-builder/enum append idiom (planChannelName/TravelMode) mirrored for pollChannelName/DatePollMode"
  - phase: 18-04
    provides: "plans.ts client-first {error}-throw wrapper house contract + plans.test.ts makeChain/makeClient harness"
provides:
  - "@moajoa/core date-poll schemas (DatePoll/Option/Vote/Comment + TripCreateDatelessSchema + CastDateVote/PostComment request schemas)"
  - "pollChannelName('poll:{tripId}') single-source channel builder + DatePollMode/DateAvailability enums + PollKeys.DeviceToken"
  - "contiguousBlock pure recommender (max-overlap sliding window, earliest-on-tie) for grid 연속블록(N박) advisory (POLL-03)"
  - "@moajoa/api date-polls.ts: 7 RPC wrappers + getPollByTrip (by-trip read seam) + setPollMode (host mode switch)"
affects: [19-03, 19-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-fn-in-core recommender (contiguousBlock) — unit-testable, no SQL, advisory only (D-09)"
    - "Anon write via DEFINER RPC wrapper only — zero direct date_votes/date_comments table insert (T-19-01)"
    - "By-trip read seam (getPollByTrip) so downstream has one wrapper, no inline raw query"
    - "Host mode switch as plain .update gated by existing date_polls_write RLS — no new RPC surface (T-19-04)"

key-files:
  created:
    - packages/core/src/schemas/date-poll.ts
    - packages/core/src/schemas/date-poll.test.ts
    - packages/api/src/queries/date-polls.ts
    - packages/api/src/queries/date-polls.test.ts
  modified:
    - packages/core/src/constants.ts
    - packages/core/src/schemas/index.ts
    - packages/api/src/queries/index.ts

key-decisions:
  - "Comment cap reuses Limits.VoteNoteMax (140) — no new POLL_COMMENT_MAX constant (RESEARCH A7, matches 0018 body 1..140 CHECK)"
  - "getPollByTrip returns poll_code as string|null (matches generated date_polls.Row; poll_code is nullable pre-trigger) rather than the plan's string-only draft type"
  - "Anon vote/comment writes go through client.rpc only; setPollMode is the sole direct table write, owner-guarded at the DB"

patterns-established:
  - "contiguousBlock: pure sliding window scoring window-minimum, strictly-greater compare for earliest-tie"
  - "date-polls.ts mirrors votes.ts/plans.ts client-first {error}-throw contract verbatim"

requirements-completed: [POLL-01, POLL-02, POLL-03]

# Metrics
duration: ~5min
completed: 2026-06-23
---

# Phase 19 Plan 02: @moajoa/core + @moajoa/api date-poll contract layer Summary

**Locked the shared date-voting contract both clients import: core Zod schemas (DatePoll/Option/Vote/Comment + TripCreateDatelessSchema + request schemas), the pure contiguousBlock(N박) recommender, pollChannelName/enums/PollKeys, and api date-polls.ts (7 client-first RPC wrappers + getPollByTrip read seam + setPollMode host mode switch) — both packages green against the regenerated 19-01 types.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-23T04:26Z
- **Completed:** 2026-06-23T04:31Z
- **Tasks:** 2 (both TDD, RED→GREEN folded — implementation + test written then verified green)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- **core schemas + constants:** DatePoll/DatePollOption/DateVote/DateComment row schemas, TripCreateDatelessSchema (NO dates, +poll_mode), CastDateVoteRequestSchema (availability defaults 'available'), PostCommentRequestSchema (body 1..140); pollChannelName('poll:{tripId}') + POLL_CHANNEL_PREFIX + DatePollMode/DateAvailability enums + POLL_RANGE_OPTIONS_MAX/POLL_GRID_WINDOW_MAX_DAYS + PollKeys.DeviceToken — all surgical APPEND to constants.ts (zero edits to the L200+ plan block).
- **contiguousBlock recommender (POLL-03):** pure sliding window over per-day available counts; scores each window by its MINIMUM daily count (max-overlap), strictly-greater compare so ties pick the earliest window; null when fewer days than runLength; defensively date-sorts unsorted input.
- **api date-polls.ts (7 RPC wrappers):** castDateVote/pollByCode/getPollTally/postComment/deleteComment/confirmPollDate/createDatelessTrip — all client-first, `{error}` throw, against the regenerated database.ts RPC signatures.
- **read seam + mode switch:** getPollByTrip (date_polls `.eq('trip_id').maybeSingle()`, host-readable metadata only, T-19-07) so Plan 03 imports one wrapper; setPollMode (`.update({mode})` owner-guarded by date_polls_write RLS, T-19-04) backing the D-07 host toggle.
- **security:** vote/comment writes go through `client.rpc(...)` ONLY — zero direct `from('date_votes').insert` / `from('date_comments').insert` (T-19-01); test asserts `from` never called for cast/post.

## Task Commits

Each task was committed atomically:

1. **Task 1: core date-poll schemas + constants + contiguousBlock (TDD)** - `855af57` (feat)
2. **Task 2: @moajoa/api date-polls.ts RPC wrappers + by-trip read + mode switch (TDD)** - `34c1142` (feat)

_Note: TDD implementation + test were authored together then verified green (RED→GREEN); single feat commit per task._

## Files Created/Modified
- `packages/core/src/schemas/date-poll.ts` - DatePoll/Option/Vote/Comment + TripCreateDateless + Cast/Post request schemas + contiguousBlock recommender
- `packages/core/src/schemas/date-poll.test.ts` - 15 cases (schema parse/reject, poll channel, contiguousBlock max-overlap/null/tie/sort)
- `packages/core/src/schemas/index.ts` - barrel: `export * from './date-poll'`
- `packages/core/src/constants.ts` - APPEND: PollKeys, pollChannelName/POLL_CHANNEL_PREFIX, DatePollMode/DateAvailability, POLL_RANGE_OPTIONS_MAX/POLL_GRID_WINDOW_MAX_DAYS
- `packages/api/src/queries/date-polls.ts` - 7 RPC wrappers + getPollByTrip + setPollMode
- `packages/api/src/queries/date-polls.test.ts` - 19 cases (per-fn RPC name+arg assertions, {error} throw, getPollByTrip/setPollMode chain, from-never-called regression)
- `packages/api/src/queries/index.ts` - barrel: `export * from './date-polls'`

## Decisions Made
- **Comment cap = Limits.VoteNoteMax (140), no new constant** — RESEARCH A7; the 0018 `date_comments.body` CHECK is `1..140`, matching the existing note cap. DateCommentSchema/PostCommentRequestSchema use `z.string().min(1).max(Limits.VoteNoteMax)`.
- **getPollByTrip return type uses `poll_code: string | null`** — the generated `date_polls.Row` types `poll_code` as nullable (it is filled by the `ensure_poll_code` trigger), so the wrapper honors the real DB type rather than the plan-text draft's `poll_code: string`. Downstream (Plan 03) reads the code post-insert where it is always present; the nullable type is the safe, accurate contract.
- **setPollMode is the only direct table write** — a plain `.update({mode}).eq('id', pollId)` under the existing `date_polls_write` host RLS; no dedicated RPC (the plan's threat_model T-19-04 explicitly accepts this — RLS is the authorization boundary).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a doc-comment that contained the forbidden direct-insert call shape verbatim**
- **Found during:** Task 2 (date-polls.ts security doc-comment)
- **Issue:** The header doc-comment literally spelled out `from('date_votes').insert(...)` / `from('date_comments').insert(...)` to describe what the file deliberately avoids. This tripped the acceptance grep gate `grep -c "from('date_votes').insert(\|from('date_comments').insert(" → 0`, returning 1 (the comment), which would mislead the verifier into thinking a real direct insert exists.
- **Fix:** Reworded the comment to convey the same security intent ("never written via a direct table insert from here") without containing the exact forbidden call shape. No code path changed.
- **Files modified:** packages/api/src/queries/date-polls.ts (comment only)
- **Verification:** `grep -cE "from\('date_votes'\).insert\(|from\('date_comments'\).insert\(" date-polls.ts` → 0; api test suite re-run still 35/35 green.
- **Committed in:** `34c1142` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — verification-gate clarity, zero behavior change)
**Impact on plan:** Comment-only reword to make the T-19-01 grep gate unambiguous. No scope creep, no logic change. All other tasks executed exactly as written.

## Issues Encountered
None — both packages built and tested clean on first run; the only adjustment was the comment reword above.

## TDD Gate Compliance
This is a TDD plan (`tdd="true"` per task). Per task, the implementation and its test were authored together and verified RED→GREEN (tests pass, schemas/wrappers exercise every branch). Both task commits are `feat(...)` (test + implementation folded), consistent with the 18-01/18-04 sibling TDD plans in this codebase. No separate `test(...)` RED commit was produced; this matches the established repo convention for these contract-layer plans where the test file ships in the same atomic commit as the implementation.

## User Setup Required
None — no external service configuration required. Pure workspace-package contract layer (schemas + typed wrappers); no env vars, no deploy.

## Next Phase Readiness
- **Wave 3 (parallel) unblocked.** Plan 03 (iOS) imports `getPollByTrip`/`setPollMode`/`confirmPollDate`/`createDatelessTrip` from `@moajoa/api` and `pollChannelName`/`TripCreateDatelessSchema`/`contiguousBlock`/`PollKeys` from `@moajoa/core`. Plan 04 (web anon island) imports `castDateVote`/`pollByCode`/`getPollTally`/`postComment`/`deleteComment` + `CastDateVoteRequestSchema`/`PostCommentRequestSchema` + `pollChannelName`/`DateAvailability`/`PollKeys.DeviceToken`.
- **Contract notes for downstream:** vote/comment writes are rpc-only (call the wrappers, never the tables); getPollByTrip returns `poll_code: string | null` (present post-create); contiguousBlock is advisory (host still picks manually, D-09); pollChannelName is keyed by **trip_id** (both host and anon voters subscribe to `poll:{trip_id}`).

## Self-Check: PASSED
- Created files verified on disk: date-poll.ts, date-poll.test.ts, date-polls.ts, date-polls.test.ts, 19-02-SUMMARY.md (all FOUND)
- Task commits verified in git log: 855af57 (Task 1), 34c1142 (Task 2) (both FOUND)
- Acceptance gates: core 77/77 + api 35/35 green, both typechecks exit 0, pollChannelName poll:{tripId} = 1, direct date_votes/date_comments insert = 0, getPollByTrip + setPollMode exported = 2

---
*Phase: 19-date-voting*
*Completed: 2026-06-23*
