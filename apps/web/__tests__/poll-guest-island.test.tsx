import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { moaChannelName, type TripMessage } from '@moajoa/core';

// --- Realtime channel stub: .on(type, filter, cb) 콜백 캡처(moa-island.test 선례). ---
// presence sync 바인딩도 onCalls에 type:'presence'로 잡힌다. subscribe는 콜백을
// 동기로 'SUBSCRIBED' 호출해 track 경로를 검증한다.
type OnCall = {
  type: string;
  filter: { event?: string; table?: string; filter?: string };
  cb: (arg?: unknown) => void;
};
let onCalls: OnCall[] = [];
let lastChannel: Record<string, unknown> | null = null;
function makeChannel() {
  const ch: Record<string, unknown> = {};
  ch.on = vi.fn((type: string, filter: OnCall['filter'], cb: (arg?: unknown) => void) => {
    onCalls.push({ type, filter, cb });
    return ch;
  });
  ch.track = vi.fn();
  ch.presenceState = vi.fn(() => ({}));
  ch.subscribe = vi.fn((cb?: (s: string) => void) => {
    cb?.('SUBSCRIBED');
    return ch;
  });
  return ch;
}
const channel = vi.fn((_name: string, _opts?: unknown) => {
  const ch = makeChannel();
  lastChannel = ch;
  return ch;
});
const removeChannel = vi.fn();

// --- Auth seam: 세션 해석(getUser) + 익명 승격(signInAnonymously). ---
const getUser = vi.fn(async (): Promise<{ data: { user: { id: string } | null } }> => ({
  data: { user: null },
}));
const signInAnonymously = vi.fn(async (_opts?: unknown) => ({
  data: { user: { id: 'anon-1' } },
  error: null,
}));
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({
    channel,
    removeChannel,
    auth: { getUser, signInAnonymously },
  }),
}));

// --- API seam — 개별 vi.fn 위임 (moa-island.test 선례). getTrip은 미호출 단언용
//     (Pitfall 2 — private 레거시 poll trip은 멤버여도 trips SELECT 불가). ---
const joinMoaByPollCode = vi.fn(async (_c: unknown, _code: string): Promise<string> => TRIP);
const getMyTripRole = vi.fn(
  async (_c: unknown, _t: string, _u: string): Promise<'owner' | 'member' | null> => null,
);
const listTripMessages = vi.fn(async (_c: unknown, _t: string): Promise<TripMessage[]> => []);
const sendTripMessage = vi.fn(
  async (_c: unknown, input: unknown): Promise<TripMessage> =>
    makeMessage('m-sent', '보낸 메시지', (input as { nickname: string }).nickname),
);
const getTrip = vi.fn(async (_c: unknown, _t: string): Promise<unknown> => null);
vi.mock('@moajoa/api', () => ({
  joinMoaByPollCode: (c: unknown, code: string) => joinMoaByPollCode(c, code),
  getMyTripRole: (c: unknown, t: string, u: string) => getMyTripRole(c, t, u),
  listTripMessages: (c: unknown, t: string) => listTripMessages(c, t),
  sendTripMessage: (c: unknown, i: unknown) => sendTripMessage(c, i),
  getTrip: (c: unknown, t: string) => getTrip(c, t),
}));

// --- 닉네임 저장 seam. ---
const getStoredNickname = vi.fn((): string => '');
const setStoredNickname = vi.fn((_n: string) => undefined);
vi.mock('@/lib/device-token', () => ({
  getStoredNickname: () => getStoredNickname(),
  setStoredNickname: (n: string) => setStoredNickname(n),
}));

const toast = vi.fn();
vi.mock('@/components', () => ({ useToast: () => ({ toast }) }));

