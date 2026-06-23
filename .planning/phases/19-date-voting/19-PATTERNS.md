# Phase 19: Date Voting (일정 미정 분기) - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 14 (8 new, 6 modified)
**Analogs found:** 14 / 14 (every file has a verbatim in-repo precedent — this phase is 90% re-instantiation of 0016 idioms for a new anon caller class)

> **Read this with RESEARCH.md open.** RESEARCH already wrote the target SQL/TS skeletons (Patterns 1–6, Code Examples). This file locks each target file to its exact analog with line refs and states **what is copied verbatim vs. what changes**. The planner/executor copies from the analog, not from scratch.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0018_date_polls.sql` | migration | CRUD + anon-write + aggregate | `0016_trips_baseline.sql` (+ `0017_plans.sql` style) | exact (idiom mirror) |
| `packages/core/src/schemas/date-poll.ts` | schema | transform (validate) | `packages/core/src/schemas/plan.ts` + `trip.ts` | exact |
| `packages/core/src/schemas/date-poll.test.ts` | test | transform | `packages/core/src/schemas/plan.test.ts` | exact |
| `packages/core/src/schemas/index.ts` | config (barrel) | — | same file (append `export * from './date-poll'`) | exact |
| `packages/core/src/constants.ts` | config | — | `constants.ts` `planChannelName` + `PLAN_STEP_KO` block (L199-215) | exact (surgical append) |
| `packages/api/src/queries/date-polls.ts` | api-query | request-response (RPC) | `packages/api/src/queries/votes.ts` + `plans.ts` + `trips.ts` | exact |
| `packages/api/src/queries/date-polls.test.ts` | test | request-response | `packages/api/src/queries/plans.test.ts` | exact |
| `packages/api/src/queries/index.ts` | config (barrel) | — | same file (append `export * from './date-polls'`) | exact |
| `apps/ios/app/onboarding.tsx` | ios-screen | event-driven (nav) | same file — mirror the 정해짐 card (L46-63) onto the 미정 card (L65-83) | exact (self-mirror) |
| `apps/ios/app/trip/create.tsx` (dateless variant) | ios-screen | request-response (create) | `apps/ios/app/trip/create.tsx` | exact (self-mirror, drop date card) |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` | ios-screen | event-driven + CRUD | same file — surgical state-machine branch (mirror State C card + State A/B layout) | role-match (surgical add) |
| `apps/ios/lib/realtime.ts` | ios-lib | event-driven (broadcast+presence) | `subscribePlanProgress` (L54-65) | exact (append only) |
| `apps/web/app/poll/[code]/page.tsx` | web-route | streaming (SSR cache) | `apps/web/app/t/[slug]/page.tsx` + `lib/public-trip-cache.ts` | exact |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` (+ `poll-chat.tsx`) | web-island | event-driven (optimistic + realtime) | `apps/web/app/t/[slug]/_components/vote-island.tsx` | exact |
| `apps/web/lib/device-token.ts` | web-island (util) | — | RESEARCH Code Examples §Device token (greenfield, no in-repo analog) | role-match |

---

## Pattern Assignments

### `supabase/migrations/0018_date_polls.sql` (migration, anon-write CRUD + aggregate)

**Analog:** `supabase/migrations/0016_trips_baseline.sql` (security idioms) + `supabase/migrations/0017_plans.sql` (append-only/partial-unique/trigger-reuse house style)

**Append-only contract — copy verbatim from 0017 header (`0017_plans.sql` L1-4):**
```sql
-- 0018_date_polls.sql — Phase 19 Date Voting (POLL-01..03, CONTEXT D-01..D-11).
-- date_polls + date_poll_options + date_votes + date_comments. RLS REUSES 0016
-- am_trip_owner/can_edit_trip/can_read_trip DEFINER helpers (no new direct
-- cross-table EXISTS — 42P17 recursion guard, CLAUDE.md §4.4). Anon writes go
-- through SECURITY DEFINER RPCs granted to anon (code=bearer). Append-only: 0016/0017 NEVER modified.
```

**Reuse 0016/0017 helpers verbatim (do NOT redefine):** `set_updated_at()` (0016 L38), `am_trip_owner(uuid)` (0016 L220-233), `can_edit_trip(uuid)` (0016 L313-336), `can_read_trip(uuid)` (0016 L291-311). 0017 L21 already proves the "reuse, do not redefine" pattern for `set_updated_at`.

**(a) Poll-code trigger — mirror `ensure_share_slug` (0016 L158-182):**
The slug generator to copy and rename (`new.share_slug` → `new.poll_code`):
```sql
-- 0016 L165-169 — the exact entropy idiom to copy:
new.share_slug := lower(translate(encode(gen_random_bytes(8), 'base64'), '+/=', 'abc'));
new.share_slug := substr(regexp_replace(new.share_slug, '[^a-z0-9]', '', 'g'), 1, 12);
if char_length(new.share_slug) < 8 then
  new.share_slug := new.share_slug || substr(md5(gen_random_uuid()::text), 1, 8 - char_length(new.share_slug));
