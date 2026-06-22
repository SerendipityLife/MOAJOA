---
phase: 18-auto-plan-ai
verified: 2026-06-22T19:10:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification_note: >
  PLAN-01..05 end-to-end on-device behaviors (button → realtime progress → draft
  render; drag reorder; 제거/일정에 추가; 필수 + regenerate; mode toggle leg recompute;
  collaborative share) were a 18-05 checkpoint:human-verify that the executor could
  not run. The device UAT was USER-APPROVED by the product owner on 2026-06-22
  (recorded in ROADMAP Phase 18 plan line: "디바이스 UAT 사용자 승인 ✅ (2026-06-22)").
  These UI runtime behaviors are accepted as human-attested evidence per the Phase 17
  convention. No NEW human verification is required.
deploy_followups: # deferred deploy-time steps for the user (do NOT block phase)
  - "supabase db push — apply 0017_plans.sql to the remote (verified LOCALLY, zero 42P17)"
  - "supabase functions deploy generate-plan — deploy the EF to remote"
  - "Enable TRANSIT routing on the GCP Routes key — current key returns empty {} for TRANSIT (WALK/DRIVE return durations). Until enabled, default (transit) plans render '이동시간 —' per leg. EF degrades gracefully (documented external gate, not a code defect)."
---

# Phase 18: Auto Plan (사용자 트리거 AI 플랜) Verification Report

**Phase Goal:** 추출로 모은 장소로 사용자가 plan 탭에서 "플랜 만들기"를 누르면 AI가 동선·날짜별 일정 초안을 짜고, 사용자가 장소를 추가/제거/재배치하며, 일정에 이동시간이 Routes로 그라운딩된다. 필수 장소 재구성 + 협업 전환(옵션). (D-01: 사용자 트리거, 추출 직후 자동 아님.)
**Verified:** 2026-06-22T19:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

These five truths are the merged ROADMAP Success Criteria (5) + PLAN frontmatter must-haves. D-01 reinterpretation applied to SC-1 (gate on the button + generation, NOT auto-after-extraction).

