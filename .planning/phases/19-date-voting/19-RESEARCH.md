# Phase 19: Date Voting (일정 미정 분기) - Research

**Researched:** 2026-06-23
**Domain:** Supabase anonymous-write data model + RLS/RPC security, Realtime Presence/Broadcast, dateless trip lifecycle, cross-platform (iOS Expo + Next.js anon island) date-poll aggregation
**Confidence:** HIGH (all stack claims verified against the in-repo 0016 baseline + Supabase docs; the few open items are flagged in Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**투표자 신원·초대 (Area 1)**
- **D-01:** 투표자 = **비로그인**(앱·계정 불필요) + **닉네임 필수** + 기기 토큰(localStorage UUID)으로 중복 방지. "무설치"=완전 익명(계정 없음)이되, 호스트 집계가 "누가 어떤 날짜 되는지" 보이도록 닉네임으로 식별. 이름 없는 진짜 익명은 집계 무의미 → 금지. Phase 10의 "익명 X"는 *장소* 투표 맥락 — *날짜* 투표는 익명 허용으로 분기.
- **D-02:** 초대 = **링크 + 코드**. poll code가 **bearer capability** — 코드/링크 소지 = 투표·댓글 권한. (trip `share_slug`/`ensure_share_slug` 재사용 검토하되, `join_shared_trip`은 로그인 필요라 호스트/가입 전환에만 쓰고, 익명 투표 경로는 별도 코드 검증.)
- **D-03:** 가입(고객) 전환 = **확정 결과 화면 중심**. 투표 중 로그인 0. 확정 후 "이 여행에 함께하기" → 매직링크 가입. 투표 직후엔 optional soft nudge("결과 정해지면 알림 받기")만, 페이월 아님.

**Trip ↔ Poll 생애주기·데이터 모델 (Area 2)**
- **D-04:** 온보딩 "미정" 선택 → **날짜 없는 trip 즉시 생성**(trips.start/end_date nullable) + `date_polls.trip_id` FK로 poll 부착. 확정 시 `trip.start_date/end_date` UPDATE만. share_slug·4탭 셸 재사용. trip 목록엔 "일정 미정" 배지. → **날짜 optional한 새 create 경로 필요**.
- **D-05:** 호스트 poll 관리 표면 = **plan 탭 상단 카드**(날짜 미정 trip일 때만). plan.tsx(Phase 18 상태머신)에 surgical 분기. 확정되면 카드 사라지고 일반 플랜.
- **D-06:** 온보딩 "미정" 카드 활성화 — 현재 disabled. 이 phase가 활성화.

**투표 대상 구조 (Area 3)**
- **D-07:** **두 투표 모드**, 호스트 생성 시 선택. `date_polls.mode ['range','grid']`. range: 후보 날짜범위 N개 → 가능/불가. grid: poll 윈도우 + per-day 투표(when2meet식), 집계는 날짜별 카운트 + 연속블록 추론. 데이터 모델은 통합 votes(availability) 위에 두 모드(단일일 = start==end).
- **D-08:** 가능성 = **가능/불가 2단**(binary enum). 호스트 최종확정이 타이브레이커. maybe 과다 → 재투표 강제 없음.

**집계·확정 전환 (Area 4)**
- **D-09:** 확정 = **호스트만**. 집계는 모두 열람(anon-grant). range=후보 옵션 하나 선택, grid=연속블록(N박) 선택 → 최종 `(start_date, end_date)`가 `trip` 날짜로 기록. **최다득표 자동확정 없음**.
- **D-10:** 확정 후 = poll `status='closed'`(읽기전용, 투표 마감). trip 일정 확정. 웹 투표페이지 = "확정: 6/14–16" 결과 + "이 여행에 함께하기" CTA. 재투표 = 새 poll 생성(재오픈 없음).

**댓글 스레드 (Area 4 추가)**
- **D-11:** **댓글 스레드 포함**. poll(trip)당 **단일 flat 스레드**(중첩/멘션/이미지 X). 작성자 = 투표자와 동일 익명 모델(닉네임+기기토큰) + 호스트. 삭제 = 호스트 any / 작성자 own(기기토큰 일치). 실시간 = 기존 broadcast 패턴 재사용. 어뷰즈 = votes와 동일 기기토큰 + 레이트 제한. **익명 write는 votes 보안면(anon RLS + 코드=bearer) 재사용 = 증분.** (UI-phase 추가) 표현 = **채팅식** 인라인 스레드 + **presence UI**(Supabase Realtime Presence 같은 채널에 얹음).

### Claude's Discretion
- 옵션 개수 상한(2–10 권장), poll code 형식(trip share_slug 파생 vs 독립 코드), 정확한 테이블 분할(votes 통합 vs range/grid 분리, comments 테이블), 실시간 채널명, 웹 라우트(`/poll/[code]` 신규 vs `/t/[slug]` 재사용), soft nudge 정확 문구·배치, 기기토큰 생성/저장 방식.
- **권장(보안):** 익명 INSERT는 RLS 직접 anon insert보다, **코드를 검증한 뒤 삽입하는 SECURITY DEFINER RPC(anon grant)** 패턴이 안전(join_shared_trip / vote_counts_for_places anon-grant idiom 미러).

### Deferred Ideas (OUT OF SCOPE)
- 마감일 자동확정 (호스트 수동확정만)
- 3단 가능성(가능/가능하면/불가) — 도그푸딩서 필요하면 enum 확장
- 댓글 고도화 (중첩 답글·멘션·이미지·이모지) — flat 스레드만
- 이메일 초대 발송 인프라 (링크/코드 OS 공유만)
- poll 재오픈/재확정 (재투표 = 새 poll)
- 장소 투표를 날짜 poll에 결합 (별개 흐름)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLL-01 | 일정 미정이면 날짜 투표를 만들어 초대 링크/코드로 일행을 부른다 | §Standard Stack (date_polls/options 테이블 + poll_code 파생), §Architecture Pattern 1 (dateless trip create RPC), §Architecture Pattern 4 (호스트 관리 카드 + share). 호스트는 인증 사용자 → 기존 `can_edit_trip` RLS로 보호. |
| POLL-02 | 초대받은 일행이 무설치(웹)로 가능한 날짜에 투표한다 | §Architecture Pattern 2 (anon SECURITY DEFINER vote RPC = 코드 검증 후 삽입), §Architecture Pattern 5 (anon Realtime public channel — login 없이 broadcast+presence), §Don't Hand-Roll (device token, presence), §Common Pitfalls (public SSR cache GOTCHA + anon abuse surface). |
| POLL-03 | 투표가 집계되어 확정된 날짜가 여행 일정으로 전환된다 | §Architecture Pattern 3 (anon-grant 집계 RPC = `vote_counts_for_places` 미러), §Architecture Pattern 6 (호스트 confirm RPC → trip 날짜 UPDATE + poll closed), §Validation Architecture (집계 정확성 + grid 연속블록 추론 테스트). |
</phase_requirements>

## Summary

This phase is an **incremental composition of patterns the codebase already proves out**, plus exactly one genuinely new security surface: **anonymous writes** (votes + comments by un-authenticated web visitors). Every other concern — append-only migration, SECURITY DEFINER cross-table RLS helpers, anon-grant aggregation RPCs, public-channel Realtime broadcast, dateless trips, the web `'use client'` island that never touches the cached SSR render — has a verbatim precedent in `0016_trips_baseline.sql`, `vote_counts_for_places`, `join_shared_trip`, `subscribePlanProgress`, and `vote-island.tsx`. The planner's job is mostly **mirroring**, not inventing.

The one decision that drives the whole security model: **anonymous voters/commenters must write through SECURITY DEFINER RPCs granted to `anon` that validate the poll code before inserting** — never through a direct anon-role RLS `INSERT` policy on the `date_votes`/`date_comments` tables. This mirrors `join_shared_trip` (validate bearer slug → write a new row as the function owner) and is the security-recommended pattern per Supabase's own hardening guidance. The poll code is a **bearer capability**: possessing it grants write access, scoped by a client-generated **device token** (localStorage UUID) for dedup and rate limiting. The abuse surface is real but bounded — see Common Pitfalls.

On Realtime: the codebase already uses **public (non-private) broadcast channels** with the anon key (`extract:{link_id}`, `plan:{trip_id}`). Verified against Supabase docs: **public channels bypass RLS and allow un-authenticated anon-key clients to subscribe, broadcast, AND track presence** without login. So Presence "지금 N명 보는 중" + comment broadcast + vote broadcast all coexist on one public channel keyed by trip/poll, with no JWT required. (`enable_anonymous_sign_ins = false` in `config.toml` is about Supabase *anonymous sign-in* — a different feature — and does NOT block anon-key public-channel Realtime.)

**Primary recommendation:** Add `0018_date_polls.sql` with four tables (`date_polls`, `date_poll_options`, `date_votes`, `date_comments`), a `poll_code` derived from a new `ensure_poll_code` trigger (independent code, not slug-derived), and **five anon-granted SECURITY DEFINER RPCs**: `poll_view_by_code` (read), `cast_date_vote` (validate code + device-scoped upsert), `poll_vote_tally` (aggregate), `post_poll_comment` (validate code + insert), `delete_poll_comment` (device-token OR host). Host-only confirm is a single SECURITY INVOKER RPC `confirm_poll_date` guarded by `am_trip_owner`. Web votes/comments/presence hydrate client-side on one public Realtime channel `poll:{trip_id}`; the public SSR shell stays cookies-free.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dateless trip create | API / Backend (RPC or insert) | iOS client (form) | `trips.start/end_date` already nullable (0016); needs a date-optional create path. Host is authenticated → standard owner RLS. |
| Poll create + options | API / Backend | iOS client (host card) | Host-only write, guarded by `can_edit_trip(trip_id)`. Code minted by DB trigger (server-authoritative, like `ensure_share_slug`). |
| Poll code = bearer invite | Database (trigger) | — | Non-guessable code must be server-generated; client never forges it (mirror `ensure_share_slug`). |
| Anonymous vote write | Database (SECURITY DEFINER RPC, anon grant) | Web island | The new security surface. Code validation + device dedup MUST happen server-side in the DEFINER function — never trust client-supplied trip_id/poll_id directly. |
| Anonymous comment write | Database (SECURITY DEFINER RPC, anon grant) | Web island | Same model as vote (D-11 explicitly: "increment, not a new model"). |
| Vote/comment aggregation | Database (SECURITY DEFINER RPC, anon grant) | Web + iOS read | Public social proof; anon-readable like `vote_counts_for_places`. Keeps row-level detail private; returns only the shaped tally. |
| Host confirm → trip dates | Database (SECURITY INVOKER RPC, owner-guarded) | iOS host card | Host-only; runs as the caller so `am_trip_owner` / owner RLS applies. Writes `trip` dates + flips poll `status='closed'` atomically. |
| Live tally + comments + presence | CDN/Edge (Realtime public channel) | Web + iOS | One public channel `poll:{trip_id}`; anon-key clients broadcast/track presence without auth. |
| Public SSR shell of `/poll/[code]` or `/t/[slug]` | Frontend Server (Next.js, `unstable_cache`) | — | Cookies-free cached anon render; ALL mutable poll/vote/chat/presence state hydrates client-side (10-PATTERNS GOTCHA). |
| Device identity (nickname + token) | Browser / Client (localStorage) | — | No account; UUID device token persisted in localStorage scopes dedup + own-comment delete. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.45.4 | DB client, RPC calls, Realtime (broadcast + presence) | [VERIFIED: apps/web + apps/ios package.json both ^2.45.4] Already the single client across web/iOS. Presence/broadcast API is on `supabase.channel(...)`. |
| `@supabase/ssr` | (web, via browser.ts) | Anon browser client for the web island | [VERIFIED: apps/web/lib/supabase/browser.ts] `createBrowserClient<Database>` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The voting island uses exactly this. |
| `@moajoa/core` (Zod) | workspace | Shared poll/vote/comment schemas + constants (channel builder, mode enum) | [VERIFIED: packages/core] All external input validated via Zod here; mirror `plan.ts` + `constants.ts` idioms. |
| `@moajoa/api` | workspace | Typed queries/RPC wrappers (`pollByCode`, `castDateVote`, `postComment`, `confirmPollDate`) | [VERIFIED: packages/api/src/queries] client-first signature, `{error}` throw, RLS-only — mirror `trips.ts`/`votes.ts`. |
| `crypto.randomUUID()` | Web standard | Device token generation (localStorage) | [VERIFIED: browser standard, available in all target browsers + RN Hermes] No new dependency. Mirror nothing custom. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@gorhom/bottom-sheet` | ^5.2.14 (iOS) | Host confirm flow sheet (range option list / grid block selection) | [VERIFIED: apps/ios package.json + 03-05 + UI-SPEC Screen 3] Already used for pin/board sheets; UI-SPEC mandates it for the confirm sheet. |
| `react-native-gesture-handler` + `react-native-reanimated` | ~2.31 / ~4.3 (iOS) | grid drag-to-paint (optional) | [VERIFIED: STATE 18-05 — handrolled with installed Reanimated 4-safe primitives, 0 new deps] UI-SPEC Screen 4b notes drag optional; a tap-per-cell baseline needs no gesture lib. |
| `lucide-react` (web) / Ionicons (iOS) | existing | Icons (Check on confirm, calendar, presence dots) | [VERIFIED: UI-SPEC §Design System] No new icon lib. |
| `vitest` | ^1.6.0 | core + api unit tests | [VERIFIED: packages/core + packages/api package.json] |
| `jest` + `jest-expo` | ^29.7.0 / ~56.0.5 | iOS component/logic tests | [VERIFIED: apps/ios package.json] |
| Deno test (built-in) | — | If any vote/comment write moves to an Edge Function (NOT recommended — see below) | [VERIFIED: supabase/functions/* use deno tests] Only relevant if a rate-limit EF is added; MVP keeps writes in RPC. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Anon SECURITY DEFINER RPC for writes | Direct anon-role RLS `INSERT` policy on `date_votes` | [CITED: supabase.com/docs/guides/api/securing-your-api] Direct anon INSERT exposes the table to arbitrary writes scoped only by a policy `WITH CHECK`; the client supplies `poll_id`/`trip_id` and you must re-validate the code in the policy (awkward, leaks existence). The DEFINER RPC validates the code as the function owner and inserts a controlled row — same idiom as `join_shared_trip`. **Strongly recommended.** |
| Independent `poll_code` (new trigger) | Reuse trip `share_slug` as the poll code | `join_shared_trip(share_slug)` requires login (it inserts a membership for `auth.uid()`), so the slug is already the *authenticated* invite path (host/conversion). Overloading it for the anon vote path conflates two capabilities. A separate `poll_code` keeps the anon bearer scope independent and lets you invalidate it (close poll) without touching trip sharing. **Recommended: independent code.** |
| Unified `date_votes` table (availability rows) over both modes | Separate `range_votes` + `grid_votes` tables | D-07 explicitly says "통합 votes(availability) 위에 두 모드". A single `date_votes(option_id NULL-able, vote_date NULL-able, availability)` row covers both: range → `option_id` set; grid → `vote_date` set. Single-day = `start==end`. **Recommended: unified table.** |
| Comment write via RPC | Direct anon INSERT into `date_comments` | Same reasoning as votes — D-11 says reuse the vote security surface. **Recommended: RPC.** |
| Realtime broadcast for tally updates | Postgres Changes (DB replication) on `date_votes` | Postgres Changes requires the table in the `supabase_realtime` publication + RLS on the *table* for anon reads (more surface). Broadcast on a public channel needs no table exposure and matches the existing `extract:`/`plan:` idiom. **Recommended: broadcast** (client emits after a successful RPC, or the RPC's caller re-fetches the tally). |

**Installation:**
```bash
# NO new dependencies required. All libraries above are already installed.
# Verify (no install):
node -e "console.log(require('./apps/web/package.json').dependencies['@supabase/supabase-js'])"
```

**Version verification:**
```bash
# Confirmed in-repo (do not bump):
# @supabase/supabase-js ^2.45.4 (web + ios)  [VERIFIED: package.json read 2026-06-23]
# @gorhom/bottom-sheet ^5.2.14 (ios)         [VERIFIED: package.json]
# vitest ^1.6.0 (core/api/web), jest ^29.7.0 + jest-expo ~56.0.5 (ios) [VERIFIED]
```
> Realtime Presence/Broadcast are part of supabase-js core — no separate package. The `channel().on('presence', ...)` + `channel().track()` API is stable in v2.45.

## Architecture Patterns

### System Architecture Diagram

```
                          HOST (authenticated, iOS app)
                                     │
            ┌────────────────────────┼─────────────────────────┐
            │                        │                          │
   온보딩 "미정" 카드          plan 탭 관리 카드            확정 (호스트만)
            │                        │                          │
            ▼                        ▼                          ▼
  create dateless trip      create date_poll +        confirm_poll_date(RPC,
  (start/end null) +        date_poll_options          SECURITY INVOKER,
  attach date_polls.trip_id  (mode range|grid)         am_trip_owner guard)
            │                        │                          │
            │                        │              writes trip.start/end_date
            │                        │              + date_polls.status='closed'
            ▼                        ▼                          │
   ┌──────────────────────────────────────────────────────────┘
   │  Postgres (Supabase)  ── append-only 0018 ──
   │  trips(start/end nullable) ◀── FK ── date_polls(trip_id, poll_code, mode, status)
   │                                          │
   │                          ┌───────────────┼────────────────┐
   │                  date_poll_options   date_votes        date_comments
   │                  (range: start,end)  (option_id|        (poll_id, device_token,
   │                                       vote_date,         nickname, body)
   │                                       availability,
   │                                       device_token,
   │                                       nickname)
   │
   │  Anon-granted SECURITY DEFINER RPCs (validate poll_code = bearer):
   │    poll_view_by_code(code)  cast_date_vote(code, device, nickname, ...)
   │    poll_vote_tally(code)    post_poll_comment(code, device, nickname, body)
   │    delete_poll_comment(comment_id, device)  [host OR own]
   └──────────────────────────────────────────────────────────
                                     ▲
                                     │ anon key (no login)
   ┌─────────────────────────────────┴──────────────────────────────┐
   │  INVITEE (anonymous, web browser)  /poll/[code] or /t/[slug]    │
   │                                                                  │
   │  Next.js SSR shell (unstable_cache, cookies-free)                │
   │     └─ static poll metadata (title, mode, options) — cached      │
   │  'use client' island (hydrates EVERYTHING mutable):              │
   │     nickname gate ─▶ localStorage device_token (crypto.randomUUID)│
   │     vote toggles ──▶ cast_date_vote RPC (optimistic + rollback)  │
   │     live tally ◀──── poll_vote_tally RPC + Realtime broadcast    │
   │     chat thread ◀──▶ post_poll_comment RPC + broadcast append    │
   │     presence ◀─────▶ channel.track({nickname}) on poll:{trip_id} │
   │                                                                  │
   │  ONE public Realtime channel poll:{trip_id}:                     │
   │     broadcast(vote) + broadcast(comment) + presence(viewers)     │
   └──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
supabase/migrations/
└── 0018_date_polls.sql              # NEW (append-only; never touch 0016/0017)

packages/core/src/schemas/
├── date-poll.ts                     # NEW — DatePollSchema, DatePollOptionSchema,
│                                    #   DateVoteSchema, DateCommentSchema, mode enum,
│                                    #   CastDateVoteRequest, PollViewByCode result
└── index.ts                         # + export * from './date-poll'

packages/core/src/
└── constants.ts                     # + pollChannelName(tripId), DatePollMode,
                                     #   DateAvailability, POLL_* limits, device-token key

packages/api/src/queries/
├── date-polls.ts                    # NEW — pollByCode, createDatePoll, castDateVote,
│                                    #   getPollTally, postComment, deleteComment,
│                                    #   confirmPollDate, createDatelessTrip
└── index.ts                         # + export * from './date-polls'

apps/ios/app/
├── onboarding.tsx                   # ACTIVATE 미정 card (Screen 1)
├── trip/create.tsx                  # dateless variant (Screen 2) — or new ?dateless=1 branch
└── trip/[id]/plan.tsx               # surgical 날짜 투표 관리 카드 branch (Screen 3)

apps/ios/lib/
└── realtime.ts                      # + subscribePollChannel(tripId, handlers) — APPEND only

apps/web/app/poll/[code]/            # NEW route (recommended over reusing /t/[slug])
├── page.tsx                         # SSR shell (cached, cookies-free)
└── _components/
    ├── poll-vote-island.tsx         # 'use client' — nickname/vote/tally/presence
    └── poll-chat.tsx                # 'use client' — flat thread + presence strip

apps/web/lib/
└── device-token.ts                  # crypto.randomUUID localStorage wrapper
```

### Pattern 1: Dateless trip create (D-04)
**What:** A create path that leaves `trips.start_date`/`end_date` NULL and (optionally) creates the poll atomically.
**When to use:** Onboarding "미정" card → first plan-tab visit.
**Recommendation:** Add a `TripCreateDatelessSchema` in core (title + city_code, NO dates) and either (a) a thin `createDatelessTrip` query that inserts without dates, or (b) a single RPC `create_dateless_trip_with_poll(p_city_code, p_title, p_mode, ...)` that inserts the trip and the poll in one transaction. **Prefer (b)** so the trip never exists in a "dateless, no poll" limbo state that the plan-tab card logic would have to special-case. Both rely on `trips.start/end_date` already being nullable.

```typescript
// Source: mirror packages/core/src/schemas/trip.ts (TripCreateSchema) — drop the date fields
export const TripCreateDatelessSchema = z.object({
  title: z.string().min(1).max(Limits.TripTitleMax),
  city_code: z.string().max(20),
  poll_mode: z.enum(DatePollMode), // 'range' | 'grid'
});
```
```sql
-- Source: mirror trips insert path (0016) + representative trigger fires automatically.
-- SECURITY INVOKER so owner RLS + trips_default_representative trigger apply normally.
create or replace function create_dateless_trip_with_poll(
  p_title text, p_city_code text, p_mode text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare v_trip trips; v_poll date_polls;
begin
  insert into trips (title, city_code) values (p_title, p_city_code) returning * into v_trip;
  insert into date_polls (trip_id, mode, status) values (v_trip.id, p_mode, 'open') returning * into v_poll;
  return jsonb_build_object('trip_id', v_trip.id, 'poll_id', v_poll.id, 'poll_code', v_poll.poll_code);
end; $$;
grant execute on function create_dateless_trip_with_poll(text, text, text) to authenticated;
```
[VERIFIED: trips nullable dates 0016 L127-128] [ASSUMED: combining into one RPC is cleaner — planner may split if they prefer the trip-then-poll two-step on the client]

### Pattern 2: Anonymous vote write — SECURITY DEFINER RPC (the new security surface, POLL-02)
**What:** Anon visitor casts an availability vote; the RPC validates the bearer `poll_code`, then upserts a device-scoped row as the function owner (RLS-bypassing, but controlled).
**When to use:** Every anon write (votes + comments).
**Why this and not direct anon INSERT:** The DEFINER function is the *only* way the anon role can write these tables; the `date_votes`/`date_comments` tables grant NO direct INSERT to anon. Code validation lives in one auditable place. This is the `join_shared_trip` idiom (validate bearer slug → controlled write).

```sql
-- Source: mirror join_shared_trip (0016 L631) — validate bearer, controlled write, DEFINER.
create or replace function cast_date_vote(
  p_code text,
  p_device_token text,
  p_nickname text,
  p_option_id uuid default null,   -- range mode
  p_vote_date date default null,   -- grid mode
  p_availability text default 'available'  -- 'available' | 'unavailable'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_poll date_polls;
begin
  -- 1. bearer validation: code must exist AND poll still open
  select * into v_poll from date_polls where poll_code = p_code and status = 'open' limit 1;
  if v_poll.id is null then raise exception 'poll not found or closed'; end if;

  -- 2. input integrity (avoid trusting client trip_id/poll_id at all — derived from code)
  if p_nickname is null or char_length(btrim(p_nickname)) = 0 then
    raise exception 'nickname required';
  end if;
  if v_poll.mode = 'range' and p_option_id is null then raise exception 'option required'; end if;
  if v_poll.mode = 'grid'  and p_vote_date is null then raise exception 'date required'; end if;
  if p_availability not in ('available','unavailable') then raise exception 'bad availability'; end if;

  -- 3. device-scoped upsert (dedup: one row per (poll, device, option|date))
  insert into date_votes (poll_id, device_token, nickname, option_id, vote_date, availability)
  values (v_poll.id, p_device_token, p_nickname, p_option_id, p_vote_date, p_availability)
  on conflict (poll_id, device_token, coalesce(option_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(vote_date, '0001-01-01'::date))
  do update set availability = excluded.availability, nickname = excluded.nickname;
end; $$;
grant execute on function cast_date_vote(text, text, text, uuid, date, text) to authenticated, anon;
```
[VERIFIED: join_shared_trip DEFINER bearer idiom 0016 L631-665] [VERIFIED: anon grant idiom 0016 L626/L682/L758]
> **The conflict-target trick:** because `option_id`/`vote_date` are independently nullable per mode, the unique index must coalesce NULLs to sentinels. The planner should define the unique index in SQL to match (`unique (poll_id, device_token, coalesce(option_id, sentinel), coalesce(vote_date, sentinel))` is not directly indexable — use a unique index on `(poll_id, device_token, option_id, vote_date)` with `NULLS NOT DISTINCT` in PG15+, which this DB has — major_version 17 [VERIFIED: config.toml db.major_version = 17]).

```sql
-- PG15+ NULLS NOT DISTINCT makes the dedup index clean (no sentinel coalesce needed):
create unique index date_votes_dedup
  on date_votes (poll_id, device_token, option_id, vote_date) nulls not distinct;
```

### Pattern 3: Anon-grant aggregation RPC (POLL-03 read)
**What:** Returns the shaped tally (per-option or per-day counts + who) without exposing raw rows.
**When to use:** Web + iOS read the tally; granted to `anon` so the public page shows live social proof.

```sql
-- Source: mirror vote_counts_for_places (0016 L613) — DEFINER, anon-grantable aggregate.
create or replace function poll_vote_tally(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_poll date_polls; v_result jsonb;
begin
  select * into v_poll from date_polls where poll_code = p_code limit 1;
  if v_poll.id is null then return null; end if;

  if v_poll.mode = 'range' then
    select jsonb_agg(jsonb_build_object(
      'option_id', o.id, 'start_date', o.start_date, 'end_date', o.end_date,
      'available_count', (select count(*) from date_votes v
                          where v.option_id = o.id and v.availability = 'available'),
      'nicknames', (select coalesce(jsonb_agg(distinct v.nickname), '[]'::jsonb)
                    from date_votes v where v.option_id = o.id and v.availability = 'available')
    ) order by o.start_date)
    into v_result from date_poll_options o where o.poll_id = v_poll.id;
  else -- grid: per-date counts
    select jsonb_agg(jsonb_build_object(
      'vote_date', d.vote_date,
      'available_count', d.cnt, 'nicknames', d.names
    ) order by d.vote_date)
    into v_result from (
      select v.vote_date, count(*) cnt, jsonb_agg(distinct v.nickname) names
      from date_votes v where v.poll_id = v_poll.id and v.availability = 'available'
      group by v.vote_date
    ) d;
  end if;
  return jsonb_build_object('mode', v_poll.mode, 'status', v_poll.status, 'tally', coalesce(v_result, '[]'::jsonb));
end; $$;
grant execute on function poll_vote_tally(text) to authenticated, anon;
```
[VERIFIED: vote_counts_for_places aggregate idiom 0016 L613-624]
> **Grid 연속블록(N박) 추론 (D-09):** This is a *host-side confirm* concern, not aggregation. The host sees per-day counts and picks a contiguous `[start_date, end_date]` block. The *recommendation engine* (which contiguous run maximizes overlap) can be **pure client-side TS** over the per-day tally — a sliding window that, for each candidate run length, finds the window whose minimum daily available-count is highest. Put this pure function in `@moajoa/core` so it is unit-testable (Validation Architecture covers it). Do NOT hand-roll it in SQL.

### Pattern 4: Host management card on the plan tab (D-05, POLL-01)
**What:** Surgical branch in `plan.tsx` state machine: when trip is dateless AND has an open poll, render the management card above the normal plan UI.
**When to use:** Mirror the Phase 18 state-machine branch addition idiom (STATE 18-05).
**Realtime:** Subscribe to `poll:{trip_id}` for live participation count (reuse `realtime.ts` append idiom — add `subscribePollChannel`, do NOT edit existing `subscribeExtractProgress`/`subscribePlanProgress`).

### Pattern 5: One public Realtime channel for votes + comments + presence (D-11, POLL-02)
**What:** A single public (non-private) channel `poll:{trip_id}` carries vote broadcasts, comment-append broadcasts, AND presence.
**Why anon works:** [VERIFIED: supabase.com/docs/guides/realtime/authorization + broadcast] Public channels bypass RLS; anon-key clients subscribe, broadcast, and `track()` presence without a JWT. This matches the existing `extract:`/`plan:` public-broadcast usage.

```typescript
// Source: mirror apps/ios/lib/realtime.ts subscribe* idiom + Supabase presence docs.
// Web island version (anon, no auth):
const channel = supabase.channel(pollChannelName(tripId), {
  config: { presence: { key: deviceToken } }, // stable per-device presence key
});
channel
  .on('broadcast', { event: 'vote' }, (msg) => applyVote(msg.payload))
  .on('broadcast', { event: 'comment' }, (msg) => appendComment(msg.payload))
  .on('presence', { event: 'sync' }, () => setViewers(Object.values(channel.presenceState())))
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ nickname, online_at: new Date().toISOString() }); // anonymous presence payload
    }
  });
