import { ImageResponse } from 'next/og';
import { CITY_KO_MAP } from '@moajoa/core';
import { getCachedPublicBoard } from '@/lib/cache';
import { loadPretendardFonts } from '@/lib/og/pretendard';
import { buildStaticMapsUrl, OG_GRAYSCALE_STYLE } from '@/lib/og/static-maps';
import { getGoogleMapsKey } from '@/lib/env';

export const alt = 'MOAJOA 공유 보드';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Node runtime (Default since Next.js 15 for file conventions; D-06 'Edge' is a stale label
// — RESEARCH §Pitfall 9: Edge can't readFile or use node:fs/promises reliably).
export const runtime = 'nodejs';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  // P0 #5 diag — surface function entry + Promise.all branch failures
  // so the Vercel runtime log narrows down where the throw originates.
  console.log('[og-image] start', { slug, runtime: 'nodejs' });
  let view, fonts;
  try {
    [view, fonts] = await Promise.all([
      getCachedPublicBoard(slug),
      loadPretendardFonts(),
    ]);
    console.log('[og-image] deps ready', { hasView: !!view, fontsRegular: fonts?.regular?.length, fontsSemibold: fonts?.semibold?.length });
  } catch (err) {
    console.error('[og-image] deps failed', {
      slug,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
    });
    throw err;
  }

  const fontOptions = [
    { name: 'Pretendard', data: fonts.regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Pretendard', data: fonts.semibold, weight: 600 as const, style: 'normal' as const },
  ];

  // Fallback: board not found
  if (!view) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
            fontFamily: 'Pretendard',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 600, color: '#F97316' }}>MOAJOA</div>
        </div>
      ),
      { ...size, fonts: fontOptions },
    );
  }

  const title = view.board.title;
  const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;
  const pinCount = view.places.length;
  const apiKey = getGoogleMapsKey();

  // Build Static Maps URL — only if we have key + at least 1 place
  let mapUrl: string | null = null;
  if (apiKey && view.places.length > 0) {
    try {
      mapUrl = buildStaticMapsUrl({
        places: view.places.map((p) => ({ lat: p.lat, lng: p.lng })),
        size: { width: 600, height: 630 },
        scale: 2,
        apiKey,
        styleParams: OG_GRAYSCALE_STYLE,
      });
    } catch {
      mapUrl = null;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'Pretendard',
          background: '#FFFFFF',
        }}
      >
        {/* Left 600×630 — text stack */}
        <div
          style={{
            width: 600,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 600,
                color: '#0F172A',
                lineHeight: 1.2,
                // Satori 2-line clamp via display:-webkit-box not always reliable —
                // substring fallback at ~40 chars per line × 2 = 80 chars.
              }}
            >
              {title.length > 80 ? `${title.slice(0, 79)}…` : title}
            </div>
            {cityKo && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 400,
                  color: '#475569',
                  marginTop: 24,
                }}
              >
                {cityKo}
              </div>
            )}
            <div
              style={{
                fontSize: 24,
                fontWeight: 400,
                color: '#475569',
                marginTop: cityKo ? 16 : 24,
              }}
            >
              {/* Single template string on purpose: `핀 {n}개` interpolation
                  creates 3 child nodes and Satori requires explicit flex then. */}
              {`핀 ${pinCount}개`}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#F97316' }}>MOAJOA</div>
        </div>

        {/* Right 600×630 — Static Maps PNG or fallback */}
        <div
          style={{
            width: 600,
            height: 630,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
          }}
        >
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapUrl}
              width={600}
              height={630}
              style={{ objectFit: 'cover' }}
              alt=""
            />
          ) : (
            <div style={{ fontSize: 20, fontWeight: 400, color: '#64748B' }}>
              지도 미리보기 준비 중
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: fontOptions },
  );
}
