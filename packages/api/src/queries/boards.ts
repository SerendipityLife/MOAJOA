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

export async function getBoard(client: MoajoaSupabaseClient, id: string): Promise<Board | null> {
  const { data, error } = await client.from('boards').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Board | null) ?? null;
}

export async function createBoard(client: MoajoaSupabaseClient, input: BoardCreate): Promise<Board> {
  const { data, error } = await client
    .from('boards')
    .insert({
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility,
      city_code: input.city_code ?? null,
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
