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

/**
 * Read slug→trip_messages 스냅샷을 anon-grant DEFINER RPC(0034)로 노출한다
 * (CHAT-10). trip_messages SELECT RLS(can_read_trip, 멤버 전용)를 우회해 /t
 * join 전 게스트에게 채팅 이력을 준다. DEFINER가 user_id(auth PII)를 제외한
 * shape만 반환(T-29-07-02) — nickname은 공개 비정규화 필드. getPublicTripPoll
 * house contract 미러(rpc·`{ error } throw`·shaped 반환).
 */
export async function getPublicTripMessages(
  client: MoajoaSupabaseClient,
  slug: string,
): Promise<unknown> {
  const { data, error } = await client.rpc('public_trip_messages', { p_slug: slug });
  if (error) throw error;
  return data;
}
