'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Link, Place, ShareModeType, Trip, TripMessage } from '@moajoa/core';
import { moaChannelName, TripMessageCreateSchema } from '@moajoa/core';
import {
  castVote,
  getProfileNames,
  getVoteCounts,
  hidePlace,
  listLinksByTrip,
  listPlacesByTrip,
  retractVote,
  sendTripMessage,
  triggerExtraction,
} from '@moajoa/api';
import { ChevronLeft, Plus } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { memberColor } from '@/lib/member-color';
import { Button, useToast } from '@/components';
import { MoaMap } from './moa-map';
import { PlaceSheet, type SheetAnchor } from './place-sheet';
import { PlaceList } from './place-list';
import { AddSheet } from './add-sheet';
import { ShareSheet } from './share-sheet';
import { MoaChat } from './moa-chat';
import { MoaTabBar, type MoaTab } from './moa-tab-bar';

export interface MoaIslandProps {
  trip: Trip;
  currentUserId: string;
  initialPlaces: Place[];
  initialLinks: Link[];
  initialCounts: Record<string, number>;
  initialMyVotedPlaceIds: string[];
  memberIdsInJoinOrder: string[];
  initialProfileNames: Record<string, string>;
  initialMessages: TripMessage[];
  /** 전송·presence track에 쓰는 로그인 사용자 display_name 스냅샷(D-08). */
  currentUserNickname: string;
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
  currentUserId,
  initialPlaces,
  initialLinks,
  initialCounts,
  initialMyVotedPlaceIds,
  memberIdsInJoinOrder,
  initialProfileNames,
  initialMessages,
  currentUserNickname,
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
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [localShareMode, setLocalShareMode] = useState<ShareModeType | null>(trip.share_mode);

  // 채팅(모아 내부 섹션 탭 — D-01/D-02). 탭 전환은 클라이언트 상태라 island이 한 번만
  // 마운트되고 단일 moa:{tripId} 채널이 유지된다(뷰만 스위치, 언마운트 없음).
  const [activeTab, setActiveTab] = useState<MoaTab>('moa');
  const [messages, setMessages] = useState<TripMessage[]>(initialMessages);
  const [viewers, setViewers] = useState(0);
  const [replyToPlaceId, setReplyToPlaceId] = useState<string | null>(null); // 배선은 Plan 04

  // 메시지 append — places/links와 달리 reconcile 안 함(WALRUS+RLS 신뢰, hidden_at 드리프트
  // 없는 append-only INSERT). id로 dedup(전송자도 자기 postgres_changes echo를 받음).
  function appendMessage(row: TripMessage) {
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
  }

  // 채널 콜백(마운트당 1회 바인딩)이 최신 값을 읽도록 ref 동기화.
  const profileNamesRef = useRef(profileNames);
  const placeCountRef = useRef(initialPlaces.length);
  profileNamesRef.current = profileNames;

  // M-02: reconcile 동시 실행 가드. 한 추출이 여러 places INSERT를 쏘면 콜백이 겹쳐
  // 호출돼 stale placeCountRef를 함께 읽고 토스트가 중복/과다 발화됨 → 직렬화 + trailing 재실행.
  const reconcilingRef = useRef(false);
  const reconcileQueuedRef = useRef(false);

  const colorFor = (uid: string) => memberColor(uid, trip.owner_id, memberIdsInJoinOrder);

  // reconcile — payload 패치 금지, 전체 refetch(RLS 재평가). 장소 증가 시 토스트(D-16).
  // in-flight 가드로 직렬화 — 겹친 호출은 trailing 1회로 합쳐 stale-read 중복 토스트 차단(M-02).
  async function reconcile() {
    if (reconcilingRef.current) {
      reconcileQueuedRef.current = true;
      return;
    }
    reconcilingRef.current = true;
    try {
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
    } finally {
      reconcilingRef.current = false;
      if (reconcileQueuedRef.current) {
        reconcileQueuedRef.current = false;
        void reconcile();
      }
    }
  }

