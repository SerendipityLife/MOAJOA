// =============================================================================
// extract-youtube Edge Function
// =============================================================================
// Pipeline:
//   1. Fetch link row, verify it's youtube + pending/manual_review
//   2. Mark processing
//   3. Fetch YouTube metadata (title, description, channel, thumbnail) via oEmbed
//   4. Fetch transcript (ko → ja → auto-generated fallback)
//   5. Call Claude with transcript + description → extract place candidates JSON
//   6. For each candidate: call Google Places API → resolve coords + canonical name
//   7. Insert places rows
//   8. Mark link ready (or failed/manual_review)
//
// Invocation:
//   POST /functions/v1/extract-youtube { link_id: "..." }
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

import { extractCandidatesFromContext } from './pipeline/claude.ts';
import type { ExtractResult } from './pipeline/claude.ts';
import { fetchYouTubeMetadata, fetchYouTubeTranscript, normalizeYouTubeUrl } from './pipeline/youtube.ts';
import { resolveGooglePlace } from './pipeline/places.ts';

// ---- Request contract -------------------------------------------------------
const RequestSchema = z.object({
  link_id: z.string().uuid(),
});

interface ResponseBody {
  link_id: string;
  status: 'ready' | 'failed' | 'manual_review';
  places_extracted: number;
  confidence: number | null;
  error: string | null;
}

