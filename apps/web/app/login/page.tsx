'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
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
    setSent(true);
  }

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`,
      },
    });
  }

  async function signInWithApple() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-6 text-center">로그인</h1>

        {sent ? (
          <div className="text-center">
            <p className="text-neutral-700 mb-4">
              <strong>{email}</strong>으로 로그인 링크를 보냈어요.
              <br />
              메일에서 링크를 클릭해 계속 진행해주세요.
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-brand-500 underline text-sm"
            >
              메인으로 돌아가기
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {pending ? '...' : '메일로 로그인'}
              </button>
            </form>

            {error && <p className="text-danger text-sm mt-3 text-center">{error}</p>}

            <div className="my-6 flex items-center gap-3">
              <hr className="flex-1 border-neutral-200" />
              <span className="text-xs text-neutral-500">또는</span>
              <hr className="flex-1 border-neutral-200" />
            </div>

            <div className="space-y-2">
              <button
                onClick={signInWithGoogle}
                className="w-full py-3 border border-neutral-300 hover:bg-neutral-50 rounded-lg font-medium"
              >
                Google로 계속
              </button>
              <button
                onClick={signInWithApple}
                className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-medium"
              >
                Apple로 계속
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
