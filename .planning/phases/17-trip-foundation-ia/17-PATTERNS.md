# Phase 17: Trip Foundation & IA 재편 - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 20 new/modified files across 4 areas (squash migration · core Zod · Expo Router · web SSR route)
**Analogs found:** 18 / 20 (2 new with no direct analog: `booking.ts`, onboarding branch screen)

> **How to read this:** every new/modified file maps to an existing file the planner should copy patterns from, with line-anchored excerpts. The two highest-value patterns the planner MUST replicate verbatim are (a) the **RLS SECURITY DEFINER helper** idiom (Shared Patterns §1) and (b) the **existing Board Zod shape** (Shared Patterns §2). All paths are absolute.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0016_trips_baseline.sql` (NEW squash) | migration | transform (rename) | `supabase/migrations/0001_init.sql` + `0002` + `0009` + `0013` | exact (compose all four) |
| `packages/core/src/schemas/trip.ts` (rename from `board.ts`) | model/schema | transform | `packages/core/src/schemas/board.ts` | exact |
| `packages/core/src/constants.ts` (edit: Trip vocab + TripKeys) | config | — | `packages/core/src/constants.ts` (self, `OnboardKeys`/`Limits`/`BoardVisibility`) | exact |
| `packages/core/src/booking.ts` (NEW) | utility | transform | RESEARCH §Code Examples + `category.ts` (pure-fn + zod shape) | role-match |
| `packages/core/src/booking.test.ts` (NEW) | test | — | `packages/core/src/category.test.ts` | exact |
| `packages/core/src/schemas/trip.test.ts` (NEW) | test | — | `packages/core/src/category.test.ts` | exact |
| `packages/api/src/queries/trips.ts` (rename from `boards.ts`) | service | CRUD | `packages/api/src/queries/boards.ts` | exact |
| `apps/ios/lib/entry-route.ts` + `.test.ts` (NEW) | utility + test | — | RESEARCH Pattern 1 + `category.test.ts` | role-match |
| `apps/ios/app/index.tsx` (edit: 0/1/N branch) | route | request-response | `apps/ios/app/index.tsx` (self) | exact |
| `apps/ios/app/trip/[id]/_layout.tsx` (NEW Stack + header) | route/layout | — | `apps/ios/app/boards/_layout.tsx` + `(tabs)/_layout.tsx` | role-match |
| `apps/ios/app/trip/[id]/(tabs)/_layout.tsx` (NEW Tabs) | route/layout | — | `apps/ios/app/(tabs)/_layout.tsx` | exact |
| `apps/ios/app/trip/[id]/(tabs)/map.tsx` (port content) | component/screen | CRUD | `apps/ios/app/boards/[id].tsx` | exact |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (NEW empty state) | component/screen | — | `apps/ios/app/(tabs)/boards.tsx` `ListEmptyComponent` | role-match |
| `apps/ios/app/trip/[id]/(tabs)/{book,ledger}.tsx` (NEW stubs) | component/screen | — | `apps/ios/components/boards/onboard-card.tsx` (presentational) | partial |
| `apps/ios/app/onboarding.tsx` (NEW branch) | component/screen | — | `apps/ios/app/welcome.tsx` (tone) + `boards/new.tsx` (path cards) | role-match |
| `apps/ios/app/trip/create.tsx` (NEW, port from boards/new) | component/screen | CRUD | `apps/ios/app/boards/new.tsx` | exact |
| `apps/ios/app/share-handler.tsx` (edit: repoint to trip) | route | event-driven | `apps/ios/app/share-handler.tsx` (self) | exact |
| `apps/ios/app/+native-intent.tsx` (verify, ~no change) | route | event-driven | `apps/ios/app/+native-intent.tsx` (self) | exact |
| `apps/web/app/t/[slug]/**` (move from `b/[slug]`) | route/component | request-response | `apps/web/app/b/[slug]/page.tsx` + siblings | exact |
| `apps/ios/app/trip/[id]/header.tsx` or `TripHeader` (NEW) | component | — | `apps/ios/app/(tabs)/boards.tsx` (delete Alert) + RESEARCH Pattern 3 | partial |

**Files removed (clean break, D-13):** `apps/ios/app/boards/` tree (`[id].tsx`, `new.tsx`, `_layout.tsx`, `failed.tsx`), `apps/ios/app/(tabs)/{boards,discover,friends,new}.tsx` + `(tabs)/_layout.tsx` FAB. `me.tsx` survives as a trip-out screen (A4 — planner decides exact location).

---

## Pattern Assignments

### `supabase/migrations/0016_trips_baseline.sql` (migration, transform — squash)

**Analog:** compose `0001_init.sql` (tables/triggers/RPCs) + `0002` (RLS recursion fix — the canonical helper bodies) + `0009` (`join_shared_board`/`accepted_member_count`) + `0013` (latest `public_board_view` body). ⚠️ **This is the one place CLAUDE.md §4.3 append-only is intentionally overridden (D-03). Squash everything to a single trips-native baseline, then resume append-only.**

**Tables to port (rename `boards`→`trips`, add `representative_id`)** — from `0001_init.sql:93-105`:
```sql
-- boards table → trips. ADD representative_id (D-10, SETUP-02). NULLABLE-safe
-- via trigger default (see representative trigger below). Keep all existing
-- columns: share_slug (8-32), city_code (<=20), cover_image_url, dates.
create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  representative_id uuid references profiles(id) on delete set null,  -- NEW (D-10)
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 280),
  visibility text not null default 'private'
    check (visibility in ('private','shared','public')),
  share_slug text unique check (char_length(share_slug) between 8 and 32),
  city_code text check (char_length(city_code) <= 20),
  start_date date,                          -- from 0007_board_dates.sql (port)
  end_date date,                            -- from 0007_board_dates.sql (port)
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
⚠️ `start_date`/`end_date` live in `0007_board_dates.sql` (not 0001) — **must be folded into the baseline.** Verify all 0003–0015 deltas are folded (0003 owner default, 0004/0005/0010 extraction hardening, 0008 summaries, 0011 member count, 0012 vote upsert, 0014 profile gender/birthday, 0015 place signature_menu).

**Booking_clicks empty table to include (D-07, Open Q2):** new table, FK `trip_id`/`place_id?`/`user_id`, deny-by-default RLS. No analog row exists — model on the `votes` table FK+RLS shape (`0001_init.sql:414-465`). Minting/EF = Phase 20.

**Triggers/functions inventory (squash checklist — MUST port all):**
| Asset | Source | Type | Rename |
|-------|--------|------|--------|
| `set_updated_at` | `0001:25-33` | trigger fn | reuse as-is |
| `handle_new_auth_user` | `0001:63-88` | trigger fn (DEFINER) | reuse as-is |
| `ensure_share_slug` (×2 triggers) | `0001:117-141` | trigger fn | board→trip table refs |
| `am_board_owner` / `am_board_member` | `0002:18-48` | DEFINER helper | → `am_trip_owner` / `am_trip_member` |
| `can_read_board`/`can_edit_board`/`can_vote_board` | `0001:263-324` | DEFINER helper | → `can_*_trip` |
| `links_default_added_by` / `places_default_added_by` / `votes_default_user_id` | `0001:248-258, 373-383, 427-437` | trigger fn | `board_id`→`trip_id` |
| `join_shared_board` | `0009:40-69` | DEFINER (write) | → `join_shared_trip` (keep slug bearer-invite model) |
| `accepted_member_count` | `0009:75-88` | DEFINER (anon grant) | reuse, `board_id`→`trip_id` |
| `vote_counts_for_places` | `0001:472-485` | DEFINER (anon grant) | reuse |
| `public_board_view` | **`0013:17-84` (latest body — has google_place_id/address)** | DEFINER (anon grant) | → `public_trip_view`. **DO NOT use 0001's older body** (Pitfall 4) |
| `add_manual_place` | `0001:558-608` | invoker RPC | `board_id`→`trip_id` |
| `representative_id` auto-set | **NEW** (Open Q3) | trigger fn | model on `links_default_added_by` pattern — `coalesce(new.representative_id, auth.uid())` |
| PostGIS `geog` generated col + GIST index | `0001:358, 371` | column/index | reproduce verbatim |

(See **Shared Patterns §1** for the exact DEFINER helper body to replicate.)

---

### `packages/core/src/schemas/trip.ts` (model, transform — rename from board.ts)

**Analog:** `packages/core/src/schemas/board.ts` (entire file — 43 lines). The Board shape is **already trip-shaped** (city_code/start_date/end_date/share_slug/cover). Rename + add `representative_id` + flip `TripCreateSchema` dates to required.

**Current Board shape to copy** (`board.ts:4-21`):
```typescript
import { z } from 'zod';
import { BoardVisibility, Limits } from '../constants';

export const BoardSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  title: z.string().min(1).max(Limits.BoardTitleMax),
  description: z.string().max(Limits.BoardDescMax).nullable(),
  visibility: z.enum(BoardVisibility),
  share_slug: z.string().min(8).max(32).nullable(),
  city_code: z.string().max(20).nullable(),
  start_date: z.string().date().nullable(),
  end_date: z.string().date().nullable(),
  cover_image_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Board = z.infer<typeof BoardSchema>;
```

**Create-schema derive pattern** (`board.ts:25-42` — uses `.pick().extend()` then `.partial()` for update). For Trip, dates become **required** (D-09) with `.refine(end >= start)` per RESEARCH §Code Examples:
```typescript
// board.ts:25-39 pattern, BUT dates required + refine (RESEARCH lines 415-421)
export const TripCreateSchema = z.object({
  title: z.string().min(1).max(Limits.TripTitleMax),
  city_code: z.string().max(20),       // preset or 'other' (D-08)
  start_date: z.string().date(),       // required (D-09)
  end_date: z.string().date(),         // required (day-trip = start)
}).refine((v) => v.end_date >= v.start_date, { message: 'end_date must be >= start_date' });
```
Add `export type TripId = Trip['id'];` (canonical identifier type — D-02). Update `schemas/index.ts:2` (`export * from './board'` → `'./trip'`).

---

### `packages/core/src/constants.ts` (config — Trip vocab + TripKeys)

**Analog:** self. Three edits, all mirroring existing in-file patterns:

1. **`Limits` rename** (`constants.ts:8-23`) — `BoardsPerUser`→`TripsPerUser`, `BoardTitleMax`→`TripTitleMax`, etc. (referenced by `trip.ts`).
2. **`BoardVisibility`→`TripVisibility`** (`constants.ts:55-56`) — `z.enum` consumer in trip.ts.
3. **NEW `TripKeys`** — mirror the existing `OnboardKeys` namespace pattern exactly (`constants.ts:186-191`) for AsyncStorage "last trip" (RESEARCH Pattern 5):
```typescript
// constants.ts:186-191 OnboardKeys pattern — namespaced under '@moajoa/trip:'
export const TripKeys = {
  /** UUID string — last trip the user opened (N-entry restore, NAV-01). */
  LastTripId: '@moajoa/trip:last_id',
} as const;
```
`CITY_KO_MAP` (`constants.ts:148-158`) is already the preset list (D-08) — reuse, planner adds `'other'` group + Japan-first sort. `SharedDefaultsKeys.LastBoardId` (`constants.ts:127`) becomes dead but is touched by `share-handler` — see Pitfall 2.

---

### `packages/core/src/booking.ts` (utility, transform — NEW, no analog)

**Analog:** none in codebase (event-driven affiliate URL building is new). Use RESEARCH §Code Examples (lines 346-388) as the skeleton and copy the **pure-function + zod-shape style** from `category.ts`. Lock = signature + token format + Zod types + provider injection sites only (D-06); base URLs/marker IDs = Phase 20.

Key contracts to lock (RESEARCH 353-386):
```typescript
export const BookingClickContextSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid().nullable().optional(),   // D-04 optional
  userId: z.string().uuid(),
});
export const ClickTokenSchema = z.string().regex(/^c_[0-9A-Za-z]{8,30}$/);  // base62, Pitfall 5
export const AffiliateProvider = ['travelpayouts', 'stay22'] as const;
export function buildAffiliateUrl(
  provider: AffiliateProviderType,
  productParams: Record<string, string>,
  subId: ClickToken,
): string { /* travelpayouts → sub_id in marker; stay22 → campaign */ }
```
Add `export * from './booking'` to `packages/core/src/index.ts:1-4`.

---

### `packages/core/src/booking.test.ts` + `schemas/trip.test.ts` + `apps/ios/lib/entry-route.test.ts` (test — NEW)

**Analog:** `packages/core/src/category.test.ts` (entire file). It is the **only** existing test and the exact framework/style template:
- `import { describe, it, expect } from 'vitest';` (`category.test.ts:1`)
- Table-driven `for...of` over canonical keys (`category.test.ts:5-11`)
- Regex assertion idiom `expect(...).toMatch(/.../)` (`category.test.ts:76`)

⚠️ **Wave 0 blocker (RESEARCH 525, 549):** `packages/core/package.json` `"test"` is currently `echo no tests` — must be wired to `vitest run` before these tests execute. iOS tests use `jest-expo` with `--watchman=false` (RESEARCH 523). `decideEntryRoute` (RESEARCH Pattern 1, lines 199-207) is the pure function under test for NAV-01 (0/1/N + "last trip deleted" edge).

---

### `packages/api/src/queries/trips.ts` (service, CRUD — rename from boards.ts)

**Analog:** `packages/api/src/queries/boards.ts` (entire file, 166 lines). Signatures stay identical, vocab renames. The `.from('boards')`→`.from('trips')`, `listMyBoards`→`listMyTrips`, etc.

**Query idiom to copy** (`boards.ts:4-11`):
```typescript
export async function listMyTrips(client: MoajoaSupabaseClient): Promise<Trip[]> {
  const { data, error } = await client
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trip[];
}
```
**Public-view RPC call** (`boards.ts:158-165`) — rename RPC to `public_trip_view`:
```typescript
const { data, error } = await client.rpc('public_trip_view', { p_slug: slug });
```
**Share idiom** (`boards.ts:128-151`) — `shareBoard` relies on the `ensure_share_slug` trigger; port as `shareTrip` (squash preserves the trigger). Update `queries/index.ts:1` (`./boards`→`./trips`). ⚠️ Regenerate `packages/api/src/types/database.ts` via `pnpm supabase:types` after squash (CLAUDE.md §4.3).

---

### `apps/ios/app/index.tsx` (route, request-response — 0/1/N branch)

**Analog:** self (28 lines). **Preserve the auth-subscription scaffold exactly** (`index.tsx:9-27`) — only replace the final board redirect with the trip 0/1/N branch via `decideEntryRoute`.

**Pattern to preserve** (`index.tsx:9-27`):
```typescript
const [authed, setAuthed] = useState<boolean | null>(null);
useEffect(() => {
  let mounted = true;
  supabase.auth.getSession().then(({ data }) => { if (mounted) setAuthed(data.session !== null); });
  const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
    if (mounted) setAuthed(session !== null);
  });
  return () => { mounted = false; sub.subscription.unsubscribe(); };
}, []);
if (authed === null) return null;          // renders null while resolving (UI-SPEC Screen 1)
```
**Replace** `index.tsx:27` (`<Redirect href="/(tabs)/boards" />`) with: fetch `listMyTrips` + `AsyncStorage.getItem(TripKeys.LastTripId)` → `decideEntryRoute(trips, lastTripId)` → `kind==='onboarding'` ⇒ `<Redirect href="/onboarding" />`, `kind==='trip'` ⇒ `<Redirect href={\`/trip/${tripId}/plan\`} />` (UI-SPEC Screen 1). Add an inline error retry state (UI-SPEC copy line 132).

---

### `apps/ios/app/trip/[id]/_layout.tsx` (route/layout — Stack + TripHeader, NEW)

**Analog:** `apps/ios/app/boards/_layout.tsx` (Stack idiom, 10 lines) + RESEARCH Pattern 3 (lines 238-252). Header owned here (parent Stack), NOT in the tabs layout (Pitfall 1 — anti-pattern guard).

**Stack idiom** (`boards/_layout.tsx:3-9`):
```typescript
import { Stack, useGlobalSearchParams } from 'expo-router';
export default function TripLayout() {
  const { id } = useGlobalSearchParams<{ id: string }>();   // layout-level dynamic param (RESEARCH note 253)
  return (
    <Stack screenOptions={{ header: () => <TripHeader tripId={id} /> }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```
Header layout per UI-SPEC Screen 5: left "현재 여행 ▾" switcher (→ 여행 전환 sheet), right profile glyph → `/me`. White bg + `neutral.100` hairline border.

---

### `apps/ios/app/trip/[id]/(tabs)/_layout.tsx` (route/layout — Tabs, NEW)

**Analog:** `apps/ios/app/(tabs)/_layout.tsx` (104 lines). **Copy the exact tab-bar styling block** (the visual contract is locked to it — UI-SPEC Screen 4), but: 4 screens not 5, `headerShown: false` (header is parent Stack's), **remove `NewBoardFab`** (D / PRODUCT §11).

**Tab-bar style to copy verbatim** (`(tabs)/_layout.tsx:36-54`):
```tsx
<Tabs screenOptions={{
  tabBarActiveTintColor: '#2979FF',
  tabBarInactiveTintColor: '#9CA3AF',
  headerShown: false,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  tabBarItemStyle: { paddingTop: 6 },
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F1F3F5',
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
}}>
```
**Tab-screen + FontAwesome6 icon idiom** (`(tabs)/_layout.tsx:56-65`) — 4 screens per UI-SPEC Screen 4 table: `map` (`map-location-dot`), `plan` (`route`), `book` (`bed`/`ticket`), `ledger` (`receipt`):
```tsx
<Tabs.Screen name="map" options={{ title: '지도',
  tabBarIcon: ({ color, size }) => <FontAwesome6 name="map-location-dot" solid color={color} size={size} /> }} />
```
⚠️ **Anti-pattern (Pitfall 1):** never nest `(tabs)` inside `(tabs)`; header stays in parent Stack. **Delete** the `NewBoardFab` component (`(tabs)/_layout.tsx:8-31`) and its `Tabs.Screen name="new"` entry (`76-81`).

---

### `apps/ios/app/trip/[id]/(tabs)/map.tsx` (component/screen, CRUD — port content)

**Analog:** `apps/ios/app/boards/[id].tsx` (the full board detail / map screen). Port the MapView + place-list + pin-sheet content under the trip tab. **Switch the param hook**: `useLocalSearchParams` for in-screen id (`boards/[id].tsx:33`) is correct here (screen-level, not layout). Rename `getBoard`/`listLinksByBoard`/`listPlacesByBoard`/`addLink` calls to trip vocab (`boards/[id].tsx:1-9, 49-63`). Reuse `MapView, Marker, PROVIDER_GOOGLE` (`boards/[id].tsx:14`). Empty state copy = UI-SPEC Screen 6 map strings.

---

### `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (component/screen — empty state, NEW)

**Analog:** `apps/ios/app/(tabs)/boards.tsx` `ListEmptyComponent` (lines 217-232). This is the exact empty-state block to mirror (brand-50 circle + Ionicons + heading 20/600 + body + brand-500 action line):
```tsx
// boards.tsx:218-231 — copy block, swap copy to UI-SPEC Screen 6 plan strings
<View className="flex-1 items-center justify-center px-8 pt-16">
  <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
    <Ionicons name="map-outline" size={36} color="#2979FF" />
  </View>
  <Text className="text-xl font-bold text-neutral-900">아직 플랜이 없어요</Text>
  <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
    유튜브 링크를 추출하면 영상 속 장소로 플랜이 자동으로 생겨요.
  </Text>
</View>
```
Default landing tab (Claude's Discretion lock). Phase 18 fills the content.

---

### `apps/ios/app/trip/[id]/(tabs)/{book,ledger}.tsx` (component/screen — stubs, NEW)

**Analog:** presentational pattern of `apps/ios/components/boards/onboard-card.tsx` (simple centered View+Text, no data). **Neutral only — NO brand accent** (UI-SPEC color contract D-11): `neutral.300` glyph + `neutral.500` text. Copy = UI-SPEC Screen 6 book/ledger stub strings ("예약은 곧 제공돼요" / "가계부는 곧 제공돼요").

---

### `apps/ios/app/onboarding.tsx` (component/screen — branch, NEW)

**Analog:** `apps/ios/app/welcome.tsx` (tone/full-bleed intro + display headline, lines 80-149) for the warm intro + `apps/ios/app/boards/new.tsx` field-card pattern (`new.tsx:121-141`) for the two stacked path cards. Per UI-SPEC Screen 2:
- **정해짐 card** — `bg-white rounded-2xl cardShadow`, brand-50 icon tile, chevron, enabled → `router.push('/trip/create')`.
- **미정 card** — muted `neutral.100` fill, `neutral.400` text, `곧 제공` neutral badge, `disabled` Pressable no-op (D-11).

**Card shadow constant to copy** (`new.tsx:26-31`):
```typescript
const cardShadow = { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 };
```

---

### `apps/ios/app/trip/create.tsx` (component/screen, CRUD — port from boards/new.tsx)

**Analog:** `apps/ios/app/boards/new.tsx` (entire file, 293 lines) — the **exact** trip-creation form contract (UI-SPEC Screen 3 says "Reuse `boards/new.tsx` structure"). Port wholesale, with these deltas:
- `createBoard`→`createTrip`, `BoardCreate`→`TripCreate` validation.
- **Date field tag flips 선택→필수** (`new.tsx:157` `<FieldTag />` → `<FieldTag required />`); `canSave` now requires city **AND** dates (`new.tsx:64` — add date check).
- Add `만든 사람이 대표(결제자)예요` caption (D-10 — no input field).
- On success → `router.replace(\`/trip/${trip.id}/plan\`)` (replaces `new.tsx:93/96`).

**Field-card + FieldTag + picker idiom to copy** (`new.tsx:35-45` FieldTag, `120-166` city/date cards, `268-289` CityPicker/DatePickerSheet wiring). The pickers `CityPicker` and `DatePickerSheet` are reused unchanged from `apps/ios/components/boards/`.
**Error pattern** (`new.tsx:97-100`): `Alert.alert('여행 만들기 실패', err instanceof Error ? err.message : String(err))`, button re-enables.

---

### `apps/ios/app/share-handler.tsx` (route, event-driven — repoint to trip)

**Analog:** self (110 lines). ⚠️ **Pitfall 2: must be fixed in the same plan as index.tsx + native-intent.** Three surgical changes inside `addAndNavigate` (`share-handler.tsx:30-38`):
```typescript
// CURRENT (share-handler.tsx:30-38):
export async function addAndNavigate(boardId: string, url: string): Promise<void> {
  const link = await addLink(supabase, { board_id: boardId, url });
  SharedDefaults.set(SharedDefaultsKeys.LastBoardId, boardId);
  ...
  router.replace(`/boards/${boardId}`);     // ← CHANGE to `/trip/${tripId}/plan`
}
```
- `listMyBoards`→`listMyTrips`, `board_id`→`trip_id` (`share-handler.tsx:14, 59`).
- `router.replace(\`/boards/${boardId}\`)` → `router.replace(\`/trip/${tripId}/plan\`)` (line 37).
- `decideShareRoute`/`BoardPickerSheet` (`share-handler.tsx:21-22`) → trip-vocab equivalents.
- `SharedDefaultsKeys.LastBoardId` (line 32) — keep or swap to `TripKeys.LastTripId` (planner decides; data is wiped by squash anyway — RESEARCH 310).

### `apps/ios/app/+native-intent.tsx` (route, event-driven — verify ~no change)

**Analog:** self (21 lines). It only redirects to `/share-handler` (`+native-intent.tsx:13`) — **no board id**, so likely **no change needed**. Verify in the same plan (Pitfall 2). Do not add Supabase/async here (RESEARCH 257; the file's own header warns).

---

### `apps/web/app/t/[slug]/**` (route/component, request-response — move from b/[slug])

**Analog:** `apps/web/app/b/[slug]/` tree (move ALL: `page.tsx`, `error.tsx`, `not-found.tsx`, `opengraph-image.tsx`, `_components/{map-section,public-board-map,vote-island}.tsx`). Per D-14 / RESEARCH Pattern 4.

**`page.tsx` SSR idiom to preserve** (`b/[slug]/page.tsx:25-60` generateMetadata, `62-65` data fetch):
```typescript
const { slug } = await params;
const view = await getCachedPublicBoard(slug);   // → rename cache fn to trip
if (!view) notFound();
```
**Two renames inside the moved files:**
- Internal `/b/${slug}` literals (`page.tsx:35, 53`) → `/t/${slug}`.
- `getCachedPublicBoard` / `public_board_view` RPC → trip equivalents (squash renames the RPC to `public_trip_view`).
- `/api/revalidate?slug=` webhook path is called by the EF — verify it still resolves (RESEARCH 258, 312). `apps/web/app/boards/[id]` (dev tool) is **separate** — planner decides (RESEARCH 466).

---

## Shared Patterns

### 1. RLS SECURITY DEFINER Helper (CRITICAL — replicate verbatim in squash)

**Source:** `supabase/migrations/0002_fix_rls_recursion.sql:18-48` (the canonical bodies) + `0001_init.sql:263-324` (the `can_*` family).
**Apply to:** every cross-table RLS check in `0016_trips_baseline.sql`. **Never use direct `exists(select ... from <other table>)` in a policy** — that resurrects the 42P17 recursion bug 0002 fixed (Pitfall 3, CLAUDE.md §4.4).

**Exact helper idiom to copy** (`0002:18-29`):
```sql
create or replace function am_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public          -- ← mandatory (no schema shadowing)
as $$
  select exists(
    select 1 from trips
    where id = p_trip_id and owner_id = auth.uid()
  );
$$;
grant execute on function am_trip_owner(uuid) to authenticated;
```

**Policy that consumes the helper** (`0002:54-60`) — note: policy body calls the helper, never EXISTS directly:
```sql
create policy "trips: shared members can read"
  on trips for select
  to authenticated
  using ( visibility in ('shared','public') and am_trip_member(id) );
```

**Bearer-invite write helper** (`0009:40-69`) — `join_shared_trip` grants a NEW right so it runs DEFINER with hard-coded `'voter'` role + `user_id = auth.uid()` + `on conflict do nothing`. Phase 19 reuses this — **must survive squash** (RESEARCH 292).
**Anon-grant view** (`0013:17-84`) — `public_trip_view` is DEFINER + `grant ... to authenticated, anon`. Use the **0013 body** (has google_place_id/address), not 0001's older one.

### 2. Existing Board Zod Shape (CRITICAL — Trip rename baseline)

**Source:** `packages/core/src/schemas/board.ts:4-21` (already trip-shaped — see full excerpt under trip.ts above).
**Apply to:** `trip.ts`. The shape needs only `representative_id` added + vocab rename + `TripId` type + dates-required on create. **Do not redesign the data model** (CONTEXT §code_context: "데이터 모델 신규 설계 불필요").

### 3. Pure-function + Vitest test style

**Source:** `packages/core/src/category.test.ts:1-79` + `category.ts` (pure-fn export style).
**Apply to:** `booking.ts`/`booking.test.ts`, `trip.test.ts`, `entry-route.ts`/`.test.ts`. Table-driven `for...of` + `describe`/`it`/`expect` from `'vitest'`. ⚠️ Wave 0 must wire `core` `package.json` `test` → `vitest run` first.

### 4. iOS error handling (Alert + re-enable)

**Source:** `apps/ios/app/boards/new.tsx:97-100` and `(tabs)/boards.tsx:156-170` (destructive delete Alert).
**Apply to:** `trip/create.tsx` (create error), `TripHeader` switcher delete (여행 삭제 Alert — UI-SPEC line 133):
```typescript
Alert.alert('여행 삭제', `"${trip.title}"을(를) 삭제할까요?`, [
  { text: '취소', style: 'cancel' },
  { text: '삭제', style: 'destructive', onPress: async () => { await deleteTrip(...); } },
]);
```

### 5. AsyncStorage `*Keys` namespace

**Source:** `packages/core/src/constants.ts:186-191` (`OnboardKeys`) + `121-130` (`SharedDefaultsKeys`).
**Apply to:** new `TripKeys.LastTripId` (NAV-01 N-case persistence, RESEARCH Pattern 5 — AsyncStorage chosen over a profiles column).

### 6. Card shadow + field-card chrome (visual contract)

**Source:** `apps/ios/app/boards/new.tsx:26-31` (`cardShadow`) + `(tabs)/boards.tsx:23-29` (`CARD_SHADOW`).
**Apply to:** all new field cards / path cards / stubs (onboarding, trip/create). UI-SPEC locks every visual value to these — add zero new tokens.

---

## No Analog Found

| File | Role | Data Flow | Reason / Source to use instead |
|------|------|-----------|--------------------------------|
| `packages/core/src/booking.ts` | utility | transform | No affiliate-URL code exists yet. Use RESEARCH §Code Examples (lines 346-388) + provider docs; copy pure-fn/zod *style* from `category.ts`. |
| `apps/ios/app/onboarding.tsx` (branch cards) | component/screen | — | No "decision branch" screen exists. Compose `welcome.tsx` tone + `boards/new.tsx` field-card style. Partial analog only. |

(The `book`/`ledger` stubs and `TripHeader` are partial-match — built from presentational primitives, not a 1:1 analog.)

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `packages/core/src/{schemas,}`, `packages/api/src/queries/`, `apps/ios/app/`, `apps/ios/components/boards/`, `apps/web/app/{b,boards}/`
**Files scanned (read in full or targeted):** 0001/0002/0009/0013 migrations · board.ts · constants.ts · category.test.ts · boards.ts (api) · index.tsx · (tabs)/_layout.tsx · share-handler.tsx · +native-intent.tsx · boards/new.tsx · boards/_layout.tsx · boards/[id].tsx · (tabs)/boards.tsx · welcome.tsx · onboard-card.tsx · web b/[slug]/page.tsx + tree listings
**Pattern extraction date:** 2026-06-21