// Cleanup MUST: return () => { supabase.removeChannel(channel); }  (leak guard, same as extract/plan)
```
[CITED: supabase.com/docs/guides/realtime/presence — track()/presenceState()/sync|join|leave] [VERIFIED: removeChannel cleanup idiom realtime.ts L19-22]
> **Who emits the broadcast?** After a successful `cast_date_vote`/`post_poll_comment` RPC, the *client* broadcasts `{event:'vote'|'comment', payload}` on the channel so other viewers update live. (No server/EF needed — the RPC just persists; the originating client fans out via broadcast, the same way the app already does optimistic UI then reconciles.) Alternatively, each client re-calls `poll_vote_tally` on any broadcast as the source of truth. **Recommend:** broadcast the minimal delta optimistically, and treat the next `poll_vote_tally` as reconciliation — mirrors `vote-island.tsx`'s optimistic+rollback discipline.

### Pattern 6: Host confirm → trip date transition (D-09/D-10, POLL-03)
**What:** Host-only RPC writes `trip.start_date/end_date` and flips `date_polls.status='closed'` atomically.
**When to use:** Host taps 확정 in the management card; range → chosen option's dates, grid → chosen contiguous block.

```sql
-- Source: SECURITY INVOKER so caller's owner RLS applies; explicit am_trip_owner guard.
create or replace function confirm_poll_date(
  p_poll_id uuid, p_start_date date, p_end_date date
) returns void
language plpgsql security invoker set search_path = public as $$
declare v_trip_id uuid;
begin
  select trip_id into v_trip_id from date_polls where id = p_poll_id;
  if v_trip_id is null then raise exception 'poll not found'; end if;
  if not am_trip_owner(v_trip_id) then raise exception 'host only'; end if;  -- DEFINER helper, 42P17-safe
  if p_end_date < p_start_date then raise exception 'end before start'; end if;

  update trips set start_date = p_start_date, end_date = p_end_date where id = v_trip_id;
  update date_polls set status = 'closed' where id = p_poll_id;
