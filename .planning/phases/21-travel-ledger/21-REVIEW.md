---
phase: 21-travel-ledger
reviewed: 2026-07-05T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - supabase/migrations/0022_ledger.sql
  - packages/core/src/schemas/ledger.ts
  - packages/api/src/queries/ledger.ts
  - packages/api/src/queries/forwarding.ts
  - supabase/functions/inbound-email/index.ts
  - supabase/functions/parse-email/index.ts
  - supabase/functions/parse-email/pipeline/mail.ts
  - supabase/functions/parse-email/pipeline/claude.ts
  - supabase/functions/parse-email/pipeline/fx.ts
  - workers/inbound-email/src/index.ts
  - apps/ios/app/trip/[id]/(tabs)/ledger.tsx
  - apps/ios/components/ledger/ledger-row.tsx
  - apps/ios/components/ledger/ledger-entry-sheet.tsx
  - apps/ios/app/me.tsx
  - apps/ios/lib/forwarding-address.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 10
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-07-05
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the travel-ledger mail-ingestion phase: RLS migration, core schemas, API
CRUD, the two Edge Functions (inbound-email, parse-email + mail/claude/fx pipeline),
the thin Cloudflare Worker, and the iOS ledger surface. The pipeline's core
prompt-injection defense (`validateTripId` intersecting the LLM's `matched_trip_id`
against the owner's real trips) is correctly implemented and tested, the FX
precedence logic is sound, and the atomic claim + service-role write pattern is
right.

However there is one genuine **authorization gap**: the ledger `UPDATE` RLS policy
gates on `owner_user_id` only, never on the *target* trip, so an authenticated user
can assign their own ledger row (whose merchant/amount they fully control via a
forwarded mail) to **any** trip UUID and thereby inject a spoofed expense into a
trip they are not a member of — the row becomes visible to that trip's members
through `can_read_trip`. The client `assignTripToEntry` performs no membership check
either, and the code comments explicitly declare RLS "the ONLY gate," so the gap is
load-bearing. In addition, the inbound-email EF contradicts its own T-21-12
existence-nonleak invariant (matched → HTTP 200, unmatched → 202), the iOS row
re-derives KRW instead of trusting the stored billed amount (undermining the
"실청구" trust badge), and the parse trigger is a bare un-awaited `fetch` with no
`EdgeRuntime.waitUntil`, which the Supabase Deno runtime may drop.

## Critical Issues

### CR-01: Ledger UPDATE RLS allows cross-trip expense injection (authorization gap)

**Status:** ✅ RESOLVED — `supabase/migrations/0023_ledger_update_check.sql` (append-only) drops+recreates the `ledger_entries: update own` policy with a tightened `WITH CHECK` (`owner_user_id = auth.uid() and (trip_id is null or can_read_trip(trip_id))`), so an owner can no longer assign their row to a trip they cannot read. RLS matrix: CR-01a (out-of-trip assign) DENIED, CR-01b (member-trip assign) allowed, CR-01c/d owner-gate + share regressions PASS. `can_read_trip` is the 0016 SECURITY DEFINER helper (42P17 guard holds). Commit `a0d4a0a`.

**File:** `supabase/migrations/0022_ledger.sql:129-132` (+ `packages/api/src/queries/ledger.ts:63-77`)

**Issue:** The `UPDATE` policy checks ownership only:

```sql
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid())
```

Neither `USING` nor `WITH CHECK` constrains the *new* `trip_id`. `assignTripToEntry`
issues a bare `update({ trip_id }).eq('id', entryId)` with no membership validation
(the module header states "RLS (0022) is the ONLY gate"). So any authenticated user
can:

1. Forward an attacker-authored mail to their own token → gets a ledger row they own
   with attacker-chosen `merchant` / `amount_foreign` / `platform`.
2. Call `assignTripToEntry(myEntryId, victimTripId)` for **any** trip UUID.
3. RLS passes (they own the row). The row's `trip_id` is now the victim trip.
4. The `SELECT` policy evaluates `can_read_trip(trip_id)` for the *victim's* members,
   so every member of that trip now sees the injected/spoofed expense row in their
   shared ledger and total.

This is a write-injection into a scope the attacker has no membership in. It does not
grant read access to the victim trip's other rows, but it lets an attacker
inject arbitrary spoofed expenses into any trip whose UUID they know (trip UUIDs are
shared to invitees, so not secret in practice). The parse-email EF defends the
server-side assignment path with `validateTripId`, but the client assignment path has
no equivalent — RLS must enforce it.

**Fix:** Require the assigner to be able to read the target trip, in the policy
(closes it for all clients regardless of app code):

```sql
create policy "ledger_entries: update own"
  on ledger_entries for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and (trip_id is null or can_read_trip(trip_id))
  );
```

`can_read_trip` is SECURITY DEFINER, so this stays within the 42P17 recursion guard
(no direct cross-table subquery). Optionally also intersect against the caller's
trips inside `assignTripToEntry` for a clearer error.

## Warnings

### WR-01: iOS re-derives KRW from a rounded rate, contradicting the "실청구" trust badge

**Status:** ✅ RESOLVED — `ledger-row.tsx` KRW display and `ledger.tsx` trip total now use `entry.amount_krw ?? deriveAmountKrw(...)`, so email-sourced rows show the exact billed KRW from the mail and only frankfurter/unavailable rows re-derive. iOS test added (JPY 3,400 billed ₩32,000 shows ₩32,000, not the drifted ₩31,994). Commit `89026b2`.

**File:** `apps/ios/components/ledger/ledger-row.tsx:74,113-114` and `apps/ios/app/trip/[id]/(tabs)/ledger.tsx:251-254`

**Issue:** The row and the trip total both compute KRW as
`deriveAmountKrw(entry.amount_foreign, entry.fx_rate)` and ignore the stored
`amount_krw` column. For `fx_source === 'email'` rows, `resolveFx` stores the exact
billed KRW from the mail (`amount_krw = mailKrw`) while `fx_rate` is either the
mail's rate or a back-computed quotient stored at `numeric(18,8)`. Re-deriving
`round(amount_foreign × fx_rate)` can differ from the true billed KRW.

Concrete: mail states JPY 3,400 billed as ₩32,000 (rate 9.41). Stored:
`amount_krw = 32000`, `fx_rate = 9.41`. The UI displays and totals
`round(3400 × 9.41) = ₩31,994` — a wrong number shown *under the "실청구" (actual
billed) badge*, the badge that specifically promises the real charged amount. The
trip total inherits the drift. This defeats the whole point of the `email` source
tier (D-06: "the real billed amount = truth").

**Fix:** For email-sourced rows, display/total the stored `amount_krw`; only fall
back to `deriveAmountKrw` when `amount_krw` is null (frankfurter/unavailable). E.g.
`const krw = entry.amount_krw ?? deriveAmountKrw(entry.amount_foreign, entry.fx_rate);`
in both `ledger-row.tsx` and the `totalKrw` reduce.

### WR-02: inbound-email leaks token existence via status code (matched 200 vs unmatched 202) — violates T-21-12

**File:** `supabase/functions/inbound-email/index.ts:120,164-169`

**Issue:** The header comment claims "matched AND unmatched both return 202-class so
token existence never leaks via status/timing (T-21-12)." The code does not: the
matched path returns `jsonOk(...)` = **HTTP 200** with the `entry_id`, while the
unmatched/undrivable path returns `ignored()` = **HTTP 202**. A caller can therefore
distinguish a real forwarding token (200) from a non-existent one (202) by status
code alone — precisely the disclosure T-21-12 forbids. (Exploitability is bounded by
the `x-ingest-secret` gate that precedes this branch, so only a secret-holder can
probe — hence WARNING not BLOCKER — but the code contradicts its own stated privacy
invariant and the fix is trivial.)

**Fix:** Make the matched success also 202-class and drop the `entry_id` from the
external response:

```ts
return new Response(JSON.stringify({ status: 'accepted' }), {
  status: 202,
  headers: { 'content-type': 'application/json', ...corsHeaders() },
});
```

### WR-03: Fire-and-forget parse trigger has no `EdgeRuntime.waitUntil` — may be dropped

**Status:** ✅ RESOLVED — the un-awaited `fetch(parseUrl, ...)` is now wrapped in `EdgeRuntime.waitUntil(...)` so the Supabase Deno runtime keeps the isolate alive until the trigger is delivered (still NO await — Pitfall 5). PARSE_EMAIL_URL-unset local skip guard preserved. `deno check` green. Commit `e1125c8`.

**File:** `supabase/functions/inbound-email/index.ts:106-121`

**Issue:** The parse trigger is a bare, un-awaited `fetch(parseUrl, ...).catch(() => {})`
followed immediately by `return jsonOk(...)`. On the Supabase Deno edge runtime,
background work started but not registered with `EdgeRuntime.waitUntil()` is not
guaranteed to run to completion after the `Response` is returned — the isolate can be
reclaimed before the trigger request is even flushed. If that happens, the ledger row
is inserted `status='pending'` and parse-email is never invoked, leaving the entry
stuck `pending` forever (invisible in the assigned view; a data-less row in the
unassigned inbox). "No await" (Pitfall 5) is correct for not blocking the response,
but the request delivery must still be kept alive.

**Fix:** Register the trigger so the runtime keeps it alive until delivered:

```ts
// @ts-ignore Supabase edge runtime global
EdgeRuntime.waitUntil(
  fetch(parseUrl, { method: 'POST', headers: {...}, body: JSON.stringify({ entry_id: entry.id }) })
    .catch(() => {}),
);
```

### WR-04: Unassigned inbox surfaces pending/processing/failed rows as assignable; manual assign races the pipeline

**Status:** ✅ RESOLVED — `listUnassignedLedger` now adds `.in('status', ['ready','needs_review'])` (keeping the `trip_id is null` filter), hiding pending/processing/failed rows from the assign inbox and closing the assign→pipeline clobber race (a row is assignable only after parse-email's final UPDATE, and the atomic claim scans pending/failed). parse-email's final UPDATE left unchanged (minimal scope). `ledger.test.ts` chain assertion updated. Commit `a2db121`.

**File:** `apps/ios/app/trip/[id]/(tabs)/ledger.tsx:249` and `packages/api/src/queries/ledger.ts:37-47`

**Issue:** `listUnassignedLedger` filters only on `trip_id is null` with no status
filter, so entries that are still `pending`/`processing` (mid-parse) or `failed`
appear in the 확인 section as tappable `LedgerRow`s in assign mode. Two consequences:

1. **Race/clobber:** a user can assign a trip to a row the pipeline is still
   processing. parse-email's final `UPDATE` (index.ts:141-159) unconditionally sets
   `trip_id = validateTripId(...)` (which may be `null` or a different trip),
   overwriting the user's manual assignment with no status guard.
2. **Data-less lingering rows:** a `failed` unclassified row (all fields null) shows
   forever as "결제 / —" with no way to do anything useful with it.

**Fix:** Scope the inbox to actionable rows, e.g. `.in('status', ['ready','needs_review'])`
in `listUnassignedLedger` (keeping trip_id null), and/or make the parse-email final
`UPDATE` not overwrite a `trip_id` the user has already set (only fill when still
null).

## Info

### IN-01: Non-constant-time shared-secret comparison

**File:** `supabase/functions/inbound-email/index.ts:50` and `supabase/functions/parse-email/index.ts:52`

**Issue:** `req.headers.get('x-ingest-secret') !== ingestSecret` short-circuits on
first differing byte. Over HTTPS with network jitter a timing attack is impractical,
but a constant-time compare is cheap and idiomatic for a secret gate.
**Fix:** Compare with a fixed-length constant-time equality (e.g. hash both sides and
compare, or use a timing-safe equal helper).

### IN-02: `extractToken` does not handle angle-bracket / display-name To forms

**File:** `supabase/functions/inbound-email/index.ts:126-131`

**Issue:** `to.split('@')[0]` assumes a bare `token@domain`. If the envelope To ever
arrives as `<token@domain>` or `Name <token@domain>`, the local part becomes
`<token` / `Name <token` and the lookup silently misses (mail dropped as `ignored`).
CF envelope `to` is normally bare, so low-risk, but a mismatch is a silent drop.
**Fix:** Strip a leading `<`/display name before splitting, mirroring the
`[>\s]+$` normalization already done in `fromDomainHint`.

### IN-03: `forwarding_addresses` has no UPDATE policy despite "re-issue is an UPDATE" comment

**File:** `supabase/migrations/0022_ledger.sql:22-25,63-69`

**Issue:** The header comment states "One row per user (re-issue is an UPDATE, not a
new row)," but only `select` and `insert` policies exist — a client `UPDATE` (token
re-issue / rotation) would be denied by RLS. `getOrCreateForwardingAddress` never
updates, so there is no runtime bug today, but the stated rotation capability
silently cannot work. **Fix:** Either add an owner-scoped `UPDATE` policy if rotation
is intended, or drop the misleading comment.