end if;
```
**CHANGES:** field `share_slug`→`poll_code`; **independent code, NOT slug-derived** (RESEARCH Alternatives A2 — `join_shared_trip` requires login, so the slug is the *authenticated* path; keep `poll_code` separate so closing the poll revokes anon writes without touching trip sharing). Fire on `before insert on date_polls` (mirror 0016 L176-178 trigger wiring). RESEARCH §Code Examples gives the finished `ensure_poll_code()`.

**(b) Tables — `date_polls`, `date_poll_options`, `date_votes`, `date_comments`** (RESEARCH §Architecture diagram L150-162 + Pattern 2). Mirror the `0017_plans.sql` table+index+RLS layout (L7-30). Key contracts:
- `date_polls(trip_id references trips on delete cascade, poll_code text unique, mode text check (mode in ('range','grid')), status text default 'open' check (status in ('open','closed')))`. `mode`/`status` CHECK mirrors the `0017` `status`/`travel_mode` text+CHECK idiom (L10-11) and `0016` `visibility` check (L123-124).
- **Dedup unique index (Pitfall 4):** `create unique index date_votes_dedup on date_votes (poll_id, device_token, option_id, vote_date) nulls not distinct;` — PG15+ `NULLS NOT DISTINCT` (DB is major_version 17). This is the partial/unique-index discipline 0017 L18 (`plans_one_draft_per_trip`) established, extended for per-mode nullable columns.
- `availability text not null default 'available' check (availability in ('available','unavailable'))` (binary, D-08; text+CHECK extensible to 3-state — RESEARCH A5).

**(c) Anon-write RPC — THE NEW SECURITY SURFACE. Mirror `join_shared_trip` (0016 L631-665):**
The verbatim DEFINER bearer-validation skeleton to copy:
```sql
-- 0016 L631-663 — validate bearer → controlled write → DEFINER:
create or replace function join_shared_trip(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_trip_id uuid; v_owner_id uuid;
begin
  select id, owner_id into v_trip_id, v_owner_id
  from trips where share_slug = p_share_slug and visibility in ('shared','public') limit 1;
  if v_trip_id is null then raise exception 'trip not found or not shared'; end if;
  ...
  insert into memberships (...) values (...) on conflict (...) do nothing;
  return v_trip_id;
end; $$;
grant execute on function join_shared_trip(text) to authenticated;   -- 0016 L665
```
**CHANGES for `cast_date_vote` / `post_poll_comment` / `delete_poll_comment`:**
1. Validate `p_code` against `date_polls` **+ poll-open gate** (`and status = 'open'`) instead of slug+visibility. RESEARCH Pattern 2 gives the finished body (the `select * into v_poll ...` + `if v_poll.id is null then raise`).
2. **Derive everything from the validated code** — never trust client `trip_id`/`poll_id` (RESEARCH Anti-Pattern, Security V5).
3. Device-scoped upsert with `on conflict` matching the `date_votes_dedup` index.
4. **Grant `to authenticated, anon`** (NOT `to authenticated` only) — this is the one delta from `join_shared_trip`'s grant. Mirror the anon-grant on `vote_counts_for_places` (0016 L626) / `accepted_member_count` (0016 L682) / `public_trip_view` (0016 L758).

**(d) Aggregation RPC `poll_vote_tally` — mirror `vote_counts_for_places` (0016 L613-626):**
```sql
-- 0016 L613-626 — DEFINER stable aggregate, anon-grantable:
create or replace function vote_counts_for_places(p_place_ids uuid[])
returns table(place_id uuid, love_count bigint)
language sql stable security definer set search_path = public as $$
  select v.place_id, count(*) as love_count
  from votes v where v.place_id = any(p_place_ids) and v.kind = 'love'
  group by v.place_id;
$$;
grant execute on function vote_counts_for_places(uuid[]) to authenticated, anon;
```
**CHANGES:** returns shaped `jsonb` (per-option for range, per-day for grid) including `nicknames` (RESEARCH Pattern 3 gives the finished `jsonb_agg` body — note it must branch on `v_poll.mode`). `stable security definer` + `grant ... to authenticated, anon` copied verbatim. **Grid 연속블록 inference is NOT here** — that is a pure client-side TS function in `@moajoa/core` (RESEARCH Pattern 3 note + A6), see schema section.

**(e) Host confirm `confirm_poll_date` — SECURITY INVOKER + `am_trip_owner` guard (RESEARCH Pattern 6):**
Mirror `add_manual_place` (0016 L763-810), the INVOKER-with-`can_edit_trip`-guard idiom:
```sql
-- 0016 L777-783 — SECURITY INVOKER so caller RLS applies; explicit helper guard:
security invoker set search_path = public as $$
begin
  if not can_edit_trip(p_trip_id) then
    raise exception '...';
  end if;
```
**CHANGES:** guard with `am_trip_owner(v_trip_id)` (host-only, not editor — D-09); atomic `update trips set start_date/end_date` + `update date_polls set status='closed'`; `grant execute ... to authenticated` (no anon — host only). RESEARCH Pattern 6 gives the finished body.

**(f) Dateless trip create `create_dateless_trip_with_poll` (RESEARCH Pattern 1):** SECURITY INVOKER so the `trips_default_representative` trigger (0016 L144-154) + owner RLS fire normally; relies on `trips.start_date/end_date` already nullable (0016 L127-128). RESEARCH Pattern 1 gives the finished body. (A1: planner may split into a client two-step instead — both work; combined avoids a "dateless trip, no poll" limbo.)

**Verification (mirror 17-03/18-02 style — RESEARCH §Validation):** `pnpm supabase:reset` (42P17 = 0) → `pnpm supabase:types` (regenerate `packages/api/src/types/database.ts`) → psql `set role anon` assertions (rpc OK, direct `insert into date_votes` → permission denied; closed poll → raise; dedup → upsert not duplicate).

---

### `packages/core/src/schemas/date-poll.ts` (schema, validate)

**Analog:** `packages/core/src/schemas/plan.ts` (full file) + `trip.ts` `TripCreateSchema` (L29-41)

**Row schema + const-enum idiom — copy from `plan.ts` L4-14:**
```typescript
import { z } from 'zod';
import { DatePollMode } from '../constants';   // mirror plan.ts L2 (import enum from constants)

export const DatePollSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  poll_code: z.string().min(8),
  mode: z.enum(DatePollMode),                   // mirror plan.ts L9 `z.enum(TravelMode)`
  status: z.enum(['open', 'closed']),           // mirror plan.ts L8 inline status enum
  created_at: z.string().datetime(),
});
```

**Request schema with `.default()` — copy from `plan.ts` L29-36 (`GeneratePlanRequestSchema`):**
`CastDateVoteRequestSchema`, `PostCommentRequestSchema`, `TripCreateDatelessSchema`. The dateless create variant drops dates from `TripCreateSchema` (`trip.ts` L30-39 — keep `title` + `city_code`, **omit** `start_date`/`end_date` + the `.refine`); RESEARCH Pattern 1 gives the exact shape (`{ title, city_code, poll_mode: z.enum(DatePollMode) }`).

**Pure recommender `contiguousBlock` (RESEARCH Pattern 3 note + A6):** a unit-testable sliding-window fn over per-day tally that returns the max-overlap contiguous `[start,end]` for a given run length. Lives here (core) so it is testable; the host still picks manually (D-09 — advisory only). Mirror the pure-fn-in-core idiom (e.g. `category.ts` / `entry-route.ts` exports in `core/src/index.ts`).

**`nullable` vs `.date()` field idiom:** dates use `z.string().date().nullable()` (mirror `trip.ts` L17-19).

---

### `packages/core/src/schemas/date-poll.test.ts` (test)

**Analog:** `packages/core/src/schemas/plan.test.ts` (full file)

Copy the structure verbatim: uuid v4 fixture (`plan.test.ts` L12 `const UUID = '11111111-...'`), `describe`/`it` with `.parse(...).toEqual(...)` for defaults (L14-22), `.toThrow()` for reject cases (L39-53), and a channel-name block (L56-60) for `pollChannelName('abc') === 'poll:abc'`. **ADD** a `describe('contiguousBlock')` block asserting the sliding-window picks the max-overlap window (REQ POLL-03).

---

### `packages/core/src/constants.ts` (config, surgical append)

**Analog:** the Phase 18 channel block `constants.ts` L199-215 (`PLAN_CHANNEL_PREFIX` + `planChannelName` + `PlanStep` + `PLAN_STEP_KO` + `TravelMode`)

**Append (do NOT edit existing exports — Surgical-Change rule):**
```typescript
// Verbatim shape to mirror — constants.ts L199-203:
export const PLAN_CHANNEL_PREFIX = 'plan:';
export function planChannelName(tripId: string): string {
  return `plan:${tripId}`;
}
```
**ADD:** `POLL_CHANNEL_PREFIX = 'poll:'` + `pollChannelName(tripId)` (RESEARCH keys the channel by **trip_id**, `poll:{trip_id}` — diagram L177); `DatePollMode = ['range','grid'] as const` + `DatePollModeType` (mirror `TravelMode` L214-215); `DateAvailability = ['available','unavailable'] as const`; limits — `POLL_RANGE_OPTIONS_MAX = 10`, `POLL_GRID_WINDOW_MAX_DAYS = 60`, `POLL_COMMENT_MAX = 140` (or reuse `Limits.VoteNoteMax = 140`, L21-22; RESEARCH A7) into the `Limits` object; device-token localStorage key constant (mirror `OnboardKeys`/`TripKeys` namespace idiom L186-197, e.g. `'@moajoa/poll:device_token'`).

---

### `packages/api/src/queries/date-polls.ts` (api-query, RPC request-response)

**Analog:** `votes.ts` (RPC + upsert idiom) + `plans.ts` (`functions.invoke` / typed wrapper) + `trips.ts` (`shareTrip` read-then-flip)

**RPC wrapper — copy from `votes.ts` `getVoteCounts` (L62-75) + RESEARCH §Code Examples (`castDateVote`):**
```typescript
// votes.ts L67 — the exact rpc call idiom:
const { data, error } = await client.rpc('vote_counts_for_places', { p_place_ids: placeIds });
if (error) throw error;
```
**Client-first signature + `{ error } throw`** is the house contract (every fn in `votes.ts`/`plans.ts`/`trips.ts`: `client: MoajoaSupabaseClient` first arg, `if (error) throw error;`). Functions to add (RESEARCH structure L198-201): `pollByCode` (rpc `poll_view_by_code`), `castDateVote` (rpc `cast_date_vote` — RESEARCH §Code Examples gives the finished wrapper), `getPollTally` (rpc `poll_vote_tally`), `postComment`/`deleteComment` (rpc), `confirmPollDate` (rpc `confirm_poll_date`), `createDatelessTrip` (rpc `create_dateless_trip_with_poll` or `.insert` two-step — mirror `createTrip` `trips.ts` L74-94).

**Barrel:** append `export * from './date-polls'` to `packages/api/src/queries/index.ts` (currently L1-6).

---

### `packages/api/src/queries/date-polls.test.ts` (test, request-response)

**Analog:** `packages/api/src/queries/plans.test.ts` (full file — the mocked-chainer harness)

Copy verbatim: `makeChain`/`makeClient` thenable-mock (L32-55) — it already mocks `functions.invoke` AND `.rpc` is reachable via the same `client` object; uuid v4 fixtures (L15-19); per-fn `describe` asserting `from`/`rpc`/`invoke` called with exact args + `'throws when ... returns { error }'` case (L69-72 idiom). For `.rpc` calls, extend the mock so `client.rpc = vi.fn(() => Promise.resolve(result))` (the chainer covers `.from` paths; `.rpc` needs the same treatment as `invoke` at L52).

---

### `apps/ios/app/onboarding.tsx` (ios-screen, nav event — Screen 1)

**Analog:** SAME FILE — mirror the **enabled 정해짐 card (L46-63)** onto the **disabled 미정 card (L65-83)**.

**Copy the enabled-card skeleton verbatim (onboarding.tsx L47-63):**
```tsx
<Pressable
  onPress={() => router.push('/trip/create')}
  accessibilityRole="button"
  style={cardShadow}
  className="mt-4 bg-white rounded-2xl px-4 py-4 flex-row items-center active:bg-neutral-50"
