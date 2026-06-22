-- 0017_plans.sql — Phase 18 Auto Plan (PLAN-01..05, CONTEXT D-12/D-14).
-- plans + plan_items. RLS REUSES 0016 can_read_trip/can_edit_trip DEFINER helpers
-- (no new direct cross-table EXISTS — 42P17 recursion guard, CLAUDE.md §4.4).
-- Append-only: 0016 is NEVER modified.

-- ---- plans ------------------------------------------------------------------
create table plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  status text not null default 'draft' check (status in ('generating', 'draft')),
  travel_mode text not null default 'transit' check (travel_mode in ('transit', 'walk', 'drive')),
  collaborative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One draft plan per trip (Open Q4 / D-11 overwrite). Partial unique mirrors places_trip_idx.
create unique index plans_one_draft_per_trip on plans (trip_id) where status = 'draft';
create index plans_trip_idx on plans (trip_id);

-- set_updated_at() already defined in 0016 (L38-46) — reuse, do not redefine.
create trigger plans_set_updated_at
  before update on plans
  for each row execute function set_updated_at();

alter table plans enable row level security;
create policy "plans: read if can read trip"  on plans for select to authenticated using (can_read_trip(trip_id));
create policy "plans: insert if can edit trip" on plans for insert to authenticated with check (can_edit_trip(trip_id));
create policy "plans: update if can edit trip" on plans for update to authenticated using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));
create policy "plans: delete if can edit trip" on plans for delete to authenticated using (can_edit_trip(trip_id));

-- ---- plan_items -------------------------------------------------------------
create table plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  day_index int not null check (day_index >= 0),
  sort_order int not null check (sort_order >= 0),
  leg_travel_seconds int check (leg_travel_seconds is null or leg_travel_seconds >= 0),
  is_anchor boolean not null default false,
  created_at timestamptz not null default now(),
  unique (plan_id, place_id)
);

create index plan_items_plan_idx on plan_items (plan_id);
create index plan_items_place_idx on plan_items (place_id);

alter table plan_items enable row level security;
-- Route through the parent plan's trip_id. The inner can_*_trip call IS the
-- DEFINER boundary, so this EXISTS is the one permitted shape (votes→places idiom, 0016 L529).
create policy "plan_items: read if can read trip" on plan_items for select to authenticated
  using (exists (select 1 from plans p where p.id = plan_items.plan_id and can_read_trip(p.trip_id)));
create policy "plan_items: insert if can edit trip" on plan_items for insert to authenticated
  with check (exists (select 1 from plans p where p.id = plan_items.plan_id and can_edit_trip(p.trip_id)));
create policy "plan_items: update if can edit trip" on plan_items for update to authenticated
  using (exists (select 1 from plans p where p.id = plan_items.plan_id and can_edit_trip(p.trip_id)))
  with check (exists (select 1 from plans p where p.id = plan_items.plan_id and can_edit_trip(p.trip_id)));
create policy "plan_items: delete if can edit trip" on plan_items for delete to authenticated
  using (exists (select 1 from plans p where p.id = plan_items.plan_id and can_edit_trip(p.trip_id)));

-- ---- extraction_costs: allow Routes provider (additive, D-12) ----------------
-- 0016 L564 defines provider check (provider in ('anthropic', 'google_places')).
-- Extend additively for the Routes legs cost attribution (provider 'google_routes').
alter table extraction_costs drop constraint extraction_costs_provider_check;
alter table extraction_costs add constraint extraction_costs_provider_check
  check (provider in ('anthropic', 'google_places', 'google_routes'));
