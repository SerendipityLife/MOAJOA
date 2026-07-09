# Phase 26: Realtime Chat - Research

**Researched:** 2026-07-10
**Domain:** Supabase Realtime (postgres_changes + presence) on a single shared channel · Next.js client island · authenticated RLS chat
**Confidence:** HIGH (near-total in-repo precedent — Phase 19 poll chat + Phase 24 moa realtime; only the layout/tab-shell is net-new)

## Summary

Phase 26 is almost entirely a **mirror-and-wire** job, not new invention. Every hard part already exists in the repo: the message schema (`chat.ts`, built in 23-05), the table + RLS (`0025`), the single-channel realtime hub (`moa-island.tsx`, 24-06), the chat UI shape (`poll-chat.tsx`, Phase 19), and presence track/sync (`poll-vote-island.tsx`, Phase 19). The channel-name convention (`moaChannelName` → `moa:{tripId}`) is already reserved for exactly this. supabase-js is pinned at `2.110.0`, which the CONTEXT notes already resolved the GAP-19D presence bug.

There are **two load-bearing backend gaps** that will cause silent runtime failures if the plan misses them, both in the same new append-only migration:
1. **`trip_messages` is not in the `supabase_realtime` publication** (0026 added only `places`/`links`). Without it, the postgres_changes INSERT subscription reaches `SUBSCRIBED` but delivers **zero events** — the exact Phase 24 D-14/Pitfall-2 silent no-op.
2. **`trip_messages.user_id` has no `auth.uid()` default trigger** (0025 forgot the one `votes` has in 0016). Since the column is `not null` with no default and `TripMessageCreateSchema` deliberately omits `user_id`, a naïve insert fails with a `not null` violation. The `votes_default_user_id` BEFORE-INSERT trigger must be mirrored.

The one genuinely new surface is the **모아별 하단 탭바** (D-01/D-02): a client-state (not route) switch between `모으기` and `채팅` inside the single-mounted `moa-island`, so the one channel is never torn down. No reusable web bottom-tab component exists (`bottom-nav.tsx` is the app-shell nav, route-based; `tabs.tsx` is a top segmented pill) — recommend a minimal net-new presentational bar owned by island state.

**Primary recommendation:** Add migration `0028_chat_realtime_publication.sql` (publication add + user_id default trigger), add `sendTripMessage`/`listTripMessages` to a new `packages/api/src/queries/chat.ts` mirroring the authenticated direct-table idiom (`votes.ts`), lift chat message state into `moa-island` and register the `trip_messages` INSERT binding **before `.subscribe()`** on the existing `moa:{tripId}` channel (critical — postgres_changes bindings added after subscribe do NOT deliver), add presence track/sync, and render a net-new presentational `moa-chat.tsx` (mirror `poll-chat.tsx`) behind a client-state tab bar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-10)
- **D-01:** `/moa/[id]`에 **모아별 하단 탭바** 도입. 이번 phase는 `[모으기] [채팅]` **2탭**. iOS 여행 4탭(지도/플랜/예약/가계부) IA 미러 — 나중에 플랜/예약/가계부로 **확장 가능하게** 설계(이번엔 자리만, 미구현).
- **D-02:** 탭 전환은 **클라이언트 상태**(라우트 분리 아님). `moa-island`가 한 번만 마운트되어 **단일 realtime 채널을 유지**, `모으기` 뷰 ↔ `채팅` 뷰만 스위치.
- **D-03:** `모으기` 탭 = 기존 지도 + place-sheet + 링크/장소 추출 + `함께 정하기` 그대로. `채팅` 탭 = 신규 메신저 UI. 앱 최상단 bottom-nav의 `모아`(홈)와 구분되는 **모아 내부 섹션 탭**.
- **D-04:** **모아 전체 대화방 1개**(장소별 스레드 아님). 카톡식 **메신저 스타일** — 닉네임 말풍선 + 하단 입력바 + 히스토리 스크롤.
- **D-05:** **풀 스코프 CHAT-01/02/03.** (01 실시간+영속 히스토리 / 02 presence “N명 보는 중” / 03 `#N 장소명` 인용 칩 → 탭 시 해당 장소 스크롤·하이라이트)
- **D-06:** **단일 `moaChannelName(tripId)` 채널에 통합.** 기존 postgres_changes(`places` INSERT, `links` UPDATE) + **`trip_messages` INSERT**(postgres_changes) + **presence**(track/sync). “화면당 채널 2개 금지”. 두 탭이 **같은 채널** 소비.
- **D-07 (⚠️ research 필수):** `trip_messages`를 `supabase_realtime` publication에 추가하는 신규 마이그레이션 필요 여부 확인 — 무음 no-op 방지. → **확인됨: 필요.** (아래 Q1)
- **D-08:** 닉네임 = 로그인 사용자 `display_name`(카카오, D-A2). `trip_messages.nickname` = **전송 시점 스냅샷**(비정규화, chat.ts 계약). 익명 게스트 게이트는 Phase 25.
- **D-09:** 이번 phase는 **호스트 + 기존 멤버**만. `trip_messages` SELECT/INSERT는 0025 RLS 헬퍼(`can_read_trip` / `auth.uid()`+`can_vote_trip`) 게이트.
- **D-10:** place-list `답장` 스텁 → **`채팅` 탭 전환 + `reply_to_place_id` 프리필**. 메시지 `#N 장소명` 인용 칩 → 칩 탭 시 **`모으기` 탭 전환 + 해당 장소 `scrollIntoView` + 하이라이트**(기존 `openPlaceId` 경로 재사용). 장소 hard delete 시 reply_to_place_id set null(칩만 소멸, 0025 FK).

