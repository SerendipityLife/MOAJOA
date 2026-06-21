-- Migration 0005: Allow extraction_costs.link_id to be NULL.
-- Why: Phase 3 introduces a new Edge Function `resolve-place` (manual pin search)
-- that performs Google Places API calls outside the per-link extraction pipeline.
-- Per CONTEXT.md D-08, these calls MUST be logged in extraction_costs for
-- aggregated cost monitoring (Phase 2 D-09 pattern). Such rows have no link_id.
--
-- Existing 0004 declared link_id NOT NULL with FK on links(id) on delete cascade.
-- We keep the FK + cascade; we only relax the NOT NULL.
--
-- Append-only per CLAUDE.md §4.3. Idempotent (uses IF NOT NULL guard via DO block).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'extraction_costs'
      and column_name = 'link_id'
      and is_nullable = 'NO'
  ) then
    alter table public.extraction_costs alter column link_id drop not null;
  end if;
end $$;

-- Replace strict link-only index with partial index so aggregations stay fast.
drop index if exists extraction_costs_link_idx;
create index extraction_costs_link_idx
  on public.extraction_costs (link_id)
  where link_id is not null;
