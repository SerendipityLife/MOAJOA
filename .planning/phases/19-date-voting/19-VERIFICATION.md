---
phase: 19-date-voting
verified: 2026-06-23T16:00:00Z
status: human_needed
score: 18/18 code-verifiable must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  note: "Initial verification — no prior VERIFICATION.md"
human_verification:
  - test: "iOS device/simulator host flow (19-03 Task 3) — onboarding 미정 → dateless create → mode toggle (D-07) → manage card → host confirm"
    expected: "Tap '아직 미정이에요' card → dateless create (no date card, no mode picker, CTA '날짜 투표 시작하기') → pick city → plan tab shows '날짜 투표 진행 중' card; with 0 votes the 범위형/그리드 toggle flips (persists via setPollMode) and locks once a vote arrives; '초대 링크 복사'/'코드 공유' open a share sheet with a /poll/{code} URL; '확정' → confirm sheet → destructive Alert '이 날짜로 확정하면 투표가 마감돼요.' → 확정하기 → card unmounts, normal plan renders, trip has dates."
    why_human: "Drag/@gorhom bottom-sheet interaction, navigation, and native Share.share are mocked by jest (18-05 precedent). Only a sim/device can verify the gesture + sheet + share-sheet + navigation chain."
  - test: "Web cross-browser anon voting (19-04 Task 4) — two browsers on /poll/[code]: nickname gate, anon vote both modes, live tally/presence/chat sync, closed-poll 확정 + 함께하기 CTA"
    expected: "Open /poll/{code} in two browsers (one incognito); each sets a different nickname (gate blocks voting until set); vote (range toggles or grid cells) → my toggle reflects my state, the OTHER browser's tally + nickname chips + 최다 badge + '지금 2명 보는 중' presence update live; chat messages append live across browsers, own bubbles right-brand, delete-own behind '이 메시지를 삭제할까요?' confirm; host confirms a date (iOS/psql) → /poll/{code} flips to '확정: {range}' + '이 여행에 함께하기' CTA, voting + compose disabled; closed-poll vote/comment rejected by the server gate."
    why_human: "Cross-client Supabase Realtime (live tally, presence count, chat fan-out) is only observable across ≥2 live browsers against a running Supabase; anon hydration discipline only proves out in a real anon session. Unit tests mock the channel."
---

# Phase 19: Date Voting Verification Report