end; $$;
grant execute on function confirm_poll_date(uuid, date, date) to authenticated;
```
[VERIFIED: am_trip_owner DEFINER helper, no direct cross-table EXISTS, 0016 L220] [VERIFIED: owner RLS on trips UPDATE 0016 L187]
> **One RPC vs client-side:** Use the RPC (not two client `.update()` calls) so the trip-date write and the poll-close are atomic and the host-only check is server-enforced. A client-side two-step could leave a half-confirmed poll if the second call fails.

### Anti-Patterns to Avoid
- **Direct anon-role RLS INSERT on `date_votes`/`date_comments`:** exposes the table; forces code re-validation inside a policy `WITH CHECK` (clumsy, leaks existence). Use the DEFINER RPC.
- **Reusing `share_slug`/`join_shared_trip` for the anon vote path:** that path requires login (inserts a membership for `auth.uid()`). The anon vote path is code-only, no membership. Keep `poll_code` independent.
- **Private Realtime channel (`config:{private:true}`) for the anon island:** private channels enforce RLS via `realtime.messages` and require a JWT — anon visitors have none. Use a **public** channel (the existing idiom).
- **Touching the cached SSR render with poll/vote state:** the `/poll/[code]` (or `/t/[slug]`) SSR shell is cookies-free `unstable_cache`. Putting vote/presence/chat into the cached render poisons every anon viewer with one viewer's state (10-PATTERNS GOTCHA). Hydrate ALL mutable state client-side.
- **Editing `subscribeExtractProgress`/`subscribePlanProgress`:** append `subscribePollChannel`; never modify the existing functions (surgical-change rule + 18-05 precedent of diff = import line + append block only).
- **Trusting client-supplied `trip_id`/`poll_id` in anon writes:** derive everything from the validated `poll_code` inside the DEFINER function. The client only ever sends the code + device token + nickname + the vote payload.
- **Auto-confirming the most-voted date:** D-09 forbids it. Host always picks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Non-guessable poll code | Custom random-string generator in TS | DB trigger `ensure_poll_code` mirroring `ensure_share_slug` (0016 L158) | Server-authoritative; client can't forge; collision/entropy handled like the proven slug path. |
| Anon write authorization | Per-table anon RLS INSERT policies | SECURITY DEFINER RPC + anon grant (mirror `join_shared_trip`) | One auditable validation point; table stays closed to direct anon writes. |
| Vote aggregation | Client-side count over fetched rows | `poll_vote_tally` anon-grant RPC (mirror `vote_counts_for_places`) | Keeps row detail private; one round-trip; consistent counts for all viewers. |
| Presence ("지금 N명 보는 중") | Custom WebSocket / heartbeat table | Supabase Realtime Presence `track()` on the public channel | Built-in join/leave/sync, server-merged state, no DB writes. |
| Live tally/chat fan-out | Polling the tally RPC on a timer | Realtime broadcast on `poll:{trip_id}` | Existing idiom; push not poll. |
| Device identity | Cookie + server session | `crypto.randomUUID()` in localStorage | No account, no server state; the bearer-code + device-token model needs nothing more. |
| Cross-table RLS check | Direct `EXISTS (select … from trips …)` in a policy | `am_trip_owner` / `can_edit_trip` DEFINER helpers | 42P17 recursion guard (CLAUDE.md §4.4); the whole 0016 baseline depends on this. |
| Atomic confirm | Two client `.update()` calls | `confirm_poll_date` RPC | Atomic trip-date write + poll-close; host-only enforced server-side. |

**Key insight:** This phase's "new" work is 90% *re-instantiating* the 0016 security idioms for a new (anon) caller class. The only genuinely novel decision is "anon writes go through DEFINER RPCs, scoped by a bearer code + device token" — and even that mirrors `join_shared_trip`. Resist building anything custom; the abuse surface gets worse, not better, with hand-rolled code (per Supabase hardening guidance).

## Runtime State Inventory

> This is a greenfield additive phase (new tables, new RPCs, new routes) — NOT a rename/refactor. No existing runtime state is being renamed or migrated.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by reading 0016/0017; no existing string/key is being renamed. New tables only. | None |
| Live service config | None — no external service (n8n/Datadog/etc.) holds a Phase 19 string. Realtime channel names are code constants (`pollChannelName`). | None |
| OS-registered state | None — no Task Scheduler / pm2 / launchd registrations involved. | None |
| Secrets/env vars | None new. Web island uses existing `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key (anon writes go through anon-granted RPCs, not EFs). | None |
| Build artifacts | After 0018 applies: `pnpm supabase:types` MUST regenerate `packages/api/src/types/database.ts` (new tables/RPCs). Stale types otherwise. | `pnpm supabase:types` after migration (mirror 18-02 Task 2). |

