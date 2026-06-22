// =============================================================================
// generate-plan Edge Function (Phase 18 — PLAN-01/03/04)
// =============================================================================
// Near-clone of extract-youtube: service-role admin client + auth.getUser
// cost-abuse gate, PLUS a can_edit_trip membership check. Pipeline:
//   1. auth.getUser gate (anon/service tokens rejected) — T-18-08
//   2. can_edit_trip check (owner OR accepted owner/editor member) — T-18-09
//   3. Load placeable places (trip_id, hidden_at IS NULL, − removed_place_ids)
//      → (0,0)-coord places go straight to the unplaced pool (T-18-14)
//   4. Claude geo-cluster → days + order + unplaced pool; validatePlanIds (T-18-12)
//   5. Routes computeRoutes adjacent-only legs (FieldMask routes.duration) — T-18-11
//   6. Idempotent overwrite of the single draft plan; insert plan_items
//   7. Broadcast progress on plan:{trip_id}; log Anthropic + each Routes leg cost
//
// Invocation:
//   POST /functions/v1/generate-plan
//     { trip_id, travel_mode?, anchor_place_ids?, removed_place_ids? }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

import { callClaudePlan, validatePlanIds, type PlanPlace } from './pipeline/claude.ts';
import { computeRoutesLeg, type LatLng, type RoutesTravelMode } from './pipeline/routes.ts';

// ---- Request contract (mirror @moajoa/core GeneratePlanRequestSchema) --------
// Deno cannot import the workspace package, so redeclare the schema locally.
const RequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(['transit', 'walk', 'drive']).default('transit'),
  anchor_place_ids: z.array(z.string().uuid()).default([]),
  removed_place_ids: z.array(z.string().uuid()).default([]),
});

interface ResponseBody {
  plan_id: string;
  day_count: number;
  placed_count: number;
  unplaced_count: number;
}

// Channel literal mirrors @moajoa/core planChannelName(tripId) = 'plan:' + tripId.
function planChannelName(tripId: string): string {
  return 'plan:' + tripId;
}

// lowercase request travel_mode → uppercase Routes travelMode.
const ROUTES_MODE: Record<'transit' | 'walk' | 'drive', RoutesTravelMode> = {
  transit: 'TRANSIT',
  walk: 'WALK',
  drive: 'DRIVE',
};

