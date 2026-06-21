---
phase: 17-trip-foundation-ia
reviewed: 2026-06-21T14:49:24Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - packages/core/src/schemas/trip.ts
  - packages/core/src/entry-route.ts
  - packages/core/src/booking.ts
  - packages/core/src/booking.test.ts
  - packages/core/src/constants.ts
  - packages/core/src/index.ts
  - packages/core/src/types/index.ts
  - packages/api/src/queries/trips.ts
  - packages/api/src/queries/links.ts
  - packages/api/src/queries/memberships.ts
  - packages/api/src/queries/places.ts
  - packages/api/src/queries/votes.ts
  - packages/api/src/types/database.ts
  - supabase/migrations/0016_trips_baseline.sql
  - supabase/functions/extract-youtube/index.ts
  - apps/ios/app/index.tsx
  - apps/ios/app/onboarding.tsx
  - apps/ios/app/trip/create.tsx
  - apps/ios/app/trip/[id]/_layout.tsx
  - apps/ios/app/trip/[id]/header.tsx
  - apps/ios/app/trip/[id]/(tabs)/_layout.tsx
  - apps/ios/app/trip/[id]/(tabs)/map.tsx
  - apps/ios/app/share-handler.tsx
  - apps/ios/lib/share-routing.ts
  - apps/ios/lib/share-board.ts
  - apps/ios/components/boards/trip-picker-sheet.tsx
  - apps/web/lib/public-trip-cache.ts
  - apps/web/app/t/[slug]/page.tsx
  - apps/web/app/api/revalidate/route.ts
findings:
  critical: 1
  high: 1
  medium: 1
  low: 1
  info: 2
  total: 6
status: resolved
resolved_inline:
  - CR-01  # fixed in 9ad881b (public_trip_view trip->board boundary remap)
  - HR-01  # fixed in b7bfc21 (iOS share URL /b -> /t)
deferred_followup:
  - MR-01  # pre-existing add_manual_place (0,0) coalesce — out of phase-17 scope, spun off as a task
---

# Phase 17: Code Review Report

**Reviewed:** 2026-06-21T14:49:24Z
**Depth:** deep (cross-file: SQL ↔ TS contract boundary + import graph)
**Files Reviewed:** 24 source files (excludes tests, planning artifacts, renamed-only migration archives)
**Status:** issues_found

## Summary

Phase 17 reframes `boards` → `trips`, rebuilds the iOS IA (0/1/N entry branch, trip-scoped Stack + 4-tab nav, onboarding + create), adds the affiliate/booking contract (`booking.ts`), squashes migrations into `0016_trips_baseline.sql`, and moves the web public route `/b/[slug]` → `/t/[slug]`.

The contract-level work is strong: the `0016` RLS uses SECURITY DEFINER helpers with `set search_path = public` exclusively (no direct cross-table `EXISTS` in any policy USING/WITH CHECK — 42P17-safe per §4.4), `join_shared_trip` hard-codes `role='voter'` + `auth.uid()` (no escalation), `booking.ts` forces every affiliate URL through `ClickTokenSchema.parse` (no hand assembly), the extract-youtube auth gate correctly uses `admin.auth.getUser(token)` to reject the anon key, and the revalidate webhook uses `timingSafeEqual` behind a length guard. No `.js`-extension workspace imports, no service-role leak to a client bundle, no new web trip-creation UI. Core test suite passes 50/50.

However, the `boards → trips` rename left **two breaks at the public-share boundary that crash or 404 the entire web share flow** — the headline feature of this phase ("iOS extraction → web voting"). Both slipped through because the web tests mock the data layer and never exercise the real SQL `public_trip_view` JSON shape.

## Resolution (gap closure, same session)

