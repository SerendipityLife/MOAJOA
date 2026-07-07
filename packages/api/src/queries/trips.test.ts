import { describe, it, expect, vi } from 'vitest';
import { shareMoa } from './trips';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror ledger.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const SLUG = 'abc123';

/**
 * Minimal chainable mock of MoajoaSupabaseClient (copied from ledger.test.ts).
 * Every query-builder method returns the same `chain` object and the chain is
 * *thenable* — it resolves to `result`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'in', 'not', 'order', 'update', 'insert', 'delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return chain;
}

function makeClient(result: { data: unknown; error: unknown }) {
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const client = { from } as unknown as MoajoaSupabaseClient;
  return { client, from, chain };
}

describe("shareMoa — single UPDATE sets visibility 'shared' + share_mode, returns slug", () => {
  it("updates trips with { visibility: 'shared', share_mode } scoped by id, selecting share_slug", async () => {
    const { client, from, chain } = makeClient({ data: { share_slug: SLUG }, error: null });
    await shareMoa(client, TRIP, 'both');
    expect(from).toHaveBeenCalledWith('trips');
    expect(chain.update).toHaveBeenCalledWith({ visibility: 'shared', share_mode: 'both' });
    expect(chain.eq).toHaveBeenCalledWith('id', TRIP);
    expect(chain.select).toHaveBeenCalledWith('share_slug');
    expect(chain.single).toHaveBeenCalled();
  });

  it('returns the share_slug string from the updated row', async () => {
    const { client } = makeClient({ data: { share_slug: SLUG }, error: null });
    await expect(shareMoa(client, TRIP, 'dates')).resolves.toBe(SLUG);
  });

  it("throws 'share_slug not generated' when the row comes back with a null slug", async () => {
    const { client } = makeClient({ data: { share_slug: null }, error: null });
    await expect(shareMoa(client, TRIP, 'places')).rejects.toThrow('share_slug not generated');
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    await expect(shareMoa(client, TRIP, 'both')).rejects.toBeTruthy();
  });
});
