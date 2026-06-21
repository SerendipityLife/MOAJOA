# Phase 17 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in this phase).

## 17-04 (Trip IA restructure)

- **Failed-pending-links screen (Phase 7) lost its route + entry point.**
  The clean break (D-13) deletes the entire `apps/ios/app/boards/` tree, which
  included `boards/failed.tsx` (the FailedLinksScreen, Phase 7) and its only entry
  point — the failed banner in `(tabs)/boards.tsx`. The underlying `lib/pending.ts`
  failed-pending state (`listFailedPending`, `restoreFailedPending`) survives, but
  there is no surviving UI to surface it under the trip IA. The plan explicitly
  mandates deleting `boards/failed.tsx`; re-homing the failed-links list under the
  trip shell (e.g. a `/trip/[id]/...` route or a `me` sub-screen) is NOT in 17-04
  scope. Re-introduce in a future plan/phase that owns failed-link recovery UX.
  - Co-deleted with the screen: `__tests__/failed-screen.test.tsx` (tested the
    now-removed screen).

- **`components/onboarding/coachmark.tsx` orphaned.**
  Only `(tabs)/_layout.tsx` rendered `<Coachmark />`. The global `(tabs)` group is
  deleted in 17-04, so Coachmark now has no importer. It is a standalone,
  pre-existing component (NOT created by 17-04) — left in place per CLAUDE.md §3.3
  (don't delete pre-existing dead code unless asked). The first-run tab coachmark
  may be re-introduced or removed deliberately in a later IA plan.
