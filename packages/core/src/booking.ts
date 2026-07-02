import { z } from 'zod';

/** Trip-scoped click context — Phase 20 mints this into booking_clicks. placeId optional (D-04). */
export const BookingClickContextSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
});
export type BookingClickContext = z.infer<typeof BookingClickContextSchema>;

/** opaque click token. base62 only (Travelpayouts ∩ Stay22 charset). length 8-30 << 128 (Pitfall 5). */
export const ClickTokenSchema = z.string().regex(/^c_[0-9A-Za-z]{8,30}$/);
export type ClickToken = z.infer<typeof ClickTokenSchema>;

export const AffiliateProvider = ['travelpayouts', 'stay22'] as const;
export type AffiliateProviderType = (typeof AffiliateProvider)[number];

/**
 * Travelpayouts program structure constants (live-measured 2026-07-02, RESEARCH §검증된 딥링크 규격).
 * promo_id / p / campaign_id are PUBLIC program IDs — not account secrets — so they live in core
 * (RESEARCH Anti-pattern 5). marker/trs ARE account values: env-owned (CLAUDE.md §4.7), always
 * injected via productParams, never hardcoded here (T-20-10). kkday's dynamic template params
 * (p/campaign_id) come from the TP dashboard via env (Open Q1); until then callers pass a
 * fallback_base (tp.st short link, which supports a dynamic sub_id — live-verified).
 */
export const TP_PROGRAMS = {
  klook: { kind: 'click', host: 'c137.travelpayouts.com', promoId: '4110' },
  airalo: { kind: 'media', p: '8310', campaignId: '541' },
  kkday: { kind: 'media' },
} as const;
export type TpProgramKey = keyof typeof TP_PROGRAMS;

/** Required-param reader: a missing value must throw, never yield an "undefined" URL segment. */
function requireParam(params: Record<string, string>, key: string): string {
  const v = params[key];
  if (!v) throw new Error(`buildAffiliateUrl(travelpayouts): missing required param '${key}'`);
  return v;
}

/**
 * media-form redirect (tp.media/r) shared by airalo and kkday-with-template.
 * dest is encoded exactly ONCE here — callers pass a fully-built destination URL (Pitfall 7).
 */
function tpMediaUrl(
  marker: string,
  token: string,
  p: string,
  campaignId: string,
  dest: string,
  trs?: string,
): string {
  const trsPart = trs ? `&trs=${encodeURIComponent(trs)}` : '';
  return (
    `https://tp.media/r?marker=${encodeURIComponent(marker)}.${token}` +
    `&p=${encodeURIComponent(p)}&campaign_id=${encodeURIComponent(campaignId)}` +
    trsPart +
    `&u=${encodeURIComponent(dest)}&sub_id=${token}`
  );
}

/**
 * The ONLY helper that builds an affiliate deep link (hand assembly forbidden — Pitfall 1, D-06).
 * Phase 17 locks signature + token format + provider injection site; Phase 20 fills the
 * live-measured travelpayouts spec (marker-dot SubID + redundant sub_id param — RESEARCH
 * compatibility strategy). stay22 base/aid stays env-injected in a later phase.
 * Assembly uses URLSearchParams/encodeURIComponent only — manual escaping forbidden (T-20-01).
 */
export function buildAffiliateUrl(
  provider: AffiliateProviderType,
  productParams: Record<string, string>,
  subId: ClickToken,
): string {
  const token = ClickTokenSchema.parse(subId); // structurally guarantees a valid token is present
  if (provider === 'travelpayouts') {
    const { program, trs, p, campaign_id, fallback_base } = productParams;
    if (program === 'klook') {
      const prog = TP_PROGRAMS.klook;
      const marker = requireParam(productParams, 'marker');
      const dest = requireParam(productParams, 'dest');
      return (
        `https://${prog.host}/click?shmarker=${encodeURIComponent(marker)}.${token}` +
        `&promo_id=${prog.promoId}&source_type=customlink&type=click` +
        `&custom_url=${encodeURIComponent(dest)}&sub_id=${token}`
      );
    }
    if (program === 'airalo') {
      const prog = TP_PROGRAMS.airalo;
      return tpMediaUrl(
        requireParam(productParams, 'marker'),
        token,
        prog.p,
        prog.campaignId,
        requireParam(productParams, 'dest'),
        trs,
      );
    }
    if (program === 'kkday') {
      if (p && campaign_id) {
        return tpMediaUrl(
          requireParam(productParams, 'marker'),
          token,
          p,
          campaign_id,
          requireParam(productParams, 'dest'),
          trs,
        );
      }
      if (fallback_base) {
        // tp.st short link with dynamic sub_id append — live-verified. Caller pre-gates by
        // param presence (no canBuildKkday helper).
        return `${fallback_base}?sub_id=${token}`;
      }
      throw new Error(
        "buildAffiliateUrl(travelpayouts/kkday): needs p+campaign_id (dashboard template) or fallback_base (tp.st)",
      );
    }
    // No program key — 17-02 generic contract shape (sub_id always injected), kept so the
    // locked Phase 17 contract tests pass unchanged.
    const sp = new URLSearchParams({ ...productParams, sub_id: token });
    return `https://tp.media/r?${sp.toString()}`;
  }
  // stay22: fixed aid (Phase 20 env) + campaign carries the token + claimed domain.
  const sp = new URLSearchParams({ ...productParams, campaign: token });
  return `https://www.stay22.com/allez/PLACEHOLDER?${sp.toString()}`;
}

/**
 * Platform search-result destination URLs. This file is the SOLE owner of affiliate/platform
 * URL literals (17-02 Pitfall 1 grep guard). Klook/KKday search paths are [ASSUMED] (both sites
 * bot-block automated render checks — A1/A2); if device UAT lands wrong, fix HERE only.
 * The place-name query is encoded exactly once — the returned URL is then encoded as a whole
 * by buildAffiliateUrl when nested into custom_url/u (Pitfall 7).
 */
export function buildSearchDestUrl(platform: 'klook' | 'kkday', query: string): string {
  if (platform === 'klook') {
    return `https://www.klook.com/ko/search/result/?query=${encodeURIComponent(query)}`;
  }
  return `https://www.kkday.com/ko/product/productlist?keyword=${encodeURIComponent(query)}`;
}

/** Airalo destination from a BOOKING_REGION_MAP esimSlug (e.g. 'japan-esim') — live-verified. */
export function buildAiraloDestUrl(esimSlug: string): string {
  return `https://www.airalo.com/${encodeURIComponent(esimSlug)}`;
}

export const DirectSearchProvider = ['agoda', 'booking'] as const;
export type DirectSearchProviderType = (typeof DirectSearchProvider)[number];

/**
 * D-05 non-affiliate stay search prefill (agoda/booking). No attribution — but it lives in
 * this file so no caller ever hand-assembles a booking URL outside the single assembly seam
 * (CONTEXT ⚠️ / T-20-06 domain-isolation grep gate).
 */
export function buildDirectSearchUrl(
  provider: DirectSearchProviderType,
  params: { city: string; checkIn: string; checkOut: string },
): string {
  if (provider === 'agoda') {
    const sp = new URLSearchParams({
      textToSearch: params.city,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      rooms: '1',
      adults: '2',
    });
    return `https://www.agoda.com/ko-kr/search?${sp.toString()}`;
  }
  const sp = new URLSearchParams({
    ss: params.city,
    checkin: params.checkIn,
    checkout: params.checkOut,
    group_adults: '2',
    no_rooms: '1',
  });
  return `https://www.booking.com/searchresults.ko.html?${sp.toString()}`;
}
