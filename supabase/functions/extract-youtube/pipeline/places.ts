// Google Places API (New) — Text Search for resolving extracted names to
// canonical place_id + coordinates.
//
// Uses the v1 endpoint with FieldMask to minimize cost.

export interface ResolvedPlace {
  placeId: string;
  displayName: string;
  displayNameEn: string | null;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  primaryType: string | null;
}

export interface ResolveResult extends ResolvedPlace {
  duration_ms: number;
}

export interface ResolveInputs {
  apiKey: string;
  query: string;
  /** BCP-47 language code, e.g. "ja", "ko", "en". Affects displayName language. */
  languageCode: string;
  /**
   * Optional region center for locationBias (50km circle). Disambiguates chain
   * stores by pulling the in-region branch instead of Google's globally most
   * relevant one. Omit → no bias (previous behavior).
   */
  lat?: number;
  lng?: number;
}

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
].join(',');

export async function resolveGooglePlace(inputs: ResolveInputs): Promise<ResolveResult | null> {
  const t0 = performance.now();
  const body: Record<string, unknown> = {
    textQuery: inputs.query,
    languageCode: inputs.languageCode,
    maxResultCount: 1,
  };
  if (inputs.lat !== undefined && inputs.lng !== undefined) {
    body.locationBias = {
      circle: {
        center: { latitude: inputs.lat, longitude: inputs.lng },
        radius: 50000,
      },
    };
  }
  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': inputs.apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`places api ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const place = data?.places?.[0];
  if (!place) return null;

  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  // Fetch the English name in a second call (optional — only if we need it for
  // bilingual display). Skipping for MVP cost: name_en stays null unless the
  // user explicitly switches locale and we re-query.
  return {
    placeId: place.id,
    displayName: place.displayName?.text ?? inputs.query,
    displayNameEn: null,
    formattedAddress: place.formattedAddress ?? null,
    lat,
    lng,
    primaryType: place.primaryType ?? null,
    duration_ms: Math.round(performance.now() - t0),
  };
}
