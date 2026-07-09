---
phase: 26-realtime-chat
plan: 04
subsystem: ui
tags: [react, nextjs, chat, mention, reply, place-navigation, vitest]

# Dependency graph
requires:
  - phase: 26-realtime-chat
    provides: "26-02 MoaChat #N chip/onChipTap + reply-banner contract; 26-03 island state (replyToPlaceId/placesById/activeTab already declared + passed, MoaChat.onChipTap no-op placeholder)"
  - phase: 24-host-flow
    provides: "place-list openPlaceId controlled path (scrollIntoView effect + data-place-id rows); moa-island onMarkerTap (setOpenPlaceId + setSheetAnchor('expanded'))"
provides:
  - "place-list 답장 button → onReply(placeId) callback (replaces the 채팅은 곧 열려요 toast stub)"
  - "island reply-prefill: onReply → setReplyToPlaceId + setActiveTab('chat')"
  - "island openPlaceFromChat: setActiveTab('moa') + setOpenPlaceId + setSheetAnchor('expanded'), wired as MoaChat.onChipTap"
  - "place-list transient highlight cue: ring-2 ring-brand-300 on the opened row, cleared after ~1.5s (CHAT-03 하이라이트)"
  - "moa-island.test.tsx: 13 → 15 cases (답장 prefill + chip nav + highlight)"
