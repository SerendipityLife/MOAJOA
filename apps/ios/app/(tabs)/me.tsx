import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MeTab() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-8">
        <Text className="text-2xl font-semibold mb-6">내 정보</Text>
        {email && <Text className="text-neutral-700 mb-6">{email}</Text>}
        <Pressable
          onPress={() => Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: signOut },
          ])}
          className="border border-neutral-300 rounded-lg py-3 items-center"
        >
          <Text className="text-neutral-700 font-medium">로그아웃</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
