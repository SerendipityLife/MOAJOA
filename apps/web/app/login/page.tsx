'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input, useToast } from '@/components';

type Mode = 'password' | 'magic';

/**
 * Where to land after auth. Honors a validated ?next= (vote flow passes
 * /login?next=/b/<slug>); otherwise everyone lands on /moa, the web app's
 * home surface.
 */
function postLoginDestination(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/moa';
}

/** /auth/callback target carrying ?next= through the e-mail/OAuth round-trip. */
function callbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  const next = new URLSearchParams(window.location.search).get('next');
  const qs =
    next && next.startsWith('/') && !next.startsWith('//')
      ? `?next=${encodeURIComponent(next)}`
      : '';
  return `${base}/auth/callback${qs}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  // Surface failures bounced here by the auth callback route (/login?error=...),
  // then strip the param so a refresh doesn't re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get('error');
    if (!callbackError) return;
    toast(callbackError, { variant: 'error' });
    params.delete('error');
    const query = params.toString();
    router.replace(`/login${query ? `?${query}` : ''}` as never);
  }, [router, toast]);

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
    router.replace(postLoginDestination() as never);
  }

  async function signUp() {
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl(),
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    // With Confirm Email off, signUp returns a session immediately.
    router.replace(postLoginDestination() as never);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicSent(true);
  }

  async function oauth(provider: 'google' | 'apple' | 'kakao') {
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(),
      },
    });
    // On success the browser redirects away; an error means we never left.
    if (error) toast(error.message, { variant: 'error' });
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-banana-100 px-6">
      <div className="animate-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-fab">
            <MapPin className="size-6" strokeWidth={2} />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-neutral-900">MOAJOA</h1>
          {/* neutral-500 is only 4.27:1 on the banana canvas — bump to 600. */}
          <p className="mt-1 text-sm text-neutral-600">여행 정보를 모아두는 지도</p>
        </div>

        {/* The form sits on a white card rather than straight on the canvas:
            Kakao's mandated #FEE500 is nearly indistinguishable from Banana
            Mania, and the hairline gray borders wash out on it. */}
        <div className="rounded-2xl border border-banana-300 bg-white p-6 shadow-md">
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
                className="text-brand-700 underline text-sm"
              >
                비밀번호로 로그인
              </button>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={signIn} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                autoComplete="email"
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                required
                minLength={6}
                autoComplete="current-password"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? '...' : '로그인'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={signUp}
                  disabled={pending || !email || password.length < 6}
                  className="flex-1"
                >
                  가입하기
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('magic');
                }}
                className="w-full text-center text-sm text-neutral-500 hover:text-brand-700 mt-1"
              >
                비밀번호 없이 메일 링크로 로그인
              </button>
            </form>
          ) : (
            // magic-link mode
            <form onSubmit={sendMagicLink} className="space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                autoComplete="email"
              />
              <Button type="submit" disabled={pending || !email} className="w-full">
                {pending ? '...' : '메일로 로그인 링크 받기'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('password');
                }}
                className="w-full text-center text-sm text-neutral-500 hover:text-brand-700 mt-1"
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
              className="w-full rounded-lg border border-neutral-300 py-3 font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              Google로 계속
            </button>
            <button
              onClick={() => oauth('apple')}
              className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Apple로 계속
            </button>
            <button
              onClick={() => oauth('kakao')}
              className="w-full rounded-lg bg-[#FEE500] py-3 font-medium text-neutral-900 transition-colors hover:bg-[#FDD800]"
            >
              카카오로 시작하기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
