'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input } from '@/components';

/**
 * The e-mail auth form (password / magic-link / magic-sent), shared by /login
 * and the landing carousel's login modal.
 *
 * NOT exported from `@/components` on purpose — import it by path. The barrel is
 * wholesale-replaced by `vi.mock('@/components')` in login.test.tsx and
 * landing-carousel.test.tsx, so a barrel-routed import would resolve to
 * `undefined` under test and blow up the render. `social-auth-buttons.tsx` is
 * consumed the same way.
 *
 * The caller — not this form — owns the two things that differ structurally
 * between the two surfaces:
 *
 *  - `getCallbackUrl`: /login carries ?next= through the round-trip, while the
 *    landing deliberately builds a query-less URL (no open-redirect surface).
 *    It's a function, not a string, so `window` is only read at submit time.
 *  - `onAuthenticated`: /login honors ?next= via postLoginDestination(); the
 *    landing always lands on /moa. Keeping the router with the caller leaves
 *    this form free of any next/navigation dependency.
 *
 * `useToast` is deliberately not used: /login's toasts are the callback-error
 * banner and OAuth failures, both of which are the *page's* concern. Auth errors
 * raised by this form render in its own role="alert" node.
 */

type Mode = 'password' | 'magic';

export type EmailAuthSurface = 'blue' | 'light';

interface EmailAuthFormProps {
  surface: EmailAuthSurface;
  getCallbackUrl: () => string;
  onAuthenticated: () => void;
  /**
   * Rendered between the CTA and the 회원가입 line. /login slots the social
   * buttons in here; the landing modal passes nothing — its slide already shows
   * them right behind the modal.
   */
  socialSlot?: React.ReactNode;
}

interface SurfaceClasses {
  input: string;
  cta: string;
  link: string;
  hint: string;
  signup: string;
  /** The magic-sent paragraph. Body copy, so it needs the surface's ink. */
  sent: string;
}

/* blue = /login's brand-700 canvas, which inverts the component defaults: Input
 * ships a neutral-100 fill + gray border, Button a brand-600 fill. tailwind-merge
 * lets these overrides win, so the shared components stay untouched.
 *
 * light = the white Dialog panel, where the component defaults already *are* the
 * design (Input: neutral-100 fill / neutral-900 ink; Button primary: brand-600 +
 * white at 5.22:1). Hence the near-empty override set — no new hexes. */
const SURFACE: Record<EmailAuthSurface, SurfaceClasses> = {
  blue: {
    input: 'border-transparent bg-white text-base shadow-md',
    cta: 'w-full bg-banana-100 font-extrabold text-brand-900 shadow-lg hover:bg-banana-200 active:bg-banana-200 disabled:bg-banana-200 disabled:text-brand-900/60',
    link: 'text-banana-100 underline',
    hint: 'text-banana-100',
    signup: 'font-bold text-banana-100 underline disabled:opacity-60',
    sent: 'text-white',
  },
  light: {
    input: '',
    cta: 'w-full',
    link: 'text-brand-600 underline',
    hint: 'text-neutral-600',
    signup: 'font-bold text-brand-600 underline disabled:opacity-60',
    sent: 'text-neutral-900',
  },
};

export function EmailAuthForm({
  surface,
  getCallbackUrl,
  onAuthenticated,
  socialSlot,
}: EmailAuthFormProps) {
  const s = SURFACE[surface];
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
    onAuthenticated();
  }

  async function signUp() {
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getCallbackUrl(),
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    // With Confirm Email off, signUp returns a session immediately.
    onAuthenticated();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getCallbackUrl(),
      },
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMagicSent(true);
  }

  /* 회원가입 closes over signUp/pending/email/password, so it ships with the form
   * rather than the socialSlot. magicSent deliberately renders neither: that
   * user's next step is their inbox, so both are noise.
   *
   * Note the `password.length < 6` guard also disables 회원가입 in magic mode,
   * where no password field is rendered. That is /login's pre-existing behavior,
   * carried over verbatim — out of scope to "fix" here. */
  const signupBlock = (
    <>
      {socialSlot}

      <p className={`pt-1.5 text-[13px] ${s.hint}`}>
        계정이 없나요?{' '}
        <button
          type="button"
          onClick={signUp}
          disabled={pending || !email || password.length < 6}
          className={s.signup}
        >
          회원가입
        </button>
      </p>
    </>
  );

  return (
    <>
      {mode === 'magic' && magicSent ? (
        <div>
          <p className={s.sent}>
            <strong>{email}</strong>으로 로그인 링크를 보냈어요.
            <br />
            메일에서 링크를 클릭해 계속 진행해주세요.
          </p>
          <button
            onClick={() => {
              setMagicSent(false);
              setMode('password');
            }}
            className={`mt-4 text-sm ${s.link}`}
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
            className={s.input}
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            required
            minLength={6}
            autoComplete="current-password"
            className={s.input}
          />
          <Button type="submit" disabled={pending} className={s.cta}>
            {pending ? '...' : '로그인'}
          </Button>

          {signupBlock}
          {/* Magic link stays fully functional — demoted to a quiet entry
              point by size/weight only. Lowering its alpha would break AA. */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('magic');
            }}
            className={`text-xs ${s.link}`}
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
            className={s.input}
          />
          <Button type="submit" disabled={pending || !email} className={s.cta}>
            {pending ? '...' : '메일로 로그인 링크 받기'}
          </Button>
          {signupBlock}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('password');
            }}
            className={`block w-full text-center text-xs ${s.link}`}
          >
            비밀번호로 로그인
          </button>
        </form>
      )}

      {/* danger on blue collapses, and a translucent red pill's contrast would
          depend on whatever it composites over. An opaque white pill pins it
          at a verifiable 4.61:1 regardless of background — which also makes it
          a no-op on the white light surface, so this node needs no variant. */}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
