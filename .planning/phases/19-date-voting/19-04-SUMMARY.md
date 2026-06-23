---
phase: 19-date-voting
plan: 04
subsystem: ui
tags: [nextjs, react, supabase-realtime, presence, broadcast, anon-rpc, unstable_cache, vitest]

# Dependency graph
requires:
  - phase: 19-01
    provides: anon-grant SECURITY DEFINER RPCs (cast_date_vote / poll_view_by_code / poll_vote_tally / post_poll_comment / delete_poll_comment) + poll_code bearer + device dedup
  - phase: 19-02
    provides: "@moajoa/api date-polls wrappers (pollByCode/castDateVote/getPollTally/postComment/deleteComment) + @moajoa/core pollChannelName/DateAvailability/PollKeys.DeviceToken/CastDateVote+PostComment schemas"
  - phase: 17
    provides: apps/web public-trip-cache.ts unstable_cache idiom + vote-island.tsx hydration/optimistic-rollback template + toast/Dialog design-system components
provides:
  - "/poll/[code] public anonymous voting page (cookies-free cached SSR shell, static metadata only)"
  - "poll-vote-island: nickname gate + range/grid binary vote modes + optimistic castDateVote + live Doodle tally + Supabase Presence"
  - "poll-chat: flat anon thread (postComment/deleteComment) with realtime broadcast fan-out + own/host delete + closed read-only"
  - "device-token util (SSR-guarded localStorage UUID + nickname store) + poll-cache wrapper"
