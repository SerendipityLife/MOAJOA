// apps/ios/app/trip/[id]/(tabs)/_layout.tsx
// Phase 17 (NAV-02) — trip-scoped 4-tab bottom navigation (UI-SPEC Screen 4).
// headerShown:false — the header is owned by the PARENT Stack (trip/[id]/_layout).
// Always-visible tab bar; NO FAB and NO "new" screen (new-trip is a header action,
// NAV-03). Default landing tab = plan (Claude's Discretion lock). The bar itself is
// rendered by the custom <TripTabBar> (active tab gets a soft-blue pill highlight);
// this file only declares the tab list + each tab's icon/title.
import { Tabs } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { TripTabBar } from '@/components/nav/trip-tab-bar';

export default function TripTabsLayout() {
  return (
    <Tabs
      // plan is the default landing tab (UI-SPEC Screen 4 + Screen 1).
      initialRouteName="plan"
      tabBar={(props) => <TripTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="map-location-dot" solid color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: '플랜',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="route" solid color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: '예약',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="cart-shopping" solid color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: '가계부',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="receipt" solid color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