>
  <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
    <Ionicons name="calendar" size={22} color="#2979FF" />
  </View>
  <View className="flex-1 ml-3">
    <Text className="text-base font-semibold text-neutral-900">네, 날짜가 정해졌어요</Text>
    <Text className="mt-0.5 text-sm text-neutral-500">날짜·여행지를 입력하고 바로 시작해요</Text>
  </View>
  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
</Pressable>
```
**CHANGES on the 미정 card (UI-SPEC Screen 1, exact token deltas listed there L139-146):** `View`→`Pressable` with `onPress={() => router.push('/trip/create?dateless=1')}` (route param planner's call); `bg-neutral-100`→`bg-white` + `style={cardShadow}` + `active:bg-neutral-50`; icon chip `bg-neutral-200`→`bg-brand-50`, icon color `#9CA3AF`→`#2979FF`; title `text-neutral-400`→`text-neutral-900`, subtitle "날짜 투표로 함께 정해요" `text-neutral-500`; **REMOVE** the "곧 제공" badge (L77-79); **ADD** the chevron (L62). `accessibilityRole="button"`. No disabled state.

---

### `apps/ios/app/trip/create.tsx` (ios-screen, create — Screen 2, dateless variant)

**Analog:** SAME FILE — `trip/create.tsx` (full file), drop the date card.

