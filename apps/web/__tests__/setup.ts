import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// Stub Supabase env vars so apps/web/lib/public-trip-cache.ts createClient() call
// doesn't throw during tests. Real Supabase calls are mocked at the @moajoa/api
// layer (getPublicTripBySlug etc.), so the client instance itself is never used to
// fetch — but createClient still requires non-empty url/key strings.
//
// We use beforeEach (not beforeAll) because some tests (e.g. og-image.test.ts)
// call vi.unstubAllEnvs() in their afterEach, which would clear our stubs.
// Re-stubbing per-test keeps the contract local and resilient.
// Required by P0 hotfix on 2026-05-28 (cookies-in-unstable_cache fix).
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
});
