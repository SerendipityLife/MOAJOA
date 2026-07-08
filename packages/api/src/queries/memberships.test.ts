import { describe, it, expect, vi } from 'vitest';
import { joinMoa, listTripMembers } from './memberships';
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

/**
 * Chainable mock for query-builder based reads (mirrors trips.test.ts makeChain).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChainClient(result: { data: unknown; error: unknown }) {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'in', 'not', 'order', 'update', 'insert', 'delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  const from = vi.fn(() => chain);
  const client = { from } as unknown as MoajoaSupabaseClient;
  return { client, from, chain };
}

describe('listTripMembers — accepted members, join order (D-20 pin data source)', () => {
  it('selects user_id/created_at, filters trip + accepted, orders created_at asc', async () => {
    const rows = [{ user_id: 'u1', created_at: '2026-08-01T00:00:00Z' }];
    const { client, from, chain } = makeChainClient({ data: rows, error: null });
    const out = await listTripMembers(client, TRIP);
    expect(from).toHaveBeenCalledWith('memberships');
    expect(chain.select).toHaveBeenCalledWith('user_id, created_at');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.not).toHaveBeenCalledWith('accepted_at', 'is', null);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(out).toEqual(rows);
  });

  it('coalesces null data to [] and throws on { error }', async () => {
    const nullData = makeChainClient({ data: null, error: null });
    await expect(listTripMembers(nullData.client, TRIP)).resolves.toEqual([]);
    const errored = makeChainClient({ data: null, error: { message: 'boom' } });
    await expect(listTripMembers(errored.client, TRIP)).rejects.toBeTruthy();
  });
});
