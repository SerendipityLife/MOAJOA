import * as AppleAuthentication from 'expo-apple-authentication';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Finishes any pending web auth session — no-op on a fresh native launch, but
// required so WebBrowser.openAuthSessionAsync resolves reliably.
WebBrowser.maybeCompleteAuthSession();

export const AUTH_REDIRECT = 'moajoa://auth-callback';

/** Result of a social sign-in attempt. `ok` true → session established and the
 *  caller should route to '/'. `ok` false with no `error` → user cancelled
 *  (stay put, show nothing). `ok` false with `error` → show the message. */
export type SignInResult = { ok: boolean; error?: string };

export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 틀려요';
  if (m.includes('email not confirmed') || m.includes('confirm your email'))
    return '이메일 확인 메일을 먼저 열어주세요';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return '소셜 로그인이 아직 설정되지 않았어요 (Supabase provider 설정 필요)';
  return message;
}

// Parse the OAuth redirect URL and establish a session. Handles both the PKCE
// (?code=) and implicit (#access_token=) shapes, so it works regardless of the
// supabase-js flowType default.
export async function createSessionFromUrl(url: string) {
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

// Google OAuth via the system browser. Needs the Google provider enabled in the
// Supabase dashboard (Google Cloud OAuth client); until then signInWithOAuth
// returns "provider is not enabled" — surfaced via mapAuthError.
export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) return { ok: false, error: mapAuthError(error.message) };
    if (!data?.url) return { ok: false, error: '로그인 URL을 받지 못했어요' };
    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
    if (result.type === 'success' && result.url) {
      await createSessionFromUrl(result.url);
      return { ok: true };
    }
    // 'cancel' / 'dismiss' → user closed the sheet; treat as a silent no-op.
    return { ok: false };
  } catch (e) {
    return {
      ok: false,
      error: mapAuthError(e instanceof Error ? e.message : '로그인에 실패했어요'),
    };
  }
}

// Sign in with Apple — native sheet → identity token → Supabase. Needs the
// Apple provider enabled in the Supabase dashboard (Service ID + key). Requires
// a dev build that includes the expo-apple-authentication native module.
export async function signInWithApple(): Promise<SignInResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { ok: false, error: 'Apple 토큰을 받지 못했어요' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { ok: false, error: mapAuthError(error.message) };
    return { ok: true };
  } catch (e) {
    // User dismissed the native sheet → silent no-op (not an error to display).
    if (
      e instanceof Error &&
      'code' in e &&
      (e as { code?: string }).code === 'ERR_REQUEST_CANCELED'
    )
      return { ok: false };
    return { ok: false, error: 'Apple 로그인에 실패했어요' };
  }
}
