import { describe, it, expect } from 'vitest';
import {
  planChannelName,
  PLAN_CHANNEL_PREFIX,
  PlanStep,
  PLAN_STEP_KO,
  TravelMode,
} from '../constants';
import { GeneratePlanRequestSchema, PlanSchema, PlanItemSchema } from './plan';

// Reuse the booking.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('GeneratePlanRequestSchema — EF request defaults + reject cases (D-08/D-10/D-11)', () => {
  it('applies defaults: travel_mode=transit, anchor/removed/pinned arrays empty', () => {
    expect(GeneratePlanRequestSchema.parse({ trip_id: UUID })).toEqual({
      trip_id: UUID,
      travel_mode: 'transit',
      anchor_place_ids: [],
      removed_place_ids: [],
      pinned_placements: [],
    });
  });

  it('preserves provided values (walk + anchor ids)', () => {
    expect(
      GeneratePlanRequestSchema.parse({
        trip_id: UUID,
        travel_mode: 'walk',
        anchor_place_ids: [UUID],
      }),
    ).toEqual({
      trip_id: UUID,
      travel_mode: 'walk',
      anchor_place_ids: [UUID],
      removed_place_ids: [],
      pinned_placements: [],
    });
  });

  it('rejects an unknown travel_mode (only transit/walk/drive)', () => {
    expect(() =>
      GeneratePlanRequestSchema.parse({ trip_id: UUID, travel_mode: 'fly' }),
    ).toThrow();
  });

  it('rejects a non-uuid trip_id', () => {
    expect(() => GeneratePlanRequestSchema.parse({ trip_id: 'not-a-uuid' })).toThrow();
  });

  it('rejects non-uuid anchor_place_ids', () => {
    expect(() =>
      GeneratePlanRequestSchema.parse({ anchor_place_ids: ['bad'], trip_id: UUID }),
    ).toThrow();
  });
});

describe('GeneratePlanRequestSchema.pinned_placements — 수동 배치 Day 고정 힌트 (D-21)', () => {
  it('defaults to an empty array when omitted (기존 호출부 무회귀)', () => {
    expect(GeneratePlanRequestSchema.parse({ trip_id: UUID }).pinned_placements).toEqual([]);
  });

  it('parses a { place_id, day_index } pair', () => {
    const parsed = GeneratePlanRequestSchema.parse({
      trip_id: UUID,
      pinned_placements: [{ place_id: UUID, day_index: 2 }],
    });
    expect(parsed.pinned_placements).toEqual([{ place_id: UUID, day_index: 2 }]);
  });

  it('rejects a negative day_index', () => {
    expect(() =>
      GeneratePlanRequestSchema.parse({
        trip_id: UUID,
        pinned_placements: [{ place_id: UUID, day_index: -1 }],
      }),
    ).toThrow();
  });

  it('rejects a non-uuid place_id', () => {
    expect(() =>
      GeneratePlanRequestSchema.parse({
        trip_id: UUID,
        pinned_placements: [{ place_id: 'not-a-uuid', day_index: 0 }],
      }),
    ).toThrow();
  });

  it('has NO Day-count field — Day 수는 서버가 trips 행에서 읽는다 (T-28-08)', () => {
    const parsed = GeneratePlanRequestSchema.parse({
      trip_id: UUID,
      // deliberately spoofed: an attacker inflating the Day count to drive up
      // Claude/Routes spend must not be able to smuggle it through the body.
      day_count: 30,
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('day_count');
  });
});

describe('plan realtime channel + step constants (D-02)', () => {
  it('planChannelName builds plan:{tripId} and PLAN_CHANNEL_PREFIX is plan:', () => {
    expect(planChannelName('abc')).toBe('plan:abc');
    expect(PLAN_CHANNEL_PREFIX).toBe('plan:');
  });

  it('PlanStep + PLAN_STEP_KO mirror the extraction step/label idiom', () => {
    expect(PlanStep).toEqual(['loading', 'clustering', 'routing', 'done', 'error']);
    // done/error terminal — not in the Korean label map (mirrors EXTRACT_STEP_KO).
    expect(Object.keys(PLAN_STEP_KO)).toEqual(['loading', 'clustering', 'routing']);
  });

  it('TravelMode is transit/walk/drive', () => {
    expect(TravelMode).toEqual(['transit', 'walk', 'drive']);
  });
});

describe('PlanSchema — plan draft row (0017)', () => {
  const validPlanRow = {
    id: UUID,
    trip_id: UUID,
    status: 'draft' as const,
    travel_mode: 'transit' as const,
    collaborative: false,
    created_at: '2026-06-22T10:00:00.000Z',
    updated_at: '2026-06-22T10:00:00.000Z',
  };

  it('accepts a valid draft plan row', () => {
    const result = PlanSchema.parse(validPlanRow);
    expect(result.status).toBe('draft');
    expect(result.travel_mode).toBe('transit');
    expect(result.collaborative).toBe(false);
  });

  it('rejects a bogus status', () => {
    expect(() => PlanSchema.parse({ ...validPlanRow, status: 'bogus' })).toThrow();
  });
});

describe('PlanItemSchema — placed item row (0017)', () => {
  const validItem = {
    id: UUID,
    plan_id: UUID,
    place_id: UUID,
    day_index: 0,
    sort_order: 0,
    leg_travel_seconds: null,
    is_anchor: false,
    created_at: '2026-06-22T10:00:00.000Z',
  };

  it('accepts a valid plan item (leg_travel_seconds null = "이동시간 —")', () => {
    const result = PlanItemSchema.parse(validItem);
    expect(result.day_index).toBe(0);
    expect(result.leg_travel_seconds).toBeNull();
    expect(result.is_anchor).toBe(false);
  });

  it('rejects a negative day_index', () => {
    expect(() => PlanItemSchema.parse({ ...validItem, day_index: -1 })).toThrow();
  });
});
