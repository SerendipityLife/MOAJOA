'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Mode = 'password' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/boards');
  }

  async function signUp() {
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`,
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    // With Confirm Email off, signUp returns a session immediately.
    router.replace('/boards');
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`,
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicSent(true);
  }

  async function oauth(provider: 'google' | 'apple') {
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-6 text-center">로그인</h1>

        {mode === 'magic' && magicSent ? (
          <div className="text-center">
            <p className="text-neutral-700 mb-4">
              <strong>{email}</strong>으로 로그인 링크를 보냈어요.
              <br />
              메일에서 링크를 클릭해 계속 진행해주세요.
            </p>
            <button
              onClick={() => {
                setMagicSent(false);
                setMode('password');
              }}
              className="text-brand-500 underline text-sm"
            >
              비밀번호로 로그인
            </button>
          </div>
        ) : mode === 'password' ? (
          <form onSubmit={signIn} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:border-brand-500 focus:outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {pending ? '...' : '로그인'}
              </button>
              <button
                type="button"
                onClick={signUp}
                disabled={pending || !email || password.length < 6}
                className="flex-1 py-3 border border-brand-500 text-brand-600 hover:bg-brand-50 rounded-lg font-medium disabled:opacity-50"
              >
                가입하기
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('magic');
              }}
              className="w-full text-center text-sm text-neutral-500 hover:text-brand-500 mt-1"
            >
              비밀번호 없이 메일 링크로 로그인
            </button>
          </form>
        ) : (
          // magic-link mode
          <form onSubmit={sendMagicLink} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !email}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {pending ? '...' : '메일로 로그인 링크 받기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('password');
              }}
              className="w-full text-center text-sm text-neutral-500 hover:text-brand-500 mt-1"
            >
              비밀번호로 로그인
            </button>
          </form>
        )}

        {error && <p className="text-danger text-sm mt-3 text-center">{error}</p>}

        <div className="my-6 flex items-center gap-3">
          <hr className="flex-1 border-neutral-200" />
          <span className="text-xs text-neutral-500">또는</span>
          <hr className="flex-1 border-neutral-200" />
        </div>

        <div className="space-y-2">
          <button
            onClick={() => oauth('google')}
            className="w-full py-3 border border-neutral-300 hover:bg-neutral-50 rounded-lg font-medium"
          >
            Google로 계속
          </button>
          <button
            onClick={() => oauth('apple')}
            className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-medium"
          >
            Apple로 계속
          </button>
        </div>
      </div>
    </main>
  );
}
