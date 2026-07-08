import { notFound, redirect } from 'next/navigation';
import {
  getMyVotedPlaceIds,
  getProfileNames,
  getTrip,
  getVoteCounts,
  listLinksByTrip,
  listPlacesByTrip,
  listTripMembers,
} from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { MoaIsland } from './_components/moa-island';

/**
 * /moa/[id] — 지도탭 RSC (auth 게이트 + 초기 데이터 로드).
 *
 * 접근 권한은 RLS가 자연 게이트한다(RESEARCH Open Q4 — 로그인 + can_read):
 * 비멤버는 getTrip이 null → notFound. anon 키 + 쿠키 세션만, 서비스 롤 0 (T-24-17).
 * 로그인 화면이라 캐시 없음.
 */
export default async function MoaTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect(`/login?next=/moa/${id}`);

  const trip = await getTrip(supabase, id);
  if (!trip) notFound();

  const [places, links, members] = await Promise.all([
    listPlacesByTrip(supabase, id),
    listLinksByTrip(supabase, id),
    listTripMembers(supabase, id),
  ]);

  const placeIds = places.map((p) => p.id);
  const [counts, myVotedPlaceIds] = await Promise.all([
    getVoteCounts(supabase, placeIds),
    getMyVotedPlaceIds(supabase, placeIds, user.id),
  ]);

  const nameIds = [...new Set([...places.map((p) => p.added_by), trip.owner_id])];
  const profileNames = await getProfileNames(supabase, nameIds);
  const memberIdsInJoinOrder = members.map((m) => m.user_id);

  return (
    <MoaIsland
      trip={trip}
      currentUserId={user.id}
      initialPlaces={places}
      initialLinks={links}
      initialCounts={counts}
      initialMyVotedPlaceIds={myVotedPlaceIds}
      memberIdsInJoinOrder={memberIdsInJoinOrder}
      initialProfileNames={profileNames}
    />
  );
}