### Claude's Discretion
- 말풍선 스타일 세부(내/상대 정렬·색), 입력바·presence 표시 위치, 자동 스크롤(새 메시지 시 하단 고정) — 표준 메신저 관례 + UI-SPEC에서 확정.

### Deferred Ideas (OUT OF SCOPE)
- 게스트 join·닉네임 게이트·익명 인증 표면 (**Phase 25**).
- 플랜/예약/가계부 탭 (미래 phase — 탭바는 자리만).
- 메시지 삭제·편집·읽음표시·타이핑 인디케이터·첨부.
- iOS 변경 (전면 동결).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | 같은 모아 공유화면 접속자 실시간 채팅 + 새로고침 후 히스토리 유지 | `trip_messages` 영속(0025) + `listTripMessages` 초기 로드 (Q2) + `trip_messages` INSERT postgres_changes on `moa:{tripId}` (Q1/Q3). 이번 phase 대상 = 인증 멤버(D-09); 게스트 표면은 Phase 25. |
| CHAT-02 | “지금 N명 보는 중” 실시간 표시 | presence track/sync on the single channel, distinct-key count (Q4) — `poll-vote-island` 미러. |
| CHAT-03 | 장소 답장 지정 → `#N 장소명` 인용 칩, 칩 탭 시 해당 장소 스크롤·하이라이트 | place-list `답장` → island reply-prefill (Q5/D-10) + `reply_to_place_id`(chat.ts/0025) + 칩 탭 → 탭 전환 + `openPlaceId` 재사용(place-list `scrollIntoView` effect already exists). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message persistence + history | Database (`trip_messages` 0025) | API (`listTripMessages`) | Rows already exist; RLS `can_read_trip` gates history read. |
| Initial history load (SSR seed) | Frontend Server (RSC `page.tsx`) | API | Mirror places/links seed — авториз'd cookie session, no cache (login screen). |
| Realtime message fan-out | Database→Realtime (WALRUS postgres_changes) | Client (island subscribe) | RLS re-evaluated per-subscriber JWT at the DB; publication membership is the exposure gate (Q1). |
| Presence “N명 보는 중” | Client (channel `.track`/`.on('presence')`) | — | Presence is client-ephemeral, not persisted; no DB tier. |
| Message send | Client → API insert | Database (RLS `auth.uid()`+`can_vote_trip`, user_id trigger) | Authenticated direct-table insert (votes idiom), NOT an RPC (RPC was only for anon poll). |
| Tab switch (모으기/채팅) | Client (island `useState`) | — | D-02: client state only — route split would tear down the channel. |
| Mention chip navigation | Client (island state) | — | Reuses existing `openPlaceId` controlled path in place-list. |

## Question-by-Question Findings

### Q1 — `trip_messages` realtime publication + user_id default (D-07) — **HIGH**

**Finding: BOTH are required.** A new append-only migration must (a) add `trip_messages` to the `supabase_realtime` publication, and (b) add the `auth.uid()` default trigger the table is missing.

**(a) Publication — confirmed necessary.** `0026_realtime_publication.sql` registers only `places` and `links`. Its own header documents the rule: *"postgres_changes는 supabase_realtime publication 멤버십이 전제 — 등록 없이는 구독이 SUBSCRIBED 상태로 이벤트 0건 무음 no-op (RESEARCH Pitfall 2)."* This is the identical Phase 24 D-14 lesson. Without the add, the `trip_messages` INSERT binding subscribes cleanly and delivers nothing — the failure is invisible in code and only shows as "messages don't arrive live" at runtime. `[VERIFIED: codebase — 0026_realtime_publication.sql grep confirms only places/links]`

