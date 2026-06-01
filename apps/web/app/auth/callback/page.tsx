'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * Auth callback — handles three return-path flavors Supabase Auth produces:
 *
 *   1. PKCE code in query:        /auth/callback?code=...
 *   2. Implicit tokens in hash:   /auth/callback#access_token=...&refresh_token=...
 *   3. Email verification hash:   /auth/callback#access_token=...&type=signup
 *
 * Why client-side: hash fragments aren't sent to the server, so a route
 * handler can't see them. The Supabase browser SDK's `detectSessionInUrl: true`
 * auto-parses the hash when it boots, so we just wait for the session and
 * redirect.
 *
 * Next.js 15 requires components calling useSearchParams() to be wrapped in
 * <Suspense> for the prerender to succeed.
 */
function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev; the PKCE code + verifier are
  // single-use, so a second exchangeCodeForSession() call fails with
  // "both auth code and code verifier should be non-empty". Run exactly once.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const supabase = getSupabaseBrowser();
    const next = params.get('next') ?? '/boards';
    const code = params.get('code');
    const errorDescription = params.get('error_description') ?? params.get('error');

    if (errorDescription) {
      setError(errorDescription);
      return;
    }

    (async () => {
      // Path 1: PKCE code-exchange flow
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
        router.replace(next as never);
        return;
      }

      // Path 2 & 3: hash-fragment flow — SDK auto-detects on boot. Poll briefly.
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace(next as never);
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      setError('세션을 가져오지 못했어요. 다시 시도해주세요.');
    })();
  }, [params, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold mb-3">로그인 실패</h1>
            <p className="text-neutral-600 mb-4">{error}</p>
            <a href="/login" className="text-brand-500 underline">
              다시 로그인하기
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-3">로그인 중...</h1>
            <p className="text-neutral-500">잠시만요.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6">
          <p className="text-neutral-500">잠시만요.</p>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
