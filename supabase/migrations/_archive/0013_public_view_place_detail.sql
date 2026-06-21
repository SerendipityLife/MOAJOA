-- =============================================================================
-- 0013_public_view_place_detail
-- =============================================================================
-- 장소 상세 UX (2026-06-12 사용자 결정): the public board's place rows expand
-- to an in-page detail with [Google 지도] + [영상 N:NN 보기] actions, so the
-- view must expose two more place fields:
--   - google_place_id → Google Maps place deep link (public identifier of a
--     public place; no privacy surface)
--   - address         → shown in the expanded detail
--
-- Copied VERBATIM from 0009_join_shared_board.sql public_board_view with
-- exactly those two fields appended to the places jsonb object. Everything
-- else (shared visibility, summary_ko fields, explicit field list — never
-- select *) is preserved.
-- =============================================================================

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
  where share_slug = p_slug and visibility in ('public','shared')
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
        'summary_ko', l.summary_ko
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
        'summary_ko', p.summary_ko,
        'google_place_id', p.google_place_id,  -- NEW (장소 상세 — 지도 딥링크)
        'address', p.address                   -- NEW (장소 상세 — 주소 표기)
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;
