---
phase: 05-trust-ui-onboarding
plan: 03
subsystem: ios-ui
tags:
  - ios-ui
  - toast-action
  - link-list-status
  - retry
  - trust-03
  - jest

requires:
  - phase: 05-trust-ui-onboarding
    plan: 02
    provides: apps/ios/app/boards/[id].tsx broadcast 5-stage wire + currentStep state (StepIndicator overlay reused on retry re-entry)
  - phase: 03-ios-save-flow
    provides: apps/ios/lib/toast.tsx single-instance host (Phase 3 D-10 base — Phase 5 extends action slot + 8s error default)
  - phase: 02-extraction-pipeline-hardening
    provides: extract:{link_id} broadcast 'error' payload with optional `error` field (D-02 lock)

provides:
  - "apps/ios/lib/toast.tsx — showToast(message, kind, options?: { durationMs?, action? }) — backward-compatible 3rd-arg object; error default 5s → 8s; ToastHost renders right-aligned underline action Pressable"
  - "apps/ios/app/boards/[id].tsx — broadcast 'error' branch passes { label: '재시도', onPress } to showToast; onAddLink catch fallback mirrors same retry; link list row 5-status Korean copy + failed-row tap-to-retry"

affects:
  - "05-04 (touches [id].tsx for marker visual + low-conf sheet; sequential after this plan — renderItem block and broadcast 'error' branch will both be present)"
  - "05-06 (onboarding card lives in [id].tsx; orthogonal section — no conflict expected)"

tech-stack:
  added: []
  patterns:
    - "Toast options-object signature (backward-compatible) — kind-specific defaults applied when option omitted; new callers opt in via 3rd arg"
    - "Action onPress wraps hideToast + caller callback so caller never manages toast lifecycle — eliminates dismiss-race"
    - "linkId capture pattern in broadcast 'error' branch — closure binds linkId BEFORE setAnalyzing(null) clears state (D-12 user-explicit retry)"
    - "Dual retry surface for one failure (D-10 + D-11): toast within 8s + permanent failed-row tap fallback after dismiss"
    - "Pressable disabled={!isFailed} pattern for inert list rows — single component, single render path, no conditional wrapper"

key-files:
  created:
    - "apps/ios/__tests__/toast.test.tsx (6 jest cases: action visual + onPress invocation + Phase 3 regression + 3 duration defaults via fake timers)"
  modified:
    - "apps/ios/lib/toast.tsx"
    - "apps/ios/app/boards/[id].tsx"

key-decisions:
  - "Toast options-object adopted (instead of overloads) — grep verified 0 callers used numeric 3rd arg, so positional → object change is zero-risk and backward-compatible for 1-arg/2-arg callers (Karpathy §3.2: minimum change to enable the new feature)"
  - "ToastHost outer Pressable replaced with View + inner Pressable(text) + inner Pressable(action) — old single-Pressable wrapper would have made action tap also fire hideToast twice; split keeps each region's hitSlop independent (Karpathy §3.3: change traces directly to feature)"
  - "Action onPress wraps hideToast() before invoking caller's callback — caller writes `triggerExtraction(...)` without `hideToast()` boilerplate; toast lifecycle is leaf concern"
  - "linkId captured into local const before setAnalyzing(null) — closures over React setter would otherwise see `null` by the time user taps [재시도] (D-12 ensures only user-driven retry, not racy auto-retry)"
  - "onAddLink catch branch gets retry action despite plan calling it optional — same UX surface (analysis failure), keeping the retry affordance consistent across failure paths reduces user-side confusion (Rule 2: missing critical UX consistency)"
  - "Link list row uses Pressable with disabled={!isFailed} instead of conditional Pressable/View — single render path, native disabled styling, no children duplication (Karpathy §3.2)"
  - "Text size on status row stays text-xs (12) per plan §T3 acknowledgment — UI-SPEC §4 prefers 14, but D-22 lock active use sites don't include link list rows. Surgical: only colour branch adjusted, sizing untouched (Karpathy §3.3)"

patterns-established:
  - "Toast action button visual contract: text-white text-sm font-semibold underline + px-2 py-1 + hitSlop=8 (Phase 5+ baseline for inline actions)"
  - "Failure → retry pattern: capture identifier → clear in-progress state → show toast with retry action that re-enters in-progress state → catch nested failure with terminal toast (no auto-retry per D-12)"
  - "5-status Korean fixture for extraction_status (pending/processing/ready/failed/manual_review) lives inline in renderItem — not in @moajoa/core because rendering is iOS-only (no web parity per D-17 / Phase 4 lock)"

