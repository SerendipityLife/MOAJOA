-- =============================================================================
-- Phase 10: Web voting backend — slug self-join + 확정 denominator (0009)
-- =============================================================================
-- Append-only migration. NEVER edit 0001-0008. This file adds the three backend
-- pieces the Phase 10 web voting flow needs on top of the already-present votes
-- table, RLS, can_vote_board, and vote_counts_for_places (see 0001):
--
--   1. join_shared_board(p_share_slug) — a logged-in NON-owner who possesses a
--      shared/public board's slug self-joins as an accepted 'voter' member.
--   2. accepted_member_count(p_board_id) — the 확정 denominator, queryable by
--      anon + authenticated for any board id.
--   3. public_board_view(p_slug) re-issue — broadens slug resolution to 'shared'
--      boards and (re-)exposes board.id so the web island can fetch counts.
--
-- THREAT MODEL (bearer-invite):
--   join_shared_board grants a NEW right the caller does not already have, so it
--   runs SECURITY DEFINER and bypasses RLS — we do NOT add an "anyone can insert
--   membership" RLS policy (that would be broader and harder to reason about).
--   Safety rails baked into the function body, not the caller:
--     * role is the HARD-CODED literal 'voter' — no caller-supplied role param
--       exists, so escalation to editor/owner is impossible.
--     * user_id = auth.uid() (not a parameter) — a caller can only join AS self.
--     * only visibility in ('shared','public') boards resolve — private boards
--       never join.
--     * on conflict (board_id, user_id) do nothing — idempotent; the
--       unique(board_id,user_id) constraint caps one membership per user/board.
--     * set search_path = public on all three DEFINER funcs — no schema shadowing.
--
--   Broadening public_board_view to 'shared' (Part 3) deliberately exposes a
--   shared board's title/pins to ANY slug-holder. This is the intended
--   bearer-invite model (CONTEXT B): slug possession = invite. Slug entropy is
--   ~60 bits (ensure_share_slug, 0001), so guessing is infeasible. Flagged for
--   human sanity-check at the 10-03 morning db-push gate.
-- =============================================================================

-- ---- Part 1: join_shared_board ---------------------------------------------
-- plpgsql write idiom from add_manual_place (0001), BUT security DEFINER (it
-- grants a new right) instead of invoker. NOT stable — it writes.

create or replace function join_shared_board(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  select id into v_board_id
  from boards
  where share_slug = p_share_slug
    and visibility in ('shared','public')
  limit 1;

  if v_board_id is null then
    raise exception 'board not found or not shared';
  end if;

  -- role hard-coded 'voter' (never escalate); user_id = auth.uid() (join as self);
  -- idempotent — already a member is a no-op.
  insert into memberships (board_id, user_id, role, accepted_at)
  values (v_board_id, auth.uid(), 'voter', now())
  on conflict (board_id, user_id) do nothing;

  return v_board_id;
end;
$$;

grant execute on function join_shared_board(text) to authenticated;

-- ---- Part 2: accepted_member_count -----------------------------------------
-- sql/definer, granted to anon + authenticated (anon needs the denominator for
-- the public render — same grant logic as vote_counts_for_places in 0001).

create or replace function accepted_member_count(p_board_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from memberships
  where board_id = p_board_id
    and accepted_at is not null;
$$;

grant execute on function accepted_member_count(uuid) to authenticated, anon;

-- ---- Part 3: public_board_view re-issue ------------------------------------
-- Copied VERBATIM from 0008_extraction_summaries.sql:31-98 (explicit
-- jsonb_build_object field list — NOT select *), with exactly two changes:
--   (i)  'id', v_board.id retained in the board object (already present in 0008).
--   (ii) WHERE visibility = 'public'  ->  visibility in ('public','shared')
--        so shared-link slugs resolve. PRIVACY: this exposes a shared board's
--        title/pins to any slug-holder (bearer-invite; see header threat model).
-- Every other field (incl. Phase 8 summary_ko on links + places) is preserved.

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
  where share_slug = p_slug and visibility in ('public','shared')  -- CHANGE (ii): broadened to resolve shared slugs
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
        'author_name', l.author_name,
        'summary_ko', l.summary_ko        -- Phase 8 EXTRACT-13 (preserved)
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
        'source_kind', p.source_kind,
        'confidence', p.confidence,
        'summary_ko', p.summary_ko        -- Phase 8 EXTRACT-12 (preserved)
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_board_view(text) to authenticated, anon;
