---
phase: 20-affiliate-booking
plan: "03"
subsystem: core-domain
tags: [affiliate, deeplink, travelpayouts, checklist, zod, tdd]
requires:
  - "17-02: buildAffiliateUrl signature + ClickTokenSchema lock"
  - "constants.ts CITY_KO_MAP (9 city codes, D-09 alignment)"
provides:
  - "booking.ts: live travelpayouts spec (klook click / airalo media / kkday media-or-fallback) + TP_PROGRAMS + buildSearchDestUrl + buildAiraloDestUrl + buildDirectSearchUrl"
  - "booking-map.ts: BOOKING_REGION_MAP (9 keys) + COMPARE_LABELS (D-06 copy)"
  - "checklist.ts: ChecklistItemSchema + ManualItemTitleSchema + deriveChecklistAutos + isDesynced"
  - "category.ts: isBookableActivity (D-08)"
affects:
  - "20-04 (api reconcile/logBookingClick imports these contracts)"
  - "20-05..07 (iOS cards import builders + labels + derivation)"
tech-stack:
  added: []
  patterns:
    - "one-encode-per-layer URL nesting (inner query once, whole dest once more — Pitfall 7)"
    - "program-structure constants in core, account values (marker/trs) param-injected (T-20-10)"
    - "pure wanted-set diff reconcile with inviolable status/source guards (D-10/D-13)"
key-files:
  created:
    - packages/core/src/booking-map.ts
    - packages/core/src/booking-map.test.ts
    - packages/core/src/checklist.ts
    - packages/core/src/checklist.test.ts
  modified:
    - packages/core/src/booking.ts
    - packages/core/src/booking.test.ts
    - packages/core/src/category.ts
    - packages/core/src/category.test.ts
    - packages/core/src/index.ts
decisions:
  - "no-program travelpayouts call → generic tp.media/r passthrough (keeps 17-02 contract tests byte-identical)"
  - "requireParam guard: missing marker/dest throws instead of yielding 'undefined' URL segments"
  - "Pitfall 7 test asserts double-encoding at the DEST layer (wrapper %25 is correct per-layer nesting)"
metrics:
  duration: ~13m
  completed: 2026-07-02
status: complete
---

# Phase 20 Plan 03: Core Booking Domain Contracts Summary

**One-liner:** Live-measured travelpayouts deep-link assembly (Klook c137 click-form, Airalo tp.media p8310/c541, KKday media-or-tp.st-fallback) plus D-09 region map, D-06 compare labels, D-08 bookability, and the D-10/D-13 pure checklist derivation — all test-locked in @moajoa/core.

## Tasks

| Task | Name | Commits (RED + GREEN) |
|------|------|-----------------------|
| 1 | booking.ts 실규격 + 목적지/비제휴 빌더 | 4936324 + e0eb30b |
| 2 | booking-map.ts + isBookableActivity | da4fe30 + 4217ce9 |
| 3 | checklist.ts 스키마 + deriveChecklistAutos | 2e9afd0 + c7311c0 |

## What was built

### booking.ts (Task 1)
- `TP_PROGRAMS`: klook = click-form (`c137.travelpayouts.com`, promo_id 4110), airalo = media-form (p 8310, campaign_id 541) — public program IDs only. **marker/trs are never hardcoded** (`grep 745749` == 0; fixture lives only in tests).
- travelpayouts branch: klook → `/click?shmarker={marker}.{token}&promo_id=4110&source_type=customlink&type=click&custom_url={enc(dest)}&sub_id={token}`; airalo/kkday-with-template → `tp.media/r?marker={marker}.{token}&p&campaign_id[&trs]&u={enc(dest)}&sub_id={token}`; kkday fallback → `{fallback_base}?sub_id={token}`; kkday with neither → throw. No-program calls keep the 17-02 generic shape so the locked 15 legacy cases pass unmodified.
- `buildSearchDestUrl('klook'|'kkday', q)` (A1/A2 assumed paths — single fix point), `buildAiraloDestUrl(slug)`, `buildDirectSearchUrl('agoda'|'booking', {city,checkIn,checkOut})` (D-05 non-affiliate prefill) — all platform URL literals stay in this one file (Pitfall 1 / T-20-06).
- Korean place names: encoded exactly once per nesting layer; contract test round-trips `custom_url` → dest → raw `팀랩 플래닛`.
- 17-02 lock respected: signature, `ClickTokenSchema.parse` first line, stay22 branch — zero removed stay22 lines; `PLACEHOLDER` count == 1 (stay22 only).

