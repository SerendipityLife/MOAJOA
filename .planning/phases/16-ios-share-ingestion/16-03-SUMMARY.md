---
phase: 16-ios-share-ingestion
plan: 03
subsystem: ios-share-ingestion
tags: [ios, board-picker, bottom-sheet, share-handler, expo-router, tdd]
requires:
  - "16-02: handleSharedUrl decision seam with a picker no-op handoff + the validated url in handler state"
  - "@moajoa/api listMyBoardsWithPreview (board rows with place_count) + addLink"
provides:
  - "BoardPickerSheet (D-04 in-app board picker — keep-mounted, mirrors pin-sheet)"
  - "addAndNavigate(boardId, url) — single add+extract+navigate path shared by auto branch + picker select"
  - "share-handler picker branch wired: holds validated url in pickerUrl state, mounts the sheet, onSelect → addAndNavigate"
affects:
  - "Phase 16 device UAT (Task 2) — the manual-only gesture/share-sheet verification gate"
tech-stack:
  added: []
  patterns:
    - "shared add+extract+navigate helper (addAndNavigate) so auto (1 board) and picker (2+) cannot drift (Karpathy §3.2)"
    - "keep-mounted bottom-sheet (Pitfall 6): never unmount on close — `shown` state + ref.close(), so the FIRST open is not a no-op"
    - "test stubs the sheet module (jest.mock board-picker-sheet) to sever the @gorhom/bottom-sheet → reanimated import chain (wiring-only suite)"
    - "optional onPicker callback bridges the pure async handler to React screen state without coupling the handler to a component"
key-files:
  created:
    - apps/ios/components/boards/board-picker-sheet.tsx
  modified:
    - apps/ios/app/share-handler.tsx
    - apps/ios/__tests__/share-handler.test.ts
decisions:
  - "Picker branch resets share intent after opening the sheet — the validated url is now held in `pickerUrl` component state, so a dismissed-without-select share is intentionally not persisted (T-16-10 accept; single-URL scope)"
  - "addAndNavigate extracted as an exported testable helper; the 16-02 auto branch was refactored to call it so the two paths are one code path (no drift)"
  - "Wiring test stubs BoardPickerSheet to keep the suite native-free; the sheet gesture is device UAT (Task 2), not a unit test (RNTL can't drive @gorhom gestures reliably)"
metrics:
  duration: "~3 min"
  completed: "2026-06-17"
  tasks: 2
  tasks_complete: 1
  tasks_pending: 1
  files: 3
  tests: "5 new picker-select wiring rows (share-handler 6→11); full iOS suite 74/74 green (was 69)"
---

# Phase 16 Plan 03: Board-Picker Sheet + Picker Branch Summary

Closes the D-04 multi-board path: an in-app bottom-sheet picker ("어느 보드에 담을까요?") that appears when the user has 2+ boards. On select it runs the SAME `addAndNavigate` as the 1-board auto path (D-03), so the user still sees the pin forming. The sheet mirrors `pin-sheet.tsx` verbatim (keep-mounted `shown` state, inline `backgroundStyle`, inner `<View className>`) and no native/SwiftUI selection UI is added (D-06). Task 1 (code + unit tests) is complete and committed; Task 2 is a blocking device/sim UAT gate that requires a human to physically share a link and observe the sheet gesture + navigation — recorded below as PENDING.

## What Was Built (Task 1 — COMPLETE)

### `apps/ios/components/boards/board-picker-sheet.tsx` (created)
- `BoardPickerSheet({ url, onSelect, onClose })`. A non-null `url` prop drives open (`snapToIndex(1)`); null closes.
- Keep-mounted `shown`-state pattern copied from `pin-sheet.tsx:28-47` (Pitfall 6): the sheet never unmounts — unmounting drops the ref's measured layout, making the FIRST `snapToIndex` a no-op (sheet would only open on the second share).
- On open, loads rows via `listMyBoardsWithPreview(supabase)`; renders each board as a `Pressable` showing `title` + `{place_count}개 장소`. Row press → `onSelect(board.id)`.
- NativeWind gotcha honored (pin-sheet.tsx:5-8,148-160): `BottomSheetView` gets inline `backgroundStyle`; all visible content lives in an inner `<View className="px-6 pt-2 pb-6 bg-white">`. No `className` on `BottomSheetView` (verified by grep — line 58 is bare).

### `apps/ios/app/share-handler.tsx` (modified)
- Extracted `export async function addAndNavigate(boardId, url)` — `addLink` → `SharedDefaults.set(LastBoardId)` → `detectSourceKind` gate → `startExtraction` → `router.replace('/boards/<id>')`. This is the SINGLE source of the add+extract+navigate behavior.
- Refactored the 16-02 `auto` branch to call `addAndNavigate(route.boardId, url)` so auto + picker cannot drift (Karpathy §3.2).
- Picker branch: `handleSharedUrl` now takes an optional `onPicker?(url)` callback; on `route.kind === 'picker'` it calls `onPicker?.(url)` (no add/linger). The screen passes `setPickerUrl`, holding the validated url in state.
- `ShareHandler` screen: added `pickerUrl` state, `onPickBoard(boardId)` → `addAndNavigate(boardId, pickerUrl)` then `setPickerUrl(null)`, and renders `<BoardPickerSheet url={pickerUrl} onSelect={onPickBoard} onClose={() => setPickerUrl(null)} />` at the screen root (stays mounted — Pitfall 6).

