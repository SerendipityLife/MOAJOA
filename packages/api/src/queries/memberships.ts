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
