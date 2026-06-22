import type {
  Plan,
  PlanItem,
  GeneratePlanRequest,
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
 */
export async function generatePlan(
  client: MoajoaSupabaseClient,
  body: GeneratePlanRequest,
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
 * day/order; is_anchor defaults false (manual placement isn't a 필수 anchor) and
 * leg_travel_seconds is null until the next regenerate re-grounds the leg
 * ("이동시간 —" meanwhile). RLS via can_edit_trip through the parent plan.
 */
export async function moveToDay(
  client: MoajoaSupabaseClient,
  input: { plan_id: string; place_id: string; day_index: number; sort_order: number },
): Promise<PlanItem> {
  const { data, error } = await client
    .from('plan_items')
    .insert({ ...input, is_anchor: false, leg_travel_seconds: null })
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
