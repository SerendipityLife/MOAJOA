---
phase: 16-ios-share-ingestion
plan: 02
subsystem: ios-share-ingestion
tags: [ios, expo-share-intent, share-handler, expo-router, zod, tdd]
requires:
  - "16-01: decideShareRoute + ShareRoute + /share-handler redirect target"
provides:
  - "extractSharedUrl http(s) Zod guard (V5) co-located in lib/share-routing.ts"
  - "/share-handler mounted screen: read payload → validate → route (linger/auto/picker)"
  - "handleSharedUrl exported decision seam (auth-aware, unit-testable)"
  - "_layout wrapped in ShareIntentProvider (reader-only payload source)"
affects:
  - "16-03 (board-picker-sheet consumes the picker branch + the shared url in state)"
tech-stack:
  added: []
  patterns:
    - "exported async decision seam (handleSharedUrl) so a React-effect screen unit-tests without RNTL render"
    - "expo-share-intent provider used strictly as a payload reader (NOT B안 auto-navigation)"
    - "clear-after-read dedup: resetShareIntent() in effect finally + handled useRef within mount"
    - "Zod http(s) guard on untrusted external input before any enqueue/add (V5, CLAUDE.md §4.5)"
key-files:
  created:
    - apps/ios/app/share-handler.tsx
    - apps/ios/__tests__/share-payload.test.ts
    - apps/ios/__tests__/share-handler.test.ts
  modified:
    - apps/ios/lib/share-routing.ts
    - apps/ios/app/_layout.tsx
decisions:
  - "Auto-case uses direct addLink + startExtraction (D-03 visible pin-forming), NOT drain's fire-and-forget triggerExtraction (RESEARCH OQ#1 resolved)"
  - "Async decision body extracted into exported handleSharedUrl(rawUrl) — the screen effect is a thin caller (plan option b: avoid RNTL flakiness)"
  - "V5 guard runs first in handleSharedUrl so non-http(s) input never even calls getSession"
  - "ShareIntentProvider wraps the render tree as an ancestor of <Stack>; drain effects untouched (surgical)"
metrics:
  duration: "~12 min"
  completed: "2026-06-17"
  tasks: 2
  files: 5
  tests: "15 new (9 share-payload + 6 share-handler); full iOS suite 69/69 green"
---

# Phase 16 Plan 02: Mounted Share Handler Summary

The core of Phase 16: a mounted `/share-handler` screen that closes the native-capture ↔ drain-queue bridge. It reads the App Group share payload via the expo-share-intent provider (reader-only), Zod-validates the inbound URL as http(s) (V5), decides the route with `decideShareRoute` (Plan 16-01), then either enqueues-and-lingers (D-02, reusing `enqueuePendingLink` AS-IS) or auto-adds + `startExtraction` + navigates to the board so the pin visibly forms (D-03). 2+ boards hand off to the picker (sheet built in Plan 16-03). All work shipped failing-first (TDD) with green Jest suites and zero regressions.

## What Was Built

### Task 1 — `extractSharedUrl` http(s) guard (`apps/ios/lib/share-routing.ts`)
- Added `extractSharedUrl(raw: string | null | undefined): string | null` co-located with `decideShareRoute` (both pure, no React/native).
- Zod `HttpUrlSchema` = `z.string().trim().url().refine(http(s) protocol)`. Trims + validates; drops plain text, `ftp://`, `javascript:`, null, undefined → `null`.
- `decideShareRoute` stays pure; `share-routing.ts` now imports `zod` (expected — the 16-01 "zero imports" gate applied to the 16-01 deliverable only).
- Test `__tests__/share-payload.test.ts`: 8 V5 guard rows + 1 `parseShareIntent` fixture row proving `shareIntent.webUrl` is the field the handler reads from a `weburls` payload. RED (`extractSharedUrl is not a function`) → GREEN 9/9.