| #   | Truth (ROADMAP SC + PLAN must-have)                                                                                                  | Status     | Evidence                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | plan 탭의 "플랜 만들기"를 누르면 그 시점 trip의 추출 장소로 동선·날짜별 일정 초안이 생성된다 (D-01: 사용자 트리거, 자동 아님)        | ✓ VERIFIED | `plan.tsx` State B renders the `플랜 만들기` button (L398); `runGenerate`→`generatePlan(supabase, {trip_id,...})` (L143) invokes the `generate-plan` EF; `useEffect`/`load` (L107-111) ONLY fetches, NEVER auto-generates (D-01); EF loads `places.eq(trip_id).is(hidden_at,null)`, Claude clusters, writes plans/plan_items. Device UAT user-approved 2026-06-22. |
| 2   | 플랜이 "초안"으로 명시되고, 사용자가 장소를 추가/제거하고 순서를 드래그로 재배치할 수 있다                                          | ✓ VERIFIED | 초안 chip rendered (`plan.tsx` L431-434); `reorderPlanItem` drag via `DaySection.onReorder`; `moveToPool` (제거 → 미배치, plan-item-row L88) + `moveToDay` (일정에 추가, UnplacedPool `onAddToDay`); api queries verified + 16 unit tests pass. Device UAT user-approved. |
| 3   | '필수 장소'를 선택하면 그 주변으로 동선이 재구성된다                                                                                 | ✓ VERIFIED | 필수 star → `setAnchor` (plan-item-row L75, persists `is_anchor`); `onRegenerate` collects `is_anchor` items → passes `anchor_place_ids` to `runGenerate`→EF (plan.tsx L167-179); EF `buildPlanPrompt` includes anchorIds (Deno test "anchor place ids appear in the prompt (D-10)" passes), Claude re-clusters around anchors. |
| 4   | 일정 항목 사이에 이동시간이 표시된다 (Google Routes 그라운딩 — 좌표 없는 장소는 자동배치 제외)                                       | ✓ VERIFIED | EF Routes adjacent-leg loop (index.ts L200-230) uses `computeRoutesLeg` FieldMask `routes.duration` only; `(0,0)` places → unplaced pool, never to Routes (L142-147, L37); `LegPill` renders `{n}분` / `이동시간 —` for null legs (day-section/plan-item-row); 23 Deno tests green (incl. null-leg graceful degrade). TRANSIT-empty on current GCP key is a documented external/deploy gate, not a code defect. |
| 5   | "친구와 같이 정하기"로 같은 플랜을 협업 투표 모드로 전환할 수 있다 (옵션, D-14: 플래그+공유만)                                        | ✓ VERIFIED | `친구와 같이 정하기` Pressable (plan.tsx L469) → `onToggleCollaborative` → `setCollaborative(supabase, plan.id, id)` flips `plans.collaborative=true` then reuses `shareTrip` (plans.ts L158-172); NO in-plan vote query (D-14 scope); api test asserts share-slug reuse + no vote query. Device UAT user-approved. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                            | Expected                                              | Status     | Details                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/schemas/plan.ts`                 | Plan/PlanItem/GeneratePlanRequest Zod + types         | ✓ VERIFIED | 46 lines; models all 0017 columns; request defaults transit/[]/[]; barrel `export * from './plan'`                  |
| `packages/core/src/constants.ts`                    | planChannelName, PlanStep, PLAN_STEP_KO, TravelMode   | ✓ VERIFIED | `planChannelName(tripId)='plan:'+tripId` (L200-201); PlanStep + PLAN_STEP_KO + TravelMode present                  |
| `supabase/migrations/0017_plans.sql`                | plans + plan_items + RLS + extraction_costs CHECK     | ✓ VERIFIED | 67 lines; partial-unique one-draft-per-trip; RLS via can_read/edit_trip DEFINER; provider CHECK + google_routes     |
| `packages/api/src/types/database.ts`                | regenerated DB types incl. plans/plan_items           | ✓ VERIFIED | `plans:` (L377) + `plan_items:` (L329) with day_index/sort_order/leg_travel_seconds/is_anchor Row/Insert/Update    |
| `supabase/functions/generate-plan/index.ts`         | EF: auth+edit gate, place load+filter, Claude, Routes | ✓ VERIFIED | 369 lines; auth.getUser + can_edit_trip; (0,0) filter; broadcast loading→done/error; plans/plan_items write; cost log |
| `supabase/functions/generate-plan/pipeline/claude.ts` | buildPlanPrompt + callClaudePlan + validatePlanIds  | ✓ VERIFIED | 218 lines; PlanLLMOutput zod; validatePlanIds never drops (Deno tests green)                                        |
| `supabase/functions/generate-plan/pipeline/routes.ts` | computeRoutesLeg(origin,dest,mode,key)→seconds\|null | ✓ VERIFIED | 73 lines; FieldMask routes.duration only; DRIVE TRAFFIC_UNAWARE; (0,0) short-circuit; null on non-ok/empty          |
| `packages/api/src/queries/plans.ts`                 | typed plan queries + generate-plan invoke             | ✓ VERIFIED | 173 lines; getPlanByTrip/generatePlan/reorderPlanItem/setTravelMode/moveToPool/moveToDay/setAnchor/setCollaborative |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx`            | filled plan tab: button→skeleton→draft+editing        | ✓ VERIFIED | 494 lines; States A–F; D-01 no-auto-on-mount; all @moajoa/api imports + calls wired                                 |
| `apps/ios/components/plan/plan-item-row.tsx`        | row: drag handle + 필수 star + 제거/추가 + leg pill   | ✓ VERIFIED | drag handle, 필수 star (setAnchor), 제거 (moveToPool), LegPill `{n}분`/`이동시간 —`                                  |
| `apps/ios/lib/realtime.ts`                          | subscribePlanProgress + PlanProgress (appended)       | ✓ VERIFIED | subscribePlanProgress uses planChannelName; subscribeExtractProgress untouched                                      |

