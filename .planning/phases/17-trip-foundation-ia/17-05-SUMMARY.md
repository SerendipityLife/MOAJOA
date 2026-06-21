---
phase: 17-trip-foundation-ia
plan: 05
subsystem: ui
tags: [expo-router, react-native, nextjs, trip-creation, onboarding, ssr, zod, public-share]

# Dependency graph
requires:
  - phase: 17-01
    provides: TripCreateSchema (required dates + end>=start refine), CITY_KO_MAP, Trip contract
  - phase: 17-03
    provides: createTrip / getPublicTripBySlug / listMyTrips + trip-vocab api + public_trip_view RPC (0016)
  - phase: 17-04
    provides: /trip IA, index.tsx 0/1/N entry branch, trip/[id]/header.tsx (forward-refs /onboarding + /trip/create)
provides:
  - "apps/ios onboarding 정해짐/미정 branch (sole first-trip creation entry for 0-trip accounts)"
  - "apps/ios trip/create.tsx — preset city + required date range + auto-representative trip creation"
  - "apps/web public share route moved /b/[slug] → /t/[slug] backed by public_trip_view"
  - "iOS typecheck fully clean (both prior forward-ref errors resolved)"
  - "web dev-tool boards routes migrated to trip vocab (compile-fix for Plan 03 deletion)"
