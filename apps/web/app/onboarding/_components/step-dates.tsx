'use client';

import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';

/**
 * Step 2 — "언제 가요?" (D-06, ONBOARD-04). 2택 카드:
 *  - "날짜 정했어요" → 아래 캘린더 range 픽커(시작·종료 한 캘린더에서 탭 2번, 같은 날 재탭=당일치기)
 *  - "아직 미정이에요" → 안내 한 줄 후 통과(dates null)
 * 상태(mode·range)는 page.tsx 소유. A-8: default style.css 미사용 — classNames로 Tailwind 매핑.
 */

interface StepDatesProps {
  mode: 'fixed' | 'unset' | null;
  range: DateRange | undefined;
  onModeChange: (mode: 'fixed' | 'unset') => void;
  onRangeChange: (range: DateRange | undefined) => void;
}

function ModeCard({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-xl border border-brand-500 bg-brand-50 p-4 text-left text-base text-neutral-900'
          : 'rounded-xl border border-neutral-200 bg-surface-raised p-4 text-left text-base text-neutral-900'
      }
    >
      {label}
    </button>
  );
}

const DAY_PICKER_CLASS_NAMES = {
  root: 'w-full',
  months: 'flex justify-center',
  month: 'w-full',
  month_caption: 'flex justify-center py-2 text-base font-semibold text-neutral-900',
  nav: 'flex items-center justify-between px-1',
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

export function StepDates({ mode, range, onModeChange, onRangeChange }: StepDatesProps) {
  return (
    <div className="flex flex-col gap-3">
      <ModeCard
        active={mode === 'fixed'}
        label="날짜 정했어요"
        onClick={() => onModeChange('fixed')}
      />
      <ModeCard
        active={mode === 'unset'}
        label="아직 미정이에요"
        onClick={() => onModeChange('unset')}
      />

      {mode === 'fixed' && (
        <div className="rounded-xl border border-neutral-200 bg-surface-raised p-3">
          <DayPicker
            mode="range"
            locale={ko}
            selected={range}
            onSelect={onRangeChange}
            disabled={{ before: new Date() }}
            classNames={DAY_PICKER_CLASS_NAMES}
          />
        </div>
      )}

      {mode === 'unset' && (
        <p className="text-sm text-neutral-500">
          날짜는 나중에 친구들과 함께 정할 수 있어요
        </p>
      )}
    </div>
  );
}
