// Contract tests for apps/ios/lib/booking.ts (Plan 20-05 Task 1).
//
// The load-bearing contract (D-14 / ATTR-02):
//   1. mintClickToken → `c_` + 16 base62 chars, CSPRNG-minted via expo-crypto
//      (Math.random forbidden — the grep gate covers the source side), unique
//      across calls, and passes @moajoa/core ClickTokenSchema.
//   2. openBooking fires Linking.openURL strictly BEFORE logBookingClick —
//      open-first is the whole point: logging never delays the browser.
//   3. A forever-pending logBookingClick never blocks openBooking resolving.
//   4. A rejecting logBookingClick is swallowed (.catch — no unhandled rejection).
//   5. The opened URL is buildAffiliateUrl's output (tracking domain), never the
//      destination domain directly (Klook native-app universal-link interception —
//      RESEARCH Anti-pattern 1).
//
// Scoped mocks mirror the plan.test.tsx harness: expo modules + @moajoa/api +
// @/lib/supabase are stubbed; @moajoa/core stays REAL so URL assertions compare
// against the single assembly seam's actual output.

const mockExtra: Record<string, string | undefined> = {};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: mockExtra } },
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-crypto', () => ({
  // CSPRNG stand-in: Node's crypto fills genuinely random bytes, so the
  // 100-mint uniqueness assertion holds without a hand-rolled PRNG.
  getRandomValues: jest.fn(<T extends Uint8Array>(arr: T): T => {
    require('crypto').randomFillSync(arr);
    return arr;
  }),
}));

jest.mock('@moajoa/api', () => ({
  logBookingClick: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { logBookingClick } from '@moajoa/api';
import { buildAffiliateUrl, buildDirectSearchUrl, ClickTokenSchema } from '@moajoa/core';
import {
  kkdayAvailable,
  mintClickToken,
  openBooking,
  openDirectSearch,
} from '@/lib/booking';

const openURL = Linking.openURL as jest.Mock;
const logClick = logBookingClick as unknown as jest.Mock;
const getRandomValues = Crypto.getRandomValues as unknown as jest.Mock;

const ctx = {
  tripId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
};

beforeEach(() => {
  jest.clearAllMocks();
  logClick.mockImplementation(() => Promise.resolve());
  for (const k of Object.keys(mockExtra)) delete mockExtra[k];
  mockExtra.tpMarker = '123456';
  mockExtra.tpTrs = '433624';
});

describe('mintClickToken — CSPRNG base62 (T-20-04)', () => {
  it('matches c_ + 16 base62 chars and passes ClickTokenSchema', () => {
    const token = mintClickToken();
    expect(token).toMatch(/^c_[0-9A-Za-z]{16}$/);
    expect(() => ClickTokenSchema.parse(token)).not.toThrow();
  });

  it('is unique across 100 mints and always routes through expo-crypto', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => mintClickToken()));
    expect(tokens.size).toBe(100);
    expect(getRandomValues).toHaveBeenCalledTimes(100);
  });
});

describe('openBooking — open-first, log-later (D-14 / ATTR-02)', () => {
  const args = {
    program: 'klook' as const,
    destUrl: 'https://www.klook.com/ko/search/result/?query=USJ',
    ctx,
    checklistItemId: '33333333-3333-4333-8333-333333333333',
    providerLabel: 'Klook',
  };

  it('calls Linking.openURL strictly BEFORE logBookingClick', async () => {
    await openBooking(args);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(logClick).toHaveBeenCalledTimes(1);
    expect(openURL.mock.invocationCallOrder[0]).toBeLessThan(
      logClick.mock.invocationCallOrder[0],
    );
  });

  it('resolves even when logBookingClick stays pending forever (log is non-blocking)', async () => {
    logClick.mockImplementation(() => new Promise(() => {}));
    await expect(openBooking(args)).resolves.toBeUndefined();
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejecting logBookingClick (fire-and-forget, silent — UI-SPEC error state NONE)', async () => {
    logClick.mockImplementation(() => Promise.reject(new Error('rls denied')));
    await expect(openBooking(args)).resolves.toBeUndefined();
    // Flush microtasks so an unswallowed rejection would surface as unhandled.
    await new Promise((resolve) => setImmediate(resolve));
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it('opens EXACTLY the buildAffiliateUrl output — tracking domain, never the destination', async () => {
    await openBooking(args);
    const openedUrl = openURL.mock.calls[0][0] as string;
    const token = (logClick.mock.calls[0][1] as { click_token: string }).click_token;
    expect(openedUrl).toBe(
      buildAffiliateUrl(
        'travelpayouts',
        { program: 'klook', marker: '123456', trs: '433624', dest: args.destUrl },
        token,
      ),
    );
    expect(openedUrl.startsWith('https://c137.travelpayouts.com/click')).toBe(true);
    expect(openedUrl.startsWith('https://www.klook.com')).toBe(false);
  });

  it('logs trip/user/provider/checklist context with the minted token', async () => {
    await openBooking(args);
    const input = logClick.mock.calls[0][1] as Record<string, unknown>;
    expect(input).toMatchObject({
      trip_id: ctx.tripId,
      user_id: ctx.userId,
      place_id: null,
      provider: 'klook',
      checklist_item_id: args.checklistItemId,
    });
    expect(input.click_token).toMatch(/^c_[0-9A-Za-z]{16}$/);
  });

  it('does NOT open (nor log) when tpMarker is unwired — dev safety warn instead', async () => {
    delete mockExtra.tpMarker;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await openBooking(args);
    expect(openURL).not.toHaveBeenCalled();
    expect(logClick).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('kkday routes through the tp.st fallback_base when template params are absent', async () => {
    mockExtra.tpKkdayFallback = 'https://kkday.tp.st/gVbA69Yv';
    await openBooking({
      ...args,
      program: 'kkday',
      providerLabel: 'KKday',
      destUrl: 'https://www.kkday.com/ko/product/productlist?keyword=USJ',
    });
    const openedUrl = openURL.mock.calls[0][0] as string;
    expect(openedUrl.startsWith('https://kkday.tp.st/gVbA69Yv?sub_id=c_')).toBe(true);
  });
});

describe('kkdayAvailable — env-gated KKday visibility (graceful hide)', () => {
  it('is false when no kkday env is wired at all', () => {
    expect(kkdayAvailable()).toBe(false);
  });

  it('is true with fallback only, and true with p+campaign_id', () => {
    mockExtra.tpKkdayFallback = 'https://kkday.tp.st/gVbA69Yv';
    expect(kkdayAvailable()).toBe(true);
    delete mockExtra.tpKkdayFallback;
    mockExtra.tpKkdayP = '1234';
    mockExtra.tpKkdayCampaignId = '567';
    expect(kkdayAvailable()).toBe(true);
  });
});

describe('openDirectSearch — D-05 non-affiliate stay path', () => {
  it('opens buildDirectSearchUrl output FIRST and logs provider {name}_direct', async () => {
    await openDirectSearch({
      provider: 'agoda',
      params: { city: 'Tokyo', checkIn: '2026-08-01', checkOut: '2026-08-05' },
      ctx,
    });
    expect(openURL.mock.invocationCallOrder[0]).toBeLessThan(
      logClick.mock.invocationCallOrder[0],
    );
    expect(openURL.mock.calls[0][0]).toBe(
      buildDirectSearchUrl('agoda', {
        city: 'Tokyo',
        checkIn: '2026-08-01',
        checkOut: '2026-08-05',
      }),
    );
    expect(logClick.mock.calls[0][1]).toMatchObject({ provider: 'agoda_direct' });
  });
});
