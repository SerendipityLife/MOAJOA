import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// 실 컴포넌트(BottomSheet · Button · SelectPill · DurationPills)를 그대로 쓴다 —
// 이 시트의 계약이 "DurationPills 한 벌 재사용"이라 mock으로 가리면 검증이 무의미하다.
import { DurationGateSheet } from '@/app/moa/[id]/_components/duration-gate-sheet';

const onClose = vi.fn();
const onConfirm = vi.fn();

beforeEach(() => {
  onClose.mockClear();
  onConfirm.mockClear();
});

describe('DurationGateSheet (D-13)', () => {
  it('Test 1: 기간 pill 6종이 렌더되고, 미선택 시 CTA가 disabled다', () => {
    render(<DurationGateSheet open onClose={onClose} onConfirm={onConfirm} />);

    for (const label of ['당일치기', '1박 2일', '2박 3일', '3박 4일', '4박 5일', '5박 6일']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const cta = screen.getByRole('button', { name: '이 기간으로 일정 만들기' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
  });

  it("Test 2: '2박 3일' 선택 후 CTA 탭 → onConfirm(3)이 정확히 1회", () => {
    render(<DurationGateSheet open onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('2박 3일'));
    const cta = screen.getByRole('button', { name: '이 기간으로 일정 만들기' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);

    fireEvent.click(cta);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(3);
  });
});
