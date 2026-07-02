-- 0020_fix_share_slug_search_path.sql — GAP-19C follow-up.
--
-- Same bug class as 0019: ensure_share_slug() (0016) calls pgcrypto's
-- gen_random_bytes() unqualified. pgcrypto lives in the `extensions` schema on
-- hosted Supabase, and the trigger function has no explicit search_path, so it
-- inherits the caller's. Fired from any context that pins
-- `set search_path = public`, gen_random_bytes is not on the path →
--   ERROR 42883: function gen_random_bytes(integer) does not exist
-- 0019 fixed ensure_poll_code; this closes the same latent hole in
-- ensure_share_slug before a future DEFINER/pinned-path caller trips it.
--
-- FIX (append-only; 0016 untouched): pin the function's own search_path to
-- `public, extensions`. Body is otherwise verbatim from 0016 L158-174. A
-- non-existent `extensions` schema in search_path is tolerated by Postgres,
-- so this is safe on local dev too. `create or replace` is idempotent.
-- NOTE: already applied to the cloud project directly via session pooler
-- (2026-06-27 Windows session); this file records it in migration history.

create or replace function ensure_share_slug()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if (new.visibility in ('public','shared')) and (new.share_slug is null) then
    -- 12 chars from base32-ish alphabet, ~60 bits of entropy
    new.share_slug := lower(translate(encode(gen_random_bytes(8), 'base64'), '+/=', 'abc'));
    new.share_slug := substr(regexp_replace(new.share_slug, '[^a-z0-9]', '', 'g'), 1, 12);
    -- Ensure minimum length even after stripping
    if char_length(new.share_slug) < 8 then
      new.share_slug := new.share_slug || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.share_slug));
    end if;
  end if;
  return new;
end;
$$;
