# Phase 18: Auto Plan (사용자 트리거 AI 플랜) - Research

**Researched:** 2026-06-22
**Domain:** Claude geo-clustering EF + Google Routes grounding + Expo drag-reorder UI + trip-scoped realtime + plans/plan_items schema
**Confidence:** HIGH (stack + schema + Routes), MEDIUM (Claude clustering prompt quality, drag-UI library choice)

## Summary

Phase 18 is an **AI system phase**: a user taps "플랜 만들기" in the plan tab, which explicitly calls a new `generate-plan` Edge Function. That EF loads all of the trip's placeable places, asks `claude-sonnet-4-6` to geo-cluster them into days + order + select an unplaced pool, post-processes **adjacent-only** legs through the Google **Routes API** (`computeRoutes`), writes `plans`/`plan_items` (new 0017 migration), and broadcasts progress on a **trip-scoped** realtime channel. The iOS plan tab renders a draft itinerary with drag-reorder + a placed↔unplaced move affordance and a per-plan transit/walk/drive toggle. 필수 장소 re-anchors via a Claude re-call; regenerate overwrites behind a confirm modal; collaborative is just a flag + share.

Almost every primitive this phase needs already exists in the codebase: the `broadcastStep` pattern (extend channel key from `extract:{link_id}` → `plan:{trip_id}`), the Anthropic `fetch` client shape in `pipeline/claude.ts` (copy wholesale, swap the prompt), the `extraction_costs` logging table (works for Routes + Anthropic), the trips RLS DEFINER helpers `can_edit_trip`/`am_trip_owner`/`can_read_trip` (reuse for `plans`/`plan_items`), and the client realtime subscribe idiom in `apps/ios/lib/realtime.ts`. The genuinely new external surface is the **Routes API** and the **drag-reorder library**.