**COPY verbatim:** the header (L94-100), the 여행지 `Pressable` field card (L108-130), the `FieldTag` component (L38-48), `cardShadow` (L29-34), the representative caption (L168-171), `CityPicker` wiring (L187-196), the `Alert.alert('여행 만들기 실패', ...)` error idiom (L86).

**REMOVE (UI-SPEC Screen 2 L156):** the 여행 날짜 `Pressable` card (L132-157), the `needsEnd` helper + its inline text (L67, L160-165), the `DatePickerSheet` (L198-210), and the `start`/`end`/`dateOpen` state (L53, L54, L57).

**CHANGES:**
- `canSave = !!cityCode && !!cityKo && !saving` (drop `hasDateRange`/`needsEnd` date gate — UI-SPEC L158).
- CTA label "여행 만들기"→**"날짜 투표 시작하기"** (UI-SPEC L158); keep the brand/neutral active/disabled idiom verbatim (L179-183 `bg-brand-500`/`bg-neutral-200`).
- `submit()`: validate through the new `TripCreateDatelessSchema` (not `TripCreateSchema`) and call `createDatelessTrip` (or the combined RPC) instead of `createTrip` (L75-81). Keep `router.replace(\`/trip/${trip.id}/plan\`)` (L84) verbatim.

---