affects: [18-plan-tab, 19-date-voting, 20-booking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Trip creation form = boards/new.tsx structure ported to trip vocab (createTrip + TripCreateSchema), dates flipped to required"
    - "Onboarding branch: enabled brand-accented path card + disabled neutral-only '곧 제공' stub (D-11 IA completeness)"
    - "Public SSR share route = git-mv tree move + RPC/cache rename, clean break (no legacy redirect)"

key-files:
  created:
    - apps/ios/app/onboarding.tsx
    - apps/ios/app/trip/create.tsx
    - apps/web/app/t/[slug]/* (moved from b/[slug])
    - apps/web/lib/public-trip-cache.ts (renamed from lib/cache.ts)
  modified:
    - apps/web/app/api/revalidate/route.ts
    - apps/web/app/boards/page.tsx
    - apps/web/app/boards/[id]/page.tsx
    - apps/web/__tests__/* (path/name updates for the move)

key-decisions:
  - "Trimmed trip/create.tsx to the two required fields (city + date) per UI-SPEC Screen 3 option — dropped the optional memo/link/visibility cards (link path used board-vocab addLink+startExtraction out of scope)"
  - "Day-trip handling: DatePickerSheet leaves end=null on single tap; coerce end=start on confirm so the required-range gate (end>=start) is satisfied"
  - "Renamed VoteIsland boardId prop → tripId for trip-vocab consistency (value is the trip id)"
  - "Migrated the broken web dev-tool boards/ routes to trip vocab and removed the title-only create-board-button (createTrip needs city+dates; CLAUDE.md §5 keeps creation iOS-only)"

patterns-established:
  - "Onboarding disabled-path color contract: neutral.100 fill / neutral.400 text / neutral '곧 제공' badge, no brand accent, no chevron"
  - "TripCreateSchema.parse gate before createTrip (T-17-13 input integrity)"

requirements-completed: [SETUP-01, SETUP-02, NAV-04]

# Metrics
duration: 23min
completed: 2026-06-21
---

# Phase 17 Plan 05: Onboarding Branch + 일정 정해짐 Trip Create + Web /t/[slug] Move Summary

**Onboarding 정해짐/미정 branch routing to a preset-city + required-date-range trip-create form (auto-representative via trigger), plus the web public share route moved /b/[slug] → /t/[slug] backed by public_trip_view — iOS typecheck now fully clean.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-06-21T13:05:43Z
- **Completed:** 2026-06-21T13:29:00Z
- **Tasks:** 3
- **Files modified:** 23 (2 iOS created, 7-file web tree moved, 1 cache renamed, dev-tool migrated, 8 tests updated)

## Accomplishments
- **Onboarding branch (SETUP-01, D-11):** fresh 0-trip accounts land on a "일정이 정해졌나요?" branch — 정해짐 card (enabled, brand-accented) → `/trip/create` is the SOLE first-trip creation path (BLOCKER 1: Plan 03 retired the auto-first-board trigger); 미정 card is a disabled neutral-only "곧 제공" stub (Phase 19 fills it).
- **일정 정해짐 trip create (SETUP-01/02):** preset city (CITY_KO_MAP via CityPicker) + required date range (DatePickerSheet, end≥start, day-trip allowed) gate the "여행 만들기" CTA; payload validated through TripCreateSchema before createTrip; representative_id set server-side by the `trips_default_representative` trigger (no client field); success → `router.replace('/trip/{id}/plan')`; error → `Alert('여행 만들기 실패', …)`.
- **iOS typecheck fully clean:** creating `onboarding.tsx` + `trip/create.tsx` (and regenerating Expo typed routes) resolved both forward-reference errors left by Plan 04 (`/onboarding` in index.tsx, `/trip/create` in header.tsx). 72/72 jest tests green.
- **Web share route move (D-14, NAV-04):** the entire public SSR tree git-mv'd `b/[slug]` → `t/[slug]`; cache helper renamed `lib/cache.ts` → `lib/public-trip-cache.ts` (getCachedPublicTrip → getPublicTripBySlug → `public_trip_view`); `/b/${slug}` literals → `/t/${slug}`; `/b/[slug]` removed with no legacy redirect (D-15). 62/62 vitest green, typecheck clean, `next build` passes.

## Task Commits

1. **Task 1: Onboarding 정해짐/미정 branch** - `edd9318` (feat)
2. **Task 2: 일정 정해짐 trip create form** - `6ede7aa` (feat)
3. **Task 3: Move web /b/[slug] → /t/[slug]** - `3fc4873` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `apps/ios/app/onboarding.tsx` - 정해짐/미정 branch (D-11); 정해짐 → /trip/create, 미정 disabled neutral stub
- `apps/ios/app/trip/create.tsx` - preset city + required dates + auto-representative trip creation (TripCreateSchema → createTrip)
- `apps/web/app/t/[slug]/{page,error,not-found,opengraph-image}.tsx` + `_components/{map-section,public-board-map,vote-island}.tsx` - moved public SSR tree
- `apps/web/lib/public-trip-cache.ts` - renamed cache helper (getCachedPublicTrip + TRIP_REVALIDATE_TAG, public_trip_view)
- `apps/web/app/api/revalidate/route.ts` - repointed to TRIP_REVALIDATE_TAG
- `apps/web/app/boards/{page,[id]/page}.tsx` - dev-tool migrated to trip vocab (listMyTrips/getTrip/listLinksByTrip/listPlacesByTrip)
- `apps/web/app/boards/_components/create-board-button.tsx` - **removed** (title-only createBoard is dead; createTrip needs city+dates)
- `apps/web/__tests__/{api-revalidate,cache-key,cache-tag,map-options,metadata,og-image,vote-island,setup}.*` - moved-path + tag-name updates

## Decisions Made
- **Trimmed trip/create to two required fields** (city + date) per UI-SPEC Screen 3's allowed option, rather than carrying the optional memo/link/visibility cards from boards/new.tsx. The link card's `addLink`/`startExtraction`/`SharedDefaults` path is board-vocab and out of this plan's scope; the visibility/memo cards add scope with no requirement behind them.
- **Day-trip coercion:** the reused DatePickerSheet returns `end=null` after a single tap; `create.tsx` coerces `end = e ?? s` on confirm so a day-trip yields a complete `end==start` range that satisfies the required-range gate and the schema's `end>=start` refine.
- **VoteIsland prop rename** `boardId` → `tripId` for trip-vocab consistency (the value passed is `view.board.id`, i.e. the trip id; `getMyTripRole` takes `tripId`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated broken web dev-tool boards/ routes to trip vocab + removed orphaned create-board-button**
- **Found during:** Task 3 (web typecheck gate)
- **Issue:** Plan 03 deleted ALL board API functions (`listMyBoards`, `getBoard`, `listLinksByBoard`, `listPlacesByBoard`, `createBoard`). The web dev-tool routes `apps/web/app/boards/page.tsx`, `boards/[id]/page.tsx`, and `boards/_components/create-board-button.tsx` still imported them, so `pnpm --filter @moajoa/web typecheck` could not pass (the success-criteria gate). The plan's Task 3 step 4 said "leave boards/ untouched," but that assumed they still compiled. Plan 03's own SUMMARY explicitly handed the broken app importers to 17-04/05 ("17-04/05가 앱 trip 어휘 마이그레이션 소유"), so 17-05 owns this compile-fix.
- **Fix:** Migrated the read/list dev-tool routes to trip vocab (`listMyTrips`, `getTrip`, `listLinksByTrip`, `listPlacesByTrip`) — the dev-tool stays functional for the Windows colleague (CLAUDE.md §5). Removed `create-board-button.tsx`: its title-only `createBoard` no longer maps to `createTrip` (which now requires city + dates), and CLAUDE.md §5 keeps trip creation iOS-only — so a web city/date form would violate that rule. The `AddLinkForm` dev-tool component still compiles unchanged (Plan 03 deliberately kept `LinkAdd.board_id` mapped at the api boundary).
- **Files modified:** apps/web/app/boards/page.tsx, apps/web/app/boards/[id]/page.tsx, apps/web/app/boards/_components/create-board-button.tsx (deleted)
- **Verification:** web typecheck 0 errors, `next build` passes (/boards + /boards/[id] routes compile), 62/62 vitest green
- **Committed in:** 3fc4873 (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed broken board-vocab API imports in vote-island when moving it**
- **Found during:** Task 3
- **Issue:** `vote-island.tsx` imported `getMyBoardRole` / `joinSharedBoard` from `@moajoa/api`, which Plan 03 renamed to `getMyTripRole` / `joinSharedTrip`. The component did not compile (TS2305).
- **Fix:** Updated the imports + call sites to the trip-vocab names; renamed the `boardId` prop to `tripId` and the page.tsx call site (`boardId={view.board.id}` → `tripId={…}`).
- **Files modified:** apps/web/app/t/[slug]/_components/vote-island.tsx, apps/web/app/t/[slug]/page.tsx
- **Verification:** web typecheck clean, vote-island.test.tsx green (mock keys + `boardId`/`/b/` assertions updated to trip vocab)
- **Committed in:** 3fc4873 (Task 3 commit)

**3. [Rule 3 - Blocking] Fixed broken getPublicBoardBySlug import in the cache helper while renaming it**
- **Found during:** Task 3
- **Issue:** `lib/cache.ts` imported `getPublicBoardBySlug` from `@moajoa/api`, which Plan 03 removed (renamed to `getPublicTripBySlug`). The file did not compile (TS2724).
- **Fix:** `git mv lib/cache.ts → lib/public-trip-cache.ts`; switched to `getPublicTripBySlug` (which calls `public_trip_view`); renamed exports `getCachedPublicBoard → getCachedPublicTrip` and `BOARD_REVALIDATE_TAG → TRIP_REVALIDATE_TAG` (tag `board:` → `trip:`); repointed the `/api/revalidate` route import.
- **Files modified:** apps/web/lib/public-trip-cache.ts, apps/web/app/api/revalidate/route.ts
- **Verification:** web typecheck clean, cache-key/cache-tag/api-revalidate tests green
- **Committed in:** 3fc4873 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking compile-fixes inherited from Plan 03's board→trip API deletion, which Plan 03's SUMMARY explicitly assigned to 17-04/05).
**Impact on plan:** All three are necessary for the web typecheck/build success criteria. No scope creep — each is a mechanical board→trip vocab migration of a file the move/Plan-03 deletion broke. The only judgment call (removing the web dev-tool create-board-button) is justified by CLAUDE.md §5 (web creation stays iOS-only) and the new mandatory-dates create contract.

## Issues Encountered
- **Expo typed-routes staleness:** after creating `onboarding.tsx` + `trip/create.tsx`, `tsc` still reported the two forward-ref errors because `.expo/types/router.d.ts` (a gitignored generated manifest) had not been regenerated. Resolved by briefly starting the Expo dev server (`expo start --no-dev`, CI mode) to regenerate the route manifest, then stopping it; iOS typecheck then reported 0 errors. The regenerated `router.d.ts` is gitignored and not committed.
- **Web test script is `vitest` (watch mode):** the bare `pnpm --filter @moajoa/web test` hangs in watch mode in this environment; ran `pnpm exec vitest run` for a deterministic non-watch pass (62/62).

## User Setup Required
None - no external service configuration required. (Remote DB reset remains deferred from 17-03 per that plan; this plan's web SSR view depends only on the locally-applied `public_trip_view` RPC.)

## Next Phase Readiness
- iOS typecheck is fully clean (0 errors) — the IA + entry-branch + creation flow is internally consistent end to end.
- Plan tab (`trip/[id]/(tabs)/plan.tsx`) ships its empty state only; **Phase 18** fills it with real plan content. trip/create lands there on success.
- 미정 (date-voting) onboarding path is a deliberate disabled stub — **Phase 19** wires it.
- Web `/t/[slug]` public share is live against `public_trip_view`; the `/api/revalidate` webhook still resolves (path unchanged) — the extract-youtube EF revalidation contract is intact.
- Web dev-tool `/boards` is now read-only (no create affordance); if a web-side quick-create is wanted later it must follow the city+date TripCreate contract (or stay iOS-only per CLAUDE.md §5).

## Self-Check: PASSED

- Created files verified on disk: onboarding.tsx, trip/create.tsx, t/[slug]/page.tsx, lib/public-trip-cache.ts, 17-05-SUMMARY.md
- Task commits verified in git: edd9318, 6ede7aa, 3fc4873

---
*Phase: 17-trip-foundation-ia*
*Completed: 2026-06-21*
