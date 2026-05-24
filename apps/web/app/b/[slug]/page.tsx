import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { PublicBoardMap } from './_components/public-board-map';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const view = await getPublicBoardBySlug(supabase, slug);
  if (!view) return { title: 'MOAJOA' };
  return {
    title: `${view.board.title} · MOAJOA`,
    description: view.board.description ?? `${view.owner_display_name}님의 여행 보드`,
    openGraph: {
      title: view.board.title,
      description: view.board.description ?? `${view.owner_display_name}님의 여행 보드`,
      type: 'website',
      images: view.board.cover_image_url ? [view.board.cover_image_url] : [],
    },
  };
}

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const view = await getPublicBoardBySlug(supabase, slug);
  if (!view) notFound();

  return (
    <main className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
          {view.owner_display_name}님의 보드
        </p>
        <h1 className="text-3xl font-semibold">{view.board.title}</h1>
        {view.board.description && (
          <p className="text-neutral-600 mt-2">{view.board.description}</p>
        )}
      </header>

      <PublicBoardMap places={view.places} />

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700 mb-3">
          영상 출처 ({view.links.length})
        </h2>
        <ul className="space-y-2">
          {view.links.map((link) => (
            <li key={link.id} className="p-3 border border-neutral-200 rounded-lg">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex gap-3">
                {link.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={link.thumbnail_url}
                    alt=""
                    className="w-24 h-14 object-cover rounded shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{link.title ?? link.url}</p>
                  {link.author_name && (
                    <p className="text-xs text-neutral-500 mt-1">{link.author_name}</p>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
