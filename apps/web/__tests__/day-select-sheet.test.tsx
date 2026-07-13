import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DaySelectSheet } from '@/app/moa/[id]/_components/day-select-sheet';

const onClose = vi.fn();
const onSelectDay = vi.fn();
const onSkip = vi.fn();

beforeEach(() => {
  onClose.mockClear();
  onSelectDay.mockClear();
  onSkip.mockClear();
});

describe('DaySelectSheet (A-7 · D-20)', () => {
  it('Test 1: dayCount=4면 Day 1~4 pill이 렌더된다', () => {
    render(
      <DaySelectSheet
        open
        onClose={onClose}
        dayCount={4}
        onSelectDay={onSelectDay}
        onSkip={onSkip}
      />,
    );
    expect(screen.getByText('며칠차에 넣을까요?')).toBeTruthy();
    for (const label of ['Day 1', 'Day 2', 'Day 3', 'Day 4']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('Day 5')).toBeNull();
  });

  it('Test 2: Day 2 선택 → onSelectDay(1) — 표시는 1-based, 값은 0-based day_index', () => {
    render(
      <DaySelectSheet
        open
        onClose={onClose}
        dayCount={4}
        onSelectDay={onSelectDay}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByText('Day 2'));
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(onSelectDay).toHaveBeenCalledWith(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("Test 3: '아직 모르겠다' 탭 → onSkip() (풀 잔류, D-20)", () => {
    render(
      <DaySelectSheet
        open
        onClose={onClose}
        dayCount={3}
        onSelectDay={onSelectDay}
        onSkip={onSkip}
      />,
    );
    fireEvent.click(screen.getByText('아직 모르겠다'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSelectDay).not.toHaveBeenCalled();
  });
});
