// apps/ios/components/plan/unplaced-pool.tsx
// Phase 18 (PLAN-02, D-09/D-13) — the 미배치 pool: places on the trip with NO
// plan_item row. Reuses the place-list.tsx card idiom but trades the drag handle
// for an explicit "일정에 추가" affordance (add-circle-outline brand-500 →
// moveToDay; explicit, not cross-zone drag). Coordinateless places (lat===0 &&
// lng===0) show the 위치 정보가 없어… helper and CANNOT be added (no auto-route).
import { Ionicons } from '@expo/vector-icons';
import type { Place } from '@moajoa/core';
import { Pressable, Text, View } from 'react-native';
import { vibeOf, VIBE_STYLE } from '@/lib/category';

const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

function isCoordinateless(p: Place): boolean {
  return p.lat === 0 && p.lng === 0;
}

interface Props {
  places: Place[];
  /** Append a pooled place to a day (D-13). */
  onAddToDay: (placeId: string) => void;
}

export function UnplacedPool({ places, onAddToDay }: Props) {
  if (places.length === 0) return null;
  const hasCoordinateless = places.some(isCoordinateless);

  return (
    // 32px (xl) gap + neutral-100 hairline separating placed days from the pool.
    <View className="mt-8 pt-6 border-t border-neutral-100">
      <Text className="text-xl font-semibold text-neutral-900">미배치</Text>
      <Text className="text-sm text-neutral-500 mt-1 mb-3">
        일정에 넣지 않은 장소예요. 추가하거나 그대로 둘 수 있어요.
      </Text>
      {hasCoordinateless && (
        <Text className="text-xs text-neutral-400 mb-3">위치 정보가 없어 자동 배치에서 빠졌어요.</Text>
      )}
      {places.map((place) => {
        const vibe = VIBE_STYLE[vibeOf(place.category)];
        const coordinateless = isCoordinateless(place);
        const subtitle = place.address ? `${vibe.labelKo} · ${place.address}` : vibe.labelKo;
        return (
          <View
            key={place.id}
            style={ROW_SHADOW}
            className="bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center"
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: vibe.tint }}
            >
              <Ionicons name={vibe.icon} size={18} color={vibe.color} />
            </View>
            <View className="flex-1 px-3">
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {place.name_ko ?? place.name_local}
              </Text>
              <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            {!coordinateless && (
              <Pressable
                onPress={() => onAddToDay(place.id)}
                hitSlop={8}
                className="w-11 h-11 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="일정에 추가"
              >
                <Ionicons name="add-circle-outline" size={22} color="#2979FF" />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}
