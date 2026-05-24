import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@moajoa/api';

/**
 * Server-side Supabase client for Next.js server components and route handlers.
 * Uses the user's session cookie — runs as that user, RLS applies.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured');
  }

  return createSSRClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies) {
        try {
          for (const { name, value, options } of cookies) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // In some contexts (Server Components) cookies are read-only.
          // Middleware handles refresh, so this is safe to swallow.
        }
      },
    },
  });
}