### `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (ios-screen, host management card — Screen 3)

**Analog:** SAME FILE — surgical state-machine branch (D-05, 18-05 precedent: diff = import line + branch block only).

**Branch point:** render the 날짜 투표 management card **above** the normal plan render, gated on `trip` dateless (`!trip?.start_date`) AND an active poll (`status !== 'closed'`). This is the same "branch by state before the main return" pattern the file already uses (States A/C/F early-return at L284/L305/L361; States B/D at L382/L426).

**Card layout — copy the State A empty-card shell (plan.tsx L286-301) + the State C card chrome (L312-321):** `bg-white rounded-2xl` + `cardShadow`, header row with a `calendar` Ionicon in a `bg-brand-50` chip (mirror the State A `bg-brand-50` icon circle L288 + the 초안 chip L431-434), title **"날짜 투표 진행 중"** `text-base font-semibold text-neutral-900` (UI-SPEC Screen 3 L171). Summary line "참여 {N}명 · 최다 후보 {date}" / empty-state "아직 아무도 투표하지 않았어요" (UI-SPEC L172).

**Share row:** two neutral-outline buttons "초대 링크 복사" + "코드 공유" — reuse `shareCurrentTrip` (`apps/ios/lib/share-board.ts`) idiom (`Share.share({ message })`), but build a `/poll/{code}` URL instead of `/t/{slug}`.

