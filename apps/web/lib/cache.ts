import { unstable_cache } from 'next/cache';
import type { PublicBoardView } from '@moajoa/core';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';

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
 * Note on cookies/headers: `getSupabaseServer()` reads cookies, but the
 * `public_board_view` RPC is SECURITY DEFINER and bypasses RLS, so the cookie
 * state does not affect the result. If Next.js build complains about dynamic
 * APIs inside cache scope, refactor to create the client outside and pass
 * `slug` only (see RESEARCH Pattern 1 variant).
 */
export async function getCachedPublicBoard(slug: string): Promise<PublicBoardView | null> {
  const fetcher = unstable_cache(
    async () => {
      const supabase = await getSupabaseServer();
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
