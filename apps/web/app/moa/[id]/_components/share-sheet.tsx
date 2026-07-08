'use client';

import { useEffect, useState } from 'react';
import type { ShareModeType, Trip } from '@moajoa/core';
import { shareMoa } from '@moajoa/api';
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

export function ShareSheet({ trip, open, onClose, onShared }: ShareSheetProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ShareModeType | null>(presetOf(trip));

  // 재열림 시 현재 share_mode로 프리셋 재동기화(D-19).
  useEffect(() => {
    if (open) setSelected(presetOf(trip));
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
      if (navigator.share) {
        try {
          await navigator.share({ url });
        } catch (e) {
          if ((e as Error).name !== 'AbortError') throw e; // Pitfall 5
        }
      }
    } catch {
      toast('링크를 만들지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="함께 정하기">
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
    </BottomSheet>
  );
}
