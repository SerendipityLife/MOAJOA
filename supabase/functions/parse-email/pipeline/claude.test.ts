import { assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert';
import {
  buildLedgerPrompt,
  LedgerParseOutput,
  parseLedgerOutput,
  validateTripId,
  type LedgerMail,
  type LedgerTrip,
} from './claude.ts';

const ID = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
const T1 = ID(1);
const T2 = ID(2);

const MAIL: LedgerMail = {
  subject: '예약 확정 — 도쿄 타워',
  text: '결제 금액: JPY 3,400\n카드: 1234',
  date: '2026-07-01',
};

const TRIPS: LedgerTrip[] = [
  { id: T1, title: '도쿄 여행', city_code: 'tokyo', start_date: '2026-07-01', end_date: '2026-07-05' },
  { id: T2, title: '오사카 여행', city_code: 'osaka', start_date: '2026-08-01', end_date: '2026-08-03' },
];

// ---- buildLedgerPrompt --------------------------------------------------------

Deno.test('buildLedgerPrompt — injects mail subject + body', () => {
  const out = buildLedgerPrompt(MAIL, TRIPS);
  assertStringIncludes(out, '도쿄 타워');
  assertStringIncludes(out, 'JPY 3,400');
});

Deno.test('buildLedgerPrompt — lists the user trips (id + title)', () => {
  const out = buildLedgerPrompt(MAIL, TRIPS);
  assertStringIncludes(out, T1);
  assertStringIncludes(out, '오사카 여행');
});

Deno.test('buildLedgerPrompt — states the output schema fields', () => {
  const out = buildLedgerPrompt(MAIL, TRIPS);
  assertStringIncludes(out, '"amount_foreign"');
  assertStringIncludes(out, '"matched_trip_id"');
  assertStringIncludes(out, '"confidence"');
});

Deno.test('buildLedgerPrompt — empty trip list renders a placeholder', () => {
  const out = buildLedgerPrompt(MAIL, []);
  assertStringIncludes(out, '여행 없음');
});

// ---- parseLedgerOutput --------------------------------------------------------

const VALID = {
  platform: 'Klook',
  card_last4: '1234',
  merchant: '도쿄 타워 입장권',
  amount_foreign: 3400,
  currency: 'JPY',
  paid_at: '2026-07-01',
  krw_amount: null,
  fx_rate: null,
  matched_trip_id: T1,
  confidence: 'high',
};

Deno.test('parseLedgerOutput — parses a raw JSON object', () => {
  const out = parseLedgerOutput(JSON.stringify(VALID));
  assertEquals(out.currency, 'JPY');
  assertEquals(out.amount_foreign, 3400);
  assertEquals(out.confidence, 'high');
});

Deno.test('parseLedgerOutput — strips a ```json fence', () => {
  const fenced = '```json\n' + JSON.stringify(VALID) + '\n```';
  const out = parseLedgerOutput(fenced);
  assertEquals(out.matched_trip_id, T1);
});

Deno.test('parseLedgerOutput — nulls out omitted fields', () => {
  const out = parseLedgerOutput(
    JSON.stringify({ ...VALID, krw_amount: 32000, fx_rate: 9.41 }),
  );
  assertEquals(out.krw_amount, 32000);
  assertEquals(out.fx_rate, 9.41);
});

Deno.test('LedgerParseOutput — rejects a bad card_last4', () => {
  assertThrows(() => LedgerParseOutput.parse({ ...VALID, card_last4: '12' }));
});

// ---- validateTripId (T-21-11 hallucination defense) --------------------------

Deno.test('validateTripId — keeps a matched id in the owner trip set', () => {
  assertEquals(validateTripId([T1, T2], T1), T1);
});

Deno.test('validateTripId — nulls a hallucinated id NOT in the set', () => {
  const HALLUCINATED = ID(9);
  assertEquals(validateTripId([T1, T2], HALLUCINATED), null);
});

Deno.test('validateTripId — passes null through', () => {
  assertEquals(validateTripId([T1, T2], null), null);
});
