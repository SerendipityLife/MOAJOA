import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue({}),
}));
const readFileMock = vi.fn().mockResolvedValue(Buffer.from('fake-font-bytes'));
vi.mock('node:fs/promises', () => ({
  default: { readFile: readFileMock },
  readFile: readFileMock,
}));

const getPublicTripBySlugMock = vi.fn();
vi.mock('@moajoa/api', () => ({
  getPublicTripBySlug: (...args: unknown[]) => getPublicTripBySlugMock(...args),
}));

// Stub ImageResponse to avoid Satori running on fake font bytes in jsdom.
const imageResponseCtor = vi.fn();
vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(...args: unknown[]) {
      imageResponseCtor(...args);
    }
  },
}));

describe('opengraph-image route', () => {
  beforeEach(() => {
    imageResponseCtor.mockClear();
    getPublicTripBySlugMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', 'TEST_KEY');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns ImageResponse with fallback when board not found', async () => {
    getPublicTripBySlugMock.mockResolvedValue(null);
    const mod = await import('@/app/t/[slug]/opengraph-image');
    await mod.default({ params: Promise.resolve({ slug: 'missing01' }) });
    expect(imageResponseCtor).toHaveBeenCalledTimes(1);
    const [, opts] = imageResponseCtor.mock.calls[0]! as [
      unknown,
      { fonts: unknown[]; width: number; height: number },
    ];
    expect(opts.width).toBe(1200);
    expect(opts.height).toBe(630);
    expect(Array.isArray(opts.fonts)).toBe(true);
    expect(opts.fonts.length).toBe(2);
  });

  it('returns ImageResponse with mapUrl when board has places + key set', async () => {
    getPublicTripBySlugMock.mockResolvedValue({
      board: {
        title: '도쿄',
        city_code: 'tokyo',
        description: null,
        cover_image_url: null,
        share_slug: 'abc12345',
        visibility: 'public',
        id: 'b1',
      },
      owner_display_name: '준',
      places: [{ lat: 35.68, lng: 139.69 }],
      links: [],
    });
    const mod = await import('@/app/t/[slug]/opengraph-image');
    await mod.default({ params: Promise.resolve({ slug: 'abc12345' }) });
    expect(imageResponseCtor).toHaveBeenCalledTimes(1);
  });

  it('exports size, alt, contentType, runtime', async () => {
    const mod = await import('@/app/t/[slug]/opengraph-image');
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.alt).toBe('MOAJOA 공유 모아');
    expect(mod.contentType).toBe('image/png');
    expect(mod.runtime).toBe('nodejs');
  });

  it('does NOT throw when NEXT_PUBLIC_GOOGLE_MAPS_KEY missing (fallback to text)', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '');
    getPublicTripBySlugMock.mockResolvedValue({
      board: {
        title: 'T',
        city_code: null,
        description: null,
        cover_image_url: null,
        share_slug: 'abc12345',
        visibility: 'public',
        id: 'b2',
      },
      owner_display_name: 'x',
      places: [{ lat: 1, lng: 2 }],
      links: [],
    });
    const mod = await import('@/app/t/[slug]/opengraph-image');
    await expect(
      mod.default({ params: Promise.resolve({ slug: 'abc12345' }) }),
    ).resolves.toBeDefined();
  });
});
