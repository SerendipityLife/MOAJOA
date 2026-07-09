---
phase: 26-realtime-chat
plan: 03
subsystem: ui
tags: [supabase, realtime, postgres_changes, presence, react, nextjs, chat, tabs]

# Dependency graph
requires:
  - phase: 26-realtime-chat
    provides: "26-01 listTripMessages/sendTripMessage typed queries + 0028 publication/trigger; 26-02 MoaChat/MoaTabBar presentational contracts"
  - phase: 24-host-flow
    provides: "moa-island single-channel realtime hub (places INSERT + links UPDATE), page.tsx RSC seed idiom"
  - phase: 19-poll
    provides: "poll-vote-island presence pattern (config.presence.key + sync + track on SUBSCRIBED)"
provides:
  - "moa-island wired for live chat: 3rd postgres_changes binding (trip_messages INSERT) + presence sync + track, all before .subscribe() on the ONE moa:{tripId} channel"
  - "message append/dedup-by-id (no reconcile — trusts WALRUS+RLS on append-only INSERT)"
  - "handleSend: TripMessageCreateSchema.parse at UI boundary → sendTripMessage → optimistic append + clear reply"
  - "client-state 모으기/채팅 tab switch — island mounts once, channel never torn down (D-02)"
  - "page.tsx seeds initialMessages via listTripMessages + self display_name in nameIds (survives refresh)"