**Phase Goal:** 일정이 미정인 경우 날짜 투표를 만들어 초대 링크/코드로 일행을 부르고, 무설치(웹)로 투표받아, 집계된 날짜를 여행 일정으로 확정 전환한다.
**Verified:** 2026-06-23T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All code-verifiable must-haves across the 4 plans were verified against the actual codebase (not SUMMARY claims): the migration security surface (Plan 01), the shared core/api contract (Plan 02), the iOS host path (Plan 03), and the web anon island (Plan 04). The two host/voter end-to-end flows that require a live device and ≥2 live browsers are classified as human verification (not gaps) — their underlying code, wiring, and data-flow are all present and proven by the automated gates.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Anon role can call cast/tally RPCs but CANNOT direct-INSERT date_votes | ✓ VERIFIED | `0018_date_polls.sql`: 6× `to authenticated, anon` grants; `insert into date_votes` appears ONLY inside `cast_date_vote` (L139); all 6 RLS policies `to authenticated` only; no anon table grant. Proven by 19-01 psql `set role anon` matrix (D: permission denied). |
| 2 | poll_code is server-minted, non-guessable, ≥8 chars | ✓ VERIFIED | `ensure_poll_code()` trigger uses `gen_random_bytes(8)` (L1 grep), client never supplies code. psql assert A: `poll_code='9kcyabstdcqc'` len=12, charset_ok=t. |
| 3 | A closed poll rejects all anon vote/comment writes | ✓ VERIFIED | `cast_date_vote`/`post_poll_comment` gate on `status = 'open'` (L133, L206). psql assert F: closed → `ERROR: poll not found or closed`. |
| 4 | confirm_poll_date is host-only and atomically sets trip dates + closes poll | ✓ VERIFIED | SECURITY INVOKER + `am_trip_owner(v_trip_id)` guard (L249) + `update trips … ; update date_polls set status='closed'` (L252). psql H1/H2: non-owner raises 'host only'; owner sets dates + closes. |
| 5 | cast_date_vote dedups per (poll, device, option/date) — upsert not duplicate | ✓ VERIFIED | `date_votes_dedup` unique index `nulls not distinct` + matching `on conflict (poll_id, device_token, option_id, vote_date)` (L141). psql C: 2nd call → 1 row, availability updated. |
| 6 | supabase:reset applies 0018 with 42P17=0, zero dropped-object errors | ✓ VERIFIED | 19-01 SUMMARY: `pnpm supabase:reset` 42P17 count=0, zero drops. database.ts regenerated (+187 lines). Helpers reused not redefined (grep redefine count=0). |
| 7 | pollChannelName(tripId) → 'poll:{tripId}' from a single core builder | ✓ VERIFIED | `packages/core/src/constants.ts` L236-237 `return \`poll:${tripId}\``; `POLL_CHANNEL_PREFIX='poll:'` L235. core test 77/77 green. |
| 8 | contiguousBlock picks max-overlap contiguous window | ✓ VERIFIED | `export function contiguousBlock` in date-poll.ts; date-poll.test.ts (15 cases incl. max-overlap/null/tie/sort) green. |
| 9 | date-polls.ts wrappers call the right RPCs, client-first + {error} throw | ✓ VERIFIED | `client.rpc('cast_date_vote')` ×1 + 6 other RPC wrappers ×6; 9× `if (error) throw error`. api test 35/35 green (19 date-poll cases). |
| 10 | Anon vote writes go through rpc, never direct from('date_votes').insert | ✓ VERIFIED | `grep -cE "from\('date_votes'\)\.insert\(|from\('date_comments'\)\.insert\("` = 0 in date-polls.ts. |
| 11 | getPollByTrip is the single by-trip poll read wrapper | ✓ VERIFIED | `export async function getPollByTrip` + `.eq('trip_id')` ×1 in date-polls.ts; plan.tsx uses it (`from('date_polls')`=0). |
| 12 | setPollMode is the owner-guarded mode-switch wrapper (D-07) | ✓ VERIFIED | `export async function setPollMode` + `.update({ mode })` ×1; owner-guarded by date_polls_write RLS (Plan 01). |
| 13 | Onboarding 미정 card enabled, brand-accented, routes to dateless create | ✓ VERIFIED | onboarding.tsx: `dateless=1` route present, `곧 제공` badge removed (count=0), `chevron-forward`=2 (both cards). |
| 14 | Dateless create saves trip with null dates + open poll, lands on plan tab | ✓ VERIFIED | create.tsx: `TripCreateDatelessSchema` + `createDatelessTrip` present, CTA `날짜 투표 시작하기`. ios test 87/87 green. |
| 15 | Plan tab shows 날짜 투표 card only when dateless AND poll != closed; host can toggle mode (D-07); confirm writes dates + closes | ✓ VERIFIED | plan.tsx: `날짜 투표 진행 중`=1, `getPollByTrip`, 범위형/그리드 toggle, `canChangeMode = N === 0` (L475, T-19-11 lock), `confirmPollDate(supabase,{pollId,startDate,endDate})` (L446), `subscribePollChannel(id,…)` (L239) + removeChannel cleanup. |
| 16 | subscribePollChannel(tripId) subscribes poll:{tripId}, caller cleans up | ✓ VERIFIED | realtime.ts: `export function subscribePollChannel`, `pollChannelName` in import + body; realtime.test.ts +5 cases green. |
| 17 | Anon visitor opens /poll/[code], sets nickname, votes without account; nickname gate blocks; failed RPC rolls back + toast | ✓ VERIFIED | poll-vote-island.tsx: nickname gate (`!nickname` early-return + toast `닉네임을 입력해야 투표할 수 있어요.` L192/L204; gate card L313), `castDateVote(client,{…})` L214, optimistic+rollback (7 markers). poll-vote-island.test.tsx (gate + rollback) green. |
| 18 | Cached SSR shell holds ONLY static metadata; all mutable state hydrates client-side; closed → 확정 result + 함께하기 CTA | ✓ VERIFIED | poll-cache.ts `unstable_cache` + `createClient<Database>` inside callback; page.tsx `getPollTally`=0 (no tally in shell, T-19-10); island hydrates tally via `getPollTally` in 2 useEffects (L111, L168), presence via `channel.track()`+`presenceState()`; closed branch `if (status === 'closed')` L280 → `이 여행에 함께하기` → `/login` L297-300. web build PASS with `/poll/[code]` route. |

