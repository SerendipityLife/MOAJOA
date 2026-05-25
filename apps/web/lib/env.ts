/**
 * Centralized env access for the web app.
 * NEXT_PUBLIC_* vars are inlined at build time — these checks happen at
 * compile time for static optimization, not runtime.
 *
 * Strict === '1' check: '0', 'true', 'false', undefined all evaluate to false.
 * Fail-safe default = gate-closed.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1';
}

/**
 * Server-only — DO NOT inline in client bundles.
 * Used by /api/revalidate to timing-safe compare against webhook body.
 * MUST NOT be prefixed NEXT_PUBLIC_* (Next.js inlines those in client bundle).
 */
export function getRevalidateSecret(): string | null {
  return process.env.REVALIDATE_SECRET ?? null;
}

/**
 * Absolute base URL without trailing slash.
 * Used for metadataBase + Edge Function webhook target.
 * Falls back to http://localhost:3000 in dev/test.
 */
export function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * Google Maps API key — same key is reused for both Maps JS (browser) and
 * Static Maps (server-side OG image generation). v1 lock per Phase 4 D-19.
 */
export function getGoogleMapsKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
}
