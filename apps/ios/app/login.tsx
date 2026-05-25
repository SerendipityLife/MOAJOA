import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

/**
 * Login screen (Phase 3 SAVE-01, UI-SPEC §6).
 *
 * Email + password is the primary flow. Magic link is a toggle. After a
 * successful sign-in we `router.replace('/')` and let app/index.tsx redirect
 * to /(tabs)/boards based on the new session.
 *
 * Sign-up itself is out of Phase 3 scope (SESSION-NOTES 2026-05-25) — the
 * "계정이 없으신가요? 회원가입" copy is rendered per UI-SPEC §6 but the tap
 * target is wired to a placeholder error until Phase 4 picks it up.
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 틀려요';
  if (m.includes('email not confirmed') || m.includes('confirm your email'))
    return '이메일 확인 메일을 먼저 열어주세요';
  return message;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function onSubmit() {
    if (!email.trim()) return;
    setInlineError(null);
    setPending(true);
    try {
      if (magicLinkMode) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: 'moajoa://auth-callback' },
        });
        if (error) {
          setInlineError(mapAuthError(error.message));
          return;
        }
        setMagicLinkSent(true);
      } else {
        if (!password) return;
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setInlineError(mapAuthError(error.message));
          return;
        }
        router.replace('/');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="items-center mt-16 mb-12">
        <Text className="text-2xl font-semibold text-neutral-900">MOAJOA</Text>
      </View>

      {magicLinkSent ? (
        <View className="px-6 items-center">
          <Text className="text-sm text-neutral-700 text-center">
            메일을 확인해 주세요
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="mx-6 border border-neutral-300 rounded-lg px-3 py-3 text-base mb-3"
          />

          {!magicLinkMode && (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              className="mx-6 border border-neutral-300 rounded-lg px-3 py-3 text-base mb-3"
            />
          )}

          <Pressable
            onPress={onSubmit}
            disabled={pending || !email || (!magicLinkMode && !password)}
            className="mx-6 bg-brand-500 px-4 py-3 rounded-lg items-center mt-2 disabled:opacity-50"
          >
            <Text className="text-white text-base font-semibold">
              {pending
                ? magicLinkMode
                  ? '링크 받는 중...'
                  : '로그인 중...'
                : magicLinkMode
                  ? '링크 받기'
                  : '로그인'}
            </Text>
          </Pressable>

          {inlineError && (
            <Text className="mx-6 mt-2 text-sm text-danger">{inlineError}</Text>
          )}

          <Pressable
            onPress={() => {
              setMagicLinkMode((v) => !v);
              setInlineError(null);
            }}
            className="mt-4 items-center"
          >
            <Text className="text-sm text-brand-500">
              {magicLinkMode ? '비밀번호로 로그인' : '매직 링크로 로그인'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setInlineError('회원가입은 곧 지원돼요')}
            className="mt-2 items-center"
          >
            <Text className="text-sm text-neutral-500">계정이 없으신가요? 회원가입</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}
