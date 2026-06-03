import { Ionicons } from '@expo/vector-icons';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

// Finishes any pending web auth session — no-op on a fresh native launch, but
// required so WebBrowser.openAuthSessionAsync resolves reliably.
WebBrowser.maybeCompleteAuthSession();

const AUTH_REDIRECT = 'moajoa://auth-callback';

/**
 * Login screen (Phase 3 SAVE-01, UI-SPEC §6).
 *
 * Email + password is the primary flow; magic link is a toggle; Google is an
 * OAuth flow via the system browser. After sign-in we `router.replace('/')` and
 * let app/index.tsx route to /(tabs)/boards from the new session.
 *
 * Visual tone follows the MOAJOA design system (moajoa_total): white/airy
 * surface, MOAJOA-blue accent (#2979FF), gradient CTA, 12dp radii, brand mark
 * over a blue disc.
 *
 * NOTE: Google sign-in needs the Google provider enabled in the Supabase
 * dashboard (Google Cloud OAuth client). Until then signInWithOAuth returns
 * "provider is not enabled" — surfaced as a friendly inline message below.
 *
 * Sign-up is out of Phase 3 scope (SESSION-NOTES 2026-05-25); the copy renders
 * per UI-SPEC §6 but taps a placeholder until Phase 4.
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 틀려요';
  if (m.includes('email not confirmed') || m.includes('confirm your email'))
    return '이메일 확인 메일을 먼저 열어주세요';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'Google 로그인이 아직 설정되지 않았어요 (Supabase provider 설정 필요)';
  return message;
}

// Parse the OAuth redirect URL and establish a session. Handles both the PKCE
// (?code=) and implicit (#access_token=) shapes, so it works regardless of the
// supabase-js flowType default.
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return;
  }
  if (params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit() {
    if (!email.trim()) return;
    setInlineError(null);
    setPending(true);
    try {
      if (magicLinkMode) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: AUTH_REDIRECT },
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

  async function onGoogle() {
    setInlineError(null);
    setPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error) {
        setInlineError(mapAuthError(error.message));
        return;
      }
      if (!data?.url) {
        setInlineError('로그인 URL을 받지 못했어요');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
        router.replace('/');
      }
      // 'cancel' / 'dismiss' → user closed the sheet; stay on login.
    } catch (e) {
      setInlineError(mapAuthError(e instanceof Error ? e.message : '로그인에 실패했어요'));
    } finally {
      setPending(false);
    }
  }

  const submitDisabled = pending || !email || (!magicLinkMode && !password);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-16">
        {/* Brand header — blue disc mark + bold wordmark + tagline */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-full bg-brand-100 items-center justify-center mb-4">
            <Ionicons name="map-outline" size={30} color="#2979FF" />
          </View>
          <Text className="text-3xl font-extrabold tracking-wider text-brand-500">MOAJOA</Text>
          <Text className="mt-2 text-sm text-neutral-500">
            로그인하고 여행 정보를 공유해보세요
          </Text>
        </View>

        {magicLinkSent ? (
          <View className="items-center mt-4">
            <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center mb-3">
              <Ionicons name="mail-outline" size={26} color="#2979FF" />
            </View>
            <Text className="text-base text-neutral-700 text-center">메일을 확인해 주세요</Text>
          </View>
        ) : (
          <>
            {/* Email */}
            <View className="flex-row items-center border border-neutral-300 rounded-xl px-3 mb-3">
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="이메일"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 py-3.5 px-2 text-base text-neutral-900"
              />
            </View>

            {/* Password */}
            {!magicLinkMode && (
              <View className="flex-row items-center border border-neutral-300 rounded-xl px-3 mb-3">
                <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="비밀번호"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  className="flex-1 py-3.5 px-2 text-base text-neutral-900"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>
            )}

            {/* Primary CTA — solid MOAJOA-blue (design-system buttonPrimary) with a soft blue glow */}
            <Pressable
              onPress={onSubmit}
              disabled={submitDisabled}
              style={{
                marginTop: 8,
                opacity: submitDisabled ? 0.55 : 1,
                shadowColor: '#2979FF',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: submitDisabled ? 0 : 0.35,
                shadowRadius: 10,
              }}
              className="bg-brand-600 rounded-xl py-4 items-center"
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
              <Text className="mt-3 text-sm text-danger text-center">{inlineError}</Text>
            )}

            {/* Magic link toggle */}
            <Pressable
              onPress={() => {
                setMagicLinkMode((v) => !v);
                setInlineError(null);
              }}
              className="mt-5 items-center"
            >
              <Text className="text-sm font-medium text-brand-500">
                {magicLinkMode ? '비밀번호로 로그인' : '매직 링크로 로그인'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-5">
              <View className="flex-1 h-px bg-neutral-200" />
              <Text className="mx-3 text-xs text-neutral-400">또는</Text>
              <View className="flex-1 h-px bg-neutral-200" />
            </View>

            {/* Google OAuth */}
            <Pressable
              onPress={onGoogle}
              disabled={pending}
              style={{ opacity: pending ? 0.6 : 1 }}
              className="flex-row items-center justify-center border border-neutral-300 rounded-xl py-3.5"
            >
              <Ionicons name="logo-google" size={18} color="#111827" />
              <Text className="ml-2 text-base font-medium text-neutral-800">Google로 계속</Text>
            </Pressable>

            {/* Sign-up (placeholder until Phase 4) */}
            <Pressable
              onPress={() => setInlineError('회원가입은 곧 지원돼요')}
              className="mt-5 items-center"
            >
              <Text className="text-sm text-neutral-500">
                계정이 없으신가요? <Text className="font-medium text-neutral-700">회원가입</Text>
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
