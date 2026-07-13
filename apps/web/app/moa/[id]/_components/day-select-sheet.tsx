'use client';

import { BottomSheet, Button, SelectPill } from '@/components';

/**
 * DaySelectSheet — 미배치 풀 → Day 편입 / 타임라인 항목 Day 옮기기 (A-7).
 *
 * **드래그 앤 드롭이 아니라 버튼 + 시트다** — 이 phase의 계약이 그렇고, DnD는 deferred다.
 *
 * ⚠ **번호 체계 변환을 이 컴포넌트가 책임진다:** 사람에게는 1-based(`Day 1`)로 보여주고,
 * 콜백에는 0-based `day_index`를 넘긴다(`Day 1` → `onSelectDay(0)`). DB의 `plan_items.day_index`가
 * 0-based라서 생기는 혼동 지점이므로, 변환을 여기 한 곳에 가두고 호출부는 늘 day_index만 받는다.
 *
 * 보류 버튼(D-20)은 즉시 재생성·자동 배치를 하지 **않는다** — 풀에 남겨두고, 다음 재생성 때
 * AI가 배치하거나 사용자가 나중에 수동으로 옮긴다.
 *
 * props-driven: 로컬 상태 0. mutation은 moa-island(28-06)가 소유하고 여기선 콜백만 발화한다.
 */
export interface DaySelectSheetProps {
  open: boolean;
  onClose: () => void;
  /** Day 수 (1-based 표시 상한). PlanSection이 파생해 내려준다. */
  dayCount: number;
  /** 0-based day_index — 표시된 `Day N`의 값은 N-1이다. */
  onSelectDay: (dayIndex: number) => void;
  /** 보류 — 풀 잔류(D-20). */
  onSkip: () => void;
}

export function DaySelectSheet({
  open,
  onClose,
  dayCount,
  onSelectDay,
  onSkip,
}: DaySelectSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="며칠차에 넣을까요?">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: Math.max(dayCount, 1) }, (_, dayIndex) => (
          <SelectPill
            key={dayIndex}
            selected={false}
            onClick={() => onSelectDay(dayIndex)}
          >
            Day {dayIndex + 1}
          </SelectPill>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button variant="text" onClick={onSkip}>
          아직 모르겠다
        </Button>
      </div>
    </BottomSheet>
  );
}
