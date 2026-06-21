---
phase: 17
slug: trip-foundation-ia
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
updated: 2026-06-21
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed Validation Architecture lives in `17-RESEARCH.md` — the planner derives per-task tests from it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core — category.test.ts already exists; Wave 0 wires the runner). iOS uses jest (`pnpm --filter @moajoa/ios test`); web uses vitest. |
| **Config file** | none in packages/core yet — Wave 0 (Plan 01 Task 1) wires `vitest.config.ts` + `test` script |
| **Quick run command** | `pnpm --filter @moajoa/core test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~10 seconds (core unit-only); iOS/web suites add ~15-30s |

> NOTE (decideEntryRoute placement): NAV-01's decision function `decideEntryRoute` lives in
> **packages/core** (vitest), NOT iOS jest. Plan 01 Task 3 places it in core precisely so the
> 0/1/N branch logic is automatable without the heavier React Native env. The iOS index.tsx only
> *consumes* it; the runtime nav (which screen renders) stays manual (Task 04 device UAT).

---

## Sampling Rate

- **After every task commit:** Run quick run command (core unit tests)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Filled by the planner from RESEARCH.md Validation Architecture + the 5 PLAN files.
> Waves match each PLAN's frontmatter.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 01 | 1 (W0) | (foundation) | infra | `pnpm --filter @moajoa/core test` (vitest wired; category.test.ts runs, not "(no tests yet)") | ❌ W0 | ⬜ pending |
| 17-01-T2 | 01 | 1 | SETUP-01/02 | unit | `pnpm --filter @moajoa/core test trip` (TripCreateSchema required-date + end>=start + day-trip; TripSchema w/ representative_id) | ❌ W0 | ⬜ pending |
| 17-01-T3 | 01 | 1 | NAV-01 | unit | `pnpm --filter @moajoa/core test entry-route` (**decideEntryRoute in core/vitest** — 0/1/N + deleted-last-trip edge) | ❌ W0 | ⬜ pending |
| 17-02-T* | 02 | 2 | ATTR-01 | unit (tdd) | `pnpm --filter @moajoa/core test booking` (buildAffiliateUrl single helper; subId injected per provider; ClickTokenSchema c_+base62 8-30; BookingClickContextSchema uuid) | ❌ W0 | ⬜ pending |
| 17-03-T1 | 03 | 2 | SETUP-02, NAV-04 | grep/SQL | grep acceptance on `0016_trips_baseline.sql` (trips/helpers/view/folded columns present; board_id + profiles_create_first_board == 0) | ⚠️ created in task | ⬜ pending |
| 17-03-T2 | 03 | 2 | (foundation) | integration (human-action) | `supabase db reset` (local) — authoritative 42P17 + dropped-object gate; `pnpm supabase:types` regen | ⚠️ runtime | ⬜ pending |
| 17-03-T3 | 03 | 2 | NAV-04 | typecheck | `pnpm --filter @moajoa/api typecheck` (trip-vocab queries; folded confidence/source_kind resolve) | ✅ | ⬜ pending |
| 17-04-T1 | 04 | 3 | NAV-01/02/03 | grep + iOS | grep (decideEntryRoute/onboarding/Tabs/no FAB) + `pnpm --filter @moajoa/ios test` | ✅ | ⬜ pending |
| 17-04-T2 | 04 | 3 | NAV-02 | file + iOS | tab screens + me exist; `pnpm --filter @moajoa/ios test` | ✅ | ⬜ pending |
| 17-04-T3 | 04 | 3 | NAV-04 | file + iOS | old boards/ + (tabs) removed; share→/trip; `pnpm --filter @moajoa/ios test` + typecheck | ✅ | ⬜ pending |
| 17-04-T4 | 04 | 3 | NAV-01/02/03/04 | manual UAT | device: 0/1/N entry (0→onboarding, sole-ownership check), 4-tab bar, header, share | n/a manual | ⬜ pending |
| 17-05-T1 | 05 | 4 | SETUP-01 | file + iOS | onboarding 정해짐/미정 branch; `pnpm --filter @moajoa/ios test` | ✅ | ⬜ pending |
| 17-05-T2 | 05 | 4 | SETUP-01/02 | file + iOS | trip/create (city+date required, auto-rep); `pnpm --filter @moajoa/ios test` + typecheck | ✅ | ⬜ pending |
| 17-05-T3 | 05 | 4 | NAV-04 | typecheck + web | /b→/t move; `pnpm --filter @moajoa/web typecheck` + `pnpm --filter @moajoa/web test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] vitest wired in `packages/core` (config + `test` script in package.json) — no test runner currently bound (Plan 01 Task 1)
- [ ] Test stubs for `Trip`/`TripCreate` Zod contract (Plan 01 Task 2)
- [ ] Test stubs for `decideEntryRoute` 0/1/N + delete edge (Plan 01 Task 3 — **core/vitest, NAV-01**)
- [ ] Test stubs for `buildAffiliateUrl` / SubID token format (Plan 02, ATTR-01)

*The unit-testable contracts (NAV-01 decision fn, SETUP Zod, ATTR-01 affiliate helper) are all in packages/core/vitest. The Expo Router restructure, Supabase squash, and RLS are manual/integration-verified — see below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 0/1/N 진입 분기 (런타임 화면) | NAV-01 | Expo Router + auth/session + device nav (decision logic IS automated in core) | 실기기: 0 trips→onboarding (auto-board 없음, sole-ownership 확인), 1→그 trip plan 탭, 2+→마지막 본 trip |
| 4탭 전환 + 탭바 상시 표시 | NAV-02 | 시각/네비게이션 | trip 안에서 지도·플랜·예약·가계부 전환, 탭바 유지 확인 |
| 헤더 여행 전환/프로필 | NAV-03 | 시각/상호작용 | 좌상단 현재 여행 ▾ / 우상단 프로필 동작 |
| 라우트 위생 (옛 라우트 제거, /t/[slug]) | NAV-04 | 라우팅 | 옛 boards/[id] 미존재, share-handler→trip, web /t/[slug] SSR 200 |
| 정해짐 경로 생성 (도시·날짜·대표) | SETUP-01/02 | UI 플로우 | 프리셋 도시+날짜 범위+생성자=대표로 trip 생성 |
| Supabase squash 후 RLS 무재귀 | (foundation) | DB 통합 | `supabase db reset` 후 trips/places/memberships RLS 동작, 42P17 없음 (Plan 03 Task 2가 게이트) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest wiring — Plan 01 Task 1)
- [x] No watch-mode flags (iOS uses `--watchman=false`, not `--watch`)
- [x] Feedback latency < 15s (core unit suite)
- [x] decideEntryRoute (NAV-01) automated in packages/core (vitest), not iOS jest
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (wave_0_complete flips true after Plan 01 Task 1 wires vitest)
</content>
</invoke>
