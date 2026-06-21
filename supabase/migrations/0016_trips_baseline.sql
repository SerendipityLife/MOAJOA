-- =============================================================================
-- MOAJOA 0016 — trips-native squash baseline (D-03, one-time append-only override)
-- =============================================================================
-- This single file reproduces the ENTIRE current schema with `boards` renamed to
-- `trips` and a new `representative_id` column. It is the deliberate, one-time
-- override of CLAUDE.md §4.3 append-only (D-03); after this, append-only resumes.
--
-- It folds migrations 0001–0014:
--   0001 init (tables, triggers, RPCs, can_* helpers, geog col/index, add_manual_place)
--   0002 RLS recursion fix (am_*_owner / am_*_member canonical DEFINER bodies)
--   0003 owner_id default auth.uid()
--   0004 places.source_kind + places.inferred_city + extraction_costs table
--   0005 extraction_costs.link_id nullable
--   0006 places.confidence + public view confidence/source_kind append
--        (profiles auto-first-board trigger + backfill INTENTIONALLY NOT folded)
--   0007 trips start_date / end_date
--   0008 links.summary_ko + places.summary_ko (+ public view append)
--   0009 join_shared_* + accepted_member_count + public view shared-slug broaden
--   0010 links.extraction_started_at
--   0011 accepted_member_count includes owner (+1)
--   0012 votes UPDATE policy + join owner self-join guard
--   0013 public view place detail (google_place_id + address — LATEST view body)
--   0014 profiles gender / birthday
--
-- NOTE: there is no 0015 in the active migration set (the WIP signature_menu
-- migration was discarded), so no signature_menu column is folded here.
--
-- Cross-table RLS checks go EXCLUSIVELY through SECURITY DEFINER helpers with
-- `set search_path = public` — never a direct EXISTS against another table —
-- to avoid the 42P17 recursion that 0002 fixed (Pitfall 3, CLAUDE.md §4.4).
-- =============================================================================

-- ---- Extensions ------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ---- Reusable trigger: updated_at ------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- profiles  (0001 base + 0014 gender/birthday)
-- =============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  locale text not null default 'ko' check (locale in ('ko','ja','en')),
  gender text check (gender in ('male', 'female', 'other')),  -- 0014
  birthday date,                                              -- 0014
  created_at timestamptz not null default now()
);

create index profiles_email_idx on profiles (email);

alter table profiles enable row level security;

create policy "profiles: read all authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles: update own"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create profile row when a new auth user signs up.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email,'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- (ONBOARD-01) auto "내 첫 여행" signup trigger intentionally NOT ported: the
-- onboarding "정해짐" path (Plan 05) owns first-trip creation so decideEntryRoute
-- keeps a reachable 0-trip → onboarding branch (NAV-01, D-11). Porting an auto
-- first-trip insert here would give every new signup exactly 1 trip, permanently
-- hiding the onboarding branch and failing Plan 04 Task 4 UAT scenario 1. The
-- 0006 profiles backfill is likewise omitted (squash wipes data — nothing to
-- backfill; new accounts get 0 trips by design).

-- =============================================================================
-- trips  (renamed from boards; 0001 base + 0003 owner default + 0007 dates
--         + representative_id NEW)
-- =============================================================================
create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references profiles(id) on delete cascade,  -- 0003 default
  representative_id uuid references profiles(id) on delete set null,  -- NEW (D-10, SETUP-02)
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 280),
  visibility text not null default 'private'
    check (visibility in ('private','shared','public')),
  share_slug text unique check (char_length(share_slug) between 8 and 32),
  city_code text check (char_length(city_code) <= 20),
  start_date date,                          -- 0007
  end_date date,                            -- 0007
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_owner_idx on trips (owner_id, updated_at desc);
create index trips_share_slug_idx on trips (share_slug) where share_slug is not null;
create index trips_visibility_public_idx on trips (id) where visibility = 'public';

create trigger trips_updated_at
  before update on trips
  for each row execute function set_updated_at();

-- representative_id auto-set (D-10, SETUP-02) — modeled on links_default_added_by.
-- Defaults the representative to the creating user when the client omits it.
create or replace function trips_default_representative()
returns trigger language plpgsql as $$
begin
  new.representative_id := coalesce(new.representative_id, auth.uid());
  return new;
end;
$$;

create trigger trips_representative_default
  before insert on trips
  for each row execute function trips_default_representative();