### booking-map.ts + category.ts (Task 2)
- `BOOKING_REGION_MAP`: exactly the 9 CITY_KO_MAP keys. jp 6 → esimSlug `japan-esim`; kr 3 → esimSlug/transport null (D-09 억지 추천 금지). tokyo → JR 패스, osaka/kyoto → 간사이 패스 (klook), fukuoka/sapporo/okinawa → transport null. Zero URL literals (test-asserted + grep gate).
- `COMPARE_LABELS`: 5-provider copy locked verbatim to UI-SPEC Copywriting Contract (D-06).
- `isBookableActivity`: culture vibe true + theme-park needle list (`amusement/theme_park/aquarium/zoo/water_park` — nature-vibe overrides, D-08); food/cafe/shopping structurally false. Surgical append — placeVibe/RULES/VIBE_META untouched (0 deleted lines).

### checklist.ts (Task 3)
- Const-enums locked char-for-char to the 0021 CHECK values (kind 5 / status 3 / source 2 — 0021 file not yet on disk, wave-parallel with 20-02; RESEARCH-locked values used as the plan directs).
- `ChecklistItemSchema` (defaults `todo`/`auto`) + `ManualItemTitleSchema` (1..80).
- `deriveChecklistAutos`: wanted-set (stay always; esim/transport when covered; activities by place_id) diffed against existing **auto** rows. Inviolable: `status !== 'todo'` never deleted (D-13), `source === 'manual'` never emitted nor counted as dedup blocker (D-10).
- `isDesynced`: render-time '플랜에 없음' predicate — desync computed, never stored.

## Verification evidence

- `pnpm --filter @moajoa/core test` → **125/125 green** (77 baseline + 48 new; booking 34 ≥ 27, checklist 16 ≥ 10) — no regression.
- `pnpm --filter @moajoa/core typecheck` → exit 0.
- Domain-isolation gate: `grep -rlE "travelpayouts|tp.media|klook|kkday|airalo|agoda" packages/core/src` outside booking.(test.)ts → empty.
- Task-level grep gates all pass (PLACEHOLDER==1, 745749==0, stay22 removals==0, booking-map URL literals==0, category deletions==0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pitfall 7 test asserted double-encoding at the wrong layer**
- **Found during:** Task 1 GREEN
- **Issue:** The RED test asserted the assembled wrapper URL must not contain `encodeURIComponent(encodeURIComponent('팀랩 플래닛'))` — but the once-encoded dest legitimately re-encodes its `%` signs to `%25` when nested into `custom_url` (that IS the correct one-encode-per-layer spec the live 302 measurement shows).
- **Fix:** Moved the double-encoding assertion to the destination layer (`dest` must contain the once-encoded name, never the twice-encoded one); wrapper assertions kept (embeds `enc(dest)`, one decode restores dest, inner query decodes to raw Korean).
- **Files modified:** packages/core/src/booking.test.ts
- **Commit:** e0eb30b (folded into GREEN)

## TDD Gate Compliance

All 3 tasks: RED commit (failing tests) → GREEN commit (implementation). Gate sequence verified in git log (4936324→e0eb30b, da4fe30→4217ce9, 2e9afd0→c7311c0). No refactor commits needed.

## Known Stubs

None functional. The stay22 branch keeps its 17-02 `PLACEHOLDER` base URL by design (plan-mandated: stay22 env wiring is a later phase; acceptance gate requires exactly 1 PLACEHOLDER). KKday program template params (p/campaign_id) are intentionally caller-injected pending the dashboard copy step (20-05 Task 3 checkpoint — Open Q1); the tp.st fallback path is live-verified.

## Threat Flags

None — no new surface beyond the plan's threat model. T-20-01 (encode-only assembly), T-20-06 (domain isolation), T-20-10 (no marker/trs literals) all mitigated and gate-verified.

## Handoff

- **20-04 (api):** import `deriveChecklistAutos`/`ChecklistItem`/`isDesynced` for reconcile; `buildAffiliateUrl` productParams contract: `{program, marker, dest[, trs][, p, campaign_id][, fallback_base]}`.
- **20-05..07 (iOS):** `BOOKING_REGION_MAP[city]` null fields → hide card; `COMPARE_LABELS` for row copy; `buildSearchDestUrl(provider, transport.searchQuery)` + `buildAiraloDestUrl(esimSlug)` for dests; `buildDirectSearchUrl` for stay prefill; `isBookableActivity(place.category)` for activity strips.
- **Device UAT items carried:** A1/A2 Klook/KKday search-path landing (bot-blocked, fix point = buildSearchDestUrl only); A4 marker-dot SubID dashboard attribution check after first real click.

## Self-Check: PASSED

- packages/core/src/booking-map.ts — FOUND
- packages/core/src/booking-map.test.ts — FOUND
- packages/core/src/checklist.ts — FOUND
- packages/core/src/checklist.test.ts — FOUND
- Commits 4936324, e0eb30b, da4fe30, 4217ce9, 2e9afd0, c7311c0 — FOUND in git log