**(b) user_id default trigger — confirmed necessary (subtle, high-impact).** `trip_messages.user_id` (0025) is `uuid not null references profiles(id)` with **no default**. The 0025 INSERT RLS is `with check (user_id = auth.uid() and can_vote_trip(trip_id))` — a `WITH CHECK` only **validates**, it does not **populate** the column. `TripMessageCreateSchema` (chat.ts) deliberately omits `user_id` ("user_id is pinned by the 0025 INSERT RLS (`auth.uid()`), never client-supplied") — but nothing actually sets it. The analogous `votes` table (0016 L512-522) solves this with a BEFORE-INSERT trigger `votes_default_user_id()` that sets `new.user_id := auth.uid()` when null. `trip_messages` has no equivalent → a client insert omitting `user_id` fails with a `not null` violation. `[VERIFIED: codebase — 0025 has no default/trigger on user_id; 0016 votes_default_user_id trigger is the mirror]`

**Migration to create — `supabase/migrations/0028_chat_realtime_publication.sql`:**
```sql
-- 0028_chat_realtime_publication.sql — Phase 26 Realtime Chat (D-06/D-07)
-- Append-only: 0016..0027 are NEVER modified.

-- 1) Expose trip_messages to postgres_changes (0026 registered only places/links).
--    Without this the INSERT subscription is SUBSCRIBED-but-0-events (D-14/Pitfall 2).
alter publication supabase_realtime add table trip_messages;

-- 2) user_id default — mirror votes_default_user_id (0016 L512). 0025 forgot it;
--    the INSERT RLS only validates user_id=auth.uid(), it never populates it, and
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
```

**Deploy gate (⚠️):** publication + trigger only take effect after a **remote** `supabase db push` (or the repo's Supabase↔GitHub auto-apply on `main` push — confirm which is wired). A local-only migration means live chat silently fails in Preview/prod. `pnpm supabase:types` regen is **not** required for this migration — publication membership doesn't change generated types, and the trigger doesn't alter the column shape (`trip_messages` already exists in `database.ts` from 0025). `[VERIFIED: codebase — database.ts:784 already has trip_messages]`

**REPLICA IDENTITY note:** chat only needs INSERT events, which work under default replica identity (the new row is always in the WAL). No `replica identity full` needed (that's only for UPDATE/DELETE old-row columns) — consistent with 0026 not setting it. `[ASSUMED]`

### Q2 — API queries `sendTripMessage` / `listTripMessages` — **HIGH**

**Finding: neither exists.** grep of `packages/api/src` shows only generated `database.ts` type entries for `trip_messages`; no query functions. The poll's `postComment`/`deleteComment` are **RPCs** (`post_poll_comment`) — that pattern exists *only because anon voters have no direct table grant*. moa chat is **authenticated members** (D-09) with direct-table RLS, so mirror the **direct-table idiom** (`votes.ts` `castVote` / `places.ts` `listPlacesByTrip`), NOT the RPC idiom. `[VERIFIED: codebase — grep + votes.ts/date-polls.ts read]`

**Create `packages/api/src/queries/chat.ts`** (mirror `votes.ts` structure + `TripMessageCreateSchema`/`TripMessage` from `@moajoa/core`):
```ts
import type { TripMessage, TripMessageCreate } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

/** History for a moa, oldest→newest (RLS can_read_trip gates rows). */
export async function listTripMessages(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<TripMessage[]> {
  const { data, error } = await client
    .from('trip_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });   // asc — history reads top→bottom
  if (error) throw error;
  return (data ?? []) as TripMessage[];
}

/** Send a message. user_id is filled by the 0028 default trigger (=auth.uid());
 *  RLS with-check enforces user_id=auth.uid() AND can_vote_trip. nickname is a
 *  send-time snapshot (D-08/D-A2), passed by the caller from display_name. */
export async function sendTripMessage(
  client: MoajoaSupabaseClient,
  input: TripMessageCreate,
): Promise<TripMessage> {
  const { data, error } = await client
    .from('trip_messages')
    .insert({
      trip_id: input.trip_id,
      nickname: input.nickname,
      body: input.body,
      reply_to_place_id: input.reply_to_place_id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TripMessage;
}
```
Add both to `packages/api/src/queries/index.ts` (`export * from './chat';`). Validate `input` with `TripMessageCreateSchema.parse(...)` at the **UI boundary** before calling (CLAUDE.md §4.5 — external input via Zod). Colocate `chat.test.ts` (vitest, matching `votes`/`date-polls` test layout).

**Dependency on Q1(b):** `sendTripMessage` omits `user_id` — it **only works after the 0028 trigger exists**. If the plan sequences the query before/without the migration, sends 500 on the not-null constraint. Keep migration in an earlier wave than the send wiring, or in the same wave.

### Q3 — Single channel, 3 postgres_changes + presence, subscription ordering — **HIGH**

**Finding: the ordering rule is the #1 gotcha, and it differs from how poll-chat wired itself.** `postgres_changes` bindings are negotiated with the server **at `.subscribe()` time** — every `.on('postgres_changes', …)` MUST be chained **before** `.subscribe()`. Bindings added after a channel is already subscribed are NOT registered server-side and deliver nothing (and can trigger `CHANNEL_ERROR: mismatch between server and client bindings`). `[VERIFIED: Supabase docs + supabase-js#1917]`

This is why the poll pattern **cannot be copied verbatim**: `poll-chat.tsx` adds its bindings *after* subscribe — but those are `broadcast` bindings, which (unlike postgres_changes) *can* be added post-subscribe. moa chat uses **postgres_changes** for messages (D-06), so the message binding must be registered inside `moa-island`'s single channel-setup effect alongside the existing places/links bindings, **before `.subscribe()`**. Presence `.on('presence', …)` and `.track()` can be added in the same chain.

**Concrete shape — extend the existing `moa-island` effect** (currently places INSERT + links UPDATE):
```ts
const channel = client
  .channel(moaChannelName(trip.id), {
    config: { presence: { key: currentUserId } },   // presence key = user id (Q4)
  })
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${trip.id}` },
    () => void reconcile())                          // existing — refetch (RLS re-eval)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'links', filter: `trip_id=eq.${trip.id}` },
    () => void reconcile())                          // existing
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${trip.id}` },
    (payload) => appendMessage(payload.new as TripMessage))   // NEW — append, not refetch
  .on('presence', { event: 'sync' },
    () => setViewers(Object.keys(channel.presenceState()).length))   // NEW
  .subscribe(async (s) => {
    if (s === 'SUBSCRIBED') {
      await channel.track({ user_id: currentUserId, nickname: myNickname });   // NEW
    }
  });
```

