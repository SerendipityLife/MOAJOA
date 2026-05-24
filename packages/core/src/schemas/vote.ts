import { z } from 'zod';
import { Limits, VoteKind } from '../constants';

export const VoteSchema = z.object({
  id: z.string().uuid(),
  place_id: z.string().uuid(),
  user_id: z.string().uuid(),
  kind: z.enum(VoteKind),
  note: z.string().max(Limits.VoteNoteMax).nullable(),
  created_at: z.string().datetime(),
});

export type Vote = z.infer<typeof VoteSchema>;

export const VoteCastSchema = z.object({
  place_id: z.string().uuid(),
  kind: z.enum(VoteKind).default('love'),
  note: z.string().max(Limits.VoteNoteMax).optional(),
});

export type VoteCast = z.infer<typeof VoteCastSchema>;

/**
 * Decision rule for "confirmed" places in a shared board.
 *
 * Why this threshold: discussed 2026-05-24 — 단체 여행에서 만장일치 강요는
 * 결정을 멈춤. ❤️ 1표 이상이면 후보로 표시, 과반은 "확정" 강조 표시.
 *
 * Single source so UI filter (web/iOS) and notification triggers match.
 */
export function isPlaceConfirmed(loveCount: number, totalMembers: number): boolean {
  if (totalMembers === 0) return false;
  return loveCount / totalMembers >= 0.5;
}

export function isPlaceCandidate(loveCount: number): boolean {
  return loveCount >= 1;
}
