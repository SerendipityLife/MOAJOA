// apps/ios/components/plan/travel-mode-toggle.tsx
// Phase 18 (PLAN-04, D-08) — per-plan 3-segment travel-mode control (전철/도보/차).
// Default = 전철 (transit). Active segment uses the brand-50 tint + brand-600 label
// + brand glyph (UI-SPEC Color #4); inactive segments stay neutral. Toggling a mode
// re-grounds adjacent legs (handled by the parent: setTravelMode + regenerate).
import { Ionicons } from '@expo/vector-icons';
import { TravelMode, type TravelModeType } from '@moajoa/core';
import { Pressable, Text, View } from 'react-native';

const MODE_META: Record<
  TravelModeType,
  { labelKo: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  transit: { labelKo: '전철', icon: 'subway' },
  walk: { labelKo: '도보', icon: 'walk' },
  drive: { labelKo: '차', icon: 'car' },
};

interface Props {
  mode: TravelModeType;
  onChange: (mode: TravelModeType) => void;
  /** Disabled while a recompute/regenerate is in flight (double-tap guard). */
  disabled?: boolean;
}

export function TravelModeToggle({ mode, onChange, disabled }: Props) {
  return (
    <View className="flex-row rounded-xl bg-neutral-100 p-1">
      {TravelMode.map((m) => {
        const active = m === mode;
        const meta = MODE_META[m];
        return (
          <Pressable
            key={m}
            onPress={() => {
              if (!disabled && !active) onChange(m);
            }}
            disabled={disabled}
            className={`flex-1 flex-row items-center justify-center rounded-lg py-2 ${
              active ? 'bg-brand-50' : ''
            }`}
            style={{ minHeight: 44 }}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
          >
            <Ionicons
              name={meta.icon}
              size={15}
              color={active ? '#2563EB' : '#6B7280'}
              style={{ marginRight: 4 }}
            />
            <Text
              className={`text-xs ${
                active ? 'font-semibold text-brand-600' : 'text-neutral-500'
              }`}
            >
              {meta.labelKo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