**The canonical question** ("after every file is updated, what runtime systems still hold the old string?") is N/A — nothing is renamed. The only non-source artifact to refresh is the generated `database.ts` (a build step, already in the workflow).

## Common Pitfalls

### Pitfall 1: Anon-write abuse surface (the headline risk)
**What goes wrong:** The `poll_code` is a bearer capability. Anyone with the code (or who guesses/leaks it) can call `cast_date_vote`/`post_poll_comment` from `curl` with arbitrary `device_token` + `nickname` values, since anon RPCs are reachable at `/rest/v1/rpc/...`. A motivated abuser can flood votes (one per fabricated device token) or spam comments.
**Why it happens:** localStorage device tokens are client-controlled — they prevent *accidental* double-voting from the same browser, NOT a determined attacker who rotates tokens. There is no account to rate-limit against.
**How to avoid (realistic MVP):**
1. **Non-guessable code** (≥ 10 chars, server-generated like `share_slug`) — raises the bar to "must be invited / have the link". This is the primary control. [VERIFIED: ensure_share_slug entropy idiom 0016 L165]
2. **Poll-open gate** in every write RPC (`status='open'`) — closing the poll instantly revokes all anon writes. [in Pattern 2]
3. **Length/shape validation** server-side (nickname 1–20 chars, comment ≤ `Limits.VoteNoteMax`=140 or a new `POLL_COMMENT_MAX`) — caps payload abuse. [VERIFIED: Limits.VoteNoteMax=140 constants.ts L21]
4. **Per-device, per-target dedup** via the unique index (`NULLS NOT DISTINCT`) — a device can't inflate a single option/day.
5. **Rate limiting (MVP-realistic):** *Hard* rate limiting per IP is NOT enforceable purely in Postgres RLS/RPC without the `http` extension or an edge proxy (and that path has loop/security caveats per Supabase hardening). For MVP, document this as a **known, accepted limit**: the bounded blast radius is "one poll's tally/chat gets noisy" — recoverable by the host closing/recreating the poll. A lightweight in-RPC throttle (e.g., reject if the same `device_token` posted a comment < N seconds ago, checked against `date_comments.created_at`) is cheap and worth adding for comments. [CITED: news.supa.guide rate-limiting pattern; supabase.com/docs/guides/api/securing-your-api]
**Warning signs:** Tally counts wildly exceeding plausible invitee count; many comments with rotating nicknames in a short window.
[ASSUMED] The exact rate-limit policy (seconds between comments, max votes per device) is a product decision — flagged for discuss/planner confirmation.

