'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getMyTripRole,
  joinMoaByPollCode,
  listTripMessages,
  sendTripMessage,
} from '@moajoa/api';
import { moaChannelName, TripMessageCreateSchema, type TripMessage } from '@moajoa/core';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getStoredNickname, setStoredNickname } from '@/lib/device-token';
import { useToast } from '@/components';
import { MoaChat } from '@/app/moa/[id]/_components/moa-chat';
import { NicknameGateSheet } from '@/app/t/[slug]/_components/nickname-gate-sheet';
import { PollVoteIsland } from './poll-vote-island';

interface PollOption {
  id: string;
  start_date: string;
  end_date: string;
}

export interface PollGuestIslandProps {
  code: string;
  tripId: string;
  mode: 'range' | 'grid';
  status: 'open' | 'closed';
  options: PollOption[];
}

/**
 * PollGuestIsland — /poll/[code] 게이트+채팅 채널-소유 래퍼 (D-03 / CHAT-05).
 *
 * PollVoteIsland(투표)와 통일 채팅 섹션을 함께 감싸 닉네임 게이트를 공유한다
 * (A-7 — 첫 투표든 첫 전송이든 어느 쪽이 먼저든 게이트 1회). 게이트 confirm 시
 * signInAnonymously → join_moa_by_poll_code(0032, role='voter') → setStoredNickname
 * 순서로 익명 멤버가 되고, 이후 대화는 /t·/moa와 같은 저장소(trip_messages)·같은
 * 채널(moa:{tripId})로 수렴한다 — 검증된 조각 3종의 합성(신규 로직 0):
 *  1) 게이트 promise 브리지 + ensureGuestMember — guest-surface.tsx 미러.
 *     hydrate는 listTripMessages만 — trips 단건 조회 API 호출 금지(Pitfall 2: 레거시
 *     dateless-poll trip은 visibility='private'라 voter 멤버여도 trips SELECT
 *     불가 → 호출하면 join 후 채팅이 영구 빈 화면이 된다. trip_id는 SSR seed 보유).
 *  2) pre-subscribe 채널 체인 — moa-island.tsx 미러. 전 바인딩은 .subscribe()
 *     이전 체이닝(#1917 — 사후 추가는 무음 no-op). 이 래퍼가 /poll 안에서
 *     moa:{tripId} topic의 유일 소유자(같은 topic 2채널 = 배달 탈취).
 *  3) id-dedup append — trip_messages는 append-only INSERT라 payload 신뢰 +
 *     id dedup이 규약(reconcile 전체-refetch 불필요).
 */
