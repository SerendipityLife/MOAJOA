import type { Viewport } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  getMyVotedPlaceIds,
  getPlanByTrip,
  getProfileNames,
  getTrip,
  getVoteCounts,
  listLinksByTrip,
  listPlacesByTrip,
  listTripMembers,
  listTripMessages,
} from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { MoaIsland } from './_components/moa-island';

/**
 * 루트 layout의 maximumScale:5(D-13, WCAG 1.4.4)를 이 서피스에서만 덮는다.
 *
 * 페이지 줌이 1을 넘는 순간 visual viewport가 패닝 가능해지고, 그때부터는 시트를
 * 끌든 어디를 끌든 fixed 레이어(지도 + 시트)가 통째로 따라 움직인다. 합성기 레벨이라
 * touch-action·overscroll-behavior로 막을 수 없다. 게다가 지도 화면에서 핀치는
 * "지도를 확대"하려는 동작이지 "페이지를 확대"하려는 동작이 아니다 — 페이지 줌이
 * 지도 줌을 가로채는 것 자체가 오작동이다.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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

  // plan seed — 이게 없으면 [일정] 영역이 영원히 빈 상태다(island은 쿼리를 처음부터 하지
  // 않고 이 seed로 시작한다). plan_items는 realtime 구독 대상이 아니므로 서버 seed +
  // mutation 후 로컬 refetch가 유일한 갱신 경로다(Pitfall 11).
  const [places, links, members, initialMessages, plan] = await Promise.all([
    listPlacesByTrip(supabase, id),
    listLinksByTrip(supabase, id),
    listTripMembers(supabase, id),
    listTripMessages(supabase, id),
    getPlanByTrip(supabase, id),
  ]);

  const placeIds = places.map((p) => p.id);
  const [counts, myVotedPlaceIds] = await Promise.all([
    getVoteCounts(supabase, placeIds),
    getMyVotedPlaceIds(supabase, placeIds, user.id),
  ]);

  // Pitfall 8 — self(user.id)를 nameIds에 포함해야 island이 전송·presence track에 쓸
  // 본인 display_name을 갖는다(profileNames는 owner + place added_by만 seed).
  const nameIds = [...new Set([...places.map((p) => p.added_by), trip.owner_id, user.id])];
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
      initialMessages={initialMessages}
      initialPlan={plan}
      currentUserNickname={profileNames[user.id] ?? '나'}
    />
  );
}
