import {
  Coffee,
  Landmark,
  MapPin,
  ShoppingBag,
  TreePine,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { placeVibe, type Vibe } from '@moajoa/core';

/**
 * Vibe bucketing is owned by core's placeVibe (single source of truth, D2).
 * Here we keep ONLY the web-specific surface: the lucide icon + Tailwind tone
 * class per vibe (web uses lucide; iOS uses Ionicons — different libraries).
 */
const VIBE_VISUAL: Record<Vibe, { icon: LucideIcon; tone: string }> = {
  food: { icon: Utensils, tone: 'bg-orange-50 text-orange-700' },
  cafe: { icon: Coffee, tone: 'bg-amber-50 text-amber-700' },
  nature: { icon: TreePine, tone: 'bg-green-50 text-green-700' },
  culture: { icon: Landmark, tone: 'bg-violet-50 text-violet-700' },
  shopping: { icon: ShoppingBag, tone: 'bg-emerald-50 text-emerald-700' },
  other: { icon: MapPin, tone: 'bg-brand-50 text-brand-700' },
};

export function categoryVisual(category: string | null | undefined): {
  icon: LucideIcon;
  tone: string;
} {
  return VIBE_VISUAL[placeVibe(category)];
}
