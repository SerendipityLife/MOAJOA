# Phase 18: Auto Plan (사용자 트리거 AI 플랜) - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13 (every new file has a same-role, ≥role-match analog in the shipped codebase)

> Phase 18 is ~80% recombination of `extract-youtube` primitives + 0016 RLS helpers + two new external surfaces (Google Routes, a second Claude prompt). Almost every file is a near-clone of a shipped analog. Concrete copy-from excerpts below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/functions/generate-plan/index.ts` | EF handler | request-response + event-driven (broadcast) | `supabase/functions/extract-youtube/index.ts` | exact |
| `supabase/functions/generate-plan/pipeline/claude.ts` | service (LLM client) | transform | `supabase/functions/extract-youtube/pipeline/claude.ts` | exact |
| `supabase/functions/generate-plan/pipeline/claude.test.ts` | test (Deno) | — | `supabase/functions/extract-youtube/pipeline/claude.test.ts` | exact |
| `supabase/functions/generate-plan/pipeline/routes.ts` | service (HTTP client) | request-response | `supabase/functions/extract-youtube/pipeline/places.ts` | role-match (Google v1 fetch+FieldMask) |
| `supabase/functions/generate-plan/pipeline/routes.test.ts` | test (Deno) | — | `extract-youtube/pipeline/maplinks.test.ts` (mocked fetch) + `claude.test.ts` | role-match |
| `supabase/functions/generate-plan/deno.json` | config | — | `supabase/functions/extract-youtube/deno.json` | exact |
| `supabase/migrations/0017_plans.sql` | migration | CRUD + RLS | `supabase/migrations/0016_trips_baseline.sql` (places/votes tables + DEFINER helpers + extraction_costs CHECK) | exact |
| `packages/core/src/schemas/plan.ts` | model (Zod) | — | `packages/core/src/schemas/trip.ts` + `place.ts` (`ResolvePlaceRequestSchema`) | exact |
| `packages/core/src/schemas/plan.test.ts` | test (vitest) | — | `packages/core/src/booking.test.ts` / `trip.test.ts` | exact |
| `packages/core/src/constants.ts` (MODIFY) | config | — | self — `extractChannelName` + `EXTRACT_CHANNEL_PREFIX` + `EXTRACT_STEP_KO` block | exact (in-file) |
| `packages/api/src/queries/plans.ts` | service (typed queries + invoke) | CRUD + request-response | `packages/api/src/queries/places.ts` + `links.ts` (`triggerExtraction` invoke) + `trips.ts` | exact |
| `packages/api/src/queries/plans.test.ts` | test (vitest) | — | (api package — see Wave 0; mirror core booking.test.ts shape with mocked client) | role-match |
| `apps/ios/lib/realtime.ts` (MODIFY) | utility (realtime sub) | event-driven | self — `subscribeExtractProgress` | exact (in-file) |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (MODIFY — fill stub) | screen/component | event-driven + CRUD | `apps/ios/app/trip/[id]/(tabs)/map.tsx` (screen idiom + broadcast refresh) | exact |
| `apps/ios/components/plan/*` (NEW: day-section, plan-item-row, unplaced-pool, travel-mode-toggle) | component | presentation | `components/boards/place-list.tsx`, `step-indicator.tsx`, `pin-sheet.tsx` | exact |
| `packages/core/src/schemas/index.ts` (MODIFY barrel) | config | — | self — `export * from './plan'` | exact (in-file) |
| `packages/api/src/queries/index.ts` (MODIFY barrel) | config | — | self — `export * from './plans'` | exact (in-file) |

---

## Pattern Assignments

### `supabase/functions/generate-plan/index.ts` (EF handler, request-response + broadcast)

**Analog:** `supabase/functions/extract-youtube/index.ts` — clone the handler skeleton wholesale, swap pipeline + write target.

**Deno header + imports** (extract-youtube/index.ts L18-31): same `jsr:`/`npm:` import style; Deno cannot import `@moajoa/core`, so re-declare the request Zod schema locally (see `RequestSchema` L33-35).
```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
```

**Service-role admin client + caller auth gate** (L57-79) — copy VERBATIM, it is the cost-abuse gate (Security V2). Anon key passes verify_jwt but fails `auth.getUser`:
```ts
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'unauthorized');
const callerToken = authHeader.slice('Bearer '.length);
const { data: caller, error: callerErr } = await admin.auth.getUser(callerToken);
if (callerErr || !caller?.user) return jsonError(401, 'unauthorized');
```
> **Phase-18 addition:** after the getUser gate, verify the caller can edit the trip. extract-youtube relied on link ownership; here verify `can_edit_trip` (RLS helper, 0016) — e.g. a service-role `select 1 from trips ... ` membership check, or an RPC, before spending on Claude/Routes (Security V4).

**Request body parse** (L81-91) — same `req.json()` try/catch + `RequestSchema.safeParse`. Phase-18 body = `{ trip_id, travel_mode, anchor_place_ids, removed_place_ids }` (RESEARCH GeneratePlanRequest).

**Claim guard against double-spend** (L108-141) — extract-youtube uses an atomic conditional UPDATE on `links.extraction_status`. RESEARCH Pitfall 5 + Open Q4 recommend the **simpler** path for plans: client disable + EF idempotent overwrite of the single draft plan per trip (`unique(trip_id) where status='draft'`). If a server claim is wanted, mirror the conditional-UPDATE shape on `plans.status='generating'`.

**Broadcast progress** — the `broadcastStep` helper (L482-500) copied with the channel key changed from `'extract:' + linkId` to `'plan:' + tripId`:
```ts
async function broadcastStep(admin: AdminClient, tripId: string, step: string, progressPct: number, detail?) {
  try {
    const channel = admin.channel('plan:' + tripId);   // ← was 'extract:' + linkId
    await channel.send({ type: 'broadcast', event: 'progress', payload: { step, progress_pct: progressPct, ...(detail ?? {}) } });
    admin.removeChannel(channel);
  } catch (err) { console.warn('[broadcast] failed:', err); }
}
```
> Use the shared builder from core instead of a string literal — add `planChannelName(tripId)` to constants (Shared Patterns below) so client + EF can't drift. Plan steps per UI-SPEC State C: `loading(10) → clustering(50) → routing(80) → done(100)` (+ `error` terminal).

**Cost logging** — `logCost` helper (L502-527) + the call site (L229-238) copied as-is. Anthropic cost formula at L230 (`(in*3 + out*15)/1e6`). Routes legs log under provider `'google_routes'` (see migration note) at `0.005` each:
```ts
const anthropicCost = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
await logCost(admin, tripId /* link_id null for routes */, { provider: 'anthropic', model: usage.model, input_tokens, output_tokens, cost_usd: anthropicCost, duration_ms });
```
> ⚠ `logCost` inserts `link_id: linkId` (L516). Plans have no link — `extraction_costs.link_id` is nullable since 0005, so pass `null`. Generalize the helper param name or insert `{ link_id: null, ... }` directly.

**Orchestration body + try/catch** (L155-471) — same try/catch shape with `broadcastStep('error', 0, { error })` in the catch (L452). Phase-18 body: load placeable places → Claude cluster → Routes post-process adjacent legs → upsert `plans` + insert `plan_items` → broadcast `done`. Drop the YouTube/blog source-router, the maplinks, the Places resolution, and the revalidate webhook.

**CORS + json helpers** (L530-550) — copy `corsHeaders` / `jsonError` / `jsonOk` verbatim.

**Placeable-place filter (D-09 / Pitfall 4):** mirror `listPlacesByTrip`'s `hidden_at IS NULL` plus exclude `(0,0)`:
```ts
.from('places').select('*').eq('trip_id', tripId).is('hidden_at', null)
// then in EF: places with lat===0 && lng===0 → straight to unplaced pool, never to Claude as placeable / never to Routes
```

---

### `supabase/functions/generate-plan/pipeline/claude.ts` (LLM service, transform)

**Analog:** `extract-youtube/pipeline/claude.ts` — copy the entire Anthropic fetch client; swap only the schema + prompt.

**Anthropic fetch client** (claude.ts L51-109) — copy `extractCandidatesFromContext` structure verbatim into `callClaudePlan`. Reuse: the same endpoint/headers (L56-73), the `stop_reason === 'max_tokens'` guard (L88-90), `extractJsonBlock` fence-stripping (L173-182), `temperature: 0`, the usage fallback to 0 (L83-84):
```ts
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': inputs.anthropicKey, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: EXTRACTION_MODEL, max_tokens: 4096, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }] }),
});
```
> Phase-18 `max_tokens: 4096` (output is just id+index mapping, far smaller than extraction's place objects — RESEARCH Pattern 3). Model constant `claude-sonnet-4-6` (L9) unchanged.

**Output schema** (claude.ts L11-29 `PlaceCandidate`/`LLMOutput`) — mirror the `z.object(...).parse(parsed)` pattern with the Phase-18 `PlanLLMOutput` (RESEARCH Pattern 3):
```ts
const PlanLLMOutput = z.object({
  reasoning: z.string().optional(),
  days: z.array(z.object({ day_index: z.number().int().min(0),
    items: z.array(z.object({ place_id: z.string().uuid(), sort_order: z.number().int().min(0) })) })),
  unplaced: z.array(z.string().uuid()),
});
```

**Prompt builder** (claude.ts L118-171 `buildPrompt`) — export `buildPlanPrompt` the same way (so the test can snapshot it). Keep the `# Task / # Output schema / # Constraints / # Context` section structure. Inputs: trip N-day count, place list (id, name_ko/local, lat, lng, category, summary_ko), soft cap 4–5/day, geo-cluster-first + light category-mix rules (D-03/D-04/D-06), anchor ids (D-10), removed ids (D-11). `SYSTEM_PROMPT` analog at L111.