**Trust the message payload, do NOT reconcile.** places/links use full-refetch-reconcile because of soft-delete/`hidden_at` drift (M-02). Messages have no such drift: WALRUS only delivers the row if the subscriber's JWT passes `trip_messages` SELECT RLS (`can_read_trip`), and INSERTs are append-only. So append `payload.new` directly (dedup by `id`, mirroring poll-chat's `prev.some(m => m.id === c.id) ? prev : [...prev, c]`). Full-refetch on every message would waste queries and fight scroll position. `[VERIFIED: codebase — moa-island reconcile rationale + 0025 RLS]`

**No broadcast send needed.** With postgres_changes, the sender **also receives** its own INSERT event — so there's no manual `.send({type:'broadcast'})` like poll-chat did. Optimistic-append the server row returned by `sendTripMessage` (real `id`), and dedup when the postgres_changes echo arrives. `[VERIFIED: reasoning from postgres_changes semantics]`

**State-lifting consequence (architectural):** because the message binding must be in island's pre-subscribe chain, the **message list state + append handler live in `moa-island`** (or a small `useMoaChannel` hook), and `moa-chat.tsx` is **presentational** (receives `messages`, `onSend`, `replyToPlaceId`, `viewers`). This inverts poll's ownership (there, `PollChat` owned its own bindings). Document this clearly for the planner — copying poll's "child owns bindings" shape here would silently break live messages.

**Single-effect guard:** keep everything in the one existing `[trip.id]`-keyed effect with `client.removeChannel(channel)` cleanup — do NOT add a second `useEffect`/second `.channel()` (a 2nd channel on the same topic silently steals deliveries — the exact warning in `poll-vote-island`'s comments and `moaChannelName`'s doc).

### Q4 — Presence identity + distinct count — **HIGH**

**Finding: mirror `poll-vote-island` presence exactly, swapping the key from `deviceToken` to `currentUserId`.** `[VERIFIED: codebase — poll-vote-island.tsx L96-181]`