### Pitfall 2: Public SSR cache poisoning (10-PATTERNS GOTCHA)
**What goes wrong:** Putting any per-viewer or mutable state (current votes, presence, my-nickname, chat) into the SSR-rendered, `unstable_cache`d page makes every anonymous visitor see one snapshot — and the cache is cookies-free so it can't vary per user.
**Why it happens:** The natural instinct is to fetch the tally on the server for fast first paint.
**How to avoid:** Cache ONLY static poll metadata (title, mode, candidate options, closed-result if `status='closed'`). Hydrate votes/tally/presence/chat client-side in the island, exactly like `vote-island.tsx` does (names/summaries from cached props; counts/votes hydrate client-side). [VERIFIED: vote-island.tsx hydration discipline L62-75, L106-151]
**Warning signs:** Vote counts identical for all viewers and not updating; presence count stuck.

### Pitfall 3: Anon vs "anonymous sign-in" confusion
**What goes wrong:** Seeing `enable_anonymous_sign_ins = false` in `config.toml` and concluding anon Realtime/RPC won't work, then reaching for service-role or forcing login.
**Why it happens:** "Anonymous" overloads two distinct Supabase features.
**How to avoid:** `enable_anonymous_sign_ins` controls Supabase *Anonymous Sign-In* (creating throwaway `auth.users`). It is unrelated to the **anon API role** used by the publishable/anon key. Anon-key clients already work for anon-granted RPCs (`vote_counts_for_places`, `public_trip_view`) and public Realtime channels — no sign-in needed. Leave `enable_anonymous_sign_ins = false`. [VERIFIED: config.toml L?; 0016 anon grants L626/L682/L758; supabase docs public-channel anon access]

