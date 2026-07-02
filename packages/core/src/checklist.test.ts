import { describe, it, expect } from 'vitest';
import {
  ChecklistKind,
  ChecklistStatus,
  ChecklistSource,
  ChecklistItemSchema,
  ManualItemTitleSchema,
  deriveChecklistAutos,
  isDesynced,
  type ChecklistItem,
} from './checklist';

const TRIP = '11111111-1111-4111-8111-111111111111';
const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '33333333-3333-4333-8333-333333333333';
const I1 = '44444444-4444-4444-8444-444444444444';
const I2 = '55555555-5555-4555-8555-555555555555';
const I3 = '66666666-6666-4666-8666-666666666666';

/** Row factory — defaults to an auto/todo stay row; override per case. */
function row(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: I1,
    trip_id: TRIP,
    place_id: null,
    kind: 'stay',
    title: '숙소 예약',
    status: 'todo',
    source: 'auto',
    ...overrides,
  };
}

const FULL_COVERED = { esimSlug: 'japan-esim', transportLabel: 'JR 패스' };
const TWO_PLACES = [
  { placeId: P1, title: '팀랩 플래닛' },
  { placeId: P2, title: '유니버설 스튜디오' },
];

describe('checklist const-enums — values locked to 0021 CHECK constraints', () => {
  it('kind 5종 / status 3종 / source 2종 (문자 단위 일치)', () => {
    expect([...ChecklistKind]).toEqual(['stay', 'esim', 'transport', 'activity', 'custom']);
    expect([...ChecklistStatus]).toEqual(['todo', 'clicked', 'done']);
    expect([...ChecklistSource]).toEqual(['auto', 'manual']);
  });
});

describe('ChecklistItemSchema — row shape + defaults', () => {
  it("applies defaults: status 'todo', source 'auto'", () => {
    const parsed = ChecklistItemSchema.parse({
      id: I1,
      trip_id: TRIP,
      place_id: null,
      kind: 'stay',
      title: '숙소 예약',
    });
    expect(parsed.status).toBe('todo');
    expect(parsed.source).toBe('auto');
  });

  it('rejects a title over 80 chars (0021 title CHECK 1..80)', () => {
    expect(() =>
      ChecklistItemSchema.parse({
        id: I1,
        trip_id: TRIP,
        place_id: null,
        kind: 'custom',
        title: 'a'.repeat(81),
      }),
    ).toThrow();
  });

  it('ManualItemTitleSchema: rejects empty, accepts 80, rejects 81 (D-10 manual input gate)', () => {
    expect(() => ManualItemTitleSchema.parse('')).toThrow();
    expect(ManualItemTitleSchema.parse('a'.repeat(80))).toBe('a'.repeat(80));
    expect(() => ManualItemTitleSchema.parse('a'.repeat(81))).toThrow();
  });
});

