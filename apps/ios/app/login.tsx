import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendMagicLink() {
    if (!email) return;
    setPending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'moajoa://auth-callback' },
    });
    setPending(false);
    if (error) {
      Alert.alert('로그인 실패', error.message);
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-2xl font-semibold text-neutral-900 mb-8 text-center">
          MOAJOA 로그인
        </Text>

        {sent ? (
          <View className="items-center">
            <Text className="text-neutral-700 mb-4 text-center">
              {email}으로 로그인 링크를 보냈어요.{'\n'}메일에서 링크를 눌러주세요.
            </Text>
            <Pressable onPress={() => router.replace('/')}>
              <Text className="text-brand-500 underline">처음으로</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="이메일 주소"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="border border-neutral-300 rounded-lg px-4 py-3 text-base mb-3"
            />
            <Pressable
              onPress={sendMagicLink}
              disabled={pending || !email}
              className="bg-brand-500 rounded-lg py-3 items-center disabled:opacity-50"
            >
              <Text className="text-white font-medium">
                {pending ? '...' : '메일로 로그인'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
