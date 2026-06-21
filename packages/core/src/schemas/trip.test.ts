import { describe, it, expect } from 'vitest';
import { TripCreateSchema, TripSchema, type Trip, type TripId } from './trip';

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
});
