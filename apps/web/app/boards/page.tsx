import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { listMyBoards } from '@moajoa/api';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseServer } from '@/lib/supabase/server';
import { CreateBoardButton } from './_components/create-board-button';

const VIS_PUBLIC = { label: '공개', cls: 'bg-brand-50 text-brand-700' };
const VISIBILITY: Record<string, { label: string; cls: string }> = {
  private: { label: '비공개', cls: 'bg-neutral-100 text-neutral-600' },
  shared: { label: '공유', cls: 'bg-info/10 text-info' },
  public: VIS_PUBLIC,
};

export default async function BoardsPage() {
  // WEB-01/WEB-02: dev-tool gate — env 미설정 시 즉시 /login으로 (auth 게이트 이전)
  if (!isDevToolsEnabled()) redirect('/login');

  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const boards = await listMyBoards(supabase);

  return (
    <main className="min-h-screen px-6 py-8 pb-24 max-w-3xl mx-auto">
      <header className="animate-fade-up flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">내 보드</h1>
        <CreateBoardButton />
      </header>

      {boards.length === 0 ? (
        <div className="animate-fade-in flex flex-col items-center text-center py-20">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 mb-4">
            <MapPin className="size-7" strokeWidth={1.8} />
          </div>
          <p className="font-semibold text-neutral-900">아직 보드가 없어요</p>
          <p className="text-sm text-neutral-500 mt-1.5 max-w-xs leading-relaxed">
            새 보드를 만들고 유튜브 링크를 던져보세요 — 영상 속 장소가 지도에 모입니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {boards.map((board, i) => {
            const vis = VISIBILITY[board.visibility] ?? VIS_PUBLIC;
            return (
              <li
                key={board.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
              >
                <Link
                  href={`/boards/${board.id}`}
                  className="group block rounded-xl border border-neutral-200 bg-white p-4 transition-all duration-150 ease-out hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-neutral-900 transition-colors group-hover:text-brand-700">
                        {board.title}
                      </h2>
                      {board.description && (
                        <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                          {board.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${vis.cls}`}
                    >
                      {vis.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
