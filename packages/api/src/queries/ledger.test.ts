import { describe, it, expect, vi } from 'vitest';
import {
  listLedger,
  listUnassignedLedger,
  listNeedsReview,
  assignTripToEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
} from './ledger';
import { getOrCreateForwardingAddress } from './forwarding';
import type { MoajoaSupabaseClient } from '../client';

// uuid v4 fixtures (mirror bookings.test.ts idiom).
const TRIP = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222';
const USER = '55555555-5555-4555-8555-555555555555';
const TOKEN = 'ledgr_ab12cd34';

/**
 * Minimal chainable mock of MoajoaSupabaseClient (copied from bookings.test.ts).
 * Every query-builder method returns the same `chain` object and the chain is
 * *thenable* — it resolves to `result`. `.is` covers the unassigned-inbox filter.
 * An optional `auth.getUser` is mocked for the forwarding create path (the client
 * supplies user_id = auth.uid() so the 0022 WITH CHECK passes; RLS still gates).
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

function makeClient(opts?: {
  result?: { data: unknown; error: unknown };
  user?: { data: { user: unknown }; error: unknown };
}) {
  const result = opts?.result ?? { data: {}, error: null };
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const getUser = vi.fn(() =>
    Promise.resolve(opts?.user ?? { data: { user: { id: USER } }, error: null }),
  );
  const client = { from, auth: { getUser } } as unknown as MoajoaSupabaseClient;
  return { client, from, chain, getUser };
}

describe('listLedger — trip-scoped ledger rows, paid_at desc', () => {
  it("reads from('ledger_entries') scoped by trip_id, ordered by paid_at descending", async () => {
    const { client, from, chain } = makeClient({
      result: { data: [{ id: ENTRY, trip_id: TRIP }], error: null },
    });
    await listLedger(client, TRIP);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.order).toHaveBeenCalledWith('paid_at', { ascending: false });
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(listLedger(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('listUnassignedLedger — unclassified inbox (trip_id null), created_at order', () => {
  it("reads ledger_entries filtered by is('trip_id', null), ordered by created_at", async () => {
    const { client, from, chain } = makeClient({
      result: { data: [{ id: ENTRY, trip_id: null }], error: null },
    });
    await listUnassignedLedger(client);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.is).toHaveBeenCalledWith('trip_id', null);
    expect(chain.order).toHaveBeenCalledWith('created_at');
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(listUnassignedLedger(client)).rejects.toBeTruthy();
  });
});

describe('listNeedsReview — trip-scoped needs_review rows the owner must fix (D-05)', () => {
  it("filters ledger_entries by trip_id and status 'needs_review'", async () => {
    const { client, from, chain } = makeClient({
      result: { data: [{ id: ENTRY, status: 'needs_review' }], error: null },
    });
    await listNeedsReview(client, TRIP);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
    expect(chain.eq).toHaveBeenCalledWith('status', 'needs_review');
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(listNeedsReview(client, TRIP)).rejects.toBeTruthy();
  });
});

describe('assignTripToEntry — 1-tap trip assignment (D-05)', () => {
  it("updates { trip_id } scoped by entry id and returns the single row", async () => {
    const { client, from, chain } = makeClient({
      result: { data: { id: ENTRY, trip_id: TRIP }, error: null },
    });
    await assignTripToEntry(client, ENTRY, TRIP);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.update).toHaveBeenCalledWith({ trip_id: TRIP });
    expect(chain.eq).toHaveBeenCalledWith('id', ENTRY);
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(assignTripToEntry(client, ENTRY, TRIP)).rejects.toBeTruthy();
  });
});

describe('updateLedgerEntry — needs_review fix (amount/currency/paid_at/status)', () => {
  it("applies the caller patch scoped by entry id and returns the single row", async () => {
    const patch = { amount_foreign: 42.5, currency: 'JPY', status: 'ready' as const };
    const { client, from, chain } = makeClient({
      result: { data: { id: ENTRY, ...patch }, error: null },
    });
    await updateLedgerEntry(client, ENTRY, patch);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.update).toHaveBeenCalledWith(patch);
    expect(chain.eq).toHaveBeenCalledWith('id', ENTRY);
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(updateLedgerEntry(client, ENTRY, { status: 'ready' })).rejects.toBeTruthy();
  });
});

describe('deleteLedgerEntry — delete by entry id (owner-only via 0022 RLS)', () => {
  it("deletes from('ledger_entries') scoped by entry id", async () => {
    const { client, from, chain } = makeClient({ result: { data: null, error: null } });
    await deleteLedgerEntry(client, ENTRY);
    expect(from).toHaveBeenCalledWith('ledger_entries');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', ENTRY);
  });

  it('throws when the mock returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(deleteLedgerEntry(client, ENTRY)).rejects.toBeTruthy();
  });
});

describe('getOrCreateForwardingAddress — read own token or mint one (trigger fills token)', () => {
  it('returns the existing token without inserting when a row already exists', async () => {
    const { client, from, chain } = makeClient({
      result: { data: { token: TOKEN }, error: null },
    });
    const out = await getOrCreateForwardingAddress(client);
    expect(from).toHaveBeenCalledWith('forwarding_addresses');
    expect(chain.select).toHaveBeenCalledWith('token');
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
    expect(out).toEqual({ token: TOKEN });
  });

  it('inserts { user_id: auth.uid() } and returns the trigger-minted token when none exists', async () => {
    // maybeSingle → no row; auth.getUser → user; single (insert...select) → minted token.
    const { client, from, chain, getUser } = makeClient();
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.single = vi.fn(() => Promise.resolve({ data: { token: TOKEN }, error: null }));
    const out = await getOrCreateForwardingAddress(client);
    expect(from).toHaveBeenCalledWith('forwarding_addresses');
    expect(getUser).toHaveBeenCalled();
    expect(chain.insert).toHaveBeenCalledWith({ user_id: USER });
    expect(chain.select).toHaveBeenCalledWith('token');
    expect(chain.single).toHaveBeenCalled();
    expect(out).toEqual({ token: TOKEN });
  });

  it('throws when the read returns { error }', async () => {
    const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
    await expect(getOrCreateForwardingAddress(client)).rejects.toBeTruthy();
  });
});
