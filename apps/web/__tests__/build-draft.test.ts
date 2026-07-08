import { describe, expect, it } from 'vitest';
import { TripCreateDraftSchema } from '@moajoa/core';
import { buildDraft } from '@/app/onboarding/_lib/build-draft';

describe('buildDraft', () => {
  it('maps fixed dates to local YYYY-MM-DD (range.to absent → day trip)', () => {
    const draft = buildDraft({
      city: 'tokyo',
      cityCustom: false,
      dateMode: 'fixed',
      range: { from: new Date(2026, 6, 10), to: new Date(2026, 6, 13) },
      companion: '친구',
    });
    expect(draft.start_date).toBe('2026-07-10');
    expect(draft.end_date).toBe('2026-07-13');

    const dayTrip = buildDraft({
      city: 'tokyo',
      cityCustom: false,
      dateMode: 'fixed',
      range: { from: new Date(2026, 6, 10), to: undefined },
      companion: '친구',
    });
    expect(dayTrip.start_date).toBe('2026-07-10');
    expect(dayTrip.end_date).toBe('2026-07-10');
  });

  it('maps unset mode to both dates null (ONBOARD-04)', () => {
    const draft = buildDraft({
      city: 'osaka',
      cityCustom: false,
      dateMode: 'unset',
      companion: '연인',
    });
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toBeNull();
  });

  it('derives title from chip city and custom input', () => {
    const chip = buildDraft({
      city: 'tokyo',
      cityCustom: false,
      dateMode: 'unset',
      companion: '혼자',
    });
    expect(chip.title).toBe('도쿄 모아');
    expect(chip.city_code).toBe('tokyo');

    const custom = buildDraft({
      city: '나고야',
      cityCustom: true,
      dateMode: 'unset',
      companion: '혼자',
    });
    expect(custom.title).toBe('나고야 모아');
    expect(custom.city_code).toBe('나고야');
  });

  it('allows companion null (mapper defends even though step 3 is required)', () => {
    const draft = buildDraft({
      city: 'seoul',
      cityCustom: false,
      dateMode: 'unset',
      companion: null,
    });
    expect(draft.companion).toBeNull();
  });

  it('produces output that passes TripCreateDraftSchema.parse', () => {
    const draft = buildDraft({
      city: 'jeju',
      cityCustom: false,
      dateMode: 'fixed',
      range: { from: new Date(2026, 7, 1), to: new Date(2026, 7, 3) },
      companion: '가족',
    });
    expect(() => TripCreateDraftSchema.parse(draft)).not.toThrow();
  });
});
