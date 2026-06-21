import type { Trip, TripCreate, TripUpdate, PublicBoardView } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

export async function listMyTrips(client: MoajoaSupabaseClient): Promise<Trip[]> {
  const { data, error } = await client
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trip[];
}

/**
 * A trip plus the lightweight preview data the home list (boards.tsx) needs to
 * render cover cards: how many (non-hidden) places it has and the first few of
 * their names. Names drive trip identity on the card (UI-SPEC §Screen 1) since
 * mini-map thumbnails look alike. Places embed via the "read if can read trip"
 * RLS — same access as listMyTrips, one round-trip (no N+1).
 */
export type TripPreview = Trip & {
  place_count: number;
  /** Up to 3 place names (name_ko ?? name_local), non-hidden, for the chip row. */
  place_names: string[];
  /** Most common raw Google category among visible places — drives the card's
   *  color/icon "vibe". Null when no place has a category yet. */
  top_category: string | null;
};

export async function listMyTripsWithPreview(
  client: MoajoaSupabaseClient,
): Promise<TripPreview[]> {
  const { data, error } = await client
    .from('trips')
    .select('*, places(name_ko, name_local, category, hidden_at)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  type EmbeddedPlace = {
    name_ko: string | null;
    name_local: string;
    category: string | null;
    hidden_at: string | null;
  };
  return (data ?? []).map((row) => {
    const { places, ...trip } = row as Trip & { places: EmbeddedPlace[] | null };
    const visible = (places ?? []).filter((p) => !p.hidden_at);
    // Mode of the non-null categories — the trip's dominant vibe.
    const counts = new Map<string, number>();
    for (const p of visible) {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    let top_category: string | null = null;
    let best = 0;
    for (const [cat, n] of counts) {
      if (n > best) {
        best = n;
        top_category = cat;
      }
    }
    return {
      ...(trip as Trip),
      place_count: visible.length,
      place_names: visible.slice(0, 3).map((p) => p.name_ko ?? p.name_local),
      top_category,
    };
  });
}

export async function getTrip(client: MoajoaSupabaseClient, id: string): Promise<Trip | null> {
  const { data, error } = await client.from('trips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Trip | null) ?? null;
}

export async function createTrip(
  client: MoajoaSupabaseClient,
  input: TripCreate,
): Promise<Trip> {
  // TripCreate (Plan 01) is the "일정 정해짐" create: title + city_code + required
  // start/end dates (D-09). visibility defaults to 'private' at the DB level and
  // representative_id is set by the `trips_default_representative` trigger (0016)
  // to auth.uid() — neither needs a client field (SETUP-02).
  const { data, error } = await client
    .from('trips')
    .insert({
      title: input.title,
      city_code: input.city_code,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function updateTrip(
  client: MoajoaSupabaseClient,
  id: string,
  patch: TripUpdate,
): Promise<Trip> {
  const { data, error } = await client
    .from('trips')
    .update({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.visibility !== undefined && { visibility: patch.visibility }),
      ...(patch.city_code !== undefined && { city_code: patch.city_code }),
      ...(patch.start_date !== undefined && { start_date: patch.start_date }),
      ...(patch.end_date !== undefined && { end_date: patch.end_date }),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function deleteTrip(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('trips').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Flip a trip to 'shared' (if still private) and return its `share_slug` for
 * the `/b/{slug}` link. The DB `trips_share_slug_before_update` trigger (0016)
 * generates the slug the first time visibility becomes shared/public, so no
 * extra RPC is needed — owner RLS already permits this update. Idempotent: an
 * already shared/public trip keeps its visibility and returns the existing slug.
 */
export async function shareTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<string> {
  const { data: cur, error: readErr } = await client
    .from('trips')
    .select('visibility, share_slug')
    .eq('id', tripId)
    .single();
  if (readErr) throw readErr;
  const existing = (cur as { share_slug: string | null } | null)?.share_slug;
  if (existing) return existing;

  const { data, error } = await client
    .from('trips')
    .update({ visibility: 'shared' })
    .eq('id', tripId)
    .select('share_slug')
    .single();
  if (error) throw error;
  const slug = (data as { share_slug: string | null } | null)?.share_slug;
  if (!slug) throw new Error('share_slug not generated');
  return slug;
}

/**
 * Fetch the public view of a trip by share slug. Used by Next.js SSR for the
 * /t/[slug] route. Calls the `public_trip_view` SQL function which enforces
 * "visibility in (public,shared)" and joins everything in a single round-trip.
 *
 * NOTE: the return type is still `PublicBoardView` — the core view-model rename
 * (board→trip vocab on the composite type + its `board` key) is owned by a later
 * plan to avoid cascading into apps/web's SSR consumers. `public_trip_view` emits
 * the trip object under the key `trip`, so we bridge it to `board` here to match
 * the still-board-shaped view-model the SSR consumers read.
 */
export async function getPublicTripBySlug(
  client: MoajoaSupabaseClient,
  slug: string,
): Promise<PublicBoardView | null> {
  const { data, error } = await client.rpc('public_trip_view', { p_slug: slug });
  if (error) throw error;
  if (data == null) return null;
  const { trip, ...rest } = data as Record<string, unknown>;
  return { ...rest, board: trip } as PublicBoardView;
}
