import type { Ionicons } from '@expo/vector-icons';

// Google Places primary types are many; we bucket them into MOAJOA's 5 vibes
// (+ fallback) so a board's cards can wear one meaningful color/icon. Colors
// mirror packages/ui-tokens colors.category; tints are the light surface form.

export type Vibe = 'food' | 'nature' | 'culture' | 'wellness' | 'shopping' | 'other';

export type VibeStyle = {
  /** Strong color — icon + label-on-white. From ui-tokens colors.category. */
  color: string;
  /** Darker shade for text on the light tint (readable chip text). */
  textOn: string;
  /** Light cover/chips surface. */
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKo: string;
};

export const VIBE_STYLE: Record<Vibe, VibeStyle> = {
  food: { color: '#FF8F00', textOn: '#B45309', tint: '#FFF4E5', icon: 'restaurant', labelKo: '맛집' },
  nature: { color: '#43A047', textOn: '#2E7D32', tint: '#E9F5EA', icon: 'leaf', labelKo: '자연' },
  culture: { color: '#5C6BC0', textOn: '#3949AB', tint: '#ECEEF9', icon: 'camera', labelKo: '명소' },
  wellness: { color: '#26A69A', textOn: '#00897B', tint: '#E2F2F0', icon: 'sparkles', labelKo: '힐링' },
  shopping: { color: '#8D6E63', textOn: '#5D4037', tint: '#EFEAE8', icon: 'bag-handle', labelKo: '쇼핑' },
  other: { color: '#2979FF', textOn: '#1D4ED8', tint: '#F0F5FF', icon: 'location', labelKo: '장소' },
};

// Substring match against the raw Google primary type (e.g. "ramen_restaurant",
// "tourist_attraction"). Order matters — first hit wins.
const RULES: Array<[Vibe, string[]]> = [
  ['food', ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal', 'coffee', 'ramen', 'izakaya']],
  ['nature', ['park', 'natural', 'beach', 'mountain', 'zoo', 'aquarium', 'garden', 'forest', 'hiking']],
  ['culture', ['tourist', 'museum', 'art', 'temple', 'shrine', 'church', 'landmark', 'historical', 'castle', 'tower']],
  ['wellness', ['spa', 'gym', 'onsen', 'hot_spring', 'health', 'wellness']],
  ['shopping', ['store', 'shop', 'mall', 'market', 'boutique', 'department']],
];

export function vibeOf(category: string | null | undefined): Vibe {
  if (!category) return 'other';
  const c = category.toLowerCase();
  for (const [vibe, needles] of RULES) {
    if (needles.some((n) => c.includes(n))) return vibe;
  }
  return 'other';
}
