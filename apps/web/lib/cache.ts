import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import type { PublicBoardView } from '@moajoa/core';
import { getPublicBoardBySlug, type Database } from '@moajoa/api';

/**
 * Revalidate tag for a public board page + OG image (per Phase 4 CONTEXT D-03/D-04).
 *
 * Both `/b/[slug]/page.tsx` and `/b/[slug]/opengraph-image.tsx` should use the
 * SAME tag, so a single `revalidateTag(BOARD_REVALIDATE_TAG(slug))` invalidates
 * both surfaces in one call from the webhook handler.
 */
export const BOARD_REVALIDATE_TAG = (slug: string): string => `board:${slug}`;

/**
 * Cached public board fetcher.
 *
 * - `keyParts` includes ['public-board', slug] so each slug has its own cache
 *   entry (Next.js docs Pitfall 1: closure variables must be in keyParts).
 * - `tags` = `board:{slug}` enables targeted invalidation by /api/revalidate.
 * - `revalidate: 3600` = 1h fallback TTL per D-03 (stale-while-revalidate fallback
 *   when the explicit webhook fails per D-05).
 *
 * Cache-scope contract (RESEARCH Pattern 1 variant — see commit history for
 * the original cookies-based variant): we build a cookies-free anon client
 * INSIDE the cache callback. The `public_board_view` RPC is SECURITY DEFINER
 * and bypasses RLS, so the request user is irrelevant. The prior implementation
 * called `getSupabaseServer()` which awaits `cookies()` (a dynamic API);
 * Next.js 15 forbids dynamic APIs inside `unstable_cache` scope and throws
 * `Route /b/[slug] used cookies inside unstable_cache` → HTTP 500 on every
 * public board view. Dogfooding P0 hotfix on 2026-05-28.
 */
export async function getCachedPublicBoard(slug: string): Promise<PublicBoardView | null> {
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
      return getPublicBoardBySlug(supabase, slug);
    },
    ['public-board', slug],
    {
      tags: [BOARD_REVALIDATE_TAG(slug)],
      revalidate: 3600,
    },
  );
  return fetcher();
}
