import type {
  Plan,
  PlanItem,
  GeneratePlanRequestInput,
  GeneratePlanResult,
  TravelModeType,
} from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';
import { shareTrip } from './trips';

/** A trip's draft plan with its placed items embedded (via plans_trip_id_fkey). */
export type PlanWithItems = Plan & { plan_items: PlanItem[] };

/**
 * Read the trip's single draft plan with its placed plan_items embedded
 * (plans_one_draft_per_trip partial unique guarantees at most one). Returns
 * null when no plan has been generated yet (State A/B). Unplaced places have
 * NO plan_item row (D-13), so the pool is derived client-side from the trip's
 * places minus these embedded item place_ids.
 *
 * RLS: `can_read_trip()` SECURITY DEFINER helper (0016) gates the select and
 * additionally filters rows the user can't read — the wrapper does no extra
 * client-side membership check (T-18-17, mirrors listPlacesByTrip).
 */
export async function getPlanByTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<PlanWithItems | null> {
  const { data, error } = await client
    .from('plans')
    .select('*, plan_items(*)')
    .eq('trip_id', tripId)
    .eq('status', 'draft')
    .maybeSingle();
  if (error) throw error;
  return (data as PlanWithItems | null) ?? null;
}

/**
 * Trigger AI plan generation for a trip (D-01: explicit "플랜 만들기" button, not
 * auto). Invokes the `generate-plan` Edge Function, which loads the trip's
 * placeable places, clusters/orders them with Claude, grounds adjacent legs via
 * Routes, and overwrites the single draft plan. Progress streams over the
 * `plan:{trip_id}` broadcast channel (subscribePlanProgress) — this call resolves
 * with the final counts. Mirrors triggerExtraction (links.ts) exactly.
 *
 * RLS / cost gate: the EF re-verifies caller can_edit_trip server-side before
 * spending (T-18-09); this wrapper adds no client-side check.
 *
 * body는 **pre-parse** 타입(`GeneratePlanRequestInput`)이다 — 이 래퍼는 파스하지 않고 EF가
 * 같은 스키마로 재파스하며 `.default()`를 채우기 때문이다. 덕분에 `pinned_placements`(D-21)처럼
 * 기본값 있는 필드를 additive로 추가해도 기존 호출부(동결된 iOS 포함)가 무변경으로 컴파일된다.
 */
export async function generatePlan(
  client: MoajoaSupabaseClient,
  body: GeneratePlanRequestInput,
): Promise<GeneratePlanResult> {
  const { data, error } = await client.functions.invoke('generate-plan', { body });
  if (error) throw error;
  return data as GeneratePlanResult;
}

/**
 * Move/reorder a placed item: set its day_index + sort_order. Called on drag
 * within or across days (D-13 placed↔placed). RLS via can_edit_trip through the
 * parent plan (0017 plan_items policy) — no extra client-side check.
 */
export async function reorderPlanItem(
  client: MoajoaSupabaseClient,
  itemId: string,
  patch: { day_index: number; sort_order: number },
): Promise<PlanItem> {
  const { data, error } = await client
    .from('plan_items')
    .update(patch)
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as PlanItem;
}

/**
 * Toggle the plan's travel mode (전철/도보/차, D-08). The client re-invokes
 * generatePlan afterward to re-ground legs in the new mode (Routes per-mode);
 * this only persists the flag. RLS via can_edit_trip on plans — no extra check.
 */
