---
phase: 05-trust-ui-onboarding
plan: 06
subsystem: ios-ui
tags:
  - ios-ui
  - onboarding
  - async-storage
  - dismissible-banner

requires:
  - phase: 05-trust-ui-onboarding
    plan: 01
    provides: OnboardKeys.LinkCardDismissed constant in @moajoa/core
  - phase: 05-trust-ui-onboarding
    plan: 04
    provides: shared ownership of apps/ios/app/boards/[id].tsx (sequential wave order)

provides:
  - "apps/ios/lib/onboarding.ts — isLinkCardDismissed/dismissLinkCard typed AsyncStorage wrapper"
  - "apps/ios/app/boards/_onboard-card.tsx — OnboardCard ONBOARD-02 amber dismissible banner"
  - "apps/ios/app/boards/[id].tsx — OnboardCard visibility wiring (empty-board AND not-dismissed gate)"

affects:
  - "Phase 5 ships: ONBOARD-02 complete — first-board empty state explains the value prop in Korean"

tech-stack:
  added: []
  patterns:
    - "Tri-state loading flag (null | false | true) to prevent UI flicker for users who already dismissed"
    - "Optimistic dismiss: setState first, fire-and-forget AsyncStorage write (graceful degrade on storage failure)"
    - "Underscore-prefix component file convention (_onboard-card.tsx) mirrors _pin-sheet.tsx / _step-indicator.tsx"
    - "Jest mock pattern for @react-native-async-storage/async-storage (default export, __esModule:true) reusable for future onboarding flags"

key-files:
  created:
    - "apps/ios/lib/onboarding.ts"
    - "apps/ios/app/boards/_onboard-card.tsx"
    - "apps/ios/__tests__/onboarding.test.ts"
    - "apps/ios/__tests__/onboard-card.test.tsx"
  modified:
    - "apps/ios/app/boards/[id].tsx"

key-decisions:
  - "Tri-state linkCardDismissed: null=loading, false=show-if-empty, true=permanently-hidden. The null gate eliminates the 1-frame card flash on warm-start for users who already dismissed (matches plan §Risk/Pitfalls)"
  - "Optimistic onDismiss: setLinkCardDismissed(true) before awaiting AsyncStorage. If the write fails (warn-only per lib/onboarding.ts), the worst case is the card reappearing on next mount — never a crash"
  - "Card mounts OUTSIDE the existing `px-6` URL input wrapper because OnboardCard owns its own `mx-6`. Placing it inside would double the horizontal inset and break the wireframe alignment (UI-SPEC §Component States 6)"
  - "Test mocks @react-native-async-storage/async-storage as a default-export object with jest.fn() get/set, then asserts on calledWith(OnboardKeys.LinkCardDismissed, 'true') — locks the storage layout against future drift"

patterns-established:
  - "ONBOARD-* features should keep storage keys in @moajoa/core OnboardKeys (single namespace, prevents library-collision per T-05-06-01)"
  - "Strict string compare (=== 'true') instead of truthy check — future writers can't accidentally enable a dismiss with '1', 'yes', non-empty strings"

requirements-completed:
  - ONBOARD-02

duration: ~3min
completed: 2026-05-26
---

# Phase 5 Plan 06: Onboarding Card Banner (ONBOARD-02) Summary

**Dismissible amber banner ("유튜브 링크를 붙여넣어 보세요 / 영상 속 장소가 30초 안에 지도로 떠요") rendered above the URL TextInput on empty boards; global one-shot dismiss persisted in AsyncStorage at `OnboardKeys.LinkCardDismissed`. Tri-state loading flag prevents flicker, optimistic onDismiss degrades gracefully on storage failure.**

## Performance

- **Duration:** ~3 min (196s wall)
- **Started:** 2026-05-25T23:18:47Z
- **Completed:** 2026-05-25T23:22:03Z
- **Tasks:** 3 (T1 lib + T2 component + T3 wiring)
- **Files modified:** 5 (4 created + 1 edited)
- **Tests added:** 10 (7 onboarding + 3 onboard-card)

## Accomplishments

- **`lib/onboarding.ts`:** 30-line typed wrapper around AsyncStorage. `isLinkCardDismissed()` strict-compares to `'true'`; `dismissLinkCard()` writes `'true'`. Both swallow errors with a `console.warn` so a broken storage layer never crashes board navigation.
- **`_onboard-card.tsx`:** Pure presentational component (35 lines). Amber-50 fill + amber-200 border + `💡` emoji + headline + body + `×` Pressable with `hitSlop:8` and `accessibilityLabel:'안내 카드 닫기'`. Parent owns visibility + persistence.
- **`[id].tsx` wiring:** +31 lines, surgical. Two new imports, one new state slot (tri-state), one new effect (one-shot AsyncStorage read), one new derivation (`showOnboardCard`), one JSX conditional block above the URL input wrapper. Zero changes to existing logic.
- **Test coverage:** `onboarding.test.ts` (7 cases — read true/null/non-true/error + write/error + key-constant lock); `onboard-card.test.tsx` (3 cases — copy lines + palette tokens + dismiss callback). Full ios suite stays green at 30/30 (4 prior suites unchanged).

