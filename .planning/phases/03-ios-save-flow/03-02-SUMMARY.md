---
phase: 03-ios-save-flow
plan: 02
subsystem: ios
tags: [ios, share-extension, app-group, expo-share-intent, prebuild, eas]

requires:
  - phase: 03-ios-save-flow
    plan: 01
    provides: APP_GROUP_ID constant + SharedDefaultsKeys + extractChannelName in @moajoa/core

provides:
  - expo-share-intent@^5.1.1 config plugin entry in apps/ios/app.config.ts (SDK 54 compatible line)
  - ios.entitlements com.apple.security.application-groups = ['group.com.serendipitylife.moajoa']
  - extra.eas.build.experimental.ios.appExtensions ShareExtension target declaration
  - apps/ios/eas.json with development/preview/production build profiles
  - APP_GROUP_ID single-string constant pattern (declared once, referenced 6x) — Pitfall 2 guard

affects: [03-03-resolve-place-edge, 03-04-pending-drain, 03-05-broadcast-ui]

tech-stack:
  added:
    - "expo-share-intent@^5.1.1"
  patterns:
    - "Single-source App Group ID constant in app.config.ts (literal value duplicated from @moajoa/core APP_GROUP_ID, justified because Metro pre-evaluates app.config.ts before workspace resolution)"
    - "EAS appExtensions experimental block to attach App Group entitlement to Share Extension target"
    - "Config-plugin-driven Share Extension generation (CNG compliant — no manual Xcode patches)"

key-files:
  created:
    - apps/ios/eas.json
  modified:
    - apps/ios/app.config.ts
    - apps/ios/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Used expo-share-intent@^5.1.1 instead of plan-specified ^6.1.1 — npm peer dependency check revealed 6.x requires expo: ^55, while project pins expo: ~54.0.34. 5.1.1 is the latest SDK 54-compatible line and exposes the same config plugin shape (iosAppGroupIdentifier, iosShareExtensionName, iosActivationRules). RESEARCH.md §Standard Stack claim of '6.1.1 SDK 54 compat' was incorrect."
  - "App Group ID literal 'group.com.serendipitylife.moajoa' duplicated between packages/core/src/constants.ts and apps/ios/app.config.ts as a TypeScript string. Reason: app.config.ts is evaluated by Expo CLI / Metro before any workspace package resolution can happen — it cannot import @moajoa/core. The grep gate (literal appears exactly once in app.config.ts) protects against drift."
  - "Prebuild + pod install deferred to real-device UAT. Per /gsd-autonomous instruction, prebuild output and ShareExtension target generation will be verified during end-of-phase UAT. The config inputs (plugin entry + entitlements + EAS appExtensions) are fully verified by grep/diff acceptance criteria."
  - "Created new apps/ios/eas.json (did not exist before) — development profile uses developmentClient=true + simulator=false (real-device only, per CONTEXT.md A1 assumption about Share Extension reliability)."

requirements-completed:
  - SAVE-03
  - SAVE-04

verification:
  automated_acceptance:
    - "package.json has expo-share-intent@^5.1.1: PASS"
    - "app.config.ts declares APP_GROUP_ID const exactly 1x: PASS (grep -c returned 1)"
    - "APP_GROUP_ID referenced ≥4x in app.config.ts: PASS (count=6 — decl + entitlements + plugin + 2 in appExtensions block)"
    - "Literal 'group.com.serendipitylife.moajoa' appears exactly 1x in app.config.ts: PASS (grep -c returned 1)"
    - "Literal matches packages/core APP_GROUP_ID: PASS (diff empty)"
    - "iosShareExtensionName: 'MOAJOA 저장': PASS"
    - "NSExtensionActivationSupportsWebURLWithMaxCount: 1: PASS"
    - "appExtensions targetName=ShareExtension, bundleId=com.serendipitylife.moajoa.ShareExtension: PASS"
    - ".gitignore ignores ios/: PASS (line 'ios/' present)"
    - "eas.json contains 'development' profile: PASS"
    - "pnpm --filter @moajoa/ios typecheck exits 0: PASS"
  real_device_test_status: deferred

