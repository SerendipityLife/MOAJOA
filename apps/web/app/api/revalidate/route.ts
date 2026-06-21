import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { TRIP_REVALIDATE_TAG } from '@/lib/public-trip-cache';
import { getRevalidateSecret } from '@/lib/env';

/**
 * Webhook endpoint called by Supabase Edge Function `extract-youtube`
 * after a `done` broadcast. Invalidates the cached public trip so
 * the next visitor gets fresh data (per CONTEXT D-04, D-20).
 *
 * Node runtime is required for `node:crypto.timingSafeEqual` — Edge
 * runtime's WebCrypto lacks this primitive (RESEARCH §Pitfall 9).
 */
export const runtime = 'nodejs';

const BodySchema = z.object({
  slug: z.string().min(8).max(32),
  secret: z.string().min(16),
});

function safeEqualStr(a: string, b: string): boolean {
  // Length check first — timingSafeEqual throws on length mismatch.
  // Secret length is a known constant (32 bytes hex = 64 chars), so
  // leaking length is acceptable per D-20.
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const secret = getRevalidateSecret();
  if (!secret) {
    return Response.json({ ok: false, error: 'misconfigured' }, { status: 500 });
  }

  if (!safeEqualStr(parsed.data.secret, secret)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag(TRIP_REVALIDATE_TAG(parsed.data.slug));

  return Response.json({ ok: true, slug: parsed.data.slug });
}

export async function GET() {
  return Response.json({ ok: false, error: 'method not allowed' }, { status: 405 });
}
