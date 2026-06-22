---
phase: 18
slug: auto-plan-ai
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full Validation Architecture (per-req test map) lives in `18-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (core/api)** | vitest — `packages/core`, `packages/api` (wired Phase 17) |
| **Framework (iOS)** | jest + jest-expo — run with `--watchman=false` in this env |
| **Framework (Edge Functions)** | Deno test (`jsr:@std/assert`) — `supabase/functions/.../pipeline/*.test.ts` |
| **Quick run command** | `pnpm --filter @moajoa/core test` (clustering/validation logic) |
| **Full suite command** | `pnpm -r --parallel run test` + `deno test` for EF pipeline |
| **Estimated runtime** | ~10s core; +EF/ios suites |

---

## Sampling Rate

- **Per task commit:** `pnpm --filter @moajoa/core test` and/or relevant `deno test` / ios jest target (<30s)
- **Per wave merge:** `pnpm -r --parallel run test` + EF `deno test`
- **Phase gate:** Full suite green + live UAT (device/sim): tap 플랜 만들기 on a real multi-link Tokyo trip → draft appears with day split + legs + unplaced pool; drag reorders; mode toggle recomputes

---

## Per-Task Verification Map

> From RESEARCH.md Validation Architecture. Waves match each PLAN's frontmatter.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | generate-plan selects placeable places (lat≠0), (0,0)→pool | unit (EF) | `deno test supabase/functions/generate-plan/pipeline/` | ❌ W0 |
| PLAN-01 | Claude output validation: no hallucinated ids, no drops/dupes | unit | `deno test .../pipeline/claude.test.ts` | ❌ W0 |
| PLAN-02 | "초안" labeled; reorder updates sort_order | unit (api) | `pnpm --filter @moajoa/api test` | ❌ W0 |
| PLAN-02 | plan.tsx renders days/pool + drag affordance | RNTL | `cd apps/ios && pnpm test --watchman=false plan` | ❌ W0 |
| PLAN-03 | 필수 anchors passed to generate-plan; appear in days | unit | core schema + EF prompt-includes-anchor test | ❌ W0 |
| PLAN-04 | adjacent-only leg computed; null on (0,0)/failure; minimal FieldMask | unit (mock fetch) | `deno test .../pipeline/routes.test.ts` | ❌ W0 |
| PLAN-05 | 협업 토글 sets plans.collaborative + share; no new vote UI | unit (api) | `pnpm --filter @moajoa/api test` | ❌ W0 |
| (cross) | planChannelName builder + subscribePlanProgress name | unit | core constants test + ios realtime.test.ts | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/schemas/plan.ts` + `plan.test.ts` — Plan/PlanItem/GeneratePlanRequest Zod + planChannelName
- [ ] `supabase/functions/generate-plan/pipeline/claude.test.ts` — prompt snapshot + PlanLLMOutput parse + id-validation (mirror extract-youtube claude.test.ts)
- [ ] `supabase/functions/generate-plan/pipeline/routes.test.ts` — leg compute with mocked fetch, FieldMask assertion, null-on-failure, (0,0) skip
- [ ] `packages/api/src/queries/plans.test.ts` — reorder, setTravelMode, setCollaborative, generatePlan invoke shape
- [ ] `apps/ios` — plan.tsx RNTL test (button → skeleton → render) + lib/realtime.test.ts plan-channel name

*Test infra exists (vitest/jest/deno all wired Phase 17). No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 플랜 품질 (동선 합리성·날짜 분배) | PLAN-01/03 | LLM output, subjective | 실제 도쿄 멀티링크 trip로 생성 → 같은 동네 같은 날, 하루 4~5, 미배치 풀 합리성 확인 |
| 드래그 재배치 + 미배치↔배치 이동 | PLAN-02 | RN 제스처 | 디바이스: 항목 드래그 순서변경, "미배치로 보내기"/풀에서 추가 |
| 이동수단 토글 재계산 | PLAN-04 | Routes 실호출 | 전철↔도보↔차 토글 시 인접 leg 시간 갱신 |
| 생성중 스켈레톤+실시간 진행률 | PLAN-01 | realtime 구독 | "플랜 만들기" → 스켈레톤 + plan:{trip_id} 진행률 |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (ios `--watchman=false`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true`

**Approval:** pending (wave_0_complete flips true after Wave 0 test scaffolding lands)
