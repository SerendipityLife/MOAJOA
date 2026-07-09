# Phase 26: Realtime Chat - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 8 planned artifacts
**Analogs found:** 8 / 8 (no net-new — every artifact has a concrete in-repo analog)

> Read order for planner/executor: this file → the analog files it cites → canonical refs in 26-CONTEXT.md.
> Golden rule this phase inherits: **ONE channel per screen** (`moaChannelName(tripId)` = `moa:{tripId}`). The moa-island already owns it; chat + presence bind onto that SAME instance — never a second `client.channel()`.

---

## File Classification

| New/Modified file | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/moa/[id]/_components/moa-chat.tsx` (NEW) | component | event-driven (realtime fan-out) | `apps/web/app/poll/[code]/_components/poll-chat.tsx` | exact (role+flow) |
| `apps/web/app/moa/[id]/_components/moa-tabs.tsx` (NEW, `[모으기][채팅]` bottom tab bar) | component | request-response (client state) | `apps/web/components/bottom-nav.tsx` (fixed bottom bar shell) + `apps/web/components/tabs.tsx` (Radix state) | role-match (compose two) |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` (MODIFY — tab state + chat + presence) | component | event-driven (realtime hub) | itself (current) + `poll-vote-island.tsx` (presence + shared-channel chat wiring) | exact |
| `packages/api/src/queries/trip-messages.ts` (NEW — `sendTripMessage`/`listTripMessages`) | service (typed query) | CRUD (insert + list-by-parent) | `votes.ts` `castVote` (direct insert) + `places.ts` `listPlacesByTrip` (list-by-trip) | exact (idiom), see NOTE on RPC-vs-table |
| `supabase/migrations/0028_trip_messages_realtime.sql` (NEW) | migration | config (realtime publication) | `supabase/migrations/0026_realtime_publication.sql` | exact |
| Place-mention `#N` chip render + tap→scroll (in `moa-chat.tsx` + `moa-island.tsx` + `place-list.tsx`) | component | event-driven (cross-tab nav) | `place-list.tsx` `openPlaceId` scrollIntoView effect + `moa-island.tsx` `onMarkerTap` | exact |
| Presence "N명 보는 중" strip (in `moa-island.tsx` or `moa-chat.tsx`) | component | pub-sub (presence sync) | `poll-vote-island.tsx` viewers presence strip | exact |
| `apps/web/__tests__/moa-chat.test.tsx` (NEW) + additions to `moa-island.test.tsx` | test | — | `poll-vote-island.test.tsx` (channel+presence mock) + `moa-island.test.tsx` (postgres_changes channel fake) | exact |

---

## Pattern Assignments

### 1. `moa-chat.tsx` (component, event-driven) — NEW

**Analog:** `apps/web/app/poll/[code]/_components/poll-chat.tsx` (whole file, 229 lines — read it once).

**Idiom to mirror:** message-bubble list + compose row + optimistic-append-then-broadcast; binds its message events onto the parent's SINGLE shared channel passed as a `channel` prop, never opens its own.

- **Props seam** (poll-chat L12-26): `{ channel: Channel | null; initialMessages?: ChatMessage[] }`. `initialMessages` = test seam that skips the realtime subscribe. Mirror exactly.
- **Bubble render** (poll-chat L150-181): `mine = m.device_token === myToken` → `justify-end`/`justify-start`, `rounded-2xl` bubble, nickname label + `whitespace-pre-wrap break-words body`, `relTime()` helper (L36-44). Mirror wholesale.
- **Compose row** (poll-chat L184-205): controlled input, `onKeyDown Enter → send()`, `maxLength={140}`, `보내기` button `disabled={sending}`.
- **Send** (poll-chat L93-119): `setSending`, clear draft, call query, optimistic dedupe-append (`prev.some(m=>m.id===row.id)`), restore draft + error toast on catch.

