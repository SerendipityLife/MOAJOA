// apps/ios/app/trip/[id]/(tabs)/_layout.tsx
// Phase 17 (NAV-02) — trip-scoped 4-tab bottom navigation (UI-SPEC Screen 4).
// headerShown:false — the header is owned by the PARENT Stack (trip/[id]/_layout).
// Always-visible tab bar; NO FAB and NO "new" screen (new-trip is a header action,
// NAV-03). Default landing tab = plan (Claude's Discretion lock). Tab-bar style is
// copied VERBATIM from the old (tabs)/_layout.tsx (UI-SPEC Screen 4 locks it).
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

export default function TripTabsLayout() {
  return (
    <Tabs
      // plan is the default landing tab (UI-SPEC Screen 4 + Screen 1).
      initialRouteName="plan"
      screenOptions={{
        tabBarActiveTintColor: '#2979FF',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 6 },
        // 흰 바 + 헤어라인 + 부드러운 상단 그림자(테두리보다 떠 보이게).
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F3F5',
          borderTopWidth: StyleSheet.hairlineWidth,
          shadowColor: '#191C1E',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 8,
        },
      }}
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
            <FontAwesome6 name="bed" solid color={color} size={size} />
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