// ---- Main handler -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonError(500, 'server misconfigured: missing supabase env');
  }
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  // Cost-abuse gate (T-18-08, copied verbatim from extract-youtube L57-79). The
  // anon key is a valid JWT (passes verify_jwt) but fails auth.getUser, which
  // only accepts real user session tokens — so anon/service can't fire paid work.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'unauthorized');
  }
  const callerToken = authHeader.slice('Bearer '.length);
  const { data: caller, error: callerErr } = await admin.auth.getUser(callerToken);
  if (callerErr || !caller?.user) {
    return jsonError(401, 'unauthorized');
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError(400, 'invalid json body');
  }
  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(400, 'invalid body: ' + parsed.error.message);
  }
  const { trip_id, travel_mode, anchor_place_ids, removed_place_ids } = parsed.data;
  const callerId = caller.user.id;

  // ---- Edit-rights check (T-18-09, Security V4) -------------------------------
  // Must happen BEFORE any paid Claude/Routes call. Mirror the can_edit_trip
  // helper (0016 L313-336) with a service-role query, since auth.uid() is null
  // under the service role: owner OR an accepted owner/editor membership.
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, owner_id, start_date, end_date')
    .eq('id', trip_id)
    .maybeSingle();
  if (tripErr) return jsonError(500, tripErr.message);
  if (!trip) return jsonError(404, 'trip not found');

  let canEdit = trip.owner_id === callerId;
  if (!canEdit) {
    const { data: membership } = await admin
      .from('memberships')
      .select('role, accepted_at')
      .eq('trip_id', trip_id)
      .eq('user_id', callerId)
      .maybeSingle();
    canEdit = !!membership &&
      membership.accepted_at !== null &&
      (membership.role === 'owner' || membership.role === 'editor');
  }
  if (!canEdit) return jsonError(403, 'forbidden');

  try {
    await broadcastStep(admin, trip_id, 'loading', 10);

    // ---- Load placeable places (D-09 / Pitfall 4) ----------------------------
    const { data: allPlaces, error: placesErr } = await admin
      .from('places')
      .select('id, name_local, name_ko, lat, lng, category, summary_ko')
      .eq('trip_id', trip_id)
      .is('hidden_at', null);
    if (placesErr) throw placesErr;

    const removedSet = new Set(removed_place_ids);
    const visible = (allPlaces ?? []).filter((p) => !removedSet.has(p.id));

    // (0,0)-coord places (manual-add placeholders) → pool-only: never sent to
    // Claude as placeable, never to Routes (T-18-14).
    const placeable: typeof visible = [];
    const nullIslandIds: string[] = [];
    for (const p of visible) {
      if (p.lat === 0 && p.lng === 0) nullIslandIds.push(p.id);
      else placeable.push(p);
    }

    if (placeable.length === 0) {
      await broadcastStep(admin, trip_id, 'error', 0, { error: 'no placeable places' });
      return jsonError(400, 'no placeable places'); // UI: "자동 배치할 장소가 없어요"
    }

    // ---- Claude geo-cluster --------------------------------------------------
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const dayCount = computeDayCount(trip.start_date, trip.end_date);

    const planPlaces: PlanPlace[] = placeable.map((p) => ({
      id: p.id,
      name_ko: p.name_ko,
      name_local: p.name_local,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      summary_ko: p.summary_ko,
    }));

    const t0 = performance.now();
    const { output, usage } = await callClaudePlan({
      anthropicKey,
      dayCount,
      places: planPlaces,
      anchorIds: anchor_place_ids,
      removedIds: removed_place_ids,
    });
    const anthropicDurationMs = Math.round(performance.now() - t0);

    // Defensive id-validation (T-18-12): intersect with the placeable input set,
    // never drop a place. Then fold the (0,0) pool in — those are placeable-set
    // inputs too as far as "no place dropped" goes.
    const placeableIds = planPlaces.map((p) => p.id);
    const validated = validatePlanIds(placeableIds, output);
    const unplacedIds = [...validated.unplaced, ...nullIslandIds];

    // Anthropic cost (link_id null — plans have no link; nullable since 0005).
    const anthropicCost = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
    await logCost(admin, null, {
      provider: 'anthropic',
      model: usage.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: anthropicCost,
      duration_ms: anthropicDurationMs,
    });

    await broadcastStep(admin, trip_id, 'clustering', 50);

    // ---- Routes post-process (D-07, adjacent only) ---------------------------
    const coordById = new Map<string, LatLng>(
      planPlaces.map((p) => [p.id, { lat: p.lat, lng: p.lng }]),
    );
    const routesMode = ROUTES_MODE[travel_mode];
    const googleKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY');

    // leg_travel_seconds keyed by place_id = the leg INTO that item (first item
    // of a day stays null). Computed per adjacent pair within each validated day.
    const legByPlaceId = new Map<string, number | null>();
    for (const day of validated.days) {
      const ordered = [...day.items].sort((a, b) => a.sort_order - b.sort_order);
      for (let i = 1; i < ordered.length; i++) {
        const from = coordById.get(ordered[i - 1].place_id);
        const to = coordById.get(ordered[i].place_id);
        if (!from || !to || !googleKey) {
          legByPlaceId.set(ordered[i].place_id, null);
          continue;
        }
        const legT0 = performance.now();
        const seconds = await computeRoutesLeg(from, to, routesMode, googleKey);
        const legMs = Math.round(performance.now() - legT0);
        legByPlaceId.set(ordered[i].place_id, seconds);
        // Log every actual Routes call (one fetch each — Essentials $0.005).
        await logCost(admin, null, {
          provider: 'google_routes',
          cost_usd: 0.005,
          duration_ms: legMs,
        });
      }
    }

    await broadcastStep(admin, trip_id, 'routing', 80);

    // ---- Write plans + plan_items (idempotent overwrite, Pitfall 5) ----------
    // Delete the existing draft (the plans_one_draft_per_trip partial unique makes
    // a fresh insert clean) so re-taps overwrite rather than duplicate.
    await admin.from('plans').delete().eq('trip_id', trip_id).eq('status', 'draft');

    const { data: plan, error: planErr } = await admin
      .from('plans')
      .insert({ trip_id, status: 'draft', travel_mode, collaborative: false })
      .select('id')
      .single();
    if (planErr) throw planErr;
    const planId = plan.id;

    const anchorSet = new Set(anchor_place_ids);
    const itemRows = validated.days.flatMap((day) => {
      const ordered = [...day.items].sort((a, b) => a.sort_order - b.sort_order);
      return ordered.map((item, idx) => ({
        plan_id: planId,
        place_id: item.place_id,
        day_index: day.day_index,
        sort_order: idx,
        leg_travel_seconds: legByPlaceId.get(item.place_id) ?? null,
        is_anchor: anchorSet.has(item.place_id),
      }));
    });

    let placedCount = 0;
    if (itemRows.length > 0) {
      const { error: itemsErr } = await admin.from('plan_items').insert(itemRows);
      if (itemsErr) throw itemsErr;
      placedCount = itemRows.length;
    }

    await broadcastStep(admin, trip_id, 'done', 100, {
      plan_id: planId,
      placed_count: placedCount,
      unplaced_count: unplacedIds.length,
    });

    return jsonOk({
      plan_id: planId,
      day_count: dayCount,
      placed_count: placedCount,
      unplaced_count: unplacedIds.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[generate-plan] failed:', message);
    await broadcastStep(admin, trip_id, 'error', 0, { error: message });
    return jsonError(500, message);
  }
});

// ---- Helpers ----------------------------------------------------------------

// N days = inclusive day count between start_date and end_date (YYYY-MM-DD).
// Missing dates → default to 1 day (a single-day plan) so clustering still runs.
function computeDayCount(start: string | null, end: string | null): number {
  if (!start || !end) return 1;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  const days = Math.round((e - s) / 86_400_000) + 1; // inclusive
  return Math.max(1, days);
}

type AdminClient = SupabaseClient<any, 'public', 'public', any, any>;

async function broadcastStep(
  admin: AdminClient,
  tripId: string,
  step: string,
  progressPct: number,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const channel = admin.channel(planChannelName(tripId));
    await channel.send({
      type: 'broadcast',
      event: 'progress',
      payload: { step, progress_pct: progressPct, ...(detail ?? {}) },
    });
    admin.removeChannel(channel);
  } catch (err) {
    console.warn('[broadcast] failed:', err);
  }
}

async function logCost(
  admin: AdminClient,
  linkId: string | null,
  entry: {
    provider: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    cost_usd: number;
    duration_ms: number;
  },
): Promise<void> {
  try {
    await admin.from('extraction_costs').insert({
      link_id: linkId,
      provider: entry.provider,
      model: entry.model ?? null,
      input_tokens: entry.input_tokens ?? null,
      output_tokens: entry.output_tokens ?? null,
      cost_usd: entry.cost_usd,
      duration_ms: entry.duration_ms,
    });
  } catch (err) {
    console.warn('[cost-log] failed:', err);
  }
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

function jsonOk(body: ResponseBody): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
