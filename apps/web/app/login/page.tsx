'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input, useToast } from '@/components';

type Mode = 'password' | 'magic';

/* The blue canvas inverts the component defaults: Input ships a neutral-100
 * fill + gray border, Button a brand-600 fill. tailwind-merge lets these
 * className overrides win, so the shared components stay untouched. */
const INPUT_ON_BLUE = 'border-transparent bg-white text-base shadow-md';
const CTA_ON_BLUE =
  'w-full bg-banana-100 font-extrabold text-brand-900 shadow-lg hover:bg-banana-200 active:bg-banana-200 disabled:bg-banana-200 disabled:text-brand-900/60';
const LINK_ON_BLUE = 'text-banana-100 underline';

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

  /* Social is the lowest-friction path in, so password AND magic modes both get
   * it — hiding it behind a mode switch just adds drop-off. Defined once here
   * (not copy-pasted per branch, not split into its own file) because it closes
   * over oauth/signUp/pending/email/password. magicSent deliberately does NOT
   * render it: that user's next step is their inbox, so the buttons are noise. */
  const socialBlock = (
    <>
      {/* The mock's 85%-alpha label lands at 4.25:1 — keep it opaque. */}
      <div className="flex items-center gap-2.5 pt-1.5">
        <span className="h-px flex-1 bg-white/35" />
        <span className="text-xs text-white">간편 로그인</span>
        <span className="h-px flex-1 bg-white/35" />
      </div>

      <div className="flex items-center justify-center gap-4 pt-0.5">
        <button
          type="button"
          onClick={() => oauth('kakao')}
          aria-label="카카오로 시작하기"
          className="grid size-[52px] place-items-center rounded-full bg-[#FEE500] text-black shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-100"
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3C6.477 3 2 6.463 2 10.734c0 2.777 1.86 5.21 4.657 6.578-.205.744-.744 2.7-.851 3.12-.134.522.19.515.4.375.166-.11 2.64-1.79 3.71-2.52.677.1 1.374.152 2.084.152 5.523 0 10-3.463 10-7.735C22 6.463 17.523 3 12 3Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => oauth('google')}
          aria-label="Google로 계속하기"
          className="grid size-[52px] place-items-center rounded-full bg-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-100"
        >
          {/* Google's four brand colors are mandated by their branding
              guidelines — the only hexes here that aren't design tokens. */}
          <svg className="size-6" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => oauth('apple')}
          aria-label="Apple로 계속하기"
          className="grid size-[52px] place-items-center rounded-full bg-black text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-100"
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </button>
      </div>

      <p className="pt-1.5 text-[13px] text-banana-100">
        계정이 없나요?{' '}
        <button
          type="button"
          onClick={signUp}
          disabled={pending || !email || password.length < 6}
          className="font-bold text-banana-100 underline disabled:opacity-60"
        >
          회원가입
        </button>
      </p>
    </>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-700 px-6 py-12">
      {/* Top glow. Capped at brand-600 rather than the mock's lighter blue, so
          the brightest background pixel anywhere on the page is L=0.15 — the
          worst case every text token below was contrast-checked against. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-8%,var(--color-brand-600)_0%,transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-sm text-center">
        {/* Wordmark. The 1d mock has none, but the login screen still has to say
            whose product this is. Kept small + white (5.22:1 on brand-600) rather
            than banana so it reads as a label, not a second headline — the h1
            stays the visual lead. */}
        <div className="animate-fade-up flex items-center justify-center gap-1.5 text-white">
          <MapPin className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          <span className="text-xs font-bold tracking-[0.14em]">MOAJOA</span>
        </div>

        {/* The mock's translucent-white chip lifts the local background enough to
            drop banana text to 3.48:1 — invert to a dark brand ink chip (5.62:1). */}
        <span className="animate-fade-up mt-3 inline-flex items-center gap-1.5 rounded-full border border-banana-100/60 bg-brand-900/25 px-3 py-1.5 text-xs font-semibold text-banana-100 [animation-delay:60ms]">
          <span className="size-1.5 rounded-full bg-banana-100" />
          친구와 함께 결정
        </span>

        <h1 className="animate-fade-up mt-3.5 text-3xl leading-tight font-extrabold tracking-tight text-banana-100 [animation-delay:120ms]">
          어디 갈지, <span className="whitespace-nowrap">같이 정해요.</span>
        </h1>

        <MapIllustration />

        <div className="animate-fade-up mt-3 [animation-delay:240ms]">
          {mode === 'magic' && magicSent ? (
            <div>
              <p className="text-white">
                <strong>{email}</strong>으로 로그인 링크를 보냈어요.
                <br />
                메일에서 링크를 클릭해 계속 진행해주세요.
              </p>
              <button
                onClick={() => {
                  setMagicSent(false);
                  setMode('password');
                }}
                className={`mt-4 text-sm ${LINK_ON_BLUE}`}
              >
                비밀번호로 로그인
              </button>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={signIn} className="space-y-2.5">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                autoComplete="email"
                className={INPUT_ON_BLUE}
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                required
                minLength={6}
                autoComplete="current-password"
                className={INPUT_ON_BLUE}
              />
              <Button type="submit" disabled={pending} className={CTA_ON_BLUE}>
                {pending ? '...' : '로그인'}
              </Button>

              {socialBlock}
              {/* Magic link stays fully functional — demoted to a quiet entry
                  point by size/weight only. Lowering its alpha would break AA. */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('magic');
                }}
                className={`text-xs ${LINK_ON_BLUE}`}
              >
                메일 링크로 로그인
              </button>
            </form>
          ) : (
            // magic-link mode
            <form onSubmit={sendMagicLink} className="space-y-2.5">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소"
                required
                autoComplete="email"
                className={INPUT_ON_BLUE}
              />
              <Button type="submit" disabled={pending || !email} className={CTA_ON_BLUE}>
                {pending ? '...' : '메일로 로그인 링크 받기'}
              </Button>
              {socialBlock}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('password');
                }}
                className={`block w-full text-center text-xs ${LINK_ON_BLUE}`}
              >
                비밀번호로 로그인
              </button>
            </form>
          )}

          {/* danger on blue collapses, and a translucent red pill's contrast would
              depend on whatever it composites over. An opaque white pill pins it
              at a verifiable 4.61:1 regardless of background. */}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Decorative map — pure CSS, no tiles, no image, no map SDK. Every color is a
 * design token; the place names are hardcoded dummies, not user data.
 * aria-hidden: it restates the headline visually and says nothing a screen
 * reader needs.
 */