-- Generate a random share_slug whenever visibility becomes 'public' or 'shared'
-- and one isn't already set.
create or replace function ensure_share_slug()
returns trigger
language plpgsql
as $$
begin
  if (new.visibility in ('public','shared')) and (new.share_slug is null) then
    -- 12 chars from base32-ish alphabet, ~60 bits of entropy
    new.share_slug := lower(translate(encode(gen_random_bytes(8), 'base64'), '+/=', 'abc'));
    new.share_slug := substr(regexp_replace(new.share_slug, '[^a-z0-9]', '', 'g'), 1, 12);
    -- Ensure minimum length even after stripping
    if char_length(new.share_slug) < 8 then
      new.share_slug := new.share_slug || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.share_slug));
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_share_slug_before_insert
  before insert on trips
  for each row execute function ensure_share_slug();

create trigger trips_share_slug_before_update
  before update of visibility on trips
  for each row execute function ensure_share_slug();

alter table trips enable row level security;

-- Owner has full access.
create policy "trips: owner full access"
  on trips for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Public trips readable by anyone *via the public_trip_view RPC* (RLS bypass).
-- Direct table SELECT not allowed for anon — keeps schema details private.

-- =============================================================================
-- memberships  (0001 base + 0002 helper-only policies)
-- =============================================================================
create table memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','voter')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index memberships_user_idx on memberships (user_id, accepted_at);
create index memberships_trip_idx on memberships (trip_id);

alter table memberships enable row level security;

-- ---- Cross-table RLS helpers (0002 canonical DEFINER bodies, trip-renamed) --
-- Never a direct EXISTS against another table inside a policy — these DEFINER
-- helpers run as owner (BYPASSRLS) and each references exactly one other table,
-- so no 42P17 recursion (Pitfall 3, CLAUDE.md §4.4).

create or replace function am_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from trips
    where id = p_trip_id and owner_id = auth.uid()
  );
$$;

grant execute on function am_trip_owner(uuid) to authenticated;

create or replace function am_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from memberships
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and accepted_at is not null
  );
$$;

grant execute on function am_trip_member(uuid) to authenticated;

create policy "memberships: read own + trip owner can read all"
  on memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or am_trip_owner(trip_id)
  );

create policy "memberships: trip owner can insert"
  on memberships for insert
  to authenticated
  with check (am_trip_owner(trip_id));

create policy "memberships: user can accept own invite"
  on memberships for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memberships: trip owner or self can delete"
  on memberships for delete
  to authenticated
  using (
    user_id = auth.uid()
    or am_trip_owner(trip_id)
  );

-- Now that memberships + am_trip_member exist: shared/public trip read policy.
create policy "trips: shared members can read"
  on trips for select
  to authenticated
  using (
    visibility in ('shared','public')
    and am_trip_member(id)
  );

-- =============================================================================
-- can_* read/edit/vote helpers (0001:263-324, trip-renamed)
-- =============================================================================
create or replace function can_read_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    where t.id = p_trip_id
    and (
      t.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.trip_id = t.id and m.user_id = auth.uid() and m.accepted_at is not null
      )
    )
  );
$$;

grant execute on function can_read_trip(uuid) to authenticated;

create or replace function can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    where t.id = p_trip_id
    and (
      t.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.trip_id = t.id
          and m.user_id = auth.uid()
          and m.accepted_at is not null
          and m.role in ('owner','editor')
      )
    )
  );
$$;

grant execute on function can_edit_trip(uuid) to authenticated;

create or replace function can_vote_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    where t.id = p_trip_id
    and (
      t.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.trip_id = t.id and m.user_id = auth.uid() and m.accepted_at is not null
      )
    )
  );
$$;

grant execute on function can_vote_trip(uuid) to authenticated;

-- =============================================================================
-- links  (0001 base + 0008 summary_ko + 0010 extraction_started_at)
-- =============================================================================
create table links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  added_by uuid not null references profiles(id) on delete restrict,
  source_kind text not null check (source_kind in ('youtube','blog','instagram','manual')),
  url text not null,
  original_url text not null,
  title text,
  thumbnail_url text,
  author_name text,
  external_id text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending','processing','ready','failed','manual_review')),
  extraction_error text,
  extraction_confidence numeric(3,2) check (extraction_confidence between 0 and 1),
  extraction_started_at timestamptz,    -- 0010
  extracted_at timestamptz,
  summary_ko text,                       -- 0008 (EXTRACT-13)
  created_at timestamptz not null default now(),
  unique (trip_id, source_kind, external_id)
);

create index links_trip_idx on links (trip_id, created_at desc);
create index links_extraction_status_idx on links (extraction_status)
  where extraction_status in ('pending','processing','manual_review');

-- Default added_by to auth.uid() if not specified.
create or replace function links_default_added_by()
returns trigger language plpgsql as $$
begin
  if new.added_by is null then new.added_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger links_added_by_default
  before insert on links
  for each row execute function links_default_added_by();

alter table links enable row level security;

create policy "links: read if can read trip"
  on links for select
  to authenticated
  using (can_read_trip(trip_id));

