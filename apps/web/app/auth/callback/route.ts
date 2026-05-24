import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * OAuth and magic-link callback. Exchanges `code` for a session, sets cookies,
 * then redirects to the user's destination (default /boards).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/boards';

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=callback_failed', url.origin));
}
