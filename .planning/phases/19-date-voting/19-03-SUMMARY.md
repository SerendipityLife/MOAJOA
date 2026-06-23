---
phase: 19-date-voting
plan: 03
subsystem: ui
tags: [ios, expo, react-native, nativewind, realtime, date-voting, bottom-sheet, supabase]

# Dependency graph
requires:
  - phase: 19-01
    provides: "0018 date_polls schema + confirm_poll_date / create_dateless_trip_with_poll / poll_vote_tally RPCs + anon-grant RLS"
  - phase: 19-02
    provides: "@moajoa/api date-polls wrappers (getPollByTrip/getPollTally/setPollMode/confirmPollDate/createDatelessTrip) + @moajoa/core pollChannelName/TripCreateDatelessSchema/contiguousBlock/DatePollMode"
  - phase: 18-05
    provides: "iOS plan-tab state machine + subscribePlanProgress realtime idiom + TravelModeToggle segmented-control pattern + RNTL test topology (scoped native mocks)"
provides:
  - "iOS host date-voting path: onboarding 미정 card → dateless trip create → plan-tab 날짜 투표 management card → host confirm"
  - "subscribePollChannel(tripId) on poll:{tripId} (vote/comment broadcast + presence) in apps/ios/lib/realtime.ts"
  - "range↔grid mode toggle (D-07) gated to 0-votes via setPollMode (T-19-11 lock once votes exist)"
  - "inline confirm flow (@gorhom/bottom-sheet): range option list / grid contiguousBlock suggestions → destructive Alert → confirmPollDate"