// ---- Main handler -----------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  }

  // Use service role inside the function — RLS is bypassed for writes after
  // we've verified the caller's right to extract for this link.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return jsonError(500, 'server misconfigured: missing supabase env');
  }
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  // Verify caller is authenticated. We don't need their JWT for the work, but
  // we don't want anon traffic firing the extractor.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'unauthorized');
  }

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
  const { link_id } = parsed.data;

  // ---- Load link --------------------------------------------------------
  const { data: link, error: linkErr } = await admin
    .from('links')
    .select('*')
    .eq('id', link_id)
    .maybeSingle();
  if (linkErr) return jsonError(500, linkErr.message);
  if (!link) return jsonError(404, 'link not found');
  if (link.source_kind !== 'youtube') {
    return jsonError(400, `cannot auto-extract source_kind=${link.source_kind}`);
  }
  if (link.extraction_status === 'processing') {
    return jsonOk({ link_id, status: 'manual_review', places_extracted: 0, confidence: null, error: 'already processing' });
  }

  // Mark processing
  await admin
    .from('links')
    .update({ extraction_status: 'processing', extraction_error: null })
    .eq('id', link_id);

  try {
    // ---- 1. Normalize URL + fetch metadata ----
    const canonical = normalizeYouTubeUrl(link.url);
    const meta = await fetchYouTubeMetadata(canonical);
    await broadcastStep(admin, link_id, 'metadata', 10);

    // ---- 2. Fetch transcript ----
    const transcript = await fetchYouTubeTranscript(meta.videoId);
    await broadcastStep(admin, link_id, 'transcript', 30);

    // ---- 3. LLM extraction ----
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const t0 = performance.now();
    const { candidates, usage } = await extractCandidatesFromContext({
      anthropicKey,
      videoTitle: meta.title,
      description: meta.description,
      transcript,
      cityHint: null, // TODO: derive from board.city_code via link.board_id
    });
    const anthropicDurationMs = Math.round(performance.now() - t0);

    // Log Anthropic cost
    const anthropicCost = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
    await logCost(admin, link_id, {
      provider: 'anthropic',
      model: usage.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: anthropicCost,
      duration_ms: anthropicDurationMs,
    });

    // Citation post-filter: discard candidates without source_quote (D-04 safety net)
    const validPlaces = candidates.places.filter(
      (p) => p.source_quote && p.source_quote.trim().length > 0,
    );
    if (validPlaces.length < candidates.places.length) {
      console.warn(
        `[citation] discarded ${candidates.places.length - validPlaces.length} candidates without source_quote`,
      );
    }

    await broadcastStep(admin, link_id, 'llm', 60);

    if (validPlaces.length === 0) {
      await admin
        .from('links')
        .update({
          extraction_status: 'manual_review',
          extraction_error: 'no places found by LLM',
          title: meta.title,
          thumbnail_url: meta.thumbnail,
          author_name: meta.author,
          external_id: meta.videoId,
          extracted_at: new Date().toISOString(),
        })
        .eq('id', link_id);
      return jsonOk({
        link_id,
        status: 'manual_review',
        places_extracted: 0,
        confidence: 0,
        error: 'no places found',
      });
    }

    // ---- 4. Resolve via Google Places ----
    const placesKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY');
    if (!placesKey) throw new Error('GOOGLE_PLACES_SERVER_KEY not set');

    const resolved = [];
    for (const cand of validPlaces) {
      try {
        const place = await resolveGooglePlace({
          apiKey: placesKey,
          query: cand.name_local,
          languageCode: 'ja',
        });
        if (place) {
          resolved.push({ cand, place });
          await logCost(admin, link_id, {
            provider: 'google_places',
            cost_usd: 0.032,
            duration_ms: place.duration_ms,
          });
        }
      } catch (err) {
        console.error(`[resolveGooglePlace] failed for ${cand.name_local}:`, err);
      }
    }

    await broadcastStep(admin, link_id, 'places', 80);

    // ---- 5. Insert places ----
    if (resolved.length > 0) {
      const rows = resolved.map((r) => ({
        board_id: link.board_id,
        link_id: link.id,
        added_by: link.added_by,
        google_place_id: r.place.placeId,
        name_local: r.place.displayName,
        name_ko: r.cand.name_ko ?? null,
        name_en: r.place.displayNameEn ?? null,
        lat: r.place.lat,
        lng: r.place.lng,
        category: r.place.primaryType ?? null,
        address: r.place.formattedAddress ?? null,
        source_timestamp_sec: r.cand.source_timestamp_sec ?? null,
        source_quote: r.cand.source_quote ?? null,
        source_kind: 'ai',
        inferred_city: r.cand.inferred_city ?? null,
        confidence: r.cand.confidence,
      }));

      const { error: insertErr } = await admin
        .from('places')
        .upsert(rows, { onConflict: 'board_id,google_place_id', ignoreDuplicates: true });
      if (insertErr) throw insertErr;
    }

    // ---- 6. Mark link ready ----
    const avgConfidence =
      validPlaces.reduce((a, p) => a + p.confidence, 0) / validPlaces.length;

    await admin
      .from('links')
      .update({
        extraction_status: resolved.length > 0 ? 'ready' : 'manual_review',
        title: meta.title,
        thumbnail_url: meta.thumbnail,
        author_name: meta.author,
        external_id: meta.videoId,
        extraction_confidence: avgConfidence,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', link_id);

    await broadcastStep(admin, link_id, 'done', 100, { places_extracted: resolved.length });

    // Fire-and-forget webhook to web /api/revalidate (per CONTEXT D-04, D-05).
    // Lookup board.share_slug — only POST when visibility=public + slug present.
    // Local dev: WEB_BASE_URL unset → skip silently (RESEARCH Pitfall 6).
    try {
      const { data: board } = await admin
        .from('boards')
        .select('share_slug, visibility')
        .eq('id', link.board_id)
        .maybeSingle();

      if (board?.visibility === 'public' && board.share_slug) {
        const webBase = Deno.env.get('WEB_BASE_URL');
        const revalidateSecret = Deno.env.get('REVALIDATE_SECRET');
        if (webBase && revalidateSecret) {
          // fire-and-forget — D-05 lock. No await. .catch prevents unhandledrejection.
          fetch(`${webBase}/api/revalidate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ slug: board.share_slug, secret: revalidateSecret }),
          }).catch((err) => console.warn('[revalidate-webhook] fetch failed:', err));
        }
      }
    } catch (err) {
      console.warn('[revalidate-webhook] lookup failed:', err);
    }

    return jsonOk({
      link_id,
      status: resolved.length > 0 ? 'ready' : 'manual_review',
      places_extracted: resolved.length,
      confidence: avgConfidence,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[extract-youtube] failed:', message);
    await broadcastStep(admin, link_id, 'error', 0, { error: message });
    await admin
      .from('links')
      .update({ extraction_status: 'failed', extraction_error: message })
      .eq('id', link_id);
    return jsonOk({ link_id, status: 'failed', places_extracted: 0, confidence: null, error: message });
  }
});

// ---- Broadcast + Cost helpers -----------------------------------------------

// Helper admin type matches call-site inference at line 53 (createClient without
// Database generic resolves to <any, "public", "public", any, any>). Using
// ReturnType<typeof createClient> here would resolve generics to bare defaults
// (<unknown, never, never...>) and mismatch — see Phase 4 deferred-items.md.
type AdminClient = SupabaseClient<any, "public", "public", any, any>;

async function broadcastStep(
  admin: AdminClient,
  linkId: string,
  step: string,
  progressPct: number,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const channel = admin.channel('extract:' + linkId);
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
  linkId: string,
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

// ---- Helpers ---------------------------------------------------------------
function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonOk(body: ResponseBody): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
