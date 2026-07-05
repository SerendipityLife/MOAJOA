// =============================================================================
// inbound-email Edge Function (Phase 21 — LEDGER-05)
// =============================================================================
// The CF Email Worker POSTs each received mail's raw MIME + envelope meta here.
// This EF is verify_jwt=false (config.toml) — the compensating control is a shared
// x-ingest-secret (Pitfall 7). Pipeline:
//   1. x-ingest-secret gate (mismatch → 401; secret unset → 500). This is a shared
//      -secret gate, NOT a signed-in-user gate — the caller is a Worker (T-21-13).
//   2. To-token match: local-part → forwarding_addresses. Unmatched → 202 'ignored'
//      (drop; matched AND unmatched both return 202-class so token existence never
//      leaks via status/timing — T-21-12).
//   3. Matched → INSERT ledger_entries status='pending' + raw_mime + 7d TTL (D-03).
//   4. Fire-and-forget trigger parse-email (NO await — Pitfall 5).
//
// Invocation (from the Worker):
//   POST /functions/v1/inbound-email
//     headers: x-ingest-secret
//     { to, from, rawSize, raw }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const RequestSchema = z.object({
  to: z.string(),
  from: z.string(),
  rawSize: z.number(),
  raw: z.string(),
});

const RAW_TTL_MS = 7 * 24 * 60 * 60 * 1000; // D-03: raw MIME kept 7 days max

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

  // ---- Shared-secret gate (T-21-13) — NOT a user auth gate. ------------------
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
  const { to, from, raw } = parsed.data;

  // ---- To-token match --------------------------------------------------------
  // local-part of the envelope To; strip +subaddressing (tok+anything@ → tok).
  const token = extractToken(to);
  if (!token) {
    return ignored(); // no parseable token → drop (202)
  }

  const { data: fwd, error: fwdErr } = await admin
    .from('forwarding_addresses')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  // On a lookup error we still drop as 'ignored' (never leak existence / errors).
  if (fwdErr || !fwd) {
    return ignored();
  }

  // ---- Store the entry (status=pending) --------------------------------------
  const { data: entry, error: insErr } = await admin
    .from('ledger_entries')
    .insert({
      owner_user_id: fwd.user_id,
      status: 'pending',
      platform: fromDomainHint(from),
      raw_mime: raw,
      raw_expires_at: new Date(Date.now() + RAW_TTL_MS).toISOString(),
    })
    .select('id')
    .single();
  if (insErr || !entry) {
    return jsonError(500, insErr?.message ?? 'insert failed');
  }

  // ---- Fire-and-forget parse trigger (Pitfall 5 — NO await) ------------------
  // PARSE_EMAIL_URL unset (local dev) → skip silently.
  const parseUrl = Deno.env.get('PARSE_EMAIL_URL');
  if (parseUrl) {
    fetch(parseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-secret': ingestSecret,
      },
      body: JSON.stringify({ entry_id: entry.id }),
    }).catch(() => {});
  }

  return jsonOk({ status: 'accepted', entry_id: entry.id });
});

// ---- Helpers ---------------------------------------------------------------

/** Envelope To → forwarding token: local-part, +subaddressing stripped. */
function extractToken(to: string): string | null {
  const local = to.split('@')[0]?.trim().toLowerCase();
  if (!local) return null;
  const token = local.split('+')[0];
  return token.length > 0 ? token : null;
}

/** Cheap platform hint from the sender domain (nullable — parse-email refines it). */
function fromDomainHint(from: string): string | null {
  const at = from.lastIndexOf('@');
  if (at === -1) return null;
  const domain = from.slice(at + 1).replace(/[>\s]+$/, '').trim().toLowerCase();
  return domain.length > 0 ? domain : null;
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

/** Unmatched / undrivable → 202 (existence never leaks — T-21-12). */
function ignored(): Response {
  return new Response(JSON.stringify({ status: 'ignored' }), {
    status: 202,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
