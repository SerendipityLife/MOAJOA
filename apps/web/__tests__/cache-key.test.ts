import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Array<{ keyParts: readonly unknown[]; opts: { tags: string[]; revalidate: number } }> = [];

vi.mock('next/cache', () => ({
  // Capture every unstable_cache invocation's keyParts + opts.
  unstable_cache: vi.fn((fn, keyParts, opts) => {
    calls.push({ keyParts, opts });
    return fn; // identity — bypass cache so test runs deterministically
  }),
}));

vi.mock('@moajoa/api', () => ({
  getPublicTripBySlug: vi.fn().mockResolvedValue({
    board: { title: 'mock' },
    places: [],
    links: [],
    owner_display_name: 'x',
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue({}),
}));

describe('getCachedPublicTrip cache key isolation (Pitfall 1)', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('uses distinct keyParts per slug', async () => {
    const { getCachedPublicTrip } = await import('@/lib/public-trip-cache');
    await getCachedPublicTrip('slug-aaaa1111');
    await getCachedPublicTrip('slug-bbbb2222');

    // 2 calls recorded
    expect(calls.length).toBe(2);

    // Each keyParts array contains its own slug
    expect(calls[0]!.keyParts).toContain('slug-aaaa1111');
    expect(calls[1]!.keyParts).toContain('slug-bbbb2222');

    // keyParts MUST differ (Pitfall 1 — same keyParts = cross-slug leak)
    expect(calls[0]!.keyParts).not.toEqual(calls[1]!.keyParts);

    // Tag also slug-scoped
    expect(calls[0]!.opts.tags).toContain('trip:slug-aaaa1111');
    expect(calls[1]!.opts.tags).toContain('trip:slug-bbbb2222');

    // TTL fallback = 3600s per D-03
    expect(calls[0]!.opts.revalidate).toBe(3600);
  });
});
