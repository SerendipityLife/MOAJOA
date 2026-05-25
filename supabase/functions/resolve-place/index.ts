// =============================================================================
// resolve-place Edge Function
// =============================================================================
// POST { query?, lat?, lng?, language? } → { places: ResolvedPlace[] } (max 5)
//
// Phase 3 D-08 lock: server-side Google Places resolution keeps the API key
// off-device and enforces FieldMask (Phase 2 D-12 lock — no wildcard).
//
// Authorization: Bearer <JWT> required. The JWT can be anon — we don't load
// the user. We only need to keep unauthenticated traffic from firing the API.
// Per-call cost is logged to extraction_costs with link_id=null (unblocked by
// migration 0005, Phase 3 Plan 03-01).
//
// Invocation:
//   POST /functions/v1/resolve-place
//     headers: { Authorization: 'Bearer <anon or user JWT>', content-type: 'application/json' }
//     body: { "query": "스타벅스 도쿄", "language": "ko" }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { searchPlaces } from './pipeline/places-search.ts';

// ---- Request contract -------------------------------------------------------
// Mirrors packages/core/src/schemas/place.ts ResolvePlaceRequestSchema.
const RequestSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    language: z.string().min(2).max(8).default('ko'),
  })
  .refine((v) => v.query !== undefined || (v.lat !== undefined && v.lng !== undefined), {
    message: 'Either query or (lat,lng) is required',
  });

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

// ---- Main handler -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Auth gate — keep unauthenticated traffic from firing Places API.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // Parse + validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_body', detail: parsed.error.flatten() },
      400,
    );
  }

  // Admin client for cost logging (RLS bypass — extraction_costs is service-role only).
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  // Call Google Places.
  let result;
  try {
    result = await searchPlaces(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[resolve-place] places api failed:', msg);
    return jsonResponse({ error: 'places_api_failed' }, 502);
  }

  // Per-call cost log. link_id=null marks this as a manual search (D-08).
  // cost_usd 0.032 = Google Places API v1 Text Search Pro tier published rate.
  // Note: extraction_costs schema (0004) splits tokens into input_tokens/output_tokens
  // (not a single `tokens` column). For non-LLM calls we set both to null.
  await admin
    .from('extraction_costs')
    .insert({
      link_id: null,
      provider: 'google_places',
      model: 'text-search',
      input_tokens: null,
      output_tokens: null,
      cost_usd: 0.032,
      duration_ms: result.duration_ms,
    })
    .then(({ error }) => {
      if (error) console.warn('[resolve-place] cost-log failed:', error.message);
    });

  return jsonResponse({ places: result.places }, 200);
});