  // realtime: moa:{tripId} 단일 채널 (RESEARCH Q3 — ONE channel per screen).
  // postgres_changes 3종(places INSERT + links UPDATE + trip_messages INSERT) + presence
  // (track/sync). 모든 바인딩은 .subscribe() 이전에 체이닝 — postgres_changes는 subscribe
  // 시점에 서버와 negotiate하므로 이후 추가 바인딩은 무음 no-op(#1917). 채널 생성을 별도 줄로
  // 분리해 subscribe/presence 콜백이 channel을 안전하게 참조(poll-vote-island 선례).
  useEffect(() => {
    const client = getSupabaseBrowser();
    const channel = client.channel(moaChannelName(trip.id), {
      config: { presence: { key: currentUserId } },
    });
    channel
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${trip.id}` },
        (payload) => appendMessage(payload.new as TripMessage),
      )
      .on('presence', { event: 'sync' }, () =>
        setViewers(Object.keys(channel.presenceState()).length),
      )
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            nickname: currentUserNickname,
            online_at: new Date().toISOString(),
          });
        }
      });
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

  // 칩 탭 (CHAT-03): #N 장소명 칩 → 모으기 탭 전환 + 해당 장소 열기 + 시트 expanded.
  // openPlaceId 경로를 재사용해 place-list이 scrollIntoView + 하이라이트(D-10).
  const openPlaceFromChat = (placeId: string) => {
    setActiveTab('moa');
    setOpenPlaceId(placeId);
    setSheetAnchor('expanded');
  };

  // 삭제 (soft-delete): optimistic 제거 후 hidePlace. 실패 시 reconcile로 복원 + 에러 토스트.
  async function handleDelete(placeId: string) {
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    try {
      await hidePlace(getSupabaseBrowser(), placeId);
      toast('삭제했어요');
    } catch (err) {
      console.error(err);
      await reconcile();
      toast('삭제하지 못했어요', { variant: 'error' });
    }
  }

  // 재시도 (D-15): 재추출 트리거 후 reconcile(router.refresh 대신).
  const onRetry = (linkId: string) => {
    const client = getSupabaseBrowser();
    triggerExtraction(client, linkId)
      .then(() => reconcile())
      .catch(() => toast('장소를 찾지 못했어요', { variant: 'error' }));
  };

  // 전송 (CHAT-01): UI 경계에서 Zod 검증(§4.5) → insert → optimistic append → 답장 해제.
  // 에러는 그대로 전파 — MoaChat이 draft 복원 + 에러 토스트.
  async function handleSend(body: string, replyToPlaceIdArg: string | null) {
    const input = TripMessageCreateSchema.parse({
      trip_id: trip.id,
      nickname: currentUserNickname,
      body,
      reply_to_place_id: replyToPlaceIdArg,
    });
    const row = await sendTripMessage(getSupabaseBrowser(), input);
    appendMessage(row); // postgres_changes echo는 id로 dedup됨
    setReplyToPlaceId(null);
  }

  // 답장 칩 해석용 lookup (#N 장소명). 칩 탭 네비게이션 배선은 Plan 04.
  const placesById = Object.fromEntries(
    places.map((p) => [p.id, { seqNo: p.seq_no, name: p.name_local }]),
  );

  return (
    <>
      {/* 모으기 뷰 — 탭 전환 시 언마운트하지 않고 hidden으로 숨김(지도 인스턴스·채널 보존 D-02).
          contents 래퍼라 자식 fixed inset-0 레이아웃은 그대로 유지된다. */}
      <div className={activeTab === 'moa' ? 'contents' : 'hidden'}>
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

        {/* 상단 바 우측 — [함께 정하기] primary sm 오버레이(UI-SPEC §상단 바). */}
        <div className="absolute right-4 top-4 z-50">
          <Button size="sm" onClick={() => setShareOpen(true)}>
            함께 정하기
          </Button>
        </div>

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
            onDelete={handleDelete}
            onReply={(placeId) => {
              setReplyToPlaceId(placeId);
              setActiveTab('chat');
            }}
          />
        </PlaceSheet>

        {/* FAB [+] — collapsed 시트 상단에서 16px 위, z-order 시트보다 위(UI-SPEC §FAB).
            add/share 시트가 열리면 시트 위로 뜨지 않게 숨긴다. */}
        {!addOpen && !shareOpen && (
          <button
            type="button"
            aria-label="장소 추가"
            onClick={() => setAddOpen(true)}
            className="absolute bottom-[136px] right-4 z-[60] grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-fab"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        )}

        <AddSheet
          tripId={trip.id}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={() => void reconcile()}
        />

        <ShareSheet
          trip={{ ...trip, share_mode: localShareMode }}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onShared={setLocalShareMode}
        />
          </div>
        </div>
      </div>

      {/* 채팅 뷰 — 탭바(fixed bottom ~56px) 위에 입력바가 걸치지 않게 하단 여백 확보. */}
      <div
        className={
          activeTab === 'chat' ? 'fixed inset-0 flex justify-center bg-neutral-100' : 'hidden'
        }
      >
        <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden px-4 pb-[64px] pt-4">
          <MoaChat
            messages={messages}
            currentUserId={currentUserId}
            viewers={viewers}
            onSend={handleSend}
            replyToPlaceId={replyToPlaceId}
            onClearReply={() => setReplyToPlaceId(null)}
            placesById={placesById}
            onChipTap={openPlaceFromChat}
          />
        </div>
      </div>

      <MoaTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}