function MapIllustration() {
  return (
    <div
      aria-hidden="true"
      className="animate-fade-up relative mt-4 h-[190px] overflow-hidden rounded-2xl bg-neutral-200 shadow-lg [animation-delay:180ms]"
    >
      {/* river */}
      <div className="absolute -top-[14%] -left-[20%] h-10 w-[150%] rotate-[-20deg] bg-brand-100" />
      {/* park */}
      <div className="absolute top-[24%] right-[8%] h-[52px] w-[66px] rounded-[48%] bg-success/25" />
      {/* roads */}
      <div className="absolute top-0 left-[36%] h-full w-[3px] bg-white/90" />
      <div className="absolute top-[52%] left-0 h-[3px] w-full rotate-[-6deg] bg-white/85" />

      {/* pins — 확정 / 후보 / 보류. The rotation lives on an inner node so it
          doesn't fight the positioning translate. */}
      <div className="absolute top-[44%] left-[26%] -translate-x-1/2 -translate-y-full">
        <div className="size-[26px] rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white bg-success shadow" />
      </div>
      <div className="absolute top-[66%] left-[54%] -translate-x-1/2 -translate-y-full">
        <div className="size-[26px] rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white bg-brand-500 shadow" />
      </div>
      <div className="absolute top-[40%] left-[80%] -translate-x-1/2 -translate-y-full">
        <div className="size-[22px] rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-white bg-neutral-400 shadow" />
      </div>

      {/* place labels */}
      <div className="absolute top-[46%] left-[27%] rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-neutral-900 shadow">
        오사카성 · 명소
      </div>
      <div className="absolute top-[68%] left-[55%] rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-neutral-900 shadow">
        이치란 라멘 · 맛집
      </div>

      {/* header chip + legend */}
      <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-neutral-900 shadow">
        📍 오사카 여행 · 12곳
      </div>
      <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap text-neutral-700 shadow">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-success" />
          확정
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-brand-500" />
          후보
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-neutral-400" />
          보류
        </span>
      </div>
    </div>
  );
}
