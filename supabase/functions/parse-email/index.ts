// =============================================================================
// parse-email Edge Function (Phase 21 — LEDGER-02/03/04)
// =============================================================================
// Near-clone of generate-plan/index.ts (atomic claim + service-role + idempotent
// UPDATE). Triggered fire-and-forget by inbound-email. Pipeline:
//   1. x-ingest-secret gate (same shared secret as inbound-email; verify_jwt=false).
//   2. Atomic claim: status pending|failed → processing (0 rows → 409 already claimed).
//   3. postal-mime parse (raw_mime) → Claude payment extraction → validateTripId.
//   4. resolveFx (mail-first > Frankfurter > unavailable) — 5-element FX record.
//   5. UPDATE: 5 FX elements + amount_krw + fields + trip_id + status ready/needs_review,
//      raw_mime=null (parse-then-drop, D-03). Anthropic cost logged; Frankfurter free.
//   6. Any failure → status='failed', partial values preserved (extract-youtube idiom).
//
// Invocation:
//   POST /functions/v1/parse-email  headers: x-ingest-secret  { entry_id }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

import { parseMime } from './pipeline/mail.ts';
import {
  buildLedgerPrompt,
  callClaudeLedger,
  parseLedgerOutput,
  validateTripId,
  type LedgerTrip,
} from './pipeline/claude.ts';
import { resolveFx } from './pipeline/fx.ts';

const RequestSchema = z.object({
  entry_id: z.string().uuid(),
});

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

  // ---- Shared-secret gate (same secret as inbound-email) ---------------------
  const ingestSecret = Deno.env.get('INGEST_SECRET');
  if (!ingestSecret) {
    return jsonError(500, 'server misconfigured: missing INGEST_SECRET');
  }
  if (req.headers.get('x-ingest-secret') !== ingestSecret) {
    return jsonError(401, 'unauthorized');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonError(500, 'server misconfigured: missing supabase env');
  }
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'invalid json body');
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'invalid body: ' + parsed.error.message);
  }
  const { entry_id } = parsed.data;

  // ---- Atomic claim (pending|failed → processing) ----------------------------
  // Single conditional UPDATE — two concurrent triggers can't both double-spend
  // on Anthropic (generate-plan/extract-youtube claim idiom).
  const { data: claimed, error: claimErr } = await admin
    .from('ledger_entries')
    .update({ status: 'processing' })
    .eq('id', entry_id)
    .in('status', ['pending', 'failed'])
    .select('*');
  if (claimErr) return jsonError(500, claimErr.message);
  if (!claimed || claimed.length === 0) {
    return jsonError(409, 'already processing or not claimable');
  }
  const entry = claimed[0];

  try {
    if (!entry.raw_mime) throw new Error('entry has no raw_mime to parse');

    // ---- 1. MIME parse -------------------------------------------------------
    const mail = await parseMime(entry.raw_mime);

    // ---- 2. Load the owner's trips (owner + accepted-member) for matching ----
    const trips = await loadOwnerTrips(admin, entry.owner_user_id);

    // ---- 3. Claude payment extraction ---------------------------------------
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const t0 = performance.now();
    const { output, usage } = await callClaudeLedger({
      mail: { subject: mail.subject, text: mail.text, date: mail.date },
      trips,
      anthropicKey,
    });
    const anthropicDurationMs = Math.round(performance.now() - t0);

    // Log Anthropic cost (link_id null — ledger has no link; nullable since 0005).
    const anthropicCost = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
    await logCost(admin, {
      provider: 'anthropic',
      model: usage.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: anthropicCost,
      duration_ms: anthropicDurationMs,
    });

    // Re-validate through parseLedgerOutput is already done inside callClaudeLedger;
    // `output` is the validated shape. Defensive trip-id intersection (T-21-11).
    const tripId = validateTripId(trips.map((t) => t.id), output.matched_trip_id);

    // ---- 4. FX resolution (5-element atomic record, LEDGER-03) --------------
    const fx = await resolveFx(
      output.currency,
      output.paid_at,
      output.amount_foreign,
      output.krw_amount,
      output.fx_rate,
    );

    // ---- 5. Status decision + idempotent UPDATE -----------------------------
    const status =
      output.confidence === 'high' && output.amount_foreign !== null && output.currency !== null
        ? 'ready'
        : 'needs_review';

    const { error: updErr } = await admin
      .from('ledger_entries')
      .update({
        status,
        trip_id: tripId,
        platform: output.platform ?? entry.platform ?? null,
        merchant: output.merchant,
        card_last4: output.card_last4,
        amount_foreign: output.amount_foreign,
        currency: output.currency,
        fx_rate: fx.fx_rate,
        fx_source: fx.fx_source,
        fx_as_of: fx.fx_as_of,
        amount_krw: fx.amount_krw,
        paid_at: output.paid_at,
        raw_mime: null, // parse-then-drop (D-03) — TTL no longer needed
        raw_expires_at: null,
      })
      .eq('id', entry_id);
    if (updErr) throw updErr;

    return jsonOk({ entry_id, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parse-email] failed:', message);
    // Preserve whatever partial values already exist; only flip status to failed.
    await admin.from('ledger_entries').update({ status: 'failed' }).eq('id', entry_id);
    return jsonError(500, message);
  }
});

// ---- Helpers ---------------------------------------------------------------

type AdminClient = SupabaseClient<any, 'public', 'public', any, any>;

/**
 * Trips the forwarder could plausibly have paid for: owner trips + trips where
 * they hold an accepted membership. Service-role bypasses RLS, so we mirror the
 * can_read_trip semantics (owner OR accepted member) with explicit queries.
 */
async function loadOwnerTrips(admin: AdminClient, ownerUserId: string): Promise<LedgerTrip[]> {
  const byId = new Map<string, LedgerTrip>();

  const { data: owned } = await admin
    .from('trips')
    .select('id, title, city_code, start_date, end_date')
    .eq('owner_id', ownerUserId);
  for (const t of owned ?? []) byId.set(t.id, t as LedgerTrip);

  const { data: memberships } = await admin
    .from('memberships')
    .select('trip_id')
    .eq('user_id', ownerUserId)
    .not('accepted_at', 'is', null);
  const memberTripIds = (memberships ?? []).map((m) => m.trip_id).filter((id) => !byId.has(id));
  if (memberTripIds.length > 0) {
    const { data: memberTrips } = await admin
      .from('trips')
      .select('id, title, city_code, start_date, end_date')
      .in('id', memberTripIds);
    for (const t of memberTrips ?? []) byId.set(t.id, t as LedgerTrip);
  }

  return [...byId.values()];
}

async function logCost(
  admin: AdminClient,
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
      link_id: null,
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
    'Access-Control-Allow-Headers': 'content-type, x-ingest-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
