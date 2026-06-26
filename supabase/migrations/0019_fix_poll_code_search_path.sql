-- 0019_fix_poll_code_search_path.sql — Phase 19 hotfix (GAP-19C).
-- ensure_poll_code() (0018) calls gen_random_bytes() UNQUALIFIED. pgcrypto lives
-- in the `extensions` schema (Supabase default), so when the trigger fires inside
-- create_dateless_trip_with_poll (which pins `search_path = public`), the function
-- is not on the path → ERROR 42883 "function gen_random_bytes(integer) does not
-- exist", breaking the host's very first action (dateless create). Direct postgres
-- inserts masked it (postgres' search_path includes extensions); the app RPC path
-- did not. Unit tests mock the RPC so it went unseen until live 2-client UAT.
--
-- Append-only fix (0018 already on prod — NEVER edited): create-or-replace the
-- trigger function with the gen_random_bytes call schema-qualified. No behavior
-- change to the minted code shape.

create or replace function ensure_poll_code()
returns trigger language plpgsql as $$
begin
  if new.poll_code is null then
    new.poll_code := lower(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=', 'abc'));
    new.poll_code := substr(regexp_replace(new.poll_code, '[^a-z0-9]', '', 'g'), 1, 12);
    if char_length(new.poll_code) < 8 then
      new.poll_code := new.poll_code || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.poll_code));
    end if;
  end if;
  return new;
end; $$;
