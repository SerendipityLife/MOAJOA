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
  /**
   * 필수 장소 (D-10) **+ 사용자가 수동 배치한 Day 고정 (D-21)** — Phase 28에서 의미가 확장됐다.
   *
   * 쓰기 경로 3곳: (1) `setAnchor` 별표 토글 — **iOS만** 노출한다, (2) `moveToDay` 수동 배치
   * (Phase 28부터 true), (3) generate-plan EF의 재기록. 웹은 이 phase에서 별표 UI를 노출하지
   * 않으므로 웹에서 is_anchor=true는 사실상 "사용자가 손으로 그 Day에 놓았다"와 동치다.
   *
   * 재생성 계약: 클라이언트가 is_anchor 항목에서 {place_id, day_index}를 모아
   * GeneratePlanRequest.pinned_placements로 보내고, EF가 프롬프트 제약 + 사후 강제로 그 Day에
   * 붙들어 둔 뒤 다시 is_anchor=true로 기록한다(루프가 닫혀 2회차 재생성에도 고정이 산다).
   */
  is_anchor: z.boolean(),
  created_at: z.string().datetime(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

/**
 * 수동 배치 Day 고정 힌트 (D-21). "이 장소는 반드시 이 Day에" — 사용자가 `moveToDay`로 직접
 * 옮긴 항목을 재생성이 다른 Day로 흩어놓지 못하게 막는다.
 *
 * 신뢰 불가 입력이다: EF의 `enforcePinnedPlacements`가 해당 trip의 placeable 집합과 교집합만
 * 수용하고(타 trip 장소·환각 id 탈락, T-28-09) day_index를 [0, dayCount-1]로 클램프한다(T-28-10).
 */
export const PinnedPlacementSchema = z.object({
  place_id: z.string().uuid(),
  day_index: z.number().int().min(0),
});
export type PinnedPlacement = z.infer<typeof PinnedPlacementSchema>;

/**
 * generate-plan Edge Function request (mirror ResolvePlaceRequest .default idiom).
 *
 * ⚠ Day 수(day_count)는 **여기에 없다 — 의도적이다** (T-28-08). Day 수는 서버가 `trips` 행에서
 * 읽는 값이지 클라이언트가 보내는 값이 아니다. 요청 바디로 받으면 Day 수를 부풀려 Claude·Routes
 * 유료 호출 비용을 조작할 수 있다.
 */
export const GeneratePlanRequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(TravelMode).default('transit'), // D-08
  anchor_place_ids: z.array(z.string().uuid()).default([]), // 필수 (D-10)
  removed_place_ids: z.array(z.string().uuid()).default([]), // D-11
  pinned_placements: z.array(PinnedPlacementSchema).default([]), // 수동 배치 Day 고정 (D-21)
});
/** Post-parse shape (defaults applied) — what the EF works with after safeParse. */
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
/**
 * Pre-parse shape — what a **client sends**. `.default()` 필드는 출력 타입에선 required지만
 * 입력에선 생략 가능하다. `generatePlan` 래퍼는 body를 파스하지 않고 EF로 그대로 넘기므로
 * (EF가 같은 스키마로 재파스하며 기본값을 채운다) 이쪽이 호출부의 정확한 계약이다.
 *
 * 이 구분이 없으면 `.default()` 필드를 additive로 하나 추가할 때마다 **모든 기존 호출부가
 * 타입 에러**가 난다 — 동결된 iOS(plan.tsx L359 객체 리터럴) 포함. D-21의 pinned_placements가
 * 그 첫 사례다.
 */
export type GeneratePlanRequestInput = z.input<typeof GeneratePlanRequestSchema>;

/** generate-plan response (invoke return shape). */
export const GeneratePlanResultSchema = z.object({
  plan_id: z.string().uuid(),
  day_count: z.number().int().min(0),
  placed_count: z.number().int().min(0),
  unplaced_count: z.number().int().min(0),
});
export type GeneratePlanResult = z.infer<typeof GeneratePlanResultSchema>;
