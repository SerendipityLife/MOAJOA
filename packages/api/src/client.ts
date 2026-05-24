import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.js';

export type MoajoaSupabaseClient = SupabaseClient<Database>;

export interface CreateClientArgs {
  url: string;
  anonKey: string;
  /**
   * For SSR (Next.js server components / route handlers) you pass the user's
   * access token from cookies. For Edge Functions and admin scripts you pass
   * the service role key (server-side only — never expose).
   */
  accessToken?: string;
}

/**
 * Browser / iOS-side client. Anonymous by default; auth tokens added by
 * @supabase/supabase-js automatically when the user signs in.
 */
export function createBrowserClient({ url, anonKey }: { url: string; anonKey: string }): MoajoaSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Server-side client with a user's bearer token (e.g. from a cookie or header).
 * RLS still applies — runs as that user.
 */
export function createServerClient({ url, anonKey, accessToken }: CreateClientArgs): MoajoaSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: accessToken
      ? {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      : undefined,
  });
}

/**
 * Service-role client that bypasses RLS. Use only in Edge Functions or trusted
 * backend code. Never ship to client bundles.
 */
export function createServiceClient({
  url,
  serviceRoleKey,
}: {
  url: string;
  serviceRoleKey: string;
}): MoajoaSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
