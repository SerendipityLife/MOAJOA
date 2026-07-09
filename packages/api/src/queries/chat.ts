import type { TripMessage, TripMessageCreate } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

/** History for a moa, oldest→newest (RLS can_read_trip gates rows). */
export async function listTripMessages(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<TripMessage[]> {
  const { data, error } = await client
    .from('trip_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TripMessage[];
}

/** Send a message. user_id is filled by the 0028 default trigger (=auth.uid());
 *  RLS with-check enforces user_id=auth.uid() AND can_vote_trip. nickname is a
 *  send-time snapshot (D-08/D-A2), passed by the caller from display_name. */
export async function sendTripMessage(
  client: MoajoaSupabaseClient,
  input: TripMessageCreate,
): Promise<TripMessage> {
  const { data, error } = await client
    .from('trip_messages')
    .insert({
      trip_id: input.trip_id,
      nickname: input.nickname,
      body: input.body,
      reply_to_place_id: input.reply_to_place_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TripMessage;
}
