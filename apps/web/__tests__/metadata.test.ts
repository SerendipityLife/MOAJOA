import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue({}),
}));

const getPublicBoardBySlugMock = vi.fn();
vi.mock('@moajoa/api', () => ({
  getPublicBoardBySlug: (...args: unknown[]) => getPublicBoardBySlugMock(...args),
}));

describe('generateMetadata', () => {
  beforeEach(() => {
    getPublicBoardBySlugMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://moajoa.app');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns minimal metadata when board not found', async () => {
    getPublicBoardBySlugMock.mockResolvedValue(null);
    const { generateMetadata } = await import('@/app/b/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'missing01' }) });
    expect(meta.title).toBe('MOAJOA');
  });

  it('builds description with city when city_code present', async () => {
    getPublicBoardBySlugMock.mockResolvedValue({
      board: {
        title: '도쿄 라멘',
        city_code: 'tokyo',
        description: null,
        cover_image_url: null,
        share_slug: 'abc12345',
        visibility: 'public',
        id: 'b1',
      },
      owner_display_name: '준',
      places: [{}, {}, {}], // 3 places
      links: [],
    });
    const { generateMetadata } = await import('@/app/b/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'abc12345' }) });
    expect(meta.description).toBe('준님의 도쿄 여행 · 핀 3개 · MOAJOA');
    expect(meta.title).toBe('도쿄 라멘 · MOAJOA');
  });

  it('builds description without city when city_code null', async () => {
    getPublicBoardBySlugMock.mockResolvedValue({
      board: {
        title: '미정',
        city_code: null,
        description: null,
        cover_image_url: null,
        share_slug: 'def45678',
        visibility: 'public',
        id: 'b2',
      },
      owner_display_name: '지',
      places: [{}],
      links: [],
    });
    const { generateMetadata } = await import('@/app/b/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'def45678' }) });
    expect(meta.description).toBe('지님의 여행 보드 · 핀 1개 · MOAJOA');
  });

  it('sets twitter card to summary_large_image', async () => {
    getPublicBoardBySlugMock.mockResolvedValue({
      board: {
        title: 'X',
        city_code: 'tokyo',
        description: null,
        cover_image_url: null,
        share_slug: 'abc12345',
        visibility: 'public',
        id: 'b3',
      },
      owner_display_name: 'o',
      places: [],
      links: [],
    });
    const { generateMetadata } = await import('@/app/b/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'abc12345' }) });
    expect((meta.twitter as { card: string }).card).toBe('summary_large_image');
  });

  it('sets canonical and robots index=true', async () => {
    getPublicBoardBySlugMock.mockResolvedValue({
      board: {
        title: 'X',
        city_code: null,
        description: null,
        cover_image_url: null,
        share_slug: 'abc12345',
        visibility: 'public',
        id: 'b4',
      },
      owner_display_name: 'o',
      places: [],
      links: [],
    });
    const { generateMetadata } = await import('@/app/b/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'abc12345' }) });
    expect((meta.alternates as { canonical: string }).canonical).toBe('/b/abc12345');
    expect((meta.robots as { index: boolean }).index).toBe(true);
  });
});
