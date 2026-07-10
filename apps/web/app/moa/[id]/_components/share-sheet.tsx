'use client';

import { useEffect, useState } from 'react';
import type { ShareModeType, Trip } from '@moajoa/core';
import {
  addPollOption,
  createDatePoll,
  getPollByTrip,
  getPollOptions,
  removePollOption,
  shareMoa,
  type PollOption,
} from '@moajoa/api';
import { X } from 'lucide-react';
import { BottomSheet, Button, useToast } from '@/components';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/cn';

/**
 * ShareSheet — [함께 정하기] 공유 시트 (SHARE-01, D-17/18/19).
 *
 * 모드 3택(날짜/장소/둘다) → shareMoa로 slug 발급·mode 갱신(재호출 시 같은 slug 유지,
 * owner-only는 trips UPDATE RLS 게이트). CTA는 클립보드 복사 우선(D-18) + navigator.share
 * 있으면 시스템 시트(AbortError 무시 — RESEARCH Pitfall 5).
 *   D-17: 날짜 확정 모아(start_date != null)는 '날짜 정하기' 미렌더 → 2택(클라 몫).
 *   D-19: 열 때 trip.share_mode 프리셋, 다른 모드 선택 시 같은 slug 재복사.
 *
 * 후보 날짜 step (25-07 Gap 1): dates/both 공유 시 date_poll을 ensure(기존 poll 재사용,
 * 없으면 createDatePoll — 0018 RLS 게이트 직접 INSERT)하고 같은 시트에서 후보 날짜를
 * 추가·삭제한다. 게스트 /t 날짜투표는 이 후보(options)에 투표한다.
 */
export interface ShareSheetProps {
  trip: Trip;
  open: boolean;
  onClose: () => void;
  /** island이 로컬 trip.share_mode를 갱신(재열림 프리셋 일관성). */
  onShared?: (mode: ShareModeType) => void;
}

const MODES: { mode: ShareModeType; title: string; desc: string }[] = [
  { mode: 'dates', title: '날짜 정하기', desc: '언제 갈지 투표로 정해요' },
  { mode: 'places', title: '장소 정하기', desc: '어디 갈지 찜으로 정해요' },
  { mode: 'both', title: '둘다 정하기', desc: '날짜와 장소 모두 함께 정해요' },
];

function presetOf(trip: Trip): ShareModeType | null {
  return trip.share_mode ?? (trip.start_date ? 'places' : null);
}

/** `6/14–16` 후보 라벨 — poll-vote-island rangeLabel 미러(export 안 됨·3줄이라 추상화 금지). */
function rangeLabel(start: string, end: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  };
  return start === end ? fmt(start) : `${fmt(start)}–${fmt(end)}`;
}

