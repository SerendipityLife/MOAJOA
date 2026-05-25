// packages/ui-tokens/scripts/export-assets.mjs
// Run: pnpm --filter @moajoa/ui-tokens run export-assets
// SOT: packages/ui-tokens/src/brand/{wordmark,icon}.svg
//      pretendard npm package (dist/public/static/*.otf + alternative/Pretendard-Bold.ttf + LICENSE.txt)

import sharp from 'sharp';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const BRAND = resolve(__dirname, '../src/brand');

// Resolve pretendard via createRequire so pnpm's hoisting layout doesn't matter.
const require = createRequire(import.meta.url);
const PRETENDARD = dirname(require.resolve('pretendard/package.json')) + '/dist';

const iconSvg = await readFile(join(BRAND, 'icon.svg'));
const wordmarkSvg = await readFile(join(BRAND, 'wordmark.svg'));

const PNG_OPTS = { compressionLevel: 9, palette: false, progressive: false };

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

async function writePng(svgBuf, width, height, outPath, opts = {}) {
  await ensureDir(outPath);
  await sharp(svgBuf, { density: 384 })
    .resize(width, height, {
      fit: opts.fit ?? 'contain',
      background: opts.background ?? { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png(PNG_OPTS)
    .toFile(outPath);
  console.log('  ✓', outPath.replace(ROOT + '/', ''));
}

console.log('→ iOS assets');
await writePng(iconSvg, 1024, 1024,
  join(ROOT, 'apps/ios/assets/icon.png'),
  { background: { r: 255, g: 255, b: 255, alpha: 1 } });
await writePng(iconSvg, 1024, 1024,
  join(ROOT, 'apps/ios/assets/adaptive-icon.png'),
  { background: { r: 0, g: 0, b: 0, alpha: 0 } });

// splash: 1242×2688 white canvas with wordmark composited at 60% width center
const wordmarkForSplash = await sharp(wordmarkSvg, { density: 384 })
  .resize({ width: Math.round(1242 * 0.6) })
  .png()
  .toBuffer();
const splashOut = join(ROOT, 'apps/ios/assets/splash.png');
await ensureDir(splashOut);
await sharp({
  create: { width: 1242, height: 2688, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: wordmarkForSplash, gravity: 'center' }])
  .png(PNG_OPTS)
  .toFile(splashOut);
console.log('  ✓', splashOut.replace(ROOT + '/', ''));

console.log('→ Web assets');
await writePng(iconSvg, 32, 32,
  join(ROOT, 'apps/web/app/favicon.ico'));
await writePng(iconSvg, 180, 180,
  join(ROOT, 'apps/web/public/apple-touch-icon.png'),
  { background: { r: 255, g: 255, b: 255, alpha: 1 } });

const wordmarkForOg = await sharp(wordmarkSvg, { density: 384 })
  .resize({ width: 600 })
  .png()
  .toBuffer();
const ogOut = join(ROOT, 'apps/web/public/og-default.png');
await ensureDir(ogOut);
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: wordmarkForOg, gravity: 'center' }])
  .png(PNG_OPTS)
  .toFile(ogOut);
console.log('  ✓', ogOut.replace(ROOT + '/', ''));

console.log('→ Pretendard fonts (iOS .otf × 4)');
const IOS_FONTS = join(ROOT, 'apps/ios/assets/fonts');
await mkdir(IOS_FONTS, { recursive: true });
for (const w of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
  const src = join(PRETENDARD, `public/static/Pretendard-${w}.otf`);
  const dst = join(IOS_FONTS, `Pretendard-${w}.otf`);
  await copyFile(src, dst);
  console.log('  ✓', dst.replace(ROOT + '/', ''));
}
await copyFile(join(PRETENDARD, 'LICENSE.txt'), join(IOS_FONTS, 'LICENSE-Pretendard.txt'));
console.log('  ✓', join(IOS_FONTS, 'LICENSE-Pretendard.txt').replace(ROOT + '/', ''));

console.log('→ Pretendard fonts (Web .otf × 4)');
const WEB_FONTS = join(ROOT, 'apps/web/public/fonts');
await mkdir(WEB_FONTS, { recursive: true });
for (const w of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
  const src = join(PRETENDARD, `public/static/Pretendard-${w}.otf`);
  const dst = join(WEB_FONTS, `Pretendard-${w}.otf`);
  await copyFile(src, dst);
  console.log('  ✓', dst.replace(ROOT + '/', ''));
}
await copyFile(join(PRETENDARD, 'LICENSE.txt'), join(WEB_FONTS, 'LICENSE-Pretendard.txt'));
console.log('  ✓', join(WEB_FONTS, 'LICENSE-Pretendard.txt').replace(ROOT + '/', ''));

console.log('→ Pretendard Bold .ttf for Phase 4 OG (Satori)');
const WEB_ASSETS = join(ROOT, 'apps/web/assets');
await mkdir(WEB_ASSETS, { recursive: true });
await copyFile(
  join(PRETENDARD, 'public/static/alternative/Pretendard-Bold.ttf'),
  join(WEB_ASSETS, 'Pretendard-Bold.ttf')
);
console.log('  ✓', join(WEB_ASSETS, 'Pretendard-Bold.ttf').replace(ROOT + '/', ''));

console.log('\n✓ All brand assets exported');