affects: [phase-25-guest-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mention loop reuses the existing openPlaceId controlled path — chip nav and 답장 both funnel through island state already declared in 26-03; no channel/data-layer changes"
    - "Transient highlight = useEffect keyed off openPlaceId sets highlightId then a 1.5s timer clears it (clearTimeout on cleanup); ring class + data-highlighted on the row"

key-files:
  created:
    - .planning/phases/26-realtime-chat/26-04-SUMMARY.md
  modified:
    - apps/web/app/moa/[id]/_components/place-list.tsx
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/__tests__/place-list.test.tsx
    - apps/web/__tests__/moa-island.test.tsx

key-decisions:
  - "Highlight cue = data-highlighted attr + ring-2 ring-brand-300 driven by a highlightId state keyed off openPlaceId (marker tap and chip tap both trigger it — consistent visible cue); timer cleared on cleanup to avoid post-unmount act warnings"
  - "onReply is a required PlaceListProps prop (not optional) — the reply entry point must always be wired; existing place-list.test.tsx render harness updated to supply it"

patterns-established:
  - "CHAT-03 mention navigation is pure state-plumbing over the 26-03 island: no new channel binding, no new query, no schema touch"

requirements-completed: [CHAT-03]

# Metrics
duration: 5min
completed: 2026-07-09
---

# Phase 26 Plan 04: Place-Mention Reply Loop Summary

**Closed CHAT-03: the place-list 답장 button now jumps to the 채팅 tab with the place prefilled as reply target, the sent message carries the existing #N 장소명 chip, and tapping the chip jumps back to 모으기, scrolls to the place, and flashes a transient ring highlight — all reusing the openPlaceId controlled path with no channel or data-layer changes.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-09T17:22:46Z
- **Completed:** 2026-07-09T17:27:52Z
- **Tasks:** 3
- **Files modified:** 4 (2 source + 2 test; 1 summary created)

## Accomplishments
- **답장 → 채팅 prefill** — the place-row 답장 stub (previously a `toast('채팅은 곧 열려요')` disabled button) is now an enabled `onReply(p.id)` callback. The island wires it to `setReplyToPlaceId(placeId) + setActiveTab('chat')`, so tapping 답장 flips to the chat with the reply-compose banner already targeting that place.
- **#N chip → 모으기 nav** — `openPlaceFromChat` mirrors `onMarkerTap` (`setOpenPlaceId` + `setSheetAnchor('expanded')`) and additionally `setActiveTab('moa')`, wired as `MoaChat.onChipTap` (replacing the 26-03 no-op placeholder). The chip round-trips through the same `openPlaceId` machinery the marker-tap path uses.
- **하이라이트 (required deliverable)** — place-list adds a transient `ring-2 ring-brand-300` + `data-highlighted` cue on the row whose `id === openPlaceId`, set by a `useEffect` keyed off `openPlaceId` and cleared after ~1.5s (timer cleared on cleanup). Scroll alone did not satisfy CHAT-03's 하이라이트 commitment; the visible cue is now asserted by a unit test.
- **Deleted-place safety (Pitfall 9)** — no island change needed: 0025 FK is `on delete set null` and `placesById` is built from the hidden-filtered `places` state, so a removed place's `reply_to_place_id` resolves to nothing and MoaChat renders no chip (already handled in 26-02).
- **Tests** — moa-island suite extended 13 → 15 (답장 → chat active + prefilled reply-target; chip tap → 모으기 active + aria-expanded row + data-highlighted); place-list suite 12 → 13 (답장 → onReply(placeId), no row toggle). Full web suite 136 green, tsc exit 0.

## Task Commits

1. **Task 1: place-list 답장 button → onReply callback** - `3422762` (feat)
2. **Task 2: island reply-prefill + chip nav + highlight** - `8945d3f` (feat)
3. **Task 3: extend moa-island.test.tsx — mention loop** - `09eeb20` (test)

## Files Created/Modified
- `apps/web/app/moa/[id]/_components/place-list.tsx` - `onReply` prop; 답장 button (toast stub removed, useToast import dropped); transient highlight (highlightId state + effect + ring/data-highlighted on row)
- `apps/web/app/moa/[id]/_components/moa-island.tsx` - `onReply` passed to PlaceList (setReplyToPlaceId + setActiveTab('chat')); `openPlaceFromChat` wired as MoaChat.onChipTap
- `apps/web/__tests__/place-list.test.tsx` - onReply in render harness + Test 13 (답장 → onReply)
- `apps/web/__tests__/moa-island.test.tsx` - MoaChat stub upgrade (replyToPlaceId + chip buttons) + Test 14/15

## Decisions Made
- `onReply` is a **required** prop (per plan) rather than optional — the reply entry point is always present, so the existing place-list render harness was updated to supply it. Because a required prop on PlaceList couples place-list and its callers, the repo-wide `tsc --noEmit` goes fully green only after Task 2 wires the island; the Task 1 commit's vitest suite (which never invokes the prop) stays green on its own.
- Highlight is keyed off `openPlaceId` (not a chip-only signal), so both marker taps and chip taps flash the same cue — a consistent, discoverable behavior rather than a chip-special case.

## Deviations from Plan

None - plan executed exactly as written.

The only judgment call was Task 1/Task 2 typecheck ordering (required-prop coupling), documented under Decisions — not a deviation: the plan explicitly sequences the place-list prop (Task 1) before the island wiring (Task 2), and the highlight lives in place-list.tsx per Task 2's action text even though Task 2's `<files>` lists only moa-island.tsx.

## Issues Encountered
- The plan verification `grep "채팅은 곧 열려요" apps/web → 0 matches` initially showed 2 hits — both in `apps/web/.next/` (gitignored stale build cache), not source. Source (`--exclude-dir=.next`) is 0. No action needed.
- `pnpm --filter web test:run` runs the whole web suite (the positional does not filter under `--passWithNoTests`), so the targeted files were confirmed via `vitest run` on each path (place-list 13/13, moa-island 15/15), consistent with the 26-02/26-03 notes.

## User Setup Required
None - no external service configuration required. (Live CHAT-03 mention nav is exercisable in-app once 0028 reaches `main` — Supabase↔GitHub auto-apply — unchanged from 26-01/26-03; not an out-of-code step for this plan.)

## Next Phase Readiness
- CHAT-01/02/03 are now code-complete for authenticated members. The full mention loop (답장 ↔ #N chip ↔ place highlight) is unit-verified.
- Guest chat participation (link-in friends) remains Phase 25 (게스트 통합 공유화면) — the code base is complete; only the guest join/nickname-gate surface is deferred.
- Live realtime delivery + presence + mention nav are provable in Preview/prod only after 0028 (publication add + user_id trigger) reaches `main`.

## Self-Check: PASSED

- All 4 modified files present on disk + 26-04-SUMMARY.md created.
- All 3 task commits present in git log (3422762, 8945d3f, 09eeb20); 0 file deletions across the 3 commits.
- Plan verification re-run green: full web suite 136 pass (place-list 13/13, moa-island 15/15), tsc exit 0, `채팅은 곧 열려요` 0 in source, `openPlaceFromChat` present in moa-island, `onReply` present in place-list + moa-island, 0 `.js` workspace imports in edited files, iOS untouched (0 files in 65ae8f1..HEAD).

---
*Phase: 26-realtime-chat*
*Completed: 2026-07-09*