export function PollGuestIsland({ code, tripId, mode, status, options }: PollGuestIslandProps) {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [viewers, setViewers] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);

  // 비멤버 compose 미러(moa-chat 계약) — join 성공 시 MoaChat이 이력과 함께 인계.
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // 게이트 promise 브리지 — PollVoteIsland.onRequireMember와 채팅 첫 전송이 공유.
  const gateResolve = useRef<((v: { uid: string; nickname: string }) => void) | null>(null);
  const gateReject = useRef<(() => void) | null>(null);

  // 재방문 멤버 즉시 hydrate (guest-surface 세션 effect 미러 — 게이트 스킵).
  // hydrate는 listTripMessages만 — trips 단건 조회 금지(Pitfall 2, 위 doc 주석).
  useEffect(() => {
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
          const rows = await listTripMessages(client, tripId);
          if (!active) return;
          setMessages(rows);
          setJoined(true);
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy 익명 게이트 (guest-surface ensureGuestMember 미러 — joinMoa→joinMoaByPollCode만
  // 교체). 순서 고정: signInAnonymously(data.name 미주입 시 display_name='user') →
  // join RPC → setStoredNickname.
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
    await joinMoaByPollCode(client, code);
    setStoredNickname(nick);
    return uid;
  }

  /** 첫 참여(투표든 전송이든) 전 익명 인증·join을 await한다 — 게이트 1회 공유(A-7). */
  function requireMember(): Promise<{ uid: string; nickname: string }> {
    if (joined && userId) return Promise.resolve({ uid: userId, nickname });
    return new Promise((resolve, reject) => {
      gateReject.current?.(); // 이전 pending 호출자를 settle — promise를 절대 leak하지 않는다
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
      const rows = await listTripMessages(getSupabaseBrowser(), tripId);
      setMessages(rows);
      setJoined(true);
      gateResolve.current?.({ uid, nickname: nick });
      gateResolve.current = null;
      gateReject.current = null;
    } catch (err) {
      console.error(err);
      toast('참여하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
      gateReject.current?.();
      gateResolve.current = null;
      gateReject.current = null;
    }
  }

  function handleCloseGate() {
    setGateOpen(false);
    gateReject.current?.();
    gateResolve.current = null;
    gateReject.current = null;
  }

  // append-only INSERT + id dedup — 자기 echo(sendTripMessage 반환행)와
  // postgres_changes 수신이 겹쳐도 1건만 남는다.
  function appendMessage(row: TripMessage) {
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
  }

  // 채널 소유 (moa-island pre-subscribe 체인 미러, trip_messages+presence로 축소).
  // join 전 구독 금지(Pitfall 4 / T-29-15): WALRUS가 비멤버 JWT로 RLS 재평가해
  // 무음 0건이 되고, presence key만 유령으로 남는다.
  useEffect(() => {
    if (!joined || !userId) return;
    const client = getSupabaseBrowser();
    const channel = client.channel(moaChannelName(tripId), {
      config: { presence: { key: userId } },
    });
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
        (payload) => appendMessage(payload.new as TripMessage),
      )
      .on('presence', { event: 'sync' }, () =>
        setViewers(Object.keys(channel.presenceState()).length),
      )
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            nickname,
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, joined, userId]);

  // 전송 — 비멤버면 게이트 합류 후 진행 (moa-island handleSend + requireMember 합성).
  async function handleSend(body: string, _replyTo: string | null) {
    let uid = userId;
    let nick = nickname;
    if (!joined || !uid) {
      // 취소 시 reject → compose가 draft 복원+토스트 (Pitfall 7 수용 — 명시적 비목표)
      const m = await requireMember();
      uid = m.uid;
      nick = m.nickname;
    }
    const input = TripMessageCreateSchema.parse({
      trip_id: tripId,
      nickname: nick,
      body,
      reply_to_place_id: null,
    });
    const row = await sendTripMessage(getSupabaseBrowser(), input);
    appendMessage(row); // postgres_changes echo는 id로 dedup됨
  }

  // 비멤버 compose 전송 — moa-chat send() 계약 미러(optimistic clear → 실패/취소 시
  // draft 복원 + 에러 토스트). 성공 시 joined 전환으로 MoaChat이 인계.
  async function sendAsGuest() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft(''); // optimistic clear
    try {
      await handleSend(body, null);
    } catch {
      setDraft(body); // restore the unsent text
      toast('메시지를 보내지 못했어요. 다시 시도해주세요.', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Open Q2 채택: /poll 투표를 authed 경로로 전환 — onRequireMember 존재 시
          PollVoteIsland가 castDateVoteAuthed(auth.uid 서버파생)를 쓴다. 재방문자의
          구 device_token 투표행 + 신 uid 투표행 중복 엣지는 낮은 확률(재방문+재투표
          교집합)·낮은 피해(집계 +1)로 수용 (RESEARCH Open Q2 / T-29-19). */}
      <PollVoteIsland
        code={code}
        tripId={tripId}
        mode={mode}
        status={status}
        options={options}
        deviceToken={userId ?? undefined}
        nickname={nickname || undefined}
        onRequireMember={requireMember}
      />

      {/* 통일 채팅 섹션 — 기존 위치·구분선 계승. poll closed와 무관하게 열림(A-8:
          채팅은 trip 소속). h-[400px]은 MoaChat의 flex h-full 전제(A-6). */}
      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">채팅</h3>
        <div className="h-[400px]">
          {joined ? (
            <MoaChat
              messages={messages}
              currentUserId={userId ?? ''}
              viewers={viewers}
              onSend={handleSend}
              replyToPlaceId={null}
              onClearReply={() => {}}
              placesById={{}} // A-9: /poll엔 장소 리스트가 없다 — 칩 전부 미해석·미렌더
              onChipTap={() => {}}
            />
          ) : (
            <div className="flex h-full flex-col">
              {/* 비멤버(A-7): 이력은 멤버 전용(RLS SELECT — T-29-18)이라 hydrate 자체
                  미실행. MoaChat 미마운트 — 멤버 빈 상태 카피와 이중 표시 충돌 회피. */}
              <p className="flex-1 py-10 text-center text-sm text-neutral-400">
                참여하면 지금까지의 대화를 볼 수 있어요
              </p>
              {/* Compose row — moa-chat 미러 (같은 클래스·IME 가드·maxLength 140). */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // 한글 IME 조합 중 Enter는 조합 확정용이므로 전송하지 않는다 (오전송 방지)
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) void sendAsGuest();
                  }}
                  placeholder="메시지 남기기"
                  maxLength={140}
                  disabled={sending}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void sendAsGuest()}
                  disabled={sending}
                  className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  보내기
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <NicknameGateSheet open={gateOpen} onConfirm={handleConfirmNickname} onClose={handleCloseGate} />
    </>
  );
}
