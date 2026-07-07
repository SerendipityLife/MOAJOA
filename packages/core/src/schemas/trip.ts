import { z } from 'zod';
import { TripVisibility, ShareMode, Limits } from '../constants';

export const TripSchema = z.object({
  id: z.string().uuid(), // = trip_id (canonical, D-02)
  owner_id: z.string().uuid(),
  /** Representative member of the trip (D-10, SETUP-02). Defaults to owner. */
  representative_id: z.string().uuid(),
  title: z.string().min(1).max(Limits.TripTitleMax),
  description: z.string().max(Limits.TripDescMax).nullable(),
  visibility: z.enum(TripVisibility),
  /** Slug used in public share URLs. Stable, non-guessable. */
  share_slug: z.string().min(8).max(32).nullable(),
  /** Optional destination city for grouping (e.g., "tokyo", "osaka"). */
  city_code: z.string().max(20).nullable(),
  /** Trip start date (YYYY-MM-DD). */
  start_date: z.string().date().nullable(),
  /** Trip end date (YYYY-MM-DD). Day-trip = equal to start_date; otherwise >= start_date. */
  end_date: z.string().date().nullable(),
  cover_image_url: z.string().url().nullable(),
  /** What the moa share link exposes (migration 0025). Null = never moa-shared (legacy). */
  share_mode: z.enum(ShareMode).nullable(),
  /** 동행 자유 텍스트, <= 20자 (migration 0025, A3). */
  companion: z.string().max(20).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Trip = z.infer<typeof TripSchema>;
/** Canonical trip identifier type (D-02). */
export type TripId = Trip['id'];

// "일정 정해짐" create — dates REQUIRED (D-09), end >= start, day-trip = equal.
export const TripCreateSchema = z
  .object({
    title: z.string().min(1).max(Limits.TripTitleMax),
    city_code: z.string().max(20), // preset or 'other' (D-08)
    start_date: z.string().date(), // required (D-09)
    end_date: z.string().date(), // required (day-trip = start)
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be >= start_date',
  });

export type TripCreate = z.infer<typeof TripCreateSchema>;

// Phase 23 — 온보딩 4단계 draft (ONBOARD-03/04). dates optional: 미정 = 둘 다 null.
// TripCreateSchema(dates 필수, iOS)와 공존 — 웹 온보딩 전용 계약.
export const TripCreateDraftSchema = z
  .object({
    title: z.string().min(1).max(Limits.TripTitleMax),
    city_code: z.string().max(20),
    start_date: z.string().date().nullable(),
    end_date: z.string().date().nullable(),
    companion: z.string().max(20).nullable(), // 0025 trips.companion 미러 (자유 텍스트 — A3)
  })
  .refine((v) => (v.start_date === null) === (v.end_date === null), {
    message: 'dates must be both set or both null',
  })
  .refine((v) => v.start_date === null || v.end_date! >= v.start_date, {
    message: 'end_date must be >= start_date',
  });
export type TripCreateDraft = z.infer<typeof TripCreateDraftSchema>;

export const TripUpdateSchema = TripSchema.pick({
  title: true,
  description: true,
  visibility: true,
  city_code: true,
  start_date: true,
  end_date: true,
}).partial();

export type TripUpdate = z.infer<typeof TripUpdateSchema>;
