---
phase: 01-build-unblock-hygiene
plan: 01
subsystem: build-infra + brand-assets
tags: [pnpm, nativewind, sharp, pretendard, brand]
requires: []
provides:
  - apps/ios/.npmrc (hoist scope)
  - packages/ui-tokens/src/brand/{icon,wordmark}.svg (SVG SOT)
  - packages/ui-tokens/scripts/export-assets.mjs (sharp pipeline)
  - apps/ios/assets/{icon,adaptive-icon,splash}.png
  - apps/ios/assets/fonts/Pretendard-*.otf x4
  - apps/web/{app/favicon.ico, public/apple-touch-icon.png, public/og-default.png}
  - apps/web/public/fonts/Pretendard-*.otf x4
  - apps/web/assets/Pretendard-Bold.ttf (Phase 4 OG consumer)
affects: [02-PLAN (iOS build), 03-PLAN (app.config.ts), 05-PLAN (web font-local), Phase 4 (OG)]
tech-stack:
  added: [sharp ^0.34.5, pretendard ^1.3.9, react-native-worklets ^0.8.3]
  patterns: [createRequire for cross-pnpm-layout resolution, sharp fixed PNG opts for idempotency]
key-files:
  created:
    - apps/ios/.npmrc
    - packages/ui-tokens/src/brand/icon.svg
    - packages/ui-tokens/src/brand/wordmark.svg
    - packages/ui-tokens/src/brand/LICENSE-Pretendard.txt
    - packages/ui-tokens/scripts/export-assets.mjs
    - apps/ios/assets/icon.png
    - apps/ios/assets/adaptive-icon.png
    - apps/ios/assets/splash.png
    - apps/ios/assets/fonts/Pretendard-Regular.otf
    - apps/ios/assets/fonts/Pretendard-Medium.otf
    - apps/ios/assets/fonts/Pretendard-SemiBold.otf
    - apps/ios/assets/fonts/Pretendard-Bold.otf
    - apps/ios/assets/fonts/LICENSE-Pretendard.txt
    - apps/web/app/favicon.ico
    - apps/web/public/apple-touch-icon.png
    - apps/web/public/og-default.png
    - apps/web/public/fonts/Pretendard-Regular.otf
    - apps/web/public/fonts/Pretendard-Medium.otf
    - apps/web/public/fonts/Pretendard-SemiBold.otf
    - apps/web/public/fonts/Pretendard-Bold.otf
    - apps/web/public/fonts/LICENSE-Pretendard.txt
    - apps/web/assets/Pretendard-Bold.ttf
  modified:
    - apps/ios/package.json
    - packages/ui-tokens/package.json
    - pnpm-lock.yaml
decisions:
  - "Resolve pretendard via createRequire instead of hardcoded ROOT/node_modules path (script in ui-tokens; pretendard hoisted into packages/ui-tokens/node_modules under pnpm + apps/ios/.npmrc node-linker=hoisted)"
  - "Added pretendard to packages/ui-tokens devDependencies (in addition to apps/ios) so export-assets.mjs can resolve it from script's own home"
metrics:
  duration: "~7 minutes (Task 1-3)"
  completed: "2026-05-25"
  tasks_done: 3
  tasks_total: 4 (task 4 = human-verify checkpoint, pending)
---

# Phase 01 Plan 01: Build Unblock Foundations Summary

**One-liner:** Wave-1 prerequisites for iOS build + brand asset pipeline — pnpm hoist scoped to `apps/ios/`, NativeWind 4.2.4 + Reanimated v4 worklets peer, sharp-based SVG→PNG export pipeline, Pretendard 4-weight bundle present in iOS + Web with SIL OFL attribution.

## What Shipped

### Task 1 — `chore(01-01): pnpm hoist config + nativewind 4.2 + sharp/pretendard deps` (`fbab9e2`)

