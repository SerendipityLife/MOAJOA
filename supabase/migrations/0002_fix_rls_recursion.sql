-- =============================================================================
-- Fix RLS policy infinite recursion (Postgres error 42P17).
-- =============================================================================
-- Original setup:
--   - boards.SELECT policy queries memberships → memberships RLS evaluated
--   - memberships.SELECT policy queries boards   → boards RLS evaluated
--   → Postgres detects the cycle and aborts with 42P17 at query planning time.
--
-- Fix: cross-table checks go through SECURITY DEFINER helper functions.
-- Inside such functions the query runs as the function owner (postgres),
-- which has BYPASSRLS, so the inner SELECT doesn't re-trigger RLS.
-- The functions reference only ONE other table each, so there's no second-hop
-- cycle either.
-- =============================================================================

-- ---- Helpers ---------------------------------------------------------------

create or replace function am_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from boards
    where id = p_board_id and owner_id = auth.uid()
  );
$$;

grant execute on function am_board_owner(uuid) to authenticated;

create or replace function am_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from memberships
    where board_id = p_board_id
      and user_id = auth.uid()
      and accepted_at is not null
  );
$$;

grant execute on function am_board_member(uuid) to authenticated;

-- ---- boards: rewrite the recursive SELECT policy ---------------------------

drop policy if exists "boards: shared members can read" on boards;

create policy "boards: shared members can read"
  on boards for select
  to authenticated
  using (
    visibility in ('shared','public')
    and am_board_member(id)
  );

-- ---- memberships: rewrite all policies that referenced boards directly -----

drop policy if exists "memberships: read own + board owner can read all" on memberships;
drop policy if exists "memberships: board owner can insert" on memberships;
drop policy if exists "memberships: board owner or self can delete" on memberships;

create policy "memberships: read own + board owner can read all"
  on memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or am_board_owner(board_id)
  );

create policy "memberships: board owner can insert"
  on memberships for insert
  to authenticated
  with check (am_board_owner(board_id));

create policy "memberships: board owner or self can delete"
  on memberships for delete
  to authenticated
  using (
    user_id = auth.uid()
    or am_board_owner(board_id)
  );

-- NOTE: links / places / votes policies already use can_read_board /
-- can_edit_board / can_vote_board (also SECURITY DEFINER). Those functions
-- only access boards and memberships internally, never their *caller* table,
-- so they're safe from the same cycle.
