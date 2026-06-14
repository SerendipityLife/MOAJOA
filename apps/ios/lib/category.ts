import type { Ionicons } from '@expo/vector-icons';
import { placeVibe, VIBE_META, type Vibe } from '@moajoa/core';

// Vibe bucketing is owned by core's placeVibe (single source of truth, D2).
// Here we keep ONLY the iOS-specific surface: Ionicons glyph + tint/textOn shades
// per vibe. color + labelKo are pulled from the shared core token (VIBE_META).

export type { Vibe };

export type VibeStyle = {
  /** Strong color — icon + label-on-white. Shared token from core VIBE_META. */
  color: string;
  /** Darker shade for text on the light tint (readable chip text). */
  textOn: string;
  /** Light cover/chips surface. */
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKo: string;
};

export const VIBE_STYLE: Record<Vibe, VibeStyle> = {
  food: { color: VIBE_META.food.color, textOn: '#B45309', tint: '#FFF4E5', icon: 'restaurant', labelKo: VIBE_META.food.labelKo },
  cafe: { color: VIBE_META.cafe.color, textOn: '#6F4218', tint: '#F6EEE6', icon: 'cafe', labelKo: VIBE_META.cafe.labelKo },
  nature: { color: VIBE_META.nature.color, textOn: '#2E7D32', tint: '#E9F5EA', icon: 'leaf', labelKo: VIBE_META.nature.labelKo },
  culture: { color: VIBE_META.culture.color, textOn: '#3949AB', tint: '#ECEEF9', icon: 'camera', labelKo: VIBE_META.culture.labelKo },
  shopping: { color: VIBE_META.shopping.color, textOn: '#5D4037', tint: '#EFEAE8', icon: 'bag-handle', labelKo: VIBE_META.shopping.labelKo },
  other: { color: VIBE_META.other.color, textOn: '#1D4ED8', tint: '#F0F5FF', icon: 'location', labelKo: VIBE_META.other.labelKo },
};

export function vibeOf(category: string | null | undefined): Vibe {
  return placeVibe(category);
}