// --- 컴포넌트 스텁: 배선만 검증 — 프레젠테이션은 각자 스위트 몫. ---
vi.mock('@/app/moa/[id]/_components/moa-chat', () => ({
  MoaChat: ({
    messages,
    currentUserId,
    viewers,
    onSend,
  }: {
    messages: TripMessage[];
    currentUserId: string;
    viewers: number;
    onSend: (body: string, replyToPlaceId: string | null) => Promise<void>;
  }) => (
    <div data-testid="moa-chat">
      <span data-testid="viewers">{viewers}</span>
      <span data-testid="chat-user">{currentUserId}</span>
      <ul data-testid="chat-messages">
        {messages.map((m) => (
          <li key={m.id}>{m.body}</li>
        ))}
      </ul>
      <button onClick={() => void onSend('hi', null)}>chat-send</button>
    </div>
  ),
}));
vi.mock('@/app/poll/[code]/_components/poll-vote-island', () => ({
  PollVoteIsland: ({
    code,
    deviceToken,
    onRequireMember,
  }: {
    code: string;
    deviceToken?: string;
    onRequireMember?: () => Promise<{ uid: string; nickname: string }>;
  }) => (
    <div data-testid="poll-vote-island">
      <span data-testid="pvi-code">{code}</span>
      <span data-testid="pvi-device-token">{deviceToken ?? ''}</span>
      <span data-testid="pvi-has-gate">{String(typeof onRequireMember === 'function')}</span>
    </div>
  ),
}));
vi.mock('@/app/t/[slug]/_components/nickname-gate-sheet', () => ({
  NicknameGateSheet: ({
    open,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    onConfirm: (nickname: string) => void;
    onClose?: () => void;
  }) =>
    open ? (
      <div data-testid="nickname-gate">
        <button onClick={() => onConfirm('테스터')}>gate-confirm</button>
        <button onClick={() => onClose?.()}>gate-close</button>
      </div>
    ) : null,
}));

// TripMessageCreateSchema.parse가 uuid를 요구하므로 tripId는 실제 uuid 형태.
const TRIP = '00000000-0000-4000-8000-000000000001';
const CODE = 'CODE123';

function makeMessage(id: string, body: string, nickname = '친구'): TripMessage {
  return {
    id: `00000000-0000-4000-8000-0000000000${id.length === 1 ? `0${id}` : '99'}`,
    trip_id: TRIP,
    user_id: '00000000-0000-4000-8000-0000000000aa',
    nickname,
    body,
    reply_to_place_id: null,
    created_at: '2026-07-14T00:00:00Z',
  };
}

import { PollGuestIsland } from '@/app/poll/[code]/_components/poll-guest-island';

const defaultProps = {
  code: CODE,
  tripId: TRIP,
  mode: 'range' as const,
  status: 'open' as const,
  options: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  onCalls = [];
  lastChannel = null;
  getUser.mockResolvedValue({ data: { user: null } });
  getMyTripRole.mockResolvedValue(null);
  listTripMessages.mockResolvedValue([]);
  getStoredNickname.mockReturnValue('');
});