**Defensive id-validation** — extraction's citation post-filter (`index.ts` L240-248 discards candidates without `source_quote`). The Phase-18 analog (Pitfall 6): intersect Claude's returned `place_id`s with the input set, reject unknowns (FK-safety), auto-append any input place missing from both `days` and `unplaced` into the pool — never drop a user's place.

---

### `supabase/functions/generate-plan/pipeline/claude.test.ts` (Deno test)

**Analog:** `extract-youtube/pipeline/claude.test.ts` — exact structural copy.

**Imports + assertions** (L1-2): `jsr:@std/assert` (`assertEquals`, `assertStringIncludes`, `assertThrows`).
**Prompt snapshot test** (L5-58): fixed-input fixture + a frozen expected string + `assertEquals(buildPlanPrompt(FIXTURE), EXPECTED)` — the regression-0 idiom. Mirror for `buildPlanPrompt` (assert anchor ids and N-day count appear).
**Schema parse tests** (L77-129): `PlanLLMOutput.parse({...})` accepts/rejects cases — accept valid days+unplaced, reject hallucinated/non-uuid id, reject non-array days. Mirror the `assertThrows` pattern (L101-107, L123-129).

---

### `supabase/functions/generate-plan/pipeline/routes.ts` (HTTP service, request-response)

