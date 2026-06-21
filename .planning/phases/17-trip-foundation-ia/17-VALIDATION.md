---
phase: 17
slug: trip-foundation-ia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed Validation Architecture lives in `17-RESEARCH.md` — the planner derives per-task tests from it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core already uses *.test.ts — category.test.ts, claude.test.ts) |
| **Config file** | none in packages/core yet — Wave 0 wires vitest + test script |
| **Quick run command** | `pnpm --filter @moajoa/core test` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~10 seconds (unit-only) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (core unit tests)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Filled by the planner from RESEARCH.md Validation Architecture. Key automatable contracts:

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-02-xx | 02 | 1 | ATTR-01 | unit | `pnpm --filter @moajoa/core test` (buildAffiliateUrl format/length within Travelpayouts 128-char `[A-Za-z0-9_-]`) | ❌ W0 | ⬜ pending |
| 17-01-xx | 01 | 0 | (foundation) | unit | core Trip/TripId Zod schema parse tests | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] vitest wired in `packages/core` (config + `test` script in package.json) — no test runner currently bound
- [ ] Test stubs for `buildAffiliateUrl` / SubID token format (ATTR-01)
- [ ] Test stubs for `Trip`/`TripId` Zod contract

*Most Phase 17 work (Expo Router restructure, Supabase squash, RLS) is manual/integration-verified — see below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 0/1/N 진입 분기 | NAV-01 | Expo Router + auth/session + device nav | 실기기: 0 trips→onboarding, 1→그 trip plan 탭, 2+→마지막 본 trip |
| 4탭 전환 + 탭바 상시 표시 | NAV-02 | 시각/네비게이션 | trip 안에서 지도·플랜·예약·가계부 전환, 탭바 유지 확인 |
| 헤더 여행 전환/프로필 | NAV-03 | 시각/상호작용 | 좌상단 현재 여행 ▾ / 우상단 프로필 동작 |
| 라우트 위생 (옛 라우트 제거, /t/[slug]) | NAV-04 | 라우팅 | 옛 boards/[id] 미존재, share-handler→trip, web /t/[slug] SSR 200 |
| 정해짐 경로 생성 (도시·날짜·대표) | SETUP-01/02 | UI 플로우 | 프리셋 도시+날짜 범위+생성자=대표로 trip 생성 |
| Supabase squash 후 RLS 무재귀 | (foundation) | DB 통합 | db reset 후 trips/places/memberships RLS 동작, 42P17 없음 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest wiring)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
