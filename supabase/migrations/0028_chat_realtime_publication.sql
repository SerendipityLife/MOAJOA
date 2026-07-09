-- 0028_chat_realtime_publication.sql — Phase 26 Realtime Chat (D-06/D-07)
-- Append-only: 0016..0027 are NEVER modified.

-- 1) Expose trip_messages to postgres_changes (0026 registered only places/links).
--    Without this the island's INSERT subscription is SUBSCRIBED-but-0-events (D-14/Pitfall 2).
alter publication supabase_realtime add table trip_messages;

-- 2) user_id default — mirror votes_default_user_id (0016 L512). 0025 forgot it;
--    the INSERT RLS only validates user_id=auth.uid(), never populates it, and
--    TripMessageCreateSchema omits user_id → naive insert hits the not-null constraint.
create or replace function trip_messages_default_user_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end;
$$;
create trigger trip_messages_user_id_default
  before insert on trip_messages
  for each row execute function trip_messages_default_user_id();