### `apps/ios/__tests__/share-handler.test.ts` (modified — picker-select wiring)
- Added 5 rows targeting `addAndNavigate` directly: `addLink({board_id, url})` once, `SharedDefaults.set(LastBoardId, 'b2')`, `startExtraction` for youtube, NO `startExtraction` for manual, `router.replace('/boards/b2')`.
- Added `listMyBoardsWithPreview` to the `@moajoa/api` mock and a `jest.mock('@/components/boards/board-picker-sheet', () => ({ BoardPickerSheet: () => null }))` stub — severs the `@gorhom/bottom-sheet → react-native-reanimated` import chain (reanimated does not load under jest). Wiring-only suite; the gesture is Task 2 device UAT.

## Verification

- `pnpm test -- --watchman=false share-handler`: **11/11 green** (6 existing branch rows + 5 new picker-select wiring rows).
- Full iOS Jest suite: **13 suites / 74 tests passing** (was 69 at end of 16-02; +5 picker-select wiring). Zero regressions.
- `pnpm typecheck` (tsc --noEmit, strict): exit 0. No `.js`-extension workspace imports (CLAUDE.md §4.5).
- Acceptance greps all pass: board-picker-sheet has `BottomSheet`(9)/`listMyBoardsWithPreview`(2)/`snapToIndex`(2), zero `return null` (keep-mounted), `className=`(6) only on inner `<View>`/Text/Pressable; share-handler has `BoardPickerSheet`(5)/`setPickerUrl`(4)/`addAndNavigate`(4 ≥2)/`export async function addAndNavigate`(1).

## Deviations from Plan

**[Rule 3 - Blocking issue] Stubbed BoardPickerSheet module in the wiring test.**
- **Found during:** Task 1 GREEN — importing `BoardPickerSheet` into `share-handler.tsx` made `share-handler.test.ts` transitively import `@gorhom/bottom-sheet` → `react-native-reanimated`, which fails to initialize under jest (no existing test imports a bottom-sheet component, so no mock existed).
- **Fix:** Added `jest.mock('@/components/boards/board-picker-sheet', () => ({ BoardPickerSheet: () => null }))` to the test. This is correct scope — the suite tests the add+extract+navigate WIRING (`addAndNavigate`/`handleSharedUrl`), not the sheet render; the sheet gesture is Task 2 device UAT. Test-topology change only — no jest config or source change committed (the known-pitfall `--watchman=false` remains invocation-only).
- **Files modified:** `apps/ios/__tests__/share-handler.test.ts`
- **Commit:** a82dffa

## Pending: Device UAT (Task 2 — `checkpoint:human-verify` gate="blocking")

Task 2 is a blocking human-verify gate. It requires a human to build to a device/sim, physically share a link, and observe the sheet gesture, auto-navigate, linger, and dedup behaviors. RNTL cannot reliably exercise `@gorhom/bottom-sheet` gestures or third-party share sheets, so this is manual-only per 16-VALIDATION.md. **This executor cannot perform it and has NOT fabricated results.**

> Prereq: build to a device/sim. Simulator can exercise the in-app picker once a payload is present, but the REAL share-sheet (YouTube → 저장 by MOAJOA) needs an EAS dev build on device (Phase 13 gate; simulator can't reliably exercise third-party share sheets).

**Scenario 1 — 2+ boards → picker (D-04):** Ensure the logged-in account has 2+ boards. Share a YouTube link into MOAJOA (device: YouTube app → Share → 저장 by MOAJOA; sim: trigger the deep link). Expect: app opens, the in-app bottom-sheet picker appears on the FIRST open (not the second — Pitfall 6 regression check) listing boards with place counts. Pick a board → link is added, you navigate to that board, and the pin/step-indicator forms (D-03 visible progress).
- Result: ___________

**Scenario 2 — 1 board → auto (D-01/D-03):** With exactly 1 board, share a link → no picker; app navigates straight to the board and the pin forms.
- Result: ___________

**Scenario 3 — Logged-out / 0 boards → linger (D-02):** Logged out (or 0 boards), share a link → nothing is added; after logging in and ensuring ≥1 board, the next drain (cold launch or foreground) processes the lingering link.
- Result: ___________

**Scenario 4 — No duplicate (dedup):** After a successful share+handle, background and foreground the app → the same link does NOT re-add (resetShareIntent cleared the payload).
- Result: ___________

**Resume signal:** Type "approved" if all four scenarios pass, or describe which scenario failed and the observed behavior.

## TDD Gate Compliance

Task 1 followed RED → GREEN with separate commits:
- RED: `test(16-03)` 044cb1b — 5 `addAndNavigate` wiring rows failed with `addAndNavigate is not a function` (existing 6 branch rows stayed green), confirming the test exercised the missing contract before implementation.
- GREEN: `feat(16-03)` a82dffa — sheet + wiring implemented; 11/11 green.

## Threat Flags

None beyond the plan's `<threat_model>`. T-16-08 (url reaching addAndNavigate) mitigated — the url was `extractSharedUrl`-validated in the 16-02 handler before the picker branch; the picker only forwards the held value, never re-introduces raw payload. T-16-09 (board rows access control) mitigated — rows come from `listMyBoardsWithPreview` (RLS-scoped) and `addLink` enforces `can_edit_board`; anon key only, no Edge change (D-06). T-16-10 (dismissed-without-select replay) accepted — url held in component state, payload cleared after open; a dismissed share is intentionally not persisted.

## Self-Check: PASSED (code + unit tests); Device UAT PENDING (human gate)

- `apps/ios/components/boards/board-picker-sheet.tsx`: FOUND on disk.
- `apps/ios/app/share-handler.tsx` + `apps/ios/__tests__/share-handler.test.ts`: modified, FOUND.
- Commits 044cb1b (RED) + a82dffa (GREEN): FOUND in git history.
- Full iOS suite 74/74 green; typecheck exit 0.
- Task 2 device UAT is a blocking human-verify gate — recorded PENDING with the four verbatim scenarios above. This is NOT a failure; it is a human gate the executor cannot perform.
