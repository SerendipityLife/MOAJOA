'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  Link,
  Place,
  PlanStepType,
  ShareModeType,
  TravelModeType,
  Trip,
  TripMessage,
} from '@moajoa/core';
import { moaChannelName, planChannelName, TripMessageCreateSchema } from '@moajoa/core';
import {
  castVote,
  generatePlan,
  getPlanByTrip,
  getProfileNames,
  getVoteCounts,
  hidePlace,
  listLinksByTrip,
  listPlacesByTrip,
  moveToDay,
  moveToPool,
  retractVote,
  sendTripMessage,
  setTravelMode,
  triggerExtraction,
  updateTrip,
} from '@moajoa/api';
import { Plus } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { memberColor } from '@/lib/member-color';
import { Button, useToast } from '@/components';
import { MoaMap } from './moa-map';
import { MoaSwitcher } from './moa-switcher';
import { PlanSection, type PlanWithItemsView } from './plan-section';
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
  /**
   * RSC seed된 draft 플랜(없으면 null). plan_items는 realtime publication 대상이 아니라
   * 이 seed + mutation 후 로컬 refetch가 유일한 갱신 경로다(Pitfall 11). 배선은 Plan 06 Task 2.
   */
  initialPlan: PlanWithItemsView | null;
  /** 전송·presence track에 쓰는 로그인 사용자 display_name 스냅샷(D-08). */
  currentUserNickname: string;
  /** 게스트 마운트(/t)에서 호스트 전용 컨트롤([함께 정하기]) 숨김 (25-06 Gap 4). */
  hideHostControls?: boolean;
  /** F-2: 쓰기 권한 없는 role(dates voter 게스트)에겐 장소 추가 FAB 미노출 — 실패하는
      버튼 금지. 미전달=기존 렌더 동일 (29-02). */
  hidePlaceAdd?: boolean;
  /** both 모드 게스트: [모으기] 시트 상단 날짜투표 임베드(D-09/C2, 25-07). */
  pollSlot?: ReactNode;
  /** 좌상단 스위처의 내 모아 목록. 게스트 마운트(/t)는 미전달 → 정적 제목 pill. */
  moas?: Trip[];
  /** 게스트가 채팅 진입 어포던스로 join한 경우 [채팅] 탭에 착지(CHAT-09). 미전달=기존 'moa' 기본(호스트 /moa 무회귀). */
  initialTab?: MoaTab;
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
  initialPlan,
  currentUserNickname,
  hideHostControls,
  hidePlaceAdd,
  pollSlot,
  moas,
  initialTab,
}: MoaIslandProps) {
  const { toast } = useToast();

  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>(
    Object.fromEntries(initialMyVotedPlaceIds.map((id) => [id, true])),
  );
  const [votePending, setVotePending] = useState<Record<string, boolean>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string>>(initialProfileNames);
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
  const [sheetAnchor, setSheetAnchor] = useState<SheetAnchor>('collapsed');
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [localShareMode, setLocalShareMode] = useState<ShareModeType | null>(trip.share_mode);

  // [일정] 상태 (Plan 06 — D-12~D-18). plan_items는 realtime publication 대상이 아니다
  // (단일 사용자 편집 표면 — Pitfall 11): RSC seed로 시작하고 mutation 후 refetch로만 갱신한다.
  const [plan, setPlan] = useState<PlanWithItemsView | null>(initialPlan);
  const [dayCount, setDayCount] = useState<number | null>(trip.day_count);
  const [generating, setGenerating] = useState(false);
  const [planStep, setPlanStep] = useState<PlanStepType | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  // 채팅(모아 내부 섹션 탭 — D-01/D-02). 탭 전환은 클라이언트 상태라 island이 한 번만
  // 마운트되고 단일 moa:{tripId} 채널이 유지된다(뷰만 스위치, 언마운트 없음).
  const [activeTab, setActiveTab] = useState<MoaTab>(initialTab ?? 'moa');
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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${trip.id}`,
        },
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

  // ── [일정] 허브 (Plan 06) ───────────────────────────────────────────────────────
  // 생성 in-flight 가드. setState는 비동기 배치라 같은 tick의 연타를 막지 못한다 —
  // 유료 API(Claude + Routes) 이중 지출을 원천 차단하려면 ref가 단일 진실이어야 한다(T-28-23).
  const generatingRef = useRef(false);
  const planChannelRef = useRef<ReturnType<
    ReturnType<typeof getSupabaseBrowser>['channel']
  > | null>(null);

  function closePlanChannel() {
    const ch = planChannelRef.current;
    if (!ch) return;
    planChannelRef.current = null;
    void getSupabaseBrowser().removeChannel(ch);
  }

  // 진행 표시는 **moa 채널이 아니라 plan:{tripId} 임시 broadcast 채널**이다.
  // postgres_changes는 subscribe 시점에 서버와 negotiate되므로 기존 채널에 사후 바인딩을
  // 추가하면 무음 no-op이 된다(#1917 — Phase 26이 겪은 함정). 생성할 때만 열고 끝나면 닫는다.
  function openPlanChannel() {
    if (planChannelRef.current) return;
    const client = getSupabaseBrowser();
    const ch = client.channel(planChannelName(trip.id));
    ch.on('broadcast', { event: 'progress' }, (msg) => {
      const step = (msg.payload as { step?: PlanStepType } | undefined)?.step;
      if (!step) return;
      if (step === 'done' || step === 'error') {
        setPlanStep(null);
        closePlanChannel();
        return;
      }
      setPlanStep(step);
    }).subscribe();
    planChannelRef.current = ch;
  }

  async function refetchPlan() {
    setPlan(await getPlanByTrip(getSupabaseBrowser(), trip.id));
  }

  // D-12 생성/재생성. D-21 루프의 **클라이언트 절반**이 여기 있다.
  async function runGenerate() {
    if (generatingRef.current) return; // 연타 가드 (T-28-23)
    generatingRef.current = true;
    setGenerating(true);
    setPlanError(null);
    setPlanStep(null);

    const client = getSupabaseBrowser();
    openPlanChannel();
    try {
      // is_anchor = "사용자가 손으로 그 Day에 놓았다"(moveToDay, 28-03). 그 좌표를
      // pinned_placements로 되돌려 보내야 EF가 고정을 강제한다 — 이 수집이 없으면
      // 빈 배열이 나가서 D-25 카피("직접 옮긴 장소는 그대로 두고…")가 거짓말이 된다.
      const pinned = (plan?.plan_items ?? [])
        .filter((it) => it.is_anchor)
        .map((it) => ({ place_id: it.place_id, day_index: it.day_index }));
      await generatePlan(client, {
        trip_id: trip.id,
        travel_mode: plan?.travel_mode ?? 'transit',
        // pinned = "어느 Day에", anchor = "반드시 배치". 둘 다 필요하다.
        anchor_place_ids: pinned.map((p) => p.place_id),
        pinned_placements: pinned,
        removed_place_ids: [],
        // day_count는 보내지 않는다 — 서버가 trips에서 읽는다(T-28-08 비용 조작 차단).
      });
      setPlan(await getPlanByTrip(client, trip.id));
      setSelectedDay(0);
    } catch (err) {
      console.error(err);
      const raw = err instanceof Error ? err.message : '';
      const message = /placeable/i.test(raw)
        ? '자동 배치할 장소가 없어요'
        : '일정을 만들지 못했어요';
      setPlanError(message);
      toast(message, { variant: 'error' });
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      setPlanStep(null);
      closePlanChannel();
    }
  }

  // D-13 기간 게이트 — 저장에 성공해야 생성으로 넘어간다. trips UPDATE RLS는 owner 전용(0016)이라
  // editor의 저장은 실패한다: 조용히 넘기지 않고 에러 토스트로 **fail-closed**(T-28-25).
  async function onSaveDuration(nextDayCount: number) {
    try {
      await updateTrip(getSupabaseBrowser(), trip.id, { day_count: nextDayCount });
      setDayCount(nextDayCount); // Day 탭 수가 곧바로 고른 기간을 반영(SC-4)
    } catch (err) {
      console.error(err);
      toast('기간을 저장하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
      return;
    }
    await runGenerate();
  }

  async function onMovePlaceToDay(placeId: string, dayIndex: number) {
    if (!plan) return;
    const sortOrder = plan.plan_items.filter((it) => it.day_index === dayIndex).length;
    try {
      await moveToDay(getSupabaseBrowser(), {
        plan_id: plan.id,
        place_id: placeId,
        day_index: dayIndex,
        sort_order: sortOrder,
      });
      await refetchPlan();
      toast(`Day ${dayIndex + 1}에 넣었어요`);
    } catch (err) {
      console.error(err);
      await refetchPlan();
      toast('일정을 바꾸지 못했어요', { variant: 'error' });
    }
  }

  // 배치된 항목의 Day 이동. reorderPlanItem 대신 **삭제 후 재insert**를 택한다 —
  // reorderPlanItem은 is_anchor를 세우지 않아 AI가 놓은 항목을 손으로 옮겨도 고정 마커가
  // 안 생기고, 그러면 다음 재생성에서 그 이동이 조용히 사라진다(D-21 루프가 끊긴다).
  async function onMoveItemToDay(itemId: string, placeId: string, dayIndex: number) {
    if (!plan) return;
    const sortOrder = plan.plan_items.filter(
      (it) => it.day_index === dayIndex && it.id !== itemId,
    ).length;
    try {
      const client = getSupabaseBrowser();
      await moveToPool(client, itemId);
      await moveToDay(client, {
        plan_id: plan.id,
        place_id: placeId,
        day_index: dayIndex,
        sort_order: sortOrder,
      });
      await refetchPlan();
      toast(`Day ${dayIndex + 1}에 넣었어요`);
    } catch (err) {
      console.error(err);
      await refetchPlan();
      toast('일정을 바꾸지 못했어요', { variant: 'error' });
    }
  }

  async function onMoveToPool(itemId: string) {
    try {
      await moveToPool(getSupabaseBrowser(), itemId);
      await refetchPlan();
    } catch (err) {
      console.error(err);
      await refetchPlan();
      toast('일정을 바꾸지 못했어요', { variant: 'error' });
    }
  }

  // A-10: 저장만 한다. 자동 재생성 금지 — 토글 연타로 Claude+Routes가 반복 호출되는
  // 비용 경로를 원천 차단한다(T-28-23). 경로 재계산은 사용자가 '일정 다시 만들기'를 누를 때.
  async function onTravelModeChange(mode: TravelModeType) {
    if (!plan) return;
    try {
      await setTravelMode(getSupabaseBrowser(), plan.id, mode);
      await refetchPlan();
    } catch (err) {
      console.error(err);
      await refetchPlan();
      toast('일정을 바꾸지 못했어요', { variant: 'error' });
    }
  }

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

  // plan 채널 누수 방지 — 생성 중 언마운트되면 finally가 못 돌 수 있다.
  useEffect(() => {
    return () => closePlanChannel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Day 수 — PlanSection의 파생식과 동일해야 두 시트의 Day pill 수가 어긋나지 않는다.
  const maxDayIndex = (plan?.plan_items ?? []).reduce((m, it) => Math.max(m, it.day_index), -1);
  const planDayTotal = Math.max(dayCount ?? 0, maxDayIndex + 1, 1);

  // ── Day ↔ 지도 (D-16) ──
  // 플랜이 있으면 지도는 **선택 Day의 핀만** 번호로 보여주고 그 영역으로 재프레이밍한다.
  // 플랜이 없으면 셋 다 미전달 → 기존 전체 뷰·추가자 색 핀·"증가 시 fitBounds" 경로 그대로.
  const placeById = new Map(places.map((p) => [p.id, p]));
  const dayItems = plan
    ? [...plan.plan_items]
        .filter((it) => it.day_index === selectedDay)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((it) => {
          const place = placeById.get(it.place_id);
          // (0,0)은 좌표 미상 — 지도에 찍으면 대서양에 핀이 뜬다(Pitfall 3).
          // 풀 행의 '위치 정보 없음' 캡션(28-05)이 사용자에게 사유를 설명한다.
          if (!place || (place.lat === 0 && place.lng === 0)) return [];
          return [{ place, label: it.sort_order + 1 }];
        })
    : null;
  const mapPlaces = dayItems ? dayItems.map((d) => d.place) : places;
  const mapLabels = dayItems
    ? Object.fromEntries(dayItems.map((d) => [d.place.id, d.label]))
    : undefined;

  // 시트 본문의 장소 리스트. 플랜이 있으면 **미배치 풀**로 재사용된다(renderPool seam, 28-05) —
  // 12개 prop을 PlanSection이 재선언하지 않게 클로저를 그대로 넘긴다. 배치+미배치 합집합이
  // 전체 places라 정보 손실이 0이다(A-12).
  const renderPlaceList = (rows: Place[], onAddToPlan?: (placeId: string) => void) => (
    <PlaceList
      places={rows}
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
      currentUserId={currentUserId}
      ownerId={trip.owner_id}
      {...(onAddToPlan && { onAddToPlan })}
    />
  );

  return (
    <>
      {/* 모으기 뷰 — 탭 전환 시 언마운트하지 않고 hidden으로 숨김(지도 인스턴스·채널 보존 D-02).
          contents 래퍼라 자식 fixed inset-0 레이아웃은 그대로 유지된다. */}
      <div className={activeTab === 'moa' ? 'contents' : 'hidden'}>
        <div className="fixed inset-0 flex justify-center bg-neutral-100">
          <div className="relative h-full w-full max-w-lg overflow-hidden">
            {/* 지도 풀 채움 — 불투명 상단 바 없음(지도 감성, UI-SPEC). */}
            <MoaMap
              places={mapPlaces}
              colorFor={colorFor}
              onMarkerTap={onMarkerTap}
              {...(mapLabels && { labels: mapLabels })}
              {...(plan && { fitKey: selectedDay })}
            />

            <MoaSwitcher
              currentTripId={trip.id}
              title={trip.title}
              currentUserId={currentUserId}
              moas={moas}
            />

            {/* 상단 바 우측 — [함께 정하기] primary sm 오버레이(UI-SPEC §상단 바).
            게스트 마운트에선 숨김 — ShareSheet 마운트는 shareOpen이 절대 true가
            안 되므로 그대로 둔다(surgical, 25-06 Gap 4). */}
            {!hideHostControls && (
              <div className="absolute right-4 top-4 z-50">
                {/* 바나나 CTA — 파랑(+FAB)은 "담기", 바나나는 "함께하기". 두 액션을
                색으로 갈라 지도 위에서 역할이 바로 읽히게 한다(/design.md §6). */}
                <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
                  함께 정하기
                </Button>
              </div>
            )}

            <PlaceSheet
              anchor={sheetAnchor}
              onAnchorChange={setSheetAnchor}
              header={
                <div>
                  <p className="text-xl font-semibold -tracking-[0.01em] text-neutral-900">
                    {trip.title}
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-neutral-500">
                    장소 {places.length}개
                  </p>
                </div>
              }
            >
              {/* both 모드 게스트 날짜투표 임베드(D-09/C2) — 호스트 /moa는 미전달=diff 0. */}
              {pollSlot}

              {/* [일정] 영역 (D-15/HC-4) — 신규 라우트·탭이 아니라 기존 시트의 children이다.
              PlaceSheet 자체는 한 줄도 수정하지 않는다(HC-5 — 제스처 소유권 회귀 방지).
              게스트(/t/[slug]) 마운트에는 노출하지 않는다 — 열람자에게 플랜 변경 표면을
              주지 않는다(T-28-28). 실제 쓰기는 can_edit_trip RLS(0017)가 최종 게이트. */}
              {!hideHostControls && (
                <PlanSection
                  plan={plan}
                  places={places}
                  links={links}
                  trip={{ ...trip, day_count: dayCount }}
                  currentUserId={currentUserId}
                  generating={generating}
                  planStep={planStep}
                  error={planError}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  onGenerate={() => void runGenerate()}
                  onSaveDuration={(n) => void onSaveDuration(n)}
                  onMovePlaceToDay={(placeId, dayIndex) => void onMovePlaceToDay(placeId, dayIndex)}
                  onMoveItemToDay={(itemId, placeId, dayIndex) =>
                    void onMoveItemToDay(itemId, placeId, dayIndex)
                  }
                  onMoveToPool={(itemId) => void onMoveToPool(itemId)}
                  onTravelModeChange={(mode) => void onTravelModeChange(mode)}
                  onShare={() => setShareOpen(true)}
                  renderPool={(pool, onAddToPlan) => renderPlaceList(pool, onAddToPlan)}
                />
              )}

              {/* 플랜이 있으면 풀이 PlanSection 안에서 이미 렌더된다 — 여기서 또 그리면 중복(A-12). */}
              {!plan && renderPlaceList(places)}
            </PlaceSheet>

            {/* FAB [+] — collapsed 시트(peek 30vh, place-sheet) 상단에서 16px 위(UI-SPEC 토큰:
            FAB↔시트 오프셋 16px = spacing 4). expanded 시트는 리스트 풀스크린이라 첫 행
            하트 탭 타깃과 겹침 → 숨긴다(25-06 gap fix). add/share 시트가 열릴 때도 숨김. */}
            {!hidePlaceAdd && !addOpen && !shareOpen && sheetAnchor !== 'expanded' && (
              <button
                type="button"
                aria-label="장소 추가"
                onClick={() => setAddOpen(true)}
                className="absolute bottom-[calc(30vh+16px)] right-4 z-[60] grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-fab ring-1 ring-inset ring-white/20 transition-[transform,background-color] duration-150 ease-out hover:bg-brand-700 active:scale-95"
              >
                <Plus className="size-6" aria-hidden />
              </button>
            )}

            {/* 검색 추가 Day 배치 분기(D-19/D-20). Day 수는 PlanSection과 같은 파생식을 쓴다
            (day_count가 stale하거나 null인 레거시 플랜에서 items가 있는 Day를 숨기지 않기 위해
            max()로 감싼다 — 28-05와 동일). */}
            <AddSheet
              tripId={trip.id}
              open={addOpen}
              onClose={() => setAddOpen(false)}
              onAdded={() => void reconcile()}
              planExists={plan !== null}
              dayCount={planDayTotal}
              onPlacePickedForDay={(placeId, dayIndex) => void onMovePlaceToDay(placeId, dayIndex)}
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

      {/* 채팅 뷰 — 탭바(fixed bottom, 바나나 pill 포함 ≈74px) + iOS 홈 인디케이터 안전영역
          위에 입력바가 걸치지 않게 하단 여백 확보(env(safe-area-inset-bottom)). */}
      <div
        className={
          activeTab === 'chat' ? 'fixed inset-0 flex justify-center bg-neutral-100' : 'hidden'
        }
      >
        <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-4">
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
