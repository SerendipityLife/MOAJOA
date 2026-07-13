'use client';

import { Limits } from '@moajoa/core';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import { Button } from '@/components';
import { DurationPills } from './duration-pills';
import { deriveDayCount, isDayCountWithinLimit, type DateMode } from '../_lib/build-draft';

/**
 * Step 2 — "언제 가요?" (D-06 · D-07 · A-8). 기간 pill이 **1차 UI**이고, 캘린더는
 * 폐기하지 않고 버튼 뒤로 옮겼다(escape hatch). 세 경로:
 *  - 기간 pill 6종 → 일수만 정함 (`duration`)
 *  - 정확한 날짜 진입 버튼 → 기존 캘린더 range 픽커 인라인 노출 (`fixed`)
 *  - 날짜 미정 버튼 → 통과 (`unset`, ONBOARD-04) — 레퍼런스엔 없지만 제거하면 요구사항 회귀
 *
 * 세 경로는 **상호 배타**다 (전환 시 상대 값을 비우는 건 page.tsx 몫).
 * 상태(mode·dayCount·range)는 전부 page.tsx가 소유한다 — 이 컴포넌트는 로컬 상태 없이
 * props/콜백만 받는 순수 표시 컴포넌트다(Phase 24 D-02).
 */

interface StepDatesProps {
  mode: DateMode | null;
  /** 기간 pill로 고른 일수. 미선택은 null. */
  dayCount: number | null;
  range: DateRange | undefined;
  onDayCountChange: (dayCount: number) => void;
  onModeChange: (mode: DateMode) => void;
  onRangeChange: (range: DateRange | undefined) => void;
}

// nav는 headless라 static 배치 시 좌측에 뭉침 → 캡션 행 양옆에 absolute 배치
// (share-sheet DAY_PICKER_CLASS_NAMES와 미러 유지).
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

export function StepDates({
  mode,
  dayCount,
  range,
  onDayCountChange,
  onModeChange,
  onRangeChange,
}: StepDatesProps) {
  // 상한 판정은 build-draft의 함수 한 벌을 공유한다 — page.tsx의 canProceed와 같은 판정을
  // 써야 "카피는 뜨는데 CTA는 눌린다" 같은 어긋남이 안 생긴다.
  const derived = deriveDayCount(range?.from, range?.to);
  const overLimit = !isDayCountWithinLimit(derived);

  return (
    <div className="flex flex-col gap-6">
      <DurationPills
        value={mode === 'duration' ? dayCount : null}
        onChange={onDayCountChange}
      />

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onModeChange('fixed')}>
          정확한 날짜 고르기
        </Button>
        <Button variant="text" size="sm" onClick={() => onModeChange('unset')}>
          나중에 정할게요
        </Button>
      </div>

      {mode === 'fixed' && (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border border-neutral-200 bg-surface-raised p-3">
            <DayPicker
              mode="range"
              locale={ko}
              selected={range}
              onSelect={onRangeChange}
              disabled={{ before: new Date() }}
              // 1차 방어: 31일 이상 range를 **애초에 선택할 수 없게** 한다. 이 숫자는
              // 0031 CHECK · core Zod와 같은 단일 소스여야 한다(리터럴 금지) — 어긋나면
              // 정상적인 장기 여행이 INSERT에서 거부되어 모아 생성이 통째로 실패한다.
              max={Limits.TripDayCountMax}
              classNames={DAY_PICKER_CLASS_NAMES}
            />
          </div>

          {/* `max`가 정상 경로를 이미 막지만, RDP가 range를 리셋 대신 잘라낼 여지가 있어
              "왜 원하는 만큼 못 고르는지"를 설명하는 방어적 안내다. */}
          {overLimit && (
            <p className="text-sm text-danger">
              여행 기간은 최대 30일까지 정할 수 있어요. 날짜를 다시 골라주세요
            </p>
          )}
        </div>
      )}

      {mode === 'unset' && (
        <p className="text-center text-sm text-neutral-500">
          날짜는 나중에 친구들과 함께 정할 수 있어요
        </p>
      )}
    </div>
  );
}
