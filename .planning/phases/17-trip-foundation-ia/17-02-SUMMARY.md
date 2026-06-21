---
phase: 17-trip-foundation-ia
plan: 02
subsystem: api
tags: [zod, affiliate, attribution, travelpayouts, stay22, booking, tdd]

# Dependency graph
requires:
  - phase: 17-trip-foundation-ia (17-01)
    provides: "@moajoa/core vitest binding + barrel (schemas + entry-route) to extend"
provides:
  - "buildAffiliateUrl — the single helper that produces affiliate deep links (hand assembly impossible)"
  - "ClickTokenSchema — opaque c_<base62> 8-30 token contract (Travelpayouts ∩ Stay22 charset)"
  - "BookingClickContextSchema — trip-scoped UUID context with optional placeId (D-04)"
  - "AffiliateProvider / AffiliateProviderType — provider enum"
affects: [20-booking, "Phase 20 redirect Edge Function", "booking_clicks token minting"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-construction-path: one helper is the only way to build an affiliate URL (Pitfall 1, D-06)"
    - "Schema-at-the-boundary: helper re-parses subId through ClickTokenSchema so attribution cannot silently break"
    - "Provider-correct injection: sub_id (travelpayouts) vs campaign (stay22) chosen per provider branch"

key-files:
  created:
    - packages/core/src/booking.ts
    - packages/core/src/booking.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "ClickToken is a plain string at the type level (no zod brand) — the invalid-token guard is runtime via ClickTokenSchema.parse, not compile-time"
  - "Phase 17 locks contract only: base URLs / marker IDs / aid are PLACEHOLDER, env-wired in Phase 20 (D-06/D-07)"

patterns-established:
  - "Pitfall 1 grep guard: no affiliate URL literal (stay22.com/tp.st/marker=) may exist outside booking.ts"
  - "Token charset = base62 only ([0-9A-Za-z]) = intersection of both providers' allowed charsets, avoiding . - _ that one provider rejects"

requirements-completed: [ATTR-01]

# Metrics
duration: 4min
completed: 2026-06-21
---

# Phase 17 Plan 02: Affiliate Attribution Contract (ATTR-01) Summary

**`buildAffiliateUrl` is now the single construction path for affiliate deep links in `@moajoa/core`, with an opaque `c_<base62>` SubID token (`ClickTokenSchema`) structurally guaranteed present at the provider-correct injection site (`sub_id` for Travelpayouts, `campaign` for Stay22) and a UUID-validated trip-click context (`BookingClickContextSchema`).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-21T20:57:25+09:00 (RED commit)
- **Completed:** 2026-06-21T20:58:32+09:00 (GREEN commit)
- **Tasks:** 1 TDD feature (RED → GREEN; no REFACTOR needed)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `buildAffiliateUrl(provider, productParams, subId)` — the ONLY affiliate-URL builder; re-parses `subId` through `ClickTokenSchema` so an invalid/missing token throws instead of silently breaking attribution (Pitfall 1, D-06).
- `ClickTokenSchema = /^c_[0-9A-Za-z]{8,30}$/` — base62-only (Travelpayouts ∩ Stay22 charset), length 8-30 << 128 (Pitfall 5); rejects `. - _`, no-prefix, over/under length.
- `BookingClickContextSchema` — `tripId`/`userId` required UUIDs + optional `placeId` UUID (D-04).
- `AffiliateProvider` / `AffiliateProviderType` exported; all surfaced through `@moajoa/core` barrel (existing trip/entry-route exports intact).
- Pitfall 1 grep guard passes: no affiliate URL literal outside `booking.ts`.

## Task Commits

TDD feature, RED → GREEN (no REFACTOR — implementation already minimal, single-helper invariant clean):

1. **RED — failing tests for buildAffiliateUrl + SubID token** — `d014c2d` (test)
2. **GREEN — lock buildAffiliateUrl + opaque SubID token contract** — `35520a8` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — committed separately as `docs(17-02)`.

## Files Created/Modified
- `packages/core/src/booking.ts` — `buildAffiliateUrl` + `ClickTokenSchema`/`ClickToken` + `BookingClickContextSchema`/`BookingClickContext` + `AffiliateProvider`/`AffiliateProviderType`.
- `packages/core/src/booking.test.ts` — 15 vitest cases (8 token, 3 context, 4 helper) mirroring `category.test.ts` style.
- `packages/core/src/index.ts` — added `export * from './booking'` alongside existing barrel exports.

## Decisions Made
- **ClickToken is an unbranded `string` at the type level.** `z.infer<typeof ClickTokenSchema>` resolves to `string`, so a bad token like `'bad.token'` is assignable to the `subId` parameter at compile time. The threat-model mitigation (T-17-04) is enforced at **runtime** by `buildAffiliateUrl` re-parsing `subId` through `ClickTokenSchema.parse`. The helper's runtime parse — not the type signature — is the real guard, and the tests assert the runtime throw.
- **Contract-only scope honored (D-06/D-07).** Base URLs / marker IDs / Stay22 `aid` are `PLACEHOLDER`; no `booking_clicks` INSERT, no redirect Edge Function, no env wiring — all Phase 20.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed an inaccurate `@ts-expect-error` directive in the test**
- **Found during:** GREEN phase (typecheck after implementation).
- **Issue:** The invalid-token test originally carried `// @ts-expect-error` on the `'bad.token'` call, asserting a compile-time rejection. But `ClickToken` is an unbranded `string`, so `'bad.token'` is a valid `string` argument — the directive was unused and `tsc` failed with `TS2578: Unused '@ts-expect-error' directive`.
- **Fix:** Removed the directive and clarified the test name/comment to state the guard is runtime (`ClickTokenSchema.parse` throws). The runtime `.toThrow()` assertion — which is what `must_haves.truths` actually requires ("Passing a non-ClickToken subId is rejected") — is unchanged and passes.
- **Files modified:** `packages/core/src/booking.test.ts`
- **Verification:** `pnpm --filter @moajoa/core typecheck` exit 0; `pnpm --filter @moajoa/core test` 50/50 green.
- **Committed in:** `35520a8` (GREEN commit — test fix bundled with the implementation it validates).

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect test assertion mechanism).
**Impact on plan:** No scope change. The plan skeleton implementation was used verbatim; only the test's invalid-token assertion was corrected from a (wrong) compile-time expectation to the (correct) runtime expectation. The attribution-cannot-silently-break invariant (T-17-04) is fully enforced and tested.

