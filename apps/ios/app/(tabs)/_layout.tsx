import { Tabs, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { Coachmark } from '@/components/onboarding/coachmark';

// Mozi식 가운데 ＋ FAB. 탭 슬롯 전체를 차지하되, 탭 전환 대신 새 보드 작성으로 보냄.
// 바 위로 살짝 띄우고(흰 링) 브랜드 그림자를 줘서 "떠 있는 주요 액션"으로 강조.
function NewBoardFab() {
  return (
    <Pressable
      onPress={() => router.push('/boards/new')}
      className="flex-1 items-center justify-center"
    >
      <View
        className="w-16 h-16 rounded-full bg-brand-500 items-center justify-center"
        style={{
          marginTop: -22,
          borderWidth: 4,
          borderColor: '#FFFFFF',
          shadowColor: '#2979FF',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <>
      <Tabs
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
          name="boards"
          options={{
            title: '내 여행',
            // 브랜드 틴트(활성 #1D4ED8 / 비활성 #94A3B8)를 그대로 받도록 color 전달 — 톤앤매너 일관 유지
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name="map-location-dot" solid color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: '둘러보기',
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name="compass" solid color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="new"
          options={{
            title: '',
            tabBarButton: () => <NewBoardFab />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: '내 친구',
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name="people-group" solid color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: '내 정보',
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name="person" solid color={color} size={size} />
            ),
          }}
        />
      </Tabs>
      <Coachmark />
    </>
  );
}
