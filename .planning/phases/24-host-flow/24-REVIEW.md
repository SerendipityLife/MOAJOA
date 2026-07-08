---
phase: 24-host-flow
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - apps/web/app/moa/page.tsx
  - apps/web/app/moa/[id]/page.tsx
  - apps/web/app/moa/[id]/_components/moa-island.tsx
  - apps/web/app/moa/[id]/_components/moa-map.tsx
  - apps/web/app/moa/[id]/_components/place-list.tsx
  - apps/web/app/moa/[id]/_components/place-sheet.tsx
  - apps/web/app/moa/[id]/_components/add-sheet.tsx
  - apps/web/app/moa/[id]/_components/share-sheet.tsx
  - apps/web/app/login/page.tsx
  - apps/web/app/auth/callback/route.ts
  - apps/web/app/onboarding/page.tsx
  - apps/web/app/onboarding/_components/step-where.tsx
  - apps/web/app/onboarding/_components/step-dates.tsx
  - apps/web/app/onboarding/_components/step-who.tsx
  - apps/web/app/onboarding/_components/step-seed.tsx
  - apps/web/app/onboarding/_lib/build-draft.ts
  - apps/web/components/add-content-tabs.tsx
  - apps/web/components/index.ts
  - apps/web/lib/marker-svg.ts
  - apps/web/lib/member-color.ts
  - apps/web/lib/place-sort.ts
  - packages/api/src/queries/trips.ts
  - packages/api/src/queries/memberships.ts
  - packages/api/src/queries/profiles.ts
  - packages/api/src/queries/index.ts
  - packages/ui-tokens/src/index.ts
  - supabase/migrations/0026_realtime_publication.sql
  - supabase/tests/realtime_events_smoke.mjs
  - supabase/tests/realtime_publication_smoke.sh
  - packages/api/src/queries/links.ts (cross-referenced)
findings:
  critical: 0
  high: 1
  medium: 2
  low: 3
  total: 6
findings_count: 6
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-08
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 24 assembles existing contracts (0024 seq_no server-mint, 0025 share_mode/companion, `shareMoa`, `moaChannelName`, `resolve-place` EF) into the `/onboarding`, `/moa`, `/moa/[id]` surfaces. Contract adherence is strong and the highest-risk areas are correct:

- **Security is clean.** No service-role key or secret is reachable from the client bundle — every client path goes through `getSupabaseBrowser()` / `functions.invoke`. The service-role key appears only in `supabase/tests/realtime_events_smoke.mjs`, a local harness that reads it from `supabase status` (not shipped). `buildMarkerIconUrl` preserves the no-injection contract (only ui-tokens literals interpolated into SVG). Open-redirect guards (`startsWith('/') && !startsWith('//')`) are present in both login and callback. `createMoaDraft` never sends `seq_no`; the smoke test asserts WALRUS RLS filters non-members.
- **Realtime lifecycle is correct.** `moa-island` uses one channel per screen, cleans up via `removeChannel`, and reconciles via refetch (not payload patching). `moa-map` creates the map once and diffs markers (no re-init) — the Pitfall 4 regression is avoided and marker removal cleans up (`marker.setMap(null)`), so no marker leak.
- **Contract adherence verified.** `shareMoa` preserves slug and updates mode (D-19); `sortByLove` is non-mutating (`[...places].sort`); `createMoaDraft` is additive (leaves `createTrip` untouched); date formatting in `build-draft` uses local-time components (no UTC day-shift); migration 0026 is append-only. No `.js` workspace-import extensions, no `apps/ios` changes.

The findings below are correctness/UX defects, not security or data-loss issues. The most material one (H-01) is a permanent stuck-spinner reachable by pasting any non-YouTube/blog/Instagram URL — a normal user action the UI invites.

## High

### H-01: Unrecognized ("manual") links get stuck on "분석 중…" forever

**File:** `apps/web/app/moa/[id]/_components/place-list.tsx:72-74` (with `apps/web/app/moa/[id]/_components/add-sheet.tsx:31`, `apps/web/app/onboarding/page.tsx:86`)
**Issue:** `AddContentTabs` accepts any URL that passes `new URL()` (add-content-tabs.tsx:44-49). For a link whose host is not YouTube/Instagram/a known blog platform, `detectSourceKind` returns `null` → `addLink` stores `source_kind: 'manual'` (links.ts:30) with the DB default `extraction_status = 'pending'` (0016 baseline:374). Both call sites deliberately skip extraction for manual links (`if (link.source_kind !== 'manual') triggerExtraction`), and there is no DB trigger that transitions a manual link out of `pending`. In `place-list`, the `analyzing` bucket is `pending | processing`, so a manual link renders as a "분석 중…" spinner permanently — it never becomes a place, never enters the `failed` bucket, and gets no retry button. A user pasting e.g. a Naver news article, a Google Maps share URL, a TikTok link, or any plain website hits this dead state.
**Fix:** Treat manual links as terminal instead of analyzing. In the `analyzing` filter, exclude manual-kind links, and surface them as a failed/unsupported row (or drop them from the list). For example:
```typescript
// Only genuinely-in-flight extractions spin.
const analyzing = links.filter(
  (l) =>
    l.source_kind !== 'manual' &&
    (l.extraction_status === 'pending' || l.extraction_status === 'processing'),
);

// Manual links can't be extracted → treat as an unsupported/failed row (D-15 pattern).
const failed = links.filter(
  (l) =>
    l.source_kind === 'manual' ||
    l.extraction_status === 'failed' ||
    l.extraction_status === 'manual_review' ||
    (l.extraction_status === 'ready' && places.every((p) => p.link_id !== l.id)),
);
```
Alternatively, gate the paste input to supported hosts and reject unrecognized URLs in `AddContentTabs.submitLink`.

