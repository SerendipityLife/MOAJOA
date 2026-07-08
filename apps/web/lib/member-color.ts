import { colors } from '@moajoa/ui-tokens';

/**
 * D-20 pin color assignment. Owner has NO memberships row (join_moa owner guard),
 * so callers pass participants only, sorted by created_at asc (join order).
 * Colors come from ui-tokens ONLY — never interpolate user strings (T-05-05-01).
 */
export function memberColor(
  userId: string,
  ownerId: string,
  memberIdsInJoinOrder: string[],
): string {
  if (userId === ownerId) return colors.brand[500];
  const i = memberIdsInJoinOrder.indexOf(userId);
  return colors.member[(i < 0 ? 0 : i) % colors.member.length];
}