### Pitfall 4: Dedup index with per-mode nullable columns
**What goes wrong:** A naive `unique (poll_id, device_token, option_id, vote_date)` lets a device vote the same option twice because standard SQL treats `NULL` as distinct, so `(poll, dev, opt, NULL)` rows don't conflict.
**Why it happens:** Range votes have `vote_date IS NULL`; grid votes have `option_id IS NULL`.
**How to avoid:** Use `NULLS NOT DISTINCT` on the unique index (PG15+; this DB is major_version 17). [VERIFIED: config.toml db.major_version = 17] Match the RPC's `ON CONFLICT` target to this index.
**Warning signs:** Same device's repeated votes accumulate instead of upserting.

### Pitfall 5: 42P17 recursion if a new RLS policy does direct cross-table EXISTS
**What goes wrong:** Writing an RLS policy on `date_votes`/`date_comments` that does `EXISTS (select 1 from date_polls ...)` directly can re-trigger RLS recursion.
**Why it happens:** Forgetting the project's hard rule.
**How to avoid:** The anon write path uses DEFINER RPCs (no table-level anon INSERT policy at all). For any *authenticated* read policy you add (e.g., host reading raw votes), route cross-table checks through a DEFINER helper like the existing `votes` policy does (`exists (select 1 from places p where … can_read_trip(p.trip_id))` where the inner `can_read_trip` is the DEFINER boundary — 0016 L530, mirrored by 0017 plan_items L?). [VERIFIED: 0016 votes policy L526-545; CLAUDE.md §4.4]
**Warning signs:** `42P17 infinite recursion detected in policy` on `supabase db reset`.

### Pitfall 6: Realtime channel/cleanup leak across mounts
**What goes wrong:** Subscribing to `poll:{trip_id}` without `supabase.removeChannel` on unmount leaks channels and double-applies broadcasts.
**How to avoid:** Mirror `subscribeExtractProgress`'s contract verbatim — caller cleans up in `useEffect` return. [VERIFIED: realtime.ts L19-22 cleanup contract]

## Code Examples

### Poll code trigger (mirror ensure_share_slug)
```sql
-- Source: ensure_share_slug (0016 L158-174) — server-generated, non-guessable.
create or replace function ensure_poll_code()
returns trigger language plpgsql as $$
begin
  if new.poll_code is null then
    new.poll_code := substr(
      regexp_replace(lower(encode(gen_random_bytes(8), 'base64')), '[^a-z0-9]', '', 'g'),
    1, 10);
    if char_length(new.poll_code) < 8 then
      new.poll_code := new.poll_code || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.poll_code));
    end if;
  end if;
  return new;
end; $$;
create trigger date_polls_code_before_insert
  before insert on date_polls for each row execute function ensure_poll_code();
```
[VERIFIED: ensure_share_slug 0016 L158-178]

### Device token (web)
```typescript
// Source: standard localStorage UUID pattern; no dependency.
const KEY = 'moajoa:poll_device_token';
export function getDeviceToken(): string {
  if (typeof window === 'undefined') return ''; // SSR guard — never run server-side
  let t = window.localStorage.getItem(KEY);
  if (!t) { t = crypto.randomUUID(); window.localStorage.setItem(KEY, t); }
  return t;
}
```
[VERIFIED: crypto.randomUUID browser standard; SSR guard mirrors vote-island client-only hydration]

### Typed query wrapper (mirror votes.ts / trips.ts)
```typescript
// Source: mirror packages/api/src/queries/votes.ts (client-first, {error} throw).
export async function castDateVote(
  client: MoajoaSupabaseClient,
  input: { code: string; deviceToken: string; nickname: string; optionId?: string; voteDate?: string; availability: 'available' | 'unavailable' },
): Promise<void> {
  const { error } = await client.rpc('cast_date_vote', {
    p_code: input.code, p_device_token: input.deviceToken, p_nickname: input.nickname,
    p_option_id: input.optionId ?? null, p_vote_date: input.voteDate ?? null,
    p_availability: input.availability,
  });
  if (error) throw error;
}
```
[VERIFIED: votes.ts client-first + {error} throw idiom L8-23; trips.ts rpc idiom L170]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Login-gated voting (Phase 10 place votes) | Anonymous bearer-code voting for *date* polls | This phase (D-01 deliberate divergence) | Date polls are pre-trip one-time coordination → anon allowed; place votes stay login-gated. Different table, different RPCs. |
| Postgres Changes for live data | Broadcast + Presence on public channels | Established in repo (extract/plan) + Supabase 2024 broadcast-authorization release | No table exposure; anon-key clients participate. [CITED: supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization] |
| Direct table writes from client | DEFINER RPC for privileged/anon writes | 0016 baseline (join_shared_trip) | Anon writes never touch tables directly. |

