import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeBoard, makePlace, makeTrip } from './guest-mocks';

// --- Hoisted spies (vi.mock 팩토리가 참조하므로 vi.hoisted로 생성) ----------
const mocks = vi.hoisted(() => {
  const mockUser = { current: null as { id: string } | null };
  const authGetUser = vi.fn(async () => ({ data: { user: mockUser.current } }));
  return {
    mockUser,
    authGetUser,
    signInAnonymously: vi.fn(),
    getMyTripRole: vi.fn(),
    joinMoa: vi.fn(),
    getPublicTripPoll: vi.fn(),
    getVoteCounts: vi.fn(),
    getMyVotedPlaceIds: vi.fn(),
    getProfileNames: vi.fn(),
    getTrip: vi.fn(),
    listPlacesByTrip: vi.fn(),
    listLinksByTrip: vi.fn(),
    listTripMembers: vi.fn(),
    listTripMessages: vi.fn(),
    getStoredNickname: vi.fn(() => ''),
    setStoredNickname: vi.fn(),
    toast: vi.fn(),
  };
});

// --- Mocks -----------------------------------------------------------------
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({
    auth: {
      getUser: mocks.authGetUser,
      signInAnonymously: mocks.signInAnonymously,
    },
  }),
}));

vi.mock('@moajoa/api', () => ({
  getMyTripRole: mocks.getMyTripRole,
  joinMoa: mocks.joinMoa,
  getPublicTripPoll: mocks.getPublicTripPoll,
  getVoteCounts: mocks.getVoteCounts,
  getMyVotedPlaceIds: mocks.getMyVotedPlaceIds,
  getProfileNames: mocks.getProfileNames,
  getTrip: mocks.getTrip,
  listPlacesByTrip: mocks.listPlacesByTrip,
  listLinksByTrip: mocks.listLinksByTrip,
  listTripMembers: mocks.listTripMembers,
  listTripMessages: mocks.listTripMessages,
}));

vi.mock('@/lib/device-token', () => ({
  getStoredNickname: mocks.getStoredNickname,
  setStoredNickname: mocks.setStoredNickname,
  getDeviceToken: () => '',
}));

vi.mock('@/components', () => ({
  BottomSheet: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="gate-sheet" aria-label={title}>
        {children}
      </div>
    ) : null,
  useToast: () => ({ toast: mocks.toast }),
}));

// Heavy child islands — stub to assert mount + props without their internals.
vi.mock('@/app/moa/[id]/_components/moa-island', () => ({
  MoaIsland: (props: {
    currentUserId: string;
    currentUserNickname: string;
    hideHostControls?: boolean;
    hidePlaceAdd?: boolean;
    pollSlot?: React.ReactNode;
  }) => (
    <div
      data-testid="moa-island"
      data-uid={props.currentUserId}
      data-nick={props.currentUserNickname}
      data-hide-host={String(props.hideHostControls ?? false)}
      data-hide-place-add={String(props.hidePlaceAdd ?? false)}
      data-has-poll-slot={String(props.pollSlot != null)}
    >
      {props.pollSlot}
    </div>
  ),
}));

