import { describe, expect, it } from 'vitest';
import { TripCreateDraftSchema } from '@moajoa/core';
import { buildDraft } from '@/app/onboarding/_lib/build-draft';
// Phase 28: 상한 판정 한 벌 — 리터럴 30 하드코딩 금지, 단일 소스에서 가져온다.
import { Limits } from '@moajoa/core';
import { deriveDayCount, isDayCountWithinLimit } from '@/app/onboarding/_lib/build-draft';

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

// --- Phase 28 (D-08 · Pitfall 7): day_count 매핑 ---------------------------
// 정합 규칙: day_count는 항상 채운다. 캘린더로 정확한 날짜를 정하면 day_count를 그
// 범위에서 파생시켜 함께 저장한다 — EF fallback이 `day_count ?? computeDayCount(...)`로
// day_count를 항상 우선하므로(28-03), 파생 저장이 드리프트를 0으로 만든다.

describe('deriveDayCount', () => {
  it('counts inclusive days (same day = 1, 6/14~6/16 = 3)', () => {
    expect(deriveDayCount(new Date(2026, 5, 14), new Date(2026, 5, 14))).toBe(1);
    expect(deriveDayCount(new Date(2026, 5, 14), new Date(2026, 5, 16))).toBe(3);
  });

  it('treats a missing `to` as a single-day trip', () => {
    expect(deriveDayCount(new Date(2026, 5, 14), undefined)).toBe(1);
  });

  it('returns null when there is no `from`', () => {
    expect(deriveDayCount(undefined, undefined)).toBeNull();
  });

  it('returns the real value above the limit — no silent clamp (호출부가 판정한다)', () => {
    // 35일 범위: 조용히 30으로 깎으면 사용자 의도를 말없이 바꾸는 것이라 금지.
    expect(deriveDayCount(new Date(2026, 5, 1), new Date(2026, 6, 5))).toBe(35);
  });
});

describe('isDayCountWithinLimit', () => {
  it('accepts the upper bound and rejects one past it (Limits.TripDayCountMax)', () => {
    expect(isDayCountWithinLimit(Limits.TripDayCountMax)).toBe(true);
    expect(isDayCountWithinLimit(Limits.TripDayCountMax + 1)).toBe(false);
  });

  it('treats null (기간 미정) as within limit', () => {
    expect(isDayCountWithinLimit(null)).toBe(true);
  });
});

describe('buildDraft — day_count (3경로)', () => {
  it('duration pill path: day_count set, dates null', () => {
    const draft = buildDraft({
      city: 'tokyo',
      cityCustom: false,
      dateMode: 'duration',
      dayCount: 3,
      companion: '친구',
    });
    expect(draft.day_count).toBe(3);
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toBeNull();
  });

  it('calendar path: dates filled AND day_count derived from the range (Pitfall 7)', () => {
    const draft = buildDraft({
      city: 'osaka',
      cityCustom: false,
      dateMode: 'fixed',
      range: { from: new Date(2026, 5, 14), to: new Date(2026, 5, 16) },
      companion: '연인',
    });
    expect(draft.start_date).toBe('2026-06-14');
    expect(draft.end_date).toBe('2026-06-16');
    expect(draft.day_count).toBe(3);
  });

  it('calendar path with a single day (from only) → day_count 1', () => {
    const draft = buildDraft({
      city: 'osaka',
      cityCustom: false,
      dateMode: 'fixed',
      range: { from: new Date(2026, 5, 14), to: undefined },
      companion: '연인',
    });
    expect(draft.day_count).toBe(1);
  });

  it('unset path: day_count null and dates null (ONBOARD-04)', () => {
    const draft = buildDraft({
      city: 'seoul',
      cityCustom: false,
      dateMode: 'unset',
      dayCount: null,
      companion: '혼자',
    });
    expect(draft.day_count).toBeNull();
    expect(draft.start_date).toBeNull();
    expect(draft.end_date).toBeNull();
  });

  it('stale duration pill value is ignored once the calendar owns the date (상호 배타)', () => {
    // page.tsx가 모드 전환 시 상대 값을 비우지만, 매퍼도 모드를 단일 진실로 삼는다.
    const draft = buildDraft({
      city: 'tokyo',
      cityCustom: false,
      dateMode: 'fixed',
      dayCount: 3,
      range: { from: new Date(2026, 5, 14), to: new Date(2026, 5, 18) },
      companion: '친구',
    });
    expect(draft.day_count).toBe(5);
  });

  it('over-limit calendar range throws at the parse gate → INSERT가 발생하지 않는다', () => {
    // 마지막 방어선. 정상 UI 경로는 캘린더 max + canProceed가 앞단에서 막는다.
    expect(() =>
      buildDraft({
        city: 'tokyo',
        cityCustom: false,
        dateMode: 'fixed',
        range: { from: new Date(2026, 5, 1), to: new Date(2026, 6, 5) }, // 35일
        companion: '친구',
      }),
    ).toThrow();
  });
});