## Task Commits

1. **T1 — lib/onboarding.ts + tests** — `9fb828a` (feat)
2. **T2 — OnboardCard component + tests** — `06b0a60` (feat)
3. **T3 — [id].tsx visibility wiring** — `858bf51` (feat)

## Files Created/Modified

- **Created:** `apps/ios/lib/onboarding.ts` (30 lines) — typed AsyncStorage wrapper
- **Created:** `apps/ios/app/boards/_onboard-card.tsx` (38 lines) — banner component
- **Created:** `apps/ios/__tests__/onboarding.test.ts` (75 lines) — 7 jest cases
- **Created:** `apps/ios/__tests__/onboard-card.test.tsx` (51 lines) — 3 jest cases
- **Modified:** `apps/ios/app/boards/[id].tsx` (+31 lines) — imports + state + effect + derivation + conditional mount

## Decisions Made

- See `key-decisions` frontmatter. All decisions follow PLAN-§ "Risk / Pitfalls" + CONTEXT D-19/D-20/D-21 verbatim.
- **`hitSlop={8}`** chosen for the × button so the 8pt invisible padding meets HIG ≥44pt-region guidance when combined with the explicit `w-8 h-8` container (32×32 visible + 8 slop = 48 hit area).
- **`accessibilityLabel="안내 카드 닫기"`** added for VoiceOver users (no plan requirement, but VoiceOver-bare × text would announce as just "x" character — Rule 2 critical functionality minor add).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - A11y] Added `accessibilityRole="button"` + `accessibilityLabel="안내 카드 닫기"` to × Pressable**
- **Found during:** Task 2 — writing the component, noticed the × glyph alone gives VoiceOver users no actionable cue.
- **Issue:** The `Text` child is just the character `×`; VoiceOver would announce it as "x" with no role hint. Users relying on assistive tech would not know it dismisses the card.
- **Fix:** Two props on the Pressable: `accessibilityRole="button"` + `accessibilityLabel="안내 카드 닫기"`. Test #3 now selects via `getByLabelText('안내 카드 닫기')` instead of fragile text match — also more robust.
- **Files modified:** `apps/ios/app/boards/_onboard-card.tsx`
- **Commit:** `06b0a60`

---

**Total deviations:** 1 auto-fixed (1 a11y addition under Rule 2)
**Impact on plan:** Zero scope creep. The deviation is a 2-prop minor add that also makes the test selector more stable.

## Issues Encountered

- None. AsyncStorage dep already at `2.2.0` per `apps/ios/package.json:23` (plan §Why pre-verified). OnboardKeys export from `@moajoa/core` confirmed at `packages/core/src/constants.ts:189` before T1. No version drift, no install step needed.

## User Setup Required

None — this plan is pure client-side iOS code on top of the AsyncStorage dep that ships with the existing build.

**Live device UAT** (Plan §"Verification Loop" 8 steps) deferred to end-of-phase batch per auto mode:
1. Cold-launch empty board → amber card visible above URL input
2. Tap URL TextInput / paste link → card disappears (`links.length > 0` gate)
3. Tap × → card vanishes, AsyncStorage `@moajoa/onboard:link_card_dismissed` === `'true'`
4. Kill app → relaunch → enter any empty board → card stays hidden (persistence)
5. `AsyncStorage.removeItem(OnboardKeys.LinkCardDismissed)` via dev tool → card reappears (recoverable)

The jest contract (10 cases) covers the static behavior (palette, copy, dismiss callback, storage layout). UAT covers the runtime composition with the live `[id].tsx` flow.

## Next Phase Readiness

- **Phase 5 complete:** This was the last iOS plan in wave 5. Plans 05-01 through 05-06 all merged. Phase 6 (or `/gsd-verify-work` for end-of-phase batch UAT) can proceed.
- **Future ONBOARD additions:** `OnboardKeys` namespace + `lib/onboarding.ts` pattern is reusable — adding `OnboardKeys.PinAddCardDismissed` (or similar) is a single constant + two-function copy at this point.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `apps/ios/lib/onboarding.ts` → FOUND
- `apps/ios/app/boards/_onboard-card.tsx` → FOUND
- `apps/ios/__tests__/onboarding.test.ts` → FOUND
- `apps/ios/__tests__/onboard-card.test.tsx` → FOUND
- `apps/ios/app/boards/[id].tsx` → FOUND (modified, OnboardCard import + showOnboardCard wired)
- Commits `9fb828a`, `06b0a60`, `858bf51` → all FOUND in `git log`
- Full apps/ios jest suite 30/30 PASS (6 suites — 2 new + 4 prior regressions clean)
- `pnpm tsc --noEmit` (apps/ios) → exit 0

---

*Phase: 05-trust-ui-onboarding*
*Completed: 2026-05-26*
