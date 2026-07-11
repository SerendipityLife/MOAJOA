import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Trip } from '@moajoa/core';

// --- @moajoa/api seam — shareMoa 재호출 mode 갱신·slug 보존 계약. ---
const shareMoa = vi.fn(async (_c: unknown, _id: string, _mode: string) => 'slug123');
// 25-07 Gap 1 — dates/both 공유 시 poll ensure + 후보 날짜 세팅 계약.
const getPollByTrip = vi.fn(
  async (_c: unknown, _tripId: string): Promise<Record<string, unknown> | null> => null,
);
const createDatePoll = vi.fn(async (_c: unknown, _tripId: string, _mode?: string) => ({
  id: 'poll-1',
  poll_code: 'CODE1',
  mode: 'range',
  status: 'open',
}));
const getPollOptions = vi.fn(
  async (_c: unknown, _pollId: string): Promise<{ id: string; start_date: string; end_date: string }[]> => [],
);
const addPollOption = vi.fn(
  async (_c: unknown, _pollId: string, _input: { startDate: string; endDate: string }) => ({
    id: 'opt-1',
    start_date: '2026-06-14',
    end_date: '2026-06-16',
  }),
);
const removePollOption = vi.fn(async (_c: unknown, _optionId: string) => undefined);
vi.mock('@moajoa/api', () => ({
  shareMoa: (c: unknown, id: string, mode: string) => shareMoa(c, id, mode),
  getPollByTrip: (c: unknown, tripId: string) => getPollByTrip(c, tripId),
  createDatePoll: (c: unknown, tripId: string, mode?: string) => createDatePoll(c, tripId, mode),
  getPollOptions: (c: unknown, pollId: string) => getPollOptions(c, pollId),
  addPollOption: (c: unknown, pollId: string, input: { startDate: string; endDate: string }) =>
    addPollOption(c, pollId, input),
  removePollOption: (c: unknown, optionId: string) => removePollOption(c, optionId),
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

// react-day-picker — 단위 대상은 share-sheet 로직(range→YYYY-MM-DD 변환·추가 흐름)이라
// 달력 자체는 스텁: 클릭 시 6/14–6/16 range를 onSelect로 전달.
vi.mock('react-day-picker', () => ({
  DayPicker: (props: { onSelect?: (r: unknown) => void }) => (
    <button
      type="button"
      data-testid="daypicker-stub"
      onClick={() =>
        props.onSelect?.({
          from: new Date(2026, 5, 14), // 로컬 2026-06-14
          to: new Date(2026, 5, 16),
        })
      }
    >
      달력
    </button>
  ),
}));
vi.mock('react-day-picker/locale', () => ({ ko: {} }));

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
  getPollByTrip.mockReset();
  getPollByTrip.mockResolvedValue(null);
  createDatePoll.mockReset();
  createDatePoll.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'CODE1',
    mode: 'range',
    status: 'open',
  });
  getPollOptions.mockReset();
  getPollOptions.mockResolvedValue([]);
  addPollOption.mockReset();
  addPollOption.mockResolvedValue({
    id: 'opt-1',
    start_date: '2026-06-14',
    end_date: '2026-06-16',
  });
  removePollOption.mockReset();
  removePollOption.mockResolvedValue(undefined);
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

describe('ShareSheet — 후보 날짜 세팅 step (25-07 Gap 1)', () => {
  it("Gap 1: '둘다 정하기' 공유 → poll 없으면 createDatePoll(range) 후 후보 날짜 step 렌더", async () => {
    render(<ShareSheet trip={makeTrip()} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('둘다 정하기'));
    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() => expect(screen.getByText('후보 날짜')).toBeTruthy());
    expect(shareMoa).toHaveBeenCalledWith({}, 'trip-1', 'both');
    expect(getPollByTrip).toHaveBeenCalledWith({}, 'trip-1');
    expect(createDatePoll).toHaveBeenCalledWith({}, 'trip-1', 'range');
  });

  it('멱등: 기존 poll 존재 시 createDatePoll 미호출 + 기존 옵션 렌더', async () => {
    getPollByTrip.mockResolvedValue({
      id: 'poll-9',
      poll_code: 'CODE9',
      mode: 'range',
      status: 'open',
    });
    getPollOptions.mockResolvedValue([
      { id: 'opt-9', start_date: '2026-06-14', end_date: '2026-06-16' },
    ]);
    render(<ShareSheet trip={makeTrip({ share_mode: 'dates' })} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() => expect(screen.getByText('후보 날짜')).toBeTruthy());
    expect(createDatePoll).not.toHaveBeenCalled();
    expect(getPollOptions).toHaveBeenCalledWith({}, 'poll-9');
    expect(screen.getByText('6/14–6/16')).toBeTruthy();
  });

  it('후보 날짜 추가·삭제 — addPollOption/removePollOption 배선', async () => {
    render(<ShareSheet trip={makeTrip({ share_mode: 'both' })} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('링크 복사하기'));
    await waitFor(() => expect(screen.getByText('후보 날짜')).toBeTruthy());

    // 한 달력에서 range 선택(스텁: 6/14–6/16) → '후보로 추가' CTA.
    fireEvent.click(screen.getByTestId('daypicker-stub'));
    fireEvent.click(screen.getByText('6/14–6/16 후보로 추가'));

    await waitFor(() =>
      expect(addPollOption).toHaveBeenCalledWith({}, 'poll-1', {
        startDate: '2026-06-14',
        endDate: '2026-06-16',
      }),
    );
    await waitFor(() => expect(screen.getByText('6/14–6/16')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('후보 삭제'));
    await waitFor(() => expect(removePollOption).toHaveBeenCalledWith({}, 'opt-1'));
    await waitFor(() => expect(screen.queryByText('6/14–6/16')).toBeNull());
  });

  it("회귀: '장소 정하기' 공유는 poll 호출 0 + step 전환 없음", async () => {
    render(<ShareSheet trip={makeTrip()} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('장소 정하기'));
    fireEvent.click(screen.getByText('링크 복사하기'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('링크를 복사했어요'));
    expect(getPollByTrip).not.toHaveBeenCalled();
    expect(createDatePoll).not.toHaveBeenCalled();
    expect(addPollOption).not.toHaveBeenCalled();
    expect(screen.queryByText('후보 날짜')).toBeNull();
  });

  it('재열기 복구: both 공유됨 + 후보 0개 poll → 열자마자 후보 날짜 step 점프', async () => {
    getPollByTrip.mockResolvedValue({ id: 'poll-1', poll_code: 'code1' });
    getPollOptions.mockResolvedValue([]);

    render(
      <ShareSheet
        trip={makeTrip({ share_mode: 'both', visibility: 'shared' })}
        open
        onClose={vi.fn()}
      />,
    );

    // 미완성 poll(후보 0) 감지 → 모드 카드 대신 후보 단계로.
    await waitFor(() => expect(screen.getByText('후보 날짜')).toBeTruthy());
    expect(createDatePoll).not.toHaveBeenCalled(); // 조회만, 생성 아님
  });

  it('재열기: both 공유됨 + 후보 있는 poll → 모드 step 유지(점프 없음)', async () => {
    getPollByTrip.mockResolvedValue({ id: 'poll-1', poll_code: 'code1' });
    getPollOptions.mockResolvedValue([
      { id: 'opt-1', start_date: '2026-06-14', end_date: '2026-06-16' },
    ]);

    render(
      <ShareSheet
        trip={makeTrip({ share_mode: 'both', visibility: 'shared' })}
        open
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(getPollOptions).toHaveBeenCalled());
    expect(screen.queryByText('후보 날짜')).toBeNull(); // 모드 카드 화면 유지
    expect(screen.getByText('둘다 정하기')).toBeTruthy();
  });
});
