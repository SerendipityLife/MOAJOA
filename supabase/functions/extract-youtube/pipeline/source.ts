// Shared source-adapter contract + SSRF guard.
//
// Every per-source adapter (youtube/blog/instagram) normalizes its fetch result
// into a single `SourceContent` shape so the index.ts router stays source-agnostic.
// `assertFetchableUrl` is the SSRF guard for any server-side fetch of a
// user-supplied URL (threat T-09-01) — kept pure (no DNS, no fetch, no env) so it
// is unit-testable offline.

import { z } from 'npm:zod@3';

/** Normalized output every adapter returns. `bodyText` → claude.ts `transcript`. */
export interface SourceContent {
  title: string;
  bodyText: string;
  thumbnail: string | null;
  author: string | null;
  externalId?: string | null;
}

export const SourceContentSchema = z.object({
  title: z.string(),
  bodyText: z.string(),
  thumbnail: z.string().nullable(),
  author: z.string().nullable(),
  externalId: z.string().nullable().optional(),
});

/** Injectable fetch seam — adapter tests pass a stub returning fixture HTML. */
export type FetchImpl = typeof fetch;

/**
 * SSRF guard. Parses `rawUrl`, rejects non-http(s) schemes and any hostname that
 * is a loopback / private / link-local / metadata IP literal (or `localhost`).
 * Pure (no DNS resolution) — string/regex parsing only, so it is offline-testable.
 * Returns the parsed URL on success; throws otherwise.
 */
export function assertFetchableUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`assertFetchableUrl: not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`assertFetchableUrl: protocol not allowed: ${url.protocol}`);
  }

  // IPv6 literals keep their brackets in URL.hostname — strip them for matching.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error(`assertFetchableUrl: localhost is not fetchable: ${host}`);
  }

  if (isPrivateIpLiteral(host)) {
    throw new Error(`assertFetchableUrl: private/loopback/link-local host blocked: ${host}`);
  }

  return url;
}

/** Classify four dotted-quad octets against private/loopback/link-local ranges. */
function isPrivateV4(a: number, b: number): boolean {
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local incl. 169.254.169.254 metadata
  if (a === 0) return true; // 0.0.0.0/8 "this network" — resolves to localhost on most stacks
  return false;
}

/** True if `host` is an IPv4/IPv6 literal in a private/loopback/link-local range. */
function isPrivateIpLiteral(host: string): boolean {
  // IPv4 dotted-quad.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if ([a, b, Number(v4[3]), Number(v4[4])].some((o) => o > 255)) return false;
    return isPrivateV4(a, b);
  }

  // Single-number / shorthand IPv4 forms the dotted-quad regex misses but the
  // OS resolver accepts: decimal (2130706433), hex (0x7f000001), octal
  // (017700000001), and partial forms like 127.1. WHATWG URL keeps these as
  // opaque hostnames, so without this branch they bypassed the guard.
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$/i.test(host)) {
    const parts = host.split('.').map((p) =>
      /^0x/i.test(p) ? parseInt(p, 16) : /^0\d/.test(p) ? parseInt(p, 8) : Number(p),
    );
    if (parts.some((n) => Number.isNaN(n))) return true; // unparseable numeric host → block
    // Expand to a 32-bit address per inet_aton: last part fills remaining bytes.
    let addr = 0;
    if (parts.length === 1) addr = parts[0];
    else {
      const last = parts[parts.length - 1];
      const heads = parts.slice(0, -1);
      if (heads.some((n) => n > 255)) return true;
      addr = heads.reduce((acc, n) => (acc << 8) + n, 0);
      addr = (addr << (8 * (4 - parts.length + 1))) + last;
    }
    addr = addr >>> 0;
    return isPrivateV4((addr >>> 24) & 0xff, (addr >>> 16) & 0xff);
  }

  // IPv6 literal (URL.hostname has brackets stripped).
  if (host.includes(':')) {
    if (host === '::1') return true; // loopback
    if (host === '::') return true; // unspecified
    // IPv4-mapped/compatible — classify the embedded v4 address instead of
    // letting it slide through. WHATWG URL canonicalizes `[::ffff:127.0.0.1]`
    // to hextet form `::ffff:7f00:1`, so match both spellings.
    const mappedDotted = host.match(/^::(?:ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
    if (mappedDotted) return isPrivateV4(Number(mappedDotted[1]), Number(mappedDotted[2]));
    const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      return isPrivateV4((hi >> 8) & 0xff, hi & 0xff);
    }
    // fc00::/7 unique-local — first byte 0xfc or 0xfd.
    const firstHextet = host.split(':')[0];
    if (firstHextet) {
      const n = parseInt(firstHextet, 16);
      if (!Number.isNaN(n)) {
        const firstByte = n >> 8;
        if (firstByte === 0xfc || firstByte === 0xfd) return true;
      }
    }
    // fe80::/10 link-local.
    if (/^fe[89ab]/i.test(host)) return true;
    return false;
  }

  return false;
}