### Task 2 — mounted handler + provider wrap (`apps/ios/app/share-handler.tsx`, `_layout.tsx`)
- `share-handler.tsx`: default-exported `ShareHandler` screen reads `useShareIntentContext()` (reader-only, documented), and an exported `handleSharedUrl(rawUrl)` decision seam:
  - V5-guards the URL (returns early — no getSession — on non-http(s)).
  - `await supabase.auth.getSession()` before deciding (Pitfall 4: launch-from-share races auth bootstrap).
  - `linger` → `enqueuePendingLink(url, null)` AS-IS + `router.replace('/')` (D-02).
  - `auto` → `addLink(supabase, { board_id, url })` → `SharedDefaults.set(LastBoardId)` → `detectSourceKind` gate → `startExtraction({ linkId, boardId, boardTitle: null })` → `router.replace('/boards/<id>')` (D-03 visible pin).
  - `picker` → no-op handoff (Plan 16-03).
  - Effect's `finally` calls `resetShareIntent()`; a `handled` useRef dedups within the mount (Pitfall 2 / clear-after-read).
- `_layout.tsx`: import `ShareIntentProvider`, wrap the existing `<GestureHandlerRootView>` render tree. Provider documented as reader-only (NOT B안). Drain effects (cold-launch + AppState 'active'), `runDrain`, `inFlight`, and the `ready` gate are untouched (verified by diff).
- Test `__tests__/share-handler.test.ts`: 6 rows over `handleSharedUrl` with the pending.test.ts mock topology (mock `@moajoa/api`, `@/lib/extraction-store`, `@/lib/pending`, `expo-router`, `@/lib/shared-defaults`, `supabase.auth.getSession`). Covers not-authed, 0-board, 1-board auto, 1-board manual (no extract), 2-board picker, non-http(s) drop. RED (`Could not locate module @/app/share-handler`) → GREEN 6/6.

## Verification

- `share-payload`: 9/9 green. `share-handler`: 6/6 green.
- Full iOS Jest suite: **13 suites / 69 tests passing** (was 54 at end of 16-01; +9 share-payload +6 share-handler). Zero regressions.
- `tsc --noEmit`: exit 0 (strict; no `.js`-extension workspace imports per CLAUDE.md §4.5).
- All acceptance greps pass: `useShareIntentContext`(2), `decideShareRoute`(3), `extractSharedUrl`(2), `startExtraction`(4), `resetShareIntent`(3), `triggerExtraction`==0, `ShareIntentProvider` in `_layout`(4).
- `_layout.tsx` diff is provider-wrap-only — no `drainPendingLinks`/`runDrain`/`AppState`/`inFlight` line touched.

## Deviations from Plan

None — plan executed as written. The only invocation note (not a source change): jest is run with `--watchman=false` per the known pitfall (watchman crawl hangs jest bootstrap); no config/source change committed for it.

## TDD Gate Compliance

Both tasks followed RED → GREEN with separate commits:
- Task 1: `test(16-02)` 5246913 (RED) → `feat(16-02)` eeb2123 (GREEN).
- Task 2: `test(16-02)` 39fc6d2 (RED) → `feat(16-02)` 8ef679b (GREEN).
Each RED commit verified to fail (`extractSharedUrl is not a function` / `Could not locate module @/app/share-handler`), confirming the test exercised the missing contract before implementation.

## Known Stubs

The `picker` branch in `handleSharedUrl` is an intentional no-op handoff for 16-02 — the board-picker sheet that consumes it is built in Plan 16-03 (declared in `affects`). Documented in code with a TODO marker pointing to 16-03. This is a planned forward dependency, not an unintended stub: the 2+ board case is tested to NOT auto-add or enqueue, which is the correct 16-02 behavior.

## Threat Flags

None beyond the plan's `<threat_model>`. T-16-04 (untrusted webUrl) mitigated by `extractSharedUrl` Zod http(s) guard, tested explicitly (ftp/javascript/plain-text → null). T-16-05 (replay) mitigated by `resetShareIntent()` after every fire + `handled` ref. T-16-06 (addLink access control) goes through `@moajoa/api addLink` → RLS, anon key only, boards sourced from `listMyBoards` (RLS-scoped). T-16-07 (auth race) mitigated by `await getSession()` before `decideShareRoute`.

## Self-Check: PASSED

All 5 created/modified files exist on disk; all 4 task commits (5246913, eeb2123, 39fc6d2, 8ef679b) found in git history.
