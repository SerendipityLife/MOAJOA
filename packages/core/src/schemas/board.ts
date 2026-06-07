import { z } from 'zod';
import { BoardVisibility, Limits } from '../constants';

export const BoardSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  title: z.string().min(1).max(Limits.BoardTitleMax),
  description: z.string().max(Limits.BoardDescMax).nullable(),
  visibility: z.enum(BoardVisibility),
  /** Slug used in public share URLs. Stable, non-guessable. */
  share_slug: z.string().min(8).max(32).nullable(),
  /** Optional destination city for grouping (e.g., "tokyo", "osaka"). */
  city_code: z.string().max(20).nullable(),
  /** Optional trip start date (YYYY-MM-DD). */
  start_date: z.string().date().nullable(),
  /** Optional trip end date (YYYY-MM-DD). Null for a single-day trip; otherwise >= start_date. */
  end_date: z.string().date().nullable(),
  cover_image_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Board = z.infer<typeof BoardSchema>;

export const BoardCreateSchema = BoardSchema.pick({
  title: true,
  description: true,
  visibility: true,
  city_code: true,
  start_date: true,
  end_date: true,
}).extend({
  title: z.string().min(1).max(Limits.BoardTitleMax),
  // Dates are optional on create — callers may omit them entirely.
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
});

export type BoardCreate = z.infer<typeof BoardCreateSchema>;

export const BoardUpdateSchema = BoardCreateSchema.partial();
export type BoardUpdate = z.infer<typeof BoardUpdateSchema>;
