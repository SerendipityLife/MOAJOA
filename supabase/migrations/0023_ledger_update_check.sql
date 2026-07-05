-- 0023_ledger_update_check.sql — Phase 21 Travel Ledger, code-review finding CR-01
-- (LEDGER-04/06). Tightens the ledger_entries UPDATE RLS WITH CHECK so an owner
-- cannot assign their own row to a trip they are not a member of.
--
-- Why: 0022's UPDATE policy gated on owner_user_id ONLY, never the NEW trip_id.
-- Because the ledger row's merchant/amount is attacker-influenceable (populated
-- from a forwarded mail) and assignTripToEntry does no membership check (RLS is
-- the ONLY gate), a row owner could `update({ trip_id: victimTripId })` and inject
-- a spoofed expense into ANY trip whose UUID they know — the SELECT policy then
-- surfaces that row to the victim trip's members via can_read_trip. This closes
-- the write-injection: assigning your own expense to a trip now requires you can
-- read that trip (owner or accepted member), matching the SELECT sharing model
-- (assigned rows are visible to can_read_trip members) and the "가계부 = trip 멤버
-- 공유" decision (D-04). Unclassified (trip_id null) stays allowed — the owner
-- keeps it private (D-05).
--
-- can_read_trip is the existing 0016 SECURITY DEFINER helper: routing through it
-- keeps the check a single DEFINER call, never a direct cross-table subquery, so
-- the 42P17 recursion guard holds (CLAUDE.md §4.4). The USING clause is unchanged
-- (still owner-only: you only update your OWN rows).
--
-- Append-only: 0016..0022 are NEVER modified.

drop policy "ledger_entries: update own" on ledger_entries;

create policy "ledger_entries: update own"
  on ledger_entries for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and (trip_id is null or can_read_trip(trip_id))
  );
