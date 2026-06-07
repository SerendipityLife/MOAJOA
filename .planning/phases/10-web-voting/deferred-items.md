# Phase 10 — Deferred Items (out of scope, logged not fixed)

## Pre-existing test failures (discovered during 10-02 execution)

- **`apps/web/__tests__/marker-svg.test.ts`** — 5 failing assertions.
  - Symptom: tests expect `fill="#0F172A"` / `>?<` etc., but `buildMarkerIconUrl`
    now emits `fill="#111827" fill-opacity="1"` and a different path/SVG shape.
  - **Pre-existing**: reproduced at base commit `19186a8` (before any 10-02 change).
    Unrelated to web voting — marker SVG color/shape drift in `apps/web/lib`.
  - Disposition: NOT fixed in 10-02 (SCOPE BOUNDARY — only auto-fix issues directly
    caused by the current task's changes). Either the test or the marker generator
    is stale; needs its own surgical fix outside this plan.
