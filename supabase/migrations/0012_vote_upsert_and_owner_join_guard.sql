-- =============================================================================
-- 0012_vote_upsert_and_owner_join_guard
-- =============================================================================
-- Two 10-03 live-checkpoint findings (2026-06-12 브라우저 검증):
--
-- 1. votes has select/insert/delete policies but NO update policy. castVote()
--    is an upsert (ON CONFLICT DO UPDATE), so re-casting an existing vote hit
--    RLS 42501 and the web heart silently rolled back. Allow updating own row
--    only — matches the existing "delete own" scope.
--
-- 2. join_shared_board had no owner guard: an owner opening their own share
--    link and tapping 참여하기 inserted an owner-as-voter memberships row,
--    double-counting the owner in accepted_member_count (0011 already adds
--    +1 for the owner). Owner call is now a no-op that returns the board id.
-- =============================================================================

create policy "votes: update own"
  on votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function join_shared_board(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
  v_owner_id uuid;
begin
  select id, owner_id into v_board_id, v_owner_id
  from boards
  where share_slug = p_share_slug
    and visibility in ('shared','public')
  limit 1;

  if v_board_id is null then
    raise exception 'board not found or not shared';
  end if;

  -- Owner is implicitly a member (counted via accepted_member_count's +1).
  -- Inserting a voter row for them would double-count the denominator.
  if v_owner_id = auth.uid() then
    return v_board_id;
  end if;

  -- role hard-coded 'voter' (never escalate); user_id = auth.uid() (join as self);
  -- idempotent — already a member is a no-op.
  insert into memberships (board_id, user_id, role, accepted_at)
  values (v_board_id, auth.uid(), 'voter', now())
  on conflict (board_id, user_id) do nothing;

  return v_board_id;
end;
$$;
