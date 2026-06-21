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
 * The ONLY helper that builds an affiliate deep link (hand assembly forbidden — Pitfall 1, D-06).
 * Phase 17 locks signature + token format + provider injection site. Real base URLs / marker IDs /
 * aid are injected from env in Phase 20; PLACEHOLDER tokens mark those slots.
 */
export function buildAffiliateUrl(
  provider: AffiliateProviderType,
  productParams: Record<string, string>,
  subId: ClickToken,
): string {
  const token = ClickTokenSchema.parse(subId); // structurally guarantees a valid token is present
  if (provider === 'travelpayouts') {
    const sp = new URLSearchParams({ ...productParams, sub_id: token });
    return `https://tp.st/PLACEHOLDER?${sp.toString()}`;
  }
  // stay22: fixed aid (Phase 20 env) + campaign carries the token + claimed domain.
  const sp = new URLSearchParams({ ...productParams, campaign: token });
  return `https://www.stay22.com/allez/PLACEHOLDER?${sp.toString()}`;
}
