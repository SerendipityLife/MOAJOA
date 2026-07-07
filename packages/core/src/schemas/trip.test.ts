import { describe, it, expect } from 'vitest';
import {
  TripCreateSchema,
  TripCreateDraftSchema,
  TripSchema,
  type Trip,
  type TripId,
} from './trip';

describe('TripCreateSchema — required dates + end >= start (SETUP-01, D-09)', () => {
  it('accepts a valid multi-day create', () => {
    const result = TripCreateSchema.parse({
      title: 't',
      city_code: 'tokyo',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
    });
    expect(result.start_date).toBe('2026-07-01');
    expect(result.end_date).toBe('2026-07-03');
  });

  it('accepts a day-trip (end_date == start_date)', () => {
    const result = TripCreateSchema.parse({
      title: '당일치기',
      city_code: 'seoul',
      start_date: '2026-07-01',
      end_date: '2026-07-01',
    });
    expect(result.end_date).toBe(result.start_date);
  });

  it('rejects end_date < start_date (refine)', () => {
    expect(() =>
      TripCreateSchema.parse({
        title: 't',
        city_code: 'tokyo',
        start_date: '2026-07-03',
        end_date: '2026-07-01',
      }),
    ).toThrow();
  });

  it('rejects a missing start_date (date required, D-09)', () => {
    expect(() =>
      TripCreateSchema.parse({
        title: 't',
        city_code: 'tokyo',
        end_date: '2026-07-03',
      }),
    ).toThrow();
  });

  it('rejects a missing end_date (date required, D-09)', () => {
    expect(() =>
      TripCreateSchema.parse({
        title: 't',
        city_code: 'tokyo',
        start_date: '2026-07-01',
      }),
    ).toThrow();
  });
});

describe('TripSchema — full trip row (D-02, D-10)', () => {
  const fullTrip = {
    id: '11111111-1111-1111-1111-111111111111',
    owner_id: '22222222-2222-2222-2222-222222222222',
    representative_id: '33333333-3333-3333-3333-333333333333',
    title: '도쿄 3박 4일',
    description: null,
    visibility: 'private' as const,
    share_slug: null,
    city_code: 'tokyo',
    start_date: '2026-07-01',
    end_date: '2026-07-03',
    cover_image_url: null,
    share_mode: null,
    companion: null,
    created_at: '2026-06-21T10:00:00.000Z',
    updated_at: '2026-06-21T10:00:00.000Z',
  };

  it('parses a full trip row (with representative_id uuid)', () => {
    const result = TripSchema.parse(fullTrip);
    expect(result.id).toBe(fullTrip.id);
    expect(result.representative_id).toBe(fullTrip.representative_id);
  });

  it('rejects a missing representative_id', () => {
    const { representative_id, ...withoutRep } = fullTrip;
    void representative_id;
    expect(() => TripSchema.parse(withoutRep)).toThrow();
  });

  it('TripId is the type of Trip.id', () => {
    const id: TripId = fullTrip.id;
    const trip: Trip = fullTrip;
    expect(id).toBe(trip.id);
  });

  it('accepts share_mode both (0025 mirror) and preserves it', () => {
    const shared = { ...fullTrip, share_mode: 'both' as const };
    expect(TripSchema.parse(shared).share_mode).toBe('both');
  });

  it('allows a null share_mode (legacy trip, never moa-shared)', () => {
    expect(TripSchema.parse(fullTrip).share_mode).toBeNull();
  });

  it('rejects a share_mode outside the 0025 CHECK', () => {
    expect(() => TripSchema.parse({ ...fullTrip, share_mode: 'invalid' })).toThrow();
  });

  it('allows a null companion (0025 mirror)', () => {
    expect(TripSchema.parse(fullTrip).companion).toBeNull();
  });
});

describe('TripCreateDraftSchema — 온보딩 4단계 draft, dates optional (ONBOARD-03/04)', () => {
  it('accepts 미정 dates (both null) with a null companion', () => {
    const result = TripCreateDraftSchema.parse({
      title: '오사카',
      city_code: 'osaka',
      start_date: null,
      end_date: null,
      companion: null,
    });
    expect(result.start_date).toBeNull();
    expect(result.end_date).toBeNull();
  });

  it('accepts a fully dated draft', () => {
    const result = TripCreateDraftSchema.parse({
      title: '오사카',
      city_code: 'osaka',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      companion: '친구',
    });
    expect(result.end_date).toBe('2026-08-03');
  });

  it('rejects start_date null with end_date set (both set or both null)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: null,
        end_date: '2026-08-03',
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects end_date null with start_date set (both set or both null)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: '2026-08-01',
        end_date: null,
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects end_date < start_date', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: '2026-08-03',
        end_date: '2026-08-01',
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects a 21-char companion (0025 CHECK: <= 20)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: null,
        end_date: null,
        companion: 'ㅁ'.repeat(21),
      }),
    ).toThrow();
  });
});
