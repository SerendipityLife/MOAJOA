---
phase: 03-ios-save-flow
plan: 01
subsystem: infra
tags: [supabase, migration, jest, jest-expo, react-native-testing-library, packages-core, ios, app-group]

requires:
  - phase: 02-extraction-pipeline-hardening
    provides: extraction_costs table (0004), broadcast channel naming (extract:{link_id})
  - phase: 01-build-unblock-hygiene
    provides: apps/ios scaffold, pnpm hoist pattern, NativeWind 4.2 setup

provides:
  - migration 0005 drops NOT NULL on extraction_costs.link_id + partial index for link-keyed aggregations
  - APP_GROUP_ID constant ('group.com.serendipitylife.moajoa') in @moajoa/core
  - SharedDefaultsKeys map (PendingLinks, PendingLinksFailed, LastBoardId, AuthStatus) in @moajoa/core
  - extractChannelName(linkId) helper in @moajoa/core
  - jest-expo test infra in apps/ios (config + setup + mock + __tests__/.gitkeep)
  - docs/manual-uat-phase3.md real-device UAT checklist (5 scenarios + N1/N2 negatives)

affects: [03-02-share-extension-prebuild, 03-03-resolve-place-edge, 03-04-pending-drain, 03-05-broadcast-ui]

tech-stack:
  added:
    - jest@^29.7.0
    - jest-expo@~54.0.0
    - "@testing-library/react-native@^12.7.0"
    - "@testing-library/jest-native@^5.4.3"
    - "@types/jest@^29.5.12"
    - babel-jest@^29.7.0
  patterns:
    - "Append-only migration with idempotent DO block guard"
    - "Single-source App Group ID constant exported from @moajoa/core (no string drift across Swift + TS)"
    - "Partial index 'where col is not null' to preserve aggregation perf when widening nullability"
    - "Direct devDep declaration in apps/ios/package.json (pnpm hoist scope per Phase 1 D-02)"

key-files:
  created:
    - supabase/migrations/0005_extraction_costs_link_id_nullable.sql
    - apps/ios/jest.config.js
    - apps/ios/jest-setup.ts
    - apps/ios/__mocks__/shared-defaults.ts
    - apps/ios/__tests__/.gitkeep
    - docs/manual-uat-phase3.md
  modified:
    - packages/core/src/constants.ts
    - apps/ios/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Migration 0005 used DO block IF NOT NULL guard for idempotency (re-runnable)"
  - "Partial index `where link_id is not null` replaces full index — preserves link-keyed aggregation perf while allowing null rows for resolve-place manual searches"
  - "SharedDefaultsKeys exposed as object map rather than four loose constants — Swift side can mirror as enum"
  - "test:watch script added alongside test (--passWithNoTests on both) for ongoing TDD use in Plans 03-04/05"

patterns-established:
  - "Append-only migration with idempotent guard: future migrations should DO-block check before ALTER if re-runnability matters"
  - "@moajoa/core as source of truth for cross-binary constants (App Group ID consumed by Swift + TS)"
  - "jest-expo preset + workspace moduleNameMapper (no .js extension, .ts targets) per CLAUDE.md §4.5"

requirements-completed:
  - SAVE-04
  - SAVE-05

duration: ~6 min
completed: 2026-05-26
---

# Phase 3 Plan 01: Foundation Summary

**Migration 0005 unblocks resolve-place cost logging (NULL link_id) + Phase 3 shared constants in @moajoa/core (APP_GROUP_ID / SharedDefaultsKeys / extractChannelName) + jest-expo test infra in apps/ios + 5-scenario real-device UAT checklist.**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-05-26
- **Completed:** 2026-05-26
- **Tasks:** 2 / 2
- **Files modified:** 9 (6 created + 3 modified)

## Accomplishments

