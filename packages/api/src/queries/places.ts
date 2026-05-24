import type { Place, PlaceAddManual } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client.js';

export async function listPlacesByBoard(
  client: MoajoaSupabaseClient,
  boardId: string,
): Promise<Place[]> {
  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('board_id', boardId)
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
 * `add_manual_place` accepts the place_id and pulls coordinates/names server-side
 * to avoid trusting client-side coordinates.
 */
export async function addManualPlace(
  client: MoajoaSupabaseClient,
  input: PlaceAddManual,
): Promise<Place> {
  const { data, error } = await client.rpc('add_manual_place', {
    p_board_id: input.board_id,
    p_google_place_id: input.google_place_id,
    p_note: input.note ?? null,
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