- **Channel presence key:** `config: { presence: { key: currentUserId } }`. poll used `getDeviceToken()` (anon); moa is authenticated (D-09) so use the real user id. Distinct users collapse across a user's multiple tabs → "N명 보는 중" counts **people**, not tabs.
- **Track payload:** `{ user_id, nickname }` (+ optional `online_at`). nickname = the same send-time `display_name` snapshot (D-08).
- **Count:** `Object.keys(channel.presenceState()).length` on the `presence: { event: 'sync' }` callback → `setViewers(...)`. Same expression poll uses.
- **Presentation:** poll's copy `viewers <= 1 ? '지금 보는 중' : '지금 ${viewers}명 보는 중'` is a ready template (UI-SPEC finalizes placement — header vs chat top, Claude's discretion).
- **Re-track on nickname:** poll re-tracks when the nickname resolves (`useEffect([nickname])`). For moa the nickname is known at mount (server-seeded `display_name`), so a single `.track()` in the SUBSCRIBED callback suffices — no anon nickname-gate re-track needed this phase (that's Phase 25).

**Presence bug status — CONFIRMED RESOLVED.** supabase-js is pinned `2.110.0` across root/api/web `package.json`; CONTEXT + chat.ts note GAP-19D was fixed by the 2.110 upgrade (24-01). Presence is production-usable. `[VERIFIED: codebase — package.json "@supabase/supabase-js": "2.110.0"]`

### Q5 — Tab shell (모으기 / 채팅) — **MEDIUM (net-new, but low-risk)**

**Finding: no reusable web bottom-tab component; recommend a minimal net-new presentational bar driven by island state.** `[VERIFIED: codebase — apps/web/components ls + reads]`

Existing components and why each doesn't fit D-01/D-02:
- `bottom-nav.tsx` — app-shell nav (`모아`/`둘러보기`/`내 정보`), **route-based** (`Link` + `usePathname`), and hidden on `/moa/[id]` by design. It's the **structural/visual analog** (fixed bottom bar, `flex-1` icon+label items, brand-500 active) to copy styling from — but it's route-driven, which D-02 explicitly forbids (route split tears down the channel). D-03 also stresses this is a *different* bar from the app-shell nav.
- `tabs.tsx` — Radix segmented control, a **top pill** (`h-10`, inline `w-fit`), not a bottom 4-tab-style bar. Manages active state client-side, but the aesthetic is wrong for the iOS-mirroring bottom tab bar (D-01). Usable as a state primitive if desired, but the fixed-bottom layout would need full restyling anyway.
- `add-content-tabs.tsx` — unrelated (링크/검색 입력 탭 inside the add sheet).

**Recommendation:** net-new presentational `apps/web/app/moa/[id]/_components/moa-tab-bar.tsx` — a `fixed inset-x-0 bottom-0` bar with 2 items (`모으기`, `채팅`), `activeTab: 'moa' | 'chat'` + `onTabChange` props, styled after `bottom-nav.tsx`. `moa-island` owns `const [activeTab, setActiveTab] = useState<'moa'|'chat'>('moa')`. Render `모으기` view (map + PlaceSheet + FAB + 함께 정하기) when `activeTab==='moa'`, `<MoaChat …/>` when `'chat'`. **Keep the island (and its channel effect) mounted across both** — switch by conditional render/`hidden`, never by unmounting. Leave the items array trivially extendable to 4 (플랜/예약/가계부 자리만, D-01).

**Layout consideration for planner/UI-SPEC (not a blocker):** `moa-island` is currently `fixed inset-0` with a full-bleed map and `PlaceSheet` as a bottom sheet. A fixed bottom tab bar reserves bottom space and sits at high z-index; the FAB currently at `bottom-[136px]` and the sheet anchors may need offsetting when the tab bar is present. The 채팅 view replaces the map+sheet region (input bar sits just above the tab bar). Flag for UI-SPEC — mechanics are settled here.

## Patterns to Follow (summary)

1. **One channel per screen, all postgres_changes bindings before `.subscribe()`.** Extend the existing `moa:{tripId}` effect; add `trip_messages` INSERT + presence in the same chain. Never a 2nd channel/effect.
2. **Messages = append payload (trust WALRUS+RLS), dedup by id.** Unlike places/links (refetch-reconcile for hidden_at drift). Optimistic-append the `sendTripMessage` server row; dedup the echo.
3. **Authenticated direct-table queries (votes idiom), not RPC.** `sendTripMessage` insert (user_id via 0028 trigger) / `listTripMessages` select asc. RPC was anon-only.
4. **Presence: key=user_id, track `{user_id, nickname}`, count = `Object.keys(presenceState()).length`.** Mirror poll-vote-island; 2.110 fixed the bug.
5. **nickname = send-time `display_name` snapshot (D-08/D-A2).** Seed `display_name` server-side (`getProfileNames` incl. `user.id`) → pass into island → used for both send + presence track. Never re-join from profiles.
6. **Chat UI presentational, state lifted to island.** `moa-chat.tsx` mirrors `poll-chat.tsx` bubbles/input, but receives `messages`/`onSend`/`viewers`/`replyToPlaceId` as props (island owns state + channel).
7. **Mention/reply reuses `openPlaceId`.** place-list already has the controlled `openPlaceId` + `scrollIntoView` effect (L62-68) — chip tap → `setActiveTab('moa')` + `setOpenPlaceId(id)` + `setSheetAnchor('expanded')`. 답장 button → `setActiveTab('chat')` + prefill `reply_to_place_id`.
8. **Client-state tab switch, island stays mounted.** D-02 — conditional render, never unmount.

## Pitfalls

1. **Silent no-op: `trip_messages` not in publication.** Subscription is SUBSCRIBED, zero events. Fix = 0028 publication add (Q1a). Highest-risk, invisible in code.
2. **`not null` violation on send: no user_id default.** `TripMessageCreateSchema` omits user_id; column has no default/trigger. Fix = 0028 trigger (Q1b). Send 500s without it.
3. **postgres_changes binding added after `.subscribe()` delivers nothing.** Don't copy poll-chat's "child adds bindings post-subscribe" shape for the message binding — that only works for `broadcast`. Register the message binding in island's pre-subscribe chain. May surface as `CHANNEL_ERROR` binding-mismatch.
4. **Second channel/effect on `moa:{tripId}` steals deliveries.** A same-topic 2nd channel silently starves the first (documented in poll-vote-island + moaChannelName). Keep everything on the one existing effect.
5. **Route-split tabs kill the channel (D-02).** If tabs are separate routes, moa-island remounts → channel churn → dropped presence/messages + state loss. Client-state only.
6. **Reconciling messages instead of appending** would refetch on every message (wasteful, scroll-jumping) and is unnecessary — no hidden_at drift on append-only INSERT.
7. **Remote push forgotten.** Migration merged but not `supabase db push`ed (or auto-apply not wired) → live chat silently fails in Preview/prod though local passes. Same D-14 gate. Confirm the deploy path.
8. **Missing self in profileNames.** Current-user `display_name` may not be in the server-seeded `profileNames` (it seeds owner + place `added_by`). Add `user.id` to the `nameIds` set in `page.tsx` so island has the sender's nickname for send + presence.
9. **Deleting a place with an outstanding reply chip.** 0025 FK is `on delete set null` — the chip must render conditionally (`reply_to_place_id` non-null AND place still present) and gracefully vanish. Hard-delete path only; soft-delete (`hidden_at`) keeps the row.

## Migrations Needed

| File | Type | Contents | Deploy |
|------|------|----------|--------|
| `supabase/migrations/0028_chat_realtime_publication.sql` | append-only (new) | (1) `alter publication supabase_realtime add table trip_messages;` (2) `trip_messages_default_user_id()` BEFORE-INSERT trigger mirroring 0016 `votes_default_user_id` | Remote `supabase db push` (or Supabase↔GitHub auto-apply on `main`) — **required for live chat + sends**. No `pnpm supabase:types` regen needed (no shape/type change). |

No changes to `0025`/`0026` (append-only, §4.3/§5). No `packages/core/schemas` changes — `chat.ts` + `moaChannelName` are already built.

## Files to Touch / Create

| File | Action | What |
|------|--------|------|
| `supabase/migrations/0028_chat_realtime_publication.sql` | **create** | publication add + user_id default trigger (Q1) |
| `packages/api/src/queries/chat.ts` | **create** | `listTripMessages` + `sendTripMessage` (Q2) |
| `packages/api/src/queries/chat.test.ts` | **create** | vitest, mirror `votes`/`date-polls` test layout |
| `packages/api/src/queries/index.ts` | edit | `export * from './chat';` |
| `apps/web/app/moa/[id]/_components/moa-chat.tsx` | **create** | presentational bubbles + input + reply chip; mirror `poll-chat.tsx` (props: messages, onSend, viewers, replyToPlaceId, onClearReply, onChipTap) |
| `apps/web/app/moa/[id]/_components/moa-tab-bar.tsx` | **create** | net-new fixed bottom bar, 2 tabs, extendable (Q5) |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` | edit | `activeTab` state; extend channel effect (trip_messages INSERT + presence, pre-subscribe); messages state + append/dedup; viewers; reply-prefill; chip→모으기+openPlaceId; render 모으기/채팅 conditionally, island stays mounted |
| `apps/web/app/moa/[id]/_components/place-list.tsx` | edit | 답장 stub (L218-229 toast) → `onReply(placeId)` prop callback |
| `apps/web/app/moa/[id]/page.tsx` | edit | `listTripMessages(supabase, id)` seed; add `user.id` to `nameIds`; pass `initialMessages` + sender nickname to island |
| `apps/web/__tests__/moa-island.test.tsx` | edit | extend for chat/tab/presence seams (existing test file) |
| `apps/web/__tests__/moa-chat.test.tsx` | **create** | presentational chat render/send test |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.6.0 (+ @testing-library, jest-dom) |
| Config file | web: `apps/web` vitest project; api: `packages/api` vitest |
| Quick run (api) | `pnpm --filter @moajoa/api test` |
| Quick run (web) | `pnpm --filter web test:run` |
| Full suite | `pnpm -r test` (per project-memory: **sequential**, worktree parallel build is broken) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | Exists? |
|-----|----------|------|---------|---------|
| CHAT-01 | `listTripMessages` orders asc, `sendTripMessage` omits user_id + maps reply_to_place_id | unit | `pnpm --filter @moajoa/api test` | ❌ Wave 0 (`chat.test.ts`) |
| CHAT-01 | island appends postgres_changes message, dedups by id; history seed renders | unit (test seam: `initialMessages`) | `pnpm --filter web test:run` | ❌ Wave 0 (extend `moa-island.test.tsx` / new `moa-chat.test.tsx`) |
| CHAT-02 | presence sync → viewers count; "N명 보는 중" copy | unit (seam: seeded presenceState) | `pnpm --filter web test:run` | ❌ Wave 0 |
| CHAT-03 | 답장 → chat tab + reply prefill; chip tap → 모으기 tab + openPlaceId set | unit | `pnpm --filter web test:run` | ❌ Wave 0 |
| CHAT-01/02 live | publication + trigger applied (postgres_changes deliver, send succeeds) | manual/Preview UAT | remote push then two-browser check | manual (deploy gate) |

Follow the poll/moa test-seam idiom: components accept `initialMessages` / seeded presence to skip realtime in unit tests (`poll-chat.tsx` `initialMessages`, `poll-vote-island` `initial*Tally`).

### Wave 0 Gaps
- [ ] `packages/api/src/queries/chat.test.ts` — covers CHAT-01 query contract
- [ ] `apps/web/__tests__/moa-chat.test.tsx` — presentational chat (bubbles/send/reply chip)
- [ ] extend `apps/web/__tests__/moa-island.test.tsx` — tab switch, message append/dedup seam, presence count, reply/chip wiring
- [ ] Add `initialMessages` (+ seeded presence) test seams to island/chat components

## Security Domain

`security_enforcement` not disabled in config → enabled. Chat is authenticated-member-only this phase (D-09).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing kakao/email session (page.tsx `auth.getUser()` gate + `redirect('/login')`). No new auth surface (anon guest = Phase 25). |
| V4 Access Control | yes | RLS: SELECT `can_read_trip`, INSERT `auth.uid()`+`can_vote_trip`, DELETE own/owner (0025). WALRUS re-evaluates SELECT RLS per-subscriber for postgres_changes. **Publication add does NOT bypass RLS** (0026 header: publication is exposure surface, filter stays on SELECT policy). |
| V5 Input Validation | yes | `TripMessageCreateSchema.parse()` at UI boundary (body 1–140, mirrors 0025 CHECK). §4.5. |
| V6 Cryptography | no | none hand-rolled. |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Non-member reads/sends to a moa | Elevation / Info-disclosure | 0025 RLS helpers gate both directions; WALRUS enforces SELECT RLS on realtime delivery. |
| Spoofed sender (user_id forgery) | Spoofing | 0028 trigger pins `user_id := auth.uid()`; INSERT `with check user_id = auth.uid()` rejects mismatch even if client supplies one. |
| Oversized/empty message | Tampering | DB CHECK `char_length between 1 and 140` + Zod at boundary. |
| Service-role exposure | Info-disclosure | anon key + cookie session only; no service role in client (§5, page.tsx already compliant). |

## Project Constraints (from CLAUDE.md)

- **§4.2** `packages/core/schemas/*` cross-client — `chat.ts` already built; **no changes needed** this phase (keeps web/iOS/Edge in sync). Do not drift shapes from 0025 columns.
- **§4.3** Migrations append-only — new `0028` only; never edit `0025`/`0026`. Column adds nullable/defaulted (0028 adds a trigger, not a column). Run `pnpm supabase:types` after schema changes — **not triggered here** (publication+trigger don't change types).
- **§4.5** No `.js` extensions in workspace imports; validate external input with `@moajoa/core` Zod (`TripMessageCreateSchema`). Comments = why.
- **§5 Forbidden** — no iOS changes (chat is web-only this phase; iOS chat consumes the same `chat.ts` in a future phase); no service-role in client; no direct cross-table EXISTS in RLS (0025 already uses SECURITY DEFINER helpers); no editing applied migrations.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @supabase/supabase-js | realtime + queries | ✓ | 2.110.0 (pinned) | — (2.110 fixed GAP-19D presence) |
| Supabase Realtime (postgres_changes + presence) | CHAT-01/02 | ✓ (places/links already live) | — | none — core mechanism |
| Remote Supabase (db push / auto-apply) | 0028 publication+trigger | ⚠️ verify | — | none — chat silently fails live without it (Pitfall 7) |
| colima (local supabase) | local migration test | per project-memory required | — | — |
| Vitest | Wave 0 tests | ✓ | ^1.6.0 | — |

**Blocking:** confirm the remote-apply path for 0028 (manual `supabase db push` vs Supabase↔GitHub auto-apply on `main`) — this is the one out-of-code dependency that gates live behavior.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | INSERT-only chat works under default replica identity (no `replica identity full`) | Q1 | Low — INSERT always carries the new row; consistent with 0026 not setting it. If wrong, add `alter table trip_messages replica identity full;` to 0028. |
| A2 | Remote apply is either `supabase db push` or Supabase↔GitHub auto-apply on `main` | Q1/Env | Medium — if neither is wired, 0028 never reaches prod and live chat fails silently. Verify deploy path before shipping. |
| A3 | `moa-island` stays a `fixed inset-0` single-mount; conditional-render tabs won't force remount | Q5/D-02 | Low — standard React; only breaks if someone route-splits (explicitly forbidden by D-02). |

## Open Questions (resolved)

All four CONTEXT Open Questions are resolved above:
1. **Publication (D-07)** → RESOLVED: required. 0028 adds `trip_messages` to `supabase_realtime` **and** a `user_id` default trigger (second, subtler gap found). (Q1)
2. **API queries** → RESOLVED: none exist; add `chat.ts` (`sendTripMessage`/`listTripMessages`) mirroring the authenticated direct-table idiom, not the anon RPC. (Q2)
3. **Single-channel multi-binding stability** → RESOLVED: all postgres_changes bindings before `.subscribe()`; message binding lives in island's pre-subscribe chain (poll's post-subscribe child-binding shape works only for broadcast); append payload, don't reconcile. (Q3)
4. **Presence identity/count** → RESOLVED: key=`currentUserId`, track `{user_id, nickname}`, count `Object.keys(presenceState()).length`; 2.110 confirmed fixes the bug; anon excluded this phase. (Q4)

Remaining for the planner to confirm (not blocking research): the remote deploy path (A2) and final tab-bar/chat layout (UI-SPEC, Claude's discretion per CONTEXT).

## Sources

### Primary (HIGH)
- Codebase: `packages/core/src/schemas/chat.ts`, `constants.ts` (moaChannelName), `apps/web/app/poll/[code]/_components/poll-chat.tsx` + `poll-vote-island.tsx`, `apps/web/app/moa/[id]/_components/moa-island.tsx` + `place-list.tsx` + `page.tsx`, `packages/api/src/queries/{votes,places,date-polls}.ts`, `supabase/migrations/0016_trips_baseline.sql` (votes trigger) / `0025_web_share.sql` / `0026_realtime_publication.sql`, `package.json` (supabase-js 2.110.0).
- [Subscribing to Database Changes | Supabase Docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Postgres Changes | Supabase Docs](https://supabase.com/docs/guides/realtime/postgres-changes)

### Secondary (MEDIUM)
- [supabase-js#1917 — bindings mismatch for postgres changes](https://github.com/supabase/supabase-js/issues/1917) (reinforces bindings-negotiated-at-subscribe)

## Metadata

**Confidence breakdown:**
- Backend (publication + trigger + queries): HIGH — direct in-repo precedent (0026 header, votes trigger, votes.ts idiom).
- Realtime wiring (single channel, ordering, presence): HIGH — Supabase docs + existing moa/poll implementations; 2.110 pin verified.
- Tab shell: MEDIUM — net-new, but low-risk client-state pattern; only layout details deferred to UI-SPEC.

**Research date:** 2026-07-10
**Valid until:** ~2026-08-10 (stable; supabase-js pinned, schema/patterns settled). Re-check only if supabase-js is bumped or realtime bindings behavior changes.
