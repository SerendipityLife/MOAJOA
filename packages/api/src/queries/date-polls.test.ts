import { describe, it, expect, vi } from 'vitest';
import {
  castDateVote,
  castDateVoteAuthed,
  createDatePoll,
  getPublicTripPoll,
  pollByCode,
  getPollTally,
  confirmPollDate,
  createDatelessTrip,
  getPollByTrip,
  setPollMode,
  getPollOptions,
  addPollOption,
  removePollOption,
} from './date-polls';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror plans.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const POLL = '22222222-2222-4222-8222-222222222222';
const OPTION = '33333333-3333-4333-8333-333333333333';
const CODE = 'abcd1234';

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

function makeClient(opts?: {
  result?: { data: unknown; error: unknown };
  rpcResult?: { data: unknown; error: unknown };
}) {
  const result = opts?.result ?? { data: {}, error: null };
  const rpcResult = opts?.rpcResult ?? { data: {}, error: null };
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const rpc = vi.fn(() => Promise.resolve(rpcResult));
  const client = { from, rpc } as unknown as MoajoaSupabaseClient;
  return { client, from, chain, rpc };
}

describe('castDateVote — rpc(cast_date_vote), DEFINER write (T-19-01: never a direct insert)', () => {
  it('calls rpc with the exact RPC name + arg object (null coalesce for missing option/date)', async () => {
    const { client, rpc, from } = makeClient({ rpcResult: { data: undefined, error: null } });
    await castDateVote(client, {
      code: CODE,
      deviceToken: 'd1',
      nickname: '나',
      optionId: OPTION,
      availability: 'available',
    });
    expect(rpc).toHaveBeenCalledWith('cast_date_vote', {
      p_code: CODE,
      p_device_token: 'd1',
      p_nickname: '나',
      p_option_id: OPTION,
      p_vote_date: null,
      p_availability: 'available',
    });
    // Regression: no direct table write.
    expect(from).not.toHaveBeenCalled();
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'closed' } } });
    await expect(
      castDateVote(client, {
        code: CODE,
        deviceToken: 'd1',
        nickname: '나',
        availability: 'available',
      }),
    ).rejects.toBeTruthy();
  });
});

describe('getPublicTripPoll — rpc(public_trip_poll), anon slug→poll read (SHARE-02)', () => {
  it('calls rpc with p_slug and returns data', async () => {
    const poll = { poll_code: CODE, mode: 'range', status: 'open', options: [] };
    const { client, rpc } = makeClient({ rpcResult: { data: poll, error: null } });
    const out = await getPublicTripPoll(client, 'my-slug');
    expect(rpc).toHaveBeenCalledWith('public_trip_poll', { p_slug: 'my-slug' });
    expect(out).toEqual(poll);
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
    await expect(getPublicTripPoll(client, 'my-slug')).rejects.toBeTruthy();
  });
});

describe('castDateVoteAuthed — rpc(cast_date_vote_authed), server-derived device_token (T-25-02)', () => {
  it('calls rpc WITHOUT p_device_token (auth.uid derived server-side)', async () => {
    const { client, rpc, from } = makeClient({ rpcResult: { data: undefined, error: null } });
    await castDateVoteAuthed(client, {
      code: CODE,
      nickname: '나',
      optionId: OPTION,
      availability: 'available',
    });
    expect(rpc).toHaveBeenCalledWith('cast_date_vote_authed', {
      p_code: CODE,
      p_nickname: '나',
      p_option_id: OPTION,
      p_vote_date: null,
      p_availability: 'available',
    });
    // Regression: no direct table write, and no client-supplied device_token.
    expect(from).not.toHaveBeenCalled();
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'closed' } } });
    await expect(
      castDateVoteAuthed(client, { code: CODE, nickname: '나', availability: 'available' }),
    ).rejects.toBeTruthy();
  });
});

