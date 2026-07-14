import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Trip } from '@moajoa/core';

// --- @/components seam (mock BEFORE importing MoaSwitcher, moa-chat.test idiom). ---
// Radix 메뉴는 jsdom에서 포인터캡처/ResizeObserver를 요구하고 user-event는 미설치라,
// Dropdown* 을 패스스루로 통과시켜 항목 클릭을 fireEvent로 직접 친다.
vi.mock('@/components', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="moa-menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
    <button role="menuitem" onClick={() => onSelect?.()} {...rest}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { MoaSwitcher } from '@/app/moa/[id]/_components/moa-switcher';

function makeTrip(over: Partial<Trip>): Trip {
  return {
    id: 't1',
    owner_id: 'u1',
    representative_id: 'u1',
    title: '도쿄 모아',
    description: null,
    visibility: 'private',
    share_slug: null,
    city_code: 'tokyo',
    start_date: null,
    end_date: null,
    cover_image_url: null,
    share_mode: null,
    companion: null,
    day_count: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...over,
  } as unknown as Trip;
}

const MOAS = [
  makeTrip({ id: 't1', title: '도쿄 모아' }),
  makeTrip({ id: 't2', title: '오사카 모아' }),
];

beforeEach(() => {
  push.mockClear();
});

describe('MoaSwitcher — 인플레이스 모아 전환 드롭다운', () => {
  it('Test 1: 현재 모아 제목 pill + 메뉴에 내 모아 전부 + 새 모아 만들기 + 둘러보기', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" moas={MOAS} />);
    expect(screen.getByLabelText('모아 바꾸기')).toHaveTextContent('도쿄 모아');
    const menu = screen.getByTestId('moa-menu');
    expect(menu).toHaveTextContent('도쿄 모아');
    expect(menu).toHaveTextContent('오사카 모아');
    expect(screen.getByRole('menuitem', { name: '새 모아 만들기' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '둘러보기' })).toBeInTheDocument();
  });

  it('Test 2: 다른 모아 클릭 → router.push(/moa/t2) 1회', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" moas={MOAS} />);
    fireEvent.click(screen.getByRole('menuitem', { name: '오사카 모아' }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/moa/t2');
  });

  it('Test 3: 현재 모아 클릭 → 라우팅 없이 닫힘 + 그 행에 aria-current', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" moas={MOAS} />);
    const current = screen.getByRole('menuitem', { name: '도쿄 모아' });
    expect(current).toHaveAttribute('aria-current', 'true');
    fireEvent.click(current);
    expect(push).not.toHaveBeenCalled();
  });

  it('Test 4: 둘러보기 클릭 → router.push(/discover) (리스트 페이지 소멸로 끊기는 유일 진입 보전)', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" moas={MOAS} />);
    fireEvent.click(screen.getByRole('menuitem', { name: '둘러보기' }));
    expect(push).toHaveBeenCalledWith('/discover');
  });

  it('Test 5: moas 미전달(게스트 /t) → 정적 제목 pill만, 메뉴·트리거 버튼 없음', () => {
    render(<MoaSwitcher currentTripId="t1" title="도쿄 모아" />);
    expect(screen.getByText('도쿄 모아')).toBeInTheDocument();
    expect(screen.queryByTestId('moa-menu')).toBeNull();
    expect(screen.queryByLabelText('모아 바꾸기')).toBeNull();
  });
});