- **CR-01 — FIXED** (`9ad881b`): `getPublicTripBySlug` now remaps the RPC's top-level `trip` key to `board` so `PublicBoardView` SSR consumers resolve. The board→trip view-model rename stays deferred; this is the boundary bridge. (Did NOT edit the already-applied `0016` migration — append-only.)
- **HR-01 — FIXED** (`b7bfc21`): `share-board.ts` now builds `/t/{slug}`.
- **MR-01 — DEFERRED**: `add_manual_place` `(0,0)` coalesce is carried-forward from `0001` (not introduced by phase 17) and outside the manual-place scope of this phase. Spun off as a separate follow-up task.
- Residual gap noted: `packages/api` has no test runner, so there is no producer-side test asserting `getPublicTripBySlug` returns the `board` shape. Recommend adding api-level vitest + a regression test for this RPC contract in a follow-up.

All four delivered requirements remain satisfied; api/ios/web typecheck all green after the fixes.

## Critical Issues

### CR-01: `public_trip_view` returns key `trip`, but the type + every web consumer read `board` → public/shared trip page crashes on render

**File:** `supabase/migrations/0016_trips_baseline.sql:710` (vs. consumers `apps/web/app/t/[slug]/page.tsx:32,38,41,48,67,89,91,93,124,127` and `apps/web/app/t/[slug]/opengraph-image.tsx:67-68`)

**Issue:** The squashed `public_trip_view` RPC builds its result with the top-level key `'trip'`:

```sql
v_result := jsonb_build_object(
  'trip', jsonb_build_object( ... )   -- line 710
```

The archived original (`_archive/0013_public_view_place_detail.sql:38`) used `'board'`. The TS view-model `PublicBoardView` (`packages/core/src/types/index.ts:25` — `board: Pick<Trip, ...>`) and **every** web consumer still read `view.board.*`. `getPublicTripBySlug` (`packages/api/src/queries/trips.ts:165-172`) returns the raw RPC JSON cast `as PublicBoardView` with no remap. At runtime `view.board` is `undefined`, so `generateMetadata` (`view.board.city_code`) and `PublicBoardPage` (`view.board.title`) both throw `TypeError: Cannot read properties of undefined`. Every `/t/[slug]` render crashes.

The `trips.ts:161` doc comment asserts "the JSON shape returned by `public_trip_view` is structurally identical to the previous view" — it is not; the top-level key changed. The web tests (`apps/web/__tests__/metadata.test.ts:35,56,76,96`) mock `getPublicTripBySlug` to return `{ board: {...} }`, encoding the wrong key, so the real contract is untested.

**Fix:** Restore the original key in the RPC body so it matches the unchanged TS view-model (smallest, append-only-friendly change — the rename to `trip` is explicitly deferred per the accepted deviation):

```sql
  v_result := jsonb_build_object(
    'board', jsonb_build_object(   -- was 'trip'; consumers + PublicBoardView expect 'board'
      'id', v_trip.id,
      ...
```

Because `0016` is not yet applied to prod, edit it in place. Then add one test that asserts against the real `public_trip_view` JSON (or a fixture derived from it) instead of a hand-written `{ board }` mock, so the SQL↔TS key can't silently drift again.

## High

### HR-01: iOS share link still points at the deleted `/b/{slug}` route → every shared link 404s

**File:** `apps/ios/lib/share-board.ts:17`

**Issue:** Phase 17 (commit `3fc4873`, 17-05) moved the web public route `/b/[slug]` → `/t/[slug]` and deleted the old route (`apps/web/app/b/` is now empty; no redirect exists in `next.config`). The same phase (commit `4022b7e`, 17-04) edited `share-board.ts` to trip vocab but left the URL path unchanged:

```ts
const url = `${base}/b/${slug}`;   // route no longer exists → 404
```

This is reached in production: `apps/ios/app/trip/[id]/(tabs)/map.tsx:115` calls `shareCurrentTrip(id)`, which opens the native share sheet with this URL. Friends who tap a shared link get a 404 — breaking the core "iOS extraction → web voting" bridge this phase delivers.

**Fix:**

```ts
const url = `${base}/t/${slug}`;
```

