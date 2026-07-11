'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicBoardView, ShareModeType } from '@moajoa/core';
import {
  getMyTripRole,
  getMyVotedPlaceIds,
  getProfileNames,
  getPublicTripPoll,
  getTrip,
  getVoteCounts,
  joinMoa,
  listLinksByTrip,
  listPlacesByTrip,
  listTripMembers,
  listTripMessages,
} from '@moajoa/api';
import { Heart } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getStoredNickname, setStoredNickname } from '@/lib/device-token';
import { useToast } from '@/components';
import { MoaIsland, type MoaIslandProps } from '@/app/moa/[id]/_components/moa-island';
import { PollVoteIsland } from '@/app/poll/[code]/_components/poll-vote-island';
import { NicknameGateSheet } from './nickname-gate-sheet';

type GuestPlace = PublicBoardView['places'][number];
type GuestLink = PublicBoardView['links'][number];

/** slug→poll metadata shape returned by public_trip_poll (0029). */
interface PollMeta {
  poll_code: string;
  mode: 'range' | 'grid';
  status: 'open' | 'closed';
  options: { id: string; start_date: string; end_date: string }[];
}

interface GuestSurfaceProps {
  slug: string;
  tripId: string;
  board: PublicBoardView['board'];
  places: GuestPlace[];
  links: GuestLink[];
  /** Test seam: override board.share_mode. */
  initialShareMode?: ShareModeType;
  /** Test seam: pre-resolved membership (skips session detect). */
  initialJoined?: boolean;
  /** Test seam: seed the current auth.uid. */
  initialUserId?: string;
  /** Test seam: seed the stored nickname. */
  initialNickname?: string;
}

/**
 * GuestSurface — /t/[slug] 게스트 통합 화면의 뼈대 (SHARE-02/03/04·AUTH-08).
 *
 * 검증된 analog 3조각을 조립한다(신규 realtime/투표/색/채팅 로직 0):
 *  1) 세션 lifecycle — vote-island.tsx L106-137 미러. 세션 해석은 전량 클라이언트
 *     (서버 컴포넌트 쿠키 API 미접근 = SSR 캐시 무독성, Pitfall 2). 멤버면 곧장
 *     호스트 MoaIsland를 실 데이터로 마운트(D-05 재접속).
 *  2) lazy 익명 게이트 — RESEARCH Pattern 1 `ensureGuestMember`. 첫 참여 액션에서만
 *     닉네임 → signInAnonymously → join_moa → setStoredNickname → 액션 재개.
 *     Pitfall 4: join_moa 완료 후에만 MoaIsland 마운트(=채널 구독).
 *  3) join 후 seed 로딩 — moa/[id]/page.tsx L36-53을 클라이언트에서 재현(멤버 RLS
 *     통과 후 direct-read). MoaIslandProps 전부 구성해 단일 moa:{tripId} 채널·순번·
 *     색·채팅을 자동 통합(SC4).
 *
 * share_mode 분기(D-09): places→MoaIsland 재사용 / dates→PollVoteIsland 임베드
 * (deviceToken=auth.uid via cast_date_vote_authed) / both→poll 섹션 + 장소.
 */
