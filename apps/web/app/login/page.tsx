'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input, useToast } from '@/components';
// Path import, not the barrel: login.test.tsx mocks '@/components' wholesale.
import { SocialAuthButtons } from '@/components/social-auth-buttons';

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
   * it — hiding it behind a mode switch just adds drop-off. The buttons themselves
   * now live in components/social-auth-buttons.tsx (shared with the landing); this
   * wrapper stays because 회원가입 closes over signUp/pending/email/password, which
   * is /login-only. magicSent deliberately does NOT render it: that user's next
   * step is their inbox, so the buttons are noise. */
  const socialBlock = (
    <>
      <SocialAuthButtons onProvider={oauth} />

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
