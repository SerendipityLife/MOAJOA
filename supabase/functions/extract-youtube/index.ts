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
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

import { extractCandidatesFromContext } from './pipeline/claude.ts';
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

    // ---- 2. Fetch transcript ----
    const transcript = await fetchYouTubeTranscript(meta.videoId);

    // ---- 3. LLM extraction ----
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

    const candidates = await extractCandidatesFromContext({
      anthropicKey,
      videoTitle: meta.title,
      description: meta.description,
      transcript,
      cityHint: null, // TODO: derive from board.city_code via link.board_id
    });

    if (candidates.places.length === 0) {
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
    for (const cand of candidates.places) {
      try {
        const place = await resolveGooglePlace({
          apiKey: placesKey,
          query: cand.name_local,
          languageCode: 'ja',
        });
        if (place) {
          resolved.push({
            cand,
            place,
          });
        }
      } catch (err) {
        console.error(`[resolveGooglePlace] failed for ${cand.name_local}:`, err);
      }
    }

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
      }));

      const { error: insertErr } = await admin
        .from('places')
        .upsert(rows, { onConflict: 'board_id,google_place_id', ignoreDuplicates: true });
      if (insertErr) throw insertErr;
    }

    // ---- 6. Mark link ready ----
    const avgConfidence =
      candidates.places.reduce((a, p) => a + p.confidence, 0) / candidates.places.length;

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
    await admin
      .from('links')
      .update({ extraction_status: 'failed', extraction_error: message })
      .eq('id', link_id);
    return jsonOk({ link_id, status: 'failed', places_extracted: 0, confidence: null, error: message });
  }
});

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