describe('pollByCode — rpc(poll_view_by_code)', () => {
  it('calls rpc with p_code and returns data', async () => {
    const { client, rpc } = makeClient({ rpcResult: { data: { mode: 'range' }, error: null } });
    const out = await pollByCode(client, CODE);
    expect(rpc).toHaveBeenCalledWith('poll_view_by_code', { p_code: CODE });
    expect(out).toEqual({ mode: 'range' });
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
    await expect(pollByCode(client, CODE)).rejects.toBeTruthy();
  });
});

describe('getPollTally — rpc(poll_vote_tally)', () => {
  it('calls rpc with p_code and returns the shaped tally', async () => {
    const tally = { mode: 'range', status: 'open', tally: [] };
    const { client, rpc } = makeClient({ rpcResult: { data: tally, error: null } });
    const out = await getPollTally(client, CODE);
    expect(rpc).toHaveBeenCalledWith('poll_vote_tally', { p_code: CODE });
    expect(out).toEqual(tally);
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
    await expect(getPollTally(client, CODE)).rejects.toBeTruthy();
  });
});

describe('confirmPollDate — rpc(confirm_poll_date), owner-only', () => {
  it('calls rpc with poll id + start/end dates', async () => {
    const { client, rpc } = makeClient({ rpcResult: { data: undefined, error: null } });
    await confirmPollDate(client, {
      pollId: POLL,
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    });
    expect(rpc).toHaveBeenCalledWith('confirm_poll_date', {
      p_poll_id: POLL,
      p_start_date: '2026-07-01',
      p_end_date: '2026-07-03',
    });
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'host only' } } });
    await expect(
      confirmPollDate(client, { pollId: POLL, startDate: '2026-07-01', endDate: '2026-07-03' }),
    ).rejects.toBeTruthy();
  });
});

describe('createDatelessTrip — rpc(create_dateless_trip_with_poll)', () => {
  it('calls rpc with title/city/mode and returns the {trip_id,poll_id,poll_code} jsonb', async () => {
    const created = { trip_id: TRIP, poll_id: POLL, poll_code: CODE };
    const { client, rpc } = makeClient({ rpcResult: { data: created, error: null } });
    const out = await createDatelessTrip(client, { title: '도쿄', cityCode: 'tokyo', mode: 'range' });
    expect(rpc).toHaveBeenCalledWith('create_dateless_trip_with_poll', {
      p_title: '도쿄',
      p_city_code: 'tokyo',
      p_mode: 'range',
    });
    expect(out).toEqual(created);
  });

  it('throws when rpc returns { error }', async () => {
    const { client } = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
    await expect(
      createDatelessTrip(client, { title: 'x', cityCode: 'tokyo', mode: 'grid' }),
    ).rejects.toBeTruthy();
  });
});

describe('getPollByTrip — by-trip poll read seam (no inline raw query downstream)', () => {
  it("reads from('date_polls'), scopes by trip_id, maybeSingle, returns the row", async () => {
    const row = { id: POLL, poll_code: CODE, mode: 'range', status: 'open' };
    const { client, from, chain } = makeClient({ result: { data: row, error: null } });
    const out = await getPollByTrip(client, TRIP);
    expect(from).toHaveBeenCalledWith('date_polls');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(out).toEqual(row);
  });

  it('returns null when no poll exists', async () => {
    const { client } = makeClient({ result: { data: null, error: null } });
    expect(await getPollByTrip(client, TRIP)).toBeNull();
  });

  it('throws when the read returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(getPollByTrip(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('createDatePoll — poll for an EXISTING trip (25-07 Gap 1), RLS-gated direct insert', () => {
  it("inserts {trip_id, mode} into date_polls, selects the shaped row, returns it", async () => {
    const row = { id: POLL, poll_code: CODE, mode: 'range', status: 'open' };
    const { client, from, chain } = makeClient({ result: { data: row, error: null } });
    const out = await createDatePoll(client, TRIP, 'range');
    expect(from).toHaveBeenCalledWith('date_polls');
    expect(chain.insert).toHaveBeenCalledWith({ trip_id: TRIP, mode: 'range' });
    expect(chain.select).toHaveBeenCalledWith('id, poll_code, mode, status');
    expect(chain.single).toHaveBeenCalled();
    expect(out).toEqual(row);
  });

  it('throws when the insert returns { error } (house contract)', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'denied' } } });
    await expect(createDatePoll(client, TRIP, 'range')).rejects.toBeTruthy();
  });

  it("defaults mode to 'range' when omitted", async () => {
    const row = { id: POLL, poll_code: CODE, mode: 'range', status: 'open' };
    const { client, chain } = makeClient({ result: { data: row, error: null } });
    await createDatePoll(client, TRIP);
    expect(chain.insert).toHaveBeenCalledWith({ trip_id: TRIP, mode: 'range' });
  });
});