export async function setTravelMode(
  client: MoajoaSupabaseClient,
  planId: string,
  mode: TravelModeType,
): Promise<Plan> {
  const { data, error } = await client
    .from('plans')
    .update({ travel_mode: mode })
    .eq('id', planId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Plan;
}

/**
 * Return a placed item to the unplaced pool (D-13). Unplaced = no plan_item row,
 * so removing a placed item is a delete of its row; the place itself stays on the
 * trip and reappears in the pool (derived from places minus item place_ids).
 */
export async function moveToPool(
  client: MoajoaSupabaseClient,
  itemId: string,
): Promise<void> {
  const { error } = await client.from('plan_items').delete().eq('id', itemId);
  if (error) throw error;
}

/**
 * Place a pooled place onto a day (D-13). Inserts a plan_item at the given
 * day/order; leg_travel_seconds is null until the next regenerate re-grounds the
 * leg ("이동시간 —" meanwhile). RLS via can_edit_trip through the parent plan.
 *
 * **is_anchor=true (D-21, Phase 28에서 false → true로 전환).** generate-plan은 draft를
 * 통째로 delete 후 재insert하는 멱등 덮어쓰기라, "수동 배치"를 식별할 마커가 없으면 사용자가
 * 손으로 Day 3에 옮긴 장소가 '일정 다시 만들기' 한 번에 날아간다. is_anchor가 그 마커다 —
 * 의미가 "필수 장소(D-10)"에서 **"필수 + 그 Day에 고정"** 으로 확장됐다.
 *
 * 계약 루프: moveToDay(is_anchor:true) → 재생성 시 클라이언트가 is_anchor 항목에서
 * {place_id, day_index}를 모아 generatePlan(pinned_placements)로 전달 → EF가 프롬프트 제약 +
 * enforcePinnedPlacements 사후 강제(LLM 불복 시에도 강제 이동) → EF가 다시 is_anchor:true로
 * 기록 → 2회차 재생성에도 고정이 산다.
 *
 * ⚠ **iOS 런타임 의미 변화 (파일 diff는 0이지만 동작은 바뀐다).** 이 함수는 동결된 iOS
 * plan.tsx도 호출하고, iOS는 웹과 달리 `setAnchor` 별표 UI를 실제로 노출한다(Phase 18 D-10).
 * 따라서 iOS에서 장소를 손으로 Day에 옮기면 그 장소가 **별표(필수 앵커)로 승격**되고, 이후 iOS
 * 재생성 시 anchor_place_ids에 포함되어 "반드시 배치" 대상이 된다. 이는 **의도된 계약 통일**이다
 * — "손으로 옮긴 건 존중한다"가 두 플랫폼에서 같은 의미를 갖는다 (28-03 SUMMARY 기록).
 */
export async function moveToDay(
  client: MoajoaSupabaseClient,
  input: { plan_id: string; place_id: string; day_index: number; sort_order: number },
): Promise<PlanItem> {
  const { data, error } = await client
    .from('plan_items')
    .insert({ ...input, is_anchor: true, leg_travel_seconds: null })
    .select('*')
    .single();
  if (error) throw error;
  return data as PlanItem;
}

/**
 * Mark/unmark an item as a 필수 anchor (D-10). Anchors are passed to generatePlan
 * (anchor_place_ids) on the next regenerate so the AI re-clusters the rest around
 * them — this only persists the flag. RLS via can_edit_trip through the plan.
 */
export async function setAnchor(
  client: MoajoaSupabaseClient,
  itemId: string,
  isAnchor: boolean,
): Promise<PlanItem> {
  const { data, error } = await client
    .from('plan_items')
    .update({ is_anchor: isAnchor })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as PlanItem;
}

/**
 * "친구와 같이 정하기" (PLAN-05, D-14): flip plans.collaborative=true, then reuse
 * the existing shareTrip to surface the trip's share slug. Phase 18's scope is
 * the flag + share only — the actual on-plan place voting reuses the shipped
 * votes infra in Phase 19, so this makes NO votes query (T-18-16). RLS via
 * can_edit_trip on plans gates the flip — no extra client-side check.
 */
export async function setCollaborative(
  client: MoajoaSupabaseClient,
  planId: string,
  tripId: string,
): Promise<{ collaborative: true; share_slug: string }> {
  const { error } = await client
    .from('plans')
    .update({ collaborative: true })
    .eq('id', planId)
    .select('*')
    .single();
  if (error) throw error;
  const slug = await shareTrip(client, tripId);
  return { collaborative: true, share_slug: slug };
}
