import {
  Beer,
  Building2,
  Coffee,
  Landmark,
  MapPin,
  ShoppingBag,
  TreePine,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/**
 * Google Places primaryType → row icon for the public board list.
 * Substring matching on purpose: Places emits granular types
 * (japanese_restaurant, coffee_shop, sushi_restaurant…) that all reduce to a
 * handful of visual buckets. Unknown/null → MapPin (neutral).
 */
const BUCKETS: { match: string[]; icon: LucideIcon; tone: string }[] = [
  { match: ['restaurant', 'food', 'meal'], icon: Utensils, tone: 'bg-orange-50 text-orange-700' },
  { match: ['cafe', 'coffee', 'bakery', 'dessert', 'tea'], icon: Coffee, tone: 'bg-amber-50 text-amber-700' },
  { match: ['bar', 'pub', 'izakaya', 'night'], icon: Beer, tone: 'bg-yellow-50 text-yellow-700' },
  { match: ['market', 'store', 'shopping', 'mall'], icon: ShoppingBag, tone: 'bg-emerald-50 text-emerald-700' },
  { match: ['park', 'garden', 'natural'], icon: TreePine, tone: 'bg-green-50 text-green-700' },
  { match: ['museum', 'tourist', 'temple', 'shrine', 'landmark', 'attraction'], icon: Landmark, tone: 'bg-violet-50 text-violet-700' },
  { match: ['lodging', 'hotel'], icon: Building2, tone: 'bg-sky-50 text-sky-700' },
];

export function categoryVisual(category: string | null | undefined): {
  icon: LucideIcon;
  tone: string;
} {
  const c = (category ?? '').toLowerCase();
  for (const b of BUCKETS) {
    if (b.match.some((m) => c.includes(m))) return { icon: b.icon, tone: b.tone };
  }
  return { icon: MapPin, tone: 'bg-brand-50 text-brand-700' };
}