**What DIFFERS for moa/chat:**
1. **Mine-check by `user_id`, not `device_token`.** Moa is authed members (D-09), so `mine = m.user_id === currentUserId`. Drop `getDeviceToken`; pass `currentUserId` down from island.
2. **Fan-out is `postgres_changes` INSERT, NOT `broadcast`.** Poll-chat uses `broadcast 'comment'` because anon has NO SELECT read path. Moa members DO have SELECT (0025 `can_read_trip`) + a publication (0028), so peers arrive via the island's `postgres_changes` INSERT on `trip_messages` → reconcile/append, exactly like places INSERT in moa-island. So moa-chat does NOT add its own `.on('broadcast')` binding; the island's INSERT handler appends. (Simpler than poll — one less binding.)
3. **Real history.** Seed `initialMessages` from `listTripMessages` (SSR in page.tsx or island hydrate), unlike poll's always-empty thread.
4. **No delete UI this phase** (범위 외 in 26-CONTEXT `<domain>`). Drop the `pendingDelete`/`doDelete`/`Dialog` block (poll-chat L64,121-137,212-226).
5. **Reply-quote chip** (`#N 장소명`) rendered above the bubble body when `m.reply_to_place_id` is set — see §6.
6. **Auto-scroll to bottom** on new message (D-09 Discretion) — add a `messagesEndRef` + `scrollIntoView`; poll-chat has none.

---

### 2. `moa-tabs.tsx` (component, request-response) — NEW `[모으기] [채팅]` bottom tab bar

**Analogs (compose two):**
- **Fixed-bottom-bar shell** — `apps/web/components/bottom-nav.tsx` L24-46: `nav.fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur` → `ul.flex items-stretch` → per-tab `flex-1` with `active ? text-brand-500 : text-neutral-500`. Copy the visual shell.
- **State semantics** — `apps/web/components/tabs.tsx` (Radix) or plain `useState` in the island.

**Idiom to mirror:** iOS 4탭 IA mirror — a `flex` row of equal `flex-1` tab buttons pinned to bottom, active tab brand-colored.

**What DIFFERS (critical — D-02):**
1. **Client state, NOT routing.** bottom-nav uses `next/link` + `usePathname` (route-per-tab). Moa tabs MUST be `useState<'gather'|'chat'>` in moa-island so the island mounts once and the `moa:{tripId}` channel is never torn down on tab switch (D-02, "라우트 분리 시 채널 재생성 위험 회피"). Replace `<Link>` with `<button onClick={() => setTab(...)}>`.
2. **Scoped to `/moa/[id]`, not top-level.** bottom-nav hides itself off the 3 top-level routes (`onTab` guard) and behind `isDevToolsEnabled()`. moa-tabs is always shown inside the moa detail screen — drop both guards.
3. **Extensible to 4 tabs** (D-01) — model `TABS` as an array like bottom-nav L13-17 (`모으기`/`채팅` now; 플랜/예약/가계부 자리만) but render only the 2 active.
4. Coexists with the app-shell bottom-nav's `모아` (home) — this is an INNER section bar (D-03); z-index/placement per UI-SPEC.

> NOTE: `components/tabs.tsx` (Radix segmented pill) is the analog for a *top* segmented control (as `add-content-tabs.tsx` uses it). For a *bottom* iOS-style bar, `bottom-nav.tsx` is the closer visual analog. Planner picks per UI-SPEC; the state rule (client, in-island) holds either way.

---

### 3. `moa-island.tsx` (component, event-driven hub) — MODIFY

**Analogs:** itself (current, 282 lines) + `poll-vote-island.tsx` for the presence + shared-channel-to-chat wiring it lacks.

**Existing idiom to KEEP:** single-channel `useEffect` (moa-island L133-152) — `client.channel(moaChannelName(trip.id))` with `postgres_changes` places INSERT + links UPDATE → `reconcile()`, cleanup `removeChannel`. reconcile = full refetch, never trust payload (L92-130).