describe('deriveChecklistAutos — D-10 derivation', () => {
  it('empty existing + full coverage + 2 bookable places → stay/esim/transport + 2 activities', () => {
    const { toInsert, toDeleteIds } = deriveChecklistAutos({
      covered: FULL_COVERED,
      bookablePlaces: TWO_PLACES,
      existing: [],
    });
    expect(toDeleteIds).toEqual([]);
    expect(toInsert).toEqual([
      { kind: 'stay', place_id: null, title: '숙소 예약' },
      { kind: 'esim', place_id: null, title: '여행 유심' },
      { kind: 'transport', place_id: null, title: 'JR 패스' },
      { kind: 'activity', place_id: P1, title: '팀랩 플래닛' },
      { kind: 'activity', place_id: P2, title: '유니버설 스튜디오' },
    ]);
  });

  it('esimSlug null (kr city) → esim item is NOT derived', () => {
    const { toInsert } = deriveChecklistAutos({
      covered: { esimSlug: null, transportLabel: null },
      bookablePlaces: [],
      existing: [],
    });
    expect(toInsert).toEqual([{ kind: 'stay', place_id: null, title: '숙소 예약' }]);
  });

  it('existing auto singleton dedups by kind — clicked stay is untouched AND not re-inserted', () => {
    const clickedStay = row({ id: I1, kind: 'stay', status: 'clicked' });
    const { toInsert, toDeleteIds } = deriveChecklistAutos({
      covered: FULL_COVERED,
      bookablePlaces: [],
      existing: [clickedStay],
    });
    expect(toInsert.map((i) => i.kind)).toEqual(['esim', 'transport']);
    expect(toDeleteIds).toEqual([]);
  });

  it('existing auto activity dedups by place_id — only the new place is inserted', () => {
    const existing = [
      row({ id: I1, kind: 'activity', place_id: P1, title: '팀랩 플래닛' }),
      row({ id: I2, kind: 'stay' }),
      row({ id: I3, kind: 'esim', title: '여행 유심' }),
    ];
    const { toInsert, toDeleteIds } = deriveChecklistAutos({
      covered: { esimSlug: 'japan-esim', transportLabel: null },
      bookablePlaces: TWO_PLACES,
      existing,
    });
    expect(toInsert).toEqual([{ kind: 'activity', place_id: P2, title: '유니버설 스튜디오' }]);
    expect(toDeleteIds).toEqual([]);
  });

  it('auto+todo activity dropped from the plan → toDeleteIds', () => {
    const orphan = row({ id: I2, kind: 'activity', place_id: P2, title: '유니버설 스튜디오' });
    const { toDeleteIds } = deriveChecklistAutos({
      covered: FULL_COVERED,
      bookablePlaces: [{ placeId: P1, title: '팀랩 플래닛' }],
      existing: [orphan],
    });
    expect(toDeleteIds).toEqual([I2]);
  });

  it("clicked/done rows dropped from the plan are NEVER deleted (돈 쓴 기록 — D-13)", () => {
    const clicked = row({ id: I1, kind: 'activity', place_id: P1, status: 'clicked' });
    const done = row({ id: I2, kind: 'activity', place_id: P2, status: 'done' });
    const { toDeleteIds } = deriveChecklistAutos({
      covered: FULL_COVERED,
      bookablePlaces: [],
      existing: [clicked, done],
    });
    expect(toDeleteIds).toEqual([]);
  });

  it('auto+todo singleton no longer covered (esim on kr switch) → deleted', () => {
    const esim = row({ id: I3, kind: 'esim', title: '여행 유심' });
    const { toDeleteIds } = deriveChecklistAutos({
      covered: { esimSlug: null, transportLabel: null },
      bookablePlaces: [],
      existing: [esim],
    });
    expect(toDeleteIds).toEqual([I3]);
  });

  it('manual rows are NEVER emitted — not deleted, and not counted as dedup blockers (D-10)', () => {
    const manualActivityOffPlan = row({
      id: I1,
      kind: 'activity',
      place_id: P2,
      source: 'manual',
      title: '내가 추가한 곳',
    });
    // manual row with a singleton kind: the auto singleton is STILL derived
    // (0021 partial unique only guards source='auto' rows).
    const manualStay = row({ id: I2, kind: 'stay', source: 'manual', title: '료칸 따로 예약' });
    const { toInsert, toDeleteIds } = deriveChecklistAutos({
      covered: { esimSlug: null, transportLabel: null },
      bookablePlaces: [],
      existing: [manualActivityOffPlan, manualStay],
    });
    expect(toDeleteIds).toEqual([]);
    expect(toInsert).toEqual([{ kind: 'stay', place_id: null, title: '숙소 예약' }]);
  });

  it('custom-kind rows are never touched', () => {
    const custom = row({ id: I1, kind: 'custom', title: '환전', source: 'manual' });
    const { toInsert, toDeleteIds } = deriveChecklistAutos({
      covered: { esimSlug: null, transportLabel: null },
      bookablePlaces: [],
      existing: [custom],
    });
    expect(toDeleteIds).toEqual([]);
    expect(toInsert.some((i) => i.kind === 'custom')).toBe(false);
  });
});

describe("isDesynced — '플랜에 없음' badge is render-time, not a derivation output (D-13)", () => {
  const current = new Set([P1]);

  it('activity with place_id outside the current bookable set → true', () => {
    expect(isDesynced(row({ kind: 'activity', place_id: P2 }), current)).toBe(true);
  });

  it('activity with place_id inside the set → false', () => {
    expect(isDesynced(row({ kind: 'activity', place_id: P1 }), current)).toBe(false);
  });

  it('activity without place_id → false; non-activity kinds → false', () => {
    expect(isDesynced(row({ kind: 'activity', place_id: null }), current)).toBe(false);
    expect(isDesynced(row({ kind: 'stay' }), current)).toBe(false);
  });
});