export function ShareSheet({ trip, open, onClose, onShared }: ShareSheetProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ShareModeType | null>(presetOf(trip));
  // 후보 날짜 step (25-07 Gap 1) — dates/both 공유 후 같은 시트에서 옵션 세팅.
  const [step, setStep] = useState<'mode' | 'options'>('mode');
  const [poll, setPoll] = useState<{ id: string; poll_code: string | null } | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');

  // 재열림 시 현재 share_mode로 프리셋 재동기화(D-19) + step 리셋.
  useEffect(() => {
    if (open) {
      setSelected(presetOf(trip));
      setStep('mode');
    }
  }, [open, trip.share_mode, trip.start_date]); // eslint-disable-line react-hooks/exhaustive-deps

  // D-17: 날짜 확정 모아는 'dates' 카드 미렌더(disabled 아님).
  const visibleModes = MODES.filter((m) => !(m.mode === 'dates' && trip.start_date !== null));

  async function handleShare() {
    if (!selected) return;
    const client = getSupabaseBrowser();
    try {
      const slug = await shareMoa(client, trip.id, selected);
      const url = `${window.location.origin}/t/${slug}`;
      await navigator.clipboard.writeText(url); // D-18: 복사 우선
      toast('링크를 복사했어요');
      onShared?.(selected);
      if (selected === 'places') {
        // 기존 동작 그대로 (diff 0 경로).
        if (navigator.share) {
          try {
            await navigator.share({ url });
          } catch (e) {
            if ((e as Error).name !== 'AbortError') throw e; // Pitfall 5
          }
        }
        return;
      }
    } catch {
      toast('링크를 만들지 못했어요. 다시 시도해 주세요', { variant: 'error' });
      return;
    }

    // dates/both — poll ensure(멱등: 기존 poll 재사용) 후 후보 날짜 step 전환(Gap 1).
    // 이 경로는 navigator.share 생략 — 호스트가 후보 날짜부터 세팅하도록 시트를 이어간다.
    // 링크는 이미 클립보드에 있음(재량 결정, 25-07).
    try {
      const existing = await getPollByTrip(client, trip.id);
      const p = existing ?? (await createDatePoll(client, trip.id, 'range'));
      const opts = await getPollOptions(client, p.id);
      setPoll({ id: p.id, poll_code: p.poll_code });
      setOptions(opts);
      setStep('options');
    } catch {
      // 공유(링크)는 이미 성공 — 옵션 단계 실패는 별도 토스트.
      toast('저장하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  async function handleAddOption() {
    if (!poll) return;
    // 가드: 둘 다 입력 + 종료 >= 시작 (YYYY-MM-DD 문자열 비교로 충분).
    if (!draftStart || !draftEnd || draftEnd < draftStart) {
      toast('날짜를 확인해 주세요', { variant: 'error' });
      return;
    }
    try {
      const row = await addPollOption(getSupabaseBrowser(), poll.id, {
        startDate: draftStart,
        endDate: draftEnd,
      });
      setOptions((prev) => [...prev, row]);
      setDraftStart('');
      setDraftEnd('');
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  async function handleRemoveOption(optionId: string) {
    try {
      await removePollOption(getSupabaseBrowser(), optionId);
      setOptions((prev) => prev.filter((o) => o.id !== optionId));
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="함께 정하기">
      {step === 'mode' ? (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-2">
            {visibleModes.map((m) => {
              const isSel = selected === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => setSelected(m.mode)}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-xl border p-4 text-left',
                    isSel ? 'border-brand-500 bg-brand-50' : 'border-neutral-200',
                  )}
                >
                  <span className="text-base font-semibold text-neutral-900">{m.title}</span>
                  <span className="text-sm font-normal text-neutral-500">{m.desc}</span>
                </button>
              );
            })}
          </div>

          <Button className="w-full" disabled={!selected} onClick={() => void handleShare()}>
            링크 복사하기
          </Button>
        </div>
      ) : (
        /* 후보 날짜 step (25-07 Gap 1) — 게스트가 투표할 날짜 윈도우 세팅. */
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-neutral-700">후보 날짜</h3>
            <p className="text-sm font-normal text-neutral-500">게스트가 이 날짜들 중에 투표해요</p>
          </div>

          {options.length > 0 && (
            <ul className="flex flex-col gap-2">
              {options.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 py-1 pl-3 pr-1"
                >
                  <span className="text-base font-semibold text-neutral-900">
                    {rangeLabel(o.start_date, o.end_date)}
                  </span>
                  <button
                    type="button"
                    aria-label="후보 삭제"
                    onClick={() => void handleRemoveOption(o.id)}
                    className="grid size-11 place-items-center text-[#EF4444]"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="시작일"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
            />
            <input
              type="date"
              aria-label="종료일"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
            />
            <Button size="sm" onClick={() => void handleAddOption()}>
              추가
            </Button>
          </div>

          {/* 빈 poll 공유 방지 넛지 — 후보 0개면 완료 비활성. */}
          <Button className="w-full" disabled={options.length === 0} onClick={onClose}>
            완료
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
