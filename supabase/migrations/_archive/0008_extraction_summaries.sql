-- =============================================================================
-- Phase 8: Extraction depth — Korean commentary (0008)
-- =============================================================================
-- Add two NULLABLE text columns for human-readable Korean commentary, both
-- produced by widening the single existing Claude extraction call:
--   places.summary_ko — per-place 1~2 sentence Korean summary (EXTRACT-12)
--   links.summary_ko  — per-video 2~3 sentence Korean TL;DR     (EXTRACT-13)
--
-- Both columns are NULLABLE with no default — commentary is supplementary and
-- may be absent (LLM produces nothing when it has no grounding, and extraction
-- never fails on a missing summary). Adding nullable columns is a non-locking,
-- backward-compatible change: existing places/links rows stay valid with NULL.
--
-- The public_board_view RPC MUST be re-issued (Part 2). That function builds its
-- response with an EXPLICIT jsonb_build_object field list — it does NOT select *.
-- A column not named there is invisible to the web, so the new columns are added
-- to both the links and places jsonb objects, mirroring the Phase 5 (0006)
-- source_kind/confidence append. Existing fields are preserved verbatim.
-- =============================================================================

-- ---- Part 1: nullable commentary columns -----------------------------------

alter table places add column summary_ko text;
alter table links  add column summary_ko text;

-- ---- Part 2: public_board_view RPC redefinition ----------------------------
-- Re-issue the full CREATE OR REPLACE so the SELECT list is explicit and
-- diff-reviewable. Body copied verbatim from 0006_trust_ui_onboarding.sql:25-90,
-- with 'summary_ko' appended to both the links and places jsonb objects.

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
        'author_name', l.author_name,
        'summary_ko', l.summary_ko        -- NEW (Phase 8 EXTRACT-13)
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
        'summary_ko', p.summary_ko        -- NEW (Phase 8 EXTRACT-12)
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

grant execute on function public_board_view(text) to authenticated, anon;
