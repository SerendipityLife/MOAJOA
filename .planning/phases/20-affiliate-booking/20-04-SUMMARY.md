---
phase: 20-affiliate-booking
plan: 04
subsystem: api
tags: [supabase, typed-queries, booking, checklist, attribution, tdd]
requires:
  - "20-02: database.ts booking_checklist_items/booking_clicks types (0021 live-applied)"
  - "20-03: @moajoa/core checklist.ts ChecklistItem/ChecklistStatusType + booking.ts AffiliateProviderType"
provides:
  - "@moajoa/api bookings.ts — checklist CRUD + reconcile mirror + click logging (iOS 20-05~07 import seam)"
  - "logBookingClick as the SOLE todo→clicked auto-transition write path (D-11)"
  - "listClickedChecklistItemIds Set for book-tab un-check demotion (UI-SPEC Screen 3)"
affects:
  - "20-05/06/07 iOS surfaces import all booking queries from the @moajoa/api barrel"
tech-stack:
  added: []
  patterns:
    - "house query contract: client-first arg + { data, error } destructure + throw error (plans.ts mirror)"
    - "makeChain test harness extended with 'in'/'not' methods for batch-delete and null-filter chains"
key-files:
  created:
    - packages/api/src/queries/bookings.ts
    - packages/api/src/queries/bookings.test.ts
  modified:
    - packages/api/src/queries/index.ts
key-decisions:
  - "reconcileChecklist mirrors the core-derived diff only — zero conditional derivation logic in api (T-20-11 single definition)"
  - "logBookingClick transition guarded with .eq('status','todo') — already-done items stay done (완료의 원천은 사용자)"
  - "wrapper throws on click-log failure; fire-and-forget swallowing is the iOS caller's .catch responsibility (D-14)"
metrics:
  duration: "~4min"
  completed: "2026-07-02"
  tasks: 2
  tests: "api 59/59 green (42 prior + 17 new)"
status: complete
---

# Phase 20 Plan 04: Bookings Typed Query Layer Summary

**One-liner:** @moajoa/api bookings.ts — checklist CRUD + core-diff reconcile mirror + booking_clicks logging with D-11 todo→clicked sole-path transition, all RLS-only house contract (17 new tests, api 59/59 green).

## What Was Built

`packages/api/src/queries/bookings.ts` — the single data seam both iOS surfaces (plan/book tabs) share (D-03):

| Export | Behavior |
|---|---|
| `listChecklist(client, tripId)` | `booking_checklist_items` select `*` scoped by trip, `created_at` order |
| `addManualItem(client, {trip_id, title})` | insert kind `custom` / source `manual` / status `todo` + `.select('*').single()` — title validation is the caller's (core `ManualItemTitleSchema`), DB CHECK 1..80 is last defense |
| `setItemStatus(client, itemId, status)` | user-driven todo/clicked/done transition (D-15 path) |
| `deleteChecklistItem(client, itemId)` | delete by id |
| `reconcileChecklist(client, tripId, derived)` | mirrors `{ toInsert, toDeleteIds }` only — stamps trip_id/source `auto`/status `todo` on inserts, batch `.delete().in('id', ids)`; empty arrays skip the call entirely; unique-conflict throws (re-fetch recovers) |
| `logBookingClick(client, input)` | `booking_clicks` insert, then iff `checklist_item_id` present: `.update({status:'clicked'}).eq('id', id).eq('status','todo')` — D-11 sole auto-transition path |
| `listClickedChecklistItemIds(client, tripId)` | clicked-ever Set from non-null `checklist_item_id` rows (book-tab un-check demotion judgment) |

`bookings.test.ts` — 17 cases on the plans.test.ts makeChain harness, extended with `in`/`not` methods. Barrel `index.ts` +1 line.

## Verification Evidence

- TDD gates: RED commit `a1f5325` (suite fails on missing module) → GREEN commit `9d58604`
- `pnpm --filter @moajoa/api test` — **59/59 green** (bookings 17 + date-polls 26 + plans 16)
- `pnpm --filter @moajoa/api typecheck` — exit 0 (against 20-02 regenerated database.ts)
- Grep gates all PASS: barrel export ==1 · RLS helper names in bookings.ts ==0 (RLS-only, no client-side membership check) · `deriveChecklistAutos` in bookings.ts ==0 (derivation stays in core) · makeChain in test >=1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Gate compliance] Reworded reconcile doc-comment to avoid `deriveChecklistAutos` literal**
- **Found during:** Task 2 acceptance grep
- **Issue:** The `reconcileChecklist` doc-comment named the core function verbatim, tripping the `grep -c "deriveChecklistAutos" == 0` gate (comment-only false positive — code path had zero derivation)
- **Fix:** Reworded to "@moajoa/core's pure auto-derivation" per the plan's own reword instruction (mirrors the 19-02 comment-reword precedent)
- **Files modified:** packages/api/src/queries/bookings.ts
- **Commit:** 9d58604 (folded into GREEN)

## TDD Gate Compliance

RED (`test(20-04)` a1f5325) → GREEN (`feat(20-04)` 9d58604). No refactor commit needed.

## Known Stubs

None — every function is wired to live 0021 tables.

## Handoff to iOS Plans (20-05~07)

- Import everything from the `@moajoa/api` barrel.
- Compose reconcile client-side: `listChecklist` → core derivation → `reconcileChecklist`.
- `logBookingClick` THROWS — the iOS click handler owns the `.catch(() => {})` swallow (D-14).
- Un-check demotion: `listClickedChecklistItemIds` Set membership decides clicked-vs-todo landing.

## Self-Check: PASSED

- packages/api/src/queries/bookings.ts — FOUND
- packages/api/src/queries/bookings.test.ts — FOUND
- Commits a1f5325, 9d58604 — FOUND in git log
