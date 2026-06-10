import { Tabs, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Coachmark } from '@/components/onboarding/coachmark';

// Mozi식 가운데 ＋ FAB. 탭 슬롯 전체를 차지하되, 탭 전환 대신 새 보드 작성으로 보냄.
function NewBoardFab() {
  return (
    <Pressable
      onPress={() => router.push('/boards/new')}
      className="flex-1 items-center justify-center"
    >
      <View
        className="w-14 h-14 rounded-full bg-brand-500 items-center justify-center"
        style={{
          shadowColor: '#2979FF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
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
          tabBarActiveTintColor: '#1D4ED8',
          tabBarInactiveTintColor: '#94A3B8',
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="boards"
          options={{
            title: '내 여행',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bookmarks-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: '둘러보기',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" color={color} size={size} />
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
              <Ionicons name="people-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: '내 정보',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
      <Coachmark />
    </>
  );
}