### Key Link Verification

| From                          | To                                  | Via                                     | Status   | Details                                                                |
| ----------------------------- | ----------------------------------- | --------------------------------------- | -------- | ---------------------------------------------------------------------- |
| schemas/index.ts              | ./plan                              | barrel re-export                        | ✓ WIRED  | `export * from './plan'` (L8)                                          |
| plan.ts                       | constants.ts                        | import { TravelMode }                   | ✓ WIRED  | `import { TravelMode } from '../constants'` (L2)                       |
| 0017_plans.sql                | can_edit/read_trip (0016 DEFINER)   | RLS USING/WITH CHECK                     | ✓ WIRED  | All plans policies use can_read/edit_trip; plan_items routes via parent plan.trip_id (permitted votes→places idiom) |
| generate-plan/index.ts        | plan:{trip_id} realtime channel     | admin.channel(planChannelName)          | ✓ WIRED  | `admin.channel(planChannelName(tripId))` (L310)                       |
| generate-plan/index.ts        | plans + plan_items tables           | from('plans')/from('plan_items')        | ✓ WIRED  | delete+insert plans (L237-244), insert plan_items (L262)              |
| generate-plan/routes.ts       | extraction_costs(google_routes)     | logCost per leg                         | ✓ WIRED  | `logCost(admin,null,{provider:'google_routes',cost_usd:0.005})` (L224) |
| api/queries/index.ts          | ./plans                             | barrel re-export                        | ✓ WIRED  | `export * from './plans'` (L6); api/src/index.ts re-exports queries   |
| api/queries/plans.ts          | shareTrip (trips.ts)                | setCollaborative reuses shareTrip       | ✓ WIRED  | `import { shareTrip } from './trips'` (L9); used L170 (shareTrip exists trips.ts L130) |
| plan.tsx                      | @moajoa/api plan queries            | import + call                           | ✓ WIRED  | generatePlan/getPlanByTrip/reorderPlanItem/setTravelMode/setCollaborative imported (L15-27) + called |
| plan.tsx                      | subscribePlanProgress (lib/realtime) | useEffect subscribe + removeChannel cleanup | ✓ WIRED | subscribePlanProgress (L118) + supabase.removeChannel cleanup (L132)  |

### Data-Flow Trace (Level 4)

| Artifact      | Data Variable | Source                              | Produces Real Data | Status                                                                                                              |
| ------------- | ------------- | ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| plan.tsx      | `plan`        | getPlanByTrip → DB `plans` join `plan_items` | ✓ Yes     | ✓ FLOWING — Supabase select `*, plan_items(*)` from real table; no static fallback                                |
| plan.tsx      | `places`      | listPlacesByTrip → DB `places`      | ✓ Yes              | ✓ FLOWING — pool derived from `places` minus placed item place_ids                                                |
| plan.tsx      | `progressStep`| subscribePlanProgress broadcast     | ✓ Yes              | ✓ FLOWING — EF broadcasts loading/clustering/routing/done/error on plan:{trip_id}                                 |
| LegPill       | `legSeconds`  | plan_items.leg_travel_seconds (EF Routes) | ⚠️ partial   | ⚠️ STATIC-on-TRANSIT — WALK/DRIVE return real durations; TRANSIT returns null on current GCP key → "이동시간 —". Documented external/deploy gate (CONTEXT 18-03), code path verified for walk/drive + null degrade. |

### Behavioral Spot-Checks