duration: ~5 min
completed: 2026-05-26
---

# Phase 3 Plan 02: iOS Share Extension Prebuild Summary

**expo-share-intent@^5.1.1 wired in via config plugin with App Group `group.com.serendipitylife.moajoa` synchronized across entitlements, plugin option, and EAS appExtensions block (3 references all through single `APP_GROUP_ID` constant — Pitfall 2 mismatch guard).**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-05-26
- **Completed:** 2026-05-26
- **Tasks:** 1 / 2 (Task 2 real-device verify deferred per /gsd-autonomous)
- **Files modified:** 4 (1 created + 3 modified)

## Accomplishments

- **expo-share-intent@^5.1.1 installed** as direct dep in `apps/ios/package.json` (pnpm hoist scope per Phase 1 D-02). 5.1.1 is the latest SDK 54-compatible line (`peerDependencies.expo: ^54`); 6.x requires SDK 55 and was rejected (deviation logged below).
- **`apps/ios/app.config.ts` rewritten** preserving every existing field and adding three new blocks:
  - Top-of-file `const APP_GROUP_ID = 'group.com.serendipitylife.moajoa';` — single source of truth for all three iOS-side references.
  - `ios.entitlements['com.apple.security.application-groups'] = [APP_GROUP_ID]` — main app entitlement.
  - `plugins[]` entry for `expo-share-intent` with `iosAppGroupIdentifier: APP_GROUP_ID`, `iosShareExtensionName: 'MOAJOA 저장'`, and `iosActivationRules` accepting Web URL / Web Page / Text (max 1 each per D-01 single-target design).
  - `extra.eas.build.experimental.ios.appExtensions[]` declaring the ShareExtension target with `bundleIdentifier: 'com.serendipitylife.moajoa.ShareExtension'` and the same App Group entitlement.
- **`apps/ios/eas.json` created** (did not exist) with `cli.appVersionSource: remote`, `build.development` profile (`developmentClient=true`, `distribution=internal`, `ios.simulator=false`), plus `preview` and `production` stubs.
- **`.gitignore` left untouched** — already contains `ios/`, `android/`, `.expo/`, `*.orig.*` from Phase 1 setup. No new ignore entries needed.

## Task Commits

1. **Task 1 — config plugin + entitlements + EAS appExtensions + dep install** — `56c61d8` (feat)
2. **Task 2 — real-device share-sheet smoke test** — DEFERRED (real device verification scheduled for end-of-phase UAT per /gsd-autonomous user request: "다 실행 후 검증은 나중에 하는 것")

## Files Created/Modified

**Created:**
- `apps/ios/eas.json` — EAS Build profiles (development/preview/production).

**Modified:**
- `apps/ios/app.config.ts` — extended with `APP_GROUP_ID` const + `ios.entitlements` + `expo-share-intent` plugin entry + `extra.eas.build.experimental.ios.appExtensions`. Existing fields (name, slug, version, scheme, ios.bundleIdentifier, ios.config.googleMapsApiKey, ios.infoPlist, expo-router/splash/font plugins, experiments.typedRoutes, extra.supabaseUrl/AnonKey/webUrl) preserved verbatim.
- `apps/ios/package.json` — added `"expo-share-intent": "^5.1.1"` to dependencies.
- `pnpm-lock.yaml` — regenerated by `pnpm --filter @moajoa/ios add`.

## Decisions Made

