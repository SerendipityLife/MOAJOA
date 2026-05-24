import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/boards');
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">
          여행 정보를 모아두는 지도
        </h1>
        <p className="text-lg text-neutral-600 mb-10">
          유튜브 링크를 던지면, 영상 속 장소가 지도에 모입니다.
          <br />
          친구와 공유해서 같이 투표하고 결정하세요.
        </p>
        <Link
          href="/login"
          className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3 rounded-lg transition"
        >
          시작하기
        </Link>
      </div>
    </main>
  );
}
