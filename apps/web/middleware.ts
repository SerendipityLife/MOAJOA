import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes Supabase auth tokens on every request and forwards cookies through.
 * Required for server components to see fresh sessions.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          request.cookies.set({ name, value, ...options });
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) {
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });

  // Touch session to trigger refresh if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