| Behavior                                            | Command                                  | Result            | Status |
| --------------------------------------------------- | ---------------------------------------- | ----------------- | ------ |
| core plan schema contract (defaults + reject cases) | `vitest run plan.test`                   | 12 passed         | ✓ PASS |
| api plan queries (invoke, reorder, collaborative)   | `vitest run plans.test`                  | 16 passed         | ✓ PASS |
| iOS plan UI render-state + realtime subscribe       | `jest plan.test realtime.test`           | 10 passed         | ✓ PASS |
| EF Claude validation + Routes leg grounding         | `deno test pipeline/`                    | 23 passed (0 fail) | ✓ PASS |
| local DB plans/plan_items tables exist              | `psql \dt public.plan*`                  | plan_items, plans | ✓ PASS |
| local RLS no 42P17 recursion (select on plans)      | `psql set role authenticated; select count(*) from plans` | RESET (clean) | ✓ PASS |
| extraction_costs CHECK accepts google_routes        | `psql pg_get_constraintdef`              | includes google_routes | ✓ PASS |
| 18-05 task commits present in git                   | `git log 5a454b9 cb63909 b461d05`        | all 3 present     | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan          | Description                                                          | Status      | Evidence                                                       |
| ----------- | -------------------- | ------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| PLAN-01     | 18-01,02,03,05       | 사용자가 plan 탭 "플랜 만들기" → AI 플랜 초안 생성 (D-01 사용자 트리거) | ✓ SATISFIED | Truth 1 — button → generatePlan → EF; no auto on mount         |
| PLAN-02     | 18-01,02,04,05       | 플랜 "초안" 명시 + 장소 추가/제거/재배치                            | ✓ SATISFIED | Truth 2 — 초안 chip + reorder/moveToPool/moveToDay             |
| PLAN-03     | 18-01,02,03,05       | '필수 장소' 선택 → 그 주변으로 동선 구성                            | ✓ SATISFIED | Truth 3 — setAnchor → anchor_place_ids → EF re-cluster         |
| PLAN-04     | 18-01,02,03,05       | 일정 항목에 이동시간 표시 (Routes 그라운딩)                         | ✓ SATISFIED | Truth 4 — computeRoutesLeg adjacent legs + LegPill + (0,0) excl |
| PLAN-05     | 18-01,02,04,05       | "친구와 같이 정하기" 협업 투표 모드 전환 (옵션)                     | ✓ SATISFIED | Truth 5 — setCollaborative flag + shareTrip reuse (D-14)       |

**Orphan check:** REQUIREMENTS.md maps exactly PLAN-01..05 to Phase 18. All five appear in PLAN frontmatter `requirements`. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| _none_ | — | TODO/FIXME/placeholder scan across all phase 18 source files returned clean (test files excluded) | — | — |

### Human Verification Required

None outstanding. The PLAN-01..05 end-to-end on-device UAT (button → progress → draft render; drag reorder; 제거/일정에 추가; 필수 + regenerate; mode toggle; collaborative share) was a 18-05 `checkpoint:human-verify` that was **USER-APPROVED on 2026-06-22** (recorded in ROADMAP Phase 18 plan line and 18-05-SUMMARY). Accepted as human-attested evidence per the Phase 17 convention — no NEW human verification is required.

### Gaps Summary

No gaps. All five observable truths (the merged ROADMAP Success Criteria + PLAN must-haves) are verified at the artifact (exists/substantive), wiring, and data-flow levels. All 61 automated tests across the four packages are green (core 12, api 16, iOS 10, EF Deno 23). The 0017 migration is applied LOCALLY with zero 42P17 recursion and the extraction_costs CHECK accepts google_routes. The device UAT for the runtime UI behaviors was user-approved.

Two non-blocking follow-ups (deploy-time, per CONTEXT — explicitly NOT phase failures):

1. **Remote deploy deferred** (17-03 pattern): `supabase db push` (0017) + `supabase functions deploy generate-plan` are deploy-time steps for the user. Code and local schema are verified.
2. **GCP Routes TRANSIT** (18-03 live finding): WALK/DRIVE return durations; TRANSIT returns empty `{}` on the current GCP key, so default (transit) plans render "이동시간 —" per leg until transit routing is enabled on the GCP project. The EF degrades gracefully (null leg, unit-tested + live-confirmed). The Routes adjacent-leg grounding code path is present and verified for walk/drive — documented external/deploy gate, not a code defect.

---

_Verified: 2026-06-22T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