vi.mock('@/app/poll/[code]/_components/poll-vote-island', () => ({
  PollVoteIsland: (props: {
    code: string;
    deviceToken?: string;
    onRequireMember?: () => Promise<{ uid: string; nickname: string }>;
  }) => (
    <div data-testid="poll-island" data-code={props.code} data-token={props.deviceToken ?? ''}>
      {/* 첫 투표 액션이 게이트를 여는 경로(onRequireMember)를 트리거하는 하네스 버튼. */}
      <button
        data-testid="poll-require-member"
        onClick={() => void props.onRequireMember?.().catch(() => {})}
      >
        vote
      </button>
    </div>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Import AFTER mocks.
import { GuestSurface } from '@/app/t/[slug]/_components/guest-surface';

function resetMocks() {
  mocks.mockUser.current = null;
  mocks.authGetUser.mockClear();
  mocks.signInAnonymously.mockReset();
  mocks.signInAnonymously.mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });
  mocks.getMyTripRole.mockReset();
  mocks.getMyTripRole.mockResolvedValue(null);
  mocks.joinMoa.mockReset();
  mocks.joinMoa.mockResolvedValue('trip-1');
  mocks.getPublicTripPoll.mockReset();
  mocks.getPublicTripPoll.mockResolvedValue({
    poll_code: 'CODE1',
    mode: 'range',
    status: 'open',
    // 후보 1개 — 후보 0개는 poll-empty 안내로 분기하므로(전용 테스트) 기본은 투표 가능 상태.
    options: [{ id: 'opt-1', start_date: '2026-06-14', end_date: '2026-06-16' }],
  });
  mocks.getVoteCounts.mockReset();
  mocks.getVoteCounts.mockResolvedValue({});
  mocks.getMyVotedPlaceIds.mockReset();
  mocks.getMyVotedPlaceIds.mockResolvedValue([]);
  mocks.getProfileNames.mockReset();
  mocks.getProfileNames.mockResolvedValue({});
  mocks.getTrip.mockReset();
  mocks.getTrip.mockResolvedValue(makeTrip());
  mocks.listPlacesByTrip.mockReset();
  mocks.listPlacesByTrip.mockResolvedValue([]);
  mocks.listLinksByTrip.mockReset();
  mocks.listLinksByTrip.mockResolvedValue([]);
  mocks.listTripMembers.mockReset();
  mocks.listTripMembers.mockResolvedValue([]);
  mocks.listTripMessages.mockReset();
  mocks.listTripMessages.mockResolvedValue([]);
  mocks.getStoredNickname.mockReset();
  mocks.getStoredNickname.mockReturnValue('');
  mocks.setStoredNickname.mockReset();
  mocks.toast.mockClear();
}

function renderSurface(shareMode: 'places' | 'dates' | 'both') {
  return render(
    <GuestSurface
      slug="slug-1"
      tripId="trip-1"
      board={makeBoard({ share_mode: shareMode })}
      places={[makePlace({ id: 'p1' })]}
      links={[]}
    />,
  );
}

beforeEach(() => {
  resetMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

describe('GuestSurface — share_mode 구성 분기 (SHARE-02)', () => {
  it('places: read-only 장소 리스트만, poll 임베드 없음', async () => {
    renderSurface('places');
    await waitFor(() => expect(screen.getByTestId('guest-vote-p1')).toBeInTheDocument());
    expect(screen.queryByTestId('poll-island')).not.toBeInTheDocument();
    expect(screen.queryByTestId('moa-island')).not.toBeInTheDocument();
    // dates 전용 RPC는 places 모드에서 호출 안 됨.
    expect(mocks.getPublicTripPoll).not.toHaveBeenCalled();
  });

  it('dates: getPublicTripPoll로 poll_code를 얻어 PollVoteIsland 임베드', async () => {
    renderSurface('dates');
    await waitFor(() => expect(screen.getByTestId('poll-island')).toBeInTheDocument());
    expect(mocks.getPublicTripPoll).toHaveBeenCalledWith(expect.anything(), 'slug-1');
    expect(screen.getByTestId('poll-island')).toHaveAttribute('data-code', 'CODE1');
    // dates는 지도/장소 리스트 없음.
    expect(screen.queryByTestId('guest-vote-p1')).not.toBeInTheDocument();
  });

  it('both: poll 섹션 + 아래 장소 리스트 공존', async () => {
    renderSurface('both');
    await waitFor(() => expect(screen.getByTestId('poll-island')).toBeInTheDocument());
    expect(screen.getByTestId('guest-vote-p1')).toBeInTheDocument();
  });

  it('후보 0개 poll → PollVoteIsland 대신 "정하는 중" 안내 (빈 집계 노이즈 제거)', async () => {
    mocks.getPublicTripPoll.mockResolvedValue({
      poll_code: 'CODE1',
      mode: 'range',
      status: 'open',
      options: [],
    });
    renderSurface('both');
    await waitFor(() => expect(screen.getByTestId('poll-empty')).toBeInTheDocument());
    expect(screen.getByText('호스트가 후보 날짜를 정하는 중이에요')).toBeInTheDocument();
    expect(screen.queryByTestId('poll-island')).not.toBeInTheDocument();
  });
});

describe('GuestSurface — lazy 익명 게이트 (SHARE-03)', () => {
  it('첫 찜 → 닉네임 시트 → signInAnonymously → joinMoa 순서·1회, MoaIsland 마운트', async () => {
    renderSurface('places');
    await waitFor(() => expect(screen.getByTestId('guest-vote-p1')).toBeInTheDocument());

    // 첫 참여 액션 → 게이트 오픈.
    fireEvent.click(screen.getByTestId('guest-vote-p1'));
    expect(screen.getByTestId('gate-sheet')).toBeInTheDocument();

    // 닉네임 입력 + 시작하기.
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '철수' } });
    fireEvent.click(screen.getByText('시작하기'));

    await waitFor(() => expect(mocks.joinMoa).toHaveBeenCalledTimes(1));

    // signInAnonymously({options:{data:{name}}}) → join_moa(slug) 순서.
    expect(mocks.signInAnonymously).toHaveBeenCalledWith({ options: { data: { name: '철수' } } });
    expect(mocks.joinMoa).toHaveBeenCalledWith(expect.anything(), 'slug-1');
    expect(mocks.signInAnonymously.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.joinMoa.mock.invocationCallOrder[0]!,
    );
    // setStoredNickname은 join 후(D-05 재접속 힌트).
    expect(mocks.setStoredNickname).toHaveBeenCalledWith('철수');

    // join 완료 후에만 MoaIsland 마운트(Pitfall 4).
    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-uid', 'anon-1');
  });

  it('빈 닉네임 확정은 게이트를 통과시키지 않는다 (join 미발생)', async () => {
    renderSurface('places');
    await waitFor(() => expect(screen.getByTestId('guest-vote-p1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('guest-vote-p1'));
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('시작하기'));
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    expect(mocks.joinMoa).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith('닉네임을 정해야 참여할 수 있어요.', {
      variant: 'error',
    });
  });
});

describe('GuestSurface — 재접속 신원 식별 (AUTH-08)', () => {
  it('getMyTripRole≠null이면 게이트 스킵하고 곧장 MoaIsland 마운트', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');
    mocks.getStoredNickname.mockReturnValue('영희');

    renderSurface('places');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-uid', 'u9');
    // 재접속은 게이트/익명 인증/join 없이 진입.
    expect(screen.queryByTestId('gate-sheet')).not.toBeInTheDocument();
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    expect(mocks.joinMoa).not.toHaveBeenCalled();
  });
});

describe('GuestSurface — 호스트 전용 컨트롤 숨김 (25-06 Gap 4 — Test E)', () => {
  it('joined 게스트의 MoaIsland는 hideHostControls로 마운트된다 (places)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');

    renderSurface('places');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-hide-host', 'true');
  });

  it('joined 게스트의 MoaIsland는 hideHostControls로 마운트된다 (both)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');

    renderSurface('both');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-hide-host', 'true');
  });
});

