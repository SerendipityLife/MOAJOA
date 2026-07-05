-- 0022_ledger.sql — Phase 21 Travel Ledger (LEDGER-01/03/04/05/06; CONTEXT D-03/D-04/D-05).
-- forwarding_addresses (per-user opaque mail-forward token) + ledger_entries
-- (trip-scoped-but-nullable expense ledger with the 5-element FX record).
--
-- RLS routes every cross-table check through the 0016 can_read_trip SECURITY
-- DEFINER helper called directly — the ledger SELECT branch on trip_id uses a
-- CASE, but the non-null arm is still a single DEFINER helper call, never a
-- direct cross-table subquery (42P17 recursion guard, CLAUDE.md §4.4).
--
-- ledger_entries carries NO FK to plans/plan_items under any column name: the
-- ledger is populated by the forwarded-mail pipeline (service-role INSERT) and
-- is independent of the app plan draft (LEDGER-04). Reference is trip_id only,
-- and trip_id is NULLABLE — an unclassified entry is owner-private until the
-- owner assigns a trip (D-05), at which point it becomes member-shared (D-04).
--
-- The app client NEVER inserts ledger rows: there is deliberately NO INSERT
-- policy on ledger_entries. With RLS enabled + no INSERT policy, an authenticated
-- client INSERT is denied; only the service-role pipeline (RLS bypass) writes.
--
-- Append-only: 0016..0021 are NEVER modified.

-- ---- forwarding_addresses ---------------------------------------------------
-- LEDGER-01/05: each user gets one opaque token; mail sent to <token>@<domain>
-- is routed to their ledger. One row per user (re-issue is an UPDATE, not a new
-- row). token uniqueness is enforced by the unique constraint below.
create table forwarding_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ensure_forwarding_token — mirrors the 0016 ensure_share_slug entropy idiom
-- (L158-174) verbatim, renamed share_slug→token. before insert: if the client
-- omits token, mint ~60 bits from gen_random_bytes(8), base64→strip to [a-z0-9],
-- 12 chars, md5-pad if under 8. The unique(token) constraint is the collision
-- guard (no retry loop — identical to ensure_share_slug).
create or replace function ensure_forwarding_token()
returns trigger
language plpgsql
as $$
begin
  if new.token is null then
    new.token := lower(translate(encode(gen_random_bytes(8), 'base64'), '+/=', 'abc'));
    new.token := substr(regexp_replace(new.token, '[^a-z0-9]', '', 'g'), 1, 12);
    if char_length(new.token) < 8 then
      new.token := new.token || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.token));
    end if;
  end if;
  return new;
end;
$$;

create trigger forwarding_addresses_token_before_insert
  before insert on forwarding_addresses
  for each row execute function ensure_forwarding_token();

alter table forwarding_addresses enable row level security;

-- Owner-only visibility: a user sees and creates only their own address. The
-- trigger mints token on INSERT, so the client inserts with only user_id set.
create policy "forwarding_addresses: read own"
  on forwarding_addresses for select to authenticated
  using (user_id = auth.uid());

create policy "forwarding_addresses: insert own"
  on forwarding_addresses for insert to authenticated
  with check (user_id = auth.uid());

-- ---- ledger_entries ---------------------------------------------------------
-- LEDGER-02/03/04. Enum CHECKs are locked character-for-character to the
-- @moajoa/core LedgerStatus / FxSource const-enums (21-02).
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,  -- the forwarder (D-04 write owner)
  trip_id uuid references trips(id) on delete set null,                     -- NULLABLE: unclassified (D-05, LEDGER-04)
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'needs_review', 'failed')),
  platform text,
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  merchant text,
  -- 5-element FX record (LEDGER-03): amount_foreign ① currency ② fx_rate ③
  -- fx_source ④ fx_as_of ⑤. fx_as_of is the Frankfurter response date (may be
  -- the prior business day for a weekend paid_at).
  amount_foreign numeric(14,2),
  currency text check (char_length(currency) = 3),
  fx_rate numeric(18,8),
  fx_source text check (fx_source in ('email', 'frankfurter', 'unavailable')),
  fx_as_of date,
  -- Derived by the pipeline (NOT a generated column, so fx_rate may be NULL
  -- when FX is unavailable without failing the row).
  amount_krw numeric(14,2),
  paid_at timestamptz,
  raw_mime text,                      -- minimal raw storage (D-03), dropped after parse
  raw_expires_at timestamptz,         -- TTL for the raw mime (D-03)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ledger_owner_idx on ledger_entries (owner_user_id);
create index ledger_trip_idx on ledger_entries (trip_id) where trip_id is not null;
create index ledger_status_idx on ledger_entries (status)
  where status in ('pending', 'processing');   -- pipeline claim scan

-- set_updated_at() already defined in 0016 (L38-46) — reuse, do not redefine.
create trigger ledger_entries_set_updated_at
  before update on ledger_entries
  for each row execute function set_updated_at();

alter table ledger_entries enable row level security;

-- RLS (RESEARCH Pattern 4 — this phase's core). trip_id NULL branch:
--   unclassified (trip_id NULL) → visible only to the row owner (D-05);
--   assigned    (trip_id set)   → visible to every trip member via the 0016
--                                 can_read_trip DEFINER helper (D-04).
-- The non-null arm is a single DEFINER helper call, so no direct cross-table
-- subquery ever runs inside this policy (42P17 guard).
create policy "ledger_entries: read own unclassified or trip-shared"
  on ledger_entries for select to authenticated
  using (
    case when trip_id is null then owner_user_id = auth.uid()
         else can_read_trip(trip_id)
    end
  );

-- Write is row-owner-only regardless of trip assignment (D-04): only the person
-- who forwarded the mail edits/deletes the entry, even after it becomes shared.
create policy "ledger_entries: update own"
  on ledger_entries for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "ledger_entries: delete own"
  on ledger_entries for delete to authenticated
  using (owner_user_id = auth.uid());

-- NO INSERT policy: the app client never inserts. RLS-enabled + no INSERT
-- policy denies authenticated INSERT; the mail pipeline writes service-role.
-- No anon policy anywhere — authenticated + service-role only.
