/**
 * Google Static Maps URL builder for OG image (per Phase 4 CONTEXT D-07).
 *
 * - Single `markers=` param with brand-500 color (0xF97316) + size:mid.
 * - Max 10 markers (truncated silently). No URL signing in v1 (D-07).
 * - No center/zoom → Google auto-fits to markers bbox.
 *
 * Source: https://developers.google.com/maps/documentation/maps-static/start
 */

export interface MarkerLatLng {
  lat: number;
  lng: number;
}

export interface BuildStaticMapsOpts {
  /** Up to 10 markers — extras silently truncated (D-07). */
  places: MarkerLatLng[];
  size: { width: number; height: number };
  /** Retina scale; defaults to 2. */
  scale?: 1 | 2;
  apiKey: string;
  /** Optional Style API params (e.g. grayscale, label hiding). */
  styleParams?: string[];
}

/**
 * Build a Google Static Maps URL with multiple markers in MOAJOA brand-500.
 * Throws if no places are provided (caller should fallback to text-only OG).
 */
export function buildStaticMapsUrl(opts: BuildStaticMapsOpts): string {
  const { places, size, scale = 2, apiKey, styleParams = [] } = opts;
  if (places.length === 0) {
    throw new Error('buildStaticMapsUrl: at least 1 place required');
  }

  const truncated = places.slice(0, 10);
  const markerStr =
    `color:0xF97316|size:mid|` +
    truncated.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');

  const params = new URLSearchParams({
    size: `${size.width}x${size.height}`,
    scale: scale.toString(),
    maptype: 'roadmap',
    key: apiKey,
  });
  params.append('markers', markerStr);

  for (const s of styleParams) {
    params.append('style', s);
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Subtle gray-tone style preset for OG image mini-map (per UI-SPEC §Color).
 * - Removes POI labels (less visual noise)
 * - Simplifies road labels
 * - Desaturates geometry (-60) so brand-500 markers pop
 */
export const OG_GRAYSCALE_STYLE: string[] = [
  'feature:poi|element:labels|visibility:off',
  'feature:road|element:labels|visibility:simplified',
  'feature:all|element:geometry|saturation:-60',
];
