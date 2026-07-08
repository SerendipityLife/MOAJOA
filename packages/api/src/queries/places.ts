import type { Place, PlaceAddManual } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

export async function listPlacesByTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<Place[]> {
  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('trip_id', tripId)
    .is('hidden_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Place[];
}

export async function listPlacesByLink(
  client: MoajoaSupabaseClient,
  linkId: string,
): Promise<Place[]> {
  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('link_id', linkId)
    .is('hidden_at', null)
    .order('source_timestamp_sec', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Place[];
}

/**
 * Add a place manually via Google Places API selection. The SQL function
 * `add_manual_place` takes the resolved name/coordinates/address from the caller
 * (EF-resolved values relayed through the client) — it does NOT fetch them
 * server-side. Omitting them makes the RPC coalesce name_local to the place_id
 * and lat/lng to 0,0, so we forward the resolved fields.
 */
export async function addManualPlace(
  client: MoajoaSupabaseClient,
  input: PlaceAddManual,
): Promise<Place> {
  // `PlaceAddManual` still carries `board_id` (core field rename owned by a
  // later plan); map it onto the renamed `p_trip_id` RPC arg (0016).
  const { data, error } = await client.rpc('add_manual_place', {
    p_trip_id: input.board_id,
    p_google_place_id: input.google_place_id,
    p_note: input.note ?? null,
    p_name_local: input.name_local ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_address: input.address ?? null,
  });
  if (error) throw error;
  return data as Place;
}

export async function hidePlace(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('places')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function unhidePlace(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('places').update({ hidden_at: null }).eq('id', id);
  if (error) throw error;
}

/**
 * Rename a place's display name. The UI shows `name_ko ?? name_local`, so the
 * edit must target name_ko — otherwise editing a place that has a Korean name
 * updates the (hidden) local original and the visible title never changes.
 * name_local stays as the canonical Google original (used for search fallback);
 * google_place_id remains immutable.
 *
 * RLS: `can_edit_trip()` SECURITY DEFINER helper (0016 squash) gates this
 * UPDATE. Non-members get RLS denial.
 *
 * Per Phase 3 D-09: pin bottom sheet "이름 수정" action.
 */
export async function renamePlace(
  client: MoajoaSupabaseClient,
  id: string,
  newName: string,
): Promise<Place> {
  const trimmed = newName.trim();
  if (trimmed.length === 0) throw new Error('name_ko cannot be empty');
  if (trimmed.length > 200) throw new Error('name_ko exceeds 200 chars');

  const { data, error } = await client
    .from('places')
    .update({ name_ko: trimmed })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}

/**
 * Soft-delete a place — alias of hidePlace.
 *
 * Why alias instead of new function: hidePlace already implements the exact
 * soft-delete semantics (sets hidden_at; row stays for vote history; lists
 * filter `hidden_at is null`). Exporting as deletePlace gives the UI an
 * intent-aligned name without duplicating logic (Karpathy §3.2 simplicity).
 *
 * Per Phase 3 D-09: pin bottom sheet "삭제" action.
 */
export const deletePlace = hidePlace;

/**
 * Phase 5 TRUST-04 — D-04/D-14.
 * Confirms a low-confidence AI pin: flips source_kind to 'manual' and clears
 * confidence (so it's no longer rendered with the "low conf" treatment).
 * Reusing source_kind avoids a separate `confirmed_at` column (D-04 schema lock).
 *
 * RLS: `can_edit_trip()` SECURITY DEFINER helper (0016 squash) gates this UPDATE.
 * Non-members get RLS denial — wrapper does no extra check (T-05-02).
 */
export async function confirmAiPlace(
  client: MoajoaSupabaseClient,
  id: string,
): Promise<Place> {
  const { data, error } = await client
    .from('places')
    .update({ source_kind: 'manual', confidence: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}

/**
 * Phase 5 TRUST-04 — D-14 [잘못됨] action.
 * Soft-delete via hidden_at — same semantics as hidePlace/deletePlace
 * (places_trip_idx WHERE hidden_at IS NULL already excludes hidden rows).
 * Exported with intent-aligned name for the low-confidence reject UI.
 */
export const rejectAiPlace = hidePlace;
