// apps/ios/lib/booking.ts
// Phase 20 (ATTR-02 / BOOK-03) — THE booking click handler: mint → open → log.
//
// Ordering is the whole point (D-14): the system-browser open fires IMMEDIATELY
// and the booking_clicks insert runs fire-and-forget BEHIND it. A slow or failed
// log must never delay or block the browser open (UI-SPEC Screen 4: click-log
// error state = NONE — silent).
//
// True system Safari (expo-linking openURL) is deliberate: the in-app
// SFSafariViewController family uses per-app ISOLATED cookie stores on iOS 11+,
// which would break cross-session affiliate attribution (RESEARCH Pitfall 2).
// Never import an in-app browser package here.
//
// URL assembly lives EXCLUSIVELY in @moajoa/core buildAffiliateUrl /
// buildDirectSearchUrl (17-02 Pitfall 1) — this file only feeds it env-injected
// account params (marker/trs — never hardcoded, T-20-10).
import { logBookingClick } from '@moajoa/api';
import { buildAffiliateUrl, buildDirectSearchUrl, ClickTokenSchema } from '@moajoa/core';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Trip-scoped context every click is attributed to (core BookingClickContext shape). */
export interface BookingContext {
  tripId: string;
  userId: string;
  placeId?: string | null;
}

function tpExtra(): Record<string, string | undefined> {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
}

/**
 * CSPRNG click token: 16 random bytes → 16 base62 chars (~95 bits of entropy).
 * Non-CSPRNG random sources are forbidden (T-20-04) — a predictable token
 * poisons attribution.
 */
export function mintClickToken(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  let body = '';
  for (const b of bytes) body += BASE62[b % 62];
  return ClickTokenSchema.parse(`c_${body}`);
}

/**
 * KKday needs either the dashboard deep-link template (p + campaign_id, Open Q1)
 * or the tp.st fallback short link. Neither wired → callers hide the KKday
 * button entirely (graceful hide — no dead button).
 */
export function kkdayAvailable(): boolean {
  const extra = tpExtra();
  return Boolean((extra.tpKkdayP && extra.tpKkdayCampaignId) || extra.tpKkdayFallback);
}

/**
 * Travelpayouts-attributed open (klook / kkday / airalo): mint token → open the
 * TRACKING url in system Safari → log in the background. The component calling
 * this never sees a URL (assembly knowledge stays isolated here + core).
 */
export async function openBooking(args: {
  program: 'klook' | 'kkday' | 'airalo';
  /** Fully-built destination URL (core buildSearchDestUrl / buildAiraloDestUrl output). */
  destUrl: string;
  ctx: BookingContext;
  checklistItemId?: string;
  /** Display name for dev-safety warnings only — no URL/copy derivation. */
  providerLabel: string;
}): Promise<void> {
  const extra = tpExtra();
  const marker = extra.tpMarker;
  if (!marker) {
    // Unwired dev env: opening an affiliate link without attribution would burn
    // real clicks with zero attribution — warn and stay closed instead.
    console.warn(
      `[booking] ${args.providerLabel} 열기 스킵 — EXPO_PUBLIC_TP_MARKER 미설정 (제휴 env 미배선)`,
    );
    return;
  }
  const productParams: Record<string, string> = {
    program: args.program,
    marker,
    dest: args.destUrl,
  };
  if (extra.tpTrs) productParams.trs = extra.tpTrs;
  if (args.program === 'kkday') {
    if (extra.tpKkdayP && extra.tpKkdayCampaignId) {
      productParams.p = extra.tpKkdayP;
      productParams.campaign_id = extra.tpKkdayCampaignId;
    } else if (extra.tpKkdayFallback) {
      productParams.fallback_base = extra.tpKkdayFallback;
    } else {
      // Callers pre-gate with kkdayAvailable(); this is the unwired-dev backstop.
      console.warn(
        `[booking] ${args.providerLabel} 열기 스킵 — KKday env(p/campaign_id 또는 fallback) 미설정`,
      );
      return;
    }
  }
  const token = mintClickToken();
  const url = buildAffiliateUrl('travelpayouts', productParams, token);
  // Open FIRST — never put an await between the tap and this line (D-14).
  Linking.openURL(url).catch(() => {});
  logBookingClick(supabase, {
    trip_id: args.ctx.tripId,
    place_id: args.ctx.placeId ?? null,
    user_id: args.ctx.userId,
    provider: args.program,
    click_token: token,
    checklist_item_id: args.checklistItemId ?? null,
  }).catch(() => {});
}

/**
 * D-05 non-affiliate stay search prefill (agoda / booking). Same open-first
 * ordering; logs provider '{name}_direct' — no revenue, but the click record
 * still drives the '확인함' checklist transition (RESEARCH).
 */
export async function openDirectSearch(args: {
  provider: 'agoda' | 'booking';
  params: { city: string; checkIn: string; checkOut: string };
  ctx: BookingContext;
  checklistItemId?: string;
}): Promise<void> {
  const token = mintClickToken();
  const url = buildDirectSearchUrl(args.provider, args.params);
  Linking.openURL(url).catch(() => {});
  logBookingClick(supabase, {
    trip_id: args.ctx.tripId,
    place_id: args.ctx.placeId ?? null,
    user_id: args.ctx.userId,
    provider: `${args.provider}_direct`,
    click_token: token,
    checklist_item_id: args.checklistItemId ?? null,
  }).catch(() => {});
}
