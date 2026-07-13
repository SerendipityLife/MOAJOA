'use client';

import { SelectPill } from '@/components';

/**
 * DurationPills — Phase 28 D-06. 기간 pill 6종 **한 벌 구현**.
 *
 * step-dates(위저드 step 2)와 DurationGateSheet(D-13 기간 게이트)가 이 컴포넌트를
 * **공유**한다 — 시트 쪽에 pill을 다시 만들지 않는다. 기간 옵션의 단일 출처.
 *
 * 라벨은 레퍼런스 표기 그대로(박/일 사이 공백 포함). 매핑: 당일치기=1, N박=N+1.
 *
 * 상태를 소유하지 않는다 — 부모(page.tsx 또는 게이트 시트)가 value를 소유하고
 * onChange로 갱신한다(Phase 24 D-02 구조 유지). DB·네트워크 접촉 0.
 */

export const DURATION_OPTIONS = [
  { label: '당일치기', dayCount: 1 },
  { label: '1박 2일', dayCount: 2 },
  { label: '2박 3일', dayCount: 3 },
  { label: '3박 4일', dayCount: 4 },
  { label: '4박 5일', dayCount: 5 },
  { label: '5박 6일', dayCount: 6 },
] as const;

interface DurationPillsProps {
  /** 선택된 일수(dayCount). 미선택은 null. */
  value: number | null;
  onChange: (dayCount: number) => void;
}

export function DurationPills({ value, onChange }: DurationPillsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DURATION_OPTIONS.map((opt) => (
        <SelectPill
          key={opt.dayCount}
          selected={value === opt.dayCount}
          onClick={() => onChange(opt.dayCount)}
        >
          {opt.label}
        </SelectPill>
      ))}
    </div>
  );
}
