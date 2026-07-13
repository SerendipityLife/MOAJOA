import { describe, it, expect } from 'vitest';
import {
  TripCreateSchema,
  TripCreateDraftSchema,
  TripSchema,
  TripUpdateSchema,
  type Trip,
  type TripId,
} from './trip';
import { Limits } from '../constants';

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
    share_mode: null,
    companion: null,
    day_count: null,
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

  it('accepts share_mode both (0025 mirror) and preserves it', () => {
    const shared = { ...fullTrip, share_mode: 'both' as const };
    expect(TripSchema.parse(shared).share_mode).toBe('both');
  });

  it('allows a null share_mode (legacy trip, never moa-shared)', () => {
    expect(TripSchema.parse(fullTrip).share_mode).toBeNull();
  });

  it('rejects a share_mode outside the 0025 CHECK', () => {
    expect(() => TripSchema.parse({ ...fullTrip, share_mode: 'invalid' })).toThrow();
  });

  it('allows a null companion (0025 mirror)', () => {
    expect(TripSchema.parse(fullTrip).companion).toBeNull();
  });

  // --- day_count (migration 0031, D-08) — required-nullable, share_mode 선례 미러 ---

  it('accepts a null day_count (기간 미정 — 레거시 모아도 이 값)', () => {
    expect(TripSchema.parse(fullTrip).day_count).toBeNull();
  });

  it('accepts day_count at the lower bound (1 = 당일치기)', () => {
    expect(TripSchema.parse({ ...fullTrip, day_count: 1 }).day_count).toBe(1);
  });

  it('accepts day_count at the upper bound (Limits.TripDayCountMax)', () => {
    const max = Limits.TripDayCountMax;
    expect(TripSchema.parse({ ...fullTrip, day_count: max }).day_count).toBe(max);
  });

  it('rejects day_count above the upper bound (0031 CHECK와 같은 상한 — 초과분이 INSERT까지 새면 DB가 거부한다)', () => {
    expect(() =>
      TripSchema.parse({ ...fullTrip, day_count: Limits.TripDayCountMax + 1 }),
    ).toThrow();
  });

  it('rejects day_count 0 and negatives (하한 1)', () => {
    expect(() => TripSchema.parse({ ...fullTrip, day_count: 0 })).toThrow();
    expect(() => TripSchema.parse({ ...fullTrip, day_count: -1 })).toThrow();
  });

  it('rejects a non-integer day_count', () => {
    expect(() => TripSchema.parse({ ...fullTrip, day_count: 2.5 })).toThrow();
  });

  it('rejects a missing day_count key (required-nullable — share_mode 선례)', () => {
    const { day_count, ...withoutDayCount } = fullTrip;
    void day_count;
    expect(() => TripSchema.parse(withoutDayCount)).toThrow();
  });
});

describe('Day 수 상한 단일 소스 — Limits.TripDayCountMax (0031 CHECK ↔ Zod ↔ 캘린더 max)', () => {
  /**
   * 회귀 가드 (ShareMode `.toEqual` 선례): 이 숫자는 0031 마이그레이션의
   * `day_count between 1 and 30` CHECK 리터럴과 **반드시 같아야** 한다. SQL은 상수를
   * import할 수 없으므로 이 단언 + 0031 헤더 주석이 결속 장치다. 어긋나면 정상 입력
   * (장기 여행)이 Zod를 통과하고 DB CHECK에서 거부되어 모아 생성이 통째로 실패한다.
   */
  it('is 30 — 0031 CHECK 리터럴과 동일', () => {
    expect(Limits.TripDayCountMax).toBe(30);
  });
});

describe('TripCreateDraftSchema — 온보딩 4단계 draft, dates optional (ONBOARD-03/04)', () => {
  it('accepts 미정 dates (both null) with a null companion', () => {
    const result = TripCreateDraftSchema.parse({
      title: '오사카',
      city_code: 'osaka',
      start_date: null,
      end_date: null,
      companion: null,
    });
    expect(result.start_date).toBeNull();
    expect(result.end_date).toBeNull();
  });

  it('accepts a fully dated draft', () => {
    const result = TripCreateDraftSchema.parse({
      title: '오사카',
      city_code: 'osaka',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      companion: '친구',
    });
    expect(result.end_date).toBe('2026-08-03');
  });

  it('rejects start_date null with end_date set (both set or both null)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: null,
        end_date: '2026-08-03',
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects end_date null with start_date set (both set or both null)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: '2026-08-01',
        end_date: null,
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects end_date < start_date', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: '2026-08-03',
        end_date: '2026-08-01',
        companion: null,
      }),
    ).toThrow();
  });

  it('rejects a 21-char companion (0025 CHECK: <= 20)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({
        title: '오사카',
        city_code: 'osaka',
        start_date: null,
        end_date: null,
        companion: 'ㅁ'.repeat(21),
      }),
    ).toThrow();
  });

  // --- day_count (0031, D-08) — 위저드 기간 pill이 싣는 값. 제출 마지막 방어선 ---

  const baseDraft = {
    title: '오사카',
    city_code: 'osaka',
    start_date: null,
    end_date: null,
    companion: null,
  };

  it('accepts a null day_count (기간 미정 통과 — ONBOARD-04)', () => {
    expect(TripCreateDraftSchema.parse({ ...baseDraft, day_count: null }).day_count).toBeNull();
  });

  it('accepts a 기간 pill day_count (2박 3일 = 3)', () => {
    expect(TripCreateDraftSchema.parse({ ...baseDraft, day_count: 3 }).day_count).toBe(3);
  });

  it('rejects day_count above Limits.TripDayCountMax (캘린더가 상한 밖 범위를 흘려도 제출 전에 막힌다)', () => {
    expect(() =>
      TripCreateDraftSchema.parse({ ...baseDraft, day_count: Limits.TripDayCountMax + 1 }),
    ).toThrow();
  });
});

describe('TripUpdateSchema — day_count 부분 갱신 (D-13 기간 게이트, 0031)', () => {
  it('accepts a day_count-only patch', () => {
    expect(TripUpdateSchema.parse({ day_count: 4 }).day_count).toBe(4);
  });

  it('accepts a null day_count patch (기간 미정으로 되돌리기)', () => {
    expect(TripUpdateSchema.parse({ day_count: null }).day_count).toBeNull();
  });

  it('rejects a day_count patch above Limits.TripDayCountMax', () => {
    expect(() => TripUpdateSchema.parse({ day_count: Limits.TripDayCountMax + 1 })).toThrow();
  });
});
