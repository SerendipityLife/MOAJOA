-- =============================================================================
-- Phase 5: Trust UI & Onboarding foundation (0006)
-- =============================================================================
-- Part 1: places.confidence numeric(3,2) — per-pin AI confidence (D-01)
-- Part 2: public_board_view RPC redefine — append confidence + source_kind (D-03)
-- Part 3: profiles_create_first_board trigger — auto "내 첫 여행" (D-16/D-17)
-- Part 4: backfill existing profiles → 1 board each (D-18)
-- =============================================================================

-- ---- Part 1: per-place confidence column -----------------------------------
-- D-01: nullable. legacy rows (Phase 2/3 inserts before this column existed)
-- stay null and are NOT treated as low-confidence (D-15: null != low).
-- CHECK enforces server-side that any non-null value is 0..1 (T-05-01).

alter table places
  add column if not exists confidence numeric(3,2)
    check (confidence is null or (confidence >= 0 and confidence <= 1));

-- ---- Part 2: public_board_view RPC redefinition ----------------------------
-- Append `source_kind` (TRUST-01 web parity) + `confidence` (TRUST-04) to the
-- places jsonb. Existing fields preserved verbatim — append-only intent.
-- Re-issue the full CREATE OR REPLACE so the SELECT list is explicit and
-- diff-reviewable against 0001_init.sql:487-551.

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
        'source_timestamp_sec', p.source_timestamp_sec,
        'source_kind', p.source_kind,        -- NEW (Phase 5 TRUST-01 web parity)
        'confidence', p.confidence            -- NEW (Phase 5 TRUST-04)
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_board_view(text) to authenticated, anon;

-- ---- Part 3: profiles_create_first_board trigger ---------------------------
-- D-16/D-17: AFTER INSERT on profiles. The profile row is created by
-- handle_new_auth_user (0001_init.sql:85, AFTER INSERT on auth.users) inside
-- the same signup transaction, so this trigger runs immediately after the
-- profile exists. SECURITY DEFINER lets the trigger bypass RLS and insert
-- into boards on behalf of the new user (T-05-03 mitigation: NEW.id is the
-- profile's own id, so we can only ever create a board for that profile).
-- Idempotent guard: skip if owner already has any board (handles replays).

create or replace function profiles_create_first_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from boards where owner_id = NEW.id) then
    insert into boards (owner_id, title, visibility)
    values (NEW.id, '내 첫 여행', 'private');
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_first_board_trigger on profiles;
create trigger profiles_first_board_trigger
  after insert on profiles
  for each row execute function profiles_create_first_board();

-- ---- Part 4: backfill existing profiles ------------------------------------
-- D-18: One-shot — existing dogfooders get the same "내 첫 여행" experience.
-- Idempotent (NOT EXISTS guard) — safe to re-run if migration is replayed
-- against the same database.

insert into boards (owner_id, title, visibility)
select p.id, '내 첫 여행', 'private'
from profiles p
where not exists (select 1 from boards where owner_id = p.id);
