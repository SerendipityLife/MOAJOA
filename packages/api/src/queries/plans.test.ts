import { describe, it, expect, vi } from 'vitest';
import {
  getPlanByTrip,
  generatePlan,
  reorderPlanItem,
  setTravelMode,
  moveToPool,
  moveToDay,
  setAnchor,
  setCollaborative,
} from './plans';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror core booking.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const PLAN = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const PLACE = '44444444-4444-4444-8444-444444444444';
const SLUG = 'happy-fox-42';

/**
 * Minimal chainable mock of MoajoaSupabaseClient. Every query-builder method
 * returns the same `chain` object (so `.from().select().eq()...` keeps chaining)
 * and the chain is *thenable* — it resolves to `result`. This lets a query end
 * on any terminal (`.single()`, `.maybeSingle()`, or just an awaited `.eq()`/
 * `.delete().eq()`) and still get `{ data, error }`. Spies on each builder method
 * record the exact arguments so we can assert query shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockChain = Record<string, any>;

function makeChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'order', 'update', 'insert', 'delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  // Thenable: awaiting a chain that never hit single/maybeSingle resolves result.
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return chain;
}

function makeClient(opts?: {
  result?: { data: unknown; error: unknown };
  invokeResult?: { data: unknown; error: unknown };
}) {
  const result = opts?.result ?? { data: {}, error: null };
  const invokeResult = opts?.invokeResult ?? { data: {}, error: null };
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const invoke = vi.fn(() => Promise.resolve(invokeResult));
  const client = { from, functions: { invoke } } as unknown as MoajoaSupabaseClient;
  return { client, from, chain, invoke };
}

describe('getPlanByTrip — draft plan + embedded plan_items', () => {
  it("reads from('plans'), selects plan_items, scopes by trip_id and draft status", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: PLAN, trip_id: TRIP, plan_items: [] }, error: null },
    });
    await getPlanByTrip(client, TRIP);
    expect(from).toHaveBeenCalledWith('plans');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('plan_items'));
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(getPlanByTrip(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('generatePlan — invoke the generate-plan Edge Function', () => {
  it("calls functions.invoke('generate-plan', { body }) and returns the data", async () => {
    const body = {
      trip_id: TRIP,
      travel_mode: 'walk' as const,
      anchor_place_ids: [],
      removed_place_ids: [],
    };
    const resultData = { plan_id: PLAN, day_count: 2, placed_count: 5, unplaced_count: 1 };
    const { client, invoke } = makeClient({ invokeResult: { data: resultData, error: null } });
    const out = await generatePlan(client, body);
    expect(invoke).toHaveBeenCalledWith('generate-plan', { body });
    expect(out).toEqual(resultData);
  });

  it('throws when invoke returns { error }', async () => {
    const { client } = makeClient({ invokeResult: { data: null, error: { message: 'fail' } } });
    await expect(
      generatePlan(client, {
        trip_id: TRIP,
        travel_mode: 'transit',
        anchor_place_ids: [],
        removed_place_ids: [],
      }),
    ).rejects.toBeTruthy();
  });
});

describe('reorderPlanItem — update day_index/sort_order', () => {
  it("updates plan_items with the patch and scopes by item id", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ITEM, day_index: 1, sort_order: 2 }, error: null },
    });
    await reorderPlanItem(client, ITEM, { day_index: 1, sort_order: 2 });
    expect(from).toHaveBeenCalledWith('plan_items');
    expect(chain.update).toHaveBeenCalledWith({ day_index: 1, sort_order: 2 });
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(
      reorderPlanItem(client, ITEM, { day_index: 0, sort_order: 0 }),
    ).rejects.toBeTruthy();
  });
});

describe('setTravelMode — flip plans.travel_mode', () => {
  it("updates plans.travel_mode scoped by plan id", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: PLAN, travel_mode: 'drive' }, error: null },
    });
    await setTravelMode(client, PLAN, 'drive');
    expect(from).toHaveBeenCalledWith('plans');
    expect(chain.update).toHaveBeenCalledWith({ travel_mode: 'drive' });
    expect(chain.eq).toHaveBeenCalledWith('id', PLAN);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(setTravelMode(client, PLAN, 'walk')).rejects.toBeTruthy();
  });
});

describe('moveToPool — delete the plan_item (unplaced = no row, D-13)', () => {
  it("deletes from plan_items scoped by item id", async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await moveToPool(client, ITEM);
    expect(from).toHaveBeenCalledWith('plan_items');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(moveToPool(client, ITEM)).rejects.toBeTruthy();
  });
});

describe('moveToDay — insert a plan_item (placed), is_anchor TRUE (D-21 Day 고정)', () => {
  it("inserts into plan_items with the day/order and is_anchor true", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ITEM, plan_id: PLAN, place_id: PLACE }, error: null },
    });
    await moveToDay(client, {
      plan_id: PLAN,
      place_id: PLACE,
      day_index: 0,
      sort_order: 3,
    });
    expect(from).toHaveBeenCalledWith('plan_items');
    // is_anchor:true is the marker that makes a manual placement survive a
    // regenerate: the client collects anchored items into pinned_placements and
    // the EF force-holds them on their day (D-21).
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: PLAN,
        place_id: PLACE,
        day_index: 0,
        sort_order: 3,
        is_anchor: true,
      }),
    );
  });

  it('still inserts leg_travel_seconds null ("이동시간 —" until the next regenerate)', async () => {
    const { client, chain } = makeClient({
      result: { data: { id: ITEM, plan_id: PLAN, place_id: PLACE }, error: null },
    });
    await moveToDay(client, {
      plan_id: PLAN,
      place_id: PLACE,
      day_index: 1,
      sort_order: 0,
    });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ leg_travel_seconds: null }),
    );
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(
      moveToDay(client, { plan_id: PLAN, place_id: PLACE, day_index: 0, sort_order: 0 }),
    ).rejects.toBeTruthy();
  });
});

describe('setAnchor — toggle is_anchor (필수 표시, D-10)', () => {
  it("updates is_anchor scoped by item id", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ITEM, is_anchor: true }, error: null },
    });
    await setAnchor(client, ITEM, true);
    expect(from).toHaveBeenCalledWith('plan_items');
    expect(chain.update).toHaveBeenCalledWith({ is_anchor: true });
    expect(chain.eq).toHaveBeenCalledWith('id', ITEM);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(setAnchor(client, ITEM, false)).rejects.toBeTruthy();
  });
});

describe('setCollaborative — flip flag + reuse shareTrip (D-14, flag + share only)', () => {
  it("updates plans.collaborative=true, reuses shareTrip path, returns slug; NO votes query", async () => {
    // shareTrip reads trips.{visibility,share_slug} then (if no slug) flips
    // visibility='shared'. Drive the read to already have a slug so the
    // read-then-flip path resolves to SLUG without a second update.
    const fromCalls: string[] = [];
    const updateCalls: unknown[] = [];
    const client = {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        const chain: MockChain = {};
        for (const m of ['select', 'eq', 'is', 'order', 'insert', 'delete']) {
          chain[m] = vi.fn(() => chain);
        }
        chain.update = vi.fn((patch: unknown) => {
          updateCalls.push({ table, patch });
          return chain;
        });
        // plans update → { collaborative: true } row; trips read → existing slug.
        const result =
          table === 'trips'
            ? { data: { visibility: 'shared', share_slug: SLUG }, error: null }
            : { data: { id: PLAN, collaborative: true }, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        chain.maybeSingle = vi.fn(() => Promise.resolve(result));
        return chain;
      }),
    } as unknown as MoajoaSupabaseClient;

    const out = await setCollaborative(client, PLAN, TRIP);

    expect(fromCalls).toContain('plans');
    expect(fromCalls).toContain('trips'); // shareTrip read-then-flip path invoked
    expect(fromCalls).not.toContain('votes'); // D-14: flag + share only, no votes
    expect(updateCalls).toContainEqual({ table: 'plans', patch: { collaborative: true } });
    expect(out).toEqual({ collaborative: true, share_slug: SLUG });
  });

  it('throws when the plans update returns { error }', async () => {
    const client = {
      from: vi.fn(() => {
        const chain: MockChain = {};
        for (const m of ['select', 'eq', 'is', 'order', 'insert', 'delete', 'update']) {
          chain[m] = vi.fn(() => chain);
        }
        const result = { data: null, error: { message: 'boom' } };
        chain.single = vi.fn(() => Promise.resolve(result));
        chain.maybeSingle = vi.fn(() => Promise.resolve(result));
        return chain;
      }),
    } as unknown as MoajoaSupabaseClient;
    await expect(setCollaborative(client, PLAN, TRIP)).rejects.toBeTruthy();
  });
});
