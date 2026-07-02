import type { ChecklistItem, ChecklistStatusType } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

/**
 * Booking checklist + click attribution queries (BOOK-02 / ATTR-02).
 *
 * RLS is the ONLY gate (0021): the trip-read RLS helper gates SELECT and the
 * trip-edit helper gates writes server-side — these wrappers do NO extra
 * client-side membership check (T-18-17 mirror, D-12). Clicks additionally
 * enforce `user_id = auth.uid()` via WITH CHECK (T-20-02): a spoofed user_id
 * surfaces here as a thrown 42501, never a silent success.
 *
 * Derivation ownership (T-20-11): the auto-item diff is computed ONLY by
 * @moajoa/core's pure derivation (single definition) — reconcileChecklist just
 * mirrors the diff it is handed into the DB, with zero conditional derivation
 * logic of its own.
 */

/** The core-derived checklist diff shape reconcileChecklist mirrors into the DB. */
export interface ChecklistDiff {
  toInsert: Array<{ kind: string; place_id: string | null; title: string }>;
  toDeleteIds: string[];
}

/** Input for logBookingClick — one row per outbound affiliate tap (ATTR-02). */
export interface BookingClickInput {
  trip_id: string;
  place_id?: string | null;
  user_id: string;
  /** Free-text provider tag mirroring the unconstrained booking_clicks.provider
   * column: 'klook' | 'kkday' | 'airalo' | 'agoda_direct' | 'booking_direct' | …
   * — non-affiliate direct-search clicks log too (D-05: '확인함' 전이에 필요). */
  provider: string;
  click_token: string;
  checklist_item_id?: string | null;
}

/**
 * Read the trip's full checklist (auto + manual), oldest first. Both iOS
 * surfaces (plan/book tabs) read this same seam (D-03: 데이터는 하나, 표면만 둘).
 */
export async function listChecklist(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<ChecklistItem[]> {
  const { data, error } = await client
    .from('booking_checklist_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

/**
 * Add a user-authored checklist row (D-10). Always kind 'custom' / source
 * 'manual' / status 'todo' — manual rows are never touched by reconcile. The
 * caller validates title with @moajoa/core's ManualItemTitleSchema; no
 * re-validation here (the DB CHECK 1..80 is the last line of defense).
 */
export async function addManualItem(
  client: MoajoaSupabaseClient,
  input: { trip_id: string; title: string },
): Promise<ChecklistItem> {
  const { data, error } = await client
    .from('booking_checklist_items')
    .insert({
      trip_id: input.trip_id,
      title: input.title,
      kind: 'custom',
      source: 'manual',
      status: 'todo',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

/**
 * Set an item's status (todo/clicked/done). This is the USER-driven transition
 * path (check/uncheck, D-15) — the automatic todo→clicked flip lives solely in
 * logBookingClick (D-11).
 */
export async function setItemStatus(
  client: MoajoaSupabaseClient,
  itemId: string,
  status: ChecklistStatusType,
): Promise<ChecklistItem> {
  const { data, error } = await client
    .from('booking_checklist_items')
    .update({ status })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

/** Delete a checklist row by id (manual rows or explicit user removal). */
export async function deleteChecklistItem(
  client: MoajoaSupabaseClient,
  itemId: string,
): Promise<void> {
  const { error } = await client
    .from('booking_checklist_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

/**
 * Mirror a core-derived checklist diff into the DB — nothing more. The caller
 * composes: load existing rows, run @moajoa/core's pure auto-derivation, hand
 * the result here. Inserted rows are stamped trip_id / source 'auto' / status
 * 'todo'; deletions are a single batched `.in()`. Unique-index conflicts
 * (auto singleton/place dedup) under concurrency are rare and surface as a
 * thrown { error } — a re-fetch + re-reconcile naturally recovers.
 */
export async function reconcileChecklist(
  client: MoajoaSupabaseClient,
  tripId: string,
  derived: ChecklistDiff,
): Promise<void> {
  if (derived.toInsert.length > 0) {
    const rows = derived.toInsert.map((r) => ({
      trip_id: tripId,
      kind: r.kind,
      place_id: r.place_id,
      title: r.title,
      source: 'auto',
      status: 'todo',
    }));
    const { error } = await client.from('booking_checklist_items').insert(rows);
    if (error) throw error;
  }
  if (derived.toDeleteIds.length > 0) {
    const { error } = await client
      .from('booking_checklist_items')
      .delete()
      .in('id', derived.toDeleteIds);
    if (error) throw error;
  }
}

/**
 * Log an outbound affiliate click (ATTR-02), then — iff the click is linked to
 * a checklist item — flip that item todo→'clicked' ('확인함', D-11). This is
 * the ONLY automatic write path to 'clicked'; the `.eq('status', 'todo')` guard
 * means an already-'done' item stays done (완료의 원천은 사용자).
 *
 * This wrapper THROWS on failure — fire-and-forget swallowing is the iOS
 * caller's `.catch(() => {})` responsibility (D-14).
 */
export async function logBookingClick(
  client: MoajoaSupabaseClient,
  input: BookingClickInput,
): Promise<void> {
  const { error } = await client.from('booking_clicks').insert({
    trip_id: input.trip_id,
    place_id: input.place_id ?? null,
    user_id: input.user_id,
    provider: input.provider,
    click_token: input.click_token,
    checklist_item_id: input.checklist_item_id ?? null,
  });
  if (error) throw error;
  if (input.checklist_item_id != null) {
    const { error: transitionError } = await client
      .from('booking_checklist_items')
      .update({ status: 'clicked' })
      .eq('id', input.checklist_item_id)
      .eq('status', 'todo');
    if (transitionError) throw transitionError;
  }
}

/**
 * The set of checklist item ids that have EVER been clicked for this trip.
 * Used by the book tab to decide where un-checking a 'done' item lands
 * (clicked vs todo, UI-SPEC Screen 3).
 */
export async function listClickedChecklistItemIds(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('booking_clicks')
    .select('checklist_item_id')
    .eq('trip_id', tripId)
    .not('checklist_item_id', 'is', null);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ checklist_item_id: string | null }>;
  return new Set(rows.map((r) => r.checklist_item_id).filter((id): id is string => id !== null));
}
