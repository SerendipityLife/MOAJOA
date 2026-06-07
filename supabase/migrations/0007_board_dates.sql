-- =============================================================================
-- Add optional trip dates to boards.
-- =============================================================================
-- The "New plan" creation flow (Mozi-style) lets the user pick a single date
-- or a date range for the trip a board represents. Boards had no date columns,
-- so the picked dates had nowhere to live.
--
-- Both columns are NULLABLE with no default — dates are optional (a board can
-- be created with just a city), and adding nullable columns is a non-locking,
-- backward-compatible change (existing rows stay valid).
--
-- end_date is null for a single-day pick; for a range, end_date >= start_date.
-- =============================================================================

alter table boards add column start_date date;
alter table boards add column end_date date;
