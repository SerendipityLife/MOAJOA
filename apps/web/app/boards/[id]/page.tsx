import { notFound, redirect } from 'next/navigation';
import { getBoard, listLinksByBoard, listPlacesByBoard } from '@moajoa/api';
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

  const board = await getBoard(supabase, id);
  if (!board) notFound();

  const [links, places] = await Promise.all([
    listLinksByBoard(supabase, id),
    listPlacesByBoard(supabase, id),
  ]);

  return (
    <main className="flex flex-col px-6 py-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{board.title}</h1>
        {board.description && (
          <p className="text-neutral-600 mt-1">{board.description}</p>
        )}
      </header>

      <section className="mb-4">
        <AddLinkForm boardId={board.id} />
      </section>

      <div className="flex flex-col md:flex-row gap-6">
        <section className="min-w-0 md:flex-1">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">링크 ({links.length})</h2>
          <LinkList links={links} />
        </section>
        <section className="min-w-0 md:flex-1">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">장소 ({places.length})</h2>
          <div className="h-[38dvh] md:h-[480px]">
            <PlaceMap places={places} />
          </div>
        </section>
      </div>
    </main>
  );
}
