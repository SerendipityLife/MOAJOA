// apps/ios/components/nav/trip-tab-bar.tsx
// Custom bottom tab bar for the trip tabs. Replaces the default Expo Tabs bar so
// the active tab can carry a soft-blue pill highlight behind its icon+label — a
// treatment tabBarActiveTintColor alone can't express. The tab list, routes, and
// each tab's icon/title stay declared in (tabs)/_layout.tsx; this only renders them.
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// expo-router vendors @react-navigation/bottom-tabs and does not re-export
// BottomTabBarProps from its top-level entry, so derive the exact prop type from
// the public <Tabs> tabBar prop — this guarantees it matches the vendored version.
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Verbatim from the previous tab bar (active/inactive tint + hairline/shadow) plus
// the finalized Pencil design's soft-blue pill: active = brand-500, inactive =
// neutral-400, pill = brand-100-ish surface.
const ACTIVE = '#2979FF';
const INACTIVE = '#9CA3AF';
const PILL = '#E9F0FF';

export function TripTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View className="flex-row items-center pt-2">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? ACTIVE : INACTIVE;
          const label = options.title ?? route.name;

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }

          return (
            <View key={route.key} className="flex-1 items-center">
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                className="items-center px-5 py-2 rounded-2xl active:opacity-70"
                style={focused ? { backgroundColor: PILL } : undefined}
              >
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                <Text
                  className="text-[11px] font-semibold mt-1"
                  style={{ color }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F1F3F5',
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
});
