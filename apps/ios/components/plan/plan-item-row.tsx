// apps/ios/components/plan/plan-item-row.tsx
// Phase 18 (PLAN-02/03/04) — one placed place inside a day, mirroring the
// place-list.tsx card (white rounded-2xl + ROW_SHADOW + vibe-tinted leading icon +
// text-sm/600 name + text-xs neutral-500 category·address). Adds the editing
// affordances per UI-SPEC State D/E:
//   - a reorder-three drag handle (neutral-400, ≥44px hit) — drag is owned by the
//     parent DaySection (gesture-handler + Reanimated 4, hand-rolled per RESEARCH
//     Open Q1); this row just exposes the handle + an onDrag(translationY) hook.
//   - a 필수 star (set = filled brand star + 필수 tag; unset = neutral-400 outline → setAnchor)
//   - a 제거 glyph (#EF4444 → moveToPool; reversible, returns to 미배치 pool, D-13)
// The leg pill BETWEEN adjacent same-day rows is the separate <LegPill> export below.
import { Ionicons } from '@expo/vector-icons';
import type { Place } from '@moajoa/core';
import { Pressable, Text, View } from 'react-native';
import { vibeOf, VIBE_STYLE } from '@/lib/category';

// Same opacity-light card shadow as place-list.tsx (visual continuity).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

interface Props {
  place: Place;
  isAnchor: boolean;
  /** Toggle 필수 anchor (D-10) — does NOT recluster until regenerate. */
  onToggleAnchor: () => void;
  /** 제거 → return to 미배치 pool (D-13, reversible). */
  onRemove: () => void;
}

export function PlanItemRow({ place, isAnchor, onToggleAnchor, onRemove }: Props) {
  const vibe = VIBE_STYLE[vibeOf(place.category)];
  const subtitle = place.address ? `${vibe.labelKo} · ${place.address}` : vibe.labelKo;

  return (
    <View style={ROW_SHADOW} className="bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center">
      {/* Drag handle — long-press + drag owned by DaySection. */}
      <View
        className="w-11 h-11 items-center justify-center -ml-1"
        accessibilityLabel="순서 변경 손잡이"
      >
        <Ionicons name="reorder-three" size={22} color="#9CA3AF" />
      </View>

      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: vibe.tint }}
      >
        <Ionicons name={vibe.icon} size={18} color={vibe.color} />
      </View>

      <View className="flex-1 px-3">
        <View className="flex-row items-center">
          <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
            {place.name_ko ?? place.name_local}
          </Text>
          {isAnchor && (
            <View className="flex-row items-center ml-2 px-1.5 py-0.5 rounded-full bg-brand-50">
              <Ionicons name="star" size={9} color="#2563EB" />
              <Text className="text-[10px] text-brand-600 ml-0.5">필수</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {/* 필수 star toggle */}
      <Pressable
        onPress={onToggleAnchor}
        hitSlop={8}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={isAnchor ? '필수 장소 해제' : '필수 장소로 지정'}
      >
        <Ionicons
          name={isAnchor ? 'star' : 'star-outline'}
          size={20}
          color={isAnchor ? '#2979FF' : '#9CA3AF'}
        />
      </Pressable>

      {/* 제거 → 미배치 */}
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        className="w-11 h-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="미배치로 보내기"
      >
        <Ionicons name="remove-circle-outline" size={20} color="#EF4444" />
      </Pressable>
    </View>
  );
}

interface LegPillProps {
  /** Travel seconds for the leg into the NEXT item; null → "이동시간 —". */
  legSeconds: number | null;
  /** Active travel mode glyph. */
  modeIcon: keyof typeof Ionicons.glyphMap;
}

/**
 * The centered travel-time pill between two adjacent same-day rows (D-04/D-07).
 * Present = brand-50 stadium chip + brand-600 "{n}분"; null/failed = neutral
 * "이동시간 —" (RESEARCH A1/A2 — null legs render gracefully).
 */
export function LegPill({ legSeconds, modeIcon }: LegPillProps) {
  const present = legSeconds != null;
  const minutes = present ? Math.max(1, Math.round(legSeconds / 60)) : null;
  return (
    <View className="items-center mb-2.5">
      <View
        className={`flex-row items-center px-2.5 py-1 rounded-full ${
          present ? 'bg-brand-50' : 'bg-neutral-100'
        }`}
      >
        <Ionicons
          name={present ? modeIcon : 'time-outline'}
          size={11}
          color={present ? '#2563EB' : '#9CA3AF'}
        />
        <Text
          className={`text-xs ml-1 ${present ? 'text-brand-600' : 'text-neutral-400'}`}
        >
          {present ? `${minutes}분` : '이동시간 —'}
        </Text>
      </View>
    </View>
  );
}
