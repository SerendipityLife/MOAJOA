import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#F97316',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="boards"
        options={{
          title: '보드',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmarks-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '둘러보기',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '내 정보',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
