import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMyTripsWithPreview } from '@moajoa/api';
import { CITY_KO_MAP } from '@moajoa/core';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * /moa — the logged-in entry point. Owns the D-01 routing branch so /login and
 * /auth/callback only need to know the URL: 0 moa → /onboarding, exactly 1 →
 * straight into its map tab, 2+ → this minimal list (D-12).
 */
export default async function MoaPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/moa');

  const trips = await listMyTripsWithPreview(supabase);

  // D-01 진입 분기 (정확히 이 순서).
  if (trips.length === 0) redirect('/onboarding');
  const only = trips[0];
  if (trips.length === 1 && only) redirect(`/moa/${only.id}`);

  return (
    <main className="min-h-screen bg-surface-background px-4 pb-32 pt-8">
      <div className="mx-auto max-w-2xl">
        <header className="animate-fade-up mb-6">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">내 모아</h1>
        </header>

        <ul className="space-y-3">
          {trips.map((trip, i) => {
            const city = trip.city_code
              ? (CITY_KO_MAP[trip.city_code] ?? trip.city_code)
              : '도시 미정';
            const dates =
              trip.start_date && trip.end_date
                ? `${trip.start_date} ~ ${trip.end_date}`
                : '날짜 미정';
            return (
              <li
                key={trip.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
              >
                <Link
                  href={`/moa/${trip.id}`}
                  className="block rounded-xl bg-surface-raised p-4 shadow-sm transition-shadow duration-150 ease-out hover:shadow-md"
                >
                  <h2 className="text-base font-semibold text-neutral-900">{trip.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {city} · {dates}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">장소 {trip.place_count}개</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-surface-background/80 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/onboarding"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3.5 text-base font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-700"
          >
            새 모아 만들기
          </Link>
        </div>
      </div>
    </main>
  );
}
