import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Pretendard font loader for next/og ImageResponse.
 *
 * Uses Korean-subset TTF (~344/341KB). Satori rejects woff2 outright
 * ("Unsupported OpenType signature wOF2" — dogfooding P0 #6 root cause), so
 * the woff2 subsets were decompressed to TTF. This route is runtime='nodejs'
 * where fonts load via fs at request time — the 500KB edge-bundle limit that
 * motivated woff2 does not apply. Original .otf files (~1.5MB each) remain on
 * disk for next/font/local in layout.tsx — DO NOT delete.
 *
 * readFile happens once per process (module-level cache).
 * process.cwd() resolves to apps/web on Vercel deploy (verified Next.js docs).
 */
let cached: { regular: Buffer; semibold: Buffer } | null = null;

export async function loadPretendardFonts(): Promise<{ regular: Buffer; semibold: Buffer }> {
  if (cached) return cached;
  const cwd = process.cwd();
  const regularPath = join(cwd, 'public/fonts/Pretendard-Regular.subset.ttf');
  const semiboldPath = join(cwd, 'public/fonts/Pretendard-SemiBold.subset.ttf');
  try {
    const [regular, semibold] = await Promise.all([readFile(regularPath), readFile(semiboldPath)]);
    cached = { regular, semibold };
    return cached;
  } catch (err) {
    // Dogfooding P0 #5 diagnostic — uncaught throw made Vercel logs empty.
    // Surface cwd + attempted paths so the next runtime log entry pinpoints
    // the issue (likely Vercel monorepo lambda cwd != apps/web).
    console.error(
      '[og-image] loadPretendardFonts failed',
      JSON.stringify({
        cwd,
        regularPath,
        semiboldPath,
        message: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException)?.code,
      }),
    );
    throw err;
  }
}