**Primary recommendation:** Build `generate-plan` as a near-clone of `extract-youtube` (service-role admin client, caller `auth.getUser` gate, claim-style guard against double-spend, broadcast steps, cost logging). Routes cost is well within budget — a 5-place day costs **4 × $0.005 = $0.02/day**, and Essentials gives 10,000 free calls/month. **Do NOT use `react-native-draggable-flatlist`** — it targets Reanimated 2/3 and is unmaintained (last publish 2025-05); the project is on Reanimated 4.3.1 + New Architecture. Use `react-native-reanimated-dnd@2.0.0` (built for Reanimated 4, RN 0.83+, Expo SDK 55+) **or** hand-roll with the already-installed `react-native-gesture-handler` + Reanimated 4 (sketch first — see Open Question 1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan generation trigger (button) | iOS client | — | D-01/02: explicit user action, not auto. `supabase.functions.invoke('generate-plan')`. |
| Geo-clustering + day split + ordering + pool selection | Edge Function (Deno) → Claude | — | LLM reasoning over place set. Service-role only inside EF; ANTHROPIC_API_KEY never on client. |
| Adjacent travel-time grounding | Edge Function (Deno) → Routes API | — | GOOGLE_PLACES_SERVER_KEY-class secret; must stay server-side. Recompute-on-drag also server-side (RLS-safe write). |
| Plan persistence (plans/plan_items) | Database (Postgres + RLS) | API package | trip_id FK; RLS via existing DEFINER helpers. `@moajoa/api` typed queries. |
| Draft itinerary render + drag reorder + pool | iOS client | — | NativeWind + gesture-handler/Reanimated 4. Pure presentation + optimistic local reorder. |
| Progress (skeleton + %) | EF broadcasts → iOS subscribes | — | Reuse Supabase Realtime Broadcast, trip-scoped channel. |
| Travel-mode toggle | iOS client → EF recompute | Database | `plans.travel_mode` column; toggling re-runs Routes for that plan's legs. |
| Collaborative transition | iOS client → Database flag | — | D-14: `plans.collaborative` boolean + existing share infra. No new voting UI (Phase 19/votes). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anthropic Messages API (`fetch`) | `anthropic-version: 2023-06-01`, model `claude-sonnet-4-6` | Geo-cluster/day-split/order/pool select | `[VERIFIED: codebase pipeline/claude.ts]` already used for extraction; `[VERIFIED: anthropic.com]` 4-6 is current Sonnet, $3/$15 per MTok unchanged from 4-5 |
| Google Routes API `computeRoutes` (v2 REST) | `https://routes.googleapis.com/directions/v2:computeRoutes` | Adjacent leg travel time/distance | `[CITED: developers.google.com/maps/documentation/routes]` successor to deprecated Directions/Distance Matrix; supports TRANSIT/WALK/DRIVE |
| `@supabase/supabase-js@2` (Deno) | `jsr:@supabase/supabase-js@2` | Admin client + realtime broadcast inside EF | `[VERIFIED: codebase]` exact import used by extract-youtube |
| `react-native-reanimated-dnd` | `2.0.0` (2026-03-16) | Drag-reorder + sortable list in plan tab | `[VERIFIED: npm view]` peer `reanimated >=4.2.0`, `worklets >=0.7.0`, RN `>=0.80.0` — matches installed `reanimated@~4.3.1`, `worklets@^0.8.3`, RN `0.85.3` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-gesture-handler` | `~2.31.2` (installed) | Pan gesture for hand-rolled drag fallback | If `reanimated-dnd` cross-zone (placed↔pool) proves immature — see Open Q1 |
| `@gorhom/bottom-sheet` | `^5.2.14` (installed) | Travel-mode toggle sheet / regenerate confirm | Reuse existing `pin-sheet.tsx` idiom |
| `zod@3` | `npm:zod@3` (EF), `^3.23.8` (client/core) | Validate Claude JSON output + generate-plan request | Mandatory per CLAUDE.md §4.5; mirror `LLMOutput` pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `computeRoutes` (per-leg, N-1 calls) | `computeRouteMatrix` (NxN) | Matrix is for full optimization (deferred V2 per CONTEXT). Adjacent-only (D-07) is cheaper and matches "인접 항목 간만". |
| `react-native-reanimated-dnd` | `react-native-draggable-flatlist@4.0.3` | **REJECTED** — Reanimated 2/3 internal APIs, unmaintained since 2025-05, breaks on Reanimated 4 / New Arch `[VERIFIED: npm peerDeps + GH issues #389/#501/#5787]` |
| `react-native-reanimated-dnd` | Hand-rolled gesture-handler + Reanimated 4 | More control, zero new dep, but more code. Sketch first to compare (Open Q1). |
| Claude for clustering | Deterministic k-means/DBSCAN in EF | LLM gives category-mix + "good plan" judgment (D-06) a geometric clusterer can't. But a deterministic pre-cluster could anchor Claude — see Open Q3. |

**Installation (iOS):**
```bash
pnpm --filter @moajoa/ios-app add react-native-reanimated-dnd   # only if library route chosen over hand-roll
```
EF has no install step (Deno imports by URL). 0017 migration is a new SQL file.

**Version verification (performed this session):**
- `claude-sonnet-4-6` — `[VERIFIED: codebase EXTRACTION_MODEL + anthropic.com news]` current, $3/$15 MTok.
- `react-native-reanimated-dnd@2.0.0` — `[VERIFIED: npm view]` published 2026-03-16, peer reanimated ≥4.2.0.
- `react-native-draggable-flatlist@4.0.3` — `[VERIFIED: npm view]` last modified 2025-05-06, peer reanimated ≥2.8.0 (does NOT mean 4-compatible; uses removed v2/v3 APIs).
- Routes API `computeRoutes` Essentials SKU 9EFF-679A-9B16 — `[VERIFIED: WebFetch developers.google.com/maps/billing-and-pricing/pricing]` $5/1000 = **$0.005/call**, 10k free/month.

## Architecture Patterns

### System Architecture Diagram

```
[iOS plan.tsx]
   │  user taps "플랜 만들기"
   │  supabase.functions.invoke('generate-plan', { trip_id, travel_mode })
   ▼
[generate-plan EF (Deno, service role)]
   │  1. auth.getUser(callerToken)  ──── reject anon/service (cost-abuse gate, mirror extract-youtube L71-79)
   │  2. claim guard: any in-flight plan for this trip?  (avoid double-spend)
   │  3. load placeable places  (trip_id, hidden_at IS NULL, lat≠0 OR lng≠0)
   │       broadcast {step:'loading', pct:10}  on  plan:{trip_id}
   ▼
[Claude  claude-sonnet-4-6]
   │  in: places[] (id,name_ko/local,lat,lng,category,summary_ko), trip date range (N days),
   │      필수 anchor ids (re-anchor path), removed ids
   │  out JSON: { days:[{day_index, items:[{place_id, sort_order}]}], unplaced:[place_id] }
   │       broadcast {step:'clustering', pct:50}
   ▼
[Routes post-process  (in EF)]
   │  for each day, for each adjacent pair (i, i+1):  computeRoutes(travelMode) → leg duration
   │  (0,0)-coord places already excluded → in unplaced pool (D-09)
   │       broadcast {step:'routing', pct:80}
   ▼
[Postgres write]
   │  upsert plans row (trip_id, status='draft', travel_mode, collaborative=false)
   │  insert plan_items (plan_id, place_id, day_index, sort_order, leg_travel_seconds, is_anchor)
   │  unplaced = places with NO plan_item row for this plan  (sentinel-free, D-13)
   │       broadcast {step:'done', pct:100}
   ▼
[iOS plan.tsx]  realtime 'done' → refetch plan → render days + legs + unplaced pool
   on drag-reorder of a leg endpoint → PATCH sort_order + invoke recompute (affected leg only, D-07)
   on travel-mode toggle → invoke recompute (all legs of plan, D-08)
   on 필수 toggle + "다시 만들기" → confirm modal → invoke generate-plan with anchors (overwrite, D-10/D-11)
```

### Recommended Structure
```
supabase/functions/generate-plan/
├── index.ts              # handler: auth gate, claim guard, orchestration, broadcast, cost log
├── pipeline/
│   ├── claude.ts         # buildPlanPrompt + callClaudePlan + PlanLLMOutput zod (mirror extract pipeline/claude.ts)
│   └── routes.ts         # computeRoutesLeg(origin,dest,mode) → seconds  (mirror pipeline/places.ts)
supabase/migrations/0017_plans.sql       # plans + plan_items + RLS via DEFINER helpers (append-only)
packages/core/src/schemas/plan.ts        # Plan/PlanItem/PlanCreate/GeneratePlanRequest zod + planChannelName()
packages/api/src/queries/plans.ts        # getPlanByTrip, generatePlan(invoke), reorderPlanItem, setTravelMode, ...
apps/ios/app/trip/[id]/(tabs)/plan.tsx   # fill stub: button + skeleton + days + legs + unplaced pool + drag
apps/ios/components/plan/                 # day-section, plan-item-row, unplaced-pool, travel-mode-toggle
apps/ios/lib/realtime.ts                  # add subscribePlanProgress (mirror subscribeExtractProgress)
```

### Pattern 1: trip-scoped broadcast (extend `broadcastStep`)
**What:** Same broadcast helper as `extract-youtube`, but channel key is `plan:{trip_id}` not `extract:{link_id}`.
**When:** EF emits progress; client subscribes for skeleton → % → done.
```ts
// EF side — copy broadcastStep from extract-youtube/index.ts L482-500, change channel name.
// Source: codebase supabase/functions/extract-youtube/index.ts
const channel = admin.channel('plan:' + tripId);
await channel.send({ type: 'broadcast', event: 'progress', payload: { step, progress_pct } });
admin.removeChannel(channel);

// core/src/constants.ts — add the builder so client+server can't drift (mirror extractChannelName)
export const PLAN_CHANNEL_PREFIX = 'plan:';
export function planChannelName(tripId: string): string { return `plan:${tripId}`; }

// client lib/realtime.ts — mirror subscribeExtractProgress
export function subscribePlanProgress(tripId: string, onProgress: (p: PlanProgress) => void): RealtimeChannel {
  return supabase.channel(planChannelName(tripId))
    .on('broadcast', { event: 'progress' }, (msg) => onProgress(msg.payload as PlanProgress))
    .subscribe();
}
```

### Pattern 2: Routes computeRoutes adjacent leg (TRANSIT default)
**What:** One POST per adjacent pair. FieldMask trimmed to keep cost in the Essentials tier.
```ts
// Source: CITED developers.google.com/maps/documentation/routes/transit-route + compute_route_directions
async function computeRoutesLeg(o: LatLng, d: LatLng, mode: 'TRANSIT'|'WALK'|'DRIVE', key: string): Promise<number|null> {
  const body: Record<string, unknown> = {
    origin:      { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
    destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
    travelMode:  mode,
  };
  if (mode === 'TRANSIT') body.transitPreferences = { routingPreference: 'LESS_WALKING' };
  // DRIVE could add routingPreference: 'TRAFFIC_UNAWARE' to STAY in Essentials (TRAFFIC_AWARE → Pro tier).
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      // Minimal mask = cheapest SKU. duration is route-level for single-leg requests.
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;            // grounding is best-effort; null leg renders "이동시간 —"
  const data = await res.json();
  const dur = data?.routes?.[0]?.duration;     // e.g. "840s"
  return dur ? parseInt(String(dur).replace('s',''), 10) : null;
}
```
**Important:** TRANSIT does **NOT** allow intermediate waypoints `[CITED: routes/transit-route]` — which is exactly why D-07's adjacent-pair (origin+destination only, N-1 separate calls) is the correct shape. A single multi-stop TRANSIT request is impossible; per-leg is mandatory, not just a cost choice.

### Pattern 3: Claude plan output schema (strict JSON, mirror extraction)
```ts
// Source: mirror codebase pipeline/claude.ts LLMOutput pattern
const PlanLLMOutput = z.object({
  reasoning: z.string().optional(),
  days: z.array(z.object({
    day_index: z.number().int().min(0),
    items: z.array(z.object({
      place_id: z.string().uuid(),
      sort_order: z.number().int().min(0),
    })),
  })),
  unplaced: z.array(z.string().uuid()),   // place_ids left in the pool
});
// EF validates: every place_id Claude returns MUST exist in the input set (reject hallucinated ids);
// every input place id appears exactly once across days∪unplaced (no drops, no dupes).
```
**Prompt shape (Claude's Discretion D, but recommended scaffold):** system prompt states it is an itinerary planner for 일본 도시 자유여행; user prompt provides trip N-day count, the place list with coords+category+summary_ko, the soft cap (4–5/day, overflow→next day within N), the geo-cluster-first rule (same neighborhood = same day), the light category-mix rule (avoid all-food days), 필수 anchor ids (must appear, re-cluster around them — D-10), removed ids (exclude — D-11). `temperature: 0`, `max_tokens: 4096` (output is just ids+indices, far smaller than extraction's place objects). Output JSON only, same `extractJsonBlock` fence-stripping as extraction.

### Anti-Patterns to Avoid
- **Direct cross-table EXISTS in plan_items RLS** — use `can_edit_trip(trip_id)` DEFINER helper via the parent plan's trip_id (CLAUDE.md §4.4, Pitfall 3 / 42P17 recursion the 0016 squash specifically guards against).
- **Modifying 0016** — append-only resumed after the one-time squash (CLAUDE.md §4.3). New file is `0017_plans.sql`.
- **`.js` extension on workspace imports** (Turbopack/Metro break, CLAUDE.md §4.5).
- **Service-role key or ANTHROPIC/Routes key reaching the client** — all three live only inside the EF (CLAUDE.md §4.4/§5).
- **`react-native-draggable-flatlist`** on this Reanimated-4 project (will throw at runtime).
- **Auto-generating a plan after extraction** — D-01 explicitly forbids; gate on the button only. Verifier MUST NOT gate "추출 직후 자동" (D-01 waives ROADMAP success criterion 1 wording).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Travel time between two points | Haversine × guessed speed | Routes `computeRoutes` | Transit transfers, walking paths, one-ways — Haversine is wildly wrong in dense cities. Budget allows it. |
| Geo-clustering "same neighborhood" | DIY lat/lng bucket grid | Claude (with optional deterministic pre-cluster) | Neighborhood ≠ grid cell; Claude also does category-mix + sensible ordering a bucketer can't (D-06). |
| Realtime progress channel | Polling the DB | Supabase Broadcast (`plan:{trip_id}`) | Already wired both ends for extraction; copy it. |
| Drag-reorder gesture math | Manual PanResponder + layout measuring | `react-native-reanimated-dnd` OR gesture-handler+Reanimated 4 | New Arch / Reanimated 4 worklet threading is subtle; the maintained lib (or GH primitives) handle it. |
| RLS for plans/plan_items | New per-table EXISTS policies | Existing `can_edit_trip`/`can_read_trip`/`am_trip_owner` | 0016 already proved & shipped them; reuse = no recursion risk. |
| EF auth/claim/cost scaffolding | New handler from scratch | Copy `extract-youtube/index.ts` skeleton | auth.getUser gate, atomic claim, cost logging, CORS, broadcast all solved there. |

**Key insight:** Phase 18 is ~80% recombination of extract-youtube primitives + 0016 RLS + two new external calls (Routes, a second Claude prompt). The risk is concentrated in (a) Claude plan-quality eval and (b) the drag-UI library choice on Reanimated 4 — everything else is a copy.

## Runtime State Inventory

Not a rename/refactor/migration phase — greenfield feature on locked Phase 17 contracts. Section omitted (no stored-string/OS-registered state to migrate). The one schema action is additive: new `0017_plans.sql` (append-only), requiring `pnpm supabase:types` regen afterward per CLAUDE.md §4.3.

## Common Pitfalls

### Pitfall 1: Routes tier creep from FieldMask / routingPreference
**What goes wrong:** Adding `TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL` (DRIVE) or rich fields (`routes.legs.steps`, polyline) silently bumps each call from Essentials ($0.005) to Pro ($0.010) — doubling cost and risking the <$0.005/plan-per-leg framing.
**Why:** Routes SKU tier is determined by which fields/features the request uses, not the endpoint `[CITED: routes/usage-and-billing]`.
**How to avoid:** FieldMask = `routes.duration` only; for DRIVE use `routingPreference: 'TRAFFIC_UNAWARE'` (or omit). Never request steps/polyline for grounding.
**Warning signs:** `extraction_costs` rows logging `0.010` for `google_routes`.

### Pitfall 2: Budget framing — "<$0.005/plan" is per-leg, not per-plan
**What goes wrong:** D-07 says "비용 예산 <$0.005/플랜" but a 3-day, 5-place-per-day plan has 3×4 = 12 legs = **$0.06** if every leg is fresh.
**Why:** $0.005 is the per-call Essentials price; a plan has N-1 legs per day.
**How to avoid:** Plan-phase should reframe the budget. Reality: Essentials gives **10,000 free Routes calls/month** `[VERIFIED: pricing]`; at ~12 legs/plan that's ~830 free plan generations/month — effectively free at dogfooding scale. Recompute-on-drag (D-07) touches only the 1–2 affected legs, not the whole plan. Claude side: output is tiny (~a few hundred tokens), input ~place count × ~60 tokens; for 30 places ≈ 2k in / 1k out ≈ **$0.02/plan** — log it to `extraction_costs(provider:'anthropic')` exactly as extraction does.

### Pitfall 3: react-native-draggable-flatlist on Reanimated 4
**What goes wrong:** Importing it throws `useValue is not a function` / "Tried to synchronously call a non-worklet function on the UI thread" at runtime, or silently no-ops.
**Why:** v4.0.3 (last publish 2025-05) is built on Reanimated 2/3 internals removed in v4; project is on `reanimated@~4.3.1` + New Architecture `[VERIFIED: npm peerDeps + GH #389/#501/#5787]`.
**How to avoid:** Use `react-native-reanimated-dnd@2.0.0` (Reanimated-4-native) or hand-roll. Decide via a sketch (Open Q1) before committing the UI plan.
**Warning signs:** Drag works in Expo Go but crashes in the dev build (Reanimated 4 needs a dev build, not Expo Go — and this project already uses `pnpm sim`/EAS, not Expo Go, so test there).

### Pitfall 4: (0,0) places silently breaking Routes
**What goes wrong:** A place with `lat=0,lng=0` (manual add placeholder, `add_manual_place` coalesces to 0,0) fed to computeRoutes returns a route from the Gulf of Guinea — garbage leg time.
**Why:** D-09 / Phase 17 MR-01 — coordinateless places exist.
**How to avoid:** EF filter `(lat != 0 OR lng != 0)` when selecting placeable places; route them straight to the unplaced pool before Claude even sees them as placeable (or pass them as pool-only). Mirror the existing `hidden_at IS NULL` filter in `listPlacesByTrip`.
**Warning signs:** A leg time of hours between two same-city places.

### Pitfall 5: Double-spend on rapid re-taps
**What goes wrong:** User taps "플랜 만들기" twice → two concurrent EF runs → 2× Claude + 2× Routes spend, racing writes.
**Why:** No claim guard (extract-youtube solved this with an atomic conditional UPDATE on link status).
**How to avoid:** Either a `plans.status='generating'` claim row checked atomically, or client-side disable+spinner gated on the realtime channel (simpler given draft-overwrite semantics D-11). Recommend client disable + EF idempotency (overwrite same trip's draft plan).

### Pitfall 6: Claude returning place_ids not in the input (or dropping some)
**What goes wrong:** Hallucinated/typo'd uuid → FK violation on plan_items insert; or a place silently vanishes (not in days, not in unplaced).
**How to avoid:** Post-validate: intersect Claude's returned ids with the input set; reject unknowns; auto-append any input place absent from both days and unplaced into the unplaced pool (never drop a user's place). Same defensive posture as extraction's `source_quote` post-filter.

## Code Examples

### generate-plan request contract (core schema)
```ts
// Source: mirror codebase RequestSchema in extract-youtube/index.ts
export const GeneratePlanRequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(['transit', 'walk', 'drive']).default('transit'),  // D-08
  anchor_place_ids: z.array(z.string().uuid()).default([]),              // 필수 (D-10)
  removed_place_ids: z.array(z.string().uuid()).default([]),             // D-11
});
```

### EF auth + claim skeleton (copy from extract-youtube)
```ts
// Source: codebase supabase/functions/extract-youtube/index.ts L59-79, L108-141
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
const callerToken = req.headers.get('Authorization')?.slice('Bearer '.length);
const { data: caller, error } = await admin.auth.getUser(callerToken!);
if (error || !caller?.user) return jsonError(401, 'unauthorized');   // anon/service key rejected
// then verify can_edit_trip via a lightweight select or rely on the user being owner/member
```

### Routes cost logging (reuse extraction_costs)
```ts
// extraction_costs has no FK requirement to link_id (0005 made it nullable) — perfect for Routes.
await admin.from('extraction_costs').insert({
  link_id: null, provider: 'google_places',   // ⚠ see note
  model: null, cost_usd: 0.005, duration_ms: legMs,
});
```
**⚠ Schema note:** `extraction_costs.provider` CHECK currently allows only `('anthropic','google_places')` (0016 L565). Routes is neither. **Plan-phase decision:** either (a) log Routes under `'google_places'` (cheap, no migration — Routes is a Google Maps Platform product so arguably fine), or (b) add `'google_routes'` to the CHECK in 0017. Recommend (b) for clean cost attribution — it's a trivial additive `ALTER TABLE ... DROP/ADD CONSTRAINT` in the new migration.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Directions API / Distance Matrix API | Routes API (`computeRoutes` / `computeRouteMatrix`) | Migration urged through 2025; legacy in maintenance `[CITED: masterconcept.ai migration guide]` | Use Routes v2 REST only. |
| `react-native-draggable-flatlist` (Reanimated 2/3) | `react-native-reanimated-dnd` (Reanimated 4 / New Arch) or gesture-handler+Reanimated 4 primitives | Reanimated 4 (New Arch only) | The de-facto old library is incompatible here. |
| Reanimated `budget_tokens` / fixed thinking | Sonnet 4.6 adaptive thinking | Sonnet 4.6 `[CITED: anthropic.com]` | Not used here (temperature 0, no extended thinking needed for id-mapping). |

**Deprecated/outdated:**
- `react-native-draggable-flatlist` for this stack — do not adopt.
- Directions/Distance Matrix legacy APIs — use Routes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TRANSIT routing data is available for Japanese cities (Tokyo/Osaka/Kyoto) in Routes API | Standard Stack / Pitfall 4 | If transit data is sparse for some areas, legs return null and render "이동시간 —" (graceful). Default could fall back to WALK for short legs (Claude's Discretion D-08). **VERIFY in plan-phase with a live Tokyo two-point call.** Google Transit has strong JR/Tokyo Metro coverage, so LOW risk — but unverified this session. |
| A2 | A single-leg computeRoutes request reports `duration` at route level (`routes[0].duration`); multi-leg would need `routes.legs.duration` | Pattern 2 | Wrong field mask → null leg. Trivial to confirm in plan-phase; both masks documented `[CITED: transit-route shows legs.duration]`. Recommend masking both `routes.duration,routes.legs.duration` to be safe. |
| A3 | Claude reliably emits valid JSON id-mapping for ≤30 places at temp 0 | Pattern 3 | Plan quality / parse failures. Mitigated by the same defensive validation extraction uses. Plan-quality eval is the real open work (CONTEXT "AI-system phase" note). |
| A4 | `react-native-reanimated-dnd` cross-zone (placed list ↔ unplaced pool) move is production-ready | Standard Stack | Its README lists "Cross-list dragging" as a *roadmap/future* item, present library focuses on sortable lists + grids. Placed↔pool move may need a hand-rolled drop target. **Sketch to verify (Open Q1).** MEDIUM risk. |
| A5 | Logging Routes cost under existing `extraction_costs` (provider value TBD) is acceptable | Code Examples | Cost attribution clarity only; resolved by Open decision (a)/(b). LOW risk. |

## Open Questions (RESOLVED)

> RESOLVED in plan-phase 2026-06-22 — each question is locked by a plan task; markers inline below.

1. **Drag-reorder library vs hand-roll, AND cross-zone (placed↔unplaced) move.** — RESOLVED: Plan 18-05 Task 1 (spike-gated drag lib + explicit "미배치로 보내기"/"일정에 추가" affordances, NOT cross-zone drag).
   - Know: `react-native-reanimated-dnd@2.0.0` is Reanimated-4-native and does sortable lists; `draggable-flatlist` is out.
   - Unclear: whether `reanimated-dnd`'s cross-list drag is shippable now (README marks it roadmap), and whether a same-list reorder + separate "이동" button to move to/from pool is simpler than true cross-zone drag.
   - Recommendation: **Sketch first** (per CLAUDE.md GSD spike norm). Try `reanimated-dnd` sortable for in-day reorder; for placed↔pool use an explicit affordance (long-press → "미배치로 보내기" / pool item "일정에 추가") rather than fighting cross-zone drag in v1. Decide in plan-phase / a quick spike.

2. **Recompute-on-drag scope.** D-07 says "해당 구간만 재계산." When item B moves between A and C, the affected legs are A→B and B→C (2 calls) plus the old A→C disappears. — RESOLVED: Plan 18-05 Task 3 (≤2 Routes calls per drag, day-section leg-diff).

3. **Deterministic pre-cluster before Claude?** — RESOLVED: Plan 18-03 (LLM-only first; no pre-cluster — add later only if eval shows poor grouping).

4. **plans cardinality per trip.** — RESOLVED: Plan 18-02 (one draft plan per trip, `plans_one_draft_per_trip` partial unique where status='draft'; regenerate overwrites per D-11).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ANTHROPIC_API_KEY (EF env) | Claude clustering | ✓ (used by extract-youtube) | — | none — hard requirement |
| GOOGLE_PLACES_SERVER_KEY (EF env) | Routes API (same Google Cloud project) | ✓ likely (Places already keyed) | — | **Routes API must be ENABLED on the GCP project** — see below |
| Supabase Realtime Broadcast | progress channel | ✓ (extraction uses it) | — | poll plan row status |
| `react-native-reanimated@~4.3.1` + `worklets@^0.8.3` + `gesture-handler@~2.31.2` | drag UI | ✓ installed | 4.3.1 / 0.8.3 / 2.31.2 | — |
| Supabase CLI (`supabase db push`, types regen) | 0017 migration | assumed (used in Phase 17) | — | — |

**Missing dependencies with no fallback:**
- **Routes API enablement on the Google Cloud project is unverified.** Places API being enabled does NOT auto-enable Routes API — it is a separate API/SKU in the same project. Plan-phase must confirm `routes.googleapis.com` is enabled and the existing server key is unrestricted-enough (or add Routes to the key's API allowlist). Billing alerts ($5/$20/$50, EXTRACT-06) already cover spend.

**Missing dependencies with fallback:**
- Transit data per region (A1) — null leg → "이동시간 —" graceful render; optional WALK fallback for short legs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (core/api) | Vitest `^1.6.0` — `packages/core`, `packages/api` (`pnpm --filter @moajoa/core test`) |
| Framework (iOS) | Jest `^29.7.0` + jest-expo `~56.0.5` — `apps/ios/jest.config.js`; run with `--watchman=false` in this env |
| Framework (Edge Functions) | Deno test (`jsr:@std/assert`) — `supabase/functions/.../pipeline/*.test.ts` |
| Quick run command | `pnpm --filter @moajoa/core test` (clustering/validation logic), `cd apps/ios && pnpm test --watchman=false` |
| Full suite command | `pnpm -r --parallel run test` (root) + `deno test` for EF pipeline |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | "플랜 만들기" invokes generate-plan; placeable places (lat≠0) selected, (0,0)→pool | unit (EF pipeline) | `deno test supabase/functions/generate-plan/pipeline/` | ❌ Wave 0 |
| PLAN-01 | Claude output validation: no hallucinated ids, no drops/dupes | unit | `deno test .../pipeline/claude.test.ts` (mirror extract claude.test.ts) | ❌ Wave 0 |
| PLAN-02 | "초안" labeled; reorder updates sort_order (api query) | unit (api) | `pnpm --filter @moajoa/api test` | ❌ Wave 0 |
| PLAN-02 | plan.tsx renders days/pool, drag affordance present | RNTL | `cd apps/ios && pnpm test --watchman=false plan` | ❌ Wave 0 |
| PLAN-03 | 필수 anchors passed to generate-plan request; appear in days | unit | core schema + EF prompt-includes-anchor test | ❌ Wave 0 |
| PLAN-04 | adjacent-only leg computed; null on (0,0)/failure; FieldMask minimal | unit (mock fetch) | `deno test .../pipeline/routes.test.ts` | ❌ Wave 0 |
| PLAN-05 | "친구와 같이 정하기" sets plans.collaborative + share; no new vote UI | unit (api) | `pnpm --filter @moajoa/api test` | ❌ Wave 0 |
| (cross) | planChannelName builder + subscribePlanProgress channel name | unit | core constants test + ios realtime.test.ts (mirror existing) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @moajoa/core test` and/or relevant `deno test` / ios jest target (< 30s).
- **Per wave merge:** `pnpm -r --parallel run test` + EF `deno test`.
- **Phase gate:** Full suite green + a live UAT (device/sim): tap 플랜 만들기 on a real multi-link Tokyo trip → draft appears with day split, legs, and a pool; drag reorders; mode toggle recomputes.

### Wave 0 Gaps
- [ ] `packages/core/src/schemas/plan.ts` + `plan.test.ts` — Plan/PlanItem/GeneratePlanRequest zod + planChannelName.
- [ ] `supabase/functions/generate-plan/pipeline/claude.test.ts` — prompt snapshot + PlanLLMOutput parse + id-validation (mirror extract claude.test.ts).
- [ ] `supabase/functions/generate-plan/pipeline/routes.test.ts` — leg compute with mocked fetch, FieldMask assertion, null-on-failure, (0,0) skip.
- [ ] `packages/api/src/queries/plans.test.ts` — reorder, setTravelMode, setCollaborative, generatePlan invoke shape.
- [ ] `apps/ios` — `plan.tsx` RNTL test (button → skeleton → render) + `lib/realtime.test.ts` plan-channel name (mirror existing realtime.test.ts).
- Test infra exists (vitest/jest/deno all wired). No framework install needed.

## Security Domain

`security_enforcement` not explicitly false in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | EF `auth.getUser(callerToken)` rejects anon/service keys (copy extract-youtube gate) — prevents cost-abuse on paid Claude+Routes calls (the exact threat extract-youtube L67-79 documents). |
| V3 Session Management | no | Supabase JWT handled by client; no new session surface. |
| V4 Access Control | yes | RLS on plans/plan_items via `can_edit_trip`/`can_read_trip` DEFINER helpers; EF service-role writes only after caller verified as trip editor. No direct cross-table EXISTS (CLAUDE.md §4.4). |
| V5 Input Validation | yes | `GeneratePlanRequestSchema` (zod) on EF request; `PlanLLMOutput` zod on Claude output; id-intersection check against input set. |
| V6 Cryptography | no | No new crypto. Secrets (ANTHROPIC/Routes/service-role) server-only (never EXPO_PUBLIC_*). |

### Known Threat Patterns for {Deno EF + Supabase + paid external APIs}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon/service key fires paid generate-plan | Elevation / DoS-by-cost | `auth.getUser` gate (anon key is a valid JWT but fails getUser) — proven in extract-youtube. |
| Rapid re-tap double-spend | DoS-by-cost | Client disable + EF idempotent overwrite (Pitfall 5). |
| Routes tier creep / runaway spend | DoS-by-cost | Minimal FieldMask (Essentials), TRAFFIC_UNAWARE for DRIVE, existing GCP billing alerts (EXTRACT-06), cost logging to extraction_costs. |
| Claude prompt injection via place names/summaries | Tampering | Output is constrained to id-mapping + validated against input id set; injected text can't introduce new place_ids (FK + intersection reject). |
| Cross-trip plan read/write | Info disclosure / Tampering | RLS DEFINER helpers gate by trip membership; plan_items inherit via plan→trip_id. |

## Sources

### Primary (HIGH confidence)
- Codebase: `supabase/functions/extract-youtube/index.ts` (broadcastStep, auth gate, claim guard, cost log), `pipeline/claude.ts` (Anthropic client + model + JSON pattern), `pipeline/cities.ts` (city centers), `supabase/migrations/0016_trips_baseline.sql` (RLS DEFINER helpers, places/votes/extraction_costs schema), `apps/ios/lib/realtime.ts` + `app/trip/[id]/(tabs)/map.tsx` (client subscribe + screen idiom), `packages/api/src/queries/{places,links}.ts` (typed queries + invoke), `packages/core/src/{constants,schemas/trip,schemas/place}.ts`.
- `npm view react-native-reanimated-dnd / react-native-draggable-flatlist` — peer deps & publish dates (VERIFIED this session).
- developers.google.com/maps/billing-and-pricing/pricing — Compute Routes Essentials $0.005/call, 10k free/mo (VERIFIED via WebFetch).

### Secondary (MEDIUM confidence)
- developers.google.com/maps/documentation/routes/{transit-route,compute_route_directions,usage-and-billing} — request shape, TRANSIT no-waypoints restriction, SKU-by-feature tiering (CITED).
- anthropic.com/news/claude-sonnet-4-6 — model current, $3/$15 MTok (CITED).

### Tertiary (LOW confidence)
- GitHub issues computerjazz/react-native-draggable-flatlist #389/#501 + reanimated #5787 — Reanimated-4 incompatibility symptoms (corroborated by VERIFIED peerDeps + 2025-05 stale publish, so effectively MEDIUM).
- A1 (Japan transit data availability) — unverified; needs a live plan-phase call.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm + codebase; Routes pricing fetched from Google.
- Architecture / EF design: HIGH — direct clone of shipped extract-youtube + 0016 RLS.
- plans/plan_items schema + RLS: HIGH — reuses proven 0016 DEFINER helpers; columns derived from D-12.
- Routes API call shape: MEDIUM — request body & FieldMask cited from docs; exact duration field path (route vs leg) to confirm with one live call (A2).
- Drag-UI: MEDIUM — library identified and version-matched, but cross-zone (placed↔pool) maturity needs a sketch (A4, Open Q1).
- Claude plan quality: MEDIUM — pattern sound, but plan-quality eval is the genuine open work (AI-system phase).

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (Routes pricing & Claude model stable ~30d; drag-UI library fast-moving — re-check npm before plan-phase if >2 weeks elapse).
