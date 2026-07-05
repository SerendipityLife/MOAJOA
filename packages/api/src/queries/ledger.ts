import type { LedgerEntry } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

/**
 * Travel ledger queries (LEDGER-01/05). Pure CRUD over ledger_entries — the
 * house contract: `(client, ...) => Promise<T>`, `const {data,error}=...; if
 * (error) throw error` (bookings.ts mirror). RLS (0022) is the ONLY gate: SELECT
 * branches on trip_id (owner-private when null / trip-shared via can_read_trip
 * when set), and update/delete are owner-only via `owner_user_id = auth.uid()`
 * WITH CHECK — so these wrappers carry NO redundant client-side ownership check
 * (T-21-09, D-04).
 *
 * Derivation ownership: amount_krw / FX rate / mail parsing live ENTIRELY in the
 * parse-email EF and @moajoa/core (deriveAmountKrw) — this layer never computes a
 * KRW value or an FX rate. It is CRUD only (T-21-10, bookings.ts T-20-11 mirror).
 */

/** Read a trip's ledger, most recently paid first. */
export async function listLedger(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<LedgerEntry[]> {
  const { data, error } = await client
    .from('ledger_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LedgerEntry[];
}

/**
 * The unclassified inbox: owner-private entries not yet assigned a trip (D-05).
 * RLS returns only the caller's own rows for the trip_id-null arm, so no owner
 * filter is needed here.
 */
export async function listUnassignedLedger(
  client: MoajoaSupabaseClient,
): Promise<LedgerEntry[]> {
  const { data, error } = await client
    .from('ledger_entries')
    .select('*')
    .is('trip_id', null)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as LedgerEntry[];
}

/** A trip's low-confidence entries the owner must manually fix (needs_review, D-05). */
export async function listNeedsReview(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<LedgerEntry[]> {
  const { data, error } = await client
    .from('ledger_entries')
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'needs_review');
  if (error) throw error;
  return (data ?? []) as LedgerEntry[];
}

/** 1-tap trip assignment (D-05): move an unclassified entry onto a trip. */
export async function assignTripToEntry(
  client: MoajoaSupabaseClient,
  entryId: string,
  tripId: string,
): Promise<LedgerEntry> {
  const { data, error } = await client
    .from('ledger_entries')
    .update({ trip_id: tripId })
    .eq('id', entryId)
    .select('*')
    .single();
  if (error) throw error;
  return data as LedgerEntry;
}

/**
 * Apply an owner's manual fix to a needs_review entry (amount/currency/paid_at/
 * status→'ready'). The caller composes the patch; this layer mirrors it into the
 * row — it does NOT re-derive amount_krw or an FX rate (that stays in EF/core).
 */
export async function updateLedgerEntry(
  client: MoajoaSupabaseClient,
  entryId: string,
  patch: Partial<LedgerEntry>,
): Promise<LedgerEntry> {
  const { data, error } = await client
    .from('ledger_entries')
    .update(patch)
    .eq('id', entryId)
    .select('*')
    .single();
  if (error) throw error;
  return data as LedgerEntry;
}

/** Delete an entry by id (owner-only via 0022 delete RLS). */
export async function deleteLedgerEntry(
  client: MoajoaSupabaseClient,
  entryId: string,
): Promise<void> {
  const { error } = await client.from('ledger_entries').delete().eq('id', entryId);
  if (error) throw error;
}
