---
phase: 17-trip-foundation-ia
verified: 2026-06-21T23:45:00Z
status: passed
score: 6/6 roadmap success criteria verified (NAV-01..04, ATTR-01, SETUP-01/02 — all 7 requirement IDs satisfied)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification_note: "NAV-02/NAV-03 are Expo Router runtime behaviors verified by on-device sim UAT (user approved per 17-04-SUMMARY); accepted as evidence per verification context. No NEW human verification required — phase passes."
---

# Phase 17: Trip Foundation & IA 재편 Verification Report

**Phase Goal:** 여행이 일급 컨텍스트가 되고, 앱 진입이 여행 4탭으로 재편되며, 모든 후속 phase가 import할 트립 스코프 식별자 계약이 잠긴다. "일정 정해짐" 경로로 날짜·도시·대표를 입력해 여행을 만들 수 있다. (0016 마이그레이션 + core 식별자 계약 + Expo Router 여행 4탭 + 진입분기 + 일정 정해짐 경로)
**Verified:** 2026-06-21T23:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (roadmap SC) | Status | Evidence |
| --- | ------------------ | ------ | -------- |
| 1 | 앱 진입: 0개→온보딩, 1개→그 여행, 2개+→마지막 본 여행 (NAV-01) | ✓ VERIFIED | `decideEntryRoute` in `packages/core/src/entry-route.ts` implements 0/1/N + delete-fallback (5/5 vitest). `apps/ios/app/index.tsx` wires it end-to-end: `listMyTrips` + `TripKeys.LastTripId` → `decideEntryRoute` → `<Redirect href="/onboarding">` (0) / `/trip/{id}/plan` (1/N). On-device sim UAT approved. |
| 2 | 여행 안 하단 4탭(지도·플랜·예약·가계부) 항상 보임 (NAV-02) | ✓ VERIFIED | `app/trip/[id]/(tabs)/_layout.tsx`: `<Tabs>` + exactly 4 `Tabs.Screen`, tab-bar style copied verbatim, `headerShown:false`, plan default, no FAB, no `name="new"`. Map/plan/book/ledger screens all present. Runtime always-visible-bar confirmed by sim UAT. |
| 3 | 헤더에서 새 여행·여행 전환·내 정보 접근 (새 여행 별도 탭 아님) (NAV-03) | ✓ VERIFIED | `app/trip/[id]/header.tsx`: 현재 여행 ▾ switcher (left), profile → `/me` (right), `새 여행 만들기` accessibility label; no FAB anywhere; `app/trip/[id]/_layout.tsx` owns header via parent Stack `useGlobalSearchParams` (Pitfall 1 split). Sim UAT approved. |
| 4 | 일정 정해진 경우 날짜·도시 입력 + 대표 지정해 여행 생성 (SETUP-01/02) | ✓ VERIFIED | `app/trip/create.tsx`: `canSave = !!cityCode && !!cityKo && hasDateRange` (city AND date gate CTA), `TripCreateSchema.parse` before `createTrip`, `만든 사람이 대표(결제자)예요` caption, `router.replace('/trip/{id}/plan')` on success. `representative_id` auto-set by `trips_default_representative` trigger in 0016 (coalesce auth.uid()). |
| 5 | 라우트 위생: 옛 라우트 제거/이전, 신규 공유 경로 (웹 /t/[slug], 앱 /trip/[id]) 동작 (NAV-04) | ✓ VERIFIED | iOS: `app/boards/` + `app/(tabs)/` both removed; share-handler lands `/trip/{id}/plan`. Web: `b/[slug]` removed, `t/[slug]/{page,error,not-found,opengraph-image}.tsx` + 3 `_components` present, `public_trip_view` wired, 0 `public_board_view` leftover, `/api/revalidate` intact. EF + api layer trips-native. Literal-old-link gate waived (external users = 0, D-15). |
| 6 | 예약 딥링크가 trip(+place) 컨텍스트 SubID로 생성 (단일 헬퍼, Day1 포맷) (ATTR-01) | ✓ VERIFIED | `packages/core/src/booking.ts`: `buildAffiliateUrl` is sole helper, re-parses `subId` via `ClickTokenSchema` (`/^c_[0-9A-Za-z]{8,30}$/`), provider-correct injection (`sub_id` travelpayouts / `campaign` stay22), `BookingClickContextSchema` (tripId/userId UUID + optional placeId). 15/15 booking vitest. Pitfall 1 grep guard: no affiliate literal outside booking.ts. |