**Analog:** `extract-youtube/pipeline/places.ts` — same Google-v1 `fetch` + `X-Goog-Api-Key` + `X-Goog-FieldMask` + `duration_ms` timing shape.

**Interface + timing + key header** (places.ts L6-32, L44-67):
```ts
const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': inputs.apiKey, 'X-Goog-FieldMask': 'routes.duration' },
  body: JSON.stringify(body),
});
if (!res.ok) { /* best-effort: return null → "이동시간 —" */ }
```
> **FieldMask = `routes.duration` ONLY** (Pitfall 1 — richer fields bump Essentials→Pro). RESEARCH A2 hedges with `routes.duration,routes.legs.duration` to be safe on the field path. TRANSIT default + `transitPreferences: { routingPreference: 'LESS_WALKING' }`; DRIVE uses `routingPreference: 'TRAFFIC_UNAWARE'` to STAY in Essentials (RESEARCH Pattern 2). Parse `"840s"` → `parseInt(...replace('s',''))`.

**City-center helper available:** `pipeline/cities.ts` (`cityCenter`, `LatLng`) already exists if a fallback center is ever needed — not required for adjacent legs (Claude returns real place coords).

**Env key:** `GOOGLE_PLACES_SERVER_KEY` (same secret extract-youtube reads at `index.ts` L335). RESEARCH Env note: Routes API must be **enabled** on the GCP project (separate from Places) — verify in plan-phase.

---

### `supabase/functions/generate-plan/pipeline/routes.test.ts` (Deno test, mocked fetch)

**Analog:** `extract-youtube/pipeline/maplinks.test.ts` (mocked `fetch`) + `claude.test.ts` assertion idiom.
Assert: FieldMask is exactly `routes.duration` (cost guard), `"840s"` → `840`, `!res.ok` → `null`, `(0,0)` endpoint skipped before fetch. Stub `globalThis.fetch`.

