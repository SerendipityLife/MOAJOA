import type { MoajoaSupabaseClient } from '../client';

/**
 * Mail-forwarding address query (LEDGER-01/05). Each user gets exactly one opaque
 * token (0022 `unique (user_id)`); mail sent to `<token>@<domain>` routes into
 * their ledger. Re-issue is an UPDATE, never a new row — so this is get-or-create,
 * not create-always.
 *
 * The 0022 `ensure_forwarding_token` BEFORE INSERT trigger mints the token, so the
 * client inserts only `user_id`. That user_id MUST equal auth.uid() to satisfy the
 * insert WITH CHECK — we read it from `auth.getUser()` (RLS still enforces the
 * match; a spoofed id would surface as a thrown 42501, never a silent success).
 */
export async function getOrCreateForwardingAddress(
  client: MoajoaSupabaseClient,
): Promise<{ token: string }> {
  const { data: existing, error: readError } = await client
    .from('forwarding_addresses')
    .select('token')
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return { token: (existing as { token: string }).token };

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('getOrCreateForwardingAddress: no authenticated user');

  const { data: created, error: insertError } = await client
    .from('forwarding_addresses')
    .insert({ user_id: user.id })
    .select('token')
    .single();
  if (insertError) throw insertError;
  return { token: (created as { token: string }).token };
}
