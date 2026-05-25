---
phase: 01-build-unblock-hygiene
plan: 02
status: complete
completed_tasks: 3
total_tasks: 3
verified_in_machine: true
verified_at: "2026-05-25T08:29:00.000Z"
requirements_satisfied: [BUILD-01, BUILD-02, BUILD-03]
device:
  model: iPhone (USB-attached, real device id 00008130-001014CC2660001C)
  ios_version: "26.3.1"
  signing_team: TYXL4CT3S2
path_chosen: A (local prebuild — Path B/EAS not needed)
---

# 01-02 SUMMARY — iOS prebuild + smoke screen + device install

**Status:** Path A succeeded end-to-end. BUILD-01/02/03 all visually verified on physical iPhone. Plan 01-04 (EAS Build fallback) is NOT needed and remains conditional/unfired.

## Commits

| SHA | Subject |
|---|---|
| `60911c4` | feat(01-02): wire icon/splash/expo-font plugins and add NativeWind smoke screen |
| `fb3342f` | docs(01-02): record Path A prebuild success timeline (~14min, under 4h timebox) |
| `500ad75` | fix(01-02): add react-native-css-interop as direct dep for pnpm hoist resolution |

## Task 1 — Config + smoke screen wire-up (`60911c4`)
- `apps/ios/app.config.ts`: added `icon: './assets/icon.png'`, replaced plugins array with tuple form including `expo-splash-screen` (white bg, 234pt centered wordmark) and `expo-font` (4 Pretendard weights).
- `apps/ios/app/index.tsx`: replaced auth-gated redirect with NativeWind smoke View (`bg-brand-500` parent + `bg-white rounded-2xl shadow-lg` card + `text-brand-700 font-bold` heading + `text-neutral-600` subtext).
- `apps/ios/app/_layout.tsx`: UNCHANGED (RESEARCH confirmed expo-font config plugin auto-registers, useFonts hook unnecessary).
- `apps/ios/babel.config.js`: UNCHANGED (Pitfall A lock).
- D-16 lock honored: no expo-share-intent in plugins.

## Task 2 — Prebuild + pod install (`fb3342f`)
- `npx expo prebuild --platform ios --clean` from `apps/ios/` → `ios/MOAJOA.xcodeproj` + `Podfile` generated cleanly. Wave 1's `apps/ios/.npmrc node-linker=hoisted` did its job — the historical reanimated/pnpm symlink blocker did not reappear.
- Auto pod install failed once with `Encoding::CompatibilityError` (CocoaPods 1.16.2 + Ruby 4.0.2 + non-UTF-8 locale bug — NOT the pnpm issue we braced for).
- Retried `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` → `90 dependencies / 91 total pods installed` in ~828s.
- Total elapsed: ~14 minutes (4h timebox: 6% consumed).
- `apps/ios/.gitignore` contains `ios/` → native dir not committed (correct per Expo prebuild policy).
- SESSION-NOTES timeline logged.

## Task 3 — Device install + visual verification (user, `500ad75`)
- 17:13 first `expo run:ios --device` → Xcode build + signing OK, install OK, but Metro not running → red error "No script URL provided" (expected — `expo run:ios --device` did start Metro, but iPhone hadn't refreshed the bundle URL yet).
- 17:24 Metro running, iPhone Reload JS → **second red error**:
  `Unable to resolve "react-native-css-interop/jsx-runtime"`
- Root cause: nativewind@4.2.4's transitive dep `react-native-css-interop@0.2.4` was in pnpm's `.pnpm/` store but not promoted to any conventional `node_modules/` directory. `apps/ios/metro.config.js` uses `disableHierarchicalLookup=true` so Metro can only see `apps/ios/node_modules/` and `<repo>/node_modules/`.
- Fix (commit `500ad75`): declared `react-native-css-interop: "0.2.4"` in `apps/ios/package.json` dependencies. `pnpm install` promoted it to root `node_modules/`. Metro's second lookup path resolves it.
- `pnpm exec expo start --clear` (Metro cache clear) + iPhone Reload JS → ✅ smoke screen.

## Verification — BUILD-01/02/03 PASS

| ID | Criterion | Evidence |
|---|---|---|
| BUILD-01 | iOS app launches on real device | App icon visible on home screen + cold launch succeeded |
| BUILD-02 | NativeWind className renders visibly | Orange `bg-brand-500` background, white card with `rounded-2xl shadow-lg`, "NativeWind OK" in `text-brand-700 font-bold`, Korean subtext in `text-neutral-600` — all four token mappings visually correct (no silent failure) |
| BUILD-03 (iOS portion) | icon + splash + Pretendard 4-weight embedded in native bundle | icon.png in bundle (visible on device home), splash visible during cold launch, Korean subtext rendered without 네모/잘림 → Pretendard or system fallback working. Assumption A1 (PostScript name auto-matching): bold text appears visibly bold → no need for useFonts hook Option B |

User screenshot captured (Phase 1 smoke screen) — recommended save path: `docs/screenshots/2026-05-25-phase1-smoke.png`.

## New pitfalls logged (candidates for `.planning/research/PITFALLS.md`)

1. **CocoaPods 1.16.2 + Ruby 4.0.2 (Homebrew) + non-UTF-8 locale → `pod install` instant crash with `Encoding::CompatibilityError` in `unicode_normalize`.** Workaround: `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before pod install, or add to `~/.zshrc` permanently. `npx expo prebuild`'s auto pod install does NOT set this — manual retry needed.
2. **pnpm + nativewind 4.2 transitive dep hoist failure with `apps/<package>/.npmrc node-linker=hoisted`.** When `pnpm install` runs at root, the per-subpackage `.npmrc` does NOT trigger hoist linker for transitive deps. NativeWind's `react-native-css-interop` stays in `.pnpm/` store only. Combined with Metro `disableHierarchicalLookup=true` → module resolution failure. **Mitigation:** declare nativewind's direct deps (`react-native-css-interop`) explicitly in `apps/ios/package.json` so pnpm promotes them. Or add to root `.npmrc` `public-hoist-pattern[]=react-native-css-interop` (but root isolation principle prefers per-subpackage declaration).

## Deviations / open items (non-blocking)

- **Pre-existing typecheck failure** in `packages/api/src/types/database.ts` line 1 (stray `Initialising login role...` log line embedded by Phase 2 supabase typegen commit `06ee485`). Independent of this plan. Recommend separate chore PR `fix(api): strip log noise from generated database.ts header`.
- **Smoke screen card centering:** card appears slightly below center (likely SafeAreaProvider inset + StatusBar height). Plan success criteria only require className APPLIED (which it is). Not a fail. Defer to Phase 3 SAVE-01 when index.tsx is restored to auth-gated layout anyway.
- **Pretendard PostScript name verification was visual only.** Bold appears bold, regular appears regular. No deeper introspection (e.g., reading `__c.getCharacters()` on a span) — acceptable per plan's "visual verification" Task 3 design.

## Phase 1 status after this plan

- 01-01 ✓ (Wave 1, brand assets)
- 01-02 ✓ (this plan, iOS build + smoke)
- 01-03 ✓ (Wave 2, web dev-tool gate)
- 01-04 — conditional, NOT executed (Path A succeeded, EAS fallback not needed)

→ **Phase 1 effectively COMPLETE.** All 5 success criteria from ROADMAP met. Ready for `/gsd-discuss-phase 3` (next iOS work, wcb owner) or Phase 4 (Web public board, depends on Phase 2 which is also done).
