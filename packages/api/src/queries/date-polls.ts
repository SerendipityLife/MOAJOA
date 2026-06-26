import type { MoajoaSupabaseClient } from '../client';

/**
 * Date-poll RPC wrappers (0018). Mirrors votes.ts/trips.ts house contract:
 * client-first arg, `{ error } throw`, RLS-only.
 *
 * SECURITY: anon vote/comment WRITES go through SECURITY DEFINER RPCs ONLY
 * (cast_date_vote / post_poll_comment / delete_poll_comment). The date_votes and
 * date_comments tables are never written via a direct table insert from here —
 * they grant no INSERT to anon (T-19-01). The only direct table write here is
 * setPollMode's host-only date_polls update, gated by the date_polls_write RLS
 * (`can_edit_trip`, Plan 01 / T-19-04).
 */

/** Cast an anon availability vote via the DEFINER RPC (T-19-01: never a direct insert). */
export async function castDateVote(
  client: MoajoaSupabaseClient,
  input: {
    code: string;
    deviceToken: string;
    nickname: string;
    optionId?: string;
    voteDate?: string;
    availability: 'available' | 'unavailable';
  },
): Promise<void> {
  const { error } = await client.rpc('cast_date_vote', {
    p_code: input.code,
    p_device_token: input.deviceToken,
    p_nickname: input.nickname,
    p_option_id: input.optionId ?? null,
    p_vote_date: input.voteDate ?? null,
    p_availability: input.availability,
  });
  if (error) throw error;
}

/** Read poll metadata + range options by bearer code (anon-grant DEFINER RPC). */
export async function pollByCode(client: MoajoaSupabaseClient, code: string): Promise<unknown> {
  const { data, error } = await client.rpc('poll_view_by_code', { p_code: code });
  if (error) throw error;
  return data;
}

/** Read the shaped tally (per-option | per-date counts + nicknames, NO device_token). */
export async function getPollTally(client: MoajoaSupabaseClient, code: string): Promise<unknown> {
  const { data, error } = await client.rpc('poll_vote_tally', { p_code: code });
  if (error) throw error;
  return data;
}

/** Post an anon comment via the DEFINER RPC (T-19-01: never a direct insert). */
export async function postComment(
  client: MoajoaSupabaseClient,
  input: { code: string; deviceToken: string; nickname: string; body: string },
): Promise<unknown> {
  const { data, error } = await client.rpc('post_poll_comment', {
    p_code: input.code,
    p_device_token: input.deviceToken,
    p_nickname: input.nickname,
    p_body: input.body,
  });
  if (error) throw error;
  return data;
}

/** Delete an anon comment (own device_token OR host moderation, enforced in the RPC). */
export async function deleteComment(
  client: MoajoaSupabaseClient,
  input: { commentId: string; deviceToken: string },
): Promise<void> {
  const { error } = await client.rpc('delete_poll_comment', {
    p_comment_id: input.commentId,
    p_device_token: input.deviceToken,
  });
  if (error) throw error;
}

/** Host confirms a winning date → sets trip start/end + closes the poll (owner-only RPC). */
export async function confirmPollDate(
  client: MoajoaSupabaseClient,
  input: { pollId: string; startDate: string; endDate: string },
): Promise<void> {
  const { error } = await client.rpc('confirm_poll_date', {
    p_poll_id: input.pollId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });
  if (error) throw error;
}

/** Create a dateless trip + open poll atomically (owner RLS, INVOKER RPC). */
export async function createDatelessTrip(
  client: MoajoaSupabaseClient,
  input: { title: string; cityCode: string; mode: 'range' | 'grid' },
): Promise<unknown> {
  const { data, error } = await client.rpc('create_dateless_trip_with_poll', {
    p_title: input.title,
    p_city_code: input.cityCode,
    p_mode: input.mode,
  });
  if (error) throw error;
  return data;
}

/**
 * Single by-trip poll read seam (Plan 03 imports this instead of an inline raw
 * query). Host-readable poll metadata only — no voter PII (T-19-07).
 */
export async function getPollByTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<{
  id: string;
  poll_code: string | null;
  mode: 'range' | 'grid';
  status: 'open' | 'closed';
} | null> {
  const { data, error } = await client
    .from('date_polls')
    .select('id, poll_code, mode, status')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as {
      id: string;
      poll_code: string | null;
      mode: 'range' | 'grid';
      status: 'open' | 'closed';
    } | null) ?? null
  );
}

/**
 * Host mode switch (D-07) — owner-guarded by the existing date_polls_write RLS
 * (`can_edit_trip(trip_id)`, Plan 01 / T-19-04). No new RPC needed; a non-owner
 * update is denied at the DB. Plan 03 gates the toggle UI to the pre-share /
 * 0-vote window so a mid-poll flip can't strand cast votes.
 */
export async function setPollMode(
  client: MoajoaSupabaseClient,
  pollId: string,
  mode: 'range' | 'grid',
): Promise<void> {
  const { error } = await client.from('date_polls').update({ mode }).eq('id', pollId);
  if (error) throw error;
}

/** A candidate date window the host proposes for voters (date_poll_options). */
export interface PollOption {
  id: string;
  start_date: string;
  end_date: string;
}

/**
 * Host candidate-date writes (POLL-01, D-07 / GAP-19A). The host proposes the
 * windows voters vote on: range = several discrete ranges, grid = one wide window
 * the web grid expands into per-day cells. Like setPollMode these are direct
 * table writes gated by the existing `date_poll_options_write` RLS
 * (`can_edit_trip(trip_id)`, Plan 01) — no new RPC. The plan-tab card locks
 * editing once the first vote arrives (mirror the mode-toggle 0-vote gate) so a
 * mid-poll change can't strand cast votes.
 */
export async function getPollOptions(
  client: MoajoaSupabaseClient,
  pollId: string,
): Promise<PollOption[]> {
  const { data, error } = await client
    .from('date_poll_options')
    .select('id, start_date, end_date')
    .eq('poll_id', pollId)
    .order('start_date');
  if (error) throw error;
  return (data as PollOption[] | null) ?? [];
}

/** Add one candidate window (RLS owner-gated). Returns the inserted row. */
export async function addPollOption(
  client: MoajoaSupabaseClient,
  pollId: string,
  input: { startDate: string; endDate: string },
): Promise<PollOption> {
  const { data, error } = await client
    .from('date_poll_options')
    .insert({ poll_id: pollId, start_date: input.startDate, end_date: input.endDate })
    .select('id, start_date, end_date')
    .single();
  if (error) throw error;
  return data as PollOption;
}

/** Remove one candidate window by id (RLS owner-gated). */
export async function removePollOption(
  client: MoajoaSupabaseClient,
  optionId: string,
): Promise<void> {
  const { error } = await client.from('date_poll_options').delete().eq('id', optionId);
  if (error) throw error;
}
