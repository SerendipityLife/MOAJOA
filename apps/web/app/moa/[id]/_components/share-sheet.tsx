'use client';

import { useEffect, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
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

/** 로컬 YYYY-MM-DD — toISOString의 UTC 시프트 회피 (onboarding build-draft 미러). */
function toLocalYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** step-dates.tsx DAY_PICKER_CLASS_NAMES 미러 (A-8: default style.css 미사용).
 *  nav는 headless라 static 배치 시 좌측에 뭉침 → 캡션 행 양옆에 absolute 배치. */
const DAY_PICKER_CLASS_NAMES = {
  root: 'relative w-full',
  months: 'flex justify-center',
  month: 'w-full',
  month_caption: 'flex justify-center py-2 text-base font-semibold text-neutral-900',
  nav: 'absolute inset-x-1 top-1 z-10 flex items-center justify-between',
  button_previous: 'grid size-9 place-items-center rounded-full hover:bg-neutral-100',
  button_next: 'grid size-9 place-items-center rounded-full hover:bg-neutral-100',
  chevron: 'size-5 fill-neutral-600',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'flex-1 text-center text-xs font-normal text-neutral-500',
  week: 'flex',
  day: 'flex-1 p-0.5',
  day_button:
    'mx-auto grid size-11 place-items-center rounded-full text-sm text-neutral-900 hover:bg-neutral-100',
  today: 'font-semibold text-brand-600',
  disabled: 'text-neutral-300 pointer-events-none',
  range_start: '[&_button]:bg-brand-600 [&_button]:text-white [&_button]:rounded-full',
  range_end: '[&_button]:bg-brand-600 [&_button]:text-white [&_button]:rounded-full',
  range_middle: '[&_button]:bg-brand-100 [&_button]:text-brand-700 [&_button]:rounded-none',
} as const;

export function ShareSheet({ trip, open, onClose, onShared }: ShareSheetProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ShareModeType | null>(presetOf(trip));
  // 후보 날짜 step (25-07 Gap 1) — dates/both 공유 후 같은 시트에서 옵션 세팅.
  const [step, setStep] = useState<'mode' | 'options'>('mode');
  const [poll, setPoll] = useState<{ id: string; poll_code: string | null } | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  // 한 달력에서 시작→종료 연속 탭(같은 날 재탭=당일치기) — 추가 후 초기화돼 연달아 등록.
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  // WR-01: 더블탭이 createDatePoll을 레이스시키면 중복 poll → getPollByTrip 영구 에러.
  const [sharing, setSharing] = useState(false);

  // 재열림 시 현재 share_mode로 프리셋 재동기화(D-19) + step 리셋.
  // 이미 dates/both로 공유했는데 후보 날짜가 0개면(빈 poll — 게스트가 투표 불가)
  // 바로 후보 단계로 점프해 미완성 상태를 복구시킨다 (UAT: 단계를 못 보고 닫은 케이스).
  useEffect(() => {
    if (!open) return;
    setSelected(presetOf(trip));
    setStep('mode');
    if (trip.share_mode !== 'dates' && trip.share_mode !== 'both') return;
    let active = true;
    (async () => {
      try {
        const client = getSupabaseBrowser();
        const p = await getPollByTrip(client, trip.id);
        if (!active || !p) return;
        const opts = await getPollOptions(client, p.id);
        if (!active || opts.length > 0) return;
        setPoll({ id: p.id, poll_code: p.poll_code });
        setOptions(opts);
        setStep('options');
      } catch {
        /* 조회 실패는 조용히 — mode step 그대로 */
      }
    })();
    return () => {
      active = false;
    };
  }, [open, trip.share_mode, trip.start_date]); // eslint-disable-line react-hooks/exhaustive-deps

  // D-17: 날짜 확정 모아는 'dates' 카드 미렌더(disabled 아님).
  const visibleModes = MODES.filter((m) => !(m.mode === 'dates' && trip.start_date !== null));

  async function handleShare() {
    if (!selected || sharing) return;
    setSharing(true);
    try {
      await doShare();
    } finally {
      setSharing(false);
    }
  }

  async function doShare() {
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
    const from = draftRange?.from;
    if (!from) {
      toast('날짜를 확인해 주세요', { variant: 'error' });
      return;
    }
    // 종료 미탭 = 당일치기(from만).
    const to = draftRange?.to ?? from;
    try {
      const row = await addPollOption(getSupabaseBrowser(), poll.id, {
        startDate: toLocalYmd(from),
        endDate: toLocalYmd(to),
      });
      setOptions((prev) => [...prev, row]);
      setDraftRange(undefined); // 다음 후보를 같은 달력에서 바로 이어서 선택
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

  // 스크롤 영역 밖 고정 CTA — 달력이 길어도, iOS 툴바가 겹쳐도 항상 노출.
  const footer =
    step === 'mode' ? (
      <Button className="w-full" disabled={!selected || sharing} onClick={() => void handleShare()}>
        링크 복사하기
      </Button>
    ) : (
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={!draftRange?.from}
          onClick={() => void handleAddOption()}
        >
          {draftRange?.from
            ? `${rangeLabel(
                toLocalYmd(draftRange.from),
                toLocalYmd(draftRange.to ?? draftRange.from),
              )} 후보로 추가`
            : '달력에서 기간을 선택하세요'}
        </Button>
        {/* 빈 poll 공유 방지 넛지 — 후보 0개면 완료 비활성. */}
        <Button
          className="w-full"
          variant="outline"
          disabled={options.length === 0}
          onClick={onClose}
        >
          완료
        </Button>
      </div>
    );

  return (
    <BottomSheet open={open} onClose={onClose} title="함께 정하기" footer={footer}>
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
                    className="grid size-11 place-items-center text-danger"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 한 달력 range 픽커 — 시작 탭 → 종료 탭 (같은 날 재탭=당일치기). */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <DayPicker
              mode="range"
              locale={ko}
              selected={draftRange}
              onSelect={setDraftRange}
              disabled={{ before: new Date() }}
              classNames={DAY_PICKER_CLASS_NAMES}
            />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
