/**
 * Google Maps place deep link for the public board's place detail.
 *
 * Uses the official Maps URLs API (no key, no quota):
 *   https://www.google.com/maps/search//?api=1&query=<text>&query_place_id=<id>
 * `query` is REQUIRED even when query_place_id is present (Maps URLs spec) —
 * the place id wins for resolution; the text is a fallback for stale ids.
 * On mobile this opens the Google Maps app's place card (photos/ratings/길찾기).
 *
 * Pure string builder — mirrors lib/marker-svg.ts isolation so the URL shape
 * is unit-testable without a browser.
 */
export function buildGoogleMapsPlaceUrl(
  name: string,
  googlePlaceId: string | null | undefined,
): string {
  const params = new URLSearchParams({ api: '1', query: name });
  if (googlePlaceId) params.set('query_place_id', googlePlaceId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