**Confirm flow (INLINE, D-09):** `@gorhom/bottom-sheet` (already used per RESEARCH §Supporting) — range = option list, grid = per-day block select → `Alert.alert` confirm (mirror the destructive `onRegenerate` Alert at L171-178, copy "이 날짜로 확정하면 투표가 마감돼요" UI-SPEC L179) → call `confirmPollDate` RPC.

**Realtime:** subscribe to `subscribePollChannel(id, ...)` in a `useEffect` with cleanup — copy the State-C subscription effect verbatim (plan.tsx L116-134):
```tsx
// plan.tsx L116-134 — the exact subscribe + cleanup contract to mirror:
useEffect(() => {
  if (!id || !generating) return;
  const channel = subscribePlanProgress(id, ({ step }) => { ... });
  return () => { supabase.removeChannel(channel); };
}, [id, generating, load]);
```

---

### `apps/ios/lib/realtime.ts` (ios-lib, broadcast + presence — APPEND ONLY)

**Analog:** `subscribePlanProgress` (realtime.ts L54-65) — copy verbatim, rename, add presence.

**Copy this skeleton (realtime.ts L54-65):**
```typescript
export function subscribePlanProgress(
  tripId: string,
  onProgress: (p: PlanProgress) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(planChannelName(tripId))
    .on('broadcast', { event: 'progress' }, (msg) => { onProgress(msg.payload as PlanProgress); })
    .subscribe();
  return channel;
}
```
**CHANGES for `subscribePollChannel`:** import `pollChannelName` (add to the L1 import line — that line is the ONLY existing line you may touch); chain `.on('broadcast', { event: 'vote' }, ...)` + `.on('broadcast', { event: 'comment' }, ...)` + `.on('presence', { event: 'sync' }, ...)`; in `.subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({...}) })` (RESEARCH Pattern 5 gives the finished web-side version). **Caller cleanup contract is identical** — `supabase.removeChannel(channel)` in the `useEffect` return (the L19-22 / L131-133 leak-guard comment block). **Do NOT edit `subscribeExtractProgress`/`subscribePlanProgress`** (Anti-Pattern + Surgical-Change).

---

### `apps/web/app/poll/[code]/page.tsx` (web-route, SSR cache — Screen 4/5 shell)

**Analog:** `apps/web/app/t/[slug]/page.tsx` (SSR shell) + `apps/web/lib/public-trip-cache.ts` (the cookies-free `unstable_cache` wrapper)

**Cookies-free cached fetcher — copy `public-trip-cache.ts` L31-51 verbatim, rename:**
```typescript
// public-trip-cache.ts L32-49 — the cache skeleton (build anon client INSIDE callback):
const fetcher = unstable_cache(
  async () => {
    const supabase = createClient<Database>(url, anonKey);
    return getPollByCode(supabase, code);     // ← analog calls getPublicTripBySlug
  },
  ['public-poll', code],                       // keyParts MUST include `code` (closure var)
  { tags: [POLL_REVALIDATE_TAG(code)], revalidate: 3600 },
);
```
**GOTCHA (Pitfall 2 / 10-PATTERNS, RESEARCH L444-448):** cache **ONLY static poll metadata** (title, mode, candidate options, and the closed-result if `status='closed'`). **Never** put votes/tally/presence/chat into the cached render — the cache is cookies-free so one viewer's state poisons all anon viewers. All mutable state hydrates in the island. The page just renders the shell (mirror `page.tsx` L74-120 header + invite card) and mounts `<PollVoteIsland code={...} tripId={...} mode={...} options={...} />` (mirror how `page.tsx` L124-131 mounts `<VoteIsland>`).

---

### `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` (+ `poll-chat.tsx`) (web-island, optimistic + realtime — Screen 4/5)

**Analog:** `apps/web/app/t/[slug]/_components/vote-island.tsx` (full file — the hydration + optimistic + rollback discipline)

