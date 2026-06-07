import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMyBoards } from '@moajoa/api';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseServer } from '@/lib/supabase/server';
import { CreateBoardButton } from './_components/create-board-button';

export default async function BoardsPage() {
  // WEB-01/WEB-02: dev-tool gate — env 미설정 시 즉시 /login으로 (auth 게이트 이전)
  if (!isDevToolsEnabled()) redirect('/login');

  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const boards = await listMyBoards(supabase);

  return (
    <main className="min-h-screen px-6 py-8 pb-24 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">내 보드</h1>
        <CreateBoardButton />
      </header>

      {boards.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <p className="mb-4">아직 보드가 없어요.</p>
          <p className="text-sm">
            새 보드를 만들고 유튜브 링크를 던져보세요 — 영상 속 장소가 지도에 모입니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="block p-4 rounded-lg border border-neutral-200 hover:border-brand-400 hover:bg-brand-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-neutral-900">{board.title}</h2>
                    {board.description && (
                      <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                        {board.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-neutral-100 text-neutral-600 shrink-0">
                    {board.visibility === 'private'
                      ? '비공개'
                      : board.visibility === 'shared'
                        ? '공유'
                        : '공개'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
