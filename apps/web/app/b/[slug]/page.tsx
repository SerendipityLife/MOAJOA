import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CITY_KO_MAP } from '@moajoa/core';
import { getCachedPublicBoard } from '@/lib/cache';
import { PublicBoardMap } from './_components/public-board-map';
import { PlaceSummaryList } from './_components/place-summary-list';
import { VoteIsland } from './_components/vote-island';

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
  const metaLine = cityKo
    ? `${cityKo} · 핀 ${view.places.length}개`
    : `핀 ${view.places.length}개`;

  return (
    <main className="min-h-screen bg-white">
      <div className="px-4 md:px-6 py-6 md:py-8 max-w-5xl mx-auto">
        <header className="mb-6">
          <p className="text-sm text-neutral-500 mb-1">
            {view.owner_display_name}님의 보드
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900 leading-tight">
            {view.board.title}
          </h1>
          {view.board.description && (
            <p className="text-base text-neutral-600 mt-2">{view.board.description}</p>
          )}
          <p className="text-sm text-neutral-600 mt-2">{metaLine}</p>
        </header>

        {view.places.length === 0 ? (
          <div className="mt-6 py-16 px-6 bg-neutral-50 rounded-lg border border-neutral-200 text-center">
            <p className="text-lg font-semibold text-neutral-900">아직 분석 중이에요</p>
            <p className="text-sm text-neutral-500 mt-2">잠시 후 다시 열어주세요</p>
          </div>
        ) : (
          <div className="mt-6 w-full h-[60vh] md:h-[520px] rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
            <PublicBoardMap places={view.places} links={view.links} />
          </div>
        )}

        {view.board.id && (
          <VoteIsland slug={slug} boardId={view.board.id} places={view.places} />
        )}

        <PlaceSummaryList places={view.places} />

        {view.links.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-3">
              영상 출처 {view.links.length}개
            </h2>
            <ul className="space-y-2">
              {view.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 border border-neutral-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex gap-3">
                      {link.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.thumbnail_url}
                          alt=""
                          className="w-24 h-14 object-cover rounded shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-neutral-900 line-clamp-2">
                          {link.title ?? link.url}
                        </p>
                        {link.author_name && (
                          <p className="text-sm text-neutral-500 mt-1">{link.author_name}</p>
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
          </section>
        )}

        <footer className="mt-12 py-8 border-t border-neutral-200 text-center">
          <a
            href="/"
            className="inline-block text-base font-semibold text-brand-500 hover:underline"
          >
            MOAJOA
          </a>
          <p className="text-sm text-neutral-500 mt-2">이 보드는 MOAJOA로 만들었어요</p>
        </footer>
      </div>
    </main>
  );
}
