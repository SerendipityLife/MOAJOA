import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { CITY_KO_MAP } from '@moajoa/core';
import { getCachedPublicBoard } from '@/lib/cache';
import { PublicBoardMap } from './_components/public-board-map';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Description template per CONTEXT D-09 §specifics:
 * - city 있음: "{owner}님의 {city_ko} 여행 · 핀 {N}개 · MOAJOA"
 * - city 없음: "{owner}님의 여행 보드 · 핀 {N}개 · MOAJOA"
 */
function buildDescription(owner: string, cityCode: string | null, pinCount: number): string {
  const cityKo = cityCode ? CITY_KO_MAP[cityCode] : null;
  return cityKo
    ? `${owner}님의 ${cityKo} 여행 · 핀 ${pinCount}개 · MOAJOA`
    : `${owner}님의 여행 보드 · 핀 ${pinCount}개 · MOAJOA`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getCachedPublicBoard(slug);
  if (!view) return { title: 'MOAJOA' };

  const description = buildDescription(
    view.owner_display_name,
    view.board.city_code,
    view.places.length,
  );
  const ogImage = `/b/${slug}/opengraph-image`; // metadataBase makes this absolute

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
      canonical: `/b/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const view = await getCachedPublicBoard(slug);
  if (!view) notFound();

  const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="px-4 md:px-6 py-6 md:py-8 max-w-5xl mx-auto">
        <header className="animate-fade-up mb-6">
          <p className="text-sm text-neutral-500">
            {view.owner_display_name}님의 보드
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-neutral-900">
            {view.board.title}
          </h1>
          {view.board.description && (
            <p className="mt-2 text-base leading-relaxed text-neutral-600">
              {view.board.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cityKo && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                {cityKo}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <MapPin className="size-3" strokeWidth={2.2} />핀 {view.places.length}개
            </span>
          </div>
        </header>

        {view.places.length === 0 ? (
          <div className="animate-fade-in mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-16 text-center">
            <p className="text-lg font-semibold text-neutral-900">아직 분석 중이에요</p>
            <p className="mt-2 text-sm text-neutral-500">잠시 후 다시 열어주세요</p>
          </div>
        ) : (
          <div className="animate-fade-in mt-6 h-[60vh] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 [animation-delay:80ms] md:h-[520px]">
            <PublicBoardMap places={view.places} links={view.links} />
          </div>
        )}

        {view.links.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              영상 출처 {view.links.length}개
            </h2>
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
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 border-t border-neutral-200 py-8 text-center">
          <a
            href="/"
            className="inline-block text-base font-semibold text-brand-600 hover:underline"
          >
            MOAJOA
          </a>
          <p className="mt-2 text-sm text-neutral-500">이 보드는 MOAJOA로 만들었어요</p>
        </footer>
      </div>
    </main>
  );
}
