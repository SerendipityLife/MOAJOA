import { describe, it, expect } from 'vitest';
import { pollChannelName, POLL_CHANNEL_PREFIX, DatePollMode } from '../constants';
import {
  DatePollSchema,
  TripCreateDatelessSchema,
  CastDateVoteRequestSchema,
  contiguousBlock,
} from './date-poll';

// Reuse the plan.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('DatePollSchema — poll row (0018)', () => {
  const validPoll = {
    id: UUID,
    trip_id: UUID,
    poll_code: 'abcd1234',
    mode: 'range' as const,
    status: 'open' as const,
    created_at: '2026-06-23T10:00:00.000Z',
  };

  it('accepts a valid open poll row', () => {
    const result = DatePollSchema.parse(validPoll);
    expect(result.mode).toBe('range');
    expect(result.status).toBe('open');
  });

  it('rejects a bogus mode', () => {
    expect(() => DatePollSchema.parse({ ...validPoll, mode: 'bogus' })).toThrow();
  });

  it('rejects a non-uuid trip_id', () => {
    expect(() => DatePollSchema.parse({ ...validPoll, trip_id: 'not-a-uuid' })).toThrow();
  });
});

describe('TripCreateDatelessSchema — "일정 미정" create (D-04, NO dates)', () => {
  it('accepts title + city_code + poll_mode', () => {
    expect(
      TripCreateDatelessSchema.parse({ title: '도쿄', city_code: 'tokyo', poll_mode: 'range' }),
    ).toEqual({ title: '도쿄', city_code: 'tokyo', poll_mode: 'range' });
  });

  it('rejects a missing poll_mode', () => {
    expect(() => TripCreateDatelessSchema.parse({ title: '도쿄', city_code: 'tokyo' })).toThrow();
  });

  it('rejects a bad poll_mode', () => {
    expect(() =>
      TripCreateDatelessSchema.parse({ title: '도쿄', city_code: 'tokyo', poll_mode: 'bad' }),
    ).toThrow();
  });

  it('mirrors DatePollMode (range | grid)', () => {
    expect(DatePollMode).toEqual(['range', 'grid']);
  });
});

describe('CastDateVoteRequestSchema — availability default + reject cases', () => {
  it('defaults availability to available', () => {
    expect(
      CastDateVoteRequestSchema.parse({ code: 'abcd1234', deviceToken: 'd1', nickname: '나' }),
    ).toEqual({
      code: 'abcd1234',
      deviceToken: 'd1',
      nickname: '나',
      availability: 'available',
    });
  });

  it('rejects a bad availability', () => {
    expect(() =>
      CastDateVoteRequestSchema.parse({
        code: 'abcd1234',
        deviceToken: 'd1',
        nickname: '나',
        availability: 'maybe',
      }),
    ).toThrow();
  });

  it('rejects an empty nickname (min 1)', () => {
    expect(() =>
      CastDateVoteRequestSchema.parse({ code: 'abcd1234', deviceToken: 'd1', nickname: '' }),
    ).toThrow();
  });
});

describe('poll realtime channel', () => {
  it('pollChannelName builds poll:{tripId} and POLL_CHANNEL_PREFIX is poll:', () => {
    expect(pollChannelName('abc')).toBe('poll:abc');
    expect(POLL_CHANNEL_PREFIX).toBe('poll:');
  });
});

describe('contiguousBlock — grid 연속블록 recommender (D-09, POLL-03)', () => {
  it('picks the window whose minimum daily count is highest (max-overlap)', () => {
    // d2..d3 has min 3; the d1..d2 / d3..d4 windows have min 1.
    const perDay = [
      { date: '2026-07-01', count: 1 },
      { date: '2026-07-02', count: 3 },
      { date: '2026-07-03', count: 3 },
      { date: '2026-07-04', count: 1 },
    ];
    expect(contiguousBlock(perDay, 2)).toEqual({ start: '2026-07-02', end: '2026-07-03' });
  });

  it('returns null when runLength exceeds available days', () => {
    const perDay = [
      { date: '2026-07-01', count: 2 },
      { date: '2026-07-02', count: 2 },
      { date: '2026-07-03', count: 2 },
      { date: '2026-07-04', count: 2 },
    ];
    expect(contiguousBlock(perDay, 5)).toBeNull();
  });

  it('picks the earliest window on a tie', () => {
    // All windows of length 2 have min 2 — earliest (d1..d2) wins.
    const perDay = [
      { date: '2026-07-01', count: 2 },
      { date: '2026-07-02', count: 2 },
      { date: '2026-07-03', count: 2 },
    ];
    expect(contiguousBlock(perDay, 2)).toEqual({ start: '2026-07-01', end: '2026-07-02' });
  });

  it('sorts unsorted input by date before windowing', () => {
    const perDay = [
      { date: '2026-07-03', count: 3 },
      { date: '2026-07-01', count: 1 },
      { date: '2026-07-02', count: 3 },
    ];
    expect(contiguousBlock(perDay, 2)).toEqual({ start: '2026-07-02', end: '2026-07-03' });
  });
});