**Score:** 6/6 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/schemas/trip.ts` | Trip/TripId/TripCreate Zod contract | ✓ VERIFIED | 52 lines; `TripCreateSchema` (required dates + `.refine(end>=start)`), `TripId`, `representative_id`. board.ts deleted (clean break). |
| `packages/core/src/entry-route.ts` | decideEntryRoute 0/1/N | ✓ VERIFIED | Pure fn, delete-fallback edge, noUncheckedIndexedAccess-guarded. 5/5 tests. |
| `packages/core/vitest.config.ts` | vitest runner wiring | ✓ VERIFIED | `test: vitest run`; full suite 50/50 green. |
| `packages/core/src/booking.ts` | buildAffiliateUrl + token + context | ✓ VERIFIED | Single helper, runtime token re-parse, both provider branches inject token. |
| `supabase/migrations/0016_trips_baseline.sql` | trips-native squash | ✓ VERIFIED | 810 lines; create table trips, representative_id (×5), booking_clicks, public_trip_view (0 public_board_view), join_shared_trip, 5 DEFINER helpers, summary_ko/confidence/source_kind/inferred_city folded, geog+GIST, 0 board_id, 0 profiles_create_first_board (BLOCKER 1 honored). Only 0016 active; 0001-0014 archived (14 files). |
| `packages/api/src/queries/trips.ts` | trip CRUD + public_trip_view RPC | ✓ VERIFIED | 172 lines; listMyTrips/createTrip/...getPublicTripBySlug, `.from('trips')`, `rpc('public_trip_view')` (line 169). boards.ts removed. |
| `apps/ios/app/trip/[id]/(tabs)/_layout.tsx` | 4-tab nav | ✓ VERIFIED | 4 Tabs.Screen, no FAB/new. |
| `apps/ios/app/trip/[id]/_layout.tsx` | trip Stack header | ✓ VERIFIED | useGlobalSearchParams, header split. |
| `apps/ios/app/index.tsx` | 0/1/N entry | ✓ VERIFIED | decideEntryRoute + auth scaffold + error-retry; 0 old (tabs)/boards redirect. |
| `apps/ios/app/trip/create.tsx` | 일정 정해짐 form | ✓ VERIFIED | TripCreateSchema gate + createTrip + 대표 caption. |
| `apps/ios/app/onboarding.tsx` | 정해졌나요? branch | ✓ VERIFIED | 정해짐→/trip/create, 미정 disabled neutral "곧 제공". |
| `apps/web/app/t/[slug]/page.tsx` | public trip SSR | ✓ VERIFIED | public_trip_view backed; full tree moved; /b removed. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| index.tsx | decideEntryRoute + /trip/{id}/plan | Redirect on resolved route | ✓ WIRED | `Promise.all([listMyTrips, AsyncStorage.getItem(LastTripId)])` → decideEntryRoute → Redirect per kind. |
| share-handler.tsx | /trip/{tripId}/plan | router.replace after addAndNavigate | ✓ WIRED | `/trip/` landing (×2); `/boards/` routing removed (sole match is a component import path). |
| trip/create.tsx | /trip/{id}/plan | router.replace on success | ✓ WIRED | router.replace + /trip/. |
| trips RLS | am_trip_owner/member + can_*_trip | SECURITY DEFINER helper (no direct cross-table EXISTS) | ✓ WIRED | 27 helper refs; trips/memberships policies use helpers; votes/places EXISTS delegate the auth decision to `can_*_trip` DEFINER (0001 pattern). `db reset` applied 0016 clean, no 42P17. |
| packages/api trips.ts | public_trip_view RPC | client.rpc | ✓ WIRED | `client.rpc('public_trip_view', { p_slug: slug })` line 169. |
| web page.tsx | public_trip_view RPC | cached fetch | ✓ WIRED | public-trip-cache.ts → getPublicTripBySlug → public_trip_view. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| index.tsx | `route` (entry decision) | `listMyTrips(supabase)` (real DB query, trips-native) → decideEntryRoute | ✓ Yes | ✓ FLOWING |
| trip/[id]/(tabs)/map.tsx | trip/links/places | `getTrip`/`listLinksByTrip`/`listPlacesByTrip` (real queries) + broadcast refresh; confidence read intact | ✓ Yes | ✓ FLOWING |
| trip/create.tsx | created trip | `createTrip` (real INSERT, representative trigger) | ✓ Yes | ✓ FLOWING |
| web t/[slug]/page.tsx | public trip view | `public_trip_view` RPC (curated 0013 column set) | ✓ Yes | ✓ FLOWING |
| trip/[id]/(tabs)/{book,ledger,plan}.tsx | n/a (intentional empty-state/stub) | n/a (D-11 — Phase 18/20/21 fill) | n/a | ✓ INTENTIONAL (scoped placeholder, not hollow) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| core contract suite | `pnpm --filter @moajoa/core test` | 50/50 (entry-route 5, category 22, booking 15, trip 8) | ✓ PASS |
| api typecheck | `pnpm --filter @moajoa/api typecheck` | tsc 0 errors | ✓ PASS |
| iOS jest | `pnpm --filter @moajoa/ios test -- --watchman=false` | 72/72 (12 suites) | ✓ PASS |
| iOS typecheck | `pnpm --filter @moajoa/ios typecheck` | tsc 0 errors | ✓ PASS |
| web typecheck | `pnpm --filter @moajoa/web typecheck` | tsc 0 errors | ✓ PASS |
| affiliate literal guard | grep stay22/tp.st/marker= outside booking.ts | empty (guard holds) | ✓ PASS |
| commit existence | `git cat-file -t` × 16 hashes | all 16 present (incl. TDD RED/GREEN pairs) | ✓ PASS |
| 0016 sole active migration | `ls supabase/migrations/*.sql` | only 0016; 0001-0014 in _archive (14) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| NAV-01 | 17-01, 17-04 | 진입분기 0/1/N | ✓ SATISFIED | decideEntryRoute (core, 5/5) + index.tsx wiring + sim UAT. REQUIREMENTS.md marks Complete. |
| NAV-02 | 17-04 | 하단 4탭 항상 보임 | ✓ SATISFIED | 4-tab layout + sim UAT (runtime-only, user approved). |
| NAV-03 | 17-04 | 헤더 새여행/전환/내정보 | ✓ SATISFIED | header.tsx switcher+profile, no FAB + sim UAT. |
| NAV-04 | 17-03, 17-04, 17-05 | 라우트 위생 | ✓ SATISFIED | iOS old routes removed + /trip/; web /t/[slug] + public_trip_view; api/EF trips-native. |
| ATTR-01 | 17-02 | 예약 SubID 단일 헬퍼 | ✓ SATISFIED | buildAffiliateUrl contract locked (15/15) + grep guard. |
| SETUP-01 | 17-01, 17-05 | 일정 정해짐 날짜·도시 입력 | ✓ SATISFIED | TripCreateSchema required dates + create form city+date gate. |
| SETUP-02 | 17-01, 17-03, 17-05 | 대표(결제자) 지정 | ✓ SATISFIED | representative_id column + trips_default_representative trigger + caption. |

**Orphaned requirements:** None. REQUIREMENTS.md maps exactly NAV-01..04, ATTR-01, SETUP-01/02 to Phase 17 (7 IDs); all 7 appear in plan frontmatter and all 7 are verified. POLL-01..03 explicitly mapped to Phase 19 (not this phase).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| trip/[id]/(tabs)/book.tsx, ledger.tsx | — | "곧 제공돼요" neutral stub | ℹ️ Info | INTENTIONAL per D-11 — IA-completeness placeholders owned by Phase 20/21. Not a hollow feature; no requirement claims these complete. |
| trip/[id]/(tabs)/plan.tsx | — | empty-state only | ℹ️ Info | INTENTIONAL — Phase 18 fills plan content; 17-04 ships empty state by design. |
| map.tsx:95, share-handler.tsx:34 | — | `addLink({ board_id: ... })` | ℹ️ Info | ACCEPTED DEVIATION — core `LinkAdd` INPUT field name, mapped to trip_id at api boundary; core-input rename deferred to a later plan (not a phase-17 gap). |
| 0016 migration | — | no signature_menu column | ℹ️ Info | ACCEPTED DEVIATION — WIP 0015 discarded this session; squash folds 0001-0014 only. Comment notes absence. |

No blocker or warning anti-patterns. No TODO/FIXME/placeholder comments in any core logic file (trip.ts, entry-route.ts, booking.ts, index.tsx, onboarding.tsx, create.tsx).

### Human Verification Required

None outstanding. NAV-02/NAV-03 (and the runtime portions of NAV-01/NAV-04) are Expo Router runtime behaviors that grep/jest cannot prove; these were verified by on-device `pnpm sim` UAT and approved by the user ("굿"/approved, recorded in 17-04-SUMMARY against a trips-native remote). Per the verification context, the user's on-device approval is accepted as the evidence for these. No new human testing is required for this phase to pass.

### Gaps Summary

No gaps. All 6 ROADMAP success criteria are verified against the actual codebase, all 7 requirement IDs (NAV-01..04, ATTR-01, SETUP-01/02) are satisfied, all 5 plans' must-haves hold at the artifact, wiring, and data-flow levels, and all automated gates were independently re-run green (core 50/50, api/ios/web typecheck 0 errors, iOS jest 72/72, affiliate grep guard, 0016 sole active migration, 16 commits present). The four ℹ️ Info items are documented, accepted deviations explicitly out of phase-17 scope — none reduce the phase contract. The deferred-items.md entries (failed-links recovery UI, orphaned coachmark) are out-of-scope discoveries for future phases, consistent with the clean-break IA, and do not block the phase goal.

---

_Verified: 2026-06-21T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