**Deprecated/outdated:** None relevant — supabase-js ^2.45.4 Presence/Broadcast API is current and stable. No version bump needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One combined `create_dateless_trip_with_poll` RPC is preferable to a client-side two-step | Pattern 1 | Low — planner may split; either works. Combined avoids a "dateless trip, no poll" limbo state. |
| A2 | Independent `poll_code` (not `share_slug`-derived) is the right call | Standard Stack / Alternatives | Low — strongly supported by `join_shared_trip` requiring login; confirm with discuss if user wants a single code. |
| A3 | New route `/poll/[code]` is cleaner than reusing `/t/[slug]` | Architecture / structure | Low — Claude's Discretion per CONTEXT. Either satisfies the public-cache + island pattern. `/poll/[code]` keeps the anon poll page conceptually separate from the authenticated trip share page. |
| A4 | MVP accepts that hard per-IP rate limiting is out of scope; in-RPC per-device comment throttle + non-guessable code + poll-open gate are the controls | Pitfall 1 / Security Domain | Medium — if the user expects strong anti-abuse, a Cloudflare/edge rate limiter or `http`-extension throttle would be a separate task. Flagged for discuss confirmation. |
| A5 | Binary availability stored as a text enum `('available','unavailable')` (extensible to 3-state later) | Pattern 2 / schema | Low — D-08 says binary now, extend enum later; text+CHECK mirrors existing `source_kind`/`visibility` pattern. |
| A6 | Grid 연속블록(N박) recommendation is a pure client-side TS function in `@moajoa/core`, not SQL | Pattern 3 | Low — keeps it unit-testable; host still picks manually (D-09), so the recommender is advisory only. |
| A7 | Comment max length = a new `POLL_COMMENT_MAX` (or reuse `VoteNoteMax`=140) | Pitfall 1 | Low — product copy decision; 140 is the existing note cap. |

**If this table looks long:** these are deliberately surfaced product/structure choices in Claude's Discretion (per CONTEXT) — none contradict a locked decision. A4 is the only one with real security weight and is flagged for confirmation.

## Open Questions

1. **Rate-limit strength for anon writes (A4)**
   - What we know: non-guessable code + poll-open gate + per-device dedup are enforceable in-RPC; nickname/length caps too.
   - What's unclear: whether the user wants hard per-IP limits (needs edge proxy / `http` extension — out of MVP Postgres scope).
   - Recommendation: ship the in-RPC controls + a per-device comment throttle; document IP-level limiting as a deferred hardening task. Confirm acceptable in discuss.