- `apps/ios/.npmrc` created with `node-linker=hoisted` (D-02 scope: ios only, root `.npmrc` unchanged).
- `apps/ios/package.json`: nativewind `^4.1.23 → ^4.2.4`, +`react-native-worklets ^0.8.3` (dep), tailwindcss `^3.4.13 → ^3.4.17`, +`pretendard ^1.3.9` (devDep).
- `packages/ui-tokens/package.json`: +`export-assets` script, +`sharp ^0.34.5`, +`pretendard ^1.3.9` (devDeps — see deviation #1).
- `pnpm install` succeeded (9.4s + 3.9s second run). Lockfile updated and committed.

### Task 2 — `feat(01-01): add brand SVG sources and export-assets.mjs` (`f672279`)

- `packages/ui-tokens/src/brand/icon.svg`: 1024×1024 white background + brand-orange M-shape pin path.
- `packages/ui-tokens/src/brand/wordmark.svg`: 500×100 placeholder — six brand-orange rounded rectangles (Pretendard Bold outline TBD by designer in subsequent iteration).
- `packages/ui-tokens/src/brand/LICENSE-Pretendard.txt`: SIL OFL 1.1 (copied byte-equal from `pretendard/dist/LICENSE.txt`).
- `packages/ui-tokens/scripts/export-assets.mjs`: 117 lines, sharp pipeline. Resolves pretendard via `createRequire` (deviation #1 fix). Fixed PNG opts (`compressionLevel: 9, palette: false, progressive: false`); no `withMetadata()`.
- Neither SVG contains a `<text>` element (Pitfall C verified — `grep -c "<text"` → 0 / 0).

### Task 3 — `chore(01-01): generate brand PNG/ICO assets and copy Pretendard fonts` (`5cd4446`)

Script produced 17 outputs (6 PNG/ICO + 9 fonts + 2 license copies). Sample output sizes verified.

## Generated Output SHA-256 (reference for cross-machine comparison)

```
848d0ad22da9ebe76fd192b0879db6a054b5270acb27129ea7104a190b6a8921  apps/ios/assets/icon.png
848d0ad22da9ebe76fd192b0879db6a054b5270acb27129ea7104a190b6a8921  apps/ios/assets/adaptive-icon.png
9126afd811db70ba6062c5f9d28de17a420818000f55162f0afd4d8b031b315c  apps/ios/assets/splash.png
bedb0973c99783dcec06d9c319d18fcd742bc2b23ce6cc1ba19a1f2ee648bd21  apps/web/public/apple-touch-icon.png
0f65402f3538029c957f40494689ac7af84eaa401c9669a593c5cac401ee34ce  apps/web/public/og-default.png
3a3e3cb0ed5f9bfbc9a4f9af153fd7c7b03403b829399c9fdf2284874cbaf2c7  apps/web/app/favicon.ico
```

V8 idempotency: confirmed — sha256 identical between two consecutive `pnpm --filter @moajoa/ui-tokens run export-assets` runs on this machine (Darwin arm64, node v22.17.0, sharp 0.34.5).

Font byte sizes match `pretendard@1.3.9` SOT exactly:
- `Pretendard-Regular.otf`: 1,574,352
- `Pretendard-Medium.otf`: 1,584,068
- `Pretendard-SemiBold.otf`: 1,583,704
- `Pretendard-Bold.otf`: 1,576,660
- `Pretendard-Bold.ttf` (Web alternative): 2,661,752

## Wordmark Placeholder Status

**Status:** Still placeholder (six rounded orange rectangles in `wordmark.svg`).
Visual consequence: `splash.png` and `og-default.png` show six orange bars, not the literal "MOAJOA" text. This is intentional per plan — the brand pipeline is validated end-to-end, designer can replace `wordmark.svg` later and rerun `pnpm export-assets` to regenerate all derived images automatically.

Task 4 (human-verify checkpoint) will surface this decision: "approved" (keep placeholder for Phase 1, designer refines later) vs "refine" (block on a designer-provided outlined SVG).

## Transitive Deps Added by `pnpm install`

From lockfile diff:
- **sharp@0.34.5** — added with ~17 `@img/sharp-*` platform binaries (libvips bundles for darwin/linux/win arm64+x64, plus wasm32). Pulled `color`, `detect-libc`, `semver` as runtime deps.
- **pretendard@1.3.9** — pure font asset package, zero runtime deps.
- **react-native-worklets@0.8.3** — peer of `react-native-reanimated@4.1.7`. No additional transitive deps beyond what reanimated already drags in (verified in lockfile: worklets appeared inside the existing reanimated peer-resolution chain).

Total new packages reported by pnpm: `+11` (first install). Lockfile size growth: minor (most was already present via reanimated chain).

## `apps/ios/.gitignore` Contents (does `assets/` appear?)

Current contents (relevant portion):
```
expo-env.d.ts
ios/
android/
.expo/
.expo-shared/
*.jks *.p8 *.p12 *.key *.mobileprovision *.orig.*
web-build/
.metro-health-check*
```

**`assets/` is NOT ignored** — generated PNGs and copied fonts are tracked in git as intended. `ios/` is ignored (prebuild native output), but that does not affect `apps/ios/assets/`.

## Deviations from Plan

### 1. [Rule 3 - Blocker] Added `pretendard` to `packages/ui-tokens` devDeps + switched script to `createRequire`

- **Found during:** Task 1 verification, after `pnpm install`.
- **Issue:** Plan §Task 1 instructed putting `pretendard` only in `apps/ios/package.json` and accessing it from `export-assets.mjs` via hardcoded `ROOT/node_modules/pretendard/dist`. Under pnpm with `node-linker=hoisted` scoped to `apps/ios/.npmrc`, hoisting only applies inside `apps/ios/`. Repo-root `node_modules/pretendard/` does not exist — pretendard lands in `apps/ios/node_modules/pretendard/` (hoisted) and `node_modules/.pnpm/pretendard@1.3.9/...` (store). Script could not resolve the package from `packages/ui-tokens/scripts/` (verified empirically: `createRequire` from the script path threw `MODULE_NOT_FOUND`).
- **Fix:**
  1. Added `pretendard ^1.3.9` to `packages/ui-tokens/devDependencies` so the script's own workspace has it (now resolvable at `packages/ui-tokens/node_modules/pretendard/`).
  2. Switched `export-assets.mjs` to resolve via `createRequire(import.meta.url).resolve('pretendard/package.json')` instead of a hardcoded path. Robust across any pnpm layout future change.
- **Files modified:** `packages/ui-tokens/package.json` (added pretendard devDep), `packages/ui-tokens/scripts/export-assets.mjs` (createRequire instead of hardcoded ROOT path).
- **Commits:** Fix folded into Task 1 (`fbab9e2`) and Task 2 (`f672279`) — discovered before either was committed.

### 2. [Note - Cosmetic] `icon.png` and `adaptive-icon.png` are byte-identical

- **Found during:** Task 3 sha256 check (both files = `848d0ad22da9...`).
- **Cause:** `icon.svg` includes a white `<rect width="1024" height="1024" fill="#FFFFFF"/>` as background. When sharp is asked to render with `background: { alpha: 0 }` for adaptive-icon, the alpha-0 canvas background is overwritten by the SVG's own white rect, producing the same opaque image as `icon.png`.
- **Why deferred (not fixed now):** The plan §2.3 anticipated this and suggested either "a separate SVG without the white rect" OR "alpha 0 background" — the latter was the chosen approach but doesn't work for this particular SVG. Fixing properly requires a second SVG variant (e.g., `icon-fg.svg` without the background rect) and a corresponding script branch, which is design+pipeline scope and best handled by the designer alongside the wordmark refinement (Task 4 / future iteration). Adaptive-icon foreground-only behavior is only relevant for **Android**; iOS uses the full `icon.png` and our `app.config.ts` is iOS-only. No Phase 1 / Phase 2 consumer is blocked.
- **Action:** Documented here; will be addressed when designer provides the refined wordmark + matching foreground-only icon mark.

## Known Stubs

- **`wordmark.svg`** — six placeholder orange rounded rectangles instead of "MOAJOA" lettering. Documented in the file header (`<!-- TODO: replace these placeholder rectangles with actual Pretendard Bold outline paths -->`). Splash and OG images will display the placeholder until designer replaces the SVG. Pipeline itself is fully validated — replacement is a one-file edit + `pnpm export-assets`.

This stub is intentional per plan and will be resolved by the designer (referenced in Task 4 checkpoint decision).

## Task 4 — Human-Verify Checkpoint: APPROVED (2026-05-25)

User decision: `approved` — placeholder geometry kept for Phase 1 close-out. Wordmark/icon refinement deferred to designer iteration (replace `packages/ui-tokens/src/brand/wordmark.svg` → re-run `pnpm --filter @moajoa/ui-tokens run export-assets` to regenerate all consumers).

Pitfall C re-check at decision time: `grep -c "<text" packages/ui-tokens/src/brand/*.svg` → 0 / 0 (clean).

Open follow-ups (out of scope for Phase 1, log only):
- adaptive-icon.png is byte-identical to icon.png (white `<rect>` background in icon.svg overrides sharp alpha:0). Only matters if Android target is added. File as separate ticket then.
- pre-existing web peer warnings (react-dom 19.2.6 vs react 19.1.0, @types/react-dom vs @types/react). Unrelated to plan 01-01.

## Phase Verification Snapshot

| Check | Result |
|-------|--------|
| `test -f apps/ios/.npmrc` + `grep node-linker=hoisted` | PASS |
| `grep node-linker .npmrc` (root) | PASS (no match — D-02 scope) |
| `grep expo-share-intent apps/ios/package.json` | PASS (no match — D-16 lock) |
| `grep "<text" packages/ui-tokens/src/brand/*.svg` | PASS (0 / 0 — Pitfall C) |
| Pretendard-Bold.otf size == 1,576,660 bytes | PASS |
| Pretendard-Bold.ttf size == 2,661,752 bytes | PASS |
| `file icon.png | grep "1024 x 1024"` | PASS |
| V8 idempotency (two-run sha256 diff) | PASS |
| `pnpm-lock.yaml` committed | PASS (in Task 1 commit) |

## Self-Check: PASSED

Verified files present:
- FOUND: apps/ios/.npmrc
- FOUND: apps/ios/assets/icon.png, adaptive-icon.png, splash.png
- FOUND: apps/ios/assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.otf + LICENSE-Pretendard.txt
- FOUND: apps/web/app/favicon.ico
- FOUND: apps/web/public/apple-touch-icon.png, og-default.png
- FOUND: apps/web/public/fonts/Pretendard-*.otf x4 + LICENSE-Pretendard.txt
- FOUND: apps/web/assets/Pretendard-Bold.ttf
- FOUND: packages/ui-tokens/src/brand/{icon,wordmark}.svg + LICENSE-Pretendard.txt
- FOUND: packages/ui-tokens/scripts/export-assets.mjs

Verified commits in `git log`:
- FOUND: fbab9e2 (Task 1)
- FOUND: f672279 (Task 2)
- FOUND: 5cd4446 (Task 3)