**`'use client'` + browser client + toast imports — copy `vote-island.tsx` L1-19:**
```tsx
'use client';
import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';   // anon browser client
import { useToast } from '@/components';
```

**Client-side hydration (the GOTCHA discipline) — copy the effect at `vote-island.tsx` L106-137:** counts/votes/presence are NOT props; they hydrate in `useEffect` (`active` cleanup flag idiom L116/L133-135). Static metadata (options, mode) comes from props (cached). Mirror the `initialCounts`/`initialJoined` test-seam props (L30-36) for unit-testability.

**Optimistic update + rollback + error toast — copy `onToggleVote` (`vote-island.tsx` L153-197) VERBATIM as the template:**
```tsx
// vote-island.tsx L177-196 — the exact optimistic+rollback+toast pattern:
const wasVoted = myVotes[placeId] ?? false;
setPending((p) => ({ ...p, [placeId]: true }));
setMyVotes((v) => ({ ...v, [placeId]: !wasVoted }));          // optimistic
setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? -1 : 1) }));
try {
  if (wasVoted) { await retractVote(client, placeId); }
  else { await castVote(client, { place_id: placeId, kind: 'love' }); }
} catch (err) {
  setMyVotes((v) => ({ ...v, [placeId]: wasVoted }));         // rollback
  setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? 1 : -1) }));
  toast('투표를 저장하지 못했어요.', { variant: 'error' });    // exact copy (UI-SPEC L105)
} finally {
  setPending((p) => ({ ...p, [placeId]: false }));
}
```
**CHANGES:** `castVote`→`castDateVote({ code, deviceToken, nickname, optionId|voteDate, availability })`; the toggle is `가능`/`불가` binary (UI-SPEC 4b) not ❤️, but the selected-state styling copies the voted class verbatim — `bg-brand-500 border-brand-500 text-white` (`vote-island.tsx` L301). Nickname gate (4a) blocks vote until set — error "닉네임을 입력해야 투표할 수 있어요." (UI-SPEC L195); device token from `apps/web/lib/device-token.ts`. The relative-popularity bar (the **최다** leader) copies the bar at `vote-island.tsx` L324-336 (`bg-brand-600` for `love === maxLove`). Realtime: subscribe to `pollChannelName(tripId)` in the island (RESEARCH Pattern 5 web snippet — `channel.track({ nickname })` for presence). `poll-chat.tsx` = flat thread (own = brand-tinted right, others = neutral left — UI-SPEC 4d) + presence strip; uses `postComment`/`deleteComment`. **Screen 5 (closed):** when `status==='closed'`, render the confirmed-result block + "이 여행에 함께하기" CTA instead of the voting UI (UI-SPEC Screen 5).

---

### `apps/web/lib/device-token.ts` (web util)

**Analog:** RESEARCH §Code Examples "Device token (web)" (greenfield — no in-repo precedent; standard localStorage UUID). Copy verbatim:
```typescript
const KEY = 'moajoa:poll_device_token';   // or the constant added to core constants.ts
export function getDeviceToken(): string {
  if (typeof window === 'undefined') return '';          // SSR guard — never run server-side
  let t = window.localStorage.getItem(KEY);
  if (!t) { t = crypto.randomUUID(); window.localStorage.setItem(KEY, t); }
  return t;
}
```
SSR guard mirrors `vote-island.tsx`'s client-only hydration (no token read during the cached SSR render).

---

## Shared Patterns

### Anon-write SECURITY DEFINER RPC (the new security surface)
**Source:** `join_shared_trip` (0016 L631-665) — validate bearer → controlled write → DEFINER; `grant ... to anon` from `vote_counts_for_places` (0016 L626).
**Apply to:** `cast_date_vote`, `post_poll_comment`, `delete_poll_comment` in 0018.
**Contract:** (1) validate `p_code` against `date_polls` + `status='open'` gate; (2) derive `poll_id`/`trip_id` from the validated row, NEVER from client args; (3) device-scoped upsert matching the `nulls not distinct` dedup index; (4) `grant execute ... to authenticated, anon`. Tables grant **no** direct anon INSERT (verified by psql `set role anon` → `insert into date_votes` → permission denied).

