import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTagSpy = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagSpy(...args),
}));

// Dynamic import so the env stubs apply before route module evaluation.
async function loadRoute() {
  return import('@/app/api/revalidate/route');
}

const SECRET = 'a'.repeat(64); // 64-char fake secret (≥16)

function makeRequest(body: unknown, method: 'POST' | 'GET' = 'POST'): Request {
  return new Request('http://localhost/api/revalidate', {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

describe('/api/revalidate', () => {
  beforeEach(() => {
    revalidateTagSpy.mockClear();
    vi.stubEnv('REVALIDATE_SECRET', SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('200 + revalidates tag on valid secret', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ slug: 'abc12345', secret: SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, slug: 'abc12345' });
    expect(revalidateTagSpy).toHaveBeenCalledWith('board:abc12345');
  });

  it('401 on wrong secret (same length)', async () => {
    const { POST } = await loadRoute();
    const wrong = 'b'.repeat(64);
    const res = await POST(makeRequest({ slug: 'abc12345', secret: wrong }));
    expect(res.status).toBe(401);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it('401 on wrong secret (different length — guard short-circuits)', async () => {
    const { POST } = await loadRoute();
    const wrong = 'b'.repeat(32); // ≥16 passes zod but ≠ SECRET length
    const res = await POST(makeRequest({ slug: 'abc12345', secret: wrong }));
    expect(res.status).toBe(401);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it('500 when REVALIDATE_SECRET env missing', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ slug: 'abc12345', secret: SECRET }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/misconfigured/);
  });

  it('400 on missing slug', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ secret: SECRET }));
    expect(res.status).toBe(400);
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it('400 on slug too short (<8 chars)', async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ slug: 'short', secret: SECRET }));
    expect(res.status).toBe(400);
  });

  it('400 on non-JSON body', async () => {
    const { POST } = await loadRoute();
    const req = new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '<not json>',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('405 on GET', async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
