import type { Vote, VoteCast } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client.js';

/**
 * Cast a love vote. Idempotent — repeated calls return the existing vote.
 * Uses Postgres ON CONFLICT (place_id, user_id, kind) DO NOTHING upstream.
 */
export async function castVote(client: MoajoaSupabaseClient, input: VoteCast): Promise<Vote> {
  const { data, error } = await client
    .from('votes')
    .upsert(
      {
        place_id: input.place_id,
        kind: input.kind,
        note: input.note ?? null,
      },
      { onConflict: 'place_id,user_id,kind' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as Vote;
}

export async function retractVote(
  client: MoajoaSupabaseClient,
  placeId: string,
  kind: VoteCast['kind'] = 'love',
): Promise<void> {
  const { error } = await client
    .from('votes')
    .delete()
    .eq('place_id', placeId)
    .eq('kind', kind);
  if (error) throw error;
}

/**
 * Get aggregated vote counts for a set of places. Returns { place_id: love_count }.
 * Uses an RPC for efficient batching.
 */
export async function getVoteCounts(
  client: MoajoaSupabaseClient,
  placeIds: string[],
): Promise<Record<string, number>> {
  if (placeIds.length === 0) return {};
  const { data, error } = await client.rpc('vote_counts_for_places', { p_place_ids: placeIds });
  if (error) throw error;

  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { place_id: string; love_count: number }[]) {
    result[row.place_id] = row.love_count;
  }
  return result;
}
