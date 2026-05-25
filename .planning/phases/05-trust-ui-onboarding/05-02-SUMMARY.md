---
phase: 05-trust-ui-onboarding
plan: 02
subsystem: ios-ui
tags:
  - ios-ui
  - step-indicator
  - broadcast-wire
  - trust-02
  - jest

requires:
  - phase: 05-trust-ui-onboarding
    plan: 01
    provides: EXTRACT_STEP_KO 4-key Korean fixture in @moajoa/core
  - phase: 02-extraction-pipeline-hardening
    provides: extract:{link_id} broadcast emits {step, progress_pct} once per stage (D-02 lock)
  - phase: 03-board-detail-and-extraction-ui
    provides: apps/ios/app/boards/[id].tsx overlay scaffold (analyzing state + done/error toast)

provides:
  - "apps/ios/app/boards/_step-indicator.tsx — <StepIndicator current={...} /> 4-row Korean overlay"
  - "Type-narrowed Step union exported for callers ('metadata'|'transcript'|'llm'|'places')"
  - "broadcast 5-stage wiring in [id].tsx: setCurrentStep on intermediate steps + cleanup on done/error"

affects:
  - "05-03 (toast retry shares overlay; no surface conflict — only error toast augmented)"
  - "05-04 (touches [id].tsx for low-conf sheet; sequential after this plan)"

tech-stack:
  added: []
  patterns:
    - "Sibling underscore-prefixed component file (_step-indicator.tsx) matching _pin-sheet.tsx / _pin-add-modal.tsx convention in apps/ios/app/boards/"
    - "Narrow Step union exported from leaf component so parent state type stays single source"
    - "RTL (@testing-library/react-native) className substring assertion for NativeWind visual reassignment (no snapshot lock-in)"

key-files:
  created:
    - "apps/ios/app/boards/_step-indicator.tsx"
    - "apps/ios/__tests__/step-indicator.test.tsx"
  modified:
    - "apps/ios/app/boards/[id].tsx"

key-decisions:
  - "StepIndicator owns ORDER + visual reassignment; parent [id].tsx only forwards current — Karpathy §3.2: zero broadcast knowledge in the indicator beyond the 4 valid step names"
  - "Step union exported FROM the leaf (_step-indicator.tsx) and imported by parent — avoids string-literal drift if Phase 6 ever adds a step (single edit site)"
  - "done/error branches clear BOTH analyzing AND currentStep — prevents next extract from briefly rendering stale 'places' highlight before metadata arrives (Risk #3 in plan)"
  - "Removed ActivityIndicator import from [id].tsx (orphan after overlay body replaced) — Karpathy §3.3 'Remove imports... that YOUR changes made unused'"
  - "Tests assert className substring tokens (text-brand-500, font-semibold, text-neutral-300) rather than full string equality — robust to NativeWind class re-ordering"

patterns-established:
  - "Phase 5 iOS leaf-component pattern: single .tsx file under apps/ios/app/boards/ with underscore prefix; props are narrow union; no broadcast/supabase imports in leaf"
  - "Test pattern for NativeWind visual contracts: render via @testing-library/react-native, then assert `.props.className` contains expected utility tokens"

requirements-completed:
  - TRUST-02

duration: 6min
completed: 2026-05-26
---

# Phase 5 Plan 02: iOS StepIndicator Overlay + Broadcast 5-Stage Wire Summary

**TRUST-02 4-row Korean step overlay replaces the Phase 3 single-spinner content. broadcast `metadata|transcript|llm|places` now drives `currentStep` state in `boards/[id].tsx`, which forwards to `<StepIndicator>`. `done`/`error` branches preserve Phase 3 behavior and additionally clear `currentStep` to avoid stale highlight on the next extract. 5 jest tests cover null/intermediate/terminal visual contracts.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-26T (Wave 2)
- **Completed:** 2026-05-26
- **Tasks:** 2 atomic commits (component + wire)
- **Files modified:** 3 (2 created + 1 edited)

## Accomplishments

