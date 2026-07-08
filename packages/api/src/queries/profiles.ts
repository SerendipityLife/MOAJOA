import type { MoajoaSupabaseClient } from '../client';

/**
 * Phase 24 MOA-06 — "{닉네임}님이 담음". places.added_by → display_name.
 * profiles RLS는 read-all-authenticated (0016) — 로그인 화면 전용 소비.
 */
export async function getProfileNames(
  client: MoajoaSupabaseClient,
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]),
  );
}
