'use client';

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import type { Database } from '@moajoa/api';

let cached: ReturnType<typeof createSSRBrowserClient<Database>> | undefined;

export function getSupabaseBrowser() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not configured');
  }
  cached = createSSRBrowserClient<Database>(url, anonKey);
  return cached;
}