**Add, mirroring `poll-vote-island.tsx`:**
1. **Tab state** — `const [tab, setTab] = useState<'gather'|'chat'>('gather')`; render `모으기` view (current map+sheet) vs `채팅` view (`<MoaChat>`) by `tab`. Both stay mounted-or-conditional under the ONE island so the channel persists (D-02).
2. **Surface the channel as state for chat** (poll-vote-island L98-108, L148-152): keep a `channelRef` AND a `const [sharedChannel, setSharedChannel] = useState<Channel|null>(null)`; set both inside the subscribe effect. Pass `sharedChannel` to `<MoaChat channel={sharedChannel} />`. This is the "no second channel on same topic" guard — copy the L100-108 comment rationale.
3. **Presence config + track** (poll-vote-island L148-166, L177-181): create the channel with `{ config: { presence: { key: <userId> } } }`, add `.on('presence',{event:'sync'}, () => setViewers(Object.keys(channel.presenceState()).length))`, and in `.subscribe(async s => { if (s==='SUBSCRIBED') await channel.track({ user_id, nickname, online_at }) })`. Add a `const [viewers, setViewers] = useState(0)`.
4. **New `trip_messages` INSERT binding** on the SAME channel (mirror the places INSERT binding at moa-island L137-141) → append/reconcile chat messages. Filter `trip_id=eq.${trip.id}`.
5. **Cross-tab mention nav** — a handler `openPlaceFromChat(placeId)` that does `setTab('gather'); setOpenPlaceId(placeId); setSheetAnchor('expanded')` (reuses existing `onMarkerTap` body, moa-island L178-181) and pass to chat.
6. **Reply prefill** — `replyToPlaceId` state; place-list `답장` button (place-list L219-229 stub) calls `setTab('chat'); setReplyToPlaceId(p.id)`.

**What DIFFERS from poll-vote-island:** authed (`user_id`/`display_name`), not anon device-token/nickname-gate. `nickname` = `trip` member's `display_name` (D-08), no nickname gate. Presence key = `userId`.

---

### 4. `packages/api/src/queries/trip-messages.ts` (service, CRUD) — NEW

**Analogs:** `votes.ts` `castVote` (L8-23, direct table insert) + `places.ts` `listPlacesByTrip` (L4-16, list-by-trip ordered).

**⚠️ KEY DIVERGENCE from the poll analog:** `date-polls.ts` `postComment` (L53-65) uses a **SECURITY DEFINER RPC** (`post_poll_comment`) because anon has no direct table grant. **Do NOT mirror that here.** `trip_messages` has direct-table RLS for authed members (0025 L44-56: SELECT `can_read_trip`, INSERT `user_id=auth.uid() AND can_vote_trip`). So use **direct `.from('trip_messages')` insert/select**, like `votes.ts`/`places.ts` — no RPC.

**`sendTripMessage`** — mirror `castVote` (votes.ts L8-23):
```ts
export async function sendTripMessage(
  client: MoajoaSupabaseClient,
  input: TripMessageCreate,   // @moajoa/core — trip_id, nickname, body, reply_to_place_id?
): Promise<TripMessage> {
  const { data, error } = await client
    .from('trip_messages')
    .insert({
      trip_id: input.trip_id,
      nickname: input.nickname,               // denormalized snapshot (D-08 / chat.ts)
      body: input.body,
      reply_to_place_id: input.reply_to_place_id ?? null,
    })                                         // user_id pinned by RLS auth.uid(), NOT client-supplied (chat.ts note)
    .select('*')
    .single();
  if (error) throw error;
  return data as TripMessage;
}
```

**`listTripMessages`** — mirror `listPlacesByTrip` (places.ts L4-16) but **ascending** created_at (chat history oldest→newest, index `trip_messages_trip_id_idx (trip_id, created_at)` from 0025 L39):
```ts
export async function listTripMessages(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<TripMessage[]> {
  const { data, error } = await client
    .from('trip_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TripMessage[];
}
```
Register both in `packages/api/src/queries/index.ts` (barrel). Types come from `@moajoa/core` `TripMessage`/`TripMessageCreate` (chat.ts — already exists, 23-05).

**Test analog:** `date-polls.test.ts` L116-153 (`makeClient({ rpcResult })`, assert exact arg object, `.rejects` on `{ error }`) — but assert on `from().insert()`/`from().select()` chain (not `rpc`), matching `votes`/`places` test style. See `places.test.ts` for the `from`-chain mock.

---

### 5. `supabase/migrations/0028_trip_messages_realtime.sql` (migration) — NEW