- **Version downgrade from PLAN-specified `^6.1.1` to `^5.1.1`.** RESEARCH.md and 03-02-PLAN.md both specified `expo-share-intent@^6.1.1` with the claim "SDK 54 compatible". Direct npm registry inspection contradicted this:
  ```
  npm view expo-share-intent@6.1.1 peerDependencies.expo  →  ^55
  npm view expo-share-intent@5.1.1 peerDependencies.expo  →  ^54
  ```
  Current project pins `expo: ~54.0.34`. Installing 6.x would surface a peer warning and risk runtime incompat. 5.1.1 exposes the same config plugin API surface used by the plan (`iosAppGroupIdentifier`, `iosShareExtensionName`, `iosActivationRules`) — the plugin shape is unchanged across the 5.x/6.x major bump. Tracked as deviation Rule 1 (auto-fix bug: planner relied on stale/incorrect RESEARCH claim).
- **Duplicate string literal in app.config.ts justified.** packages/core exports `APP_GROUP_ID = 'group.com.serendipitylife.moajoa' as const`, but app.config.ts cannot import from `@moajoa/core` — Expo CLI evaluates app.config.ts standalone before Metro/workspace resolution. The TypeScript const declaration in app.config.ts is the local SoT for the config; the grep acceptance criterion (`grep -c "'group.com.serendipitylife.moajoa'" apps/ios/app.config.ts` returns 1) protects against accidental string drift via copy-paste in the four entitlement/plugin/appExtensions blocks. Drift between the two files (app.config.ts vs constants.ts) is caught by the `diff` acceptance criterion (PASS).
- **Prebuild + pod install deferred.** Per /gsd-autonomous instruction and the additional_context guidance ("DO NOT actually run prebuild if it would fail in current environment. Instead, verify the config setup is correct via grep/file inspection."), all automatable acceptance criteria were verified via grep + typecheck. Prebuild artifacts (apps/ios/ios/ShareExtension/, apps/ios/ios/MOAJOA.entitlements, Podfile.lock containing expo-share-intent) will be generated and verified during end-of-phase UAT. The config inputs are deterministic — prebuild's job is purely mechanical given a correct app.config.ts, so deferring the execution does not increase risk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan-specified package version was incompatible with current Expo SDK**
- **Found during:** Task 1, npm view verification step
- **Issue:** PLAN.md and RESEARCH.md specified `expo-share-intent@^6.1.1` with claim of "SDK 54 support", but `npm view expo-share-intent@6.1.1 peerDependencies` returned `expo: ^55`. Project currently runs `expo: ~54.0.34`.
- **Fix:** Installed `expo-share-intent@^5.1.1` instead — latest in the SDK 54-compatible line (peerDependencies.expo: ^54). Same plugin API shape (iosAppGroupIdentifier, iosShareExtensionName, iosActivationRules), so plan's config block needed zero adjustment.
- **Files modified:** apps/ios/package.json (version pin), pnpm-lock.yaml (resolved entries)
- **Commit:** 56c61d8
- **Future implication:** When the project upgrades to Expo SDK 55 (Phase 6+ ROADMAP), bumping expo-share-intent to 6.x will be a coordinated migration. The plugin entry in app.config.ts should not need changes.

### Auth Gates

None — no external authentication required during automated work. Apple Developer Portal App Group registration (per plan frontmatter `user_setup`) is deferred to real-device UAT.

## Issues Encountered

- **pnpm peer warnings on install** (`react-dom 19.2.6 unmet peer react@^19.2.6: found 19.1.0`, `@types/react-dom 19.2.3 unmet peer @types/react@^19.2.0: found 19.1.17`). Pre-existing warnings carried over from Plan 03-01 jest-expo install; unrelated to expo-share-intent. No action.
- **No prebuild execution.** Deferred per /gsd-autonomous directive. ShareExtension target generation, Podfile.lock entry, and `apps/ios/ios/MOAJOA.entitlements` will be produced on the next run of `pnpm --filter @moajoa/ios prebuild --clean && cd apps/ios/ios && pod install` (which the user will run as part of end-of-phase real-device verification).

## Threat Flags

