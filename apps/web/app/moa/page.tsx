import { redirect } from 'next/navigation';
import { listMyTrips } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * /moa — 로그인 후 진입점. **리스트 화면은 없다** — 모아 전환은 지도 좌상단 스위처
 * 드롭다운이 담당한다(화면 이동 없이 인플레이스 전환).
 *
 * 그래도 라우트는 남긴다: 루트 · /login · /auth/callback · bottom-nav '모아' 탭이
 * 전부 이 URL로 보내므로, 여기서는 가장 최근 모아 지도로 리다이렉트만 한다.
 */
export default async function MoaPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/moa');

  // listMyTrips는 updated_at desc 정렬이라 [0]이 가장 최근 모아다.
  const trips = await listMyTrips(supabase);
  const latest = trips[0];
  if (!latest) redirect('/onboarding');

  redirect(`/moa/${latest.id}`);
}
