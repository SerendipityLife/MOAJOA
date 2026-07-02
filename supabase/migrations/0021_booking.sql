-- 0021_booking.sql — Phase 20 Affiliate Booking (BOOK-02, ATTR-02; CONTEXT D-10/D-11/D-12/D-13).
-- booking_checklist_items (trip-scoped checklist) + booking_clicks click-token columns and
-- member INSERT/SELECT policies. RLS REUSES 0016 can_read_trip/can_edit_trip DEFINER helpers
-- called directly (this table carries trip_id itself, so no cross-table subquery is needed
-- at all — 42P17 recursion guard, CLAUDE.md §4.4).
-- NO FK to plans/plan_items under any column name: the generate-plan draft overwrite
-- (delete→insert, 0017 idiom) would destroy checked rows on every regeneration and violate
-- D-13 (money-spent records survive). Reference is trip_id + place_id only (RESEARCH Pitfall 3).
-- Append-only: 0016..0020 are NEVER modified.

-- ---- booking_checklist_items -------------------------------------------------
-- Enum CHECKs are locked character-for-character to @moajoa/core ChecklistItemSchema (20-03).
create table booking_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  kind text not null check (kind in ('stay', 'esim', 'transport', 'activity', 'custom')),
  title text not null check (char_length(title) between 1 and 80),
  -- D-11 three-state: todo → clicked ('확인함', auto via booking_clicks) → done (user check).
  status text not null default 'todo' check (status in ('todo', 'clicked', 'done')),
  -- D-10: auto = derived from the plan draft; manual = user-added free-text item.
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checklist_trip_idx on booking_checklist_items (trip_id);

-- Auto-item dedup (plans_one_draft_per_trip partial-unique idiom, 0017 L18):
-- singletons key on (trip_id, kind); activity rows key on (trip_id, place_id).
-- manual rows are exempt (source gate) — users may add duplicates freely (D-10).
create unique index checklist_singleton_uq on booking_checklist_items (trip_id, kind)
  where source = 'auto' and kind in ('stay', 'esim', 'transport');
create unique index checklist_place_uq on booking_checklist_items (trip_id, place_id)
  where source = 'auto' and place_id is not null;

-- set_updated_at() already defined in 0016 (L38-46) — reuse, do not redefine.
create trigger booking_checklist_items_set_updated_at
  before update on booking_checklist_items
  for each row execute function set_updated_at();

alter table booking_checklist_items enable row level security;
-- D-12: every trip member with edit rights can manage the checklist (shared booking reality).
-- No representative-only gate. All four policies call the DEFINER helpers directly.
create policy "booking_checklist_items: read if can read trip"
  on booking_checklist_items for select to authenticated
  using (can_read_trip(trip_id));
create policy "booking_checklist_items: insert if can edit trip"
  on booking_checklist_items for insert to authenticated
  with check (can_edit_trip(trip_id));
create policy "booking_checklist_items: update if can edit trip"
  on booking_checklist_items for update to authenticated
  using (can_edit_trip(trip_id))
  with check (can_edit_trip(trip_id));
create policy "booking_checklist_items: delete if can edit trip"
  on booking_checklist_items for delete to authenticated
  using (can_edit_trip(trip_id));

-- ---- booking_clicks: token + attribution (0016 L582-606 original untouched) ---
-- New columns are NULLABLE (CLAUDE.md §4.3 downtime avoidance). Regex mirrors the
-- 17-02 ClickTokenSchema contract exactly.
alter table booking_clicks add column click_token text
  check (click_token ~ '^c_[0-9A-Za-z]{8,30}$');
alter table booking_clicks add column checklist_item_id uuid
  references booking_checklist_items(id) on delete set null;

-- 0016 shipped owner-read only with NO insert path. Phase 20 logs clicks client-side
-- (fire-and-forget, D-14) so members need INSERT — but only in their own name and only
-- on trips they can read (T-20-02 spoofing guard, RESEARCH Pitfall 4).
create policy "booking_clicks: member can insert own"
  on booking_clicks for insert to authenticated
  with check (user_id = auth.uid() and can_read_trip(trip_id));

-- D-11/D-12: the '확인함' transition reacts to ANY member's click, so members must be
-- able to read each other's clicks. Sits permissively alongside the 0016 owner-read policy.
create policy "booking_clicks: member can read"
  on booking_clicks for select to authenticated
  using (can_read_trip(trip_id));

create index booking_clicks_checklist_item_idx on booking_clicks (checklist_item_id)
  where checklist_item_id is not null;
