'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Link, Place, Trip } from '@moajoa/core';
import { moaChannelName } from '@moajoa/core';
import {
  castVote,
  getProfileNames,
  getVoteCounts,
  listLinksByTrip,
  listPlacesByTrip,
  retractVote,
  triggerExtraction,
} from '@moajoa/api';
import { ChevronLeft } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { memberColor } from '@/lib/member-color';
import { useToast } from '@/components';
import { MoaMap } from './moa-map';
import { PlaceSheet, type SheetAnchor } from './place-sheet';
import { PlaceList } from './place-list';

export interface MoaIslandProps {
  trip: Trip;
  currentUserId: string;
  initialPlaces: Place[];
  initialLinks: Link[];
  initialCounts: Record<string, number>;
  initialMyVotedPlaceIds: string[];
  memberIdsInJoinOrder: string[];
  initialProfileNames: Record<string, string>;
}

/**
 * MoaIsland — /moa/[id] 지도탭 상태 허브 (MOA-03/05/06 + D-14/16).
 *
 * RSC(page.tsx)가 초기 데이터를 seed하면, 이 island이 상태·realtime 구독·
 * optimistic 찜·reconcile을 소유한다. moa-map + place-sheet(24-05) + place-list(24-05)를
 * 배선한다. FAB·함께 정하기 버튼은 24-07 몫.
 *
 * realtime 규약(RESEARCH Pattern 1 + regla "ONE channel per screen"):
 *   moa:{tripId} 단일 채널에 places INSERT + links UPDATE 바인딩만. broadcast·다중
 *   채널 금지. 이벤트 payload는 신뢰하지 않고 refetch reconcile로 RLS를 재평가한다
 *   (안티패턴 회피 — hard-delete/hidden_at 드리프트 차단).
 */
export function MoaIsland({
  trip,
  currentUserId: _currentUserId,
  initialPlaces,
  initialLinks,
  initialCounts,
  initialMyVotedPlaceIds,
  memberIdsInJoinOrder,
  initialProfileNames,
}: MoaIslandProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>(
    Object.fromEntries(initialMyVotedPlaceIds.map((id) => [id, true])),
  );
  const [votePending, setVotePending] = useState<Record<string, boolean>>({});
  const [profileNames, setProfileNames] =
    useState<Record<string, string>>(initialProfileNames);
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
  const [sheetAnchor, setSheetAnchor] = useState<SheetAnchor>('collapsed');

  // 채널 콜백(마운트당 1회 바인딩)이 최신 값을 읽도록 ref 동기화.
  const profileNamesRef = useRef(profileNames);
  const placeCountRef = useRef(initialPlaces.length);
  profileNamesRef.current = profileNames;

  const colorFor = (uid: string) => memberColor(uid, trip.owner_id, memberIdsInJoinOrder);

  // reconcile — payload 패치 금지, 전체 refetch(RLS 재평가). 장소 증가 시 토스트(D-16).
  async function reconcile() {
    const client = getSupabaseBrowser();
    const [nextPlaces, nextLinks] = await Promise.all([
      listPlacesByTrip(client, trip.id),
      listLinksByTrip(client, trip.id),
    ]);
    const nextCounts = await getVoteCounts(
      client,
      nextPlaces.map((p) => p.id),
    );
    // 새 added_by 중 이름 미보유분만 추가 fetch.
    const missing = [...new Set(nextPlaces.map((p) => p.added_by))].filter(
      (id) => !(id in profileNamesRef.current),
    );
    if (missing.length > 0) {
      const fetched = await getProfileNames(client, missing);
      setProfileNames((prev) => ({ ...prev, ...fetched }));
    }

    const delta = nextPlaces.length - placeCountRef.current;
    setPlaces(nextPlaces);
    setLinks(nextLinks);
    setCounts(nextCounts);
    placeCountRef.current = nextPlaces.length;
    if (delta > 0) toast(`장소 ${delta}개 추가됨`);
  }

  // realtime: moa:{tripId} 단일 채널 · places INSERT + links UPDATE · cleanup removeChannel.
  useEffect(() => {
    const client = getSupabaseBrowser();
    const channel = client
      .channel(moaChannelName(trip.id))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${trip.id}` },
        () => void reconcile(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'links', filter: `trip_id=eq.${trip.id}` },
        () => void reconcile(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  // 찜 토글 (A-5) — vote-island optimistic+rollback. 호스트 화면이라 join/anon 분기 없음.
  async function onToggleVote(placeId: string) {
    const client = getSupabaseBrowser();
    const wasVoted = myVotes[placeId] ?? false;
    setVotePending((p) => ({ ...p, [placeId]: true }));
    setMyVotes((v) => ({ ...v, [placeId]: !wasVoted }));
    setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? -1 : 1) }));
    try {
      if (wasVoted) {
        await retractVote(client, placeId);
      } else {
        await castVote(client, { place_id: placeId, kind: 'love' });
      }
    } catch (err) {
      console.error(err);
      setMyVotes((v) => ({ ...v, [placeId]: wasVoted }));
      setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? 1 : -1) }));
      toast('투표를 저장하지 못했어요.', { variant: 'error' });
    } finally {
      setVotePending((p) => ({ ...p, [placeId]: false }));
    }
  }

  // 마커 탭 (MOA-05): 행 열기 + 시트 expanded. 스크롤은 place-list openPlaceId effect.
  const onMarkerTap = (id: string) => {
    setOpenPlaceId(id);
    setSheetAnchor('expanded');
  };

  // 재시도 (D-15): 재추출 트리거 후 reconcile(router.refresh 대신).
  const onRetry = (linkId: string) => {
    const client = getSupabaseBrowser();
    triggerExtraction(client, linkId)
      .then(() => reconcile())
      .catch(() => toast('장소를 찾지 못했어요', { variant: 'error' }));
  };

  return (
    <div className="fixed inset-0 flex justify-center bg-neutral-100">
      <div className="relative h-full w-full max-w-lg overflow-hidden">
        {/* 지도 풀 채움 — 불투명 상단 바 없음(지도 감성, UI-SPEC). */}
        <MoaMap places={places} colorFor={colorFor} onMarkerTap={onMarkerTap} />

        {/* 뒤로 chevron 오버레이(흰 원형 + shadow). */}
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => router.push('/moa')}
          className="absolute left-4 top-4 z-50 grid size-10 place-items-center rounded-full bg-white shadow-md"
        >
          <ChevronLeft className="size-5 text-neutral-700" aria-hidden />
        </button>

        <PlaceSheet
          anchor={sheetAnchor}
          onAnchorChange={setSheetAnchor}
          header={
            <div>
              <p className="text-lg font-semibold text-neutral-900">{trip.title}</p>
              <p className="text-sm font-normal text-neutral-500">장소 {places.length}개</p>
            </div>
          }
        >
          <PlaceList
            places={places}
            links={links}
            counts={counts}
            myVotes={myVotes}
            votePending={votePending}
            profileNames={profileNames}
            colorFor={colorFor}
            openPlaceId={openPlaceId}
            onOpenPlace={setOpenPlaceId}
            onToggleVote={onToggleVote}
            onRetry={onRetry}
          />
        </PlaceSheet>
      </div>
    </div>
  );
}