---

### `supabase/functions/generate-plan/deno.json` (config)

**Analog:** `extract-youtube/deno.json` — copy verbatim:
```json
{ "imports": { "supabase-js": "jsr:@supabase/supabase-js@2", "zod": "npm:zod@3" },
  "tasks": { "test": "deno test --allow-net --allow-env --allow-read pipeline/*.test.ts" } }
```

---

### `supabase/migrations/0017_plans.sql` (migration, CRUD + RLS)

**Analog:** `0016_trips_baseline.sql` — copy the table+index+trigger+RLS-policy idiom from the `places` block (L426-494) and the `votes` block (L499-556). Append-only — **never touch 0016** (CLAUDE.md §4.3).

**`plans` table** — model on `places` table shape (L426-452): `trip_id uuid not null references trips(id) on delete cascade`, `status text not null default 'draft' check (status in ('generating','draft',...))`, `travel_mode text not null default 'transit' check (travel_mode in ('transit','walk','drive'))` (D-08), `collaborative boolean not null default false` (D-14), `created_at`/`updated_at`. One-draft-per-trip (Open Q4): `unique (trip_id) where status='draft'` partial unique index (mirror `places_trip_idx` partial-index idiom L454). Add the `set_updated_at` trigger (used by `trips` L138-140).

**`plan_items` table** — model on `places`/`votes`: `plan_id uuid not null references plans(id) on delete cascade`, `place_id uuid not null references places(id) on delete cascade`, `day_index int not null check (day_index >= 0)`, `sort_order int not null check (sort_order >= 0)`, `leg_travel_seconds int`, `is_anchor boolean not null default false` (D-10). Indexes mirror `votes_place_idx`/`places_link_idx` (L455, L509).

**RLS via DEFINER helpers — REUSE, do not write new EXISTS** (CLAUDE.md §4.4, RESEARCH anti-pattern):
```sql
alter table plans enable row level security;
create policy "plans: read if can read trip"  on plans for select to authenticated using (can_read_trip(trip_id));
create policy "plans: insert if can edit trip" on plans for insert to authenticated with check (can_edit_trip(trip_id));
create policy "plans: update if can edit trip" on plans for update to authenticated using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));
```
> `can_read_trip`/`can_edit_trip`/`am_trip_owner` are the shipped 0016 helpers (defined L291-336). `plan_items` policies route through the **parent plan's** trip_id — use a DEFINER helper or a single `exists (select 1 from plans where plans.id = plan_items.plan_id and can_edit_trip(plans.trip_id))` (this is the votes→places idiom at L529-545, which is the one permitted EXISTS shape because the inner `can_*_trip` call is itself the DEFINER boundary).

**extraction_costs CHECK extension (additive, D-12 / RESEARCH Code-Examples note):** 0016 defines the constraint at L564: `provider text not null check (provider in ('anthropic', 'google_places'))`. Add `'google_routes'`:
```sql
alter table extraction_costs drop constraint extraction_costs_provider_check,
  add constraint extraction_costs_provider_check check (provider in ('anthropic','google_places','google_routes'));
```

**Post-migration:** `pnpm supabase:types` to regen `packages/api/src/types/database.ts` (CLAUDE.md §4.3) — adds `plans`/`plan_items` Row/Insert/Update types that `plans.ts` queries depend on.

---

### `packages/core/src/schemas/plan.ts` (Zod model)

**Analog:** `schemas/trip.ts` (table + Create/Update split) + `schemas/place.ts` `ResolvePlaceRequestSchema` (EF request contract with `.default`).

**Table schemas** — mirror `TripSchema` (trip.ts L4-23): `PlanSchema` (id, trip_id, status, travel_mode, collaborative, timestamps) + `PlanItemSchema` (id, plan_id, place_id, day_index, sort_order, leg_travel_seconds nullable, is_anchor). Use `z.enum(...)` for travel_mode pulling from a new `constants.ts` `TravelMode` const (mirror `TripVisibility` constant→`z.enum(TripVisibility)` at trip.ts L11).

**EF request schema** — mirror place.ts `ResolvePlaceRequestSchema` (L110-119) `.default()` usage (RESEARCH Code Examples):
```ts
export const GeneratePlanRequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(['transit','walk','drive']).default('transit'),
  anchor_place_ids: z.array(z.string().uuid()).default([]),
  removed_place_ids: z.array(z.string().uuid()).default([]),
});
```