**Analog:** `supabase/migrations/0026_realtime_publication.sql` (whole file, 18 lines) — near-verbatim.

**Idiom to mirror:** `alter publication supabase_realtime add table <t>;` with a header comment recording the decision + the "무음 no-op" rationale.

**Exact body:**
```sql
alter publication supabase_realtime add table trip_messages;
```

**What DIFFERS:** just the table name. Number is **0028** (0027 is the latest; append-only, never edit 0026). This is D-07 / Open Q1 — 0026 registered only `places`+`links`; without this, the island's `trip_messages` INSERT subscription is a silent no-op (same Phase 24 Pitfall 2 the 0026 header documents). RLS unchanged (0025 already gates SELECT via `can_read_trip`; publication is exposure surface only — copy the 0026 L11-13 comment). **Gate: remote `supabase db push` after merge** (CLAUDE.md §4.3).

---

### 6. Place-mention `#N` chip render + tap→scroll (component, event-driven)

**Analogs:**
- **Scroll target + effect** — `place-list.tsx` L63-68: `useEffect` on `openPlaceId` → `document.querySelector('[data-place-id="${openPlaceId}"]')?.scrollIntoView({behavior:'smooth',block:'nearest'})`. Rows already carry `data-place-id={p.id}` (place-list L141). **Reuse as-is** — the mention tap just needs to drive `openPlaceId`.
- **Open-place handler** — `moa-island.tsx` `onMarkerTap` L178-181 (`setOpenPlaceId(id); setSheetAnchor('expanded')`). The mention chip tap calls the same path + `setTab('gather')`.
- **Reply-source button** — `place-list.tsx` L218-229 existing `답장` stub (currently `toast('채팅은 곧 열려요')`). D-10: swap the handler to `setTab('chat') + setReplyToPlaceId(p.id)`.

**Idiom:** chip render in the bubble (new small markup, use `Chip` from `@/components` — `chip.tsx` exists) showing `#${seqNo} ${name}`; `onClick` → island's `openPlaceFromChat(placeId)`.

**What DIFFERS / net-new bit:** resolving `reply_to_place_id` → `#N 장소명` needs the place's `seq_no` + name. The island already holds `places` state; pass a `placesById` lookup (or `seq_no`+name map) into `<MoaChat>`. Highlight-on-arrival: place-list currently only scrolls; if a visual highlight is wanted (D-10 "하이라이트"), add a transient ring on the opened row — small addition, no exact analog beyond the `isOpen` accordion styling (place-list L191). FK `on delete set null` (0025 L36) means a deleted place's chip silently disappears when `reply_to_place_id` is null — render chip only when non-null + resolvable.

---

### 7. Presence "N명 보는 중" strip (pub-sub)

**Analog:** `poll-vote-island.tsx` — presence wiring L96/L148-166/L177-181 + strip render L363-369:
```tsx
{viewers > 0 && (
  <div className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500">
    <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
    <span>{viewers <= 1 ? '지금 보는 중' : `지금 ${viewers}명 보는 중`}</span>
  </div>
)}
```
`grep "보는 중"` → only poll-vote-island. Copy strip + `setViewers(Object.keys(channel.presenceState()).length)` on `presence sync`.

**What DIFFERS:** track payload keyed by `user_id` (authed) not `device_token`; `nickname = display_name`. Distinct count = `Object.keys(presenceState()).length` (presence key = userId → dedupes multi-tab per the `config.presence.key`). Placement (header vs chat-tab top) per D-09 Discretion + UI-SPEC. Only authed members counted this phase (anon guests = Phase 25).

---

### 8. Chat unit tests (test) — NEW `moa-chat.test.tsx` + additions to `moa-island.test.tsx`

**Analogs:**
- **`poll-vote-island.test.tsx`** — the channel + presence mock. `makeChannel()` L8-19: chainable `.on(()=>ch)`, `.subscribe(cb=>{cb('SUBSCRIBED');return ch})`, capturing `.track`/`.send`, `.presenceState(()=>({}))`. Mock `@/lib/supabase/browser`, `@moajoa/api`, `@/components` (L23-61). **Copy this mock harness for presence assertions.**
- **`moa-island.test.tsx`** — the `postgres_changes` channel fake that captures `.on(type, filter, cb)` into `onCalls[]` (L9-22) so tests can invoke `insert.cb()` and assert refetch. Test 1 (L169-181) asserts single `moa:trip-1` channel + exact bindings — **extend it: now expect a 3rd `postgres_changes` binding for `trip_messages` INSERT + presence sync binding + `.track`.**

