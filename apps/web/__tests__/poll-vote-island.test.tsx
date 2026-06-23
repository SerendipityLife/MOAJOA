import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
// Realtime channel stub: chainable .on/.subscribe + capturing .track/.send.
const track = vi.fn(async () => undefined);
const sendBroadcast = vi.fn();
function makeChannel() {
  const ch: Record<string, unknown> = {};
  ch.on = vi.fn(() => ch);
  ch.subscribe = vi.fn((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return ch;
  });
  ch.track = track;
  ch.send = sendBroadcast;
  ch.presenceState = vi.fn(() => ({}));
  return ch;
}
const removeChannel = vi.fn();
const channel = vi.fn(() => makeChannel());

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ channel, removeChannel }),
}));

// Device-token util — stable token + nickname store seam.
vi.mock('@/lib/device-token', () => ({
  getDeviceToken: () => 'dev-token-1',
  getStoredNickname: () => '',
  setStoredNickname: vi.fn(),
}));

type CastInput = {
  code: string;
  deviceToken: string;
  nickname: string;
  optionId?: string;
  voteDate?: string;
  availability: string;
};
const castDateVote = vi.fn(async (_client: unknown, _input: CastInput) => undefined);
const getPollTally = vi.fn(async (_client: unknown, _code: string) => ({
  mode: 'range',
  tally: [] as unknown[],
}));
const postComment = vi.fn(async (_client: unknown, _input: unknown) => ({}));
const deleteComment = vi.fn(async (_client: unknown, _input: unknown) => undefined);
vi.mock('@moajoa/api', () => ({
  castDateVote: (client: unknown, input: CastInput) => castDateVote(client, input),
  getPollTally: (client: unknown, code: string) => getPollTally(client, code),
  postComment: (client: unknown, input: unknown) => postComment(client, input),
  deleteComment: (client: unknown, input: unknown) => deleteComment(client, input),
}));

// useToast + Dialog (chat) — capture toast calls, render Dialog inert.
const toast = vi.fn();
vi.mock('@/components', () => ({
  useToast: () => ({ toast }),
  Dialog: () => null,
}));

// Import AFTER mocks.
import { PollVoteIsland } from '@/app/poll/[code]/_components/poll-vote-island';

const rangeOptions = [
  { id: 'opt-1', start_date: '2026-06-14', end_date: '2026-06-16' },
  { id: 'opt-2', start_date: '2026-06-21', end_date: '2026-06-23' },
];

const baseProps = {
  code: 'pollcode01',
  tripId: 'trip-1',
  mode: 'range' as const,
  status: 'open' as const,
  options: rangeOptions,
  // Seed the tally so the realtime/hydrate effects are skipped (test seam).
  initialRangeTally: [
    {
      option_id: 'opt-1',
      start_date: '2026-06-14',
      end_date: '2026-06-16',
      available_count: 1,
      nicknames: ['민지'],
    },
  ],
};

beforeEach(() => {
  castDateVote.mockClear();
  castDateVote.mockResolvedValue(undefined);
  getPollTally.mockClear();
  toast.mockClear();
  sendBroadcast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PollVoteIsland', () => {
  it('nickname gate: blocks the start until a nickname is set, then reveals voting', async () => {
    render(<PollVoteIsland {...baseProps} />);

    // Pre-nickname: the gate is shown, no vote toggles yet.
    expect(screen.getByText('먼저 닉네임을 정해주세요')).toBeInTheDocument();
    expect(screen.queryByText('가능')).toBeNull();

    // Empty submit → error toast, no nickname set.
    fireEvent.click(screen.getByText('시작하기'));
    expect(toast).toHaveBeenCalledWith(
      '닉네임을 입력해야 투표할 수 있어요.',
      { variant: 'error' },
    );
    expect(castDateVote).not.toHaveBeenCalled();

    // Set a nickname → voting UI appears.
    fireEvent.change(screen.getByPlaceholderText('닉네임'), {
      target: { value: '지우' },
    });
    fireEvent.click(screen.getByText('시작하기'));
    await screen.findAllByText('가능');
  });

  it('optimistic vote: flips the toggle, then rolls back + toasts on RPC reject', async () => {
    castDateVote.mockRejectedValueOnce(new Error('boom'));
    render(<PollVoteIsland {...baseProps} initialNickname="지우" />);

    const availButtons = await screen.findAllByText('가능');
    const firstAvail = availButtons[0]!;
    expect(firstAvail).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(firstAvail);

    // Optimistic: pressed immediately.
    await waitFor(() => expect(firstAvail).toHaveAttribute('aria-pressed', 'true'));
    expect(castDateVote).toHaveBeenCalledTimes(1);
    expect(castDateVote.mock.calls[0]?.[1]).toMatchObject({
      code: 'pollcode01',
      optionId: 'opt-1',
      availability: 'available',
      nickname: '지우',
    });

    // Reject → rollback to unpressed + error toast.
    await waitFor(() => expect(firstAvail).toHaveAttribute('aria-pressed', 'false'));
    expect(toast).toHaveBeenCalledWith(
      '투표를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
      { variant: 'error' },
    );
  });

  it('closed poll: shows the 확정 result + 이 여행에 함께하기 CTA instead of voting', () => {
    render(<PollVoteIsland {...baseProps} status="closed" initialNickname="지우" />);

    expect(screen.getByRole('heading', { name: /확정/ })).toBeInTheDocument();
    expect(screen.getByText('이 여행에 함께하기')).toBeInTheDocument();
    expect(screen.queryByText('가능')).toBeNull();
  });
});
