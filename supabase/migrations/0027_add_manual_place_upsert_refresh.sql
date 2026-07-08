-- 0027_add_manual_place_upsert_refresh.sql — 장소 재-담기 시 설명 필드 갱신
--
-- 결정 기록:
--   D-U1: add_manual_place(0016)의 on conflict는 note/hidden_at만 갱신했다 →
--         이미 담긴 장소를 다시 담아도 name_local/lat/lng 등이 안 바뀐다. 초기
--         버그로 name_local=place_id·lat/lng=0,0으로 저장된 행은 재-담기로 복구
--         불가였고, soft-delete된 행을 unhide하면 stale 데이터가 되살아났다.
--   D-U2: on conflict do update가 서술 필드(name_*/lat/lng/category/address)도
--         갱신하도록 확장. coalesce(new, existing)로 null 신규값이 기존값을
--         덮어쓰지 않게 보호 — 부분 데이터로 재-담기해도 손실 없음.
--
-- 시그니처·security invoker·can_edit_trip 가드·insert 컬럼은 0016과 동일 —
-- on conflict 절만 바뀐다. create or replace라 grant는 유지되나 0016 미러로 재부여.
--
-- Append-only: 0016..0026 are NEVER modified.

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
    set note       = coalesce(p_note, places.note),
        hidden_at  = null,
        name_local = coalesce(p_name_local, places.name_local),
        name_ko    = coalesce(p_name_ko, places.name_ko),
        name_en    = coalesce(p_name_en, places.name_en),
        lat        = coalesce(p_lat, places.lat),
        lng        = coalesce(p_lng, places.lng),
        category   = coalesce(p_category, places.category),
        address    = coalesce(p_address, places.address)
  returning * into v_place;

  return v_place;
end;
$$;

grant execute on function add_manual_place(
  uuid, text, text, text, text, text, double precision, double precision, text, text
) to authenticated;
