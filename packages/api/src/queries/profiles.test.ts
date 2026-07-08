import { describe, it, expect, vi } from 'vitest';
import { getProfileNames } from './profiles';
import type { MoajoaSupabaseClient } from '../client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChainClient(result: { data: unknown; error: unknown }) {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'in', 'not', 'order'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  const from = vi.fn(() => chain);
  const client = { from } as unknown as MoajoaSupabaseClient;
  return { client, from, chain };
}

describe('getProfileNames — added_by → display_name map (MOA-06)', () => {
  it('short-circuits on empty ids: no from() call, returns {}', async () => {
    const { client, from } = makeChainClient({ data: null, error: null });
    const out = await getProfileNames(client, []);
    expect(out).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('queries profiles by id and maps id → display_name', async () => {
    const rows = [
      { id: 'u1', display_name: '지훈' },
      { id: 'u2', display_name: '민지' },
    ];
    const { client, from, chain } = makeChainClient({ data: rows, error: null });
    const out = await getProfileNames(client, ['u1', 'u2']);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(chain.select).toHaveBeenCalledWith('id, display_name');
    expect(chain.in).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(out).toEqual({ u1: '지훈', u2: '민지' });
  });

  it('throws on { error }', async () => {
    const { client } = makeChainClient({ data: null, error: { message: 'boom' } });
    await expect(getProfileNames(client, ['u1'])).rejects.toBeTruthy();
  });
});
