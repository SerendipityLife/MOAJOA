---
phase: 17-trip-foundation-ia
plan: 04
subsystem: ui
tags: [expo-router, react-native, navigation, ia, tabs, share-intent, asyncstorage]

# Dependency graph
requires:
  - phase: 17-01
    provides: decideEntryRoute (0/1/N pure fn) + TripKeys.LastTripId + Trip contract
  - phase: 17-03
    provides: trip-vocab api (listMyTrips/getTrip/deleteTrip/addLink trip_id/listLinksByTrip/listPlacesByTrip) + trips-native DB
provides:
  - "apps/ios trip-scoped IA: /trip/[id] Stack header + /trip/[id]/(tabs) 4-tab bottom bar (지도·플랜·예약·가계부)"
  - "index.tsx 0/1/N entry branch via decideEntryRoute (0→/onboarding, 1/N→/trip/{id}/plan)"
  - "trip header: 여행 전환 switcher (left) + profile→/me (right), no FAB, no new-trip tab"
  - "share flow repointed /boards/{id} → /trip/{id}/plan; board_id→trip_id at the call site"
  - "clean break: old boards/ tree + global (tabs) group (incl. deferred discover/friends) deleted, no legacy redirect"
  - "me relocated to a global trip-out stack screen (app/me.tsx)"