**Barrel:** add `export * from './plan'` to `schemas/index.ts` (currently L1-7). Re-export reaches consumers via `@moajoa/core` (core/src/index.ts L1).

---

### `packages/core/src/schemas/plan.test.ts` (vitest)

**Analog:** `booking.test.ts` (L1-40) — `import { describe, it, expect } from 'vitest'`, uuid fixtures (`'11111111-1111-4111-8111-111111111111'`), `.parse(...)` accept + `expect(() => Schema.parse(...)).toThrow()` reject cases. Cover: `GeneratePlanRequestSchema` defaults (transit, empty anchor arrays), reject bad travel_mode, reject non-uuid trip_id.

---

### `packages/core/src/constants.ts` (MODIFY)

**Analog:** the existing extraction-channel block in the same file (L85-138). Add the plan-scoped parallels:
```ts
export const PLAN_CHANNEL_PREFIX = 'plan:';
export function planChannelName(tripId: string): string { return `plan:${tripId}`; }   // mirror extractChannelName L136-138
export const PlanStep = ['loading','clustering','routing','done','error'] as const;     // mirror ExtractionStep L102
export const PLAN_STEP_KO = { loading:'장소 불러오기', clustering:'동선 짜기', routing:'이동시간 계산' } as const; // mirror EXTRACT_STEP_KO L166-171
export const TravelMode = ['transit','walk','drive'] as const;                          // mirror TripVisibility L55
```
> ⚠ Surgical: append new exports; do not edit the extraction block (CLAUDE.md §3.3).

---

### `packages/api/src/queries/plans.ts` (typed queries + invoke)

**Analog:** `queries/places.ts` (CRUD), `queries/links.ts` `triggerExtraction` (invoke), `queries/trips.ts` `shareTrip` (read-then-update + visibility flip — reuse for collaborative+share).

**Module shape** (places.ts L1-2): `import type { ... } from '@moajoa/core'; import type { MoajoaSupabaseClient } from '../client';` — every fn takes `client` first.

**Read** — `getPlanByTrip` mirrors `listPlacesByTrip` (places.ts L4-16): `.from('plans').select('*, plan_items(*)').eq('trip_id', tripId)...`.

**Invoke EF** — `generatePlan` mirrors `triggerExtraction` (links.ts L61-70) EXACTLY:
```ts
export async function generatePlan(client, body: GeneratePlanRequest) {
  const { data, error } = await client.functions.invoke('generate-plan', { body });
  if (error) throw error;
  return data as GeneratePlanResult;
}
```

**Mutations** — `reorderPlanItem` / `setTravelMode` mirror `places.ts` `renamePlace` (L77-94) `.update(...).eq('id',...).select('*').single()` shape; RLS via `can_edit_trip` (no extra client-side check — RLS denies non-members, per the `renamePlace` doc-comment).

**Collaborative + share** — `setCollaborative` mirrors `trips.ts` `shareTrip` (L130-153): flip `plans.collaborative = true`, then call existing `shareTrip(client, tripId)` to surface the share slug (D-14 — flag + share only, no new vote query; the votes infra `queries/votes.ts` is reused as-is by Phase 19).

**Barrel:** add `export * from './plans'` to `queries/index.ts` (currently L1-5).

---

### `apps/ios/lib/realtime.ts` (MODIFY)

**Analog:** the existing `subscribeExtractProgress` in the same file (L24-35) — add a sibling:
```ts
import { extractChannelName, planChannelName } from '@moajoa/core';
export interface PlanProgress { step: 'loading'|'clustering'|'routing'|'done'|'error'; progress_pct?: number; error?: string; }
export function subscribePlanProgress(tripId: string, onProgress: (p: PlanProgress) => void): RealtimeChannel {
  return supabase.channel(planChannelName(tripId))
    .on('broadcast', { event: 'progress' }, (msg) => onProgress(msg.payload as PlanProgress))
    .subscribe();
}
```
> Same cleanup contract (caller `supabase.removeChannel(ch)` in `useEffect` return — leak guard, L19-23 doc-comment). Test in `apps/ios/__tests__/realtime.test.ts` (mirror existing L53-70: assert `channel name === 'plan:{trip_id}'` + payload pass-through + returned channel identity).

---

### `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (MODIFY — fill the stub)

