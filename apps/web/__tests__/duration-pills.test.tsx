import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DurationPills } from '@/app/onboarding/_components/duration-pills';

/**
 * DurationPills — Phase 28 D-06. 기간 pill 6종 **한 벌**.
 * step-dates(28-04)와 DurationGateSheet(28-05)가 이 컴포넌트를 공유한다 —
 * 시트 쪽에 pill을 다시 만들지 않는다.
 *
 * 상태를 소유하지 않는 순수 프레젠테이션(부모가 value/onChange 소유, Phase 24 D-02).
 * 라벨→dayCount 매핑: 당일치기=1, N박=N+1.
 */
describe('DurationPills', () => {
  const LABELS = ['당일치기', '1박 2일', '2박 3일', '3박 4일', '4박 5일', '5박 6일'];

  it('6개 pill이 레퍼런스 라벨 그대로 렌더된다', () => {
    render(<DurationPills value={null} onChange={vi.fn()} />);

    for (const label of LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it("'2박 3일' 클릭 시 onChange(3)이 호출된다", () => {
    const onChange = vi.fn();
    render(<DurationPills value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '2박 3일' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("value=4면 '3박 4일'만 aria-pressed=true, 나머지 5개는 false", () => {
    render(<DurationPills value={4} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '3박 4일' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const label of LABELS.filter((l) => l !== '3박 4일')) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('value=null이면 어떤 pill도 눌린 상태가 아니다', () => {
    render(<DurationPills value={null} onChange={vi.fn()} />);

    for (const label of LABELS) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });
});
