import { assertEquals } from 'jsr:@std/assert';
import { resolveFx, toDateOnly } from './fx.ts';

// Stub globalThis.fetch (routes.test.ts idiom) to control the Frankfurter response.
function withFetch(
  responder: (url: string) => Response | Promise<Response>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const original = globalThis.fetch;
    globalThis.fetch = ((input: string | URL | Request) =>
      Promise.resolve(responder(String(input)))) as typeof fetch;
    try {
      await fn();
    } finally {
      globalThis.fetch = original;
    }
  };
}

// ---- 1. Mail-stated values win → fx_source='email' ---------------------------

Deno.test(
  'resolveFx — mail KRW/rate takes precedence (fx_source=email, no fetch)',
  withFetch(
    () => {
      throw new Error('fetch must NOT be called when mail states the rate');
    },
    async () => {
      const out = await resolveFx('JPY', '2026-07-01', 3400, 32000, 9.41);
      assertEquals(out.fx_source, 'email');
      assertEquals(out.fx_rate, 9.41);
      assertEquals(out.amount_krw, 32000);
      assertEquals(out.fx_as_of, '2026-07-01');
    },
  ),
);

Deno.test(
  'resolveFx — mail KRW only back-computes the rate from amountForeign',
  withFetch(
    () => new Response('{}', { status: 200 }),
    async () => {
      const out = await resolveFx('JPY', '2026-07-01', 100, 941, null);
      assertEquals(out.fx_source, 'email');
      assertEquals(out.fx_rate, 9.41);
      assertEquals(out.amount_krw, 941);
    },
  ),
);

// ---- 2. Frankfurter fallback → fx_source='frankfurter', fx_as_of=response date

Deno.test(
  'resolveFx — Frankfurter fallback uses the RESPONSE date as fx_as_of',
  withFetch(
    // weekend paid_at → Frankfurter returns the prior business day (different date).
    () => new Response(JSON.stringify({ date: '2026-07-03', rates: { KRW: 9.12 } }), { status: 200 }),
    async () => {
      const out = await resolveFx('JPY', '2026-07-04', 1000, null, null);
      assertEquals(out.fx_source, 'frankfurter');
      assertEquals(out.fx_rate, 9.12);
      assertEquals(out.fx_as_of, '2026-07-03'); // response date, not the requested 07-04
      assertEquals(out.amount_krw, 9120);
    },
  ),
);

// ---- 3. API failure → fx_source='unavailable' (null-on-failure) --------------

Deno.test(
  'resolveFx — non-ok response → unavailable, null rate',
  withFetch(
    () => new Response('nope', { status: 500 }),
    async () => {
      const out = await resolveFx('JPY', '2026-07-01', 1000, null, null);
      assertEquals(out.fx_source, 'unavailable');
      assertEquals(out.fx_rate, null);
      assertEquals(out.amount_krw, null);
    },
  ),
);

Deno.test(
  'resolveFx — fetch throw → unavailable',
  withFetch(
    () => {
      throw new Error('network down');
    },
    async () => {
      const out = await resolveFx('JPY', '2026-07-01', 1000, null, null);
      assertEquals(out.fx_source, 'unavailable');
    },
  ),
);

// ---- KRW currency short-circuit → rate 1, no fetch ---------------------------

Deno.test(
  'resolveFx — KRW currency short-circuits to rate 1',
  withFetch(
    () => {
      throw new Error('fetch must NOT be called for KRW');
    },
    async () => {
      const out = await resolveFx('KRW', '2026-07-01', 32000, null, null);
      assertEquals(out.fx_rate, 1);
      assertEquals(out.amount_krw, 32000);
    },
  ),
);

// ---- toDateOnly ---------------------------------------------------------------

Deno.test('toDateOnly — trims a datetime to YYYY-MM-DD', () => {
  assertEquals(toDateOnly('2026-07-01T09:12:00+09:00'), '2026-07-01');
  assertEquals(toDateOnly('2026-07-01'), '2026-07-01');
  assertEquals(toDateOnly(null), null);
});
