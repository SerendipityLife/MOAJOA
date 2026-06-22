// Google Routes API (v2 REST) — adjacent-leg travel time grounding.
//
// Mirrors extract-youtube/pipeline/places.ts (Google-v1 fetch + X-Goog-Api-Key +
// X-Goog-FieldMask). We POST one computeRoutes request per adjacent pair (D-07).
//
// Cost guard (Pitfall 1): FieldMask is `routes.duration` ONLY — richer fields
// (legs, polyline) bump the request from the Essentials SKU to Pro. DRIVE uses
// TRAFFIC_UNAWARE so it stays in Essentials (TRAFFIC_AWARE → Pro). $0.005/call,
// 10k free/month (SKU 9EFF-679A-9B16).

export interface LatLng {
  lat: number;
  lng: number;
}

export type RoutesTravelMode = 'TRANSIT' | 'WALK' | 'DRIVE';

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** A coordinateless place (manual-add placeholder) coalesces to (0,0) — never
 * route from the Gulf of Guinea (Pitfall 4). Short-circuit before any fetch. */
function isNullIsland(p: LatLng): boolean {
  return p.lat === 0 && p.lng === 0;
}

/**
 * Compute the travel time of a single adjacent leg.
 * @returns integer seconds, or null on (0,0) endpoint / non-ok response / empty
 *          routes — the caller renders null as "이동시간 —" (best-effort).
 */
export async function computeRoutesLeg(
  o: LatLng,
  d: LatLng,
  mode: RoutesTravelMode,
  key: string,
): Promise<number | null> {
  if (isNullIsland(o) || isNullIsland(d)) return null;

  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
    destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
    travelMode: mode,
  };
  if (mode === 'TRANSIT') {
    body.transitPreferences = { routingPreference: 'LESS_WALKING' };
  }
  if (mode === 'DRIVE') {
    body.routingPreference = 'TRAFFIC_UNAWARE'; // STAY in Essentials (Pitfall 1)
  }

  let res: Response;
  try {
    res = await fetch(COMPUTE_ROUTES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration', // duration ONLY (Pitfall 1)
      },
      body: JSON.stringify(body),
    });
  } catch {
    return null; // network failure → best-effort null leg
  }

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const dur = data?.routes?.[0]?.duration; // "840s"
  if (!dur) return null;
  const secs = parseInt(String(dur).replace('s', ''), 10);
  return Number.isFinite(secs) ? secs : null;
}
