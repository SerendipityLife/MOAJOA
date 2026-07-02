// Single canonical vibe resolver (D2). Consolidates the duplicated, vibe-key-blind
// mappers in iOS (vibeOf) and web (categoryVisual). `places.category` stores a mix of
// Google primaryType strings (text-search places) and LLM vibe keys (maplink places)
// per D3 — so this resolver must recognize BOTH input shapes and normalize to 6 keys.

// D1 — exactly these 6 canonical vibes.
export type Vibe = 'food' | 'cafe' | 'nature' | 'culture' | 'shopping' | 'other';

const VIBE_KEYS = new Set<Vibe>(['food', 'cafe', 'nature', 'culture', 'shopping', 'other']);

// Substring match against a raw Google primary type (e.g. "ramen_restaurant",
// "tourist_attraction"). Order matters — first hit wins. cafe MUST precede food so
// 'coffee'/'bakery'/'cafe' aren't swallowed by the food bucket (D1 cafe split).
const RULES: Array<[Vibe, string[]]> = [
  ['cafe', ['cafe', 'coffee', 'bakery', 'dessert', 'tea']],
  ['food', ['restaurant', 'bar', 'food', 'meal', 'ramen', 'izakaya', 'pub']],
  ['nature', ['park', 'natural', 'beach', 'mountain', 'zoo', 'aquarium', 'garden', 'forest', 'hiking']],
  ['culture', ['tourist', 'museum', 'art', 'temple', 'shrine', 'church', 'landmark', 'historical', 'castle', 'tower', 'attraction']],
  ['shopping', ['store', 'shop', 'mall', 'market', 'boutique', 'department']],
  // wellness/spa/gym/onsen/hot_spring/lodging/hotel/health → no rule → 'other' (D1 collapse).
];

export function placeVibe(category: string | null | undefined): Vibe {
  if (!category) return 'other';
  const c = category.toLowerCase();
  if (VIBE_KEYS.has(c as Vibe)) return c as Vibe;
  for (const [vibe, needles] of RULES) {
    if (needles.some((n) => c.includes(n))) return vibe;
  }
  return 'other';
}

// why: color is a shared token (sharable across web/iOS), so it lives in core.
// Icons stay per-client (iOS Ionicons ≠ web lucide — different libraries).
// Hexes reuse the surviving iOS vibe colors; cafe is a new amber/coffee hex
// (#8D5A2B) deliberately distinct from food (#FF8F00) since cafe split out of food.
export const VIBE_META: Record<Vibe, { color: string; labelKo: string }> = {
  food: { color: '#FF8F00', labelKo: '맛집' },
  cafe: { color: '#8D5A2B', labelKo: '카페' },
  nature: { color: '#43A047', labelKo: '자연' },
  culture: { color: '#5C6BC0', labelKo: '명소' },
  shopping: { color: '#8D6E63', labelKo: '쇼핑' },
  other: { color: '#2979FF', labelKo: '기타' },
};

// Phase 20 (D-08) — bookability boundary for activity checklist/compare cards.
// culture-family places (attractions, museums, temples) are ticket-bookable; the theme-park
// family lands in 'nature' via the 'park'/'zoo'/'aquarium' needles above but IS bookable,
// so it gets an explicit needle list here. food/cafe/shopping stay structurally false.
const BOOKABLE_EXTRA = ['amusement', 'theme_park', 'aquarium', 'zoo', 'water_park'];

export function isBookableActivity(category: string | null | undefined): boolean {
  if (!category) return false;
  if (placeVibe(category) === 'culture') return true;
  const c = category.toLowerCase();
  return BOOKABLE_EXTRA.some((n) => c.includes(n));
}
