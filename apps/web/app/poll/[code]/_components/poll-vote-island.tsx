'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { castDateVote, getPollTally } from '@moajoa/api';
import { pollChannelName, type DateAvailabilityType } from '@moajoa/core';
import { Check } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  getDeviceToken,
  getStoredNickname,
  setStoredNickname,
} from '@/lib/device-token';
import { useToast } from '@/components';
import { PollChat } from './poll-chat';

type Mode = 'range' | 'grid';
type Status = 'open' | 'closed';

interface PollOption {
  id: string;
  start_date: string;
  end_date: string;
}

/** Range tally entry from poll_vote_tally (mode='range'). */
interface RangeTallyEntry {
  option_id: string;
  start_date: string;
  end_date: string;
  available_count: number;
  nicknames: string[];
}

/** Grid tally entry from poll_vote_tally (mode='grid'). */
interface GridTallyEntry {
  vote_date: string;
  available_count: number;
  nicknames: string[];
}

interface Props {
  code: string;
  tripId: string;
  mode: Mode;
  status: Status;
  options: PollOption[];
  /** Test seam: seed the range tally (skips network hydrate). */
  initialRangeTally?: RangeTallyEntry[];
  /** Test seam: seed the grid tally (skips network hydrate). */
  initialGridTally?: GridTallyEntry[];
  /** Test seam: seed the stored nickname (skips the gate). */
  initialNickname?: string;
}

/** `6/14–16` style label for a candidate range (single-day → just the day). */
function rangeLabel(start: string, end: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };
  return start === end ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
}

/**
 * Web anonymous voting island (Phase 19 / POLL-02 + POLL-03 read side).
 *
 * Hydration discipline (mirror vote-island.tsx): the SSR shell passes ONLY static
 * cached metadata (options/mode/status). Nickname, votes, live tally, and presence
 * all hydrate client-side here so the cookies-free anon cache is never poisoned
 * (RESEARCH Pitfall 2 GOTCHA). Votes go through the castDateVote anon RPC with an
 * optimistic update + rollback + error toast (the vote-island.tsx onToggleVote
 * template), and a vote broadcast fans the delta out to other viewers on the
 * public poll:{tripId} channel.
 */