create policy "links: insert if can edit trip"
  on links for insert
  to authenticated
  with check (can_edit_trip(trip_id));

create policy "links: delete if added_by self or trip owner"
  on links for delete
  to authenticated
  using (
    added_by = auth.uid()
    or am_trip_owner(trip_id)
  );

-- =============================================================================
-- places  (0001 base + 0004 source_kind/inferred_city + 0006 confidence
--          + 0008 summary_ko + PostGIS geog generated col/index)
-- =============================================================================
create table places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  link_id uuid references links(id) on delete cascade,
  added_by uuid not null references profiles(id) on delete restrict,
  google_place_id text,
  name_local text not null check (char_length(name_local) between 1 and 200),
  name_ko text check (char_length(name_ko) <= 200),
  name_en text check (char_length(name_en) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog geography(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  category text check (char_length(category) <= 60),
  address text check (char_length(address) <= 500),
  source_kind text not null default 'ai'                       -- 0004
    check (source_kind in ('ai', 'manual')),
  inferred_city text,                                          -- 0004 (EXTRACT-03)
  confidence numeric(3,2)                                      -- 0006 (D-01, TRUST-04)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_timestamp_sec int check (source_timestamp_sec >= 0),
  source_quote text check (char_length(source_quote) <= 500),
  note text check (char_length(note) <= 500),
  summary_ko text,                                            -- 0008 (EXTRACT-12)
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, google_place_id)
);

create index places_trip_idx on places (trip_id) where hidden_at is null;
create index places_link_idx on places (link_id) where hidden_at is null;
create index places_geog_idx on places using gist (geog);

create or replace function places_default_added_by()
returns trigger language plpgsql as $$
begin
  if new.added_by is null then new.added_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger places_added_by_default
  before insert on places
  for each row execute function places_default_added_by();

alter table places enable row level security;

create policy "places: read if can read trip"
  on places for select
  to authenticated
  using (can_read_trip(trip_id));

create policy "places: insert if can edit trip"
  on places for insert
  to authenticated
  with check (can_edit_trip(trip_id));

create policy "places: update if can edit trip"
  on places for update
  to authenticated
  using (can_edit_trip(trip_id))
  with check (can_edit_trip(trip_id));

create policy "places: delete if added_by self or trip owner"
  on places for delete
  to authenticated
  using (
    added_by = auth.uid()
    or am_trip_owner(trip_id)
  );

-- =============================================================================
-- votes  (0001 base + 0012 UPDATE policy)
-- =============================================================================
create table votes (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'love' check (kind in ('love')),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  unique (place_id, user_id, kind)
);

create index votes_place_idx on votes (place_id);
create index votes_user_idx on votes (user_id);

create or replace function votes_default_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end;
$$;

create trigger votes_user_id_default
  before insert on votes
  for each row execute function votes_default_user_id();

alter table votes enable row level security;

create policy "votes: read if can read trip"
  on votes for select
  to authenticated
  using (
    exists (
      select 1 from places p
      where p.id = votes.place_id and can_read_trip(p.trip_id)
    )
  );

create policy "votes: insert if can vote in trip"
  on votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from places p
      where p.id = votes.place_id and can_vote_trip(p.trip_id)
    )
  );

create policy "votes: update own"      -- 0012
  on votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "votes: delete own"
  on votes for delete
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- extraction_costs  (0004 table + 0005 link_id nullable)
-- =============================================================================
create table extraction_costs (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references links(id) on delete cascade,   -- 0005: nullable (resolve-place has no link)
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

create index extraction_costs_link_idx
  on extraction_costs (link_id)
  where link_id is not null;                              -- 0005 partial index
create index extraction_costs_created_idx on extraction_costs (created_at desc);

-- =============================================================================
-- booking_clicks  (D-07, Open Q2 — empty table for Phase 20; deny-by-default)
-- =============================================================================
-- FK + RLS shape modeled on votes (0001). Owner-read only this phase: there is
-- NO INSERT path until Phase 20 (the affiliate redirect Edge Function mints rows
-- with the service role, bypassing RLS). No anon access.
create table booking_clicks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  created_at timestamptz not null default now()
);

create index booking_clicks_trip_idx on booking_clicks (trip_id);
create index booking_clicks_user_idx on booking_clicks (user_id);

alter table booking_clicks enable row level security;

-- Trip owner can read their trip's booking clicks (analytics). No INSERT policy
-- this phase — minting happens service-role-side in Phase 20.
create policy "booking_clicks: trip owner can read"
  on booking_clicks for select
  to authenticated
  using (am_trip_owner(trip_id));

-- =============================================================================
-- RPCs
-- =============================================================================

