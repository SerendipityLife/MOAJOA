import { assertEquals } from 'jsr:@std/assert';
import { computeRoutesLeg } from './routes.ts';

// Stub globalThis.fetch (maplinks.test.ts idiom) and capture the request so we
// can assert the cost-guard FieldMask + per-mode routing preferences.
interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function withFetch(
  responder: (req: Captured) => Response,
  fn: (captured: Captured[]) => Promise<void>,
): () => Promise<void> {
  return async () => {
    const captured: Captured[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      const h = new Headers(init?.headers);
      h.forEach((v, k) => (headers[k] = v));
      const cap: Captured = {
        url: String(input),
        headers,
        body: init?.body ? JSON.parse(String(init.body)) : {},
      };
      captured.push(cap);
      return Promise.resolve(responder(cap));
    }) as typeof fetch;
    try {
      await fn(captured);
    } finally {
      globalThis.fetch = original;
    }
  };
}

const SHIBUYA = { lat: 35.6595, lng: 139.7005 };
const SHINJUKU = { lat: 35.6896, lng: 139.7006 };

Deno.test(
  'computeRoutesLeg — sends FieldMask EXACTLY routes.duration (cost guard, Pitfall 1)',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async (captured) => {
      await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'key');
      assertEquals(captured.length, 1);
      assertEquals(captured[0].headers['x-goog-fieldmask'], 'routes.duration');
    },
  ),
);

Deno.test(
  'computeRoutesLeg — hits the v2 computeRoutes endpoint with the api key header',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async (captured) => {
      await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'mykey');
      assertEquals(captured[0].url, 'https://routes.googleapis.com/directions/v2:computeRoutes');
      assertEquals(captured[0].headers['x-goog-api-key'], 'mykey');
    },
  ),
);

Deno.test(
  'computeRoutesLeg — DRIVE includes routingPreference TRAFFIC_UNAWARE (stay Essentials)',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '600s' }] }), { status: 200 }),
    async (captured) => {
      await computeRoutesLeg(SHIBUYA, SHINJUKU, 'DRIVE', 'key');
      assertEquals(captured[0].body.travelMode, 'DRIVE');
      assertEquals(captured[0].body.routingPreference, 'TRAFFIC_UNAWARE');
    },
  ),
);

Deno.test(
  'computeRoutesLeg — TRANSIT includes transitPreferences.routingPreference LESS_WALKING',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async (captured) => {
      await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'key');
      assertEquals(captured[0].body.travelMode, 'TRANSIT');
      assertEquals(
        (captured[0].body.transitPreferences as Record<string, unknown>)?.routingPreference,
        'LESS_WALKING',
      );
    },
  ),
);

Deno.test(
  'computeRoutesLeg — parses "840s" duration string into 840 integer seconds',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async () => {
      const secs = await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'key');
      assertEquals(secs, 840);
    },
  ),
);

Deno.test(
  'computeRoutesLeg — non-ok response returns null (best-effort → 이동시간 —)',
  withFetch(
    () => new Response('PERMISSION_DENIED', { status: 403 }),
    async () => {
      const secs = await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'key');
      assertEquals(secs, null);
    },
  ),
);

Deno.test(
  'computeRoutesLeg — empty routes array returns null',
  withFetch(
    () => new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    async () => {
      const secs = await computeRoutesLeg(SHIBUYA, SHINJUKU, 'TRANSIT', 'key');
      assertEquals(secs, null);
    },
  ),
);

Deno.test(
  'computeRoutesLeg — (0,0) origin short-circuits to null WITHOUT calling fetch (Pitfall 4)',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async (captured) => {
      const secs = await computeRoutesLeg({ lat: 0, lng: 0 }, SHINJUKU, 'WALK', 'key');
      assertEquals(secs, null);
      assertEquals(captured.length, 0); // fetch never invoked
    },
  ),
);

Deno.test(
  'computeRoutesLeg — (0,0) destination short-circuits to null WITHOUT calling fetch',
  withFetch(
    () => new Response(JSON.stringify({ routes: [{ duration: '840s' }] }), { status: 200 }),
    async (captured) => {
      const secs = await computeRoutesLeg(SHIBUYA, { lat: 0, lng: 0 }, 'WALK', 'key');
      assertEquals(secs, null);
      assertEquals(captured.length, 0);
    },
  ),
);
