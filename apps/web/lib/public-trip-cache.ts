import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import type { PublicBoardView } from '@moajoa/core';
import { getPublicTripBySlug, type Database } from '@moajoa/api';

/**
 * Revalidate tag for a public trip page + OG image (per Phase 4 CONTEXT D-03/D-04).
 *
 * Both `/t/[slug]/page.tsx` and `/t/[slug]/opengraph-image.tsx` use the SAME tag,
 * so a single `revalidateTag(TRIP_REVALIDATE_TAG(slug))` invalidates both surfaces
 * in one call from the webhook handler.
 */
export const TRIP_REVALIDATE_TAG = (slug: string): string => `trip:${slug}`;

/**
 * Cached public trip fetcher (Phase 17 D-14 — renamed from the public-board
 * fetcher when the share route moved /b/[slug] → /t/[slug]).
 *
 * - `keyParts` includes ['public-trip', slug] so each slug has its own cache
 *   entry (Next.js docs Pitfall 1: closure variables must be in keyParts).
 * - `tags` = `trip:{slug}` enables targeted invalidation by /api/revalidate.
 * - `revalidate: 3600` = 1h fallback TTL per D-03 (stale-while-revalidate fallback
 *   when the explicit webhook fails per D-05).
 *
 * Cache-scope contract (RESEARCH Pattern 1 variant): we build a cookies-free anon
 * client INSIDE the cache callback. The `public_trip_view` RPC is SECURITY DEFINER
 * and bypasses RLS, so the request user is irrelevant. Awaiting `cookies()` (a
 * dynamic API) inside `unstable_cache` scope throws in Next.js 15, so it is avoided
 * here. The returned shape is structurally identical to the prior public-board view.
 */
export async function getCachedPublicTrip(slug: string): Promise<PublicBoardView | null> {
  const fetcher = unstable_cache(
    async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        throw new Error(
          'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured',
        );
      }
      const supabase = createClient<Database>(url, anonKey);
      return getPublicTripBySlug(supabase, slug);
    },
    ['public-trip', slug],
    {
      tags: [TRIP_REVALIDATE_TAG(slug)],
      revalidate: 3600,
    },
  );
  return fetcher();
}
