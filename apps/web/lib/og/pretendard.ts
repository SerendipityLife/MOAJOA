import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Pretendard font loader for next/og ImageResponse.
 *
 * Uses Korean-subset woff2 (~157/161KB) so combined fonts fit ImageResponse's
 * 500KB bundle limit (RESEARCH §Pitfall 3). Original .otf files (~1.5MB each)
 * remain on disk for next/font/local in layout.tsx — DO NOT delete.
 *
 * readFile happens once per process (module-level cache).
 * process.cwd() resolves to apps/web on Vercel deploy (verified Next.js docs).
 */
let cached: { regular: Buffer; semibold: Buffer } | null = null;

export async function loadPretendardFonts(): Promise<{ regular: Buffer; semibold: Buffer }> {
  if (cached) return cached;
  const cwd = process.cwd();
  const regularPath = join(cwd, 'public/fonts/Pretendard-Regular.subset.woff2');
  const semiboldPath = join(cwd, 'public/fonts/Pretendard-SemiBold.subset.woff2');
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
