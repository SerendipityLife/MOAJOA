-- 0018_date_polls.sql — Phase 19 Date Voting (POLL-01..03, CONTEXT D-01..D-11).
-- date_polls + date_poll_options + date_votes + date_comments. RLS REUSES 0016
-- am_trip_owner/can_edit_trip/can_read_trip DEFINER helpers (no new direct
-- cross-table EXISTS — 42P17 recursion guard, CLAUDE.md §4.4). Anon writes go
-- through SECURITY DEFINER RPCs granted to anon (code=bearer). Append-only: 0016/0017 NEVER modified.

-- =============================================================================
-- (A) Tables — date_polls / date_poll_options / date_votes / date_comments
-- =============================================================================

create table if not exists date_polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  poll_code text unique,
  mode text not null check (mode in ('range', 'grid')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index date_polls_trip_id_idx on date_polls (trip_id);

create table if not exists date_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references date_polls(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index date_poll_options_poll_id_idx on date_poll_options (poll_id);

create table if not exists date_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references date_polls(id) on delete cascade,
  device_token text not null,
  nickname text not null,
  option_id uuid references date_poll_options(id) on delete cascade,  -- range mode
  vote_date date,                                                      -- grid mode
  availability text not null default 'available' check (availability in ('available', 'unavailable')),
  created_at timestamptz not null default now()
);
-- Pitfall 4 dedup: PG17 NULLS NOT DISTINCT so per-mode nullable cols dedup cleanly.
create unique index date_votes_dedup
  on date_votes (poll_id, device_token, option_id, vote_date) nulls not distinct;

create table if not exists date_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references date_polls(id) on delete cascade,
  device_token text not null,
  nickname text not null,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now()
);
create index date_comments_poll_id_idx on date_comments (poll_id, created_at);

-- =============================================================================
-- (B) updated_at trigger — REUSE 0016 set_updated_at() (do NOT redefine; 0017 L21-24).
-- =============================================================================
create trigger date_polls_set_updated_at
  before update on date_polls for each row execute function set_updated_at();

-- =============================================================================
-- (C) ensure_poll_code trigger — mirror 0016 ensure_share_slug entropy idiom
-- (L165-169), renamed share_slug→poll_code. Independent code (NOT slug-derived):
-- the anon bearer scope is separate from the authenticated trip-sharing slug,
-- so closing the poll revokes anon writes without touching trip sharing.
-- =============================================================================
create or replace function ensure_poll_code()
returns trigger language plpgsql as $$
begin
  if new.poll_code is null then
    new.poll_code := lower(translate(encode(gen_random_bytes(8), 'base64'), '+/=', 'abc'));
    new.poll_code := substr(regexp_replace(new.poll_code, '[^a-z0-9]', '', 'g'), 1, 12);
    if char_length(new.poll_code) < 8 then
      new.poll_code := new.poll_code || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.poll_code));
    end if;
  end if;
  return new;
end; $$;

create trigger date_polls_code_before_insert
  before insert on date_polls for each row execute function ensure_poll_code();

-- =============================================================================
-- (D) RLS — enable (deny-by-default) + authenticated host policies.
-- Cross-table checks route ONLY through existing can_*_trip DEFINER helpers
-- (42P17 guard, Pitfall 5). The parent-table EXISTS wraps an inner can_*_trip
-- DEFINER call — the votes→places permitted shape (0016 L526-534).
-- Anon writes go through SECURITY DEFINER RPCs ONLY — NO anon INSERT policy,
-- NO anon grant on any of these four tables.
-- =============================================================================
alter table date_polls enable row level security;
alter table date_poll_options enable row level security;
alter table date_votes enable row level security;
alter table date_comments enable row level security;

-- date_polls: read by trip-readers, write by trip-editors (helpers are the DEFINER boundary).
create policy date_polls_read on date_polls for select to authenticated
  using (can_read_trip(trip_id));
create policy date_polls_write on date_polls for all to authenticated
  using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));

-- date_poll_options: route through parent poll's trip_id via the can_*_trip DEFINER helper.
create policy date_poll_options_read on date_poll_options for select to authenticated
  using (exists (select 1 from date_polls p where p.id = date_poll_options.poll_id and can_read_trip(p.trip_id)));
