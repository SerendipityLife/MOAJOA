import { notFound, redirect } from 'next/navigation';
import { getTrip, listLinksByTrip, listPlacesByTrip } from '@moajoa/api';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseServer } from '@/lib/supabase/server';
import { AddLinkForm } from './_components/add-link-form';
import { LinkList } from './_components/link-list';
import { PlaceMap } from './_components/place-map';

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // WEB-01/WEB-02: dev-tool gate — env 미설정 시 즉시 /login으로 (auth 게이트 이전)
  if (!isDevToolsEnabled()) redirect('/login');

  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const board = await getTrip(supabase, id);
  if (!board) notFound();

  const [links, places] = await Promise.all([
    listLinksByTrip(supabase, id),
    listPlacesByTrip(supabase, id),
  ]);

  return (
    <main className="flex flex-col px-6 py-6 pb-24 max-w-5xl mx-auto">
      <header className="animate-fade-up mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {board.title}
        </h1>
        {board.description && (
          <p className="text-neutral-600 mt-1.5 leading-relaxed">
            {board.description}
          </p>
        )}
      </header>

      <section className="animate-fade-up mb-6 [animation-delay:80ms]">
        <AddLinkForm boardId={board.id} />
      </section>

      <div className="flex flex-col md:flex-row gap-6">
        <section className="animate-fade-up min-w-0 md:flex-1 [animation-delay:160ms]">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            링크 <span className="text-neutral-400">{links.length}</span>
          </h2>
          <LinkList links={links} />
        </section>
        <section className="animate-fade-up min-w-0 md:flex-1 [animation-delay:240ms]">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            장소 <span className="text-neutral-400">{places.length}</span>
          </h2>
          <div className="h-[38dvh] md:h-[480px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            <PlaceMap places={places} />
          </div>
        </section>
      </div>
    </main>
  );
}
