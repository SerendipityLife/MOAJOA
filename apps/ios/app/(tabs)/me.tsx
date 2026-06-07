import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

/**
 * "내 정보" tab. Composition mirrors the MOAJOA design system (moajoa_total)
 * my screen: profile hero card → grouped menu section cards → logout. Badges
 * and the level chip are intentionally omitted (no gamification data yet).
 *
 * Sub-screens (profile edit, settings, help, legal) don't exist yet, so those
 * rows fall through to a "준비 중" placeholder until they're built.
 */

// Soft ambient card shadow used by the hero card and menu cards.
const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
};

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function MenuSection({ header, items }: { header: string; items: MenuItem[] }) {
  return (
    <View className="mb-6">
      <Text className="px-2 mb-2 text-xs font-extrabold tracking-[2px] text-neutral-400">
        {header}
      </Text>
      <View className="bg-white rounded-3xl overflow-hidden" style={cardShadow}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            className="flex-row items-center px-5 py-4 active:bg-brand-50"
          >
            <View className="w-10 h-10 rounded-xl bg-brand-50 items-center justify-center">
              <Ionicons name={item.icon} size={20} color="#2979FF" />
            </View>
            <Text className="flex-1 ml-4 text-base font-bold text-neutral-900">{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MeTab() {
  const [user, setUser] = useState<{ email: string; name: string; avatarUrl?: string } | null>(
    null,
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata ?? {};
      const email = u.email ?? '';
      setUser({
        email,
        name: meta.full_name || meta.name || (email ? email.split('@')[0] : '여행자'),
        avatarUrl: meta.avatar_url || meta.picture,
      });
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const soon = () => Alert.alert('준비 중', '곧 지원될 기능이에요');

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScrollView className="flex-1">
        <View className="px-5 pt-6 pb-24">
          <Text className="px-2 mb-4 text-2xl font-extrabold tracking-tight text-neutral-900">
            내 정보
          </Text>

          {/* Profile hero card */}
          <View className="bg-white rounded-3xl p-5 mb-7" style={cardShadow}>
            <View className="flex-row items-center">
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} className="w-20 h-20 rounded-full" />
              ) : (
                <View className="w-20 h-20 rounded-full bg-brand-500 items-center justify-center">
                  <Text className="text-white text-3xl font-bold">
                    {(user?.name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1 ml-4">
                <Text className="text-xl font-extrabold text-neutral-900" numberOfLines={1}>
                  {user?.name ?? '...'}
                </Text>
                <Text className="text-sm text-neutral-500 mt-0.5" numberOfLines={1}>
                  {user?.email ?? ''}
                </Text>
              </View>
              <Pressable
                onPress={soon}
                hitSlop={8}
                className="w-8 h-8 rounded-full bg-brand-50 items-center justify-center"
              >
                <Ionicons name="pencil" size={15} color="#2979FF" />
              </Pressable>
            </View>
          </View>

          {/* Menu sections (badges omitted per request) */}
          <MenuSection
            header="계정"
            items={[
              { icon: 'person-outline', label: '프로필', onPress: soon },
              { icon: 'settings-outline', label: '설정', onPress: soon },
            ]}
          />
          <MenuSection
            header="지원"
            items={[{ icon: 'help-circle-outline', label: '도움말', onPress: soon }]}
          />
          <MenuSection
            header="약관"
            items={[
              { icon: 'document-text-outline', label: '이용약관', onPress: soon },
              { icon: 'shield-checkmark-outline', label: '개인정보처리방침', onPress: soon },
            ]}
          />

          {/* Logout */}
          <Pressable
            onPress={() =>
              Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
                { text: '취소', style: 'cancel' },
                { text: '로그아웃', style: 'destructive', onPress: signOut },
              ])
            }
            className="flex-row items-center justify-center py-4 mt-1"
          >
            <Ionicons name="log-out-outline" size={16} color="#EF4444" />
            <Text className="ml-2 text-sm font-extrabold tracking-[2px] text-danger">로그아웃</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
