import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { CITY_KO_MAP } from '@moajoa/core';
import { getCachedPublicTrip } from '@/lib/public-trip-cache';
import { MapSection } from './_components/map-section';
import { GuestSurface } from './_components/guest-surface';
import { GuestPromote } from './_components/guest-promote';

interface Props {
  params: Promise<{ slug: string }>;
}

/** /moa/[id]와 같은 지도 서피스 — 페이지 줌이 지도 줌을 가로채지 않도록 D-13을 덮는다. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Description template per CONTEXT D-09 §specifics:
 * - city 있음: "{owner}님의 {city_ko} 여행 · 핀 {N}개 · MOAJOA"
 * - city 없음: "{owner}님의 여행 모아 · 핀 {N}개 · MOAJOA"
 */
function buildDescription(owner: string, cityCode: string | null, pinCount: number): string {
  const cityKo = cityCode ? CITY_KO_MAP[cityCode] : null;
  return cityKo
    ? `${owner}님의 ${cityKo} 여행 · 핀 ${pinCount}개 · MOAJOA`
    : `${owner}님의 여행 모아 · 핀 ${pinCount}개 · MOAJOA`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getCachedPublicTrip(slug);
  if (!view) return { title: 'MOAJOA' };

  const description = buildDescription(
    view.owner_display_name,
    view.board.city_code,
    view.places.length,
  );
  const ogImage = `/t/${slug}/opengraph-image`; // metadataBase makes this absolute

  return {
    title: `${view.board.title} · MOAJOA`,
    description,
    openGraph: {
      title: view.board.title,
      description,
      type: 'website',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: view.board.title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `/t/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const view = await getCachedPublicTrip(slug);
  if (!view) notFound();

  const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;

  const ownerInitial = (view.owner_display_name || 'M').trim().charAt(0).toUpperCase();
  const inviteLine = cityKo
    ? `${view.owner_display_name}님이 ${cityKo} 여행 후보 ${view.places.length}곳을 모았어요`
    : `${view.owner_display_name}님이 여행 후보 ${view.places.length}곳을 모았어요`;

  return (
    <main className="min-h-screen bg-banana-100">
      <div className="px-4 md:px-6 py-5 md:py-8 max-w-5xl mx-auto">
        {/* A안 리디자인 (2026-06-12): 첫 화면이 3초 안에 ①무엇인지 ②누가 보냈는지
            ③뭘 하면 되는지 답하도록 — 브랜드 한 줄 + 초대 카드가 그 역할. */}
        <a href="/" className="animate-fade-up flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-md bg-brand-600 text-white">
            <MapPin className="size-3" strokeWidth={2.4} />
          </span>
          <span className="text-xs font-semibold text-brand-600">MOAJOA</span>
          <span className="text-xs text-neutral-600">링크를 모아 여행 지도로</span>
        </a>

        <header className="animate-fade-up mt-4">
          <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-neutral-900">
            {view.board.title}
          </h1>
          {view.board.description && (
            <p className="mt-1.5 text-sm md:text-base leading-relaxed text-neutral-600">
              {view.board.description}
            </p>
          )}
        </header>

        <section className="animate-fade-up mt-4 rounded-2xl border border-banana-300 bg-white p-4 [animation-delay:40ms]">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-semibold text-white">
              {ownerInitial}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug text-brand-900">{inviteLine}</p>
              <p className="mt-1 text-sm leading-relaxed text-brand-700">
                가고 싶은 곳에 <span className="font-semibold">찜</span>을 눌러주세요. 많이 모인
                곳으로 같이 정해요.
              </p>
            </div>
          </div>
          {/* 계정 승격 최소 심 (C6/D-03, OQ-3 초대 카드 하단 채택) — 게스트가 카카오로
              로그인하면 익명 uid를 정식 전환(linkIdentity), 이력 유지. */}
          <div className="mt-3">
            <GuestPromote />
          </div>
        </section>

        {view.places.length === 0 ? (
          <div className="animate-fade-in mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-neutral-900">아직 분석 중이에요</p>
            <p className="mt-2 text-sm text-neutral-500">잠시 후 다시 열어주세요</p>
          </div>
        ) : (
          <MapSection places={view.places} links={view.links} />
        )}

        {/* 게스트 통합 화면 (D-08) — 세션 lifecycle·lazy 게이트·share_mode 분기를
            소유하는 클라이언트 island. SSR 셸(위 초대 카드)은 최상단 컨텍스트로 유지. */}
        {view.board.id && (
          <GuestSurface
            slug={slug}
            tripId={view.board.id}
            board={view.board}
            places={view.places}
            links={view.links}
          />
        )}

        {view.links.length > 0 && (
          <details className="mt-8 group">
            <summary className="cursor-pointer list-none mb-3 flex items-center gap-1.5 text-base font-semibold text-neutral-700 hover:text-brand-600 transition-colors">
              <span className="text-neutral-600 transition-transform group-open:rotate-90">▸</span>
              이 모아의 출처 {view.links.length}개
            </summary>
            <ul className="space-y-2">
              {view.links.map((link, i) => (
                <li
                  key={link.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex gap-3">
                      {link.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.thumbnail_url}
                          alt=""
                          className="h-14 w-24 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-base font-semibold text-neutral-900 transition-colors group-hover:text-brand-700">
                          {link.title ?? link.url}
                        </p>
                        {link.author_name && (
                          <p className="mt-1 text-sm text-neutral-500">{link.author_name}</p>
                        )}
                        {link.summary_ko && (
                          <p className="text-sm text-neutral-600 mt-1 line-clamp-3">
                            {link.summary_ko}
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <footer className="mt-12 border-t border-neutral-200 py-8 text-center">
          <a
            href="/"
            className="inline-block text-base font-semibold text-brand-600 hover:underline"
          >
            MOAJOA
          </a>
          <p className="mt-2 text-sm text-neutral-600">이 모아는 MOAJOA로 만들었어요</p>
        </footer>
      </div>
    </main>
  );
}