affects: [phase-20-booking, phase-21-ledger, date-voting-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anon web voting island: ALL mutable state (nickname/votes/tally/presence/chat) hydrates client-side; cookies-free unstable_cache holds ONLY static poll metadata (Pitfall 2 GOTCHA)"
    - "One public Realtime channel poll:{tripId} carries vote broadcasts + presence (island) and comment broadcasts (chat); each component owns a handle on the same topic, removeChannel cleanup"
    - "Anon writes via @moajoa/api RPC wrappers only (castDateVote/postComment/deleteComment) — no direct table writes, no service-role in client bundle"

key-files:
  created:
    - apps/web/lib/device-token.ts
    - apps/web/lib/poll-cache.ts
    - apps/web/app/poll/[code]/page.tsx
    - apps/web/app/poll/[code]/_components/poll-vote-island.tsx
    - apps/web/app/poll/[code]/_components/poll-chat.tsx
    - apps/web/__tests__/poll-vote-island.test.tsx
  modified: []

key-decisions:
  - "Chat is realtime-fan-out only (no comment history fetch): anon has no comment read path (date_comments grants no anon SELECT, no anon comment-list RPC — Plan 01 by design). Thread starts empty, fills from live broadcasts + own optimistic appends."
  - "grid mode = tap-per-cell month calendar (drag-to-paint deferred, RESEARCH Environment fallback); union of all option windows rendered as tappable days."
  - "Test placed in apps/web/__tests__/ (the only path vitest globs) not the co-located path the plan listed."

patterns-established:
  - "Pattern: anon vote island optimistic+rollback mirrors vote-island.tsx onToggleVote (flip selection + tally delta → RPC → broadcast | rollback + error toast)"
  - "Pattern: closed-poll branch swaps the whole voting UI for the 확정 result + conversion CTA (Screen 5); chat stays mounted read-only"

requirements-completed: [POLL-02, POLL-03]

# Metrics
duration: 7min
completed: 2026-06-23
---

# Phase 19 Plan 04: Web Anonymous Voting Island Summary

**`/poll/[code]` no-install anon voting: cookies-free cached SSR shell + a client island with nickname gate, range/grid binary vote modes (optimistic castDateVote + rollback), live Doodle tally, Supabase Presence "지금 N명 보는 중", a realtime chat thread, and the closed-poll 확정 result + 이 여행에 함께하기 conversion CTA.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-23T04:56:32Z
- **Completed:** 2026-06-23T05:03:44Z
- **Tasks:** 3 of 4 code-complete (Task 4 = live cross-browser UAT, PENDING human-verify)
- **Files created:** 6

## Accomplishments

- **Anonymous voting with no account (POLL-02):** an invitee opens `/poll/[code]`, sets a nickname (localStorage device-token UUID), and votes 가능/불가 — range candidate cards or a grid tap-per-cell calendar — entirely via the anon-grant `castDateVote` RPC, optimistic with rollback + error toast.
- **Live social proof (POLL-03 read):** Doodle-style tally (`{N}명 가능` + nickname chips + 최다 leader badge/bar) hydrated client-side via `getPollTally`, reconciled on peer vote broadcasts; Supabase Presence shows "지금 N명 보는 중".
- **Flat anon chat (D-11):** realtime broadcast thread on the shared `poll:{tripId}` channel via `postComment`/`deleteComment`, own/host delete behind a confirm Dialog, read-only when closed.
- **Conversion payoff (Screen 5):** closed poll swaps the voting UI for the 확정 result + 이 여행에 함께하기 magic-link CTA.
- **Cache safety (Pitfall 2):** the cookies-free `unstable_cache` shell holds ONLY static poll metadata; no tally/vote/presence/chat fetch on the server.

## Task Commits

Committed in dependency order (each commit builds cleanly) — labels map to plan tasks:

1. **Task 1 (utils): device-token + poll-cache** - `3c48a98` (feat)
2. **Task 3: poll-chat** - `14219c0` (feat)
3. **Task 2: poll-vote-island + test** - `e3edc38` (feat)
4. **Task 1 (shell): /poll/[code] page** - `76e3ed3` (feat)

**Task 4 (cross-browser UAT):** PENDING — see "Pending: Live Browser UAT" below.

## Files Created/Modified

- `apps/web/lib/device-token.ts` - SSR-guarded `getDeviceToken` (localStorage UUID via `PollKeys.DeviceToken`) + nickname store helpers.
- `apps/web/lib/poll-cache.ts` - `getCachedPoll` via `unstable_cache` (anon `createClient<Database>` inside the callback), caches ONLY static metadata; `POLL_REVALIDATE_TAG`.
- `apps/web/app/poll/[code]/page.tsx` - cookies-free SSR shell + `generateMetadata` (noindex bearer page); mounts `<PollVoteIsland>` with cached static props; not-found shell for bad codes.
- `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` - `'use client'` island: nickname gate, two binary vote modes, optimistic `castDateVote` + rollback, live tally hydrate, Presence, vote broadcast, closed-state 확정 + CTA.
- `apps/web/app/poll/[code]/_components/poll-chat.tsx` - `'use client'` flat thread: `postComment`/`deleteComment`, broadcast fan-out, delete-confirm Dialog, closed read-only.
- `apps/web/__tests__/poll-vote-island.test.tsx` - nickname-gate block, optimistic-rollback, closed-CTA (3 cases).

## Automated Verification (DONE)

- **Web test suite:** 11 suites / **65 tests GREEN** (was 62 → +3 new island cases). `pnpm --filter @moajoa/web test:run` exit 0.
- **Typecheck:** `pnpm --filter @moajoa/web typecheck` exit 0.
- **Production build:** `pnpm --filter @moajoa/web build` exit 0; route table shows `ƒ /poll/[code]` (dynamic — correct for cookies-free cached SSR).
- **Grep / required-string gates (all PASS):**
  - device-token.ts: `getDeviceToken` export 1, SSR guard present.
  - poll-cache.ts: `unstable_cache` present, `createClient<Database>` 1 (anon client inside callback).
  - page.tsx: `getCachedPoll` present, **`getPollTally` 0 (no tally fetch in the shell)**, `<PollVoteIsland` mounted.
  - poll-vote-island.tsx: `castDateVote` present, `닉네임을 입력해야 투표할 수 있어요` present, `pollChannelName` + `.track(` + `removeChannel` present, `getPollTally` in a useEffect (not a prop), `이 여행에 함께하기` 1, `지금` presence present.
  - poll-chat.tsx: `postComment`/`deleteComment` present, `첫 메시지를 남겨보세요` 1, `이 메시지를 삭제할까요` 1, `메시지를 보내지 못했어요` 1, `status === 'open'` compose conditional 1, `removeChannel` 1.

## Decisions Made

- **Chat = realtime-fan-out only (no history fetch).** While reading the surfaces I confirmed anon visitors have **no read path** for prior comments: `date_comments_read` is `to authenticated` only and there is no anon comment-list RPC (Plan 01, by design). So the thread starts empty and fills from live `comment` broadcasts + the author's own optimistic appends. This matches UI-SPEC Screen 4d ("Realtime append") and the plan's acceptance (no comment-history fetch required). Adding an anon comment-read RPC would be a new append-only migration = architectural (Rule 4) — out of scope and not requested.
- **grid mode = tap-per-cell calendar** (drag-to-paint explicitly optional per RESEARCH/plan); renders the union of all option date windows as tappable day cells.
- **Test location:** `apps/web/__tests__/poll-vote-island.test.tsx` — vitest's `include` globs only `__tests__/**`, so the plan's co-located path would never run (same convention as the existing `vote-island.test.tsx`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test placed in `__tests__/` instead of the co-located plan path**
- **Found during:** Task 2 (poll-vote-island test)
- **Issue:** The plan's `files_modified` lists `apps/web/app/poll/[code]/_components/poll-vote-island.test.tsx`, but `vitest.config.ts` `include` is `__tests__/**/*.test.tsx` only — a co-located test would never be collected, so the test gate could not run.
- **Fix:** Created the test at `apps/web/__tests__/poll-vote-island.test.tsx` (the path vitest actually globs; matches the existing `vote-island.test.tsx`).
- **Files modified:** apps/web/__tests__/poll-vote-island.test.tsx
- **Verification:** `pnpm --filter @moajoa/web test:run` collects + passes it (65/65).
- **Committed in:** e3edc38 (Task 2 commit)

**2. [Rule 1 - Bug] Closed-state test selector matched multiple nodes**
- **Found during:** Task 2 (test authoring)
- **Issue:** `getByText(/확정/)` matched both the heading and surrounding copy → multiple-match error.
- **Fix:** Switched to `getByRole('heading', { name: /확정/ })`.
- **Files modified:** apps/web/__tests__/poll-vote-island.test.tsx
- **Verification:** test green.
- **Committed in:** e3edc38 (Task 2 commit)

**3. [Rule 1 - Bug] Unused `rangeCountByOption` memo (typecheck TS6133)**
- **Found during:** Task 2 (typecheck)
- **Issue:** Left an unused `useMemo` (count-by-option) after consolidating the optimistic delta into `applyTallyDelta`.
- **Fix:** Removed the dead memo (`useMemo` still used by `GridCalendar`).
- **Files modified:** apps/web/app/poll/[code]/_components/poll-vote-island.tsx
- **Verification:** typecheck exit 0.
- **Committed in:** e3edc38 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bug, 1 blocking).
**Impact on plan:** All necessary for the test gate to run + typecheck/build to pass. No scope creep — feature surface matches the plan exactly.

## Issues Encountered

- **No anon comment-read path** (see Decisions). Resolved by building the chat as a live-only thread, which is exactly the available surface; documented rather than worked around with a new RPC.

## Pending: Live Browser UAT (Task 4 — checkpoint:human-verify, BLOCKING)

This plan is `autonomous: false` because it ends in a cross-client Realtime UAT that the executor cannot perform (needs running Supabase + ≥2 live browsers). **Automated portion = DONE** (code + 3 tests + typecheck + build all green). The live verification is PENDING user action:

1. Host (Plan 03 / psql) has a dateless trip + open poll with a `poll_code`.
2. Open `/poll/{code}` in two browsers (one incognito = no shared localStorage); each sets a different nickname (gate blocks voting until set).
3. Vote (range toggles or grid cells): my toggle reflects my state; the **other** browser's tally + nickname chips update live; **최다** tracks the leader; **"지금 2명 보는 중"** presence shows in both.
4. Post chat messages in each browser → they append live in the other; own bubbles right-brand, others left-neutral; delete own behind the **"이 메시지를 삭제할까요?"** confirm.
5. Host confirms a date (Plan 03) → `/poll/{code}` flips to **확정: {range}** + **이 여행에 함께하기** CTA; voting gone; chat read-only.
6. Closed-poll abuse sanity: a vote/comment attempt is rejected by the server gate (Plan 01).

**Resume signal:** "approved" or describe issues.

## Threat Surface Notes

No new threat surface beyond the plan's `<threat_model>`. The island sends only the bearer `code` + device token + nickname + vote payload through `@moajoa/api` RPC wrappers (T-19-05 / T-19-01); the Realtime channel is the public `poll:{tripId}` topic (T-19-05b, never `private:true`); the cached shell holds only static metadata (T-19-10). No service-role key, no direct table writes, no new endpoints.

## Next Phase Readiness

- Web anon voting surface complete (code + tests + build). Phase 19 verify can route the live cross-browser UAT (this plan) alongside the iOS device UAT (19-03).
- The conversion CTA links to `/login` (magic-link signup); the post-signup authed handoff is out of this island's scope (D-03).

## Self-Check: PASSED

- All 6 created files verified on disk.
- All 4 task commits verified in git log (3c48a98, 14219c0, e3edc38, 76e3ed3).

---
*Phase: 19-date-voting*
*Completed: 2026-06-23*