requirements-completed:
  - TRUST-03

duration: 3min
completed: 2026-05-26
---

# Phase 5 Plan 03: iOS Error Toast Retry + Link List Failed Row Summary

**TRUST-03 dual retry surface: `apps/ios/lib/toast.tsx` extended with `action?: { label, onPress }` slot + 8s default for error kind (D-10); `[id].tsx` broadcast `'error'` branch + `onAddLink` immediate-failure catch both pass `{ label: '재시도', onPress }` so the user gets a single tap to re-fire `triggerExtraction`. Permanent fallback: link list row maps `extraction_status` to 5 Korean labels (D-11) and `failed` rows become tap-to-retry while non-failed rows render inert via `disabled={!isFailed}`. D-12 lock honored — no automatic retry, only user-explicit taps. 6 new jest tests + 4-suite full test run all green (20/20).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-25T23:01:48Z (Wave 3)
- **Completed:** 2026-05-26
- **Tasks:** 3 atomic commits (toast action slot + broadcast retry + link list status)
- **Files modified:** 3 (1 created + 2 edited)

## Accomplishments

- **`apps/ios/lib/toast.tsx` extended:** `showToast(message, kind, options?: { durationMs?, action? })` — backward-compatible options object as 3rd arg. `kind='error'` default duration `5000 → 8000` ms (Phase 5 D-10, retry window). `ToastHost` adds right-aligned underline action `Pressable` when `current.action` is present, layout via `flex-row items-center justify-between` + 8px gap; action `onPress` invokes `hideToast()` before caller callback so caller never manages toast lifecycle.
- **`[id].tsx` broadcast `'error'` branch:** captures `linkId = analyzing` BEFORE `setAnalyzing(null)` so the retry closure binds a stable value (D-12 ensures only user-driven retry). Passes `{ label: '재시도', onPress }` to `showToast`; retry sets `analyzing` back, re-fires `triggerExtraction(supabase, linkId)`, nested catch shows terminal `'재시도 실패: 잠시 후 다시 시도'` toast.
- **`[id].tsx` `onAddLink` catch branch:** mirrors the same retry action — immediate trigger failure (network/RPC) also gets a retry affordance, consistent UX across all failure paths.
- **`[id].tsx` link list `renderItem`:** maps 5 `extraction_status` values to Korean copy (`분석 대기`, `분석 중...`, `분석 완료`, `분석 실패 — 탭하여 재시도`, `재추출 필요`). `failed` rows are interactive (`Pressable` enabled) and re-fire `triggerExtraction`; other rows are inert via `disabled={!isFailed}`. Only the `failed` status word is `text-danger`; other statuses stay `text-neutral-500`.
- **Jest test suite (`apps/ios/__tests__/toast.test.tsx`):** 6 cases — (1) action label rendered with underline + font-semibold + text-white, (2) tapping action invokes `onPress` exactly once, (3) Phase 3 regression: omitting action renders single-text toast (no `재시도` node), (4) error kind default duration is 8000 ms (visible at 5500 ms, gone at 8500 ms), (5) info kind default 3000 ms, (6) explicit `durationMs` option overrides defaults. Uses `SafeAreaProvider` + `initialMetrics` wrapper so `useSafeAreaInsets` doesn't throw in jest.

## Task Commits

1. **T1 — toast action slot + 8s error default + 6 jest tests** — `f7c7938` (feat)
2. **T2 — broadcast 'error' retry action + onAddLink catch retry** — `aa62d8c` (feat)
3. **T3 — link list row 5-status copy + failed-row tap retry** — `fc2dad1` (feat)

## Files Created/Modified

- **Created:** `apps/ios/__tests__/toast.test.tsx` — 119 lines (6 jest cases + SafeAreaProvider helper)
- **Modified:** `apps/ios/lib/toast.tsx` — +49 −6 lines (action interface + options object signature + dual-Pressable layout)
- **Modified:** `apps/ios/app/boards/[id].tsx` — +72 −12 lines (broadcast 'error' retry + onAddLink retry + renderItem expansion)

## Decisions Made

