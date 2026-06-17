---
phase: 16-ios-share-ingestion
plan: 01
subsystem: ios-share-ingestion
tags: [ios, expo-router, expo-share-intent, deep-link, routing, tdd]
requires: []
provides:
  - "decideShareRoute pure decision fn (D-01/D-02) + ShareRoute type"
  - "redirectSystemPath deep-link interceptor (/share-handler redirect target)"
affects:
  - "16-02 (mounted share-handler screen consumes decideShareRoute + the /share-handler route)"
tech-stack:
  added: []
  patterns:
    - "pure side-effect-free decision module (mirrors lib/pending.ts purity, zero imports)"
    - "named-export expo-router escape hatch (redirectSystemPath, not a default React component)"
    - "App Group key derived via getShareExtensionKey() — never the moajoaShareKey literal"
key-files:
  created:
    - apps/ios/lib/share-routing.ts
    - apps/ios/app/+native-intent.tsx
    - apps/ios/__tests__/share-routing.test.ts
    - apps/ios/__tests__/native-intent.test.ts
  modified: []
decisions:
  - "RED/GREEN split into separate test()/feat() commits per task to preserve TDD gate sequence in git history"
  - "jest must run with --watchman=false in this environment — watchman crawl of the monorepo hangs jest bootstrap at 0% CPU indefinitely"
metrics:
  duration: "~10 min active work (~43 min wall incl. jest/watchman infra debugging)"
  completed: "2026-06-17"
  tasks: 2
  files: 4
  tests: "11 (7 share-routing + 4 native-intent); full iOS suite 54/54 green"
---

# Phase 16 Plan 01: Share Ingestion Wave 0 Foundation Summary

Wave 0 testable seams for Phase 16 share ingestion: the pure `decideShareRoute` decision function (D-01/D-02) and the redirect-only `redirectSystemPath` deep-link interceptor — each shipped failing-first (TDD) with a green Jest suite. No auth/Supabase/native context touched; both pieces are fully unit-testable in-process and unblock the mounted handler (Plan 16-02) by defining the `/share-handler` redirect target and the `decideShareRoute` contract it consumes.

## What Was Built

### Task 1 — `apps/ios/lib/share-routing.ts` (pure decision fn)
- `ShareRoute` union: `{ kind: 'linger' } | { kind: 'auto'; boardId } | { kind: 'picker' }`.
- `decideShareRoute(authed, boardCount, firstBoardId)`:
  - `!authed || boardCount === 0` → `linger` (D-02).
  - `boardCount === 1 && firstBoardId` → `auto` (D-01/D-03).
  - else → `picker` (D-01/D-04), including the defensive 1-board-with-null-id case (never emits `auto` with an undefined board).
- Zero imports, side-effect-free. Verified: `grep -c import == 0`.
- Test: `__tests__/share-routing.test.ts` — 7-row table over authed × {0, 1, 2+} boards. RED (module missing) → GREEN 7/7.

### Task 2 — `apps/ios/app/+native-intent.tsx` (redirect-only interceptor)
- Named export `redirectSystemPath({ path, initial })` (expo-router escape hatch — not a default component).
- Detects the share deep link via ``path.includes(`dataUrl=${getShareExtensionKey()}`)`` → returns `/share-handler?dataUrl=<encodeURIComponent(path)>`; passes everything else through unchanged; `try/catch` fallback returns `'/'`.
- No `moajoaShareKey` literal (derived via `getShareExtensionKey()`); no Supabase/auth/board-query calls (Pitfall 1 — runs outside app context).
- Test: `__tests__/native-intent.test.ts` — 4 rows (redirect / passthrough app-path / passthrough no-key / throw→'/'), `getShareExtensionKey` mocked. RED (module missing) → GREEN 4/4.

## Verification

- `share-routing` suite: 7/7 green.
- `native-intent` suite: 4/4 green.
- Full iOS Jest suite: **11 suites / 54 tests passing**, zero regressions (was 38 in earlier phases; the +16 over 38 includes these 11 plus other intervening suites).
- `tsc --noEmit`: exit 0 (strict TS, no `.js`-extension workspace imports per CLAUDE.md §4.5).
- All acceptance grep gates pass (zero imports in share-routing; no `moajoaShareKey` literal; `getShareExtensionKey` present; zero app-context calls; `/share-handler` present).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jest hangs indefinitely under watchman**
- **Found during:** Task 1 RED run (first test execution this session).
- **Issue:** `jest` (jest-expo preset) hung at 0% CPU / ~0.3s CPU time for minutes during bootstrap — never reaching the transform/worker phase. Root cause: watchman crawling the large monorepo (`.pnpm` tree) blocks jest's Haste-map step. Watchman is installed (`/opt/homebrew/bin/watchman`, 2026.06.08) and responsive, but the crawl stalls jest.
- **Fix:** Run jest with `--watchman=false` (node crawler). Tests then complete in <2s. This is a runner-invocation workaround only — no config/source change was committed (the plan's documented command `pnpm --filter @moajoa/ios test -- <name>` still works once watchman is bypassed). Documented as a decision for future sessions.
- **Files modified:** none (invocation-only).
- **Commit:** n/a.

No source-level deviations. The two files were implemented verbatim from the plan's RESEARCH §Pattern 1 / §Pattern 3 contracts.

## TDD Gate Compliance

Both tasks followed RED → GREEN with separate commits:
- Task 1: `test(16-01)` d2b782e (RED) → `feat(16-01)` 38a2739 (GREEN).
- Task 2: `test(16-01)` 30773de (RED) → `feat(16-01)` 5f62820 (GREEN).
Each RED commit was verified to fail with `Could not locate module` (module-not-yet-created), confirming the test exercised the missing contract before implementation.

## Known Stubs

None. Both artifacts are complete, side-effect-free units. The `/share-handler` route they redirect to is intentionally created in Plan 16-02 (declared in `key_links`); this is a planned forward dependency, not a stub.

## Threat Flags

None beyond the plan's `<threat_model>`. T-16-01/02/03 are all mitigated by the shipped code: `redirectSystemPath` gates on the derived key, wraps in try/catch with a fixed `/` fallback, only ever emits the fixed `/share-handler` route (attacker path is URL-encoded as an opaque query param), and never hardcodes the App Group key.

## Self-Check: PASSED

All 4 created source/test files and the SUMMARY exist on disk; all 4 task commits (d2b782e, 38a2739, 30773de, 5f62820) found in git history.
