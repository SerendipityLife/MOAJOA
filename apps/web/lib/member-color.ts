import { palette } from './palette';

/**
 * D-20 pin color assignment. Owner has NO memberships row (join_moa owner guard),
 * so callers pass participants only, sorted by created_at asc (join order).
 * Colors come from the palette ONLY — never interpolate user strings (T-05-05-01).
 *
 * The owner takes brand-600, not Royal Blue (brand-500): a white initial is drawn
 * on the pin, and brand-500 only reaches 3.62:1 behind it. See /design.md §7.4.
 */
export function memberColor(
  userId: string,
  ownerId: string,
  memberIdsInJoinOrder: string[],
): string {
  if (userId === ownerId) return palette.brand[600];
  const i = memberIdsInJoinOrder.indexOf(userId);
  return palette.member[(i < 0 ? 0 : i) % palette.member.length]!;
}