describe('PollGuestIsland', () => {
  it('Test 1 — 비멤버 렌더: MoaChat 미마운트·빈 상태 카피·compose 존재·채널 미호출·onRequireMember 전달', async () => {
    render(<PollGuestIsland {...defaultProps} />);
    // 세션 effect 정착 대기 (getUser → null → 비멤버 유지)
    await waitFor(() => expect(getUser).toHaveBeenCalled());

    expect(screen.queryByTestId('moa-chat')).toBeNull();
    expect(screen.getByText('참여하면 지금까지의 대화를 볼 수 있어요')).toBeTruthy();
    expect(screen.getByPlaceholderText('메시지 남기기')).toBeTruthy();
    // Pitfall 4 / T-29-15: join 전 채널 구독 금지 (presence 유령 + WALRUS 무음 0건)
    expect(channel).not.toHaveBeenCalled();
    expect(screen.getByTestId('pvi-has-gate').textContent).toBe('true');
    // 비멤버는 hydrate 자체 미실행 (RLS·T-29-18)
    expect(listTripMessages).not.toHaveBeenCalled();
  });

  it('Test 2 — 첫 전송 게이트: signInAnonymously→joinMoaByPollCode→setStoredNickname 순서 + hydrate + 전송 (getTrip 미호출)', async () => {
    render(<PollGuestIsland {...defaultProps} />);
    await waitFor(() => expect(getUser).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('메시지 남기기'), {
      target: { value: '안녕하세요' },
    });
    fireEvent.click(screen.getByText('보내기'));

    // 게이트 오픈 → confirm
    await waitFor(() => expect(screen.getByTestId('nickname-gate')).toBeTruthy());
    fireEvent.click(screen.getByText('gate-confirm'));

    await waitFor(() => expect(sendTripMessage).toHaveBeenCalledTimes(1));

    expect(signInAnonymously).toHaveBeenCalledWith({ options: { data: { name: '테스터' } } });
    expect(joinMoaByPollCode).toHaveBeenCalledTimes(1);
    expect(joinMoaByPollCode.mock.calls[0]![1]).toBe(CODE);
    expect(setStoredNickname).toHaveBeenCalledWith('테스터');
    // 순서 고정: signInAnonymously → joinMoaByPollCode → setStoredNickname
    expect(signInAnonymously.mock.invocationCallOrder[0]!).toBeLessThan(
      joinMoaByPollCode.mock.invocationCallOrder[0]!,
    );
    expect(joinMoaByPollCode.mock.invocationCallOrder[0]!).toBeLessThan(
      setStoredNickname.mock.invocationCallOrder[0]!,
    );
    // hydrate는 listTripMessages만 — getTrip 미호출 (Pitfall 2: private 레거시 poll trip)
    expect(listTripMessages).toHaveBeenCalled();
    expect(getTrip).not.toHaveBeenCalled();
    // 전송 body가 게이트 닉네임으로 나감
    expect(sendTripMessage.mock.calls[0]![1]).toMatchObject({
      trip_id: TRIP,
      nickname: '테스터',
      body: '안녕하세요',
    });
  });

  it('Test 3 — 재방문 멤버: 게이트 없이 listTripMessages hydrate + MoaChat 마운트', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    getMyTripRole.mockResolvedValue('member');
    getStoredNickname.mockReturnValue('재방문자');
    listTripMessages.mockResolvedValue([makeMessage('1', '이전 대화')]);

    render(<PollGuestIsland {...defaultProps} />);

    await waitFor(() => expect(screen.getByTestId('moa-chat')).toBeTruthy());
    expect(screen.getByText('이전 대화')).toBeTruthy();
    expect(screen.queryByTestId('nickname-gate')).toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(getTrip).not.toHaveBeenCalled();
  });

  it('Test 4 — 채널 소유: joined 시 moa:{tripId} 1회 + pre-subscribe 바인딩 2개 + track + 언마운트 removeChannel', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    getMyTripRole.mockResolvedValue('member');
    listTripMessages.mockResolvedValue([]);

    const { unmount } = render(<PollGuestIsland {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('moa-chat')).toBeTruthy());

    await waitFor(() => expect(channel).toHaveBeenCalledTimes(1));
    // 채널명은 moaChannelName 산출값과 정확 일치 + presence key = uid
    expect(channel).toHaveBeenCalledWith(moaChannelName(TRIP), {
      config: { presence: { key: 'u1' } },
    });
    // pre-subscribe 바인딩 2개: trip_messages INSERT + presence sync (#1917)
    expect(onCalls).toHaveLength(2);
    const pg = onCalls.find((c) => c.type === 'postgres_changes');
    expect(pg?.filter).toMatchObject({
      event: 'INSERT',
      table: 'trip_messages',
      filter: `trip_id=eq.${TRIP}`,
    });
    expect(onCalls.some((c) => c.type === 'presence' && c.filter.event === 'sync')).toBe(true);
    // SUBSCRIBED → presence track
    const ch = lastChannel!;
    await waitFor(() => expect(ch.track).toHaveBeenCalled());

    unmount();
    expect(removeChannel).toHaveBeenCalledWith(ch);
  });

  it('Test 5 — dedup: 같은 id 메시지 postgres_changes 2회 → 1건만 append', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    getMyTripRole.mockResolvedValue('member');
    listTripMessages.mockResolvedValue([]);

    render(<PollGuestIsland {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('moa-chat')).toBeTruthy());
    await waitFor(() => expect(channel).toHaveBeenCalledTimes(1));

    const pg = onCalls.find((c) => c.type === 'postgres_changes')!;
    const msg = makeMessage('7', '실시간 메시지');
    act(() => {
      pg.cb({ new: msg });
      pg.cb({ new: msg });
    });

    const items = screen.getByTestId('chat-messages').querySelectorAll('li');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toBe('실시간 메시지');
  });

  it('Test 6 — 게이트 취소: draft 복원 + 에러 토스트 1회 (reject 경로, Pitfall 7 수용)', async () => {
    render(<PollGuestIsland {...defaultProps} />);
    await waitFor(() => expect(getUser).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('메시지 남기기') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.click(screen.getByText('보내기'));

    await waitFor(() => expect(screen.getByTestId('nickname-gate')).toBeTruthy());
    fireEvent.click(screen.getByText('gate-close'));

    // reject → compose가 draft 복원 + 에러 토스트 (moa-chat 계약 미러)
    await waitFor(() => expect(input.value).toBe('안녕'));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('메시지를 보내지 못했어요. 다시 시도해주세요.', {
      variant: 'error',
    });
    expect(sendTripMessage).not.toHaveBeenCalled();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
