import { detectSourceKind, type Link, type LinkAdd } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

export async function listLinksByBoard(
  client: MoajoaSupabaseClient,
  boardId: string,
): Promise<Link[]> {
  const { data, error } = await client
    .from('links')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Link[];
}

/**
 * Add a link to a board. Server normalizes URL and detects source_kind via a
 * trigger; for YouTube, the extraction Edge Function is invoked async.
 *
 * Why client also calls detectSourceKind: snappy UI feedback ("YouTube 분석
 * 시작됨" vs "인스타 — 큐레이션 대기").
 */
export async function addLink(client: MoajoaSupabaseClient, input: LinkAdd): Promise<Link> {
  const detected = detectSourceKind(input.url) ?? 'manual';

  const { data, error } = await client
    .from('links')
    .insert({
      board_id: input.board_id,
      url: input.url,
      original_url: input.url,
      source_kind: detected,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Link;
}

export async function deleteLink(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('links').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Trigger extraction for a link (idempotent — Edge Function checks current status).
 * Called automatically after addLink for youtube; can be called manually to retry.
 */
export async function triggerExtraction(
  client: MoajoaSupabaseClient,
  linkId: string,
): Promise<{ status: string }> {
  const { data, error } = await client.functions.invoke('extract-youtube', {
    body: { link_id: linkId },
  });
  if (error) throw error;
  return data as { status: string };
}