## Medium

### M-01: Onboarding step 2 lets "날짜 정했어요" proceed with no dates picked — the choice is silently discarded

**File:** `apps/web/app/onboarding/page.tsx:68-75` (with `apps/web/app/onboarding/_lib/build-draft.ts:22-27`)
**Issue:** `canProceed` for step 2 is only `dateMode !== null`. A user can select "날짜 정했어요" (`dateMode === 'fixed'`), never pick a range, and still advance. In `buildDraft`, `start`/`end` are gated on `input.range?.from`, so with no range both become `null`. `TripCreateDraftSchema` accepts both-null, so the moa is created as a **날짜 미정** trip even though the user explicitly said dates are fixed — with no warning. Their intent is lost.
**Fix:** Require a start date when the fixed mode is chosen:
```typescript
step === 2
  ? dateMode === 'unset' || (dateMode === 'fixed' && range?.from != null)
  : ...
```

### M-02: `reconcile` is not guarded against concurrent runs — multi-place extraction can fire duplicate/incorrect "장소 N개 추가됨" toasts

**File:** `apps/web/app/moa/[id]/_components/moa-island.tsx:85-110` (channel binding at 113-132)
**Issue:** A single extraction inserts multiple `places` rows, each emitting its own `postgres_changes` INSERT → each invokes `void reconcile()`. `reconcile` is async (awaits `listPlacesByTrip` + `getVoteCounts`) and computes `delta = nextPlaces.length - placeCountRef.current`, updating `placeCountRef` only at the very end. When several events arrive close together, multiple `reconcile` calls run concurrently, all read the same stale `placeCountRef.current`, all fetch the full new list, and each computes `delta > 0` → the "장소 N개 추가됨" toast can fire multiple times (and with an inflated N). The AddSheet-link path also races with the realtime path for the same reason.
**Fix:** Serialize reconcile and/or debounce the realtime handler. Minimal guard:
```typescript
const reconciling = useRef(false);
const reconcileQueued = useRef(false);
async function reconcile() {
  if (reconciling.current) { reconcileQueued.current = true; return; }
  reconciling.current = true;
  try { /* existing body */ }
  finally {
    reconciling.current = false;
    if (reconcileQueued.current) { reconcileQueued.current = false; void reconcile(); }
  }
}
```
Or coalesce bursts with a short trailing debounce before calling `reconcile`.

## Low

### L-01: Onboarding partial-seed failure lets a retry create a duplicate trip

**File:** `apps/web/app/onboarding/page.tsx:77-99`
**Issue:** `handleSubmit` creates the trip first (`createMoaDraft`), then loops `addLink`/`addManualPlace`. If a seed call throws mid-loop, the catch toasts and calls `setSubmitting(false)` — but the trip already exists. Pressing "모아 만들기" again runs `createMoaDraft` a second time, producing a duplicate empty/partial moa (and re-adding the earlier seeds). D-04 allows loss, but duplicate trips are a distinct outcome.
**Fix:** Remember the created trip id in a ref; on retry, reuse it (skip `createMoaDraft` and skip already-added seeds), or make seed failures non-fatal (`catch`-and-continue) and always `router.replace` to the new trip.

### L-02: `fitBounds` on the first single place over-zooms

**File:** `apps/web/app/moa/[id]/_components/moa-map.tsx:77-81`
**Issue:** When place count grows to exactly one, `fitBounds` on a degenerate one-point bounds makes Google Maps zoom to maximum, dropping the user into a street-level view. D-16 wants a sensible camera on new pins.
**Fix:** Cap the zoom after fitting a single/near-degenerate bounds, e.g. add a one-shot `bounds_changed`/`idle` listener that clamps `map.setZoom(Math.min(map.getZoom() ?? 15, 15))` when `current.length === 1`.

### L-03: Share URL is built from `window.location.origin` instead of the canonical app URL

**File:** `apps/web/app/moa/[id]/_components/share-sheet.tsx:54`
**Issue:** `const url = \`${window.location.origin}/t/${slug}\``. On a Vercel preview deployment or any non-canonical host, the copied/shared link points at that transient origin rather than the production domain. The research example used `NEXT_PUBLIC_APP_URL` for this reason.
**Fix:** `const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;` and build the URL from `base`.

---

_Reviewed: 2026-07-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