export function PollVoteIsland({
  code,
  tripId,
  mode,
  status,
  options,
  initialRangeTally,
  initialGridTally,
  initialNickname,
}: Props) {
  const { toast } = useToast();

  const [nickname, setNickname] = useState(initialNickname ?? '');
  const [nicknameDraft, setNicknameDraft] = useState('');

  // My selections keyed by option_id (range) or vote_date (grid).
  const [mySelection, setMySelection] = useState<Record<string, DateAvailabilityType>>({});

  const [rangeTally, setRangeTally] = useState<RangeTallyEntry[]>(initialRangeTally ?? []);
  const [gridTally, setGridTally] = useState<GridTallyEntry[]>(initialGridTally ?? []);

  const [viewers, setViewers] = useState(0);

  // Stable per-mount channel handle so chat can broadcast on the SAME channel.
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowser>['channel']> | null>(
    null,
  );

  // Hydrate the persisted nickname client-side (returning visitor skips the gate).
  useEffect(() => {
    if (initialNickname) return;
    const stored = getStoredNickname();
    if (stored) setNickname(stored);
  }, [initialNickname]);

  // Hydrate the live tally client-side — NEVER from cached props (GOTCHA).
  useEffect(() => {
    if (initialRangeTally || initialGridTally) return;
    let active = true;
    (async () => {
      const client = getSupabaseBrowser();
      try {
        const raw = (await getPollTally(client, code)) as {
          mode: Mode;
          tally: RangeTallyEntry[] | GridTallyEntry[];
        } | null;
        if (!active || !raw) return;
        if (raw.mode === 'range') {
          setRangeTally(raw.tally as RangeTallyEntry[]);
        } else {
          setGridTally(raw.tally as GridTallyEntry[]);
        }
      } catch {
        // Tally is social proof — a hydrate failure leaves the empty state, not an error.
      }
    })();
    return () => {
      active = false;
    };
  }, [code, initialRangeTally, initialGridTally]);

  // One public Realtime channel: vote broadcasts + presence (chat reuses it).
  useEffect(() => {
    if (initialRangeTally || initialGridTally) return; // test seam: skip realtime
    const client = getSupabaseBrowser();
    const deviceToken = getDeviceToken();
    const channel = client.channel(pollChannelName(tripId), {
      config: { presence: { key: deviceToken } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'vote' }, () => {
        // Reconcile against server truth on any peer vote (mirror optimistic+reconcile).
        void refetchTally();
      })
      .on('presence', { event: 'sync' }, () => {
        setViewers(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({ nickname, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, code]);

  // Re-track presence when the nickname is set so peers see the real name.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !nickname) return;
    void channel.track({ nickname, online_at: new Date().toISOString() });
  }, [nickname]);

  async function refetchTally() {
    const client = getSupabaseBrowser();
    try {
      const raw = (await getPollTally(client, code)) as {
        mode: Mode;
        tally: RangeTallyEntry[] | GridTallyEntry[];
      } | null;
      if (!raw) return;
      if (raw.mode === 'range') setRangeTally(raw.tally as RangeTallyEntry[]);
      else setGridTally(raw.tally as GridTallyEntry[]);
    } catch {
      /* leave last-known tally */
    }
  }

  function confirmNickname() {
    const trimmed = nicknameDraft.trim();
    if (!trimmed) {
      toast('닉네임을 입력해야 투표할 수 있어요.', { variant: 'error' });
      return;
    }
    setNickname(trimmed);
    setStoredNickname(trimmed);
  }

  async function castVote(
    key: string,
    availability: DateAvailabilityType,
    voteArgs: { optionId?: string; voteDate?: string },
  ) {
    if (!nickname) {
      toast('닉네임을 입력해야 투표할 수 있어요.', { variant: 'error' });
      return;
    }
    const client = getSupabaseBrowser();
    const prev = mySelection[key];
    // Optimistic: flip my selection + nudge the tally count.
    setMySelection((s) => ({ ...s, [key]: availability }));
    applyTallyDelta(key, prev, availability);
    try {
      await castDateVote(client, {
        code,
        deviceToken: getDeviceToken(),
        nickname,
        optionId: voteArgs.optionId,
        voteDate: voteArgs.voteDate,
        availability,
      });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'vote',
        payload: { key, availability, nickname },
      });
    } catch {
      // Rollback the optimistic selection + count.
      setMySelection((s) => {
        const next = { ...s };
        if (prev === undefined) delete next[key];
        else next[key] = prev;
        return next;
      });
      applyTallyDelta(key, availability, prev);
      toast('투표를 저장하지 못했어요. 잠시 후 다시 시도해주세요.', {
        variant: 'error',
      });
    }
  }

  /** Adjust the local available-count when my vote moves between from→to (range mode only). */
  function applyTallyDelta(
    key: string,
    from: DateAvailabilityType | undefined,
    to: DateAvailabilityType | undefined,
  ) {
    if (mode !== 'range') return;
    const wasAvail = from === 'available';
    const isAvail = to === 'available';
    if (wasAvail === isAvail) return;
    setRangeTally((t) => {
      const idx = t.findIndex((e) => e.option_id === key);
      const delta = isAvail ? 1 : -1;
      if (idx >= 0) {
        const next = [...t];
        next[idx] = {
          ...next[idx]!,
          available_count: Math.max(0, next[idx]!.available_count + delta),
        };
        return next;
      }
      // No tally row yet — seed one from the option metadata.
      const opt = options.find((o) => o.id === key);
      if (!opt || delta < 0) return t;
      return [
        ...t,
        {
          option_id: opt.id,
          start_date: opt.start_date,
          end_date: opt.end_date,
          available_count: 1,
          nicknames: [nickname],
        },
      ];
    });
  }

  // ── Closed poll → 확정 result + conversion CTA (Screen 5) ──────────────────
  if (status === 'closed') {
    const confirmed = options[0];
    return (
      <section className="mt-8">
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <Check className="size-4" strokeWidth={2.6} />
            </span>
            <h2 className="text-2xl font-semibold text-neutral-900">
              확정{confirmed ? `: ${rangeLabel(confirmed.start_date, confirmed.end_date)}` : ''}
            </h2>
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            함께 정한 날짜로 여행 일정이 확정됐어요. 투표는 마감됐어요.
          </p>
          <a
            href="/login"
            className="mt-4 block rounded-lg bg-brand-600 px-4 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-brand-700"
          >
            이 여행에 함께하기
          </a>
          <p className="mt-2 text-center text-xs text-neutral-500">
            함께 정한 일정을 앱에서 이어가요
          </p>
        </div>

        <PollChat code={code} tripId={tripId} status={status} nickname={nickname} />
      </section>
    );
  }

  // ── Nickname gate (Screen 4a) ─────────────────────────────────────────────
  if (!nickname) {
    return (
      <section className="mt-8">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-900">
            먼저 닉네임을 정해주세요
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            누가 가능한지 호스트가 알 수 있게 이름을 남겨주세요.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmNickname();
              }}
              placeholder="닉네임"
              maxLength={20}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300"
            />
            <button
              type="button"
              onClick={confirmNickname}
              className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              시작하기
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Doodle-style leader badge: the max available_count among range options.
  const rangeMax = Math.max(0, ...rangeTally.map((e) => e.available_count));
  const gridMax = Math.max(0, ...gridTally.map((e) => e.available_count));

  return (
    <section className="mt-8">
      {/* Presence strip — "지금 N명 보는 중" (hidden at 0, singular at 1). */}
      {viewers > 0 && (
        <div className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
          <span>{viewers <= 1 ? '지금 보는 중' : `지금 ${viewers}명 보는 중`}</span>
        </div>
      )}

      {/* 4b — Vote input (two modes, binary 가능/불가). */}
      {mode === 'range' ? (
        <ul className="space-y-2">
          {options.map((o) => {
            const sel = mySelection[o.id];
            return (
              <li key={o.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-neutral-900">
                    {rangeLabel(o.start_date, o.end_date)}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      aria-pressed={sel === 'available'}
                      onClick={() => void castVote(o.id, 'available', { optionId: o.id })}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        sel === 'available'
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-300'
                      }`}
                    >
                      가능
                    </button>
                    <button
                      type="button"
                      aria-pressed={sel === 'unavailable'}
                      onClick={() => void castVote(o.id, 'unavailable', { optionId: o.id })}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        sel === 'unavailable'
                          ? 'border-neutral-300 bg-neutral-100 text-neutral-600'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      불가
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <GridCalendar
          options={options}
          mySelection={mySelection}
          onToggle={(date) => {
            const next = mySelection[date] === 'available' ? 'unavailable' : 'available';
            void castVote(date, next, { voteDate: date });
          }}
        />
      )}

      {/* 4c — Live aggregate (Doodle-style). */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">지금까지 집계</h3>
        {mode === 'range' ? (
          rangeTally.length === 0 ? (
            <p className="text-sm text-neutral-400">아직 아무도 투표하지 않았어요</p>
          ) : (
            <ul className="space-y-2">
              {rangeTally.map((e) => {
                const isLeader = e.available_count > 0 && e.available_count === rangeMax;
                return (
                  <li key={e.option_id} className="rounded-lg bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {rangeLabel(e.start_date, e.end_date)}
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          {e.available_count}명 가능
                        </span>
                      </span>
                      {isLeader && (
                        <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          최다
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className={`h-full rounded-full ${isLeader ? 'bg-brand-600' : 'bg-brand-300'}`}
                        style={{
                          width: `${Math.round((e.available_count / Math.max(1, rangeMax)) * 100)}%`,
                        }}
                      />
                    </div>
                    {e.nicknames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.nicknames.map((n) => (
                          <span
                            key={n}
                            className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : gridTally.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 아무도 투표하지 않았어요</p>
        ) : (
          <ul className="space-y-1.5">
            {gridTally.map((e) => {
              const isLeader = e.available_count > 0 && e.available_count === gridMax;
              return (
                <li
                  key={e.vote_date}
                  className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                >
                  <span className="text-neutral-900">
                    {e.vote_date} · {e.available_count}명 가능
                  </span>
                  {isLeader && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      최다
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PollChat code={code} tripId={tripId} status={status} nickname={nickname} />
    </section>
  );
}

/**
 * Tap-per-cell month grid for grid mode (drag-to-paint deferred — RESEARCH
 * Environment fallback). Renders the union of all option windows as tappable days;
 * 가능 cells fill brand.
 */
function GridCalendar({
  options,
  mySelection,
  onToggle,
}: {
  options: PollOption[];
  mySelection: Record<string, DateAvailabilityType>;
  onToggle: (date: string) => void;
}) {
  const days = useMemo(() => {
    const set = new Set<string>();
    for (const o of options) {
      let d = new Date(`${o.start_date}T00:00:00Z`);
      const end = new Date(`${o.end_date}T00:00:00Z`);
      while (d <= end) {
        set.add(d.toISOString().slice(0, 10));
        d = new Date(d.getTime() + 86400000);
      }
    }
    return [...set].sort();
  }, [options]);

  if (days.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-400">
        투표할 날짜가 아직 없어요
      </p>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const avail = mySelection[date] === 'available';
        const [, m, day] = date.split('-');
        return (
          <button
            key={date}
            type="button"
            aria-pressed={avail}
            onClick={() => onToggle(date)}
            className={`flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border text-xs transition-colors ${
              avail
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-brand-300'
            }`}
          >
            <span className="text-[10px] opacity-70">{Number(m)}월</span>
            <span className="text-sm font-semibold">{Number(day)}</span>
          </button>
        );
      })}
    </div>
  );
}
