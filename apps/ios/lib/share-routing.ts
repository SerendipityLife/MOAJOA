// apps/ios/lib/share-routing.ts
// Pure routing decision for an inbound shared link (Phase 16, D-01/D-02;
// repointed to trip vocab in 17-04). Inbound shares carry NO trip_id (share
// starts outside MOAJOA), so MOAJOA decides the target trip from the user's trip
// count. Kept side-effect-free so it unit-tests without auth/Supabase/native
// (mirrors lib/pending.ts purity).
import { z } from 'zod';

// V5 (CLAUDE.md §4.5): the inbound shared webUrl is untrusted external input.
// Validate it is a real http(s) URL before enqueue/add; drop anything else.
const HttpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((u) => {
    try {
      return /^https?:$/.test(new URL(u).protocol);
    } catch {
      return false;
    }
  });

/**
 * Extract a trusted http(s) URL from the raw shared webUrl (Phase 16, V5).
 * Returns the trimmed URL when valid, or null for non-URL / non-http(s) /
 * empty input — the caller must never enqueue or add a null.
 */
export function extractSharedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = HttpUrlSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type ShareRoute =
  | { kind: 'linger' }                // D-02: !authed OR 0 trips → enqueue(url, null), item lingers
  | { kind: 'auto'; tripId: string }  // D-01/D-03: exactly 1 trip → auto-add + navigate
  | { kind: 'picker' };               // D-01/D-04: 2+ trips → in-app bottom-sheet picker

export function decideShareRoute(
  authed: boolean,
  tripCount: number,
  firstTripId: string | null,
): ShareRoute {
  if (!authed || tripCount === 0) return { kind: 'linger' };
  if (tripCount === 1 && firstTripId) return { kind: 'auto', tripId: firstTripId };
  return { kind: 'picker' };
}