export function GuestSurface({
  slug,
  tripId,
  board,
  places,
  initialShareMode,
  initialJoined,
  initialUserId,
  initialNickname,
}: GuestSurfaceProps) {
  const { toast } = useToast();
  const shareMode: ShareModeType = initialShareMode ?? board.share_mode ?? 'places';

  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [joined, setJoined] = useState<boolean>(Boolean(initialJoined));
  const [nickname, setNickname] = useState<string>(initialNickname ?? '');
  const [moaSeed, setMoaSeed] = useState<MoaIslandProps | null>(null);
  const [pollMeta, setPollMeta] = useState<PollMeta | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [gateOpen, setGateOpen] = useState(false);

  // Pending read-only action to resume after the gate clears (place 모드).
  const pendingAction = useRef<(() => void) | null>(null);
  // Poll embed gate bridge — PollVoteIsland.onRequireMember awaits this promise.
  const gateResolve = useRef<((v: { uid: string; nickname: string }) => void) | null>(null);
  const gateReject = useRef<(() => void) | null>(null);

  // 1) Client-only session lifecycle (vote-island.tsx L116-132 미러). 멤버면
  //    게이트를 스킵하고 곧장 full island을 마운트한다(D-05 재접속).
  useEffect(() => {
    if (initialJoined) return; // test seam
    let active = true;
    (async () => {
      const client = getSupabaseBrowser();
      const { data } = await client.auth.getUser();
      if (!active) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const role = await getMyTripRole(client, tripId, uid).catch(() => null);
        if (!active) return;
        if (role) {
          const stored = getStoredNickname();
          if (stored) setNickname(stored);
          if (shareMode !== 'dates') {
            await hydrateMember(uid, stored);
            if (!active) return;
          }
          setJoined(true);
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dates/both — slug→poll_code를 anon-grant DEFINER RPC로 노출(비멤버 RLS 우회).
  useEffect(() => {
    if (shareMode === 'places') return;
    let active = true;
    (async () => {
      const client = getSupabaseBrowser();
      try {
        const raw = (await getPublicTripPoll(client, slug)) as PollMeta | null;
        if (active && raw) setPollMeta(raw);
      } catch {
        /* poll 미노출 시 조용히 스킵 — dates 표면만 비게 됨 */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareMode, slug]);

  // 비멤버 read-only 찜 카운트 — anon-grant RPC만(Pitfall 1: direct-read 금지).
  useEffect(() => {
    if (shareMode === 'dates' || joined || places.length === 0) return;
    let active = true;
    (async () => {
      const client = getSupabaseBrowser();
      try {
        const vc = await getVoteCounts(
          client,
          places.map((p) => p.id),
        );
        if (active) setCounts(vc);
      } catch {
        /* 카운트는 social proof — 실패 시 빈 상태 유지 */
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareMode, joined]);

  // 2) Lazy 익명 게이트 (RESEARCH Pattern 1). 순서 고정: signInAnonymously →
  //    join_moa → setStoredNickname. Pitfall 4: join 완료 후에만 island 마운트.
  async function ensureGuestMember(nick: string): Promise<string> {
    const client = getSupabaseBrowser();
    const {
      data: { user },
    } = await client.auth.getUser();
    let uid = user?.id ?? null;
    if (!uid) {
      const { data, error } = await client.auth.signInAnonymously({
        options: { data: { name: nick } },
      });
      if (error) throw error;
      uid = data.user!.id;
    }
    await joinMoa(client, slug);
    setStoredNickname(nick);
    return uid;
  }

  // 3) join 후 seed 로딩 (moa/[id]/page.tsx L36-53 client 재현). 멤버 RLS 통과 후
  //    direct-read가 이제 통과한다. Pitfall 6: nameIds에 uid 포함(display_name 소스).
  async function hydrateMember(uid: string, nick: string) {
    const client = getSupabaseBrowser();
    const trip = await getTrip(client, tripId);
    if (!trip) return;
    const [placeRows, linkRows, members, initialMessages] = await Promise.all([
      listPlacesByTrip(client, tripId),
      listLinksByTrip(client, tripId),
      listTripMembers(client, tripId),
      listTripMessages(client, tripId),
    ]);
    const placeIds = placeRows.map((p) => p.id);
    const [voteCounts, myVotedPlaceIds] = await Promise.all([
      getVoteCounts(client, placeIds),
      getMyVotedPlaceIds(client, placeIds, uid),
    ]);
    const nameIds = [...new Set([...placeRows.map((p) => p.added_by), trip.owner_id, uid])];
    const profileNames = await getProfileNames(client, nameIds);
    setMoaSeed({
      trip,
      currentUserId: uid,
      initialPlaces: placeRows,
      initialLinks: linkRows,
      initialCounts: voteCounts,
      initialMyVotedPlaceIds: myVotedPlaceIds,
      memberIdsInJoinOrder: members.map((m) => m.user_id),
      initialProfileNames: profileNames,
      initialMessages,
      currentUserNickname: profileNames[uid] ?? nick,
    });
  }

  /** 첫 참여 액션(read-only 찜) — 게이트를 열고 후속 액션을 보관. */
  function openGate(action?: () => void) {
    pendingAction.current = action ?? null;
    setGateOpen(true);
  }

  /** PollVoteIsland 임베드 게이트 — 첫 투표 전 익명 인증·join을 await한다. */
  function requireMember(): Promise<{ uid: string; nickname: string }> {
    if (joined && userId) return Promise.resolve({ uid: userId, nickname });
    return new Promise((resolve, reject) => {
      gateResolve.current = resolve;
      gateReject.current = reject;
      setGateOpen(true);
    });
  }

  async function handleConfirmNickname(nick: string) {
    setGateOpen(false);
    try {
      const uid = await ensureGuestMember(nick);
      setUserId(uid);
      setNickname(nick);
      if (shareMode !== 'dates') await hydrateMember(uid, nick);
      setJoined(true);
      gateResolve.current?.({ uid, nickname: nick });
      const act = pendingAction.current;
      pendingAction.current = null;
      gateResolve.current = null;
      gateReject.current = null;
      act?.();
    } catch (err) {
      console.error(err);
      toast('참여하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
      gateReject.current?.();
      pendingAction.current = null;
      gateResolve.current = null;
      gateReject.current = null;
    }
  }

  function handleCloseGate() {
    setGateOpen(false);
    gateReject.current?.();
    pendingAction.current = null;
    gateResolve.current = null;
    gateReject.current = null;
  }

  const gate = (
    <NicknameGateSheet open={gateOpen} onConfirm={handleConfirmNickname} onClose={handleCloseGate} />
  );

  // 후보 0개면 투표할 대상이 없다 — poll 위젯(집계·presence) 대신 안내만.
  // 호스트가 공유 시트에서 후보를 추가하면 새로고침 시 투표 UI로 바뀐다.
  const pollSection =
    pollMeta != null ? (
      pollMeta.options.length === 0 ? (
        <div
          data-testid="poll-empty"
          className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-sm font-normal text-neutral-500"
        >
          호스트가 후보 날짜를 정하는 중이에요
        </div>
      ) : (
        <PollVoteIsland
          code={pollMeta.poll_code}
          tripId={tripId}
          mode={pollMeta.mode}
          status={pollMeta.status}
          options={pollMeta.options}
          deviceToken={userId ?? undefined}
          nickname={nickname || undefined}
          onRequireMember={requireMember}
          // both: 모아 [채팅] 탭·presence가 있으므로 poll 자체 한마디·보는중은 중복 → 숨김.
          // dates: poll이 화면 전부라 한마디·presence가 유일한 소셜 표면 → 유지.
          embedded={shareMode === 'both'}
        />
      )
    ) : null;

  // read-only 비멤버 뷰 — seed props + anon 집계만(Pitfall 1). 찜 탭 시 게이트.
  const readOnlyPlaces = (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">장소 {places.length}곳</h2>
      <ul className="space-y-2">
        {places.map((p) => (
          <li key={p.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-base font-semibold text-neutral-900 line-clamp-2">
                {p.name_ko ?? p.name_local}
              </span>
              <button
                type="button"
                aria-label="가고싶어"
                data-testid={`guest-vote-${p.id}`}
                onClick={() => openGate()}
                className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                <Heart className="size-3.5" strokeWidth={2.2} fill="none" />
                가고싶어
                <span className="text-neutral-400">{counts[p.id] ?? 0}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  // ── share_mode 분기 (D-09, UI-SPEC C2) ────────────────────────────────────
  if (shareMode === 'dates') {
    return (
      <>
        {pollSection}
        {gate}
      </>
    );
  }

  if (shareMode === 'both') {
    // join 후엔 MoaIsland(fixed inset-0)가 sibling을 덮으므로 날짜투표 섹션을 [모으기]
    // 시트 상단 pollSlot으로 이동(D-09/C2, 25-07 — UAT '닉네임 입력 후 호스트형 화면만' 해소).
    // 비join은 현행 sibling 렌더 유지(라이브 검증 통과 경로 무변경). 중복 렌더 금지.
    return (
      <>
        {joined && moaSeed ? (
          <MoaIsland
            {...moaSeed}
            hideHostControls
            pollSlot={
              pollMeta != null ? (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-700">날짜 정하기</h3>
                  {pollSection}
                </section>
              ) : undefined
            }
          />
        ) : (
          <>
            {pollMeta != null && (
              <section>
                <h3 className="mt-6 text-sm font-semibold text-neutral-700">날짜 정하기</h3>
                {pollSection}
              </section>
            )}
            {readOnlyPlaces}
          </>
        )}
        {gate}
      </>
    );
  }

  // places (기본) — join 후 호스트 MoaIsland 재사용, 그 전엔 read-only.
  return (
    <>
      {joined && moaSeed ? <MoaIsland {...moaSeed} hideHostControls /> : readOnlyPlaces}
      {gate}
    </>
  );
}
