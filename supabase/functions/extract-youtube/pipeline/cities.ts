// City center coordinates for Google Places locationBias.
//
// why: a chain name like "一蘭" / "이치란 라멘" Text-Searched without a geographic
// bias returns Google's globally most-relevant branch (e.g. 후쿠오카 신구점) even
// for a Tokyo/Sapporo trip. Biasing the search to the place's region pulls the
// correct branch. Per-place inferred_city wins (multi-city boards), then the
// board's city_code as fallback.
//
// Deno can't import the @moajoa/core workspace package, so the key set is kept
// in sync with CITY_KO_MAP in packages/core/src/constants.ts.

export interface LatLng {
  lat: number;
  lng: number;
}

const CITY_CENTERS: Readonly<Record<string, LatLng>> = {
  tokyo: { lat: 35.6762, lng: 139.6503 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  seoul: { lat: 37.5665, lng: 126.978 },
  busan: { lat: 35.1796, lng: 129.0756 },
  jeju: { lat: 33.4996, lng: 126.5312 },
  fukuoka: { lat: 33.5904, lng: 130.4017 },
  sapporo: { lat: 43.0618, lng: 141.3545 },
  okinawa: { lat: 26.2124, lng: 127.6809 },
};

// inferred_city arrives as free text from the LLM ("Tokyo", "도쿄", "Shinjuku, Tokyo").
// Match a known city as a substring of the lowercased input so "Tokyo" and the
// Korean alias both resolve. Returns null when nothing matches → no bias (the
// previous behavior, preserved for unsupported regions).
const KO_ALIAS: Readonly<Record<string, string>> = {
  도쿄: 'tokyo',
  오사카: 'osaka',
  교토: 'kyoto',
  서울: 'seoul',
  부산: 'busan',
  제주: 'jeju',
  후쿠오카: 'fukuoka',
  삿포로: 'sapporo',
  오키나와: 'okinawa',
};

export function cityCenter(input: string | null | undefined): LatLng | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  for (const key of Object.keys(CITY_CENTERS)) {
    if (lower.includes(key)) return CITY_CENTERS[key];
  }
  for (const [alias, key] of Object.entries(KO_ALIAS)) {
    if (input.includes(alias)) return CITY_CENTERS[key];
  }
  return null;
}
