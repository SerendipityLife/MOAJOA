'use client';

/** RED stub — 28-05 Task 1. 구현은 GREEN 커밋에서. */
export interface DaySelectSheetProps {
  open: boolean;
  onClose: () => void;
  dayCount: number;
  onSelectDay: (dayIndex: number) => void;
  onSkip: () => void;
}

export function DaySelectSheet(_props: DaySelectSheetProps) {
  return null;
}
