import { z } from 'zod';
import { DatePollMode, DateAvailability, Limits } from '../constants';

/**
 * Date-poll = pre-trip date coordination for a (possibly dateless) trip (0018).
 * Anon visitors vote via bearer poll_code; the host confirms a winning date.
 */
export const DatePollSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  poll_code: z.string().min(8), // server-generated, non-guessable (ensure_poll_code)
  mode: z.enum(DatePollMode), // range | grid (D-07)
  status: z.enum(['open', 'closed']),
  created_at: z.string().datetime(),
});
export type DatePoll = z.infer<typeof DatePollSchema>;

/** A candidate date range in range mode (0018 date_poll_options). */
export const DatePollOptionSchema = z.object({
  id: z.string().uuid(),
  poll_id: z.string().uuid(),
  start_date: z.string().date(),
  end_date: z.string().date(),
  created_at: z.string().datetime(),
});
export type DatePollOption = z.infer<typeof DatePollOptionSchema>;

/**
 * An anon availability vote (0018 date_votes). option_id (range) and vote_date
 * (grid) are independently nullable per mode — exactly one is set.
 */
export const DateVoteSchema = z.object({
  id: z.string().uuid(),
  poll_id: z.string().uuid(),
  device_token: z.string(),
  nickname: z.string(),
  option_id: z.string().uuid().nullable(),
  vote_date: z.string().date().nullable(),
  availability: z.enum(DateAvailability),
});
export type DateVote = z.infer<typeof DateVoteSchema>;

/** An anon comment on a poll (0018 date_comments). body capped at VoteNoteMax (140, RESEARCH A7). */
export const DateCommentSchema = z.object({
  id: z.string().uuid(),
  poll_id: z.string().uuid(),
  device_token: z.string(),
  nickname: z.string(),
  body: z.string().min(1).max(Limits.VoteNoteMax),
  created_at: z.string().datetime(),
});
export type DateComment = z.infer<typeof DateCommentSchema>;

/**
 * "일정 미정" create — mirrors TripCreateSchema but drops start/end_date and adds
 * the initial poll_mode. The DB create_dateless_trip_with_poll RPC inserts the
 * trip + open poll atomically (RESEARCH Pattern 1).
 */
export const TripCreateDatelessSchema = z.object({
  title: z.string().min(1).max(Limits.TripTitleMax),
  city_code: z.string().max(20), // preset or 'other'
  poll_mode: z.enum(DatePollMode), // 'range' | 'grid'
});
export type TripCreateDateless = z.infer<typeof TripCreateDatelessSchema>;

/** cast_date_vote request — availability defaults to 'available' (mirror plan.ts .default idiom). */
export const CastDateVoteRequestSchema = z.object({
  code: z.string(),
  deviceToken: z.string(),
  nickname: z.string().min(1),
  optionId: z.string().uuid().optional(), // range mode
  voteDate: z.string().date().optional(), // grid mode
  availability: z.enum(DateAvailability).default('available'),
});
export type CastDateVoteRequest = z.infer<typeof CastDateVoteRequestSchema>;

/** post_poll_comment request. body 1..140 (Limits.VoteNoteMax). */
export const PostCommentRequestSchema = z.object({
  code: z.string(),
  deviceToken: z.string(),
  nickname: z.string().min(1),
  body: z.string().min(1).max(Limits.VoteNoteMax),
});
export type PostCommentRequest = z.infer<typeof PostCommentRequestSchema>;

/**
 * Grid 연속블록(N박) recommender (D-09, advisory only — host still picks manually).
 * Pure sliding window over the per-day available-count tally. For each contiguous
 * window of `runLength` days, score = the MINIMUM daily count across the window
 * (max-overlap: a window everyone can do every day beats one with a weak day).
 * Returns the highest-scoring window's [start, end] dates; ties pick the earliest
 * window. Returns null when there are fewer days than runLength.
 */
export function contiguousBlock(
  perDay: { date: string; count: number }[],
  runLength: number,
): { start: string; end: string } | null {
  if (runLength < 1 || perDay.length < runLength) return null;
  // Assume date-sorted; sort defensively (lexical YYYY-MM-DD sorts chronologically).
  const days = [...perDay].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let bestStartIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i + runLength <= days.length; i++) {
    let windowMin = Infinity;
    for (let j = i; j < i + runLength; j++) {
      if (days[j]!.count < windowMin) windowMin = days[j]!.count;
    }
    // Strictly greater so the earliest window wins ties.
    if (windowMin > bestScore) {
      bestScore = windowMin;
      bestStartIdx = i;
    }
  }
  if (bestStartIdx < 0) return null;
  return {
    start: days[bestStartIdx]!.date,
    end: days[bestStartIdx + runLength - 1]!.date,
  };
}
