# Phase 10: 웹 투표 (협업) - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 5 (1 migration, 1 api module + barrel, 1+ web island, 1 page edit, shared auth)
**Analogs found:** 5 / 5 (all exact or strong role-matches — backend mostly pre-exists)

> The backend (votes table, RLS, `can_vote_board`, `vote_counts_for_places`, `castVote/retractVote/getVoteCounts`, `isPlaceConfirmed`) already exists. This phase only adds: 2 RPCs in `0009`, 2 api helpers in `memberships.ts`, a client voting island on `/b/[slug]`, and a member-count denominator. Every new file has a near-verbatim analog below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0009_join_shared_board.sql` | migration | transform (RPC) | `0001_init.sql` `can_vote_board()` + `add_manual_place()` + `vote_counts_for_places()` | exact (idiom copy) |
| `packages/api/src/queries/memberships.ts` (new) | service | CRUD / RPC | `packages/api/src/queries/votes.ts` | exact |
| `packages/api/src/queries/index.ts` (modified) | config (barrel) | — | itself (lines 1-4) | exact |
| `apps/web/app/b/[slug]/_components/*vote*.tsx` (new island) | component | event-driven (toggle) | `apps/web/app/boards/[id]/_components/retry-extraction-button.tsx` | exact |
| `apps/web/app/b/[slug]/page.tsx` (modified) | route/page | request-response (SSR) | itself + `boards/[id]/page.tsx` (server `getUser`) | exact |

---

## Pattern Assignments

### `supabase/migrations/0009_join_shared_board.sql` (migration, RPC)

**Analog:** `supabase/migrations/0001_init.sql`

**Append-only rule (CLAUDE.md §4.3):** New file, monotonic number `0009`. Never edit `0001`. `0008` is the current max.

**SECURITY DEFINER `sql` helper idiom** — copy verbatim header for `accepted_member_count` (`0001` lines 306-324, `can_vote_board`):
```sql
create or replace function can_vote_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists ( ... );
$$;
```
Then the grant (`0001` line 485 pattern):
```sql
grant execute on function vote_counts_for_places(uuid[]) to authenticated, anon;
```
→ `accepted_member_count(p_board_id uuid) returns bigint` MUST be `language sql stable security definer set search_path = public` and `grant ... to authenticated, anon` (anon needs the denominator for the public render, same grant logic as `vote_counts_for_places`).

**SECURITY DEFINER `plpgsql` write-with-permission-check idiom** — copy for `join_shared_board` (`0001` lines 558-604, `add_manual_place`):
```sql
create or replace function add_manual_place(...)
returns places
language plpgsql
security invoker          -- NOTE: join_shared_board needs security DEFINER (see below)
set search_path = public
as $$
declare
  v_place places;
begin
  if not can_edit_board(p_board_id) then
    raise exception 'permission denied: cannot edit board';
  end if;
  insert into places (...) values (...)
  on conflict (board_id, google_place_id) do update set ... 
  returning * into v_place;
  return v_place;
end;
$$;
grant execute on function add_manual_place(...) to authenticated;
```

**Board lookup shape** (`share_slug` + `visibility` live on `boards` — `0001` lines 98-100):
```sql
visibility text not null default 'private' check (visibility in ('private','shared','public')),
share_slug text unique check (char_length(share_slug) between 8 and 32),
```
→ `join_shared_board` selects board by `where share_slug = p_share_slug and visibility in ('shared','public')`.

**memberships insert shape** (`0001` lines 161-170 — note `unique (board_id, user_id)` enables idempotent upsert; default role is `'editor'` so MUST set `role='voter'` explicitly; `accepted_at` is nullable so MUST set `now()`):
```sql
create table memberships (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','voter')),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);
```
→ `join_shared_board` body:
```sql
insert into memberships (board_id, user_id, role, accepted_at)
values (v_board_id, auth.uid(), 'voter', now())
on conflict (board_id, user_id) do nothing;   -- already a member = no-op
return v_board_id;
```

**RLS-recursion lesson (CLAUDE.md §4.4 / `0002`):** `0002` exists *because* the original `memberships INSERT` policy (`0001` lines 187-192) only allowed `am_board_owner(board_id)` — a self-join visitor is NOT the owner, so a plain client `insert` would be **denied by RLS**. This is exactly why `join_shared_board` MUST be `security definer` (runs as table owner / BYPASSRLS, like the `0002` helpers at lines 18-48): it lets a non-owner self-insert as `voter` WITHOUT loosening the deny-by-default insert policy. Do NOT add a new "anyone can insert membership" RLS policy — route through the definer RPC, per `0002` header lines 9-13.

**Why DEFINER not INVOKER here (vs `add_manual_place` which is INVOKER):** `add_manual_place` only needs the *caller's* existing edit rights; `join_shared_board` deliberately *grants* a new right the caller doesn't yet have (membership), so it must bypass RLS = `security definer`.

---

### `packages/api/src/queries/memberships.ts` (service, CRUD/RPC) — NEW

**Analog:** `packages/api/src/queries/votes.ts` (entire file, 56 lines)

**Imports + client typing + throw + cast** (`votes.ts` lines 1-2, 42-55):
```typescript
import type { Vote, VoteCast } from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

export async function getVoteCounts(
  client: MoajoaSupabaseClient,
  placeIds: string[],
): Promise<Record<string, number>> {
  if (placeIds.length === 0) return {};
  const { data, error } = await client.rpc('vote_counts_for_places', { p_place_ids: placeIds });
  if (error) throw error;
  ...
}
```
→ Mirror exactly. No `.js` import extension (CLAUDE.md §4.5). Note `../client` exports `MoajoaSupabaseClient` (loose generic — works for both browser SSR client and supabase-js client).

**`joinSharedBoard`** mirrors `getVoteCounts`'s `.rpc(...)` shape (returns the `board_id uuid`):
```typescript
export async function joinSharedBoard(client: MoajoaSupabaseClient, shareSlug: string): Promise<string> {
  const { data, error } = await client.rpc('join_shared_board', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}
```

**`getAcceptedMemberCount`** mirrors the same `.rpc` + `error throw` + cast:
```typescript
export async function getAcceptedMemberCount(client: MoajoaSupabaseClient, boardId: string): Promise<number> {
  const { data, error } = await client.rpc('accepted_member_count', { p_board_id: boardId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
```
Reuse `isPlaceConfirmed(loveCount, memberCount)` from `@moajoa/core` (vote.ts lines 31-34) — do NOT recompute the 0.5 rule in the UI.

**Barrel** — append one line to `packages/api/src/queries/index.ts` (currently lines 1-4):
```typescript
export * from './boards';
export * from './links';
export * from './places';
export * from './votes';
export * from './memberships';   // ← add
```

---

### `apps/web/app/b/[slug]/_components/*` voting island (component, event-driven) — NEW `'use client'`

**Analog:** `apps/web/app/boards/[id]/_components/retry-extraction-button.tsx` (entire file, 46 lines)

**`'use client'` + browser client + api helper + loading/error + toast** (lines 1-46):
```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerExtraction } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, useToast } from '@/components';

export function RetryExtractionButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  async function onRetry() {
    setPending(true);
    try {
      const result = await triggerExtraction(getSupabaseBrowser(), linkId);
      ...
      router.refresh();
    } catch (err) {
      console.error(err);
      toast('재분석을 시작하지 못했어요.', { variant: 'error' });
    } finally { setPending(false); }
  }
  return <Button variant="outline" size="sm" onClick={onRetry} disabled={pending}>...</Button>;
}
```
→ VoteButton: `castVote`/`retractVote` via `getSupabaseBrowser()`, optimistic-or-`router.refresh()`, `toast` on error, `disabled={pending}`. JoinCTA: `joinSharedBoard(getSupabaseBrowser(), shareSlug)` then `router.refresh()`.

**Session/branch + defense-in-depth-null pattern** — `add-link-form.tsx` shows two relevant idioms:
- early `if (!isDevToolsEnabled()) return null;` (line 13) → island similarly returns `null` / a CTA when a precondition fails.
- `getSupabaseBrowser().auth.getUser()` is the browser way to read the current user (login page uses `.auth.signInWithOtp` at `login/page.tsx` line 68 — magic link, the chosen flow in CONTEXT decision A).

→ Branch logic for the island (CONTEXT decision C):
- not logged in → render "참여해서 투표하기" linking to `/login` (or magic-link). Use `getSupabaseBrowser().auth.getUser()` in a `useEffect` to detect session client-side (page is SSR-cached public — see GOTCHA).
- logged-in + member → ❤️ toggle + counts + 확정 filter.
- logged-in + non-member → "이 보드에 참여하기" → `joinSharedBoard`.

---

### `apps/web/app/b/[slug]/page.tsx` (route/page, SSR) — MODIFIED

**Analog:** itself + `apps/web/app/boards/[id]/page.tsx` lines 13-16 (server `getUser`)

**Tailwind tokens to match** (page.tsx — reuse these exact classes, CLAUDE.md §4.5 match-existing-style):
- brand: `text-brand-500`, `hover:border-brand-300`, `hover:bg-brand-50` (lines 112, 147)
- text: `text-2xl font-semibold` (h1, line 78), `text-lg font-semibold text-neutral-900` (section h2, line 102), `text-base font-semibold` / `text-sm text-neutral-500/600`
- card: `p-3 border border-neutral-200 rounded-lg` (place item, summary-list line 17)

**Where the vote affordance slots in:** per-place rows render in `PlaceSummaryList` (`_components/place-summary-list.tsx` lines 16-28, `places.map((p) => <li key={p.id}>`) and pins in `PublicBoardMap`. The ❤️ toggle + 확정 badge attaches per `p.id` in the summary list `<li>`; the "확정" filter toggles list visibility. A board-level Join/Login CTA goes in the `<header>` block (page.tsx lines 74-85).

**Server `getUser` idiom** if any branch is server-rendered (`boards/[id]/page.tsx` lines 14-16):
```typescript
const supabase = await getSupabaseServer();
const { data } = await supabase.auth.getUser();
```
NOTE: prefer the client island for the user-branch to preserve the public cache (GOTCHA below).

---

## Shared Patterns

### SECURITY DEFINER helper (cross-table / privilege-granting)
**Source:** `0001_init.sql` lines 306-324 (`can_vote_board`), `0002_fix_rls_recursion.sql` lines 18-48
**Apply to:** both new RPCs in `0009`.
```sql
language sql|plpgsql
stable                          -- (omit `stable` for the writing join_shared_board)
security definer
set search_path = public
...
grant execute on function <sig> to authenticated[, anon];
```

### API helper shape
**Source:** `packages/api/src/queries/votes.ts` lines 8-23, 42-55
**Apply to:** every function in `memberships.ts`.
`(client: MoajoaSupabaseClient, ...args) => { const { data, error } = await client.rpc/.from(...); if (error) throw error; return data as T; }`

### Client island + toast
**Source:** `retry-extraction-button.tsx` lines 1-46
**Apply to:** all new vote/join components. `'use client'` + `getSupabaseBrowser()` + `useState(pending)` + try/catch/finally + `useToast()` + `router.refresh()`.

### Confirmed rule (single source — do NOT duplicate)
**Source:** `packages/core/src/schemas/vote.ts` lines 31-38 (`isPlaceConfirmed`, `isPlaceCandidate`)
**Apply to:** the 확정 filter/badge. `isPlaceConfirmed(loveCount, memberCount)` where `memberCount = getAcceptedMemberCount(...)`.

---

## No Analog Found

None. Every file has a strong analog.

---

## ⚠️ LOAD-BEARING GOTCHAS (planner MUST address)

1. **`board.id` and `share_slug` are NOT in the public page payload.** `getCachedPublicBoard` → `getPublicBoardBySlug` → `public_board_view` RPC. The RPC's `jsonb_build_object` (`0001` lines 508-516) emits only `id?`… **actually it does NOT emit `id`** — it emits `title, description, city_code, cover_image_url, updated_at` only. The TS type `PublicBoardView['board']` (`types/index.ts` line 26) *claims* `id` but at runtime `view.board.id` is `undefined`, and `share_slug` is absent entirely. **The join RPC needs `share_slug` (the island already has it from the route `params.slug`) and the member-count RPC needs `board_id` (NOT available).** Planner options: (a) the island calls `joinSharedBoard(slug)` which *returns* `board_id`, then feeds it to `getVoteCounts`/`getAcceptedMemberCount` — works for members but a not-yet-joined viewer can't get counts; or (b) extend `public_board_view` to also emit `board.id` + `share_slug` in a **new** migration RPC (append-only). Decide before planning the count-fetch timing. The slug itself is always available via `params` / `useParams()`.

2. **The public page only matches `visibility='public'`** (`public_board_view` `where ... and visibility='public'`, `0001` line 501). But COLLAB sharing targets `visibility='shared'` boards (CONTEXT B: `visibility in ('shared','public')`). A `shared` board's `/b/[slug]` currently `notFound()`s. **If the share-link flow must work for `shared` boards, the page/RPC needs to also resolve `shared` slugs** — otherwise the whole "참여해서 투표하기" entry point is unreachable for the main use case. Flag for discussion: either the public render must accept `shared` (exposing title/pins to slug-holders = the "slug = bearer invite" model in CONTEXT B), or join happens on a different surface.

3. **Public page is SSR-cached (`unstable_cache`, `revalidate: 3600`, anon client) — the vote layer MUST be a client island.** `cache.ts` builds a cookies-FREE anon client *inside* the cache callback specifically because Next.js 15 throws if `cookies()` is touched inside `unstable_cache` (cache.ts comment lines 27-31, a prior P0). So: never read the user session in the cached server path; hydrate vote/join state in a `'use client'` island via `getSupabaseBrowser().auth.getUser()`. Mutations (`castVote`/`join`) are user-specific and must not enter the cached fetcher.

4. **`memberships.role` defaults to `'editor'`** (`0001` line 165). `join_shared_board` MUST explicitly set `role='voter'` and `accepted_at=now()`; relying on defaults would create an editor with NULL accepted_at (not a member per `can_vote_board`).

5. **Legacy boards (0 members / 0 votes) must not break** (CONTEXT constraint). `isPlaceConfirmed` already guards `totalMembers === 0 → false` (vote.ts line 32). Ensure `getAcceptedMemberCount` returns `0` (not null) for empty boards — the helper coalesces `?? 0`.

6. **`pnpm supabase:types` after `0009`** (CLAUDE.md §4.3) regenerates `packages/api/src/types/database.ts` so `.rpc('join_shared_board')` / `.rpc('accepted_member_count')` are typed. Until then the `as string`/`as number` casts in `memberships.ts` carry the types (acceptable — votes.ts does the same). This is part of the autonomous:false morning gate (CONTEXT D).

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `packages/api/src/queries/`, `packages/core/src/schemas/`+`types/`, `apps/web/app/b/[slug]/`, `apps/web/app/boards/[id]/`, `apps/web/app/login/`, `apps/web/lib/`
**Files scanned:** 14
**Pattern extraction date:** 2026-06-08