See `key-decisions` frontmatter. All decisions trace to plan as written + CLAUDE.md §3.2 (simplicity first) + §3.3 (surgical changes) + Phase 5 CONTEXT D-10/D-11/D-12.

## Deviations from Plan

None — plan executed exactly as written, with one additional surgical adjustment that the plan implied but did not enumerate:

- **`renderItem` wrapped status word in a nested `<Text>` for colour-only diff** (instead of replacing the entire row text style). Plan §T3 example used `<Text className={isFailed ? 'text-danger' : 'text-neutral-500'}>{statusKo}</Text>` inline inside the meta `<Text>` — implemented verbatim. Source kind portion remains `text-neutral-500` regardless of status, only the status word turns red. Karpathy §3.3: surgical colour branch, no row-wide restyle.

Also: I added a `useSafeAreaInsets` jest wrapper (`SafeAreaProvider` with `initialMetrics`) because the bare `<ToastHost />` render threw without it — this is test-infrastructure plumbing, not a code deviation. Documented in test file comment so future test authors copy the pattern.

## Verification

```
$ pnpm -F @moajoa/ios typecheck
✓ tsc --noEmit (0 errors)

$ pnpm -F @moajoa/ios test
✓ 4 suites, 20 tests passed
  ✓ __tests__/toast.test.tsx        (6/6 new)
  ✓ __tests__/step-indicator.test.tsx (regression — 5/5)
  ✓ __tests__/realtime.test.ts       (regression — 3/3)
  ✓ __tests__/pending.test.ts        (regression — 6/6)
```

Live device verification deferred to end-of-phase UAT batch (plan §Verification Loop steps 1-6 require forced extraction failure + Expo Go / dev build; visual + tap behaviour covered by jest assertions on className tokens and `fireEvent.press`).

## Issues Encountered

- **`useSafeAreaInsets` requires `SafeAreaProvider` in jest** — initial test run failed with "useSafeAreaInsets must be used within a SafeAreaProvider". Wrapped renders with `<SafeAreaProvider initialMetrics={{ frame, insets: {top:0,...} }}>` helper. Not a Rule 1/2 issue, just test infra plumbing. (~30s lost.)

## Next Phase Readiness

- **05-04 (iOS marker visual + low-conf sheet):** Sequential w.r.t. this plan because both touch `[id].tsx` (renderItem + Marker). Plan 05-04 should rebase on `fc2dad1`; the broadcast 'error' branch and `onAddLink` catch are stable surfaces it won't modify. Marker visual change goes inside the `places.map((p) => <Marker ...>)` block which 05-03 left untouched.
- **05-06 (onboarding card):** Orthogonal section in `[id].tsx` (above URL TextInput per D-19). No conflict expected.
- **Toast action slot ready for future use sites:** 05-04 low-conf sheet, 05-06 onboarding can both reuse the action slot if needed without further toast.tsx changes.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `apps/ios/lib/toast.tsx` → FOUND (extended; `action?: ToastAction` + 8000ms branch + underline action Pressable)
- `apps/ios/app/boards/[id].tsx` → MODIFIED (3 retry sites + 5-status renderItem)
- `apps/ios/__tests__/toast.test.tsx` → FOUND (6 passing tests)
- Commit `f7c7938` → FOUND in `git log` (T1 feat)
- Commit `aa62d8c` → FOUND in `git log` (T2 feat)
- Commit `fc2dad1` → FOUND in `git log` (T3 feat)
- Typecheck → CLEAN (`tsc --noEmit` 0 errors)
- All 20 jest tests pass (4 suites — no regressions in step-indicator/realtime/pending)
- Pattern `action\?:.*label.*onPress` → MATCH in toast.tsx
- Pattern `durationMs.*8000` → MATCH in toast.tsx
- Pattern `font-semibold.*underline` → MATCH in toast.tsx (via `text-white text-sm font-semibold underline`)
- Pattern `label: '재시도'` → MATCH 2× in [id].tsx (broadcast + onAddLink)
- Pattern `분석 실패 — 탭하여 재시도|분석 대기|분석 중|분석 완료|재추출 필요` → 5 MATCHES in [id].tsx
- Pattern `triggerExtraction\(supabase,` → 4 MATCHES (1 original onAddLink + 1 onAddLink retry + 1 broadcast retry + 1 row retry — all 3 retry sites wired)

---

*Phase: 05-trust-ui-onboarding*
*Completed: 2026-05-26*
