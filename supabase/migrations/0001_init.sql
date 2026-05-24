-- =============================================================================
-- MOAJOA initial schema
-- =============================================================================
-- Tables:
--   profiles        public mirror of auth.users
--   boards          travel boards (private/shared/public)
--   memberships    members of shared boards (owner/editor/voter)
--   links           source URLs added to a board (youtube/blog/instagram/manual)
--   places          map pins (extracted or manually added)
--   votes           love votes from members on places
--
-- Conventions:
--   - UUIDs everywhere (gen_random_uuid via pgcrypto)
--   - TIMESTAMPTZ for all time columns
--   - TEXT with CHECK for enum-like columns (matches @moajoa/core constants)
--   - RLS strict: deny by default, explicit policy per role
--   - SECURITY DEFINER RPCs only for public board view (unauth read)
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
-- profiles
-- =============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  locale text not null default 'ko' check (locale in ('ko','ja','en')),
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

-- =============================================================================
-- boards
-- =============================================================================
create table boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 280),
  visibility text not null default 'private'
    check (visibility in ('private','shared','public')),
  share_slug text unique check (char_length(share_slug) between 8 and 32),
  city_code text check (char_length(city_code) <= 20),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boards_owner_idx on boards (owner_id, updated_at desc);
create index boards_share_slug_idx on boards (share_slug) where share_slug is not null;
create index boards_visibility_public_idx on boards (id) where visibility = 'public';

create trigger boards_updated_at
  before update on boards
  for each row execute function set_updated_at();

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

create trigger boards_share_slug_before_insert
  before insert on boards
  for each row execute function ensure_share_slug();

create trigger boards_share_slug_before_update
  before update of visibility on boards
  for each row execute function ensure_share_slug();

alter table boards enable row level security;

-- Owner has full access.
create policy "boards: owner full access"
  on boards for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Members of shared boards can read.
create policy "boards: shared members can read"
  on boards for select
  to authenticated
  using (
    visibility in ('shared','public')
    and exists (
      select 1 from memberships m
      where m.board_id = boards.id and m.user_id = auth.uid() and m.accepted_at is not null
    )
  );

-- Public boards readable by anyone *via the public_board_view RPC* (RLS bypass).
-- Direct table SELECT not allowed for anon — keeps schema details private.

-- =============================================================================
-- memberships
-- =============================================================================
create table memberships (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','voter')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create index memberships_user_idx on memberships (user_id, accepted_at);
create index memberships_board_idx on memberships (board_id);

alter table memberships enable row level security;

create policy "memberships: read own + board owner can read all"
  on memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from boards b where b.id = memberships.board_id and b.owner_id = auth.uid()
    )
  );

create policy "memberships: board owner can insert"
  on memberships for insert
  to authenticated
  with check (
    exists (select 1 from boards b where b.id = memberships.board_id and b.owner_id = auth.uid())
  );

create policy "memberships: user can accept own invite"
  on memberships for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memberships: board owner or self can delete"
  on memberships for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from boards b where b.id = memberships.board_id and b.owner_id = auth.uid())
  );

-- =============================================================================
-- links
-- =============================================================================
create table links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
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
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (board_id, source_kind, external_id)
);

create index links_board_idx on links (board_id, created_at desc);
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

-- Helper: can the current user read a board?
create or replace function can_read_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from boards b
    where b.id = p_board_id
    and (
      b.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.board_id = b.id and m.user_id = auth.uid() and m.accepted_at is not null
      )
    )
  );
$$;

create or replace function can_edit_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from boards b
    where b.id = p_board_id
    and (
      b.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.board_id = b.id
          and m.user_id = auth.uid()
          and m.accepted_at is not null
          and m.role in ('owner','editor')
      )
    )
  );
$$;

create or replace function can_vote_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from boards b
    where b.id = p_board_id
    and (
      b.owner_id = auth.uid()
      or exists (
        select 1 from memberships m
        where m.board_id = b.id and m.user_id = auth.uid() and m.accepted_at is not null
      )
    )
  );
$$;

create policy "links: read if can read board"
  on links for select
  to authenticated
  using (can_read_board(board_id));

