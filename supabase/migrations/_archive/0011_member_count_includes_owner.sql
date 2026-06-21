-- =============================================================================
-- 0011_member_count_includes_owner
-- =============================================================================
-- accepted_member_count is the 확정 denominator (isPlaceConfirmed: 과반).
-- The owner has no memberships row of their own, so the 0009 definition
-- excluded them — while the owner's ❤️ DOES land in the numerator. Live check
-- 2026-06-12: owner+1 voter board → votes 2 / members 1 (ratio 2.0), and an
-- owner-only board could never reach 확정 at all (denominator 0).
--
-- Domain rule (packages/core constants): 멤버 / 공유보드 한도는 "owner 포함" —
-- the denominator follows the same convention. Sole consumer is the web
-- vote island via @moajoa/api getAcceptedMemberCount; join_shared_board does
-- not reference this function, so no behavior change elsewhere.
-- =============================================================================

create or replace function accepted_member_count(p_board_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  -- +1 = the board owner, who never has a memberships row.
  select count(*) + 1
  from memberships
  where board_id = p_board_id
    and accepted_at is not null;
$$;
