// apps/ios/components/plan/day-section.tsx
// Phase 18 (PLAN-02) — one Day's ordered rows with hand-rolled long-press drag
// reorder (RESEARCH Open Q1 decision: gesture-handler + Reanimated 4, zero new
// dep; NOT react-native-draggable-flatlist / Pitfall 3). Header = "Day N" +
// date sublabel. Between adjacent rows: a <LegPill> (D-04/D-07). On drop, calls
// onReorder(itemId, toIndex) so the parent persists sort_order (reorderPlanItem)
// and re-grounds the ≤2 affected legs on the next regenerate.
//
// Drag model: a long-press (250ms) lifts the pressed row; a vertical pan
// translates it; the target slot is computed from translationY / ROW_HEIGHT.
// Placed↔pool is NOT drag — it is the explicit 제거 / 일정에 추가 affordance (D-13).
import { Ionicons } from '@expo/vector-icons';
import type { Place } from '@moajoa/core';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { LegPill, PlanItemRow } from './plan-item-row';

// Approximate placed-row height (card py-3 + name/subtitle + mb-2.5 + leg pill).
// Used only to map a drag's translationY → a slot delta; exact layout isn't
// needed because reorder is index-based, not pixel-snapped.
const ROW_HEIGHT = 96;

export interface DayItem {
  /** plan_item id (drag/reorder key). */
  itemId: string;
  place: Place;
  isAnchor: boolean;
  /** Travel seconds INTO this item from the previous same-day item (null = —). */
  legSeconds: number | null;
}

interface Props {
  dayIndex: number;
  /** YYYY-MM-DD for this day (computed from trip start_date), or null. */
  dateLabel: string | null;
  items: DayItem[];
  modeIcon: keyof typeof Ionicons.glyphMap;
  /** Persist a drag reorder: move itemId to toIndex within this day. */
  onReorder: (itemId: string, toIndex: number) => void;
  onToggleAnchor: (itemId: string, next: boolean) => void;
  onRemove: (itemId: string) => void;
}

function DraggableRow({
  item,
  index,
  count,
  modeIcon,
  onReorder,
  onToggleAnchor,
  onRemove,
}: {
  item: DayItem;
  index: number;
  count: number;
  modeIcon: keyof typeof Ionicons.glyphMap;
  onReorder: (itemId: string, toIndex: number) => void;
  onToggleAnchor: (itemId: string, next: boolean) => void;
  onRemove: (itemId: string) => void;
}) {
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      lifted.value = 1;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const slots = Math.round(e.translationY / ROW_HEIGHT);
      let target = index + slots;
      if (target < 0) target = 0;
      if (target > count - 1) target = count - 1;
      if (target !== index) {
        runOnJS(onReorder)(item.itemId, target);
      }
      translateY.value = 0;
      lifted.value = 0;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: lifted.value ? 10 : 0,
    opacity: lifted.value ? 0.92 : 1,
  }));

  return (
    <View>
      {index > 0 && <LegPill legSeconds={item.legSeconds} modeIcon={modeIcon} />}
      <GestureDetector gesture={drag}>
        <Animated.View style={animStyle}>
          <PlanItemRow
            place={item.place}
            isAnchor={item.isAnchor}
            onToggleAnchor={() => onToggleAnchor(item.itemId, !item.isAnchor)}
            onRemove={() => onRemove(item.itemId)}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function DaySection({
  dayIndex,
  dateLabel,
  items,
  modeIcon,
  onReorder,
  onToggleAnchor,
  onRemove,
}: Props) {
  return (
    <View className="mt-6">
      <View className="flex-row items-baseline mb-2.5">
        <Text className="text-sm font-semibold text-neutral-900">Day {dayIndex + 1}</Text>
        {dateLabel && <Text className="text-xs text-neutral-500 ml-2">{dateLabel}</Text>}
      </View>
      {items.map((item, index) => (
        <DraggableRow
          key={item.itemId}
          item={item}
          index={index}
          count={items.length}
          modeIcon={modeIcon}
          onReorder={onReorder}
          onToggleAnchor={onToggleAnchor}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}