2. **Poll option count cap (Claude's Discretion: 2–10 recommended)**
   - What we know: CONTEXT recommends 2–10; range mode needs a sane upper bound; grid uses a date window not discrete options.
   - Recommendation: `POLL_RANGE_OPTIONS_MAX = 10` constant + a CHECK or app-level guard. For grid, cap the window (e.g., ≤ 60 days) to bound the per-day vote matrix.

3. **Does the chat thread stay open after `status='closed'`? (UI-SPEC Screen 5 says "read-only or still-open per planner")**
   - What we know: votes are frozen on close; comments could remain open for "see you there!" chatter.
   - Recommendation: gate `post_poll_comment` on `status='open'` for symmetry (simplest, no edge case), OR allow comments while closed by checking a separate flag. Default to read-only on close unless the user wants post-confirm chatter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (colima Docker) | 0018 apply + `supabase:types` + 42P17 verification | ✓ (per 17-03/18-02) | PG 17 | — (required for migration verification) |
| `@supabase/supabase-js` | RPC + Realtime presence/broadcast | ✓ | ^2.45.4 | — |
| `@gorhom/bottom-sheet` | iOS confirm sheet | ✓ | ^5.2.14 | — |
| Reanimated/gesture-handler | grid drag-to-paint (optional) | ✓ | ~4.3 / ~2.31 | tap-per-cell baseline (no gesture lib) |
| iOS simulator (`pnpm sim`) | Screen 1/2/3 device UAT | ✓ (build via xcodebuild, expo run:ios broken — STATE) | — | EAS dev build for real-device |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** grid drag-to-paint → tap-per-cell (UI-SPEC Screen 4b marks drag optional).

> Note: anon writes go through anon-granted RPCs — **no Edge Function and no service-role key are needed** for the vote/comment path. This keeps the env surface minimal (only the anon key, already configured).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | core/api/web: `vitest` ^1.6.0 · iOS: `jest` ^29.7.0 + `jest-expo` ~56.0.5 · SQL/RPC: `supabase db reset` (local PG17) + psql assertions (mirror 17-03/18-02) |
| Config file | `packages/core/vitest` (test script `vitest run`); `apps/ios/jest` (`jest --passWithNoTests`); web `vitest` |
| Quick run command | `pnpm --filter @moajoa/core test` · `pnpm --filter @moajoa/api test` · `pnpm --filter ios test` |
| Full suite command | `pnpm -r test` (per-package) + `pnpm -r typecheck`; migration: `pnpm supabase:reset` then `pnpm supabase:types` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLL-01 | Dateless trip create leaves dates null + attaches open poll | unit (api) | `pnpm --filter @moajoa/api test` (date-polls.test.ts: createDatelessTrip/createDatePoll) | ❌ Wave 0 |
| POLL-01 | `poll_code` minted, non-guessable, ≥8 chars | sql | `pnpm supabase:reset` + psql: insert poll, assert `poll_code` length/charset | ❌ Wave 0 |
| POLL-01 | Poll create guarded by `can_edit_trip` (non-owner rejected) | sql (RLS) | psql with `set_config('request.jwt.claims', ...)` non-owner → expect 42501/raise | ❌ Wave 0 |
| POLL-02 | `cast_date_vote` rejects bad/closed code | sql (RPC) | psql: call with bad code → raise; closed poll → raise | ❌ Wave 0 |
| POLL-02 | `cast_date_vote` dedups per (poll, device, option/date) — second call upserts not duplicates | sql | psql: two calls same device → 1 row, availability updated | ❌ Wave 0 |
| POLL-02 | anon role CAN call vote/tally RPC; CANNOT direct-INSERT date_votes | sql (grant) | psql `set role anon`: rpc OK, `insert into date_votes` → permission denied | ❌ Wave 0 |
| POLL-02 | Web island: nickname gate blocks vote; optimistic update + rollback on RPC error | unit (web) | `pnpm --filter web test` (poll-vote-island.test.tsx) | ❌ Wave 0 |
| POLL-02 | Realtime: `pollChannelName(tripId)` builder returns `poll:{tripId}`; subscribe/cleanup contract | unit (ios+core) | `pnpm --filter @moajoa/core test` + `pnpm --filter ios test` (realtime.test.ts +cases) | ❌ Wave 0 (extend) |
| POLL-03 | `poll_vote_tally` returns correct per-option (range) + per-day (grid) counts incl. nicknames | sql | psql: seed votes, assert tally jsonb shape/counts | ❌ Wave 0 |
| POLL-03 | grid 연속블록 recommender: pure fn picks max-overlap contiguous window | unit (core) | `pnpm --filter @moajoa/core test` (date-poll.test.ts: contiguousBlock) | ❌ Wave 0 |
| POLL-03 | `confirm_poll_date` host-only; writes trip dates + closes poll atomically | sql (RLS) | psql: non-owner → raise; owner → trip.start/end set + poll closed | ❌ Wave 0 |
| POLL-03 | Closed poll rejects further votes (status gate) | sql | psql: confirm then `cast_date_vote` → raise | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the package's quick test (`pnpm --filter <pkg> test`) + `typecheck`. For SQL tasks: `pnpm supabase:reset` (42P17 = 0) on the changed migration.
- **Per wave merge:** `pnpm -r test` + `pnpm -r typecheck`; after 0018 lands, `pnpm supabase:reset` + `pnpm supabase:types` (regenerate database.ts) green.
- **Phase gate:** full suite green + a manual anon-abuse probe (anon key can vote via RPC, cannot direct-INSERT; closed poll rejects writes) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `supabase/migrations/0018_date_polls.sql` — the 4 tables + 5 anon RPCs + 1 owner RPC + triggers (the security-critical surface; covered by psql assertions, no test framework for SQL beyond `db reset` + manual psql, mirror 17-03/18-02 verification style)
- [ ] `packages/core/src/schemas/date-poll.test.ts` — schema parse + `contiguousBlock` recommender (REQ POLL-03)
- [ ] `packages/api/src/queries/date-polls.test.ts` — mocked client chainer (mirror plans.test.ts) for all RPC wrappers (REQ POLL-01/02/03)
- [ ] `apps/web/app/poll/[code]/_components/poll-vote-island.test.tsx` — nickname gate + optimistic/rollback (REQ POLL-02)
- [ ] `apps/ios/lib/realtime.test.ts` — extend with `subscribePollChannel` channel-name + payload + cleanup cases (REQ POLL-02)
- [ ] psql assertion script (or documented manual steps) for the anon-grant / RLS / dedup / host-only matrix — the abuse-surface proof (REQ POLL-02/03). There is no jest/vitest harness against live PG in this repo; the established pattern (17-03, 18-02) is `db reset` + psql `set role anon` / `set_config jwt.claims` assertions. Wave 0 should script these.

> Nyquist note: the highest-frequency-to-sample behavior is **anon write authorization** (a single wrong grant = open write surface). It must be sampled at the SQL/RPC level (psql with `set role anon`), not just through the typed client (which always runs as the test's role). The aggregation correctness (grid contiguous-block) is sampled by a pure unit test in core.

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` → treated as ENABLED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Host = existing Supabase magic-link auth (unchanged). Anon voters = intentionally unauthenticated; bearer `poll_code` is the capability, NOT an identity. Conversion CTA → magic-link (D-03). |
| V3 Session Management | partial | No session for anon voters by design. Device token (localStorage UUID) is a dedup handle, explicitly NOT a security boundary (Pitfall 1). Host uses normal Supabase session. |
| V4 Access Control | **yes** | `cast_date_vote`/`post_poll_comment`/`delete_poll_comment` = DEFINER RPCs validating `poll_code` + poll-open gate. `confirm_poll_date` = owner-only via `am_trip_owner`. `delete_poll_comment` = host (am_trip_owner) OR own device-token match. Aggregation RPC anon-grant exposes only shaped counts, not raw rows. Tables grant NO direct anon INSERT. |
| V5 Input Validation | **yes** | All RPC params validated server-side (nickname non-empty/length, availability enum, mode-correct option/date presence, comment length). Client also validates via `@moajoa/core` Zod before the call. Never trust client `trip_id`/`poll_id` — derive from validated code. |
| V6 Cryptography | partial | `poll_code` via `gen_random_bytes` (pgcrypto, server-side) — never hand-rolled. Device token via `crypto.randomUUID` (CSPRNG). No custom crypto. |
| V7 Error Handling/Logging | partial | RPC raises generic messages ("poll not found or closed") that don't leak whether a code exists vs. is closed beyond the necessary. |
| V13 API/Web Service | **yes** | Anon RPC surface is reachable at `/rest/v1/rpc/*`; only the explicitly-granted functions are exposed (follow the "grant execute to anon" discipline; do NOT leave broad default privileges). |

### Known Threat Patterns for {Supabase anon RPC + bearer code + Realtime}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vote stuffing via rotated device tokens | Spoofing / Tampering | Non-guessable code (invite-only), poll-open gate, per-device dedup index; accepted residual risk + host can close/recreate poll (Pitfall 1, A4). |
| Comment spam/flooding | DoS | Length cap + per-device throttle in RPC + poll-open gate; IP-limit deferred (A4). |
| Direct anon INSERT bypassing code validation | Elevation of Privilege | Tables grant NO anon INSERT; all anon writes via DEFINER RPC only. Verified by psql `set role anon` test. |
| Non-host confirming / closing a poll | Elevation of Privilege | `confirm_poll_date` SECURITY INVOKER + explicit `am_trip_owner` guard. |
| Deleting another voter's comment | Tampering | `delete_poll_comment` requires device-token match OR `am_trip_owner` (host moderation). |
| RLS recursion (42P17) from new policies | (availability) | DEFINER helpers only; no direct cross-table EXISTS (CLAUDE.md §4.4, Pitfall 5). |
| Private data leak via aggregation RPC | Information Disclosure | `poll_vote_tally` returns only counts + nicknames (which voters chose to reveal), never device tokens or other PII. |
| Service-role key exposure | Information Disclosure | N/A — this phase uses no service role / no EF for writes; anon-granted RPCs only. |
| SSR cache poisoning across anon viewers | Tampering | All mutable state hydrates client-side; cached render is static-only (Pitfall 2). |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0016_trips_baseline.sql` — `ensure_share_slug` (L158), `join_shared_trip` DEFINER bearer (L631), `vote_counts_for_places` anon aggregate (L613), `public_trip_view` anon-grant (L689), `am_trip_owner`/`can_edit_trip` DEFINER helpers (L220/L313), votes cross-table policy idiom (L526), nullable trip dates (L127), anon grants (L626/L682/L758).
- `apps/web/app/t/[slug]/_components/vote-island.tsx` — client-side hydration discipline, optimistic+rollback, public-cache-safe island (L62-197).
- `apps/ios/lib/realtime.ts` + `packages/core/src/constants.ts` — channel-name builder + subscribe/cleanup contract (`planChannelName`, `subscribePlanProgress`).
- `packages/api/src/queries/{trips,votes}.ts` + `plans.test.ts` — client-first query + RPC wrapper + mocked-chainer test idiom.
- `packages/core/src/schemas/trip.ts` + `constants.ts` — schema + const-enum + limits idioms to mirror.
- `supabase/config.toml` — `enable_anonymous_sign_ins=false` (distinct from anon role), `[realtime] enabled=true`, `db.major_version=17` (NULLS NOT DISTINCT available), `extract-youtube verify_jwt=true`.
- `.planning/config.json` — `nyquist_validation:true`, `security_enforcement` absent (→ enabled), `commit_docs:true`.
- [CITED: supabase.com/docs/guides/realtime/presence] — `track()`/`untrack()`/`presenceState()`, sync/join/leave events, presence key config, payload shape.
- [CITED: supabase.com/docs/guides/realtime/authorization] — public (non-private) channels bypass RLS; private channels enforce RLS via `realtime.messages` + JWT.

### Secondary (MEDIUM confidence)
- [CITED: supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization] + [supabase.com/docs/guides/realtime/broadcast] — public channels allow anon-key clients to subscribe/broadcast/track presence without login; public vs private broadcast flag must match.
- [CITED: supabase.com/docs/guides/api/securing-your-api] — grant execute to anon only on explicit RPCs; DEFINER functions on RLS tables bypass RLS (controlled write pattern); revoke broad defaults.
- [CITED: news.supa.guide/p/2-rate-limiting-with-supabase-and-a-cron-ui] — in-DB rate-limiting patterns and their `http`-extension caveats.

### Tertiary (LOW confidence)
- General Supabase hardening write-ups (pentestly.io, bastion.tech) corroborate the "anon RPC surface = explicit grants only" guidance — used only to confirm the primary-source conclusion, not as sole basis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in-repo (package.json reads); zero new deps.
- Architecture (RLS/RPC/anon-write model): HIGH — direct mirror of 0016 idioms verified by reading the migration; security recommendation matches CONTEXT's own "권장(보안)" note.
- Realtime anon presence/broadcast: HIGH — confirmed against Supabase docs + the existing public-channel usage in the repo; the one subtlety (anon-sign-in vs anon-role) is verified from config.toml.
- Aggregation correctness / grid block: MEDIUM-HIGH — pattern is clear; the contiguous-block recommender is a new pure function (covered by Validation Architecture).
- Anti-abuse / rate limiting: MEDIUM — in-RPC controls are HIGH-confidence enforceable; hard IP rate limiting is correctly flagged as out-of-MVP-scope (A4, needs user confirmation).

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable; supabase-js 2.45 Realtime API + the in-repo 0016 baseline are not fast-moving. Re-verify only if Supabase changes public-channel anon defaults or the project upgrades supabase-js major version.)
