'use client';

import { cn } from '@/lib/cn';

/**
 * The 간편 로그인 divider + the three circular OAuth buttons, shared by /login
 * and the landing carousel's third slide.
 *
 * NOT exported from `@/components` on purpose — import it by path. The barrel is
 * wholesale-replaced by `vi.mock('@/components')` in login.test.tsx, so a
 * barrel-routed import would resolve to `undefined` under test and blow up the
 * render. `components/bottom-nav.tsx` is consumed the same way (layout.tsx).
 *
 * It takes an `onProvider` handler rather than owning a supabase client: /login
 * needs a callback URL that carries ?next= through the round-trip, while the
 * landing deliberately builds a query-less one (no open-redirect surface). The
 * two redirectTo values differ structurally, so the caller owns the call.
 */

export type SocialProvider = 'kakao' | 'google' | 'apple';

interface SocialAuthButtonsProps {
  onProvider: (provider: SocialProvider) => void;
  /**
   * Extra classes for all three buttons. The landing passes a white ring: on a
   * photo the black Apple circle can drop to 1.2:1 against dark pixels, failing
   * WCAG 1.4.11 (3:1 non-text contrast). On /login's flat blue it's unneeded.
   */
  buttonClassName?: string;
}

const BUTTON_BASE =
  'grid size-[52px] place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-banana-100';

export function SocialAuthButtons({ onProvider, buttonClassName }: SocialAuthButtonsProps) {
  return (
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
          onClick={() => onProvider('kakao')}
          aria-label="카카오로 시작하기"
          className={cn(BUTTON_BASE, 'bg-[#FEE500] text-black', buttonClassName)}
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3C6.477 3 2 6.463 2 10.734c0 2.777 1.86 5.21 4.657 6.578-.205.744-.744 2.7-.851 3.12-.134.522.19.515.4.375.166-.11 2.64-1.79 3.71-2.52.677.1 1.374.152 2.084.152 5.523 0 10-3.463 10-7.735C22 6.463 17.523 3 12 3Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onProvider('google')}
          aria-label="Google로 계속하기"
          className={cn(BUTTON_BASE, 'bg-white', buttonClassName)}
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
          onClick={() => onProvider('apple')}
          aria-label="Apple로 계속하기"
          className={cn(BUTTON_BASE, 'bg-black text-white', buttonClassName)}
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </button>
      </div>
    </>
  );
}