create policy date_poll_options_write on date_poll_options for all to authenticated
  using (exists (select 1 from date_polls p where p.id = date_poll_options.poll_id and can_edit_trip(p.trip_id)))
  with check (exists (select 1 from date_polls p where p.id = date_poll_options.poll_id and can_edit_trip(p.trip_id)));

-- date_votes / date_comments: authenticated host READ only (raw rows). Anon writes
-- via DEFINER RPC ONLY — NO anon INSERT policy, NO anon grant on the table.
create policy date_votes_read on date_votes for select to authenticated
  using (exists (select 1 from date_polls p where p.id = date_votes.poll_id and can_read_trip(p.trip_id)));
create policy date_comments_read on date_comments for select to authenticated
  using (exists (select 1 from date_polls p where p.id = date_comments.poll_id and can_read_trip(p.trip_id)));

-- =============================================================================
-- (E) Anon-write RPCs — THE NEW SECURITY SURFACE. Mirror join_shared_trip
-- (0016 L631-665): validate bearer code → controlled write → DEFINER. Derive
-- everything from the validated code; NEVER trust client trip_id/poll_id.
-- grant ... to authenticated, anon (anon-grant idiom 0016 L626).
-- =============================================================================

-- cast_date_vote (RESEARCH Pattern 2): validate code + poll-open gate, device-scoped upsert.
create or replace function cast_date_vote(
  p_code text, p_device_token text, p_nickname text,
  p_option_id uuid default null, p_vote_date date default null,
  p_availability text default 'available'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_poll date_polls;
begin
  select * into v_poll from date_polls where poll_code = p_code and status = 'open' limit 1;
  if v_poll.id is null then raise exception 'poll not found or closed'; end if;
  if p_nickname is null or char_length(btrim(p_nickname)) = 0 then raise exception 'nickname required'; end if;
  if v_poll.mode = 'range' and p_option_id is null then raise exception 'option required'; end if;
  if v_poll.mode = 'grid'  and p_vote_date is null then raise exception 'date required'; end if;
  if p_availability not in ('available','unavailable') then raise exception 'bad availability'; end if;
  insert into date_votes (poll_id, device_token, nickname, option_id, vote_date, availability)
  values (v_poll.id, p_device_token, p_nickname, p_option_id, p_vote_date, p_availability)
  on conflict (poll_id, device_token, option_id, vote_date)
  do update set availability = excluded.availability, nickname = excluded.nickname;
end; $$;
grant execute on function cast_date_vote(text, text, text, uuid, date, text) to authenticated, anon;

-- poll_view_by_code: static poll metadata + (range) options array; null if code not found.
create or replace function poll_view_by_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_poll date_polls; v_options jsonb;
begin
  select * into v_poll from date_polls where poll_code = p_code limit 1;
  if v_poll.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'start_date', o.start_date, 'end_date', o.end_date
  ) order by o.start_date), '[]'::jsonb)
  into v_options from date_poll_options o where o.poll_id = v_poll.id;

  return jsonb_build_object(
    'id', v_poll.id, 'trip_id', v_poll.trip_id, 'mode', v_poll.mode,
    'status', v_poll.status, 'options', v_options
  );
end; $$;
grant execute on function poll_view_by_code(text) to authenticated, anon;