affects: [18-plan-tab, 19-date-voting, 20-booking, 22-android-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header/tabs split (Pitfall 1 guard): header owned by parent Stack (/trip/[id]/_layout), tab bar owned by (tabs)/_layout — never both in one layout, never double-nested (tabs)"
    - "Entry branch = decideEntryRoute(listMyTrips, lastTripId) resolved in index.tsx, <Redirect> per kind; 0-trip → /onboarding is the real reachable path (no auto-first-board)"
    - "Surgical content port: boards/[id].tsx map content re-homed under (tabs)/map.tsx with trip-vocab data calls, confidence read preserved"

key-files:
  created:
    - apps/ios/app/trip/[id]/_layout.tsx
    - apps/ios/app/trip/[id]/header.tsx
    - apps/ios/app/trip/[id]/(tabs)/_layout.tsx
    - apps/ios/app/trip/[id]/(tabs)/map.tsx
    - apps/ios/app/trip/[id]/(tabs)/plan.tsx
    - apps/ios/app/trip/[id]/(tabs)/book.tsx
    - apps/ios/app/trip/[id]/(tabs)/ledger.tsx
    - apps/ios/app/me.tsx
  modified:
    - apps/ios/app/index.tsx
    - apps/ios/app/share-handler.tsx
    - apps/ios/lib/share-routing.ts
    - apps/ios/__tests__/share-routing.test.ts
  removed:
    - apps/ios/app/boards/ (tree)
    - apps/ios/app/(tabs)/ (group, incl. discover.tsx + friends.tsx)

key-decisions:
  - "Header owned by parent Stack, tab bar owned by (tabs)/_layout — split prevents the vanishing-tab-bar regression (Pitfall 1)"
  - "0-trip branch routes to /onboarding (not a seeded trip) — first-trip creation is owned by onboarding (Plan 05), BLOCKER 1"
  - "Clean break per D-13/D-15: no /boards or /b legacy redirect alias (external users = 0)"
  - "discover/friends deleted with the (tabs) tree, not relocated (Open Q4) — both are deferred features (discover=v2, friends=Phase 19) with no surviving Phase 17 home"

patterns-established:
  - "Trip IA shell: /trip/[id]/_layout (Stack+header) → (tabs)/_layout (4 Tabs) → {map,plan,book,ledger} screens"
  - "plan = default landing tab; book/ledger = neutral-only '곧 제공돼요' stubs (D-11, no brand accent)"

requirements-completed: [NAV-01, NAV-02, NAV-03, NAV-04]

# Metrics
duration: ~code built across Tasks 1-3 (3 atomic commits); finalized 2026-06-21 after human-verify UAT approval
completed: 2026-06-21
---

# Phase 17 Plan 04: Trip-Scoped IA Restructure (4-Tab Shell + 0/1/N Entry) Summary

**Flipped apps/ios from the global 5-tab boards IA to the trip-scoped 4-tab shell (지도·플랜·예약·가계부) under /trip/[id], wired the 0/1/N decideEntryRoute branch, built the trip header (switcher + profile, no FAB), repointed the share flow to /trip/{id}/plan, and clean-broke the old boards/ + global (tabs) routes — device UAT signed off by the user.**

## Performance

- **Tasks:** 4 (3 code tasks committed atomically + 1 human-verify UAT gate)
- **Code commits:** 3 (`4fef904`, `4022b7e`, `4079b06`)
- **Files created:** 8 · **modified:** 4 · **removed:** 2 trees (boards/, (tabs)/)
- **Completed:** 2026-06-21 (code committed earlier; finalized after UAT approval)

## Accomplishments
- **0/1/N entry branch (NAV-01):** `index.tsx` preserves the auth scaffold and replaces the old `<Redirect href="/(tabs)/boards" />` with `decideEntryRoute(listMyTrips, lastTripId)` — `kind==='onboarding'` → `/onboarding`, `kind==='trip'` → `/trip/{tripId}/plan`. A fresh 0-trip account legitimately resolves to onboarding (Plan 03 retired the auto-first-board trigger; first-trip creation is owned by Plan 05's onboarding 정해짐 path — BLOCKER 1).
- **4-tab shell, always-visible bar (NAV-02):** `/trip/[id]/(tabs)/_layout.tsx` renders 4 `Tabs.Screen` (map/지도, plan/플랜, book/예약, ledger/가계부) with the tab-bar style copied verbatim from the old `(tabs)/_layout` (UI-SPEC Screen 4 lock), `headerShown:false`, **plan as default landing**, no FAB, no `new` screen.
- **Trip header (NAV-03):** `/trip/[id]/_layout.tsx` is the parent Stack that owns `header.tsx` via `screenOptions={{ header }}` (Pitfall 1 split). Header = left "현재 여행 ▾" 여행 전환 switcher (lists trips + 새 여행 + per-row 삭제 Alert) + right profile glyph → `/me`. No FAB anywhere.
- **Content port + new tab screens (NAV-02):** map tab hosts the ported boards/[id].tsx map content (MapView/Marker/place-list/pin-sheet) with trip-vocab data calls and the `confidence` read preserved; plan = brand-accented empty state; book/ledger = neutral-only "곧 제공돼요" stubs; `me` relocated to a global stack screen.
- **Share repoint + clean break (NAV-04):** `share-handler.tsx` `addLink(... board_id ...)` → `trip_id`, `router.replace('/boards/{id}')` → `/trip/{tripId}/plan`, `listMyBoards`→`listMyTrips`; `share-routing.ts` + its tests renamed to trip vocab. Entire `boards/` tree and global `(tabs)` group deleted (incl. deferred discover/friends, Open Q4) with **no legacy redirect** (D-15).

## Task Commits

1. **Task 1: 0/1/N entry branch + trip Stack header + 4-tab layout** - `4fef904` (feat)
2. **Task 2: Port map content + plan/book/ledger tab screens + me screen** - `4022b7e` (feat)
3. **Task 3: Repoint share flow to /trip + delete old boards/ and global (tabs)** - `4079b06` (feat)
4. **Task 4: Device UAT (checkpoint:human-verify)** - approved by the user (no code commit; on-device sign-off)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `apps/ios/app/index.tsx` - entry branch replaces the old boards redirect with decideEntryRoute (0→/onboarding, 1/N→/trip/{id}/plan)
- `apps/ios/app/trip/[id]/_layout.tsx` - parent Stack owning the trip header (useGlobalSearchParams<{id}>)
- `apps/ios/app/trip/[id]/header.tsx` - 여행 전환 switcher (left) + profile→/me (right), no FAB
- `apps/ios/app/trip/[id]/(tabs)/_layout.tsx` - 4-tab bottom bar (지도·플랜·예약·가계부), plan default, verbatim tab-bar style
- `apps/ios/app/trip/[id]/(tabs)/map.tsx` - ported board map content w/ trip vocab (confidence read intact)
- `apps/ios/app/trip/[id]/(tabs)/plan.tsx` - brand-accented empty state (default landing; Phase 18 fills content)
- `apps/ios/app/trip/[id]/(tabs)/book.tsx` - neutral stub "예약은 곧 제공돼요" (D-11, no brand accent)
- `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` - neutral stub "가계부는 곧 제공돼요"
- `apps/ios/app/me.tsx` - relocated profile screen (global trip-out stack; header profile routes here)
- `apps/ios/app/share-handler.tsx` - addLink trip_id + router.replace('/trip/{id}/plan') + listMyTrips
- `apps/ios/lib/share-routing.ts` - decideShareRoute renamed to trip vocab (pure logic intact)
- `apps/ios/__tests__/share-routing.test.ts` - tests updated to trip vocab
- `apps/ios/app/boards/` - **removed** ([id].tsx, new.tsx, _layout.tsx, failed.tsx)
- `apps/ios/app/(tabs)/` - **removed** (_layout.tsx incl. NewBoardFab, boards/discover/friends/new/me.tsx)

## Verification Evidence

**Automated (hard evidence, verified by orchestrator):**
- `apps/ios` typecheck: **0 errors** — the two forward-refs Plan 04 left (`/onboarding` in index.tsx, `/trip/create` in header.tsx) were resolved by Plan 05 creating those routes + regenerating the Expo typed-routes manifest.
- `apps/ios` jest: **72/72 green (12 suites)** — incl. the share-routing tests updated to trip vocab.
- Structural: old `app/boards/` and `app/(tabs)/` trees removed; new `/trip/[id]` 4-tab IA + 0/1/N entry + header (no FAB) + share→`/trip/{id}/plan` present on disk.

**Human-verify UAT (Task 4 checkpoint — on-device, runtime behaviors grep/jest cannot prove):**
- The user ran `pnpm sim` and approved the IA on device/simulator ("굿" / approved).
- Context: the remote Supabase was **reset to the 0016 trips baseline this session** (the deferred remote migration from 17-03 was executed with the user's explicit approval after a backup to `.backups/`), so the sim ran against a **trips-native remote** — the entry branch, 4-tab bar, header switcher, and repointed share flow were exercised end-to-end against real trip data.
- NAV-01 (0/1/N entry), NAV-02 (4-tab always-visible bar), NAV-03 (header switcher/profile, no FAB), NAV-04 (share lands on a trip route) confirmed at runtime and signed off by the user.

## Decisions Made
- **Header/tabs split (Pitfall 1):** header on the parent Stack, tab bar on `(tabs)/_layout` — prevents the vanishing-tab-bar regression and avoids double-nested `(tabs)`.
- **0-trip → /onboarding, not a seeded trip (BLOCKER 1):** keeps the onboarding branch the sole owner of first-trip creation (Plan 05).
- **Clean break, no legacy redirect (D-13/D-15):** external users = 0, so old `/boards` links are waived rather than aliased.
- **discover/friends deleted, not relocated (Open Q4):** deferred features with no Phase 17 home; re-introduced in their owning phase (discover=v2, friends=Phase 19).

## Deviations from Plan

None — plan executed as written.

The two cross-plan items adjacent to this plan are handled elsewhere and are not deviations of 17-04:
- The `/onboarding` + `/trip/create` forward-refs in this plan's index.tsx/header.tsx were intentional (the targets are owned by Plan 05) and were resolved when Plan 05 created those routes.
- The core `LinkAdd.board_id` input field is **not** renamed by this plan. Plan 03 deliberately kept `LinkAdd`/`PlaceAddManual.board_id` as the core input shape and maps `input.board_id → trip_id` at the `@moajoa/api` boundary (renaming the core input cascades to 4+ call sites and is owned by a later plan). This plan's `share-handler.tsx` therefore passes a trip id at the call site (variable renamed to `trip_id`) while the api boundary continues to accept the legacy `board_id` input key — no contradiction, the trip id flows through correctly. The core-input rename is tracked as future-owned, not done here.

## Issues Encountered
None during finalization. (Expo typed-routes forward-ref staleness was resolved in Plan 05 by regenerating `.expo/types/router.d.ts`; iOS typecheck is now 0 errors.)

## User Setup Required
None — no external service configuration. (The remote Supabase reset to the 0016 trips baseline was performed this session with the user's explicit approval after a `.backups/` dump.)

## Next Phase Readiness
- Trip-scoped IA shell is live and UAT-approved: entry branch + 4-tab bar + header + repointed share all confirmed on device against a trips-native remote.
- Phase 17 is now fully delivered (NAV-01/02/03/04 here; SETUP-01/02 + ATTR-01 + NAV-04 across 17-01/02/03/05). Phase 17 verify can proceed, then Phase 18 fills the plan tab content (`/trip/[id]/(tabs)/plan.tsx` ships its empty state only).
- book/ledger neutral stubs are deliberate placeholders for Phase 20/21; the 미정 (date-voting) onboarding path is Phase 19.

## Self-Check: PASSED

- Created files verified on disk: trip/[id]/_layout.tsx, trip/[id]/header.tsx, trip/[id]/(tabs)/{_layout,map,plan,book,ledger}.tsx, me.tsx, 17-04-SUMMARY.md
- Old route trees verified removed: app/boards/ GONE, app/(tabs)/ GONE
- Task commits verified in git: 4fef904, 4022b7e, 4079b06

---
*Phase: 17-trip-foundation-ia*
*Completed: 2026-06-21*
