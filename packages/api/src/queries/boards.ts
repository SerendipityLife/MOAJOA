import type { Board, BoardCreate, BoardUpdate, PublicBoardView } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

export async function listMyBoards(client: MoajoaSupabaseClient): Promise<Board[]> {
  const { data, error } = await client
    .from('boards')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Board[];
}

/**
 * A board plus the lightweight preview data the home list (boards.tsx) needs to
 * render cover cards: how many (non-hidden) places it has and the first few of
 * their names. Names drive board identity on the card (UI-SPEC §Screen 1) since
 * mini-map thumbnails look alike. Places embed via the "read if can read board"
 * RLS — same access as listMyBoards, one round-trip (no N+1).
 */
export type BoardPreview = Board & {
  place_count: number;
  /** Up to 3 place names (name_ko ?? name_local), non-hidden, for the chip row. */
  place_names: string[];
  /** Most common raw Google category among visible places — drives the card's
   *  color/icon "vibe". Null when no place has a category yet. */
  top_category: string | null;
};

export async function listMyBoardsWithPreview(
  client: MoajoaSupabaseClient,
): Promise<BoardPreview[]> {
  const { data, error } = await client
    .from('boards')
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
    const { places, ...board } = row as Board & { places: EmbeddedPlace[] | null };
    const visible = (places ?? []).filter((p) => !p.hidden_at);
    // Mode of the non-null categories — the board's dominant vibe.
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
      ...(board as Board),
      place_count: visible.length,
      place_names: visible.slice(0, 3).map((p) => p.name_ko ?? p.name_local),
      top_category,
    };
  });
}

export async function getBoard(client: MoajoaSupabaseClient, id: string): Promise<Board | null> {
  const { data, error } = await client.from('boards').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Board | null) ?? null;
}

export async function createBoard(
  client: MoajoaSupabaseClient,
  input: BoardCreate,
): Promise<Board> {
  const { data, error } = await client
    .from('boards')
    .insert({
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility,
      city_code: input.city_code ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Board;
}

export async function updateBoard(
  client: MoajoaSupabaseClient,
  id: string,
  patch: BoardUpdate,
): Promise<Board> {
  const { data, error } = await client
    .from('boards')
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
  return data as Board;
}

export async function deleteBoard(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('boards').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Flip a board to 'shared' (if still private) and return its `share_slug` for
 * the `/b/{slug}` link. The DB `boards_share_slug_before_update` trigger (0001)
 * generates the slug the first time visibility becomes shared/public, so no
 * extra RPC is needed — owner RLS already permits this update. Idempotent: an
 * already shared/public board keeps its visibility and returns the existing slug.
 */
export async function shareBoard(
  client: MoajoaSupabaseClient,
  boardId: string,
): Promise<string> {
  const { data: cur, error: readErr } = await client
    .from('boards')
    .select('visibility, share_slug')
    .eq('id', boardId)
    .single();
  if (readErr) throw readErr;
  const existing = (cur as { share_slug: string | null } | null)?.share_slug;
  if (existing) return existing;

  const { data, error } = await client
    .from('boards')
    .update({ visibility: 'shared' })
    .eq('id', boardId)
    .select('share_slug')
    .single();
  if (error) throw error;
  const slug = (data as { share_slug: string | null } | null)?.share_slug;
  if (!slug) throw new Error('share_slug not generated');
  return slug;
}

/**
 * Fetch the public view of a board by share slug. Used by Next.js SSR for the
 * /b/[slug] route. Calls the `public_board_view` SQL function which enforces
 * "visibility = public" and joins everything in a single round-trip.
 */
export async function getPublicBoardBySlug(
  client: MoajoaSupabaseClient,
  slug: string,
): Promise<PublicBoardView | null> {
  const { data, error } = await client.rpc('public_board_view', { p_slug: slug });
  if (error) throw error;
  return (data as PublicBoardView | null) ?? null;
}
