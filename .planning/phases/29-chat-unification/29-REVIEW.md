---
phase: 29-chat-unification
reviewed: 2026-07-14T06:08:27Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - apps/web/__tests__/guest-surface.test.tsx
  - apps/web/__tests__/moa-island.test.tsx
  - apps/web/__tests__/poll-guest-island.test.tsx
  - apps/web/__tests__/poll-vote-island.test.tsx
  - apps/web/app/moa/[id]/_components/moa-island.tsx
  - apps/web/app/poll/[code]/_components/poll-guest-island.tsx
  - apps/web/app/poll/[code]/_components/poll-vote-island.tsx
  - apps/web/app/poll/[code]/page.tsx
  - apps/web/app/t/[slug]/_components/guest-surface.tsx
  - packages/api/src/queries/date-polls.test.ts
  - packages/api/src/queries/date-polls.ts
  - packages/api/src/queries/memberships.test.ts
  - packages/api/src/queries/memberships.ts
  - packages/api/src/types/database.ts
  - supabase/migrations/0032_join_moa_by_poll_code.sql
  - supabase/tests/web_share_smoke.sh
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-14T06:08:27Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 29 (채팅 단일화) unifies the /poll chat surface onto `trip_messages` via a new channel-owning wrapper (`PollGuestIsland`), retires poll-chat (한마디) and its RPC wrappers, adds the 0032 `join_moa_by_poll_code` DEFINER RPC, and converges the dates share flow onto the both-mode MoaIsland path.

Overall quality is high. The migration follows the append-only rule and the 0025 safety-net pattern (bearer validation, self-join via `auth.uid()`, owner guard, idempotent conflict handling, `search_path` pin). Retired poll-chat code left no dangling references (verified by grep + `tsc --noEmit` on apps/web, which passes clean). Client wrappers (`joinMoaByPollCode`) follow the house contract and are unit-tested. Realtime discipline (pre-subscribe binding chain, single channel per topic, id-dedup append) is consistently mirrored from the verified moa-island precedent, and the smoke script's new section (7) runtime-proves the voter join + trip_messages RLS path including the bad-code 400 case.

Two warnings: (1) the 0032 grant model relies on a comment-stated guarantee ("세션 필수") that Supabase's default function privileges do not actually enforce — a NOT NULL constraint is the real backstop; (2) the shared nickname-gate promise bridge can leak an unsettled promise under concurrent triggers, permanently disabling the /poll guest compose in the worst case. Neither is exploitable for privilege escalation or data exposure.

## Warnings

### WR-01: 0032 RPC is executable by sessionless `anon` despite the "세션 필수" comment — guarantee rests on a coincidental NOT NULL constraint

**File:** `supabase/migrations/0032_join_moa_by_poll_code.sql:57-58`
**Issue:** The migration grants EXECUTE to `authenticated` only and comments "anon grant 없음: 익명이라도 세션 필수". But in a standard Supabase database, `ALTER DEFAULT PRIVILEGES` in the `public` schema grants EXECUTE on newly created functions to `anon`, `authenticated`, and `service_role` — and no migration in this repo revokes it (grep for `revoke` across `supabase/migrations/` finds none). An explicit grant to `authenticated` does not remove the default `anon` grant, so a caller with only the anon key (no session) can invoke `join_moa_by_poll_code`.

Actual impact today is contained: with no session, `auth.uid()` is null, so the owner shortcut is false and the `memberships` insert fails on the `user_id uuid not null` constraint (0016_trips_baseline.sql:202) — no join occurs, and poll_code existence is already probeable via the anon-granted `poll_view_by_code`. But the security property the comment asserts is enforced by an unrelated table constraint, not the grant. The same latent pattern exists in 0025 (`join_moa`) and 0029 (`cast_date_vote_authed`, `hide_place_as_member`) — pre-existing, out of this phase's scope, but worth fixing together.
**Fix:** New append-only migration (0033):
```sql
-- Enforce the session-required intent stated in 0032/0029/0025 — Supabase default
-- privileges grant EXECUTE on public-schema functions to anon.
revoke execute on function join_moa_by_poll_code(text) from public, anon;
revoke execute on function join_moa(text) from public, anon;
revoke execute on function cast_date_vote_authed(text, text, uuid, date, text) from public, anon;
revoke execute on function hide_place_as_member(uuid) from public, anon;
```
Alternatively (or additionally, defense-in-depth), add an explicit guard in the function body: `if auth.uid() is null then raise exception 'session required'; end if;`. Verify with `select proacl from pg_proc where proname = 'join_moa_by_poll_code';`.

### WR-02: Gate promise bridge — a second concurrent `requireMember` overwrites the pending resolver, leaking an unsettled promise (compose can lock in `sending=true` forever)