create policy "links: insert if can edit board"
  on links for insert
  to authenticated
  with check (can_edit_board(board_id));

create policy "links: delete if added_by self or board owner"
  on links for delete
  to authenticated
  using (
    added_by = auth.uid()
    or exists (select 1 from boards b where b.id = links.board_id and b.owner_id = auth.uid())
  );

-- =============================================================================
-- places
-- =============================================================================
create table places (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
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
  source_timestamp_sec int check (source_timestamp_sec >= 0),
  source_quote text check (char_length(source_quote) <= 500),
  note text check (char_length(note) <= 500),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (board_id, google_place_id)
);

create index places_board_idx on places (board_id) where hidden_at is null;
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

create policy "places: read if can read board"
  on places for select
  to authenticated
  using (can_read_board(board_id));

create policy "places: insert if can edit board"
  on places for insert
  to authenticated
  with check (can_edit_board(board_id));

create policy "places: update if can edit board"
  on places for update
  to authenticated
  using (can_edit_board(board_id))
  with check (can_edit_board(board_id));

create policy "places: delete if added_by self or board owner"
  on places for delete
  to authenticated
  using (
    added_by = auth.uid()
    or exists (select 1 from boards b where b.id = places.board_id and b.owner_id = auth.uid())
  );

-- =============================================================================
-- votes
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

create policy "votes: read if can read board"
  on votes for select
  to authenticated
  using (
    exists (
      select 1 from places p
      where p.id = votes.place_id and can_read_board(p.board_id)
    )
  );

create policy "votes: insert if can vote in board"
  on votes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from places p
      where p.id = votes.place_id and can_vote_board(p.board_id)
    )
  );

create policy "votes: delete own"
  on votes for delete
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- RPCs
-- =============================================================================

-- Aggregated love counts for a batch of places (returns rows).
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

-- Public board view by slug — anon-readable but only for visibility='public'.
create or replace function public_board_view(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_board boards%rowtype;
  v_owner profiles%rowtype;
  v_result jsonb;
begin
  select * into v_board from boards
  where share_slug = p_slug and visibility = 'public'
  limit 1;

  if not found then return null; end if;

  select * into v_owner from profiles where id = v_board.owner_id;

  v_result := jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board.id,
      'title', v_board.title,
      'description', v_board.description,
      'city_code', v_board.city_code,
      'cover_image_url', v_board.cover_image_url,
      'updated_at', v_board.updated_at
    ),
    'owner_display_name', coalesce(v_owner.display_name, 'MOAJOA user'),
    'links', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'source_kind', l.source_kind,
        'url', l.url,
        'title', l.title,
        'thumbnail_url', l.thumbnail_url,
        'author_name', l.author_name
      ) order by l.created_at desc)
      from links l where l.board_id = v_board.id and l.extraction_status = 'ready'),
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
        'source_timestamp_sec', p.source_timestamp_sec
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_board_view(text) to authenticated, anon;

-- Add a manual place via Google Places ID. Server-side proxies the Places API
-- so client cannot forge coordinates.
--
-- NOTE: Actual Places API call lives in an Edge Function (resolve-place).
-- This RPC writes the resolved data the function returns.
create or replace function add_manual_place(
  p_board_id uuid,
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
  if not can_edit_board(p_board_id) then
    raise exception 'permission denied: cannot edit board';
  end if;

  -- For now we trust the caller-provided fields; once the resolve-place Edge
  -- Function exists, it'll be the only legit caller and will populate from
  -- Google Places API server-side.
  insert into places (
    board_id, link_id, added_by,
    google_place_id, name_local, name_ko, name_en,
    lat, lng, category, address, note
  ) values (
    p_board_id, null, auth.uid(),
    p_google_place_id,
    coalesce(p_name_local, p_google_place_id),
    p_name_ko, p_name_en,
    coalesce(p_lat, 0), coalesce(p_lng, 0),
    p_category, p_address, p_note
  )
  on conflict (board_id, google_place_id) do update
    set note = excluded.note,
        hidden_at = null
  returning * into v_place;

  return v_place;
end;
$$;

grant execute on function add_manual_place(
  uuid, text, text, text, text, text, double precision, double precision, text, text
) to authenticated;