Also update the stale comment on `share-board.ts:4` (`/b/{slug}` → `/t/{slug}`). Consider adding a permanent `/b/:slug → /t/:slug` redirect in `apps/web/next.config` so links already shared before this fix keep working.

## Medium

### MR-01: `add_manual_place` silently writes `(0,0)` coordinates when lat/lng are omitted

**File:** `supabase/migrations/0016_trips_baseline.sql:796`

**Issue:** `add_manual_place` defaults missing coordinates to the equator/prime-meridian:

```sql
coalesce(p_lat, 0), coalesce(p_lng, 0),
```

The `places` CHECK constraints (`lat between -90 and 90`, `lng between -180 and 180`) accept `0,0`, so a caller that resolves a Google Place but fails to pass coordinates inserts a pin in the Gulf of Guinea rather than erroring. The current sole legit caller (`packages/api/src/queries/places.ts:43-47`) passes only `p_trip_id`/`p_google_place_id`/`p_note` — it never sends lat/lng — so any row this path inserts before the resolve-place Edge Function backfills coordinates lands at `(0,0)`. This is a latent data-integrity bug carried forward verbatim from the pre-squash function; flagging because `0016` is the live definition and it is cheap to harden now.

**Fix:** Either reject the insert when coordinates are absent, or leave them NULL and make the columns nullable for manual pins pending resolution. Minimal version:

```sql
if p_lat is null or p_lng is null then
  raise exception 'add_manual_place: lat/lng required (resolve via Places API first)';
end if;
```

## Low

### LR-01: `getMyTripRole` issues a `trips` SELECT that RLS denies for non-owner members, masking the `member` result for shared trips

**File:** `packages/api/src/queries/memberships.ts:28-42`

**Issue:** `getMyTripRole` runs two queries in parallel — one against `trips` filtered by `owner_id = userId`, one against `memberships`. For a *member* (non-owner) of a shared trip, the `trips` query returns 0 rows (correct: they're not the owner), and the `memberships` query returns their accepted row, so the function returns `'member'`. That path is fine. The subtle issue: the `trips` SELECT relies on the `"trips: owner full access"` / `"trips: shared members can read"` policies; for a *pending* (not-yet-accepted) member, `am_trip_member` is false and the owner policy is false, so `.maybeSingle()` returns `null` with no error — the function returns `null` even though a (pending) relationship exists. This is likely the intended semantics (only accepted members count), but it is undocumented and easy to misread as a bug later. No incorrect access is granted.

**Fix:** Add a one-line comment that `null` deliberately covers the pending-invite case (accepted-only), so a future reader doesn't "fix" it into leaking pending state. No behavioral change required.

## Info

### IN-01: `ensure_share_slug` has no uniqueness-collision retry

**File:** `supabase/migrations/0016_trips_baseline.sql:158-174`

**Issue:** The slug is derived from `gen_random_bytes(8)` (~60 bits) against a `unique` column with no retry loop. A collision would surface as a clean unique-violation error on insert/update (not corruption), and is astronomically unlikely at this scale. Behavior is identical to the pre-squash original, so this is not a phase-17 regression — noting only for completeness.

**Fix:** None needed now; if slug-space ever shrinks, wrap generation in a bounded retry loop.

### IN-02: Web share page renders untrusted `link.thumbnail_url` / `link.url` as `<img src>` / `<a href>` from public data

**File:** `apps/web/app/t/[slug]/page.tsx:147,155-159`

**Issue:** `link.url` (anchor `href`) and `link.thumbnail_url` (`<img src>`) originate from user-submitted links surfaced via the anon `public_trip_view`. The anchor correctly uses `rel="noopener noreferrer"` and `target="_blank"`. React escapes attribute values, so this is not an injection vector; a `javascript:`-scheme `href` is the only residual concern, and link URLs are validated as http(s) at ingest (`share-routing.ts` `HttpUrlSchema`) and `original_url`/`url` are set from that validated value. No action required — recorded so the trust boundary is explicit for future reviewers.

---

_Reviewed: 2026-06-21T14:49:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