### IN-04: LLM `currency` interpolated into the Frankfurter URL with only a length check

**File:** `supabase/functions/parse-email/pipeline/fx.ts:89-91`

**Issue:** `currency` (LLM output, validated as `z.string().length(3)` — no charset)
is interpolated into `?base=${currency}`. A 3-char value with URL-special chars
(e.g. `a&b`) would malform the query. It only hits Frankfurter (external, read-only)
and returns null on a bad response, so there is no injection into our system, but the
value should be constrained. **Fix:** Tighten to `z.string().regex(/^[A-Z]{3}$/)` in
both the core and pipeline schemas (and the 0022 CHECK), and/or `encodeURIComponent`.

### IN-05: Verify `claude-sonnet-4-6` model id resolves

**File:** `supabase/functions/parse-email/pipeline/claude.ts:10`

**Issue:** `LEDGER_MODEL = 'claude-sonnet-4-6'`. This mirrors the existing
extraction/planning functions (so it is consistent with shipped code, not introduced
here), but if the id does not resolve at the Anthropic API the whole parse fails and
the entry flips to `status='failed'`. Worth a one-time confirmation that the id is
current for the account. **Fix:** Confirm against the deployed model list; centralize
the model constant if it is shared with other EFs.

---

_Reviewed: 2026-07-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