- **Migration 0005** (`supabase/migrations/0005_extraction_costs_link_id_nullable.sql`): drops NOT NULL on `extraction_costs.link_id` via idempotent DO block. Drops the full `extraction_costs_link_idx` and recreates as a partial index `where link_id is not null` — link-keyed aggregations stay fast, NULL rows (resolve-place manual searches) are excluded. Migrations 0001-0004 untouched (append-only per CLAUDE.md §4.3).
- **@moajoa/core constants extended**: appended at lines 107-139 of `packages/core/src/constants.ts`:
  - `APP_GROUP_ID = 'group.com.serendipitylife.moajoa'` (line 116) — single source of truth for app.config.ts + entitlements + Swift `UserDefaults(suiteName:)`. Prevents Pitfall 2 (silent nil on mismatch).
  - `SharedDefaultsKeys` object (line 122): `PendingLinks` / `PendingLinksFailed` / `LastBoardId` / `AuthStatus`.
  - `extractChannelName(linkId: string)` helper (line 137) — returns `'extract:' + linkId`, matches Phase 2 broadcast sender.
- **apps/ios jest infra bootstrapped**: jest 29.7 + jest-expo 54.0 + RNTL 12.7 + jest-native 5.4 + babel-jest installed as direct devDeps (pnpm hoist pattern). jest.config.js with jest-expo preset, `setupFiles: ['./jest-setup.ts']`, moduleNameMapper for `@/*` + `@moajoa/{core,api,ui-tokens}` (all .ts targets, no .js extension). jest-setup.ts loads @testing-library/jest-native matchers. `__mocks__/shared-defaults.ts` in-memory Map mock (contract for Plan 03-04 unit tests). `__tests__/.gitkeep` directory marker.
- **Manual UAT checklist** (`docs/manual-uat-phase3.md`, 101 lines): Prerequisites + 5 numbered scenarios (SAVE-01 login flow, SAVE-02 30s pin p90, SAVE-03 Share Sheet 1-tap, SAVE-04 offline drain on cold launch + foreground, SAVE-05 manual pin CRUD) + 2 negative scenarios (N1 retry > 3 → failed banner, N2 non-member RLS denial). Each scenario cites requirement ID, explicit pass/fail criteria, and links to D-* decisions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0005 + Phase 3 constants** — `e7c389c` (feat)
2. **Task 2: jest-expo infra + manual UAT checklist** — `ca46b4e` (test)

## Files Created/Modified

**Created:**
- `supabase/migrations/0005_extraction_costs_link_id_nullable.sql` — DO-block guarded ALTER + partial index.
- `apps/ios/jest.config.js` — jest-expo preset + setupFiles + workspace moduleNameMapper.
- `apps/ios/jest-setup.ts` — `import '@testing-library/jest-native/extend-expect';`
- `apps/ios/__mocks__/shared-defaults.ts` — `SharedDefaults` mock (get/set/remove/__clear) backed by in-memory `Map<string,string>`.
- `apps/ios/__tests__/.gitkeep` — directory marker; Plans 03-04 (pending.test.ts) + 03-05 (realtime.test.ts) will populate.
- `docs/manual-uat-phase3.md` — 5 SAVE-* scenarios + 2 negative scenarios.

**Modified:**
- `packages/core/src/constants.ts` — appended APP_GROUP_ID, SharedDefaultsKeys, extractChannelName. Existing exports (Limits, SourceKind, VoteKind, BoardVisibility, MemberRole, ExtractionStatus, EXTRACT_CHANNEL_PREFIX, PlaceSourceKind, ExtractionStep) all untouched.
- `apps/ios/package.json` — added 6 devDeps + `test` + `test:watch` scripts. Other scripts/deps untouched.
- `pnpm-lock.yaml` — regenerated by `pnpm add -D`.

## Decisions Made

- **Idempotent migration via DO block.** Rather than a plain `alter table … drop not null`, used `do $$ begin if exists (...) then alter ... end if; end $$` so re-running on an already-migrated DB is a no-op. Matches the safety-rail spirit of CLAUDE.md §4.3.
- **Partial index over plain index for nullable column.** When a column changes from NOT NULL to nullable, NULL rows would pollute a plain B-tree index. `where link_id is not null` keeps the index small and link-keyed aggregations (extraction_costs grouped by link_id) just as fast as before.
- **SharedDefaultsKeys exposed as `as const` object map.** Swift side can mirror as enum or string constants without re-typing four string literals; JS side gets autocomplete + type safety on `SharedDefaultsKeys.PendingLinks`.
- **moduleNameMapper points to `.ts` source files, not `.js`.** Per CLAUDE.md §4.5 (no `.js` extension on workspace imports) — jest resolves the workspace package straight to its TypeScript source, jest-expo's babel transform handles compilation. Avoids needing a build step in test runs.
- **N2 (RLS denial) test path documented as both manual + required SQL substitute.** Manual UAT covers the user-flow path; the SQL substitute (set_config jwt.claim.sub + INSERT expect 42501) lives in Plan 03-05 per 03-VALIDATION.md.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria from both tasks passed on first verify.

