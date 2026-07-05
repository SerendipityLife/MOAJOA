// =============================================================================
// inbound-email — Cloudflare Email Worker (Phase 21, RESEARCH Pattern 1)
// =============================================================================
// A DELIBERATELY THIN Worker: it forwards the raw MIME + envelope meta to our
// Supabase `inbound-email` Edge Function and does nothing else. It holds NO DB
// credentials and NO LLM keys — only the EF URL and the shared ingest secret
// (both injected by `wrangler secret put` / vars, never committed). All parsing,
// matching, and storage happen server-side in the EF (T-21-17).
//
// Deploy: `wrangler deploy`, then point a Cloudflare Email Routing rule at this
// Worker (catch-all on the apex zone, or the ledger subdomain — decided at
// deploy time against the live CF dashboard).
// =============================================================================

interface Env {
  /** Supabase inbound-email EF URL, e.g. https://<ref>.supabase.co/functions/v1/inbound-email */
  INBOUND_EF_URL: string;
  /** Shared secret — must equal the EF's INGEST_SECRET (wrangler secret put). */
  INGEST_SECRET: string;
}

// Minimal shape of Cloudflare's ForwardableEmailMessage (avoids a build-time
// dependency on @cloudflare/workers-types for this single handler).
interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
}

const MAX_RAW_BYTES = 5_000_000; // DoS guard (T-21-16) — reject oversized mail

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    // ---- Size guard: reject before reading the stream (T-21-16). ------------
    if (message.rawSize > MAX_RAW_BYTES) {
      message.setReject('message too large');
      return;
    }

    const raw = await new Response(message.raw).text();

    // ---- Forward raw + envelope to the EF, secret in the header. ------------
    await fetch(env.INBOUND_EF_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-secret': env.INGEST_SECRET,
      },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        rawSize: message.rawSize,
        raw,
      }),
    });
  },
};