**Analog:** `apps/ios/app/trip/[id]/(tabs)/map.tsx` — the sibling tab is the screen-idiom template (data load, broadcast-driven refresh, SafeAreaView, empty-state). Current `plan.tsx` (L1-28) is the empty-state stub to KEEP for State A.

**Screen skeleton + data load** (map.tsx L40-89): `useLocalSearchParams<{ id }>`, `useState` for trip/places/plan, a `load` `useCallback` calling `@moajoa/api` queries inside `Promise.all`, `useEffect(load)`. Reuse `getTrip`/`listPlacesByTrip` (already imported there) + new `getPlanByTrip`.

**Realtime progress wiring** — mirror the broadcast-refresh effect (map.tsx L85-89, but plan uses the channel directly): subscribe `subscribePlanProgress(id, ...)` in a `useEffect`, drive State C steps, on `done` refetch the plan, on `error` → State F. Clean up via `supabase.removeChannel`.

**CTA button** — copy the filled brand-500 button from map.tsx L172-178 / L255-268 (`bg-brand-500 ... rounded-lg`/`rounded-xl`, `disabled:opacity-50`, white `font-semibold` label). On tap → disable + spinner (`플랜을 짜고 있어요…`, Pitfall 5) → `generatePlan(...)`.

**Progress card (State C)** — reuse `components/boards/step-indicator.tsx` idiom (white `rounded-3xl` card, `ActivityIndicator color="#2979FF"`, brand/neutral/outline dots). The step labels come from `PLAN_STEP_KO`. (UI-SPEC State C maps EF broadcast → 장소 불러오기/동선 짜기/이동시간 계산/완료.)

**Confirm modal (regenerate, D-11)** — mirror the destructive-confirm idiom (UI-SPEC: `header.tsx` `Alert.alert` or centered modal `bg-black/30` scrim + `bg-white rounded-t-3xl`). Body copy locked in UI-SPEC Copywriting.

**Empty states** — State A keeps the current stub verbatim (plan.tsx L11-27); State B is the same idiom with `장소가 모였어요` + the CTA.

---

### `apps/ios/components/plan/*` (NEW components)

**Analog:** `components/boards/place-list.tsx` for rows, `step-indicator.tsx` for progress, `pin-sheet.tsx` for sheets.

**`plan-item-row` / `day-section` / `unplaced-pool`** — reuse the place-card from `place-list.tsx` (L63-90): `ROW_SHADOW` const (L16-22), `bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center`, vibe-tinted `w-10 h-10 rounded-xl` leading icon via `vibeOf`/`VIBE_STYLE` from `@/lib/category` (L13, L61), `text-sm font-semibold` title + `text-xs text-neutral-500` subtitle (L76-81), brand-50 stadium chip trailing (L84-87). Add per UI-SPEC State D: a `reorder-three` drag handle, a 필수 star, a 제거 glyph (placed rows) or `add-circle-outline` 일정에 추가 (pool rows). The leg pill between rows reuses the brand-50 chip shape (L84-87) with `{n}분` / `이동시간 —`.

