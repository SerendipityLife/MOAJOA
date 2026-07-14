import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
// Realtime channel stub: chainable .on/.subscribe + capturing .send (vote broadcast).
const sendBroadcast = vi.fn();
function makeChannel() {
  const ch: Record<string, unknown> = {};
  ch.on = vi.fn(() => ch);
  ch.subscribe = vi.fn((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return ch;
  });
  ch.send = sendBroadcast;
  return ch;
}
const removeChannel = vi.fn();
const channel = vi.fn(() => makeChannel());

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ channel, removeChannel }),
}));

// Device-token util — stable token + configurable stored-nickname seam
// (Pitfall 1 케이스가 재방문자의 localStorage 닉네임을 시뮬레이션한다).
const getStoredNickname = vi.fn(() => '');
vi.mock('@/lib/device-token', () => ({
  getDeviceToken: () => 'dev-token-1',
  getStoredNickname: () => getStoredNickname(),
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
const castDateVoteAuthed = vi.fn(async (_client: unknown, _input: Omit<CastInput, 'deviceToken'>) => undefined);
const getPollTally = vi.fn(async (_client: unknown, _code: string) => ({
  mode: 'range',
  tally: [] as unknown[],
}));
vi.mock('@moajoa/api', () => ({
  castDateVote: (client: unknown, input: CastInput) => castDateVote(client, input),
  castDateVoteAuthed: (client: unknown, input: Omit<CastInput, 'deviceToken'>) =>
    castDateVoteAuthed(client, input),
  getPollTally: (client: unknown, code: string) => getPollTally(client, code),
}));

// useToast — capture toast calls.
const toast = vi.fn();
vi.mock('@/components', () => ({
  useToast: () => ({ toast }),
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
  castDateVoteAuthed.mockClear();
  castDateVoteAuthed.mockResolvedValue(undefined);
  getPollTally.mockClear();
  getStoredNickname.mockClear();
  getStoredNickname.mockReturnValue('');
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

  // ── /t 임베드 seam (25-02) ────────────────────────────────────────────────
  it('embed seam: deviceToken+nickname props로 inline 게이트를 건너뛰고 그 deviceToken로 투표', async () => {
    render(<PollVoteIsland {...baseProps} deviceToken="auth-uid-1" nickname="민지" />);

    // 닉네임 prop 주입 → inline 닉네임 게이트 미렌더, 바로 투표 UI.
    expect(screen.queryByText('먼저 닉네임을 정해주세요')).toBeNull();
    const availButtons = await screen.findAllByText('가능');
    fireEvent.click(availButtons[0]!);

    await waitFor(() => expect(castDateVote).toHaveBeenCalledTimes(1));
    // 주입된 deviceToken(=익명 auth.uid)로 castDateVote — getDeviceToken()('dev-token-1') 아님.
    expect(castDateVote.mock.calls[0]?.[1]).toMatchObject({
      deviceToken: 'auth-uid-1',
      nickname: '민지',
    });
  });

  it('embed seam: onRequireMember 주입 시 첫 투표가 외부 게이트를 1회 거친 뒤 그 uid로 진행', async () => {
    const onRequireMember = vi.fn(async () => ({ uid: 'auth-uid-9', nickname: '게스트' }));
    render(<PollVoteIsland {...baseProps} onRequireMember={onRequireMember} />);

    // onRequireMember 주입 → nickname 미확정이어도 inline 게이트 대신 투표 UI 노출.
    expect(screen.queryByText('먼저 닉네임을 정해주세요')).toBeNull();
    const availButtons = await screen.findAllByText('가능');
    fireEvent.click(availButtons[0]!);

    await waitFor(() => expect(onRequireMember).toHaveBeenCalledTimes(1));
    // 게스트 경로(onRequireMember)는 서버파생 device_token RPC로 투표한다 — 스푸핑 차단
    // (WR-01 / T-25-02). 클라이언트 device_token을 신뢰하는 레거시 castDateVote는 호출 안 됨.
    await waitFor(() => expect(castDateVoteAuthed).toHaveBeenCalledTimes(1));
    expect(castDateVote).not.toHaveBeenCalled();
    const authedPayload = castDateVoteAuthed.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(authedPayload).toMatchObject({ nickname: '게스트' });
    expect(authedPayload).not.toHaveProperty('deviceToken');
  });

  it('Pitfall 1: stored nickname이 있어도 onRequireMember 게이트를 우회하지 않는다', async () => {
    // 재방문자 시나리오: localStorage에 닉네임만 남고 익명 세션은 없다. stored hydrate가
    // 게이트를 스킵하면 castDateVoteAuthed(세션 필수 RPC)가 401을 맞는다 — 게이트가
    // 먼저 신원(uid)을 확정해야 한다 (T-29-11).
    getStoredNickname.mockReturnValue('저장된닉');
    const onRequireMember = vi.fn(async () => ({ uid: 'auth-uid-7', nickname: '게스트' }));
    render(<PollVoteIsland {...baseProps} onRequireMember={onRequireMember} />);

    const availButtons = await screen.findAllByText('가능');
    fireEvent.click(availButtons[0]!);

    await waitFor(() => expect(onRequireMember).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(castDateVoteAuthed).toHaveBeenCalledTimes(1));
    expect(castDateVote).not.toHaveBeenCalled();
  });
});
