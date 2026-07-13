import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectPill } from '@/components';

/**
 * SelectPill — Phase 28 D-04 / UI-SPEC §SelectPill 상태표.
 * 대형 stadium pill(56px). Chip(12px/500 소형)의 확장이 아닌 독립 컴포넌트(A-2)이며,
 * 접근성 롤도 다르다: Chip은 aria-selected, SelectPill은 aria-pressed(토글 버튼).
 *
 * 두 상태 모두 border-2 — 선택 시 레이아웃 시프트 0.
 */
describe('SelectPill', () => {
  it('unselected — aria-pressed=false, 연회색 채움 + 투명 테두리', () => {
    render(<SelectPill selected={false}>도쿄</SelectPill>);
    const pill = screen.getByRole('button', { name: '도쿄' });

    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(pill.className).toContain('bg-neutral-100');
    expect(pill.className).toContain('border-transparent');
    expect(pill.className).toContain('text-neutral-600');
  });

  it('selected — aria-pressed=true, 흰 배경 + brand 테두리 + brand 텍스트', () => {
    render(<SelectPill selected>도쿄</SelectPill>);
    const pill = screen.getByRole('button', { name: '도쿄' });

    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(pill.className).toContain('bg-white');
    expect(pill.className).toContain('border-brand-500');
    // brand-600 텍스트 — brand-500은 흰 배경 대비 3.72:1로 AA 미달(A-3).
    expect(pill.className).toContain('text-brand-600');
  });

  it('onClick 콜백이 정확히 1회 발화한다', () => {
    const onClick = vi.fn();
    render(
      <SelectPill selected={false} onClick={onClick}>
        오사카
      </SelectPill>,
    );

    fireEvent.click(screen.getByRole('button', { name: '오사카' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('두 상태 모두 border-2를 갖는다 (선택 시 레이아웃 시프트 0)', () => {
    const { rerender } = render(<SelectPill selected={false}>교토</SelectPill>);
    expect(screen.getByRole('button', { name: '교토' }).className).toContain('border-2');

    rerender(<SelectPill selected>교토</SelectPill>);
    expect(screen.getByRole('button', { name: '교토' }).className).toContain('border-2');
  });
});
