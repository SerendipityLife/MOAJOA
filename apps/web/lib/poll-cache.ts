import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { pollByCode, type Database } from '@moajoa/api';

/**
 * Static poll metadata for the cookies-free SSR shell (Phase 19 / POLL-02).
 *
 * This is the ONLY shape that may be cached. Votes / tally / presence / chat are
 * mutable, per-viewer, and MUST hydrate client-side — caching any of them poisons
 * every anon viewer because the cache is cookies-free (RESEARCH Pitfall 2 GOTCHA).
 * The `poll_view_by_code` RPC returns exactly this static shape.
 */
export interface CachedPoll {
  id: string;
  trip_id: string;
  mode: 'range' | 'grid';
  status: 'open' | 'closed';
  options: { id: string; start_date: string; end_date: string }[];
}

/**
 * Revalidate tag for a poll's cached metadata. Targeted invalidation by code so a
 * host action (e.g. confirm → status='closed') can refresh this one poll's shell.
 */
export const POLL_REVALIDATE_TAG = (code: string): string => `poll:${code}`;

/**
 * Cached static poll metadata fetcher (mirror public-trip-cache.ts).
 *
 * Cache-scope contract: a cookies-free anon client is built INSIDE the cache
 * callback. `poll_view_by_code` is SECURITY DEFINER and bypasses RLS, so the
 * request user is irrelevant — the result is identical for every anon viewer,
 * which is exactly why it is safe to cache. Awaiting `cookies()` inside
 * `unstable_cache` throws in Next.js 15, so it is avoided here (no per-viewer
 * state is read at all).
 *
 * - `keyParts` includes ['public-poll', code] so each code gets its own entry.
 * - `tags` = `poll:{code}` enables targeted invalidation.
 * - `revalidate: 3600` = 1h fallback TTL.
 */
export async function getCachedPoll(code: string): Promise<CachedPoll | null> {
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
      // pollByCode returns the DEFINER RPC's jsonb (static metadata only); narrow it.
      const poll = (await pollByCode(supabase, code)) as CachedPoll | null;
      return poll;
    },
    ['public-poll', code],
    {
      tags: [POLL_REVALIDATE_TAG(code)],
      revalidate: 3600,
    },
  );
  return fetcher();
}