**`travel-mode-toggle`** — a 3-segment control (전철/도보/차), active segment brand-500 (UI-SPEC Color #4). No direct analog component; build from `Pressable` + NativeWind, or reuse `pin-sheet.tsx` `@gorhom/bottom-sheet` idiom if presented as a sheet (Pitfall 3: visible content in an inner `<View className>` because NativeWind on `BottomSheetView` can no-op — pin-sheet.tsx L4-8).

**Drag library** — RESEARCH Open Q1: `react-native-reanimated-dnd@2.0.0` (Reanimated-4-native) OR hand-roll with installed `react-native-gesture-handler` + Reanimated 4. **Do NOT use `react-native-draggable-flatlist`** (Pitfall 3 — Reanimated 2/3, breaks at runtime). Sketch first. Placed↔pool is an explicit affordance, not cross-zone drag (D-13 / A4).

---

## Shared Patterns

### Realtime broadcast channel (trip-scoped)
**Source:** `supabase/functions/extract-youtube/index.ts` L482-500 (`broadcastStep`) + `packages/core/src/constants.ts` L136-138 (`extractChannelName`) + `apps/ios/lib/realtime.ts` L24-35 (`subscribeExtractProgress`).
**Apply to:** generate-plan EF (emit), constants (`planChannelName` builder), realtime.ts (`subscribePlanProgress`), plan.tsx (subscribe).
**Key change:** channel key `extract:{link_id}` → `plan:{trip_id}` (trip scope, CONTEXT D-02 / Claude's Discretion). Always go through the core builder so client+server can't drift.

### EF auth + cost-abuse gate
**Source:** `extract-youtube/index.ts` L57-79.
**Apply to:** generate-plan EF (verbatim) — plus a `can_edit_trip` membership check before spending (Security V4).
```ts
const { data: caller, error } = await admin.auth.getUser(callerToken);
if (error || !caller?.user) return jsonError(401, 'unauthorized');
```

### Cost logging
**Source:** `extract-youtube/index.ts` L502-527 (`logCost`) + L229-238 (Anthropic) + L356-360 (Google) + `extraction_costs` table 0016 L561-571.
**Apply to:** generate-plan EF — Anthropic per-call + each Routes leg (`provider:'google_routes'`, `0.005`, `link_id:null`). Add `'google_routes'` to the provider CHECK in 0017.

### RLS via SECURITY DEFINER helpers (no direct cross-table EXISTS)
**Source:** `0016_trips_baseline.sql` L291-336 (`can_read_trip`/`can_edit_trip`), L426-494 (places policy idiom), L529-545 (votes→places EXISTS-through-DEFINER idiom).
**Apply to:** `plans`/`plan_items` policies in 0017. plan_items routes through parent plan's trip_id via `can_edit_trip` (CLAUDE.md §4.4, RESEARCH anti-pattern — recursion guard).

### Zod request/output validation
**Source:** `extract-youtube/index.ts` L33-35,87-90 (request), `pipeline/claude.ts` L23-29,106 (LLM output), `schemas/place.ts` L110-119 (EF request with `.default`).
**Apply to:** `GeneratePlanRequestSchema` (EF body), `PlanLLMOutput` (Claude JSON), id-intersection check against the input place set (Pitfall 6).

### Typed query + EF invoke
**Source:** `queries/places.ts` (CRUD shape), `queries/links.ts` L61-70 (`functions.invoke`), `queries/trips.ts` L130-153 (`shareTrip` read-then-flip).
**Apply to:** `queries/plans.ts` — `getPlanByTrip`, `generatePlan` (invoke), `reorderPlanItem`/`setTravelMode` (update), `setCollaborative` (flip + reuse `shareTrip`).

### iOS card / progress / sheet idioms
**Source:** `components/boards/place-list.tsx` (card + ROW_SHADOW + vibe leading icon + brand-50 chip), `step-indicator.tsx` (progress card + dots), `pin-sheet.tsx` L4-8 (BottomSheetView NativeWind workaround).
**Apply to:** all `components/plan/*` + plan.tsx progress/skeleton/sheets.

---

## No Analog Found

None. Every Phase-18 file maps to a same-role shipped analog. Two surfaces are genuinely **new external integrations** (not new file roles) and carry the only MEDIUM-confidence risk:

| Surface | File | Why noted | Mitigation (from RESEARCH) |
|---------|------|-----------|----------------------------|
| Google Routes API `computeRoutes` | `pipeline/routes.ts` | New external API (Places EF is the closest fetch-shape analog, but Routes request body differs) | Pattern 2 request body + minimal FieldMask cited; verify Routes API **enabled** on GCP project + one live Tokyo two-point call (A1/A2) |
| Drag-reorder UI | `components/plan/*` + plan.tsx | No drag component exists in the codebase | `react-native-reanimated-dnd@2.0.0` OR hand-roll on installed gesture-handler+Reanimated 4; sketch first (Open Q1); NOT draggable-flatlist (Pitfall 3) |

---

## Metadata

**Analog search scope:** `supabase/functions/extract-youtube/**`, `supabase/migrations/0016_trips_baseline.sql`, `packages/core/src/{constants,schemas/*,booking.test}.ts`, `packages/api/src/queries/*`, `apps/ios/lib/realtime.ts`, `apps/ios/__tests__/realtime.test.ts`, `apps/ios/app/trip/[id]/(tabs)/{plan,map}.tsx`, `apps/ios/components/boards/{place-list,step-indicator,pin-sheet}.tsx`.
**Files scanned:** ~22 read in full or targeted; analog search stopped at strong matches per file (early-stop rule).
**Pattern extraction date:** 2026-06-22
