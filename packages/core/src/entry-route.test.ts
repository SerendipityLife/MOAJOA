import { describe, it, expect } from 'vitest';
import { decideEntryRoute } from './entry-route';

describe('decideEntryRoute — 0/1/N entry branch (NAV-01)', () => {
  it('0 trips → onboarding', () => {
    expect(decideEntryRoute([], null)).toEqual({ kind: 'onboarding' });
  });

  it('1 trip → that trip (lastTripId ignored)', () => {
    expect(decideEntryRoute([{ id: 'a' }], null)).toEqual({ kind: 'trip', tripId: 'a' });
  });

  it('N trips, last-viewed present → honor last-viewed', () => {
    expect(decideEntryRoute([{ id: 'a' }, { id: 'b' }], 'b')).toEqual({
      kind: 'trip',
      tripId: 'b',
    });
  });

  it('N trips, last-viewed deleted (not in list) → fall back to trips[0]', () => {
    expect(decideEntryRoute([{ id: 'a' }, { id: 'b' }], 'zzz')).toEqual({
      kind: 'trip',
      tripId: 'a',
    });
  });

  it('N trips, no last-viewed → trips[0]', () => {
    expect(decideEntryRoute([{ id: 'a' }, { id: 'b' }], null)).toEqual({
      kind: 'trip',
      tripId: 'a',
    });
  });
});
