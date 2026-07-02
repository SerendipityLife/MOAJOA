import { describe, it, expect } from 'vitest';
import {
  ClickTokenSchema,
  BookingClickContextSchema,
  buildAffiliateUrl,
  TP_PROGRAMS,
  buildSearchDestUrl,
  buildAiraloDestUrl,
  buildDirectSearchUrl,
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

// ---------------------------------------------------------------------------
// Phase 20 — live-measured travelpayouts spec (marker 745749 is a TEST FIXTURE
// here only; booking.ts must never hardcode it — T-20-10).
// ---------------------------------------------------------------------------

const MARKER = '745749';
const TOKEN = 'c_aB3xY9zQ';

describe('TP_PROGRAMS — public program structure constants (RESEARCH Anti-pattern 5)', () => {
  it('klook is click-form (c137 host, promo_id 4110); airalo is media-form (p 8310, campaign_id 541)', () => {
    expect(TP_PROGRAMS.klook).toEqual({
      kind: 'click',
      host: 'c137.travelpayouts.com',
      promoId: '4110',
    });
    expect(TP_PROGRAMS.airalo).toEqual({ kind: 'media', p: '8310', campaignId: '541' });
  });
});

describe('buildSearchDestUrl — platform search destination (A1/A2, sole URL-literal owner)', () => {
  it('klook: /ko/search/result/?query={q}', () => {
    expect(buildSearchDestUrl('klook', 'teamLab')).toBe(
      'https://www.klook.com/ko/search/result/?query=teamLab',
    );
  });

  it('kkday: /ko/product/productlist?keyword={q}', () => {
    expect(buildSearchDestUrl('kkday', 'teamLab')).toBe(
      'https://www.kkday.com/ko/product/productlist?keyword=teamLab',
    );
  });

  it('encodes a Korean place name exactly once (Pitfall 7)', () => {
    expect(buildSearchDestUrl('klook', '팀랩 플래닛')).toBe(
      `https://www.klook.com/ko/search/result/?query=${encodeURIComponent('팀랩 플래닛')}`,
    );
  });
});

describe('buildAiraloDestUrl — airalo.com/{slug} ([VERIFIED live])', () => {
  it("'japan-esim' → https://www.airalo.com/japan-esim", () => {
    expect(buildAiraloDestUrl('japan-esim')).toBe('https://www.airalo.com/japan-esim');
  });
});

describe('buildAffiliateUrl travelpayouts/klook — click form (live-verified 302)', () => {
  const dest = buildSearchDestUrl('klook', 'teamLab');
  const url = buildAffiliateUrl('travelpayouts', { program: 'klook', marker: MARKER, dest }, TOKEN);

  it('starts with https://c137.travelpayouts.com/click', () => {
    expect(url.startsWith('https://c137.travelpayouts.com/click')).toBe(true);
  });

  it('carries shmarker={marker}.{token} (dot separator, official SubID spec)', () => {
    expect(url).toContain(`shmarker=${MARKER}.${TOKEN}`);
  });

  it('carries promo_id=4110, source_type=customlink, type=click', () => {
    const sp = new URL(url).searchParams;
    expect(sp.get('promo_id')).toBe('4110');
    expect(sp.get('source_type')).toBe('customlink');
    expect(sp.get('type')).toBe('click');
  });

  it('custom_url decodes back to the destination in ONE decode; sub_id carries the token', () => {
    const sp = new URL(url).searchParams;
    expect(sp.get('custom_url')).toBe(dest);
    expect(sp.get('sub_id')).toBe(TOKEN);
  });

  it('rejects an invalid token in the real-spec branch too (ClickTokenSchema first line intact)', () => {
    expect(() =>
      buildAffiliateUrl('travelpayouts', { program: 'klook', marker: MARKER, dest }, 'bad.token'),
    ).toThrow();
  });
});

describe('buildAffiliateUrl travelpayouts/airalo — media form (live-verified 302)', () => {
  const dest = buildAiraloDestUrl('japan-esim');
  const url = buildAffiliateUrl(
    'travelpayouts',
    { program: 'airalo', marker: MARKER, trs: '123456', dest },
    TOKEN,
  );

  it('starts with https://tp.media/r and carries marker={marker}.{token}', () => {
    expect(url.startsWith('https://tp.media/r')).toBe(true);
    expect(new URL(url).searchParams.get('marker')).toBe(`${MARKER}.${TOKEN}`);
  });

  it('carries p=8310, campaign_id=541, trs=123456', () => {
    const sp = new URL(url).searchParams;
    expect(sp.get('p')).toBe('8310');
    expect(sp.get('campaign_id')).toBe('541');
    expect(sp.get('trs')).toBe('123456');
  });

  it('u decodes back to the destination; sub_id carries the token', () => {
    const sp = new URL(url).searchParams;
    expect(sp.get('u')).toBe(dest);
    expect(sp.get('sub_id')).toBe(TOKEN);
  });
});

describe('buildAffiliateUrl — Korean place name passes with EXACTLY one encoding (Pitfall 7)', () => {
  it('custom_url round-trips: one decode restores the dest, whose query is the raw Korean name', () => {
    const dest = buildSearchDestUrl('klook', '팀랩 플래닛');
    const url = buildAffiliateUrl(
      'travelpayouts',
      { program: 'klook', marker: MARKER, dest },
      TOKEN,
    );
    // the destination layer carries the name encoded exactly once (a double-encoded query
    // here is the Pitfall 7 breakage that lands %EC… garbage in the platform search box)…
    expect(dest).toContain(encodeURIComponent('팀랩 플래닛'));
    expect(dest).not.toContain(encodeURIComponent(encodeURIComponent('팀랩 플래닛')));
    // …the assembled URL embeds the whole destination encoded once more (one encode per
    // nesting layer — TP decodes the wrapper, the platform decodes the inner query)…
    expect(url).toContain(encodeURIComponent(dest));
    // …and one decode restores the destination whose inner query is the original name.
    const custom = new URL(url).searchParams.get('custom_url');
    expect(custom).toBe(dest);
    expect(new URL(custom as string).searchParams.get('query')).toBe('팀랩 플래닛');
  });
});

describe('buildAffiliateUrl travelpayouts/kkday — media form, tp.st fallback, or throw', () => {
  it('media form when p + campaign_id are injected (dashboard template — Open Q1)', () => {
    const dest = buildSearchDestUrl('kkday', '유니버설');
    const url = buildAffiliateUrl(
      'travelpayouts',
      { program: 'kkday', marker: MARKER, p: '9999', campaign_id: '777', dest },
      TOKEN,
    );
    const sp = new URL(url).searchParams;
    expect(url.startsWith('https://tp.media/r')).toBe(true);
    expect(sp.get('p')).toBe('9999');
    expect(sp.get('campaign_id')).toBe('777');
    expect(sp.get('u')).toBe(dest);
    expect(sp.get('sub_id')).toBe(TOKEN);
  });

  it('falls back to {fallback_base}?sub_id={token} (tp.st dynamic sub_id — live-verified)', () => {
    const url = buildAffiliateUrl(
      'travelpayouts',
      { program: 'kkday', marker: MARKER, fallback_base: 'https://kkday.tp.st/gVbA69Yv' },
      TOKEN,
    );
    expect(url).toBe(`https://kkday.tp.st/gVbA69Yv?sub_id=${TOKEN}`);
  });

  it('throws when neither p+campaign_id nor fallback_base is present (caller pre-gates)', () => {
    expect(() =>
      buildAffiliateUrl('travelpayouts', { program: 'kkday', marker: MARKER }, TOKEN),
    ).toThrow();
  });
});

describe('buildDirectSearchUrl — D-05 non-affiliate stay search prefill', () => {
  const params = { city: '도쿄', checkIn: '2026-08-01', checkOut: '2026-08-05' };

  it('agoda: /ko-kr/search + textToSearch/checkIn/checkOut/rooms=1/adults=2', () => {
    const url = buildDirectSearchUrl('agoda', params);
    const sp = new URL(url).searchParams;
    expect(url.startsWith('https://www.agoda.com/ko-kr/search?')).toBe(true);
    expect(sp.get('textToSearch')).toBe('도쿄');
    expect(sp.get('checkIn')).toBe('2026-08-01');
    expect(sp.get('checkOut')).toBe('2026-08-05');
    expect(sp.get('rooms')).toBe('1');
    expect(sp.get('adults')).toBe('2');
  });

  it('booking: /searchresults.ko.html + ss/checkin/checkout/group_adults=2/no_rooms=1', () => {
    const url = buildDirectSearchUrl('booking', params);
    const sp = new URL(url).searchParams;
    expect(url.startsWith('https://www.booking.com/searchresults.ko.html?')).toBe(true);
    expect(sp.get('ss')).toBe('도쿄');
    expect(sp.get('checkin')).toBe('2026-08-01');
    expect(sp.get('checkout')).toBe('2026-08-05');
    expect(sp.get('group_adults')).toBe('2');
    expect(sp.get('no_rooms')).toBe('1');
  });
});
