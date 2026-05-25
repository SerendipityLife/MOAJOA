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
  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Regular.subset.woff2')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.subset.woff2')),
  ]);
  cached = { regular, semibold };
  return cached;
}
