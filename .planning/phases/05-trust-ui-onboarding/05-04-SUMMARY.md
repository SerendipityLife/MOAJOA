---
phase: 05-trust-ui-onboarding
plan: 04
subsystem: ios-ui
tags:
  - ios-ui
  - marker-visual
  - bottom-sheet-variant
  - confirm-reject
  - trust-01
  - trust-04

requires:
  - phase: 05-trust-ui-onboarding
    plan: 01
    provides: places.confidence column + confirmAiPlace/rejectAiPlace helpers + LOW_CONFIDENCE_THRESHOLD constant
  - phase: 05-trust-ui-onboarding
    plan: 03
    provides: [id].tsx 5-status link list + retry toast surface (file co-edit boundary)
  - phase: 03-ios-save-flow
    plan: 05
    provides: PinBottomSheet single-sheet UI (D-09) + Marker onPress wiring

provides:
  - "[id].tsx Marker render branches by source_kind + confidence (TRUST-01 iOS)"
  - "Low-confidence Marker uses children View opacity fallback for Apple Maps provider parity (Pitfall 3)"
  - "_pin-sheet.tsx isLowConf variant: 신뢰도 낮음 amber badge + hint + [확인]/[잘못됨] inserted above 이름 수정"
  - "confirmAiPlace + rejectAiPlace wired to UI (TRUST-04)"

affects:
  - "05-06 (안내 카드) — same file [id].tsx + _pin-sheet.tsx baseline locked"

tech-stack:
  added: []
  patterns:
    - "Marker visual = pure function of (source_kind, confidence) at render site (mirrors Phase 5 Plan 05-05 web pattern)"
    - "Provider-defensive: opacity prop + alpha-encoded children View — Apple Maps either ignores opacity (children dominates) or honors it (children stacks). Same visual intent both paths."
    - "Trust-affordance ordering: confirm/reject inserted ABOVE inline-edit so the schema-mutating decision is the first tap target on low-conf pin"

key-files:
  created: []
  modified:
    - "apps/ios/app/boards/[id].tsx (+38 lines net — Marker block expansion)"
    - "apps/ios/app/boards/_pin-sheet.tsx (+68 lines net — 2 handlers + badge row + hint + 2 actions + 이름 수정 mt-2/mt-4 branch)"

key-decisions:
  - "Marker children replace default pin on low-conf — react-native-maps semantics mean pinColor is ignored when children render. Trade-off accepted (D-13: low-conf = intentionally weaker visual). The ?-in-circle children View IS the low-conf marker."
  - "Opacity prop kept alongside children View — defense-in-depth. On providers that honor opacity, both layers stack to ~0.25 effective alpha (still visible but obviously degraded). On providers that ignore opacity, the children View alone carries the signal at rgba(249,115,22,0.5)."
  - "Strict-< comparison (`confidence < LOW_CONFIDENCE_THRESHOLD`) — exactly 0.7 is HIGH confidence per D-15 and Plan 05-05 web parity. null/undefined never trigger low-conf branch."
  - "이름 수정 margin branches (mt-2 when low-conf, mt-4 otherwise) instead of wrapping the action stack — preserves the existing render block structure and keeps the diff surgical (Karpathy §3.3). Visual rhythm: actions always have 4px between siblings, 16px above the first action of a section."
  - "Both confirm and reject call onChanged() THEN onClose() — parent's load() runs while sheet animates out. UI may briefly show stale marker — acceptable per Plan task §Risk note 3."

patterns-established:
  - "Provider-defensive marker children: when a native prop (opacity, pinColor) has documented provider drift, encode the same visual intent in a children View as fallback. Pattern applies to any future per-pin state (vote count, ownership badge)."
  - "Trust-action ordering rule: schema-mutating actions (confirm/reject/approve) precede inline-edit actions when both are visible. The mutation is the user's primary decision; rename is housekeeping."

requirements-completed:
  - TRUST-01
  - TRUST-04

duration: 2min
completed: 2026-05-26
---

# Phase 5 Plan 04: iOS Marker Visual + PinBottomSheet Low-Confidence Variant Summary

**iOS marker render now branches by `source_kind`/`confidence` with provider-defensive opacity fallback (TRUST-01 iOS), and PinBottomSheet gains an `isLowConf` variant exposing `[확인]`/`[잘못됨]` actions wired to `confirmAiPlace`/`rejectAiPlace` (TRUST-04) — completing the iOS trust-visual layer that pairs with the web-side marker in Plan 05-05.**

## Performance

- **Duration:** ~2 min (134s wall)
- **Started:** 2026-05-25T23:10:42Z
- **Completed:** 2026-05-26
- **Tasks:** 2 (T1 marker + T2 sheet variant)
- **Files modified:** 2 (both pre-existing — surgical extend per Karpathy §3.3)

## Accomplishments

