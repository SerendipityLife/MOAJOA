-- =============================================================================
-- Default boards.owner_id to auth.uid() on insert.
-- =============================================================================
-- Other tables (links, places, votes) use a BEFORE INSERT trigger to auto-fill
-- their owner column. The boards table was missing the equivalent, so the
-- client's INSERT (which omits owner_id) failed the NOT NULL constraint and
-- could not pass the RLS WITH CHECK `owner_id = auth.uid()`.
--
-- Using a column default with auth.uid() — works because auth.uid() is a
-- regular SQL function evaluated at INSERT time inside the authenticated
-- user's session.
-- =============================================================================

alter table boards alter column owner_id set default auth.uid();
