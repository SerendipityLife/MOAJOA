-- =============================================================================
-- Extraction pipeline hardening
-- =============================================================================
-- Part 1: Add source_kind and inferred_city columns to places table.
--   - source_kind: distinguishes AI-extracted pins from manually added ones.
--   - inferred_city: LLM-inferred city/region name for the place.
--
-- Part 2: Create extraction_costs table for per-call cost logging.
--   - One row per API call (Anthropic LLM or Google Places).
--   - RLS enabled with NO permissive policies (service role only).
--
-- Part 3: Indexes on extraction_costs for aggregation queries.
-- =============================================================================

-- ---- Part 1: places columns --------------------------------------------------

alter table places
  add column if not exists source_kind text not null default 'ai'
    check (source_kind in ('ai', 'manual'));

alter table places
  add column if not exists inferred_city text;

-- ---- Part 2: extraction_costs table ------------------------------------------

create table extraction_costs (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references links(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'google_places')),
  model text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  duration_ms int,
  created_at timestamptz not null default now()
);

alter table extraction_costs enable row level security;

-- No permissive policies: only service role (Edge Functions) can read/write.

-- ---- Part 3: indexes ---------------------------------------------------------

create index extraction_costs_link_idx on extraction_costs (link_id);
create index extraction_costs_created_idx on extraction_costs (created_at desc);
