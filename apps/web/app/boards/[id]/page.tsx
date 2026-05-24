import { notFound, redirect } from 'next/navigation';
import { getBoard, listLinksByBoard, listPlacesByBoard } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { AddLinkForm } from './_components/add-link-form';
import { LinkList } from './_components/link-list';
import { PlaceMap } from './_components/place-map';

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    <main className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{board.title}</h1>
        {board.description && (
          <p className="text-neutral-600 mt-1">{board.description}</p>
        )}
      </header>

      <section className="mb-6">
        <AddLinkForm boardId={board.id} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-medium text-neutral-700 mb-3">링크 ({links.length})</h2>
          <LinkList links={links} />
        </section>
        <section>
          <h2 className="text-sm font-medium text-neutral-700 mb-3">장소 ({places.length})</h2>
          <PlaceMap places={places} />
        </section>
      </div>
    </main>
  );
}
