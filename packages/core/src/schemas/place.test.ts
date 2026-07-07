import { describe, it, expect } from 'vitest';
import { PlaceSchema } from './place';

// Reuse the plan.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('PlaceSchema.seq_no — trip-scoped permanent ordinal (0024 mirror, MOA-01)', () => {
  const validPlace = {
    id: UUID,
    board_id: UUID,
    link_id: null,
    added_by: UUID,
    google_place_id: null,
    name_local: '一蘭 道頓堀',
    name_ko: '이치란 도톤보리점',
    name_en: null,
    lat: 34.668,
    lng: 135.501,
    category: null,
    address: null,
    source_timestamp_sec: null,
    source_quote: null,
    summary_ko: null,
    note: null,
    hidden_at: null,
    source_kind: 'manual' as const,
    confidence: null,
    seq_no: 1,
    created_at: '2026-07-08T10:00:00.000Z',
  };

  it('accepts a positive integer seq_no and preserves it', () => {
    expect(PlaceSchema.parse(validPlace).seq_no).toBe(1);
  });

  it('rejects seq_no 0 (ordinals start at #1)', () => {
    expect(() => PlaceSchema.parse({ ...validPlace, seq_no: 0 })).toThrow();
  });

  it('rejects a negative seq_no', () => {
    expect(() => PlaceSchema.parse({ ...validPlace, seq_no: -3 })).toThrow();
  });

  it('rejects a fractional seq_no', () => {
    expect(() => PlaceSchema.parse({ ...validPlace, seq_no: 1.5 })).toThrow();
  });
});
