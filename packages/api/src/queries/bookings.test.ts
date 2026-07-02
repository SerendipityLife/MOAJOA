import { describe, it, expect, vi } from 'vitest';
import {
  listChecklist,
  addManualItem,
  setItemStatus,
  deleteChecklistItem,
  reconcileChecklist,
  logBookingClick,
  listClickedChecklistItemIds,
} from './bookings';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror plans.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const ITEM = '22222222-2222-4222-8222-222222222222';
const ITEM2 = '33333333-3333-4333-8333-333333333333';
const PLACE = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'c_abc12345XY';

/**
 * Minimal chainable mock of MoajoaSupabaseClient (copied from plans.test.ts).
 * Every query-builder method returns the same `chain` object and the chain is
 * *thenable* — it resolves to `result`. Extended with 'in' (reconcile delete
 * batch) and 'not' (clicked-ids null filter) over the plans.ts harness.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'in', 'not', 'order', 'update', 'insert', 'delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  // Thenable: awaiting a chain that never hit single/maybeSingle resolves result.
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return chain;
}

function makeClient(opts?: { result?: { data: unknown; error: unknown } }) {
  const result = opts?.result ?? { data: {}, error: null };
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const client = { from } as unknown as MoajoaSupabaseClient;
  return { client, from, chain };
}

describe('listChecklist — trip-scoped checklist rows, created_at order', () => {
  it("reads from('booking_checklist_items') scoped by trip_id, ordered by created_at", async () => {
    const { client, from, chain } = makeClient({
      result: { data: [{ id: ITEM, trip_id: TRIP }], error: null },
    });
    await listChecklist(client, TRIP);
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.order).toHaveBeenCalledWith('created_at');
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(listChecklist(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('addManualItem — user-added custom row (D-10)', () => {
  it("inserts kind 'custom' / source 'manual' / status 'todo' and returns the single row", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ITEM, trip_id: TRIP, title: '환전' }, error: null },
    });
    await addManualItem(client, { trip_id: TRIP, title: '환전' });
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.insert).toHaveBeenCalledWith({
      trip_id: TRIP,
      title: '환전',
      kind: 'custom',
      source: 'manual',
      status: 'todo',
    });
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(addManualItem(client, { trip_id: TRIP, title: '환전' })).rejects.toBeTruthy();
  });
});

describe('setItemStatus — todo/clicked/done transition by item id', () => {
  it('updates status scoped by item id and returns the single row', async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ITEM, status: 'done' }, error: null },
    });
    await setItemStatus(client, ITEM, 'done');
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.update).toHaveBeenCalledWith({ status: 'done' });
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(setItemStatus(client, ITEM, 'todo')).rejects.toBeTruthy();
  });
});

describe('deleteChecklistItem — delete by item id', () => {
  it("deletes from('booking_checklist_items') scoped by item id", async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await deleteChecklistItem(client, ITEM);
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(deleteChecklistItem(client, ITEM)).rejects.toBeTruthy();
  });
});

describe('reconcileChecklist — mirror the core-derived diff, NO derivation here', () => {
  it('inserts derived rows (trip_id/source auto/status todo) and batch-deletes by id', async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await reconcileChecklist(client, TRIP, {
      toInsert: [
        { kind: 'esim', place_id: null, title: '여행 유심' },
        { kind: 'activity', place_id: PLACE, title: '팀랩 티켓' },
      ],
      toDeleteIds: [ITEM, ITEM2],
    });
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.insert).toHaveBeenCalledWith([
      { trip_id: TRIP, kind: 'esim', place_id: null, title: '여행 유심', source: 'auto', status: 'todo' },
      { trip_id: TRIP, kind: 'activity', place_id: PLACE, title: '팀랩 티켓', source: 'auto', status: 'todo' },
    ]);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.in).toHaveBeenCalledWith('id', [ITEM, ITEM2]);
  });

  it('does NOT insert when toInsert is empty', async () => {
    const { client, chain } = makeClient({ result: { data: null, error: null } });
    await reconcileChecklist(client, TRIP, { toInsert: [], toDeleteIds: [ITEM] });
    expect(chain.insert).not.toHaveBeenCalled();
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.in).toHaveBeenCalledWith('id', [ITEM]);
  });

  it('does NOT delete when toDeleteIds is empty', async () => {
    const { client, chain } = makeClient({ result: { data: null, error: null } });
    await reconcileChecklist(client, TRIP, {
      toInsert: [{ kind: 'stay', place_id: null, title: '숙소 예약' }],
      toDeleteIds: [],
    });
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it('throws when the insert returns { error } (unique-conflict surfaces, no swallow)', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: '23505' } } });
    await expect(
      reconcileChecklist(client, TRIP, {
        toInsert: [{ kind: 'stay', place_id: null, title: '숙소 예약' }],
        toDeleteIds: [],
      }),
    ).rejects.toBeTruthy();
  });
});

describe("logBookingClick — click INSERT + '확인함' todo→clicked transition (D-11)", () => {
  it('inserts the click row, then flips the linked item todo→clicked (guarded eq status todo)', async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await logBookingClick(client, {
      trip_id: TRIP,
      place_id: PLACE,
      user_id: USER,
      provider: 'travelpayouts',
      click_token: TOKEN,
      checklist_item_id: ITEM,
    });
    expect(from).toHaveBeenCalledWith('booking_clicks');
    expect(chain.insert).toHaveBeenCalledWith({
      trip_id: TRIP,
      place_id: PLACE,
      user_id: USER,
      provider: 'travelpayouts',
      click_token: TOKEN,
      checklist_item_id: ITEM,
    });
    // D-11: the sole write path for '확인함' — conditional on the item still being todo
    // (already-done items stay done; 완료의 원천은 사용자).
    expect(from).toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.update).toHaveBeenCalledWith({ status: 'clicked' });
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
    expect(chain.eq).toHaveBeenCalledWith('status', 'todo');
  });

  it('does NOT touch the checklist when checklist_item_id is absent', async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await logBookingClick(client, {
      trip_id: TRIP,
      place_id: null,
      user_id: USER,
      provider: 'stay22',
      click_token: TOKEN,
      checklist_item_id: null,
    });
    expect(from).toHaveBeenCalledWith('booking_clicks');
    expect(from).not.toHaveBeenCalledWith('booking_checklist_items');
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('throws when the insert returns { error } — swallowing is the CALLER responsibility (D-14)', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: '42501' } } });
    await expect(
      logBookingClick(client, {
        trip_id: TRIP,
        place_id: null,
        user_id: USER,
        provider: 'travelpayouts',
        click_token: TOKEN,
        checklist_item_id: null,
      }),
    ).rejects.toBeTruthy();
  });
});

describe('listClickedChecklistItemIds — clicked-ever set for un-check demotion (UI-SPEC Screen 3)', () => {
  it("reads booking_clicks scoped by trip_id, filters non-null checklist_item_id, returns a Set", async () => {
    const { client, from, chain } = makeClient({
      result: {
        data: [
          { checklist_item_id: ITEM },
          { checklist_item_id: ITEM2 },
          { checklist_item_id: ITEM }, // duplicate click → Set dedups
        ],
        error: null,
      },
    });
    const out = await listClickedChecklistItemIds(client, TRIP);
    expect(from).toHaveBeenCalledWith('booking_clicks');
    expect(chain.select).toHaveBeenCalledWith('checklist_item_id');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.not).toHaveBeenCalledWith('checklist_item_id', 'is', null);
    expect(out).toEqual(new Set([ITEM, ITEM2]));
    expect(out.size).toBe(2);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(listClickedChecklistItemIds(client, TRIP)).rejects.toBeTruthy();
  });
});
