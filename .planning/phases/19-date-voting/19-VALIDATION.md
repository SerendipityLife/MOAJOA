---
phase: 19
slug: date-voting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `19-RESEARCH.md` § Validation Architecture + Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | core/api/web: `vitest` ^1.6.0 · iOS: `jest` ^29.7.0 + `jest-expo` ~56.0.5 · SQL/RPC: `supabase db reset` (local PG17, colima Docker) + psql assertions (mirror 17-03 / 18-02) |
| **Config file** | per-package (`packages/core`, `packages/api`, `apps/web` vitest; `apps/ios` jest) |
| **Quick run command** | `pnpm --filter @moajoa/core test` · `pnpm --filter @moajoa/api test` · `pnpm --filter ios test` · `pnpm --filter web test` |
| **Full suite command** | `pnpm -r test` + `pnpm -r typecheck`; migration: `pnpm supabase:reset` then `pnpm supabase:types` |
| **Estimated runtime** | unit suites seconds-scale; `supabase:reset` ~tens of seconds (requires colima Docker up) |

---

## Sampling Rate

- **After every task commit:** Run the package's quick test (`pnpm --filter <pkg> test`) + `typecheck`. For SQL tasks: `pnpm supabase:reset` (assert **42P17 = 0**) on the changed migration.
- **After every plan wave:** Run `pnpm -r test` + `pnpm -r typecheck`; after `0018` lands, `pnpm supabase:reset` + `pnpm supabase:types` (regenerate `database.ts`) green.
- **Before `/gsd-verify-work`:** Full suite green + a manual anon-abuse probe (anon key can vote via RPC, cannot direct-INSERT; closed poll rejects writes).
- **Max feedback latency:** unit < ~30s; SQL reset gate ~tens of seconds.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are the **behavior-level** Nyquist sampling contract from research. The nyquist-auditor / executor reconcile these to concrete task IDs.

| Behavior | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Dateless trip create leaves dates null + attaches open poll | mig+api | POLL-01 | — | Trip persists `start/end_date NULL`; poll row `status='open'` attached by FK | unit (api) | `pnpm --filter @moajoa/api test` | ❌ W0 | ⬜ pending |
| `poll_code` minted non-guessable (≥8 chars, CSPRNG) | mig | POLL-01 | T-19 code-bearer | `gen_random_bytes` server-side; length/charset asserted | sql | `pnpm supabase:reset` + psql | ❌ W0 | ⬜ pending |
| Poll create guarded by `can_edit_trip` (non-owner rejected) | mig | POLL-01 | T-19 EoP | non-owner JWT → 42501/raise | sql (RLS) | psql `set_config('request.jwt.claims',…)` | ❌ W0 | ⬜ pending |
| `cast_date_vote` rejects bad/closed poll code | mig | POLL-02 | T-19 bearer | bad code → raise; closed poll → raise | sql (RPC) | psql | ❌ W0 | ⬜ pending |
| `cast_date_vote` dedups per (poll, device, option/date) — upsert not duplicate | mig | POLL-02 | T-19 vote-stuffing | two calls same device → 1 row, availability updated | sql | psql | ❌ W0 | ⬜ pending |
| anon role CAN call vote/tally RPC; CANNOT direct-INSERT `date_votes` | mig | POLL-02 | T-19 direct-INSERT EoP | `set role anon`: rpc OK, `insert into date_votes` → permission denied | sql (grant) | psql `set role anon` | ❌ W0 | ⬜ pending |
| Web island: nickname gate blocks vote; optimistic update + rollback on RPC error | web | POLL-02 | — | no vote before nickname; failed RPC rolls back + error toast | unit (web) | `pnpm --filter web test` (poll-vote-island.test.tsx) | ❌ W0 | ⬜ pending |
| `pollChannelName(tripId)` builder → `poll:{tripId}`; subscribe/cleanup contract | core+ios | POLL-02 | — | channel name builder single source; removeChannel on cleanup | unit | `pnpm --filter @moajoa/core test` + `pnpm --filter ios test` | ❌ W0 (extend) | ⬜ pending |
| `poll_vote_tally` correct per-option (range) + per-day (grid) counts incl. nicknames | mig | POLL-03 | T-19 info-disclosure | tally jsonb shape/counts asserted; no device tokens leaked | sql | psql | ❌ W0 | ⬜ pending |
| grid 연속블록(N박) recommender picks max-overlap contiguous window | core | POLL-03 | — | pure fn unit-tested across overlap cases | unit (core) | `pnpm --filter @moajoa/core test` (date-poll.test.ts) | ❌ W0 | ⬜ pending |
| `confirm_poll_date` host-only; writes trip dates + closes poll atomically | mig | POLL-03 | T-19 EoP | non-owner → raise; owner → trip.start/end set + poll `status='closed'` | sql (RLS) | psql | ❌ W0 | ⬜ pending |
| Closed poll rejects further votes (status gate) | mig | POLL-03 | T-19 | confirm then `cast_date_vote` → raise | sql | psql | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0018_date_polls.sql` — tables (`date_polls`, `date_poll_options`, `date_votes`, `poll_comments`) + anon-grant SECURITY DEFINER RPCs + 1 owner RPC + triggers (the security-critical surface; covered by psql assertions — no SQL test framework beyond `db reset` + manual psql, mirror 17-03 / 18-02)
- [ ] `packages/core/src/schemas/date-poll.test.ts` — schema parse + `contiguousBlock` recommender (POLL-03)
- [ ] `packages/api/src/queries/date-polls.test.ts` — mocked client chainer (mirror `plans.test.ts`) for all RPC wrappers (POLL-01/02/03)
- [ ] `apps/web/app/poll/[code]/_components/poll-vote-island.test.tsx` — nickname gate + optimistic/rollback (POLL-02)
- [ ] `apps/ios/lib/realtime.test.ts` — extend with `subscribePollChannel` channel-name + payload + cleanup cases (POLL-02)
- [ ] psql assertion script (or documented manual steps) for the anon-grant / RLS / dedup / host-only matrix — the abuse-surface proof (POLL-02/03). No jest/vitest harness runs against live PG in this repo; established pattern (17-03, 18-02) is `db reset` + psql `set role anon` / `set_config jwt.claims` assertions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Anon-abuse probe before verify | POLL-02 | Highest-Nyquist security behavior; a single wrong grant = open write surface. Sampled at SQL/RPC level, not the typed client (which always runs as the test's role). | After `0018` applies: psql `set role anon` → `cast_date_vote(valid_code,…)` OK; `insert into date_votes …` → permission denied; confirm poll → `cast_date_vote` raises. |
| End-to-end web voting on device | POLL-02 | Public island hydration + anon Realtime + presence cross-client only observable in a real browser; iOS sim/device for the host plan-tab card + confirm flow. | Host creates dateless trip + poll on `pnpm sim`; open `/poll/[code]` in two browsers, vote, observe live tally + "지금 N명 보는 중" presence; host confirms → trip dates set, poll closed, web shows 확정 result + 가입 CTA. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~30s (unit) / ~tens of seconds (SQL reset)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
