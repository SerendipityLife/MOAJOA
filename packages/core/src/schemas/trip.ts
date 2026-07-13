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
  /**
   * 여행 기간 Day 수 (migration 0031, D-08). Null = 기간 미정 (레거시 모아 포함).
   * 상한은 `Limits.TripDayCountMax` — 0031 CHECK와 같은 숫자여야 한다 (리터럴 금지).
   * generate-plan EF가 computeDayCount(start,end)보다 우선 소비한다 (D-09).
   */
  day_count: z.number().int().min(1).max(Limits.TripDayCountMax).nullable(),
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
    // 0031 trips.day_count 미러. 위저드가 기간 pill(1~6) · 캘린더 파생값(1~30) · null(미정)을 싣는다.
    // 이 스키마의 parse가 제출 마지막 방어선(T-24-10) — 상한이 없으면 초과분이 INSERT까지 새어
    // DB CHECK에서 거부된다. 28-04가 캘린더 max로 앞단에서 한 겹 더 막는다.
    //
    // `.default(null)` (GeneratePlanRequestSchema `.default([])` idiom): 키를 생략한
    // 기존 호출부(build-draft.ts — 28-04에서 기간 값을 싣는다)가 그대로 컴파일·통과하되,
    // parse 출력은 항상 `number | null`이라 api INSERT 객체에 undefined가 새지 않는다.
    // TripSchema(DB 행)는 required-nullable로 더 엄격하다 — 행에는 컬럼이 반드시 있다.
    day_count: z.number().int().min(1).max(Limits.TripDayCountMax).nullable().default(null),
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
  day_count: true, // D-13 기간 게이트가 updateTrip으로 갱신 (0031)
}).partial();

export type TripUpdate = z.infer<typeof TripUpdateSchema>;
