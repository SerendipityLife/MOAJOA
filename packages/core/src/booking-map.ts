// Phase 20 — D-09 static booking region mapping + D-06 compare-frame labels.
// Keys MUST stay aligned with CITY_KO_MAP (constants.ts) — 9 city codes. A city missing
// from this map means the caller hides the card entirely (mirrors CITY_KO_MAP's
// "missing → omit" contract). kr cities keep esimSlug/transport null on purpose:
// 국내여행에 유심·패스 추천은 억지 (D-09 억지 추천 금지).

/** One region's booking affordances. esimSlug is a PATH FRAGMENT only (e.g. 'japan-esim') —
 * booking.ts owns every domain literal and assembles it via buildAiraloDestUrl (Pitfall 1). */
export interface BookingRegionInfo {
  country: 'jp' | 'kr';
  esimSlug: string | null;
  transport: { labelKo: string; provider: 'klook' | 'kkday'; searchQuery: string } | null;
}

export const BOOKING_REGION_MAP: Readonly<Record<string, BookingRegionInfo>> = {
  tokyo: {
    country: 'jp',
    esimSlug: 'japan-esim',
    transport: { labelKo: 'JR 패스', provider: 'klook', searchQuery: 'JR 패스' },
  },
  osaka: {
    country: 'jp',
    esimSlug: 'japan-esim',
    transport: { labelKo: '간사이 패스', provider: 'klook', searchQuery: '간사이 패스' },
  },
  kyoto: {
    country: 'jp',
    esimSlug: 'japan-esim',
    transport: { labelKo: '간사이 패스', provider: 'klook', searchQuery: '간사이 패스' },
  },
  // 대표 패스 확신 없음 → transport null (억지 추천 금지 — D-09)
  fukuoka: { country: 'jp', esimSlug: 'japan-esim', transport: null },
  sapporo: { country: 'jp', esimSlug: 'japan-esim', transport: null },
  okinawa: { country: 'jp', esimSlug: 'japan-esim', transport: null },
  // kr: 국내여행 — eSIM/패스 카드 자체를 숨긴다.
  seoul: { country: 'kr', esimSlug: null, transport: null },
  busan: { country: 'kr', esimSlug: null, transport: null },
  jeju: { country: 'kr', esimSlug: null, transport: null },
} as const;

/**
 * D-06 compare-frame provider copy — core-owned so UI never hardcodes provider claims
 * (UI-SPEC Cross-Screen note). 한국인 일본여행 타깃 결. Copy locked by the phase's
 * Copywriting Contract; change HERE, never in a component.
 */
export const COMPARE_LABELS = {
  klook: '즉시확정·전세계 상품',
  kkday: '한국어 가이드 상품 강세',
  agoda: '아시아 숙소 강세',
  booking: '전 세계 숙소 폭넓게',
  airalo: 'eSIM 즉시 발급',
} as const;