affects: [26-04, phase-25-guest-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postgres_changes message binding lives in island's pre-subscribe chain (RESEARCH Q3) — append payload.new deduped by id, NOT refetch-reconcile (places/links path unchanged)"
    - "Channel created on its own line (poll-vote-island idiom) so the SUBSCRIBED/presence callbacks reference `channel` safely — avoids TDZ under a synchronous subscribe stub"
    - "hidden-toggle tab views (contents/hidden) keep the map instance + realtime channel mounted across tab switches (D-02)"

key-files:
  created:
    - .planning/phases/26-realtime-chat/26-03-SUMMARY.md
  modified:
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/app/moa/[id]/page.tsx
    - apps/web/__tests__/moa-island.test.tsx

key-decisions:
  - "Split channel creation onto its own line instead of the plan's single chained const — the SUBSCRIBED track callback references `channel`, which is in the temporal-dead-zone during a single chained assignment when the test stub invokes the subscribe callback synchronously (mirrors the mandated poll-vote-island analog exactly)"
  - "Chat view uses a fixed inset-0 container with pb-[64px] to reserve space for the fixed tab bar; 모으기 view wrapped in a `contents` div so its fixed-inset-0 child layout is preserved when visible and display:none-hidden when not"

patterns-established:
  - "Live-message binding co-located with places/links in the single [trip.id] effect — one channel, one effect, all bindings pre-subscribe"
  - "Test channel stub upgraded to invoke subscribe callback synchronously with 'SUBSCRIBED' to assert the track({user_id, nickname}) path"

requirements-completed: [CHAT-01, CHAT-02]

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 26 Plan 03: Live Chat + Presence Island Wiring Summary

**Wired the trip_messages INSERT postgres_changes binding + presence track/sync into the existing single moa:{tripId} channel (all before .subscribe()), with message append/dedup, a Zod-validated send path, a client-state 모으기/채팅 tab switch that never remounts the island, and a server-seeded history that survives refresh.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-09T17:04:00Z
- **Completed:** 2026-07-09T17:16:10Z
- **Tasks:** 3
- **Files modified:** 3 (2 source + 1 test; 1 summary created)

## Accomplishments
- **Single-channel extension (RESEARCH Q3)** — the existing `moa:{tripId}` channel now carries a THIRD `postgres_changes` binding (`trip_messages` INSERT) plus a `presence` sync binding and a `.track({user_id, nickname, online_at})` in the SUBSCRIBED callback — all registered BEFORE `.subscribe()` on the ONE channel in the ONE `[trip.id]` effect. Places/links reconcile logic untouched.
- **Append, not reconcile** — `appendMessage` does a functional-update dedup by `id` (trusts WALRUS+RLS on append-only INSERT; the sender also dedups its own echo). Avoids the per-message query storm a refetch would cause (T-26-08).
- **Send path (T-26-06)** — `handleSend` validates at the UI boundary with `TripMessageCreateSchema.parse` (body 1–140, §4.5), calls `sendTripMessage`, optimistically appends the returned row, clears the reply target; errors propagate so `MoaChat` restores the draft.
- **Presence (CHAT-02)** — `config.presence.key = currentUserId` → `setViewers(Object.keys(channel.presenceState()).length)` on sync; distinct users, not tabs.
- **Client-state tabs (D-02)** — `모으기` view wrapped in a `contents`/`hidden` toggle (map instance + channel preserved), `채팅` view renders `<MoaChat>`, `<MoaTabBar>` fixed at the bottom. No route split → island mounts once.
- **History seed (CHAT-01)** — `page.tsx` adds `listTripMessages` to the RSC `Promise.all` and `user.id` to `nameIds` (Pitfall 8) so the island has the sender's own `display_name` for send + presence; passes `initialMessages` + `currentUserNickname`. Refresh re-seeds → history persists.
- **Tests** — moa-island suite extended from 9 → 13 green (channel stub upgraded for options/track/presence/synchronous SUBSCRIBED; 3-binding + presence + track assertions; append/dedup, presence count, tab-switch-keeps-channel, send). Full web suite 133 green, tsc exit 0.

## Task Commits

1. **Task 1: page.tsx — seed history + self nickname** - `83bebc2` (feat)
2. **Task 2: moa-island.tsx — tab state + channel extension + messages + send** - `2eeb9b5` (feat)
3. **Task 3: extend moa-island.test.tsx — chat/presence/tab seams** - `0dd6c0a` (test)

## Files Created/Modified
- `apps/web/app/moa/[id]/_components/moa-island.tsx` - activeTab/messages/viewers/replyToPlaceId state; appendMessage; extended channel effect (trip_messages INSERT + presence sync + track pre-subscribe); handleSend; placesById; 모으기(hidden-toggle)/채팅 render + MoaTabBar
- `apps/web/app/moa/[id]/page.tsx` - listTripMessages seed in Promise.all; user.id in nameIds; initialMessages + currentUserNickname props
- `apps/web/__tests__/moa-island.test.tsx` - channel stub upgrade + MoaChat/MoaTabBar stubs + Test 1 rewrite + 4 new tests (10–13)

## Decisions Made
- **Channel created on its own line** (poll-vote-island idiom) rather than the plan's single chained `const channel = client.channel(...)...subscribe(...)`. See Deviations — required so the SUBSCRIBED `channel.track(...)` callback can reference `channel` without a temporal-dead-zone error when the test stub invokes the subscribe callback synchronously. Functionally identical, single channel, all bindings pre-subscribe; matches the analog the plan told us to MIRROR.
- **Layout:** 채팅 view is `fixed inset-0` + `pb-[64px]` to clear the fixed tab bar; 모으기 wrapper uses `contents` so its own `fixed inset-0` child is preserved (kept minimal per RESEARCH Q5 — no map-internal layout changes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split channel creation onto its own line to avoid a TDZ error in the SUBSCRIBED track callback**
- **Found during:** Task 2/3 (channel effect + test authoring)
- **Issue:** The plan's snippet writes `const channel = client.channel(...).on(...)...subscribe(async s => { await channel.track({...}) })` as one chained expression. The plan's own upgraded test stub (Task 3.1) invokes the subscribe callback *synchronously* with `'SUBSCRIBED'`. During a single chained assignment the `channel` binding is still in its temporal dead zone when the callback runs, so `channel.track` throws `ReferenceError` and `track` is never called — the Task 3.4 assertion (`track` called with `{user_id, nickname}`) would fail.
- **Fix:** Created the channel on its own statement (`const channel = client.channel(moaChannelName(trip.id), { config: { presence: { key: currentUserId } } });`) then chained `.on(...).on(...).on(...).on('presence',...).subscribe(...)` — exactly the poll-vote-island pattern the plan/RESEARCH point to as the presence analog to MIRROR. `channel` is fully assigned before any callback can run, in production and under the synchronous test stub alike.
- **Files modified:** apps/web/app/moa/[id]/_components/moa-island.tsx
- **Verification:** Test 1 asserts `track` called with `expect.objectContaining({ user_id: 'u1', nickname: '나' })` — green. Grep confirms a single `client.channel(` and one `useEffect`; all bindings before `.subscribe()`.
- **Committed in:** `2eeb9b5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — TDZ under the plan's synchronous subscribe stub).
**Impact on plan:** Structural-equivalent statement split only; single channel, single effect, all postgres_changes + presence bindings still pre-subscribe. No behavioral or scope change; aligns with the mandated poll-vote-island analog.

## Issues Encountered
None. `pnpm --filter web test:run -- moa-island` runs the whole web suite under `--passWithNoTests` (the positional does not filter), so moa-island was confirmed green via a targeted `vitest run __tests__/moa-island.test.tsx` (13/13), consistent with the 26-02 note.

## User Setup Required
None - no external service configuration required. (Live realtime delivery + send-succeeds remain gated on 0028 reaching `main` — auto-apply — per 26-01's deploy note; not an out-of-code step for this plan.)

## Next Phase Readiness
- Island now owns `activeTab`/`messages`/`viewers`/`replyToPlaceId` and drives `MoaChat`/`MoaTabBar`. **26-04** can wire CHAT-03 mention navigation: the `답장` stub in place-list → `setActiveTab('chat')` + prefill `replyToPlaceId`, and `MoaChat.onChipTap` (currently a no-op) → `setActiveTab('moa')` + `setOpenPlaceId(id)` + `setSheetAnchor('expanded')` reusing the existing `openPlaceId` scroll/highlight path.
- `placesById` and `replyToPlaceId` are already declared + passed, so 26-04 is state-plumbing + the place-list callback, no channel changes.
- Live CHAT-01/02 behavior (postgres_changes delivery, presence count) is provable only after 0028 reaches `main` (auto-apply) — unchanged from 26-01/26-02.

## Self-Check: PASSED

- All modified files present on disk (moa-island.tsx, page.tsx, moa-island.test.tsx) + SUMMARY.md created.
- All 3 task commits present in git log (83bebc2, 2eeb9b5, 0dd6c0a); no file deletions across the 3 commits.
- Plan verification re-run green: web suite 133 pass (moa-island 13/13), tsc exit 0, exactly 3 `.on('postgres_changes'` bindings + 1 presence binding on 1 `client.channel(` in 1 `useEffect`, `.track(` present, places/links still `reconcile()` while messages use `appendMessage`, no `.js` workspace imports, iOS untouched (git diff shows no ios files).

---
*Phase: 26-realtime-chat*
*Completed: 2026-07-10*
