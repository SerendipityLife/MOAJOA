import { describe, it, expect } from 'vitest';
import {
  LedgerStatus,
  FxSource,
  LedgerEntrySchema,
  LedgerParseOutputSchema,
  deriveAmountKrw,
  needsReview,
} from './ledger';

// Reuse the plan.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('Ledger enums — locked to 0022 CHECK constraints', () => {
  it('LedgerStatus matches the 0022 status CHECK (5 values, exact order)', () => {
    expect(LedgerStatus).toEqual([
      'pending',
      'processing',
      'ready',
      'needs_review',
      'failed',
    ]);
  });

  it('FxSource matches the 0022 fx_source CHECK (3 values, exact order)', () => {
    expect(FxSource).toEqual(['email', 'frankfurter', 'unavailable']);
  });
});

describe('LedgerEntrySchema — ledger row (0022, 5-element FX record)', () => {
  const validEntry = {
    id: UUID,
    owner_user_id: UUID,
    trip_id: UUID,
    status: 'ready' as const,
    platform: '신한카드',
    merchant: 'FAMILY MART',
    card_last4: '1234',
    amount_foreign: 1500,
    currency: 'JPY',
    fx_rate: 9.12,
    fx_source: 'frankfurter' as const,
    fx_as_of: '2026-07-03',
    amount_krw: 13680,
    paid_at: '2026-07-03T10:00:00.000Z',
    created_at: '2026-07-03T10:05:00.000Z',
    updated_at: '2026-07-03T10:05:00.000Z',
  };

  it('accepts a valid classified entry with the full 5-element FX record', () => {
    expect(LedgerEntrySchema.parse(validEntry)).toEqual(validEntry);
  });

  it('allows a null trip_id (unclassified, owner-private until assigned — D-05)', () => {
    const unclassified = { ...validEntry, trip_id: null };
    expect(LedgerEntrySchema.parse(unclassified).trip_id).toBeNull();
  });

  it('allows the whole FX record to be null (FX unavailable without failing the row)', () => {
    const noFx = {
      ...validEntry,
      amount_foreign: null,
      currency: null,
      fx_rate: null,
      fx_source: null,
      fx_as_of: null,
      amount_krw: null,
    };
    expect(LedgerEntrySchema.parse(noFx).fx_source).toBeNull();
  });

  it('rejects a bogus status', () => {
    expect(() => LedgerEntrySchema.parse({ ...validEntry, status: 'bogus' })).toThrow();
  });

  it('rejects a bogus fx_source', () => {
    expect(() => LedgerEntrySchema.parse({ ...validEntry, fx_source: 'yahoo' })).toThrow();
  });

  it('rejects a card_last4 that is not exactly 4 digits', () => {
    expect(() => LedgerEntrySchema.parse({ ...validEntry, card_last4: '12ab' })).toThrow();
    expect(() => LedgerEntrySchema.parse({ ...validEntry, card_last4: '123' })).toThrow();
  });

  it('rejects a currency that is not 3 chars', () => {
    expect(() => LedgerEntrySchema.parse({ ...validEntry, currency: 'JP' })).toThrow();
  });
});

describe('LedgerParseOutputSchema — LLM parse contract (21-04 정본)', () => {
  const validOutput = {
    platform: '신한카드',
    card_last4: '1234',
    merchant: 'FAMILY MART',
    amount_foreign: 1500,
    currency: 'JPY',
    paid_at: '2026-07-03T10:00:00.000Z',
    krw_amount: null,
    fx_rate: null,
    matched_trip_id: UUID,
    confidence: 'high' as const,
  };

  it('accepts a valid high-confidence parse output', () => {
    expect(LedgerParseOutputSchema.parse(validOutput)).toEqual(validOutput);
  });

  it('accepts an all-null low-confidence output (nothing extractable)', () => {
    const empty = {
      platform: null,
      card_last4: null,
      merchant: null,
      amount_foreign: null,
      currency: null,
      paid_at: null,
      krw_amount: null,
      fx_rate: null,
      matched_trip_id: null,
      confidence: 'low' as const,
    };
    expect(LedgerParseOutputSchema.parse(empty).confidence).toBe('low');
  });

  it('rejects a confidence outside high|low', () => {
    expect(() => LedgerParseOutputSchema.parse({ ...validOutput, confidence: 'medium' })).toThrow();
  });

  it('rejects a malformed card_last4', () => {
    expect(() => LedgerParseOutputSchema.parse({ ...validOutput, card_last4: '12' })).toThrow();
  });

  it('rejects a non-uuid matched_trip_id', () => {
    expect(() =>
      LedgerParseOutputSchema.parse({ ...validOutput, matched_trip_id: 'not-a-uuid' }),
    ).toThrow();
  });
});

describe('deriveAmountKrw — KRW is derived, not stored source (Pitfall 4)', () => {
  it('multiplies and rounds to the won', () => {
    expect(deriveAmountKrw(1000, 9.12)).toBe(9120);
  });

  it('returns null when amount_foreign is null', () => {
    expect(deriveAmountKrw(null, 9.12)).toBeNull();
  });

  it('returns null when fx_rate is null (FX unavailable)', () => {
    expect(deriveAmountKrw(1000, null)).toBeNull();
  });
});

describe('needsReview — low-confidence route predicate', () => {
  it('is true only for needs_review', () => {
    expect(needsReview('needs_review')).toBe(true);
    expect(needsReview('ready')).toBe(false);
    expect(needsReview('pending')).toBe(false);
  });
});
