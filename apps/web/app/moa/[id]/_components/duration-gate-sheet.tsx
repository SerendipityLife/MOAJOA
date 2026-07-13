'use client';

import { useState } from 'react';
import { BottomSheet, Button } from '@/components';
import { DurationPills } from '@/app/onboarding/_components/duration-pills';

/**
 * DurationGateSheet — D-13 기간 미정 게이트 (Phase 28).
 *
 * `/moa/[id]`에서 기간이 미정인 모아(day_count·start_date 둘 다 null)의 '일정 만들기'는
 * 바로 생성하지 않고 이 시트를 먼저 연다 — 며칠짜리인지 모르면 AI가 동선을 나눌 수 없고,
 * 임의로 1일 플랜을 만들면 사용자가 고르지도 않은 기간이 확정돼버린다.
 *
 * 본문은 `DurationPills`(28-02)를 **그대로 재사용**한다. 시트용 pill을 새로 만들지 않는 것이
 * 그 컴포넌트의 존재 이유다 — 위저드 step 2와 이 시트가 같은 한 벌을 공유한다.
 *
 * ⚠ **owner에게만 열린다 (A-9).** `trips` UPDATE RLS가 owner 전용(0016)이라 editor 멤버의
 * day_count 저장은 조용히 실패한다. 비-owner에게는 PlanSection이 버튼 자체를 disabled로 두고
 * 이 시트를 열지 않는다 — 게이트는 UI(여기)와 DB(RLS) 2겹이다(T-28-18).
 *
 * props-driven: 선택된 dayCount만 로컬 UI 상태로 갖고, 저장(updateTrip)은 하지 않는다.
 * 콜백만 발화하고 실제 mutation은 moa-island(28-06)가 소유한다.
 */
export interface DurationGateSheetProps {
  open: boolean;
  onClose: () => void;
  /** 확정된 여행 기간(일수). 저장·생성은 호출부(island)가 이어서 한다. */
  onConfirm: (dayCount: number) => void;
}

export function DurationGateSheet({ open, onClose, onConfirm }: DurationGateSheetProps) {
  const [dayCount, setDayCount] = useState<number | null>(null);

  // 비활성 시각은 위저드 CTA와 동일(D-05/A-4): Button primary의 disabled:bg-brand-300 +
  // 흰 글씨 오버라이드. Button 컴포넌트 자체는 무수정.
  const footer = (
    <Button
      className="w-full disabled:text-white"
      disabled={dayCount === null}
      onClick={() => {
        if (dayCount !== null) onConfirm(dayCount);
      }}
    >
      이 기간으로 일정 만들기
    </Button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="여행 기간을 알려주세요" footer={footer}>
      <p className="pb-4 text-sm font-normal text-neutral-500">
        며칠 일정으로 짤지 정해야 AI가 동선을 나눌 수 있어요
      </p>
      <DurationPills value={dayCount} onChange={setDayCount} />
    </BottomSheet>
  );
}