- **TRUST-01 iOS:** `[id].tsx` Marker map renders three distinct visuals from one pure derivation at the render site — `isAi`, `isLowConf`, `pinColor`, `opacity`. No memoization, no helper file — Karpathy §3.2 (50 lines, not 200).
- **Apple Maps fallback wired:** low-conf marker has a children `View` with `rgba(249,115,22,0.5)` background carrying the `?` badge at the same effective alpha as the opacity prop. Whichever provider iOS picks, the marker reads as "intentionally weak."
- **TRUST-04 sheet variant:** `_pin-sheet.tsx` adds `isLowConf` derived state, two handler functions (`onConfirm`/`onReject`), an amber "신뢰도 낮음" sibling badge using the Phase 5 D-22 typography reassignment (`text-xs font-medium`), a hint line, and two action buttons inserted above the existing `이름 수정` Pressable. Both handlers call the wrappers from `@moajoa/api` then `onChanged()` + `onClose()`.
- **No regression on default variants:** AI high-conf and manual pins render the exact Phase 3 sheet (single AI/수동 badge, no hint, no new actions). The `isLowConf` flag is the only gate.
- **Tests + typecheck green:** 20/20 jest (4 suites) PASS, `tsc --noEmit` clean for `@moajoa/ios`.

## Task Commits

1. **T1 — Marker visual branching** — `80c2e88` (feat)
2. **T2 — PinBottomSheet low_confidence variant** — `4702bc7` (feat)

## Files Created/Modified

- **Modified:** `apps/ios/app/boards/[id].tsx` — added `LOW_CONFIDENCE_THRESHOLD` import; replaced 8-line Marker block with 38-line branching block (isAi/isLowConf/pinColor/opacity + children View for low-conf badge).
- **Modified:** `apps/ios/app/boards/_pin-sheet.tsx` — added `confirmAiPlace`/`rejectAiPlace`/`LOW_CONFIDENCE_THRESHOLD` imports; `isLowConf` derived state; `onConfirm`/`onReject` handlers; badge row wrapping the existing AI/수동 badge with sibling amber badge; hint line; two new Pressable actions; `이름 수정` margin branch.

## Decisions Made

See `key-decisions` frontmatter. All follow CONTEXT.md D-04/D-05/D-13/D-14/D-15/D-22 verbatim — no new architectural calls.

## Deviations from Plan

**None.** The plan body specified the exact code blocks; the only minor variance is the explicit `이름 수정` margin branch instead of the plan's deferred "첫 plan 시각 검증에서 조정" note — chose to lock the spacing now rather than ship inconsistent rhythm (4px below low-conf actions vs. 16px above 이름 수정 when no low-conf). The branch keeps every other case identical.

## Issues Encountered

- **None.** Foundation from 05-01 was fully ready: `confirmAiPlace`/`rejectAiPlace` exported from `@moajoa/api`, `LOW_CONFIDENCE_THRESHOLD` exported from `@moajoa/core`, `Place` type has `confidence: number | null` and `source_kind: 'ai' | 'manual'` (Plan 05-05 already extended the Zod schema). Pre-wired infrastructure → zero blocker time.

## User Setup Required

**Live device verification deferred to end-of-phase UAT batch** (per auto mode + Plan task §Verification Loop):

1. `supabase db push` for migration 0006 (Plan 05-01 deferred) — required to populate `places.confidence` on new extractions
2. Seed SQL: `INSERT INTO places (board_id, name_local, lat, lng, source_kind, confidence, link_id) VALUES (...)` — one AI high (0.9), one AI low (0.4), one manual
3. iOS sim/device — open board → verify 3 visual marker variants → tap low-conf → see new sheet variant → tap [확인], verify marker re-renders to manual visual → tap another low-conf [잘못됨], verify marker disappears

**Critical verification point:** does Apple Maps render the low-conf marker visibly differently from high-conf? If yes → opacity prop was honored, children layered on top (slightly over-faded but legible). If no → children View carries the entire signal. Either path is acceptable per D-13 visual intent.

## Next Phase Readiness

- **05-06 (onboarding card):** depends on same `[id].tsx` baseline. Wave-5 sequential follows after this commit.
- **Phase 5 trust visual layer complete:** TRUST-01 (web 05-05 + iOS 05-04), TRUST-02 (05-02), TRUST-03 (05-03), TRUST-04 (05-04) all code-complete. End-of-phase UAT batch covers all four.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `apps/ios/app/boards/[id].tsx` — FOUND, contains `LOW_CONFIDENCE_THRESHOLD` + `isLowConf` + `pinColor` + `opacity` + `?` badge children View
- `apps/ios/app/boards/_pin-sheet.tsx` — FOUND, contains `confirmAiPlace` + `rejectAiPlace` + `신뢰도 낮음` + `AI가 자신 없어해요` + `isLowConf`
- Commit `80c2e88` — FOUND in `git log`
- Commit `4702bc7` — FOUND in `git log`
- `pnpm -F @moajoa/ios typecheck` — PASS
- `pnpm -F @moajoa/ios test` — 20/20 PASS (4 suites)

---

*Phase: 05-trust-ui-onboarding*
*Completed: 2026-05-26*