-- poll_vote_tally (RESEARCH Pattern 3): shaped counts + nicknames only — never
-- device_token or raw rows (Information-Disclosure mitigation, T-19-07).
create or replace function poll_vote_tally(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_poll date_polls; v_result jsonb;
begin
  select * into v_poll from date_polls where poll_code = p_code limit 1;
  if v_poll.id is null then return null; end if;

  if v_poll.mode = 'range' then
    select jsonb_agg(jsonb_build_object(
      'option_id', o.id, 'start_date', o.start_date, 'end_date', o.end_date,
      'available_count', (select count(*) from date_votes v
                          where v.option_id = o.id and v.availability = 'available'),
      'nicknames', (select coalesce(jsonb_agg(distinct v.nickname), '[]'::jsonb)
                    from date_votes v where v.option_id = o.id and v.availability = 'available')
    ) order by o.start_date)
    into v_result from date_poll_options o where o.poll_id = v_poll.id;
  else -- grid: per-date counts
    select jsonb_agg(jsonb_build_object(
      'vote_date', d.vote_date,
      'available_count', d.cnt, 'nicknames', d.names
    ) order by d.vote_date)
    into v_result from (
      select v.vote_date, count(*) cnt, jsonb_agg(distinct v.nickname) names
      from date_votes v where v.poll_id = v_poll.id and v.availability = 'available'
      group by v.vote_date
    ) d;
  end if;
  return jsonb_build_object('mode', v_poll.mode, 'status', v_poll.status, 'tally', coalesce(v_result, '[]'::jsonb));
end; $$;
grant execute on function poll_vote_tally(text) to authenticated, anon;

-- post_poll_comment: validate code + poll-open gate, body 1..140, per-device 5s throttle.
create or replace function post_poll_comment(
  p_code text, p_device_token text, p_nickname text, p_body text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_poll date_polls; v_comment date_comments;
begin
  select * into v_poll from date_polls where poll_code = p_code and status = 'open' limit 1;
  if v_poll.id is null then raise exception 'poll not found or closed'; end if;
  if p_nickname is null or char_length(btrim(p_nickname)) = 0 then raise exception 'nickname required'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 140 then raise exception 'bad comment body'; end if;
  if exists (select 1 from date_comments
             where poll_id = v_poll.id and device_token = p_device_token
               and created_at > now() - interval '5 seconds') then
    raise exception 'too fast';
  end if;
  insert into date_comments (poll_id, device_token, nickname, body)
  values (v_poll.id, p_device_token, p_nickname, btrim(p_body))
  returning * into v_comment;
  return to_jsonb(v_comment);
end; $$;
grant execute on function post_poll_comment(text, text, text, text) to authenticated, anon;

-- delete_poll_comment: allow if device_token matches the comment's, OR caller is
-- the trip owner (host moderation, am_trip_owner DEFINER helper).
create or replace function delete_poll_comment(p_comment_id uuid, p_device_token text)
returns void language plpgsql security definer set search_path = public as $$
declare v_comment date_comments; v_trip_id uuid;
begin
  select * into v_comment from date_comments where id = p_comment_id limit 1;
  if v_comment.id is null then raise exception 'comment not found'; end if;
  select trip_id into v_trip_id from date_polls where id = v_comment.poll_id;
  if v_comment.device_token = p_device_token or am_trip_owner(v_trip_id) then
    delete from date_comments where id = p_comment_id;
  else
    raise exception 'permission denied';
  end if;
end; $$;
grant execute on function delete_poll_comment(uuid, text) to authenticated, anon;

-- =============================================================================
-- (F) Host confirm RPC — SECURITY INVOKER + am_trip_owner guard (RESEARCH
-- Pattern 6). Atomic: writes trip dates + closes poll. host-only, NO anon.
-- =============================================================================
create or replace function confirm_poll_date(p_poll_id uuid, p_start_date date, p_end_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_trip_id uuid;
begin
  select trip_id into v_trip_id from date_polls where id = p_poll_id;
  if v_trip_id is null then raise exception 'poll not found'; end if;
  if not am_trip_owner(v_trip_id) then raise exception 'host only'; end if;
  if p_end_date < p_start_date then raise exception 'end before start'; end if;
  update trips set start_date = p_start_date, end_date = p_end_date where id = v_trip_id;
  update date_polls set status = 'closed' where id = p_poll_id;
end; $$;
grant execute on function confirm_poll_date(uuid, date, date) to authenticated;  -- host only, NO anon

-- =============================================================================
-- (G) Dateless trip create RPC — SECURITY INVOKER (RESEARCH Pattern 1, A1)
-- so owner RLS + the trips_default_representative trigger fire normally.
-- =============================================================================
create or replace function create_dateless_trip_with_poll(p_title text, p_city_code text, p_mode text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_trip trips; v_poll date_polls;
begin
  if p_mode not in ('range','grid') then raise exception 'bad mode'; end if;
  insert into trips (title, city_code) values (p_title, p_city_code) returning * into v_trip;
  insert into date_polls (trip_id, mode, status) values (v_trip.id, p_mode, 'open') returning * into v_poll;
  return jsonb_build_object('trip_id', v_trip.id, 'poll_id', v_poll.id, 'poll_code', v_poll.poll_code);
end; $$;
grant execute on function create_dateless_trip_with_poll(text, text, text) to authenticated;  -- host only