### SECURITY DEFINER cross-table helpers (42P17 guard)
**Source:** `am_trip_owner`/`can_edit_trip`/`can_read_trip` (0016 L220/L313/L291); reuse-don't-redefine proven by `0017_plans.sql` L21/L27-30.
**Apply to:** every authenticated RLS policy + the `confirm_poll_date` owner guard in 0018. No direct cross-table `EXISTS` in a policy except the one permitted shape (`exists (select 1 from <parent> where ... can_*_trip(parent.trip_id))` — votes→places idiom 0016 L526-534, plan_items→plans idiom 0017 L51-59).

### Anon-grant aggregation RPC
**Source:** `vote_counts_for_places` (0016 L613-626) — `stable security definer` + `grant ... to authenticated, anon`.
**Apply to:** `poll_vote_tally` (returns shaped jsonb counts + nicknames only — no raw rows, no device tokens; Security V?/Information-Disclosure).

### Realtime channel-name builder + subscribe/cleanup contract
**Source:** `planChannelName` (`constants.ts` L201-203) + `subscribePlanProgress` (`realtime.ts` L54-65) + the caller-cleanup `useEffect` (`plan.tsx` L116-134).
**Apply to:** `pollChannelName(tripId)` (`poll:{trip_id}`), `subscribePollChannel` (append to realtime.ts), and the web island subscription. ONE public channel carries votes + comments + presence (D-11). Caller MUST `supabase.removeChannel(channel)` on unmount (leak guard, RESEARCH Pitfall 6).

### Public SSR cache safety (cookies-free hydrate-all-mutable)
**Source:** `public-trip-cache.ts` L31-51 (`unstable_cache`, anon client inside callback, `keyParts` includes the slug) + `vote-island.tsx` L106-151 (mutable state hydrates client-side).
**Apply to:** `poll/[code]/page.tsx` (cache static metadata only) + `poll-vote-island.tsx` (hydrate vote/tally/presence/chat). RESEARCH Pitfall 2 — putting per-viewer state in the cached render poisons all anon viewers.

### Client-first query wrapper + `{ error } throw`
**Source:** every fn in `votes.ts` / `plans.ts` / `trips.ts` (`client: MoajoaSupabaseClient` first arg; `if (error) throw error;`); RPC idiom `votes.ts` L67.
**Apply to:** all of `date-polls.ts`.

### Const-enum + `.default()` Zod idiom
**Source:** `plan.ts` L9 (`z.enum(TravelMode)`), L32 (`.default('transit')`); `constants.ts` L214 (`TravelMode = [...] as const`).
**Apply to:** `DatePollMode`/`DateAvailability` enums + `CastDateVoteRequestSchema` defaults.

### Brand-accent rationing (UI)
**Source:** `onboarding.tsx` (enabled card brand, disabled neutral) + `vote-island.tsx` L301 (voted = `bg-brand-500`) / L330 (leader bar `bg-brand-600`).
**Apply to:** all iOS + web surfaces — accent only on the UI-SPEC reserved list (primary CTAs, selected 가능 toggle, active grid cells, confirmed-date block, presence dots). Unvoted/불가/secondary stay neutral.

---

## No Analog Found

Every file has an in-repo analog. The only two with a *partial* analog (RESEARCH-snippet, not a verbatim repo precedent):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/lib/device-token.ts` | web util | — | No anonymous-identity localStorage util exists (all prior web flows are login-gated). RESEARCH §Code Examples gives the full body; SSR guard mirrors `vote-island.tsx` client-only hydration. Trivial. |
| `contiguousBlock` recommender (in `date-poll.ts`) | pure fn | transform | No sliding-window aggregate over date tallies exists yet. New pure fn (RESEARCH Pattern 3 / A6); pattern is the pure-fn-in-core idiom (`category.ts`/`entry-route.ts`). Unit-tested in `date-poll.test.ts`. |

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `packages/core/src/schemas/`, `packages/core/src/constants.ts`, `packages/api/src/queries/`, `apps/ios/app/`, `apps/ios/lib/`, `apps/web/app/t/[slug]/`, `apps/web/lib/`
**Files scanned:** 22 (3 phase docs + 19 source/analog files)
**Pattern extraction date:** 2026-06-23
