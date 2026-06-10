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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Soft brand glow from the top — calm, premium tone without breaking
          the design system's flat aesthetic. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_-10%,#E0EAFF_0%,transparent_60%)]"
      />

      <div className="flex max-w-xl flex-col items-center">
        <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          여행 큐레이션 도구
        </span>

        <h1 className="animate-fade-up mt-5 text-4xl font-bold leading-tight tracking-tight text-neutral-900 [animation-delay:80ms] sm:text-5xl">
          여행 정보를 모아두는 <span className="text-brand-600">지도</span>
        </h1>

        <p className="animate-fade-up mt-5 text-lg leading-relaxed text-neutral-600 [animation-delay:160ms]">
          유튜브 링크를 던지면, 영상 속 장소가 지도에 모입니다.
          <br />
          친구와 공유해서 같이 투표하고 결정하세요.
        </p>

        <div className="animate-fade-up mt-10 [animation-delay:240ms]">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-fab transition-colors duration-150 ease-out hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            시작하기
          </Link>
        </div>
      </div>
    </main>
  );
}
