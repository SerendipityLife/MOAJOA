import { describe, it, expect, vi } from 'vitest';
import { listTripMessages, sendTripMessage } from './chat';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror date-polls.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const PLACE = '22222222-2222-4222-8222-222222222222';
const MSG = '33333333-3333-4333-8333-333333333333';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'order', 'update', 'insert', 'delete'];
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

describe('listTripMessages — direct-table read (votes/places idiom, NOT rpc)', () => {
  it('reads trip_messages by trip_id ordered created_at ascending (oldest→newest)', async () => {
    const rows = [{ id: MSG, trip_id: TRIP, body: '안녕' }];
    const { client, from, chain } = makeClient({ data: rows, error: null });
    const out = await listTripMessages(client, TRIP);
    expect(from).toHaveBeenCalledWith('trip_messages');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(out).toEqual(rows);
  });

  it('returns [] when the read yields null data', async () => {
    const { client } = makeClient({ data: null, error: null });
    expect(await listTripMessages(client, TRIP)).toEqual([]);
  });

  it('throws when the read returns { error }', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    await expect(listTripMessages(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('sendTripMessage — direct-table insert, user_id filled by 0028 trigger', () => {
  it('inserts trip_id/nickname/body/reply_to_place_id with NO user_id key (trigger pins auth.uid())', async () => {
    const row = { id: MSG, trip_id: TRIP, nickname: '나', body: '좋아요', reply_to_place_id: null };
    const { client, from, chain } = makeClient({ data: row, error: null });
    const out = await sendTripMessage(client, { trip_id: TRIP, nickname: '나', body: '좋아요' });
    expect(from).toHaveBeenCalledWith('trip_messages');
    expect(chain.insert).toHaveBeenCalledWith({
      trip_id: TRIP,
      nickname: '나',
      body: '좋아요',
      reply_to_place_id: null,
    });
    // The insert object MUST NOT carry user_id — RLS with-check + trigger own it.
    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg).not.toHaveProperty('user_id');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
    expect(out).toEqual(row);
  });

  it('maps a provided reply_to_place_id through (mention reply)', async () => {
    const { client, chain } = makeClient({ data: { id: MSG }, error: null });
    await sendTripMessage(client, {
      trip_id: TRIP,
      nickname: '나',
      body: '#1 여기 가자',
      reply_to_place_id: PLACE,
    });
    expect(chain.insert).toHaveBeenCalledWith({
      trip_id: TRIP,
      nickname: '나',
      body: '#1 여기 가자',
      reply_to_place_id: PLACE,
    });
  });

  it('throws when the insert returns { error }', async () => {
    const { client } = makeClient({ data: null, error: { message: 'denied' } });
    await expect(
      sendTripMessage(client, { trip_id: TRIP, nickname: '나', body: 'x' }),
    ).rejects.toBeTruthy();
  });
});
