---
phase: 24-host-flow
plan: 04
subsystem: web
tags: [onboarding, wizard, react-day-picker, shared-component, resolve-place, tdd, vitest]

# Dependency graph
requires:
  - phase: 24-host-flow (24-02)
    provides: createMoaDraft typed query + TripCreateDraftSchema (companion)
  - phase: 24-host-flow (24-01)
    provides: react-day-picker 9.14 (local applied) + supabase-js 2.110
  - phase: 23-web-share
    provides: TripCreateDraftSchema (dates-optional refine) + trips.companion
provides:
  - /onboarding 4-step client wizard (D-02, single route) — creates moa once on finish (ONBOARD-03)
  - buildDraft pure mapper (wizard state → TripCreateDraft, title derivation, local YYYY-MM-DD)
  - AddContentTabs shared component (D-11 — 링크/장소검색 2탭, reused by 24-07 add-sheet)
  - step-where/step-dates/step-who/step-seed onboarding step components
affects: [24-07-add-sheet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-day-picker 9.14 mode=range with classNames Tailwind mapping (no style.css — A-8)"
    - "Shared AddContentTabs component owns validation (new URL) + resolve-place search; parent owns staging/DB (D-11)"
    - "Wizard owns all state; step components are pure display/callback"
    - "Batch seed on finish — fire-and-forget triggerExtraction (D-03)"

key-files:
  created:
    - apps/web/app/onboarding/page.tsx
    - apps/web/app/onboarding/_components/step-where.tsx
    - apps/web/app/onboarding/_components/step-dates.tsx
    - apps/web/app/onboarding/_components/step-who.tsx
    - apps/web/app/onboarding/_components/step-seed.tsx
    - apps/web/app/onboarding/_lib/build-draft.ts
    - apps/web/components/add-content-tabs.tsx
    - apps/web/__tests__/build-draft.test.ts
    - apps/web/__tests__/onboarding.test.tsx
  modified:
    - apps/web/components/index.ts

key-decisions:
  - "page.tsx wiring of StepDates/StepSeed deferred to Task 3 (matches plan file lists) — Task 1/2 used typechecking placeholders"
  - "건너뛰기 and 모아 만들기 share handleSubmit — skip = submit with 0 staged seeds"
  - "DAY_PICKER classNames map range endpoints brand-600 / middle brand-100 via [&_button] descendant selectors (v9 day_button structure)"

patterns-established:
  - "AddContentTabs: onAddLink receives only URLs passing new URL(); onPickPlace maps ResolvedPlace → {id, name, address}"
  - "buildDraft: local-tz fmt (getFullYear/getMonth/getDate) not UTC — avoids day-shift; range.to ?? range.from = day trip"

requirements-completed: [ONBOARD-03, ONBOARD-04, ONBOARD-05]

# Metrics
duration: 10min
completed: 2026-07-08
---

# Phase 24 Plan 04: Onboarding Wizard Summary

**4-step `/onboarding` client wizard (어디로→날짜→누구랑→봐둔 곳) that creates a moa once via TripCreateDraftSchema.parse → createMoaDraft, with the shared AddContentTabs (D-11) that 24-07 reuses, buildDraft pure mapper, and batch seed (addLink + fire-and-forget triggerExtraction) on finish.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-08T09:53Z
- **Completed:** 2026-07-08T10:03Z
- **Tasks:** 3 (Task 3 = TDD, 2 RED→GREEN cycles)
- **Files:** 10 (9 created, 1 modified)

## Task Commits

1. **Task 1: wizard shell + step-where/step-who** — `7e74a4d`
2. **Task 2: step-dates calendar + AddContentTabs + step-seed** — `f24410d`
3. **Task 3 (TDD):**
   - buildDraft: `e2138e3` (test RED) → `3693405` (feat GREEN)
   - onboarding flow: `75f7539` (test RED) → `dab3e9d` (feat GREEN — page wiring)

## Accomplishments
- `/onboarding` single-route client wizard (D-02): 4-step state, 4-dot indicator (A-6), back chevron (aria-label="뒤로"), browser back via `history.pushState`/`popstate` (Pitfall 6 minimal), no localStorage (D-04)
- step-where (CITY_KO_MAP 9 chips + 기타) / step-who (혼자/연인/친구/가족/동료 + 기타) — same chip pattern, maxLength 20 (city_code/companion ≤20)
- step-dates (D-06, ONBOARD-04): react-day-picker 9.14 `mode="range"` + ko locale, classNames Tailwind mapping (A-8, no style.css), 2택 카드 + "날짜는 나중에 친구들과 함께 정할 수 있어요" 미정 한 줄
- **AddContentTabs shared component (D-11):** 링크 붙여넣기 / 장소 검색 2탭, `new URL()` validation, `resolve-place` EF search (max 5 rows), no DB writes — parent owns staging; exported + barrel-registered so 24-07 add-sheet reuses it
- step-seed (D-08, ONBOARD-05): local staging list via AddContentTabs, DB contact 0 (D-03)
- buildDraft pure mapper: title derivation (도쿄 모아 / custom 모아), local-tz YYYY-MM-DD (no UTC shift), `TripCreateDraftSchema.parse` submit gate (T-24-10)
- handleSubmit: `createMoaDraft` once → batch `addLink` + `triggerExtraction` (fire-and-forget, source_kind !== 'manual') + `addManualPlace` → `router.replace('/moa/{id}')`; 건너뛰기 = same submit with 0 seeds

## Decisions Made
- **page.tsx wiring deferred to Task 3.** Plan file lists put page.tsx in Tasks 1 & 3 (not 2). Tasks 1/2 rendered step-2/4 as typechecking placeholders (`noUnusedLocals` forced declaring only per-task state); Task 3's GREEN commit swapped in StepDates/StepSeed and added range/seed/submitting state. Clean surgical progression.
- **건너뛰기 shares handleSubmit** — skip is just submit with nothing staged; matches Test 8 (no addLink/addManualPlace, createMoaDraft still called).
- **v9 day_button classNames** — range styling applied via `[&_button]` descendant selectors because rdp v9 puts the clickable target in `day_button` inside the `day` cell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] grep-gate comment literals removed**
- **Found during:** Task 1 & Task 3 acceptance grep verification
- **Issue:** Doc comments contained the literal strings `localStorage` (page.tsx) and `toISOString` (build-draft.ts) — both acceptance gates require 0 occurrences. The comments were *documenting the prohibition* ("localStorage 금지", "toISOString 금지") but the literal grep flagged them as false positives.
- **Fix:** Reworded both comments to avoid the banned literals while preserving the intent ("초안 영속화 안 함", "UTC 변환 금지 — 하루 시프트 버그 회피"). Same for a `TripCreateDraftSchema.parse` comment mention that inflated the count to 2.
- **Files modified:** apps/web/app/onboarding/page.tsx, apps/web/app/onboarding/_lib/build-draft.ts
- **Commits:** 7e74a4d, dab3e9d

