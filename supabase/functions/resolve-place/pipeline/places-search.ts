// resolve-place pipeline: Google Places API v1 Text Search with explicit FieldMask.
//
// Cloned from supabase/functions/extract-youtube/pipeline/places.ts but generalized:
// - maxResultCount = 5 (D-07: dropdown max 5 results)
// - returns array of normalized ResolvedPlace (not single)
// - optional locationBias from lat/lng (50km radius)
// - includes primaryType in mask (manual pin UI may show it in the future)
//
// Phase 2 D-12 lock: FieldMask is an explicit 5-field whitelist. No wildcard.

export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
].join(',');

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

export interface ResolvedPlace {
  google_place_id: string;
  displayName: string;
  formattedAddress: string | null;
  location: { lat: number; lng: number };
  primaryType: string | null;
}

export interface SearchOptions {
  query?: string;
  lat?: number;
  lng?: number;
  language: string;
}

export interface SearchResult {
  places: ResolvedPlace[];
  duration_ms: number;
}

export async function searchPlaces(opts: SearchOptions): Promise<SearchResult> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY');
  if (!apiKey) throw new Error('GOOGLE_PLACES_SERVER_KEY missing');

  const body: Record<string, unknown> = {
    languageCode: opts.language,
    maxResultCount: 5, // D-07
  };

  if (opts.query) {
    body.textQuery = opts.query;
  }

  if (opts.lat !== undefined && opts.lng !== undefined) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: 50000,
      },
    };
  }

  const t0 = performance.now();
  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places API failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { places?: unknown[] };
  const list = data?.places ?? [];
  const duration_ms = Math.round(performance.now() - t0);

  const normalized: ResolvedPlace[] = list
    .map((raw) => {
      const p = raw as Record<string, unknown>;
      const id = typeof p.id === 'string' ? p.id : '';
      const displayNameRaw = (p.displayName as Record<string, unknown> | undefined)?.text;
      const locationRaw = p.location as Record<string, unknown> | undefined;
      const lat = Number(locationRaw?.latitude ?? 0);
      const lng = Number(locationRaw?.longitude ?? 0);
      return {
        google_place_id: id,
        displayName: typeof displayNameRaw === 'string' ? displayNameRaw : '',
        formattedAddress:
          typeof p.formattedAddress === 'string' ? (p.formattedAddress as string) : null,
        location: { lat, lng },
        primaryType: typeof p.primaryType === 'string' ? (p.primaryType as string) : null,
      };
    })
    .filter((p) => p.google_place_id.length > 0); // drop malformed

  return { places: normalized.slice(0, 5), duration_ms };
}
