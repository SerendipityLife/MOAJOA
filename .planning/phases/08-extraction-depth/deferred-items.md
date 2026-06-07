# Phase 8 — Deferred Items (out-of-scope discoveries during execution)

## 08-03 (Wave 2, web summary_ko render)

### Pre-existing test failure: `apps/web/__tests__/marker-svg.test.ts` (5 failing)

- **Discovered during:** 08-03 Task 2 full `pnpm vitest run`.
- **Root cause:** The Phase 5 test (`feat(05-05)`) asserts the manual-pin fill is
  `fill="#0F172A"`, but a later commit (`feat(ui): port MOAJOA blue + IBM Plex …`)
  changed `apps/web/lib/marker-svg.ts` to emit `fill="#111827"` (and related palette
  shifts). The test was not updated to match the new design-system color.
- **Proof it is unrelated to 08-03:** stashing this plan's only working-tree change
  (`page.tsx`) and running `marker-svg.test.ts` alone still yields 5 failures. None of
  08-03's files touch `marker-svg.ts` or its test.
- **Scope decision:** Out of scope for 08-03 (SCOPE BOUNDARY — only auto-fix issues
  directly caused by the current task). NOT fixed here. The plan's own new test
  (`place-summary-list.test.tsx`, 4/4) and the other 8 suites pass; `tsc --noEmit` and
  `next build` are clean.
- **Suggested fix (future, trivial):** Update `marker-svg.test.ts` expected hexes to the
  current `lib/marker-svg.ts` palette (`#111827` for manual, verify AI fill too), or
  reconcile the design tokens. Best handled as a `/gsd-quick` Phase-5 test-sync, not a
  Phase-8 change.
