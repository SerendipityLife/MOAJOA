'use client';

import { useRouter } from 'next/navigation';
import type { Trip } from '@moajoa/core';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components';

export interface MoaSwitcherProps {
  currentTripId: string;
  title: string;
  /**
   * 내 모아 목록. 미전달/빈 배열이면 드롭다운 없이 정적 pill만 렌더한다 —
   * 게스트 공유뷰(/t/[slug])는 남의 모아 열람이라 갈아탈 목록이 없다.
   */
  moas?: Trip[];
}

/**
 * MoaSwitcher — 지도 좌상단 "{모아 제목} ▾" pill.
 *
 * 모아 전환에 화면 이동(지도 언마운트 → 리스트 → 다시 지도)을 강요하지 않는다.
 * pill을 누르면 내 모아 목록이 바로 아래(align=start) 열리고, 고르면 그 지도로 라우팅한다.
 * 별도 /moa 리스트 화면이 사라지므로 /discover 진입을 여기서 보전한다.
 */
export function MoaSwitcher({ currentTripId, title, moas }: MoaSwitcherProps) {
  const router = useRouter();

  // 좌상단 오버레이 위치·레이어는 기존 버튼과 동일. max-w-180px는 좁은 폰(375px)에서
  // 우측 [함께 정하기](right-4 top-4)와 겹치지 않는 제목 상한이다.
  const pill = (
    <>
      <span className="max-w-[180px] truncate text-sm font-semibold text-neutral-900">
        {title}
      </span>
      <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
    </>
  );
  const pillClass =
    'absolute left-4 top-4 z-50 flex items-center gap-1 rounded-full bg-white px-3 py-2 shadow-md';

  if (!moas || moas.length === 0) {
    return <div className={pillClass}>{pill}</div>;
  }

  function onPick(id: string) {
    if (id === currentTripId) return; // 현재 모아 — 라우팅 없이 그냥 닫힌다.
    router.push(`/moa/${id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="모아 바꾸기" className={pillClass}>
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        {moas.map((m) => {
          const isCurrent = m.id === currentTripId;
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => onPick(m.id)}
              {...(isCurrent && { 'aria-current': true })}
            >
              {isCurrent ? (
                <Check className="size-4 shrink-0 text-brand-600" aria-hidden />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="truncate">{m.title}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/onboarding')}>
          새 모아 만들기
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/discover')}>둘러보기</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
