import type { TripMessage, TripMessageCreate } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

// RED stub — not yet implemented.
export async function listTripMessages(
  _client: MoajoaSupabaseClient,
  _tripId: string,
): Promise<TripMessage[]> {
  return [];
}

export async function sendTripMessage(
  _client: MoajoaSupabaseClient,
  _input: TripMessageCreate,
): Promise<TripMessage> {
  return {} as TripMessage;
}