-- Aggregated love counts for a batch of places (0001).
create or replace function vote_counts_for_places(p_place_ids uuid[])
returns table(place_id uuid, love_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.place_id, count(*) as love_count
  from votes v
  where v.place_id = any(p_place_ids) and v.kind = 'love'
  group by v.place_id;
$$;

grant execute on function vote_counts_for_places(uuid[]) to authenticated, anon;

-- Bearer-invite self-join (0009 + 0012 owner self-join guard, trip-renamed).
-- DEFINER write — grants a NEW right. role hard-coded 'voter' (no escalation),
-- user_id = auth.uid() (join as self only), on conflict do nothing (idempotent).
create or replace function join_shared_trip(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
begin
  select id, owner_id into v_trip_id, v_owner_id
  from trips
  where share_slug = p_share_slug
    and visibility in ('shared','public')
  limit 1;

  if v_trip_id is null then
    raise exception 'trip not found or not shared';
  end if;

  -- Owner is implicitly a member (counted via accepted_member_count's +1).
  -- Inserting a voter row for them would double-count the denominator (0012 guard).
  if v_owner_id = auth.uid() then
    return v_trip_id;
  end if;

  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(), 'voter', now())
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

grant execute on function join_shared_trip(text) to authenticated;

-- 확정 denominator (0011 includes-owner variant, trip-renamed). Anon-grantable.
create or replace function accepted_member_count(p_trip_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  -- +1 = the trip owner, who never has a memberships row.
  select count(*) + 1
  from memberships
  where trip_id = p_trip_id
    and accepted_at is not null;
$$;

grant execute on function accepted_member_count(uuid) to authenticated, anon;

-- Public trip view by slug — anon-readable for visibility in ('public','shared').
-- Body is the LATEST 0013 version (has google_place_id + address on places),
-- trip-renamed. Every selected place field is backed by a folded column:
-- source_kind/inferred_city (0004), confidence (0006), summary_ko (0008),
-- google_place_id/address (0001/0013).
create or replace function public_trip_view(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_owner profiles%rowtype;
  v_result jsonb;
begin
  select * into v_trip from trips
  where share_slug = p_slug and visibility in ('public','shared')
  limit 1;

  if not found then return null; end if;

  select * into v_owner from profiles where id = v_trip.owner_id;

  v_result := jsonb_build_object(
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'title', v_trip.title,
      'description', v_trip.description,
      'city_code', v_trip.city_code,
      'cover_image_url', v_trip.cover_image_url,
      'updated_at', v_trip.updated_at
    ),
    'owner_display_name', coalesce(v_owner.display_name, 'MOAJOA user'),
    'links', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'source_kind', l.source_kind,
        'url', l.url,
        'title', l.title,
        'thumbnail_url', l.thumbnail_url,
        'author_name', l.author_name,
        'summary_ko', l.summary_ko
      ) order by l.created_at desc)
      from links l where l.trip_id = v_trip.id and l.extraction_status = 'ready'),
      '[]'::jsonb
    ),
    'places', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'link_id', p.link_id,
        'name_local', p.name_local,
        'name_ko', p.name_ko,
        'name_en', p.name_en,
        'lat', p.lat,
        'lng', p.lng,
        'category', p.category,
        'source_timestamp_sec', p.source_timestamp_sec,
        'source_kind', p.source_kind,
        'confidence', p.confidence,
        'summary_ko', p.summary_ko,
        'google_place_id', p.google_place_id,
        'address', p.address
      ) order by p.created_at)
      from places p where p.trip_id = v_trip.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_trip_view(text) to authenticated, anon;

-- Add a manual place via Google Places ID (0001, trip-renamed). Server-side
-- proxies the Places API so the client cannot forge coordinates. The resolved
-- data is written by the resolve-place Edge Function (its only legit caller).
create or replace function add_manual_place(
  p_trip_id uuid,
  p_google_place_id text,
  p_note text default null,
  p_name_local text default null,
  p_name_ko text default null,
  p_name_en text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_category text default null,
  p_address text default null
)
returns places
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_place places;
begin
  if not can_edit_trip(p_trip_id) then
    raise exception 'permission denied: cannot edit trip';
  end if;

  insert into places (
    trip_id, link_id, added_by,
    google_place_id, name_local, name_ko, name_en,
    lat, lng, category, address, note
  ) values (
    p_trip_id, null, auth.uid(),
    p_google_place_id,
    coalesce(p_name_local, p_google_place_id),
    p_name_ko, p_name_en,
    coalesce(p_lat, 0), coalesce(p_lng, 0),
    p_category, p_address, p_note
  )
  on conflict (trip_id, google_place_id) do update
    set note = excluded.note,
        hidden_at = null
  returning * into v_place;

  return v_place;
end;
$$;

grant execute on function add_manual_place(
  uuid, text, text, text, text, text, double precision, double precision, text, text
) to authenticated;
