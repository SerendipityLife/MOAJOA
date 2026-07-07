import { describe, it, expect, vi } from 'vitest';
import { joinMoa } from './memberships';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror ledger.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const SLUG = 'slug123';

/**
 * Minimal rpc-only mock of MoajoaSupabaseClient (ledger.test.ts makeClient idiom,
 * rpc variant): joinMoa only calls client.rpc — no query-builder chain needed.
 */
function makeRpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(result));
  const client = { rpc } as unknown as MoajoaSupabaseClient;
  return { client, rpc };
}

describe('joinMoa — self-join via the 0025 join_moa RPC (server decides role)', () => {
  it("calls rpc('join_moa', { p_share_slug }) with the given slug", async () => {
    const { client, rpc } = makeRpcClient({ data: TRIP, error: null });
    await joinMoa(client, SLUG);
    expect(rpc).toHaveBeenCalledWith('join_moa', { p_share_slug: SLUG });
  });

  it('returns the trip id string the RPC resolves with', async () => {
    const { client } = makeRpcClient({ data: TRIP, error: null });
    await expect(joinMoa(client, SLUG)).resolves.toBe(TRIP);
  });

  it('throws when the RPC returns { error }', async () => {
    const { client } = makeRpcClient({ data: null, error: { message: 'boom' } });
    await expect(joinMoa(client, SLUG)).rejects.toBeTruthy();
  });
});