describe('setPollMode — host mode switch (D-07), owner-guarded by RLS', () => {
  it("updates date_polls.mode scoped by poll id", async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await setPollMode(client, POLL, 'grid');
    expect(from).toHaveBeenCalledWith('date_polls');
    expect(chain.update).toHaveBeenCalledWith({ mode: 'grid' });
    expect(chain.eq).toHaveBeenCalledWith('id', POLL);
  });

  it('throws when the update returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'denied' } } });
    await expect(setPollMode(client, POLL, 'range')).rejects.toBeTruthy();
  });
});

describe('getPollOptions — host candidate-window read (GAP-19A), owner-gated by RLS', () => {
  it("reads date_poll_options by poll_id, ordered by start_date", async () => {
    const rows = [{ id: OPTION, start_date: '2026-04-03', end_date: '2026-04-05' }];
    const { client, from, chain } = makeClient({ result: { data: rows, error: null } });
    const out = await getPollOptions(client, POLL);
    expect(from).toHaveBeenCalledWith('date_poll_options');
    expect(chain.eq).toHaveBeenCalledWith('poll_id', POLL);
    expect(chain.order).toHaveBeenCalledWith('start_date');
    expect(out).toEqual(rows);
  });

  it('returns [] when there are no options', async () => {
    const { client } = makeClient({ result: { data: null, error: null } });
    expect(await getPollOptions(client, POLL)).toEqual([]);
  });

  it('throws when the read returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'denied' } } });
    await expect(getPollOptions(client, POLL)).rejects.toBeTruthy();
  });
});

describe('addPollOption — host candidate-window insert (GAP-19A), owner-gated by RLS', () => {
  it('inserts {poll_id,start_date,end_date} and returns the row', async () => {
    const row = { id: OPTION, start_date: '2026-04-03', end_date: '2026-04-05' };
    const { client, from, chain } = makeClient({ result: { data: row, error: null } });
    const out = await addPollOption(client, POLL, { startDate: '2026-04-03', endDate: '2026-04-05' });
    expect(from).toHaveBeenCalledWith('date_poll_options');
    expect(chain.insert).toHaveBeenCalledWith({
      poll_id: POLL,
      start_date: '2026-04-03',
      end_date: '2026-04-05',
    });
    expect(out).toEqual(row);
  });

  it('throws when the insert returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'denied' } } });
    await expect(
      addPollOption(client, POLL, { startDate: '2026-04-03', endDate: '2026-04-05' }),
    ).rejects.toBeTruthy();
  });
});

describe('removePollOption — host candidate-window delete (GAP-19A), owner-gated by RLS', () => {
  it('deletes date_poll_options scoped by option id', async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await removePollOption(client, OPTION);
    expect(from).toHaveBeenCalledWith('date_poll_options');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', OPTION);
  });

  it('throws when the delete returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'denied' } } });
    await expect(removePollOption(client, OPTION)).rejects.toBeTruthy();
  });
});
