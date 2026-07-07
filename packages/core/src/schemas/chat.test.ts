import { describe, it, expect } from 'vitest';
import { ShareMode, MOA_CHANNEL_PREFIX, moaChannelName } from '../constants';
import { TripMessageSchema, TripMessageCreateSchema } from './chat';

// Reuse the plan.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('ShareMode — locked to the 0025 trips.share_mode CHECK', () => {
  it('matches the 0025 CHECK character-for-character (3 values, exact order)', () => {
    expect(ShareMode).toEqual(['dates', 'places', 'both']);
  });
});

describe('moaChannelName — unified moa share channel (Phase 26 consumer)', () => {
  it('prefix is moa:', () => {
    expect(MOA_CHANNEL_PREFIX).toBe('moa:');
  });

  it('builds moa:{tripId}', () => {
    expect(moaChannelName('abc')).toBe('moa:abc');
  });
});

describe('TripMessageSchema — trip_messages row (0025, 1:1 columns)', () => {
  const validMessage = {
    id: UUID,
    trip_id: UUID,
    user_id: UUID,
    nickname: '민지',
    body: '도톤보리 여기 어때?',
    reply_to_place_id: UUID,
    created_at: '2026-07-08T10:00:00.000Z',
  };

  it('accepts a valid message row', () => {
    expect(TripMessageSchema.parse(validMessage)).toEqual(validMessage);
  });

  it('allows a null reply_to_place_id (plain message, or place hard-deleted → set null)', () => {
    const plain = { ...validMessage, reply_to_place_id: null };
    expect(TripMessageSchema.parse(plain).reply_to_place_id).toBeNull();
  });

  it('rejects an empty body (0025 CHECK: char_length >= 1)', () => {
    expect(() => TripMessageSchema.parse({ ...validMessage, body: '' })).toThrow();
  });

  it('rejects a 141-char body (0025 CHECK: char_length <= 140)', () => {
    expect(() =>
      TripMessageSchema.parse({ ...validMessage, body: 'a'.repeat(141) }),
    ).toThrow();
    // Boundary: exactly 140 is fine.
    expect(TripMessageSchema.parse({ ...validMessage, body: 'a'.repeat(140) }).body).toHaveLength(
      140,
    );
  });

  it('rejects a non-uuid user_id', () => {
    expect(() => TripMessageSchema.parse({ ...validMessage, user_id: 'not-a-uuid' })).toThrow();
  });
});

describe('TripMessageCreateSchema — client input subset (id/user_id/created_at are server-side)', () => {
  it('accepts trip_id + nickname + body only (reply_to_place_id optional)', () => {
    const result = TripMessageCreateSchema.parse({
      trip_id: UUID,
      nickname: '민지',
      body: '여기 가자',
    });
    expect(result.trip_id).toBe(UUID);
    expect(result.reply_to_place_id).toBeUndefined();
  });

  it('accepts an explicit reply_to_place_id (nullable + optional)', () => {
    const result = TripMessageCreateSchema.parse({
      trip_id: UUID,
      nickname: '민지',
      body: '여기 가자',
      reply_to_place_id: UUID,
    });
    expect(result.reply_to_place_id).toBe(UUID);
  });

  it('strips server-owned fields — id/user_id/created_at are not part of the create shape', () => {
    const result = TripMessageCreateSchema.parse({
      trip_id: UUID,
      nickname: '민지',
      body: '여기 가자',
      id: UUID,
      user_id: UUID,
      created_at: '2026-07-08T10:00:00.000Z',
    });
    expect('id' in result).toBe(false);
    expect('user_id' in result).toBe(false);
    expect('created_at' in result).toBe(false);
  });

  it('rejects an over-limit body just like the row schema', () => {
    expect(() =>
      TripMessageCreateSchema.parse({
        trip_id: UUID,
        nickname: '민지',
        body: 'a'.repeat(141),
      }),
    ).toThrow();
  });
});
