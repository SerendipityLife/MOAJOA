import { assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert';
import { buildPlanPrompt, PlanLLMOutput, validatePlanIds } from './claude.ts';

const ID = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
const P1 = ID(1);
const P2 = ID(2);
const P3 = ID(3);

const FIXTURE = {
  dayCount: 3,
  places: [
    { id: P1, name_ko: '시부야 스카이', name_local: '渋谷スカイ', lat: 35.6595, lng: 139.7005, category: 'culture', summary_ko: '전망대' },
    { id: P2, name_ko: '이치란 시부야', name_local: '一蘭 渋谷', lat: 35.6612, lng: 139.7015, category: 'food', summary_ko: '돈코츠 라멘' },
    { id: P3, name_ko: '신주쿠 교엔', name_local: '新宿御苑', lat: 35.6852, lng: 139.71, category: 'nature', summary_ko: '정원' },
  ],
  anchorIds: [P2],
  removedIds: [],
};

Deno.test('buildPlanPrompt — includes the N-day count (3박/일)', () => {
  const out = buildPlanPrompt(FIXTURE);
  assertStringIncludes(out, '3');
  assertStringIncludes(out, '"day_index"'); // output schema present
});

Deno.test('buildPlanPrompt — names the soft cap 4–5 places per day (D-04)', () => {
  const out = buildPlanPrompt(FIXTURE);
  assertStringIncludes(out, '4');
  assertStringIncludes(out, '5');
});

Deno.test('buildPlanPrompt — states the geo-cluster-first rule (D-03)', () => {
  const out = buildPlanPrompt(FIXTURE);
  // The cluster-first constraint must mention same-day grouping by location.
  assertStringIncludes(out, 'cluster');
});

Deno.test('buildPlanPrompt — anchor place ids appear in the prompt (D-10)', () => {
  const out = buildPlanPrompt(FIXTURE);
  assertStringIncludes(out, P2); // anchor id present in the place list AND anchor section
});

Deno.test('buildPlanPrompt — every input place id appears in the place list', () => {
  const out = buildPlanPrompt(FIXTURE);
  assertStringIncludes(out, P1);
  assertStringIncludes(out, P2);
  assertStringIncludes(out, P3);
});

Deno.test('buildPlanPrompt — removed ids excluded from the place list (D-11)', () => {
  const out = buildPlanPrompt({ ...FIXTURE, removedIds: [P3], places: FIXTURE.places.slice(0, 2) });
  assertEquals(out.includes(P3), false);
});

// ---- PlanLLMOutput schema -----------------------------------------------------

Deno.test('PlanLLMOutput — accepts a valid days + unplaced shape', () => {
  const parsed = PlanLLMOutput.parse({
    reasoning: 'grouped Shibuya together',
    days: [{ day_index: 0, items: [{ place_id: P1, sort_order: 0 }, { place_id: P2, sort_order: 1 }] }],
    unplaced: [P3],
  });
  assertEquals(parsed.days.length, 1);
  assertEquals(parsed.unplaced[0], P3);
});

Deno.test('PlanLLMOutput — accepts omitted reasoning', () => {
  const parsed = PlanLLMOutput.parse({ days: [], unplaced: [] });
  assertEquals(parsed.reasoning, undefined);
});

Deno.test('PlanLLMOutput — rejects a hallucinated non-uuid place_id', () => {
  assertThrows(() =>
    PlanLLMOutput.parse({
      days: [{ day_index: 0, items: [{ place_id: 'not-a-uuid', sort_order: 0 }] }],
      unplaced: [],
    })
  );
});

Deno.test('PlanLLMOutput — rejects non-array days', () => {
  assertThrows(() => PlanLLMOutput.parse({ days: 'nope', unplaced: [] }));
});

// ---- validatePlanIds (Pitfall 6 defensive validation) ------------------------

Deno.test('validatePlanIds — rejects ids not in the input set (FK safety)', () => {
  const input = [P1, P2];
  const out = {
    days: [{ day_index: 0, items: [{ place_id: P1, sort_order: 0 }, { place_id: P3, sort_order: 1 }] }],
    unplaced: [P2],
  };
  const cleaned = validatePlanIds(input, out);
  const placedIds = cleaned.days.flatMap((d) => d.items.map((i) => i.place_id));
  assertEquals(placedIds.includes(P3), false); // hallucinated id stripped
  assertEquals(placedIds.includes(P1), true);
  assertEquals(cleaned.unplaced.includes(P2), true);
});

Deno.test('validatePlanIds — auto-appends an input place missing from days∪unplaced (never drops)', () => {
  const input = [P1, P2, P3];
  const out = {
    days: [{ day_index: 0, items: [{ place_id: P1, sort_order: 0 }] }],
    unplaced: [P2],
  };
  const cleaned = validatePlanIds(input, out);
  // P3 appeared nowhere → must land in the unplaced pool, not vanish.
  assertEquals(cleaned.unplaced.includes(P3), true);
});

Deno.test('validatePlanIds — strips duplicate ids (a place placed twice keeps first)', () => {
  const input = [P1, P2];
  const out = {
    days: [
      { day_index: 0, items: [{ place_id: P1, sort_order: 0 }] },
      { day_index: 1, items: [{ place_id: P1, sort_order: 0 }, { place_id: P2, sort_order: 1 }] },
    ],
    unplaced: [],
  };
  const cleaned = validatePlanIds(input, out);
  const placedIds = cleaned.days.flatMap((d) => d.items.map((i) => i.place_id));
  const p1count = placedIds.filter((id) => id === P1).length;
  assertEquals(p1count, 1); // duplicate removed
  assertEquals(placedIds.includes(P2), true);
});

Deno.test('validatePlanIds — a place in BOTH days and unplaced stays placed only', () => {
  const input = [P1, P2];
  const out = {
    days: [{ day_index: 0, items: [{ place_id: P1, sort_order: 0 }] }],
    unplaced: [P1, P2],
  };
  const cleaned = validatePlanIds(input, out);
  assertEquals(cleaned.unplaced.includes(P1), false); // P1 is placed → removed from pool
  assertEquals(cleaned.unplaced.includes(P2), true);
});
