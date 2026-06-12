import type { MoajoaSupabaseClient } from '../client';

/**
 * Self-join a shared/public board by its slug. Idempotent (already a member = no-op).
 * Returns the board id. Backed by the SECURITY DEFINER join_shared_board RPC, which
 * hard-codes role='voter' and uses auth.uid() — the caller can only join as themselves.
 */
export async function joinSharedBoard(
  client: MoajoaSupabaseClient,
  shareSlug: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_shared_board', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}

/**
 * The caller's relationship to a board: 'owner' (no memberships row by design),
 * 'member' (accepted memberships row), or null. Lets vote surfaces render the
 * member view on revisit instead of re-prompting 참여하기 (and prevents owners
 * from creating a redundant voter membership for themselves).
 */
export async function getMyBoardRole(
  client: MoajoaSupabaseClient,
  boardId: string,
  userId: string,
): Promise<'owner' | 'member' | null> {
  const [{ data: own, error: ownErr }, { data: mem, error: memErr }] = await Promise.all([
    client.from('boards').select('id').eq('id', boardId).eq('owner_id', userId).maybeSingle(),
    client
      .from('memberships')
      .select('board_id')
      .eq('board_id', boardId)
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

/**
 * Count of accepted members — the 확정 denominator. Coalesces null → 0 for legacy/empty boards.
 */
export async function getAcceptedMemberCount(
  client: MoajoaSupabaseClient,
  boardId: string,
): Promise<number> {
  const { data, error } = await client.rpc('accepted_member_count', { p_board_id: boardId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
