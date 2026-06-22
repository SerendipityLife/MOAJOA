import { z } from 'zod';
import { TravelMode } from '../constants';

/** Plan = one AI-generated draft itinerary for a trip (0017). One draft per trip. */
export const PlanSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  status: z.enum(['generating', 'draft']), // matches 0017 status CHECK
  travel_mode: z.enum(TravelMode), // transit | walk | drive (D-08)
  collaborative: z.boolean(), // D-14 flag (+ share only)
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** One placed item within a plan day (0017). Unplaced = a place with NO plan_item row (D-13). */
export const PlanItemSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  place_id: z.string().uuid(),
  day_index: z.number().int().min(0),
  sort_order: z.number().int().min(0),
  leg_travel_seconds: z.number().int().nonnegative().nullable(), // null = "이동시간 —" (Routes failed / first item)
  is_anchor: z.boolean(), // 필수 장소 (D-10)
  created_at: z.string().datetime(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

/** generate-plan Edge Function request (mirror ResolvePlaceRequest .default idiom). */
export const GeneratePlanRequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(TravelMode).default('transit'), // D-08
  anchor_place_ids: z.array(z.string().uuid()).default([]), // 필수 (D-10)
  removed_place_ids: z.array(z.string().uuid()).default([]), // D-11
});
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;

/** generate-plan response (invoke return shape). */
export const GeneratePlanResultSchema = z.object({
  plan_id: z.string().uuid(),
  day_count: z.number().int().min(0),
  placed_count: z.number().int().min(0),
  unplaced_count: z.number().int().min(0),
});
export type GeneratePlanResult = z.infer<typeof GeneratePlanResultSchema>;
