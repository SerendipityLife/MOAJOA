import { describe, it, expect } from 'vitest';
import {
  ClickTokenSchema,
  BookingClickContextSchema,
  buildAffiliateUrl,
} from './booking';

// A valid uuid v4 fixture reused across context cases.
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

describe('ClickTokenSchema — c_ + base62 (8-30 chars)', () => {
  it("accepts 'c_aB3xY9zQ' (c_ + 8 base62 chars)", () => {
    expect(ClickTokenSchema.parse('c_aB3xY9zQ')).toBe('c_aB3xY9zQ');
  });

  it('accepts c_ + 30 base62 chars (max length)', () => {
    const token = 'c_' + 'a'.repeat(30);
    expect(ClickTokenSchema.parse(token)).toBe(token);
  });

  it('rejects c_ + 31 base62 chars (over max 30)', () => {
    expect(() => ClickTokenSchema.parse('c_' + 'a'.repeat(31))).toThrow();
  });

  it("rejects 'c_abc' (5 chars after c_, below min 8)", () => {
    expect(() => ClickTokenSchema.parse('c_abc')).toThrow();
  });

  it("rejects 'c_ab.cd' (contains '.')", () => {
    expect(() => ClickTokenSchema.parse('c_ab.cd')).toThrow();
  });

  it("rejects 'c_ab-cd' (contains '-')", () => {
    expect(() => ClickTokenSchema.parse('c_ab-cd')).toThrow();
  });

  it("rejects 'c_ab_cd' (contains '_')", () => {
    expect(() => ClickTokenSchema.parse('c_ab_cd')).toThrow();
  });

  it("rejects 'tripId.placeId' (no c_ prefix)", () => {
    expect(() => ClickTokenSchema.parse('tripId.placeId')).toThrow();
  });
});

describe('BookingClickContextSchema — UUID context, optional placeId (D-04)', () => {
  it('accepts { tripId, userId } (placeId optional)', () => {
    expect(
      BookingClickContextSchema.parse({ tripId: UUID_A, userId: UUID_B }),
    ).toEqual({ tripId: UUID_A, userId: UUID_B });
  });

  it('accepts { tripId, placeId, userId }', () => {
    expect(
      BookingClickContextSchema.parse({
        tripId: UUID_A,
        placeId: UUID_C,
        userId: UUID_B,
      }),
    ).toEqual({ tripId: UUID_A, placeId: UUID_C, userId: UUID_B });
  });

  it("rejects { tripId: 'not-a-uuid', userId }", () => {
    expect(() =>
      BookingClickContextSchema.parse({ tripId: 'not-a-uuid', userId: UUID_B }),
    ).toThrow();
  });
});

describe('buildAffiliateUrl — single helper, token always injected (ATTR-01)', () => {
  it("travelpayouts: contains the subId AND 'sub_id'", () => {
    const url = buildAffiliateUrl('travelpayouts', { p: '1' }, 'c_aB3xY9zQ');
    expect(url).toContain('c_aB3xY9zQ');
    expect(url).toContain('sub_id');
  });

  it("stay22: contains the subId AND 'campaign'", () => {
    const url = buildAffiliateUrl('stay22', { hotelname: 'x' }, 'c_aB3xY9zQ');
    expect(url).toContain('c_aB3xY9zQ');
    expect(url).toContain('campaign');
  });

  it('both providers always contain the exact subId substring', () => {
    const token = 'c_aB3xY9zQ';
    expect(buildAffiliateUrl('travelpayouts', { p: '1' }, token)).toContain(token);
    expect(buildAffiliateUrl('stay22', { hotelname: 'x' }, token)).toContain(token);
  });

  it('rejects a non-ClickToken subId at runtime (parsed through ClickTokenSchema)', () => {
    // ClickToken is a plain `string` at the type level (no brand), so the guard is runtime:
    // buildAffiliateUrl re-parses subId through ClickTokenSchema and throws on an invalid shape.
    expect(() => buildAffiliateUrl('travelpayouts', { p: '1' }, 'bad.token')).toThrow();
  });
});