- **`StepIndicator` component (apps/ios/app/boards/_step-indicator.tsx):** 4-row layout reading from `@moajoa/core` `EXTRACT_STEP_KO`. UI-SPEC D-22 reassignment audit verbatim: current = `text-base font-semibold text-brand-500` + filled dot, done = `text-sm text-neutral-500` + filled dot, future = `text-xs font-medium text-neutral-300` + outline dot. ActivityIndicator always spins above the list (idle/transition feedback).
- **Narrow `Step` union exported from leaf** so `[id].tsx` `useState<Step | null>` stays type-safe without redeclaring the union.
- **`[id].tsx` broadcast callback extended** with explicit `metadata|transcript|llm|places` branch → `setCurrentStep(p.step)`. Done/error branches clear `currentStep` alongside `analyzing` (Risk #3 mitigation — stale step on re-extract).
- **Overlay body replaced** — `ActivityIndicator + "분석 중..." Text` → `<StepIndicator current={currentStep} />`. Outer positioned View (bg overlay + zIndex + pointerEvents="auto") untouched, so Phase 3 interaction-blocking behavior preserved.
- **Orphan import removed:** `ActivityIndicator` no longer imported in `[id].tsx` (Karpathy §3.3).
- **Jest test suite (apps/ios/__tests__/step-indicator.test.tsx):** 5 cases covering null state, `current="metadata"` (current visual + future visual), `current="llm"` (done visual on prior 2), and `current="places"` (3 done + 1 current). All assert className-substring tokens, robust to NativeWind class re-ordering.

## Task Commits

1. **T1 — StepIndicator component + jest test** — `3aac855` (feat)
2. **T2 — wire broadcast 5-stage in [id].tsx** — `3c2c113` (feat)

## Files Created/Modified

- **Created:** `apps/ios/app/boards/_step-indicator.tsx` — 58 lines (component + props + visual reassignment logic)
- **Created:** `apps/ios/__tests__/step-indicator.test.tsx` — 65 lines (5 jest cases)
- **Modified:** `apps/ios/app/boards/[id].tsx` — +15 −5 lines (state + branch + overlay body + import cleanup)

## Decisions Made

See `key-decisions` frontmatter. All decisions trace to plan as written + UI-SPEC D-22 + CLAUDE.md §3.3 (surgical changes).

## Deviations from Plan

None — plan executed exactly as written, with one additional surgical cleanup (Karpathy §3.3) that the plan implied but did not enumerate:

- **Orphan import removal:** Removed `ActivityIndicator` from `[id].tsx` import list after replacing the overlay body. The plan said "surgical: overlay outer View ... unchanged. content만 교체" — removing the now-unused import is part of "your changes' cleanup" per CLAUDE.md §3.3. Not tracked as a deviation since it traces directly to the plan's surface-area change.

## Verification

```
$ pnpm -F @moajoa/ios typecheck
✓ tsc --noEmit (0 errors)

$ pnpm -F @moajoa/ios test
✓ 3 suites, 14 tests passed
  ✓ __tests__/step-indicator.test.tsx  (5/5 new)
  ✓ __tests__/realtime.test.ts          (regression — broadcast contract unchanged)
  ✓ __tests__/pending.test.ts           (regression — unrelated)
```

Live device verification deferred to user (plan §Verification Loop steps 1-6 require Expo Go / dev build — out of scope for automated executor; covered by jest visual contract instead).

## Issues Encountered

None.

## Next Phase Readiness

- **05-03 (toast retry):** Only augments `error` branch of the same `subscribeExtractProgress` callback. No structural conflict; can land in parallel-eligible Wave 2.
- **05-04 (iOS marker + low-conf sheet):** Sequential w.r.t. this plan because both touch `[id].tsx` (FlatList / MapView region). 05-04 should rebase on top of `3c2c113`.
- **Foundation lock holding:** `EXTRACT_STEP_KO` import path (`@moajoa/core`) confirmed; `subscribeExtractProgress` callback shape (`ExtractProgress.step` union with 6 values) consumed without modification.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `apps/ios/app/boards/_step-indicator.tsx` → FOUND (58 lines, exports `StepIndicator` + `Step`)
- `apps/ios/__tests__/step-indicator.test.tsx` → FOUND (5 passing tests)
- `apps/ios/app/boards/[id].tsx` → MODIFIED (`StepIndicator`, `setCurrentStep`, `Step` imports present)
- Commit `3aac855` → FOUND in `git log` (T1 feat)
- Commit `3c2c113` → FOUND in `git log` (T2 feat)
- Typecheck → CLEAN (`tsc --noEmit` 0 errors)
- All 14 jest tests pass (3 suites)
- Pattern `import.*EXTRACT_STEP_KO.*@moajoa/core` → MATCH
- Pattern `setCurrentStep\(p\.step\)|setCurrentStep\(null\)` → MATCH (3 occurrences in [id].tsx)
- Pattern `<StepIndicator current={currentStep}` → MATCH

---

*Phase: 05-trust-ui-onboarding*
*Completed: 2026-05-26*