**Idioms to mirror:** mock modules BEFORE importing the component (both files); `initialMessages`/`initial*` seed props as the test seam skipping realtime; assert optimistic-append then dedupe; assert channel is created exactly once and `removeChannel` gets the same instance on unmount (moa-island.test Test 1-2).

**What DIFFERS:** mock `@moajoa/api` `sendTripMessage`/`listTripMessages` (direct-query mocks returning rows), not `postComment` RPC. Assert `mine` split by `user_id`. Assert mention chip tap flips `tab` to gather + expands the row (extend moa-island Test 5's `aria-expanded` assertion, L215-222). Presence assertion: after `subscribe` fires `SUBSCRIBED`, `track` called with `{user_id, nickname}`.

---

## Shared Patterns

### ONE channel per screen (cross-cutting, D-06)
**Source:** `packages/core/src/constants.ts` L260-268 (`moaChannelName`) + `moa-island.tsx` L133-152 + `poll-vote-island.tsx` L143-174.
**Apply to:** moa-island (owner), moa-chat (consumer via `channel` prop), presence strip.
The island creates `client.channel(moaChannelName(trip.id), {config:{presence:{key:userId}}})` once; binds `places` INSERT + `links` UPDATE + **`trip_messages` INSERT** + `presence sync`; exposes it via `useState` to chat. Never a second `client.channel()` on `moa:{tripId}`.

### Optimistic mutate + rollback + toast
**Source:** `moa-island.tsx` `onToggleVote` L155-175; `poll-chat.tsx` `send` L93-119.
**Apply to:** chat send.
Optimistic append/flip → await query → dedupe on server row → on catch restore + `toast(..., {variant:'error'})`.

### Reconcile-not-payload on realtime
**Source:** `moa-island.tsx` L92-130 + header L44-48.
**Apply to:** the `trip_messages` INSERT handler — prefer append of the trusted own-send row; for peer INSERTs, append the event row (chat body is low-risk) OR reconcile via `listTripMessages` if RLS drift is a concern. Follow existing places-INSERT → reconcile precedent if unsure.

### Direct-table query house contract
**Source:** `votes.ts`, `places.ts` (`client`-first arg, `{error} throw`, `select('*').single()` on insert, RLS-only, no service role).
**Apply to:** `trip-messages.ts` — NOT the RPC form used by `date-polls.ts` (that's anon-only).

### Denormalized nickname snapshot
**Source:** `packages/core/src/schemas/chat.ts` L8-13, L31-36 + 0025 L10.
**Apply to:** `sendTripMessage` — write `nickname` at send time (from `display_name`), never re-join from profiles; `user_id` pinned by RLS `auth.uid()`, never client-supplied.

---

## No Analog Found

None. Every artifact maps to a concrete in-repo analog. Two artifacts carry a **small net-new sub-part** (not a whole-file gap):
- **`#N 장소명` chip resolution** (§6): resolving `reply_to_place_id`→`seq_no`+name and a transient highlight ring have no exact analog; build from `Chip` + the existing `openPlaceId`/accordion styling. Low risk.
- **Bottom tab bar as client-state (not routes)** (§2): no existing bottom bar uses `useState` instead of routing — compose `bottom-nav.tsx` visuals with `useState` semantics. Explicitly required by D-02.

---

## Metadata

**Analog search scope:** `apps/web/app/moa/[id]/_components/`, `apps/web/app/poll/[code]/_components/`, `apps/web/components/`, `apps/web/__tests__/`, `packages/api/src/queries/`, `packages/core/src/{schemas,constants}`, `supabase/migrations/`.
**Files scanned:** 15 read in full/targeted + greps for `trip_messages`, `moaChannelName`, comment queries, `보는 중`.
**Pattern extraction date:** 2026-07-10
