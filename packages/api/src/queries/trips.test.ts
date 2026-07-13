import { describe, it, expect, vi } from 'vitest';
import { shareMoa, createMoaDraft, updateTrip } from './trips';
import type { MoajoaSupabaseClient } from '../client';
import type { TripCreateDraft } from '@moajoa/core';

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

describe('createMoaDraft — onboarding draft INSERT with companion (ONBOARD-03)', () => {
  const draft: TripCreateDraft = {
    title: '오사카 여행',
    city_code: 'osaka',
    start_date: '2026-08-01',
    end_date: '2026-08-03',
    companion: 'friends',
    day_count: 3,
  };

  it('inserts the 6 draft fields (incl. companion + day_count) into trips, selects *, single', async () => {
    const row = { id: TRIP, ...draft };
    const { client, from, chain } = makeClient({ data: row, error: null });
    const out = await createMoaDraft(client, draft);
    expect(from).toHaveBeenCalledWith('trips');
    expect(chain.insert).toHaveBeenCalledWith({
      title: draft.title,
      city_code: draft.city_code,
      start_date: draft.start_date,
      end_date: draft.end_date,
      companion: draft.companion,
      day_count: draft.day_count,
    });
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
    expect(out).toEqual(row);
  });

  it('throws when the mock returns { error } (house contract)', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } });
    await expect(createMoaDraft(client, draft)).rejects.toBeTruthy();
  });

  // --- day_count (0031, D-08) — 위저드 기간 pill이 이 INSERT로 영속된다 ---

  it('carries a 기간 pill day_count (3) into the INSERT object', async () => {
    const { client, chain } = makeClient({ data: { id: TRIP }, error: null });
    await createMoaDraft(client, { ...draft, day_count: 3 });
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ day_count: 3 }));
  });

  it('carries an explicit null day_count (기간 미정) — 키 누락이 아니라 null', async () => {
    const { client, chain } = makeClient({ data: { id: TRIP }, error: null });
    await createMoaDraft(client, { ...draft, day_count: null });
    const insertArg = chain.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg).toHaveProperty('day_count');
    expect(insertArg.day_count).toBeNull();
  });
});

describe('updateTrip — day_count 조건부 passthrough (D-13 기간 게이트, 0031)', () => {
  it('sends ONLY day_count when the patch has only day_count', async () => {
    const { client, from, chain } = makeClient({ data: { id: TRIP }, error: null });
    await updateTrip(client, TRIP, { day_count: 4 });
    expect(from).toHaveBeenCalledWith('trips');
    expect(chain.update).toHaveBeenCalledWith({ day_count: 4 });
    expect(chain.eq).toHaveBeenCalledWith('id', TRIP);
  });

  it('sends day_count: null (기간 미정으로 되돌리기 — undefined 검사라 null이 통과한다)', async () => {
    const { client, chain } = makeClient({ data: { id: TRIP }, error: null });
    await updateTrip(client, TRIP, { day_count: null });
    expect(chain.update).toHaveBeenCalledWith({ day_count: null });
  });

  it('omits the day_count key entirely when it is undefined (조건부 spread)', async () => {
    const { client, chain } = makeClient({ data: { id: TRIP }, error: null });
    await updateTrip(client, TRIP, { title: '새 제목' });
    const updateArg = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty('day_count');
    expect(updateArg).toEqual({ title: '새 제목' });
  });
});