## Test Results
- `@moajoa/web`: **88 tests** green (was 85 → +3 onboarding; +5 build-draft already counted in prior run) across 16 files
  - build-draft: 5 cases (fixed→local YYYY-MM-DD, unset→null, title derivation chip/custom, companion null, schema.parse pass)
  - onboarding: 3 cases (unset path → createMoaDraft once + router.replace, staged link → addLink+triggerExtraction, skip → no addLink/addManualPlace)
- `pnpm --filter @moajoa/web typecheck`: exit 0
- `pnpm --filter @moajoa/web build`: PASS — `○ /onboarding` (26.7 kB) built, no `noUncheckedIndexedAccess` blocker
- No `.js` workspace imports (grep 0); iOS untouched (0 files)

## Threat Model Compliance
- **T-24-10** (wizard input → trips INSERT): `TripCreateDraftSchema.parse` enforced inside buildDraft — city_code ≤20, companion ≤20, dates both-or-null refine. ✓
- **T-24-11** (link URL input): AddContentTabs validates via `new URL()` before calling onAddLink; addLink server-normalizes + LinkSchema zod. ✓
- **T-24-12** (resolve-place abuse): search fires only on explicit 검색 button / Enter (no auto-fire per keystroke); EF RequestSchema + Bearer JWT gate existing. ✓
- **T-24-13** (coordinate forgery): addManualPlace sends only google_place_id — server RPC resolves coordinates. ✓

## TDD Gate Compliance
Task 3 ran two full RED→GREEN cycles. RED commits (e2138e3 build-draft, 75f7539 onboarding) failed as expected (import resolution / missing submit wiring); GREEN commits (3693405, dab3e9d) passed. No unexpected passing tests during RED.

## Next Phase Readiness
- AddContentTabs is exported from `@/components` with a stable contract (`onAddLink`/`onPickPlace`/`busy`) — 24-07 add-sheet can wrap it in a BottomSheet and reuse verbatim.
- Onboarding is the D-01 branch target (24-03 redirects 0-moa users to `/onboarding`); full loop testable once remote `supabase db push` lands (human-action gate still open, per STATE.md).

## Self-Check: PASSED

All 10 declared files exist on disk; all 6 task commits resolve in git history.

---
*Phase: 24-host-flow*
*Completed: 2026-07-08*