**File:** `apps/web/app/poll/[code]/_components/poll-guest-island.tsx:119-126` (same pattern: `apps/web/app/t/[slug]/_components/guest-surface.tsx:231-238`)
**Issue:** `requireMember()` stores `resolve`/`reject` in single-slot refs. If a second participation action fires while the gate is already open (e.g. chat 보내기 opened the gate, then a vote toggle behind/around the sheet calls `PollVoteIsland.onRequireMember`), the second call overwrites `gateResolve.current`/`gateReject.current`. The first caller's promise then never settles. In `PollGuestIsland.sendAsGuest`, that means `await handleSend(...)` never returns, `finally` never runs, and `sending` stays `true` — the guest compose input and 보내기 button are disabled permanently until reload. In `PollVoteIsland.castVote` the hung await is silent (no state was mutated yet), which masks the leak.
**Fix:** Settle any previous pending gate before installing the new one:
```ts
function requireMember(): Promise<{ uid: string; nickname: string }> {
  if (joined && userId) return Promise.resolve({ uid: userId, nickname });
  return new Promise((resolve, reject) => {
    gateReject.current?.(); // settle a previous pending caller — never leak a promise
    gateResolve.current = resolve;
    gateReject.current = reject;
    setGateOpen(true);
  });
}
```
(The rejected first caller then follows its normal cancel path: draft restore + error toast.) Apply the same one-line guard to `guest-surface.tsx`.

## Info

### IN-01: Effect reads `onRequireMember` but omits it from deps without an eslint-disable

**File:** `apps/web/app/poll/[code]/_components/poll-vote-island.tsx:122-126`
**Issue:** This phase added `|| onRequireMember` to the stored-nickname hydrate guard (correct fix for Pitfall 1 / T-29-11), but the dependency array remains `[nicknameProp, initialNickname]`. `react-hooks/exhaustive-deps` will flag the missing dep; every other deliberate exclusion in this file carries an explicit `eslint-disable` comment.
**Fix:** Add `onRequireMember` to the deps (safe — the effect early-returns when set, and parent-recreated identity just re-runs a no-op), or add the file-consistent `// eslint-disable-next-line react-hooks/exhaustive-deps` with a why-comment.

### IN-02: Stale closure `nickname` in optimistic tally seed and vote broadcast after the external gate (pre-existing, adjacent to reviewed path)

**File:** `apps/web/app/poll/[code]/_components/poll-vote-island.tsx:216, 255, 303`
**Issue:** On a first gated vote, `castVote` resolves `effectiveNickname` from the gate but `applyTallyDelta` seeds `nicknames: [nickname]` and the broadcast payload sends `nickname` from the pre-gate closure (`''`). Locally this renders an empty nickname pill in the tally until a peer vote triggers refetch (receivers ignore the payload, so the broadcast side is harmless). Also `effectiveDeviceToken = m.uid` at line 216 is a dead assignment — the authed branch never reads it.
**Fix:** Thread the resolved name through: `applyTallyDelta(key, prev, availability, effectiveNickname)` (parameter instead of component state) and send `nickname: effectiveNickname` in the broadcast; delete the dead `effectiveDeviceToken` assignment in the gate branch. Pre-existing (Phase 25 code, unchanged lines) — fine to defer to a follow-up.

### IN-03: Guest draft restored into an unmounted compose when send fails after a successful join

**File:** `apps/web/app/poll/[code]/_components/poll-guest-island.tsx:217-230`
**Issue:** In `sendAsGuest`, if the gate/join succeeds but `sendTripMessage` then rejects, `joined` is already `true`, so the guest compose (which renders `draft`) has been replaced by `MoaChat` (which owns its own input). `setDraft(body)` restores text nowhere visible — the typed message is lost except for the error toast.
**Fix:** Low-priority UX edge. Either keep the guest compose mounted until the in-flight send settles, or on this failure path prefill nothing and rely on the toast (current behavior) — if accepted as-is, note it in the component doc comment.

### IN-04: `links` prop declared and passed but never used (pre-existing)

**File:** `apps/web/app/t/[slug]/_components/guest-surface.tsx:37-51, 70-79`
**Issue:** `GuestSurfaceProps.links` is declared and callers (page + tests) pass it, but the component never destructures it — `hydrateMember` fetches links fresh instead. Pre-existing dead prop, not introduced by this phase; mentioned per policy, not for removal in this diff.
**Fix:** Separate cleanup: drop the prop from the interface and call sites, or wire it as an initial seed.

### IN-05: Test fixture `makeMessage` collapses all multi-char ids to the same uuid suffix

**File:** `apps/web/__tests__/poll-guest-island.test.tsx:147-157`
**Issue:** `id.length === 1 ? \`0${id}\` : '99'` maps every multi-character id to `…99`. Two distinct multi-char ids in a future test would collide and be silently deduped by `appendMessage`, producing a false pass on dedup/append assertions. Current tests only use `'1'` and `'7'`, so no live impact.
**Fix:** Pad deterministically instead: `id.padStart(2, '0').slice(-2)` (or take a full uuid per call site).

---

_Reviewed: 2026-07-14T06:08:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