describe('GuestSurface — both 모드 join 후 날짜투표 섹션 유지 (25-07 D-09/C2)', () => {
  it('Test F: both + joined → MoaIsland에 pollSlot 전달 (날짜 정하기 헤딩·poll 임베드가 island 내부)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');

    renderSurface('both');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    // pollMeta hydrate 후 pollSlot 전달.
    await waitFor(() =>
      expect(screen.getByTestId('moa-island')).toHaveAttribute('data-has-poll-slot', 'true'),
    );
    const island = screen.getByTestId('moa-island');
    expect(island).toContainElement(screen.getByText('날짜 정하기'));
    expect(island).toContainElement(screen.getByTestId('poll-island'));
    // 중복 렌더 금지: joined 시 sibling poll 섹션 제거 — poll-island는 1개만.
    expect(screen.getAllByTestId('poll-island')).toHaveLength(1);
  });

  it('Test G(회귀): places + joined → pollSlot 미전달(undefined)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');

    renderSurface('places');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-has-poll-slot', 'false');
  });
});

// ── 29-02 D-01 — dates 공유를 both 경로로 수렴 (CHAT-04). ──
describe('GuestSurface — dates→both 수렴 (29-02 D-01)', () => {
  it('Test 1: dates 재방문 멤버 → hydrate 후 MoaIsland 마운트 + hidePlaceAdd (poll-only 화면에 안 갇힘 — Pitfall 5)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('voter');
    mocks.getStoredNickname.mockReturnValue('영희');

    renderSurface('dates');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    // 재방문도 무조건 hydrateMember 경유 (가드 1 제거 — 세션 effect).
    expect(mocks.getTrip).toHaveBeenCalled();
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-uid', 'u9');
    // voter는 places INSERT 불가 → FAB 숨김 (F-2).
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-hide-place-add', 'true');
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-hide-host', 'true');
  });

  it('Test 2: dates 비join → MoaIsland 미마운트, pollSection만 (A-2 현행 유지)', async () => {
    renderSurface('dates');
    await waitFor(() => expect(screen.getByTestId('poll-island')).toBeInTheDocument());
    expect(screen.queryByTestId('moa-island')).not.toBeInTheDocument();
    // 비join dates는 장소 리스트도 없음 (현행 유지).
    expect(screen.queryByTestId('guest-vote-p1')).not.toBeInTheDocument();
  });

  it('Test 3: dates 첫 join → hydrateMember 호출 → MoaIsland 마운트, pollSlot에 날짜 정하기 (sibling 중복 렌더 0 — Pitfall 8)', async () => {
    renderSurface('dates');
    await waitFor(() => expect(screen.getByTestId('poll-island')).toBeInTheDocument());

    // 첫 투표 액션 → onRequireMember → 게이트 오픈.
    fireEvent.click(screen.getByTestId('poll-require-member'));
    expect(screen.getByTestId('gate-sheet')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '철수' } });
    fireEvent.click(screen.getByText('시작하기'));

    // ensureGuestMember(signInAnonymously→joinMoa) 후 hydrateMember (가드 2 제거).
    await waitFor(() => expect(mocks.joinMoa).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.getTrip).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    const island = screen.getByTestId('moa-island');
    expect(island).toHaveAttribute('data-has-poll-slot', 'true');
    expect(island).toContainElement(screen.getByText('날짜 정하기'));
    // pollSection은 pollSlot에만 — sibling 중복 렌더 금지 (poll:{tripId} 2채널 = 배달 탈취).
    expect(screen.getAllByTestId('poll-island')).toHaveLength(1);
    expect(island).toContainElement(screen.getByTestId('poll-island'));
  });

  it('Test 4: both joined → hidePlaceAdd 미전달 (editor는 FAB 유지 — 무회귀 앵커)', async () => {
    mocks.mockUser.current = { id: 'u9' };
    mocks.getMyTripRole.mockResolvedValue('member');

    renderSurface('both');

    await waitFor(() => expect(screen.getByTestId('moa-island')).toBeInTheDocument());
    expect(screen.getByTestId('moa-island')).toHaveAttribute('data-hide-place-add', 'false');
  });
});