The one minor surface: `pnpm --filter <pkg> test --passWithNoTests` is interpreted by pnpm itself rather than forwarded to jest, but since `--passWithNoTests` is baked into the `test` script string, `pnpm --filter @moajoa/ios test` works correctly. Not a deviation — the plan's `test` script definition already includes the flag.

## Issues Encountered

- **pnpm peer warnings on install** (react-dom 19.2.6 wants react ^19.2.6; we pin react 19.1.0). These come from jest-expo's transitive react-dom dependency and don't affect jest execution. No action — left as is. (If they start surfacing in test failures, Plan 03-05 can add `pnpm.overrides` to align.)
- **Deprecated subdep warnings** (abab, domexception, glob v7, inflight, rimraf v3, sudo-prompt, uuid v7, whatwg-encoding) from jest-expo transitive deps. No action — these belong to upstream packages.

## Threat Flags

None — no new security-relevant surface introduced beyond what 03-PLAN.md's threat register already documents (T-03-01-01 mitigated by partial index; T-03-01-02 accepted; T-03-01-03 accepted).

## User Setup Required

None — no external service configuration required for this plan. Migration 0005 will be applied during the next `supabase db push` (Plan 03-03 or whenever the team chooses to push, since 0005 is currently a no-op until resolve-place INSERTs land).

## Next Phase Readiness

Foundation complete. Wave 2 (Plans 03-02, 03-03), Wave 3 (Plan 03-04), and Wave 4 (Plan 03-05) can all proceed in parallel where their file boundaries don't overlap:

- **Plan 03-02 (Share Extension prebuild)**: can import `APP_GROUP_ID` from `@moajoa/core` for `app.config.ts` plugin config + entitlements.
- **Plan 03-03 (resolve-place Edge Function)**: migration 0005 unblocks cost logging with `link_id: null`.
- **Plan 03-04 (pending drain + native module)**: `__mocks__/shared-defaults.ts` ready for unit-test substitute; `SharedDefaultsKeys` ready for both Swift mirror + TS bridge.
- **Plan 03-05 (UI integration)**: `extractChannelName()` helper ready for broadcast subscribe; jest infra ready for `realtime.test.ts`.

No blockers carried forward.

## Self-Check

Created files verified to exist:
- supabase/migrations/0005_extraction_costs_link_id_nullable.sql — FOUND
- apps/ios/jest.config.js — FOUND
- apps/ios/jest-setup.ts — FOUND
- apps/ios/__mocks__/shared-defaults.ts — FOUND
- apps/ios/__tests__/.gitkeep — FOUND
- docs/manual-uat-phase3.md — FOUND

Modified files contain expected additions:
- packages/core/src/constants.ts:116 — APP_GROUP_ID export present
- packages/core/src/constants.ts:122 — SharedDefaultsKeys export present
- packages/core/src/constants.ts:137 — extractChannelName export present
- apps/ios/package.json — `test` + `test:watch` scripts present, 6 jest devDeps present

Commits verified in git log:
- e7c389c (feat 03-01 migration + constants) — FOUND
- ca46b4e (test 03-01 jest infra + UAT doc) — FOUND

Automated gates passing:
- `pnpm --filter @moajoa/core typecheck` — exits 0
- `pnpm --filter @moajoa/ios test` (→ `jest --passWithNoTests`) — exits 0 with "No tests found, exiting with code 0"
- Migrations 0001-0004 diff — empty
- `grep "from '.*\.js'"` on new/modified files — no matches

## Self-Check: PASSED

---
*Phase: 03-ios-save-flow*
*Completed: 2026-05-26*
