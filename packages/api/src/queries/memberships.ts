import type { MoajoaSupabaseClient } from '../client';

/**
 * Self-join a shared/public trip by its slug. Idempotent (already a member = no-op).
 * Returns the trip id. Backed by the SECURITY DEFINER join_shared_trip RPC, which
 * hard-codes role='voter' and uses auth.uid() — the caller can only join as themselves.
 */
export async function joinSharedTrip(
  client: MoajoaSupabaseClient,
  shareSlug: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_shared_trip', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}

/**
 * Self-join a moa by its share slug. Idempotent (already a member = no-op — no
 * role promotion, D-A4). Backed by the SECURITY DEFINER join_moa RPC (0025):
 * role is decided server-side by share_mode (places/both → editor, dates/null
 * → voter) and user_id = auth.uid() — the caller can only join as themselves.
 * Anonymous sessions work: they carry the authenticated role.
 */
export async function joinMoa(
  client: MoajoaSupabaseClient,
  shareSlug: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_moa', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}

/**
 * Self-join a trip by its date-poll code (poll_code bearer — no slug involved).
 * Idempotent (already a member = no-op — no role promotion, D-A4). Backed by the
 * SECURITY DEFINER join_moa_by_poll_code RPC (0032): role is fixed server-side to
 * 'voter' (poll_code is dates semantics — D-A1 dates branch mirror), user_id =
 * auth.uid() — the caller can only join as themselves. No visibility gate: covers
 * legacy private dateless-poll trips (share_slug null) that join_moa cannot reach.
 * Granted to authenticated only — anonymous sessions work but a session is required.
 */
export async function joinMoaByPollCode(
  client: MoajoaSupabaseClient,
  code: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_moa_by_poll_code', { p_code: code });
  if (error) throw error;
  return data as string;
}

/**
 * The caller's relationship to a trip: 'owner' (no memberships row by design),
 * 'member' (accepted memberships row), or null. Lets vote surfaces render the
 * member view on revisit instead of re-prompting 참여하기 (and prevents owners
 * from creating a redundant voter membership for themselves).
 */
export async function getMyTripRole(
  client: MoajoaSupabaseClient,
  tripId: string,
  userId: string,
): Promise<'owner' | 'member' | null> {
  const [{ data: own, error: ownErr }, { data: mem, error: memErr }] = await Promise.all([
    client.from('trips').select('id').eq('id', tripId).eq('owner_id', userId).maybeSingle(),
    client
      .from('memberships')
      .select('trip_id')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .maybeSingle(),
  ]);
  if (ownErr) throw ownErr;
  if (memErr) throw memErr;
  if (own) return 'owner';
  if (mem) return 'member';
  return null;
}

export interface TripMember {
  user_id: string;
  created_at: string;
}

/**
 * Phase 24 D-20 — 핀 색 join순 배정의 데이터 소스. accepted 멤버만,
 * created_at asc (join order). owner는 memberships 행이 없다(설계상).
 */
export async function listTripMembers(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<TripMember[]> {
  const { data, error } = await client
    .from('memberships')
    .select('user_id, created_at')
    .eq('trip_id', tripId)
    .not('accepted_at', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TripMember[];
}

/**
 * Count of accepted members — the 확정 denominator. Coalesces null → 0 for legacy/empty trips.
 */
export async function getAcceptedMemberCount(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<number> {
  const { data, error } = await client.rpc('accepted_member_count', { p_trip_id: tripId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