affects: [19-04, phase-19-verify, phase-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "subscribePollChannel mirrors subscribePlanProgress (append-only realtime.ts, removeChannel leak guard)"
    - "dateless trip-create variant gated on a single route param (?dateless=1) reusing the dated create form"
    - "management card as a surgical state-machine branch BEFORE the normal plan render, gated on isDateless && poll open (unmounts on confirm)"
    - "Share.share for both invite-link + code (no expo-clipboard native dep — avoids unverifiable-without-sim crash risk, 18-05 precedent)"

key-files:
  created: []
  modified:
    - "apps/ios/app/onboarding.tsx (미정 card activated → /trip/create?dateless=1)"
    - "apps/ios/app/trip/create.tsx (dateless variant: no date card, createDatelessTrip, 날짜 투표 시작하기 CTA)"
    - "apps/ios/app/trip/[id]/(tabs)/plan.tsx (날짜 투표 management card + mode toggle + share + confirm + subscribePollChannel)"
    - "apps/ios/lib/realtime.ts (append subscribePollChannel + PollEvent)"
    - "apps/ios/__tests__/realtime.test.ts (+5 subscribePollChannel cases)"
    - "apps/ios/__tests__/plan.test.tsx (+3 management-card cases + native-mock additions)"

key-decisions:
  - "Dateless create defaults poll_mode='grid' (when2meet-style default) — NOT a silently-final choice; host switches range↔grid on the management card before the first vote/share (D-07)"
  - "초대 링크 복사 / 코드 공유 use Share.share (no expo-clipboard) — adding a native module is unverifiable without a sim (18-05 drag-lib reasoning); the existing share-board.ts idiom is Share.share with NO Clipboard"
  - "Management card lives inline in plan.tsx (not a separate component) — Task 2 files_modified + grep gates require the card strings IN plan.tsx"
  - "Mode toggle inlined as a 2-segment control (not a shared component) — mirrors TravelModeToggle idiom verbatim but range/grid-specific, accent only on the active segment"

patterns-established:
  - "Poll tally summary derivation: tallyVoterCount (distinct nicknames across entries) + tallyLeaderLabel (max available_count entry's date) — advisory-only, server is authoritative (T-19-02)"
  - "Grid confirm via contiguousBlock(perDay, runLength) over 1~3 day windows (advisory N박 suggestions, host picks — D-09)"

requirements-completed: [POLL-01, POLL-03]

# Metrics
duration: 9min
completed: 2026-06-23
---

# Phase 19 Plan 03: iOS Date-Voting Host Path Summary

**The iOS host can now activate the onboarding 미정 card → create a dateless trip with an open poll → manage it on the plan-tab 날짜 투표 card (range↔grid mode toggle gated to 0 votes, live tally summary, /poll/{code} invite share) → confirm a winning date that becomes the trip's schedule and closes the poll — all wired on a single poll:{trip_id} realtime channel.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-23T04:41:16Z
- **Completed:** 2026-06-23T04:50:38Z
- **Tasks:** 2 of 3 code tasks complete (Task 3 = device UAT, pending human verification)
- **Files modified:** 6

## Accomplishments

### Task 1 — onboarding 미정 card + dateless create + subscribePollChannel (commit 4957786)

- **onboarding.tsx:** the disabled "곧 제공" 미정 stub is now a brand-accented `Pressable` mirroring the 정해짐 card — `calendar-outline` brand icon chip, neutral-900 title "아직 미정이에요", chevron, `onPress → router.push('/trip/create?dateless=1')`. Badge removed; 정해짐 card + base CTA untouched.
- **trip/create.tsx:** added a `?dateless=1` variant. Reads `useLocalSearchParams<{ dateless }>`, defines `isDateless`. When dateless: hides the 여행 날짜 card + DatePickerSheet, `canSave` drops the date gate (city-only), CTA reads **날짜 투표 시작하기**, and `submit()` parses `TripCreateDatelessSchema` with explicit default `poll_mode='grid'` then calls `createDatelessTrip` and `router.replace('/trip/${trip_id}/plan')`. The dated path is byte-for-byte unchanged.
- **realtime.ts:** appended `subscribePollChannel(tripId, onEvent)` + `PollEvent` type. Subscribes `pollChannelName(tripId)` = `poll:{tripId}`, fans `broadcast:vote`/`broadcast:comment` + `presence:sync` (viewer count) into `onEvent`; returns the channel for `removeChannel` cleanup. **Only the L1 import changed** (added `pollChannelName`); `subscribeExtractProgress`/`subscribePlanProgress` bodies are untouched.
- **realtime.test.ts:** +5 cases (channel name `poll:t1`, vote payload, comment payload, presence viewer count, removeChannel identity). Extended the fake-channel mock to capture handlers by `type:event` key + `presenceState`; renamed the presence fixture to `mockPresenceState` (jest hoisting rule — factory may only reference `mock`-prefixed vars).

### Task 2 — plan-tab 날짜 투표 management card (commit 3208da4)

- **plan.tsx:** added a surgical state-machine branch **before** the normal render, gated on `isDateless && poll && poll.status !== 'closed'`. Loads poll meta via `getPollByTrip` (no inline `from('date_polls')` raw read) + tally via `getPollTally`, holds both in state.
  - **Header:** calendar Ionicon in a `bg-brand-50` chip + **날짜 투표 진행 중**.
  - **Mode toggle (D-07):** inline 2-segment 범위형/그리드 control mirroring TravelModeToggle (active segment `bg-brand-50` + `text-brand-600`). Gated to `canChangeMode = N === 0`; rendered disabled (`opacity 0.6`) once any vote exists (T-19-11). On press → `setPollMode(supabase, poll.id, mode)` → `loadPoll()` refetch. Error → `Alert.alert('모드 변경 실패', …)`.
  - **Summary line:** 0 votes → "아직 아무도 투표하지 않았어요"; else "참여 {N}명 · 최다 후보 {date}" (N = distinct nicknames, leader = max available_count entry's date).
  - **Share row:** 초대 링크 복사 (`/poll/{code}` URL via `Constants.expoConfig.extra.webUrl`) + 코드 공유 (`poll_code`), both via `Share.share`.
  - **Confirm:** 확정 → `@gorhom/bottom-sheet` sheet. range → `RangeConfirmList` (option list + per-option 가능 count); grid → `GridConfirmBlock` (best `contiguousBlock` window for 1/2/3-day run lengths). Pick → destructive `Alert.alert('이 날짜로 확정하면 투표가 마감돼요.', …)` → `확정하기` → `confirmPollDate` → `load()` (trip.start_date now set → card unmounts → normal plan renders).
  - **Realtime:** a `subscribePollChannel(id, …)` effect refetches the tally on `vote`/`presence` while the card shows; `removeChannel` cleanup. Mirrors the State C plan-progress effect.

## Verification

- `pnpm --filter @moajoa/ios test` → **13 suites / 87 tests GREEN** (realtime 11 incl. 5 new; plan 7 incl. 3 new management-card render/state tests).
- `pnpm --filter @moajoa/ios typecheck` → **exit 0**.
- All plan grep / required-string gates green:
  - onboarding: `/trip/create?dateless=1` present, 곧 제공 = 0, chevron-forward = 2.
  - create.tsx: TripCreateDatelessSchema + createDatelessTrip present, 날짜 투표 시작하기 present, NO mode picker (`setPollMode|범위형|그리드` = 0).
  - realtime.ts: `export function subscribePollChannel` = 1, pollChannelName in import + body, subscribeExtractProgress/subscribePlanProgress diff = unchanged.
  - plan.tsx: 날짜 투표 진행 중 = 1, getPollByTrip present, `from('date_polls')` = 0, setPollMode present, 범위형 + 그리드 both, canChangeMode/`N === 0` gate present, confirmPollDate present, subscribePollChannel present, 초대 링크 복사 = 1, `/poll/` present, confirm Alert copy = 1, isDateless gate present.
- Surgical-change audit: realtime.ts removed lines = 1 (import only); plan.tsx removed lines = 2 (both import-block replacements). No existing function bodies or States A–F touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] plan.test.tsx native-module imports break jest**
- **Found during:** Task 2
- **Issue:** plan.tsx now imports `@gorhom/bottom-sheet` at module top, which pulls in react-native-reanimated worklets jest can't initialize at import time (`TypeError: Cannot read properties of undefined (reading 'out')`). The SUT also imports the new `subscribePollChannel` from `@/lib/realtime` (mocked) + new `@moajoa/api` date-poll wrappers.
- **Fix:** Added a test-file-scoped `jest.mock('@gorhom/bottom-sheet', …)` (pass-through View stubs of `default` + `BottomSheetView`), added `subscribePollChannel` to the `@/lib/realtime` mock, and added the 4 date-poll wrappers to the `@moajoa/api` mock. The confirm-sheet interaction is exercised on device (Task 3 UAT) — the RNTL tests cover the render/state contract. Mirrors the 18-05 precedent (scoped native mocks; global jest-setup untouched, 12-suite baseline preserved).
- **Files modified:** apps/ios/__tests__/plan.test.tsx
- **Commit:** 3208da4

**2. [Rule 2 - Decision] 초대 링크 복사 / 코드 공유 use Share.share, not Clipboard**
- **Found during:** Task 2
- **Issue:** The plan/UI-SPEC copy is "초대 링크 복사" and the action suggests Clipboard, but `expo-clipboard` is not installed anywhere in the repo (verified: no root, no apps/ios node_modules).
- **Fix:** Used `Share.share` for both buttons (invite shares the `/poll/{code}` URL, 코드 공유 shares the `poll_code`) — the established `apps/ios/lib/share-board.ts` idiom is `Share.share` with NO Clipboard. The plan's own text permits this ("Use `Share.share({ message })` / Clipboard as the existing idiom does"). Avoids adding an unverifiable-without-sim native dep (same risk reasoning as the 18-05 drag-library decision).
- **Files modified:** apps/ios/app/trip/[id]/(tabs)/plan.tsx
- **Commit:** 3208da4

**3. [Tooling note] Package filter + test-file path**
- The plan's `pnpm --filter ios test` / `pnpm --filter ios typecheck` were run as `pnpm --filter @moajoa/ios …` (the package name is `@moajoa/ios`). The realtime test lives at `apps/ios/__tests__/realtime.test.ts` (the plan referenced `apps/ios/lib/realtime.test.ts`) — extended the existing file at its real location. No code impact.

## Known Stubs

None. No TODO/FIXME/placeholder/empty-data stubs in the modified files. The grid `GridConfirmBlock` contiguousBlock suggestions and the summary tally are explicitly advisory-only by design (T-19-02 — server is authoritative), not stubs.

## Pending: Device / Simulator UAT (Task 3 — checkpoint:human-verify)

Per the autonomous:false device-UAT directive (18-05 precedent), all code + automated tests are complete and committed; the drag/sheet/navigation/native-share interactions can only be verified on a sim/device (jest mocks native gesture/sheet). **A human must run `pnpm sim` and verify:**

1. Onboarding → tap the now-enabled **"아직 미정이에요"** card → lands on dateless create (no 여행 날짜 card, no mode picker, CTA reads **날짜 투표 시작하기**).
2. Pick a city → tap CTA → lands on the plan tab with the **날짜 투표 진행 중** management card (empty state "아직 아무도 투표하지 않았어요").
3. With 0 votes, tap the **범위형/그리드** toggle → mode flips (persisted via setPollMode); the confirm flow later reflects the chosen mode.
4. Tap **초대 링크 복사** / **코드 공유** → native share sheet opens with a `/poll/{code}` URL / the code.
5. (After Plan 04 web voting exists, or via psql-seeded votes) once a vote arrives → the mode toggle locks (disabled) and the summary shows "참여 {N}명 · 최다 후보 {date}" live.
6. Tap **확정** → confirm sheet (range options or grid block) → pick → destructive Alert "이 날짜로 확정하면 투표가 마감돼요." → 확정하기 → the management card disappears and the normal Phase 18 plan renders; the trip now has dates.

Routing the device UAT to the user via phase verification (HUMAN-UAT.md) rather than producing a false pass. Automated portion = done; device UAT = pending human verification.

## Handoff

- **19-04 (web anon island)** is parallel/disjoint — it builds the `/poll/[code]` voter surface against the same `@moajoa/api` anon RPCs + `pollChannelName` channel. No file overlap with this plan.
- The poll channel (`poll:{trip_id}`) is now subscribed host-side; the broadcast emitters (vote/comment) are the web island's / a future EF's responsibility — `subscribePollChannel` is ready to receive them.
- `confirmPollDate` sets `trip.start_date/end_date` + closes the poll; after that the trip behaves as a normal dated Phase 18 trip (the management card never re-renders).

## Self-Check: PASSED

- All modified files verified on disk (onboarding.tsx, create.tsx, plan.tsx, realtime.ts, realtime.test.ts, plan.test.tsx).
- Both per-task commits verified in git log (4957786, 3208da4).