## Issues Encountered
- None beyond the deviation above. RED failed as expected (module-absent import error — the entire module is the unit under test); GREEN passed on first implementation.

## TDD Gate Compliance
- RED gate present: `d014c2d` `test(17-02): ...` (failed before implementation — `booking.ts` absent).
- GREEN gate present: `35520a8` `feat(17-02): ...` (15/15 booking tests pass, 50/50 full core suite).
- REFACTOR: not needed — implementation is the minimal single-helper form with no extra abstraction (plan: "keep the single-helper invariant; no extra abstraction").

## Verification Results
- `pnpm --filter @moajoa/core test booking` — 15/15 green (8 token + 3 context + 4 URL cases).
- `pnpm --filter @moajoa/core test` — full core suite 50/50 green (category 22 + entry-route 5 + booking 15 + trip 8).
- `pnpm --filter @moajoa/core typecheck` — exit 0.
- Pitfall 1 grep guard: `grep -rn "stay22.com\|tp.st\|marker=" packages/ apps/ supabase/ --include=*.ts --include=*.tsx | grep -v "packages/core/src/booking"` returns nothing.

## User Setup Required
None — contract-only plan, no external service configuration. (Real affiliate base URLs / marker IDs / Stay22 `aid` env wiring is Phase 20.)

## Next Phase Readiness
- ATTR-01 contract locked. Phase 20 can mint tokens into `booking_clicks` and build the redirect Edge Function on top of `buildAffiliateUrl` + `ClickTokenSchema` + `BookingClickContextSchema` without any way to hand-assemble an unattributed URL.
- The empty `booking_clicks` table is owned by Plan 17-03's squash migration (per plan note).

## Self-Check: PASSED
- FOUND: packages/core/src/booking.ts
- FOUND: packages/core/src/booking.test.ts
- FOUND: packages/core/src/index.ts (booking barrel export)
- FOUND: .planning/phases/17-trip-foundation-ia/17-02-SUMMARY.md
- FOUND: commit d014c2d (RED), 35520a8 (GREEN)

---
*Phase: 17-trip-foundation-ia*
*Completed: 2026-06-21*
