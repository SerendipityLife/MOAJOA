-- Phase 29 gap closure (CHAT-10) — join 전 게스트 채팅 스냅샷 읽기.
-- Append-only (§4.3): 0016~0033 절대 무수정. create-or-replace 함수 하나만
-- 추가한다(스키마-중립 — 테이블/컬럼/정책 변경 없음).
--
-- public_trip_messages(p_slug) — 비멤버 익명이 slug로 trip_messages 스냅샷을
-- 얻는 anon-read DEFINER RPC. trip_messages SELECT RLS(can_read_trip, 멤버
-- 전용, 0025)를 우회해 /t join 전 게스트에게 채팅 이력을 노출한다.
-- public_trip_poll(0029) 미러: slug→trip 해석(visibility 게이트)·search_path
-- 핀·grant authenticated,anon. 0033은 READ RPC(public_trip_poll/view)를
-- 의도적으로 미revoke — 이 read-only RPC도 anon 유지가 정책 일관.
-- PII: user_id(auth.uid)는 반환 shape에서 제외 — nickname은 이미 비정규화
-- 공개 필드(D-A2 send-time snapshot). 최근 200개(created_desc→asc 재정렬)로
-- payload bound. read-only: anon write 경로 없음(직접 INSERT는 멤버 RLS 게이트).
create or replace function public_trip_messages(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_messages jsonb;
begin
  select * into v_trip from trips
  where share_slug = p_slug and visibility in ('public','shared')
  limit 1;
  if not found then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tm.id,
      'nickname', tm.nickname,
      'body', tm.body,
      'reply_to_place_id', tm.reply_to_place_id,
      'created_at', tm.created_at
    ) order by tm.created_at asc
  ), '[]'::jsonb)
  into v_messages
  from (
    select * from trip_messages
    where trip_id = v_trip.id
    order by created_at desc
    limit 200
  ) tm;

  return v_messages;
end;
$$;

grant execute on function public_trip_messages(text) to authenticated, anon;
