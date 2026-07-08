import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Trip } from '@moajoa/core';

// --- @moajoa/api seam — shareMoa 재호출 mode 갱신·slug 보존 계약. ---
const shareMoa = vi.fn(async (_c: unknown, _id: string, _mode: string) => 'slug123');
vi.mock('@moajoa/api', () => ({
  shareMoa: (c: unknown, id: string, mode: string) => shareMoa(c, id, mode),
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({}),
}));

const toast = vi.fn();
vi.mock('@/components', () => ({
  BottomSheet: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: string;
    children: React.ReactNode;
  }) => (open ? <div data-testid="sheet" aria-label={title}>{children}</div> : null),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  },
  useToast: () => ({ toast }),
}));

// Import AFTER mocks.
import { ShareSheet } from '@/app/moa/[id]/_components/share-sheet';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    owner_id: 'u1',
    representative_id: 'u1',
    title: '도쿄 여행',
    description: null,
    visibility: 'private',
    share_slug: null,
    city_code: null,
    start_date: null,
    end_date: null,
    cover_image_url: null,
    share_mode: null,
    companion: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  shareMoa.mockClear();
  toast.mockClear();
  shareMoa.mockResolvedValue('slug123');
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn(async () => undefined) },
  });
  // 기본은 share 미지원(데스크톱). share 케이스에서만 주입.
  delete (navigator as unknown as { share?: unknown }).share;
});

describe('ShareSheet', () => {
  it('SHARE-01: 모드 3택 렌더 + 장소 선택 → shareMoa(places) + 클립보드 복사 + 토스트', async () => {
    render(<ShareSheet trip={makeTrip()} open onClose={vi.fn()} />);

    expect(screen.getByText('날짜 정하기')).toBeTruthy();
    expect(screen.getByText('언제 갈지 투표로 정해요')).toBeTruthy();
    expect(screen.getByText('장소 정하기')).toBeTruthy();
    expect(screen.getByText('어디 갈지 찜으로 정해요')).toBeTruthy();
    expect(screen.getByText('둘다 정하기')).toBeTruthy();
    expect(screen.getByText('날짜와 장소 모두 함께 정해요')).toBeTruthy();

    fireEvent.click(screen.getByText('장소 정하기'));
    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() => expect(shareMoa).toHaveBeenCalledWith({}, 'trip-1', 'places'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/t/slug123');
    await waitFor(() => expect(toast).toHaveBeenCalledWith('링크를 복사했어요'));
  });

  it('D-17: 날짜 확정 모아는 날짜 정하기 카드 미렌더(2택), 둘다 정하기는 렌더', () => {
    render(<ShareSheet trip={makeTrip({ start_date: '2026-08-01' })} open onClose={vi.fn()} />);

    expect(screen.queryByText('날짜 정하기')).toBeNull();
    expect(screen.getByText('장소 정하기')).toBeTruthy();
    expect(screen.getByText('둘다 정하기')).toBeTruthy();
  });

  it('D-19: 현재 share_mode(both)가 선택 프리셋 상태', () => {
    render(<ShareSheet trip={makeTrip({ share_mode: 'both' })} open onClose={vi.fn()} />);

    const bothCard = screen.getByText('둘다 정하기').closest('button');
    expect(bothCard?.getAttribute('aria-pressed')).toBe('true');
    const placesCard = screen.getByText('장소 정하기').closest('button');
    expect(placesCard?.getAttribute('aria-pressed')).toBe('false');
  });

  it('Pitfall 5: navigator.share 존재 시 clipboard 후 share 호출, AbortError는 에러 토스트 없음', async () => {
    const share = vi.fn(async () => {
      const e = new Error('cancelled');
      e.name = 'AbortError';
      throw e;
    });
    Object.assign(navigator, { share });

    render(<ShareSheet trip={makeTrip({ share_mode: 'places' })} open onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: 'http://localhost:3000/t/slug123' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(
      '링크를 만들지 못했어요. 다시 시도해 주세요',
      { variant: 'error' },
    );
  });

  it('shareMoa reject → 실패 토스트', async () => {
    shareMoa.mockRejectedValueOnce(new Error('boom'));
    render(<ShareSheet trip={makeTrip({ share_mode: 'places' })} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('링크를 만들지 못했어요. 다시 시도해 주세요', {
        variant: 'error',
      }),
    );
  });
});