None new beyond what 03-PLAN.md threat register already documents:
- T-03-02-01 (URL tampering): mitigation lives in Plan 03-04 (Zod LinkAddSchema before INSERT) — not in scope for this plan.
- T-03-02-02 (App Group spoofing): mitigated by Apple sandbox + team-scoped App Groups — config inputs in app.config.ts use the correct team-scoped identifier.
- T-03-02-03 (info disclosure): accepted (single-team app), no PII written here.
- T-03-02-04 (DoS via spam): mitigation in Plan 03-04 (retry > 3 cap), not here.

## User Setup Required (Deferred to Real-Device UAT)

Per plan frontmatter `user_setup` block, these Apple Developer Portal steps may be needed (EAS Build typically automates them when credentials are configured):

1. **Register App Group** `group.com.serendipitylife.moajoa` at developer.apple.com → Certificates, IDs & Profiles → Identifiers → App Groups (if EAS doesn't auto-create).
2. **Verify ShareExtension bundle ID** `com.serendipitylife.moajoa.ShareExtension` is registered and has App Groups capability enabled.

These steps are part of the deferred Task 2 real-device UAT, not blockers for the config-only work completed here.

## Next Phase Readiness

Wave 2 (this plan) config foundation complete. Subsequent plans can proceed:

- **Plan 03-03 (resolve-place Edge Function)**: independent of this plan's iOS changes; only depends on migration 0005 (already in 03-01).
- **Plan 03-04 (pending drain + native module)**: depends on this plan's App Group entitlement being correct. The literal string match check passed, so Plan 03-04's Swift `UserDefaults(suiteName: APP_GROUP_ID)` will resolve to the same suite the Share Extension writes to. Native module bridge can be built against the same `@moajoa/core` `APP_GROUP_ID` export.
- **Plan 03-05 (UI integration)**: independent of iOS Share Extension specifics.

**Deferred to end-of-phase UAT (per /gsd-autonomous):**
- Run `pnpm --filter @moajoa/ios prebuild --clean --platform ios`
- Run `cd apps/ios/ios && pod install` (apply LC_ALL/LANG fix from 01-02-SUMMARY.md if locale error surfaces)
- Verify `apps/ios/ios/ShareExtension/Info.plist` exists
- Verify `apps/ios/ios/MOAJOA.entitlements` contains `group.com.serendipitylife.moajoa`
- Verify `apps/ios/ios/Podfile.lock` mentions `ExpoShareIntent` or `expo-share-intent`
- Real-device share-sheet smoke test (Safari → MOAJOA 저장 appears → tap dismisses within 1.5s)

## Self-Check

Created files verified to exist:
- apps/ios/eas.json — FOUND

Modified files contain expected additions:
- apps/ios/app.config.ts — APP_GROUP_ID const declared at line 9, referenced 6x in entitlements/plugin/appExtensions — VERIFIED via grep
- apps/ios/package.json — `"expo-share-intent": "^5.1.1"` present in dependencies — VERIFIED
- pnpm-lock.yaml — `expo-share-intent@5.1.1` resolved package present in `.pnpm` directory — VERIFIED via `find node_modules`

Commits verified in git log:
- 56c61d8 (feat 03-02 config plugin + entitlements + EAS appExtensions) — FOUND

Automated gates passing:
- `pnpm --filter @moajoa/ios typecheck` — exits 0 (PASS)
- Single literal `'group.com.serendipitylife.moajoa'` in app.config.ts — grep -c returned 1 (PASS)
- APP_GROUP_ID const declaration exactly 1x — grep -c returned 1 (PASS)
- APP_GROUP_ID references ≥4x — grep -c returned 6 (PASS)
- Literal matches packages/core/src/constants.ts — diff empty (PASS)
- `.gitignore` ignores `ios/` — line present (PASS)
- `eas.json` contains development profile — `grep -q '"development"'` returns 0 (PASS)

## Self-Check: PASSED

---
*Phase: 03-ios-save-flow*
*Completed: 2026-05-26*
