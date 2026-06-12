import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Auth callback — server-side PKCE code exchange.
 *
 * With @supabase/ssr the code verifier lives in a cookie, so the exchange must
 * run where that cookie is reliably available: the server. Doing it client-side
 * fails intermittently with "PKCE code verifier not found in storage" because
 * the verifier doesn't round-trip through document.cookie after the external
 * OAuth redirect. The server reads the verifier from the request cookies and
 * writes the session back via Set-Cookie.
 *
 * Cookie writes are bound to the redirect `response` object directly: a returned
 * NextResponse.redirect() does NOT inherit cookies set via next/headers, so the
 * session would never reach the browser and the next /boards request would bounce
 * back to /login. Writing onto this response guarantees the Set-Cookie headers.
 *
 * flowType defaults to 'pkce', so OAuth, magic link, and email confirmation all
 * return here as `?code=...` — there is no hash-fragment (implicit) flow to handle.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Validated relative path only (no //host open redirect). Default mirrors
  // postLoginDestination(): /boards is a dev-tool surface — prod users land
  // on / instead of bouncing off the /boards gate back to /login (P1 #4).
  const rawNext = searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1'
        ? '/boards'
        : '/';
  const errorDescription = searchParams.get('error_description') ?? searchParams.get('error');

  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  const fail = (message: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(message)}`);

  if (errorDescription) {
    return fail(errorDescription);
  }

  if (!code) {
    return fail('로그인 정보를 찾지 못했어요. 다시 시도해주세요.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return fail('인증 설정이 누락됐어요.');
  }

  const response = NextResponse.redirect(`${base}${next}`);
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail(error.message);
  }

  return response;
}