**Score:** 18/18 code-verifiable truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0018_date_polls.sql` | 4 tables + ensure_poll_code trigger + 6 RPCs | ✓ VERIFIED | 269 lines; 4 tables, dedup index (nulls not distinct), 5 anon DEFINER RPCs + confirm (INVOKER) + dateless-create (INVOKER); 0016/0017 untouched (append-only). |
| `packages/api/src/types/database.ts` | Regenerated incl. 4 tables + 7 RPC signatures | ✓ VERIFIED | All 4 tables present (13 matches); all 7 RPC signatures (cast_date_vote, poll_vote_tally, confirm_poll_date, create_dateless_trip_with_poll, post_poll_comment, delete_poll_comment, poll_view_by_code). Committed clean. |
| `packages/core/src/schemas/date-poll.ts` | Schemas + TripCreateDatelessSchema + contiguousBlock | ✓ VERIFIED | contiguousBlock + TripCreateDatelessSchema present; barrel exported; 77/77 core green. |
| `packages/api/src/queries/date-polls.ts` | 7 RPC wrappers + getPollByTrip + setPollMode | ✓ VERIFIED | 7 RPC wrappers + getPollByTrip + setPollMode; 0 direct table inserts; 9 {error} throws; 35/35 api green. |
| `apps/ios/app/onboarding.tsx` | 미정 card → dateless route | ✓ VERIFIED | dateless=1 route, badge removed, 2 chevrons. |
| `apps/ios/app/trip/create.tsx` | Dateless create variant | ✓ VERIFIED | TripCreateDatelessSchema + createDatelessTrip + CTA copy. |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` | Management card + mode toggle + confirm + realtime | ✓ VERIFIED | All strings + call sites wired (getPollByTrip, setPollMode L392, confirmPollDate L446, subscribePollChannel L239). |
| `apps/ios/lib/realtime.ts` | subscribePollChannel append | ✓ VERIFIED | Exported; pollChannelName in import + body; existing subscribers untouched. |
| `apps/web/lib/device-token.ts` | SSR-guarded UUID + nickname store | ✓ VERIFIED | getDeviceToken (SSR guard ×3) + getStoredNickname/setStoredNickname. |
| `apps/web/lib/poll-cache.ts` | Cookies-free unstable_cache (static only) | ✓ VERIFIED | unstable_cache + anon createClient inside callback. |
| `apps/web/app/poll/[code]/page.tsx` | Static SSR shell mounting island | ✓ VERIFIED | getCachedPoll, no tally fetch, mounts PollVoteIsland. |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` | Nickname gate + 2 modes + tally + presence | ✓ VERIFIED | castDateVote, nickname gate, getPollTally useEffects, channel.track presence, closed CTA. |
| `apps/web/app/poll/[code]/_components/poll-chat.tsx` | Flat anon thread + realtime + moderation | ✓ VERIFIED | postComment L100/deleteComment L123, empty-state + delete-confirm copy, closed compose gate L180, removeChannel. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| cast/post/delete RPC | poll_code + status='open' gate | SECURITY DEFINER bearer validation | ✓ WIRED | All anon RPCs validate `poll_code … status='open'`; mirror join_shared_trip. psql matrix proven. |
| anon role | 5 anon-granted RPCs | grant execute … to authenticated, anon | ✓ WIRED | 6× `to authenticated, anon` (5 RPCs + extra); confirm/create are `to authenticated` only (host). |
| date-polls.ts | rpc('cast_date_vote' | poll_vote_tally | confirm | create) | client.rpc wrappers | ✓ WIRED | All 7 RPC names present; client-first + {error} throw. |
| getPollByTrip | date_polls by trip_id | from('date_polls').eq('trip_id').maybeSingle() | ✓ WIRED | Single read seam; plan.tsx imports it (no inline raw read). |
| constants.ts | pollChannelName | poll:${tripId} builder | ✓ WIRED | L236-237 single source; iOS + web both import it. |
| onboarding 미정 card | /trip/create?dateless=1 | router.push | ✓ WIRED | dateless=1 route present. |
| plan.tsx mode toggle | setPollMode RPC | @moajoa/api setPollMode (0-vote gated) | ✓ WIRED | setPollMode(supabase, poll.id, mode) L392, gated by canChangeMode=N===0. |
| plan.tsx 확정 | confirmPollDate RPC | @moajoa/api confirmPollDate after Alert | ✓ WIRED | confirmPollDate(supabase,{pollId,startDate,endDate}) L446. |
| realtime.ts subscribePollChannel | pollChannelName(tripId) | supabase.channel(pollChannelName(tripId)) | ✓ WIRED | Channel name built from core builder. |
| poll-vote-island.tsx | castDateVote RPC | @moajoa/api castDateVote (optimistic + rollback) | ✓ WIRED | castDateVote(client,{…}) L214 + optimistic delta + rollback. |
| island + chat | pollChannelName(tripId) public channel | supabase.channel(...).track({nickname}) | ✓ WIRED | Single public channel; vote/comment broadcast + presence; removeChannel cleanup. |
| poll-cache.ts | pollByCode (static metadata only) | unstable_cache (anon client in callback) | ✓ WIRED | Static-only cache; no mutable state (T-19-10). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| poll-vote-island.tsx | tally | getPollTally(client, code) in useEffect L111/L168 | Yes — anon RPC → poll_vote_tally (shaped jsonb counts + nicknames) | ✓ FLOWING |
| poll-vote-island.tsx | viewers | channel.presenceState() → setViewers L152 | Yes — Supabase Presence sync | ✓ FLOWING (live; cross-client confirmation = human) |
| plan.tsx (iOS) | poll / tally | getPollByTrip + getPollTally → state | Yes — typed reads against date_polls/RPC | ✓ FLOWING |
| poll-chat.tsx | messages | postComment return + broadcast fan-out | Yes — anon RPC + realtime append (no history fetch by design — anon has no comment-read path, documented) | ✓ FLOWING (live-only thread) |
| page.tsx (shell) | poll metadata | getCachedPoll (static only) | Yes — static metadata; mutable state intentionally NOT here (T-19-10) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| core schemas + contiguousBlock | `pnpm --filter @moajoa/core test` | 6 files / 77 tests passed (date-poll 15) | ✓ PASS |
| api RPC wrappers | `pnpm --filter @moajoa/api test` | 2 files / 35 tests passed (date-polls 19) | ✓ PASS |
| web island (gate + rollback) | `pnpm --filter @moajoa/web test:run` | 11 files / 65 tests passed | ✓ PASS |
| iOS host path (realtime + plan card) | `pnpm --filter @moajoa/ios test` | 13 suites / 87 tests passed | ✓ PASS |
| Workspace typecheck | `pnpm -r typecheck` | 6/6 projects Done | ✓ PASS |
| Append-only invariant | `git diff 0016/0017` | 0016/0017 NOT modified | ✓ PASS |
| All 10 task commits exist | `git cat-file -t` ×10 | All FOUND | ✓ PASS |
| No service-role in client | grep poll client code | None (anon-only) | ✓ PASS |
| Live cross-client Realtime (iOS host flow) | — | Requires sim/device | ? SKIP → human |
| Live cross-browser anon voting | — | Requires ≥2 live browsers + running Supabase | ? SKIP → human |

Total: 264 unit tests green (77+35+65+87), 6/6 typecheck — matching the SUMMARY claims, independently re-run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| POLL-01 | 19-01, 19-02, 19-03 | 일정 미정이면 날짜 투표를 만들어 초대 링크/코드로 일행을 부른다 | ✓ SATISFIED (code) | create_dateless_trip_with_poll RPC + iOS onboarding 미정 → dateless create → 날짜 투표 card + invite share (/poll/{code}). End-to-end host flow = human-UAT (19-03). |
| POLL-02 | 19-01, 19-02, 19-04 | 초대받은 일행이 무설치(웹)로 가능한 날짜에 투표한다 | ✓ SATISFIED (code) | Anon-grant cast_date_vote RPC (psql-proven) + /poll/[code] island nickname gate + 2 vote modes + optimistic castDateVote. Live anon voting = human-UAT (19-04). |
| POLL-03 | 19-01, 19-02, 19-03, 19-04 | 투표가 집계되어 확정된 날짜가 여행 일정으로 전환된다 | ✓ SATISFIED (code) | poll_vote_tally + contiguousBlock recommender + confirm_poll_date (host-only, atomic dates+close) + closed-poll 확정 result + 함께하기 CTA. Confirm → trip dates = human-UAT. |

All three phase requirement IDs (POLL-01/02/03) are declared in PLAN frontmatter, cross-referenced against REQUIREMENTS.md (all marked `[x]` Complete + traceability table "Complete"), and backed by verified artifacts. No orphaned requirements: REQUIREMENTS.md maps exactly POLL-01..03 to Phase 19, all three claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TODO/FIXME/PLACEHOLDER/stub data flowing to UI found in any modified file | ℹ️ Info | None. 19-03 SUMMARY "Known Stubs: None" independently confirmed — contiguousBlock + tally summaries are advisory-by-design (T-19-02), not stubs. |
| poll-chat.tsx | — | Empty initial message list (live-only thread, no history fetch) | ℹ️ Info | Intentional: anon has no comment-read path (date_comments_read is `to authenticated` only, by design Plan 01). Documented decision, not a gap — overwritten by live broadcasts + own optimistic appends. |

### Human Verification Required

Two end-to-end flows require a live runtime an automated agent cannot drive. Both are documented in the plan SUMMARYs as `checkpoint:human-verify` and the VALIDATION.md "Manual-Only Verifications" table. Their underlying code, wiring, and data-flow are fully verified above — these are confirmation of live behavior, not closure of code gaps.

1. **iOS device/simulator host flow (19-03 Task 3).** Run `pnpm sim`, log in, then: onboarding 미정 card → dateless create (no date card / no mode picker / CTA `날짜 투표 시작하기`) → plan tab `날짜 투표 진행 중` card → toggle 범위형/그리드 with 0 votes (persists via setPollMode, locks once a vote arrives) → `초대 링크 복사`/`코드 공유` share sheet with /poll/{code} → `확정` sheet → destructive Alert `이 날짜로 확정하면 투표가 마감돼요.` → 확정하기 → card unmounts, normal plan renders, trip has dates.
   *Why human:* @gorhom bottom-sheet gestures + navigation + native Share.share are jest-mocked (18-05 precedent).

2. **Web cross-browser anon voting (19-04 Task 4).** Open /poll/{code} in two browsers (one incognito); each sets a different nickname (gate blocks until set); vote both modes → other browser's tally + nickname chips + 최다 badge + `지금 2명 보는 중` presence update live; chat appends live cross-browser, delete-own behind `이 메시지를 삭제할까요?`; host confirms → /poll/{code} flips to `확정: {range}` + `이 여행에 함께하기` CTA, voting + compose disabled; closed-poll vote/comment rejected by server gate.
   *Why human:* Cross-client Supabase Realtime (live tally, presence count, chat fan-out) is only observable across ≥2 live browsers against a running Supabase; the channel is mocked in unit tests.

### Gaps Summary

No code-level gaps. All 18 code-verifiable observable truths pass at all four verification levels (exists, substantive, wired, data-flowing). The migration security model is independently confirmed (anon RPC-only writes, no direct anon INSERT, host-only confirm, poll-open gate, dedup upsert, no PII leak in tally), all four plan artifact sets are present and substantively wired, the full 264-test suite + 6/6 typecheck re-run green, all 10 task commits exist, and append-only / no-service-role-in-client invariants hold.

**Accepted deferrals (NOT gaps):**
- **Remote `supabase db push`** — DEFERRED per the established 17-03 / 18-02 precedent (requires SUPABASE_ACCESS_TOKEN + linked project + interactive confirm). 0018 is applied and proven on LOCAL PG17 (42P17=0, full psql security matrix). Plans 02-04 build against the locally-regenerated database.ts; remote apply is a deploy-time step, not a phase-goal gap.
- **D-03 soft-nudge "결과 정해지면 알림 받기"** — DEFERRED (19-04 plan `<deferred>`): depends on mail/push infra out of Phase 19 scope (CONTEXT §Deferred Ideas → Phase 21). Conscious deferral, not a coverage gap.

Status is **human_needed** (not passed) solely because the two live-UAT items above are non-empty per the Step 9 decision tree — automated checks are all green.

---

_Verified: 2026-06-23T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
