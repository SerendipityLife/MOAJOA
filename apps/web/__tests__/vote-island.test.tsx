import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicBoardView } from '@moajoa/core';

type ViewPlace = PublicBoardView['places'][number];

function makePlace(overrides: Partial<ViewPlace>): ViewPlace {
  return {
    id: 'p1',
    link_id: 'l1',
    name_local: '스시집',
    name_ko: null,
    name_en: null,
    lat: 35.0,
    lng: 139.0,
    category: 'restaurant',
    source_timestamp_sec: null,
    source_kind: 'ai',
    confidence: 0.9,
    summary_ko: null,
    ...overrides,
  };
}

// --- Mocks ---------------------------------------------------------------
// Mutable session controlled per-test.
let mockUser: { id: string } | null = null;
const authGetUser = vi.fn(async () => ({ data: { user: mockUser } }));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getUser: authGetUser } }),
}));

const joinSharedBoard = vi.fn(async (_client: unknown, _slug: string) => 'board-1');
const getAcceptedMemberCount = vi.fn(async (_client: unknown, _boardId: string) => 0);
const getVoteCounts = vi.fn(
  async (_client: unknown, _placeIds: string[]) => ({}) as Record<string, number>,
);
const castVote = vi.fn(
  async (_client: unknown, _input: { place_id: string; kind: string }) => ({}),
);
const retractVote = vi.fn(async (_client: unknown, _placeId: string) => undefined);

vi.mock('@moajoa/api', () => ({
  joinSharedBoard: (client: unknown, slug: string) => joinSharedBoard(client, slug),
  getAcceptedMemberCount: (client: unknown, boardId: string) =>
    getAcceptedMemberCount(client, boardId),
  getVoteCounts: (client: unknown, placeIds: string[]) => getVoteCounts(client, placeIds),
  castVote: (client: unknown, input: { place_id: string; kind: string }) =>
    castVote(client, input),
  retractVote: (client: unknown, placeId: string) => retractVote(client, placeId),
}));

// next/navigation router.refresh
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

// useToast — swallow toasts but keep the API shape.
vi.mock('@/components', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    // strip non-DOM props
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  },
  useToast: () => ({ toast: vi.fn() }),
}));

// Import AFTER mocks so the component picks them up.
import { VoteIsland } from '@/app/b/[slug]/_components/vote-island';

beforeEach(() => {
  mockUser = null;
  joinSharedBoard.mockClear();
  getAcceptedMemberCount.mockClear();
  getVoteCounts.mockClear();
  castVote.mockClear();
  retractVote.mockClear();
  refresh.mockClear();
  authGetUser.mockClear();
  getAcceptedMemberCount.mockResolvedValue(0);
  getVoteCounts.mockResolvedValue({});
  joinSharedBoard.mockResolvedValue('board-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  slug: 'shareslug1',
  boardId: 'board-1',
  places: [makePlace({ id: 'p1', name_local: '스시집' })],
};

describe('VoteIsland', () => {
  it('logged-out: shows 참여해서 투표하기 CTA linking to /login, no ❤️ toggle', async () => {
    mockUser = null;
    render(<VoteIsland {...baseProps} />);

    const cta = await screen.findByText('참여해서 투표하기');
    expect(cta).toBeInTheDocument();
    expect(cta.closest('a')?.getAttribute('href')).toBe('/login');
    expect(screen.queryByRole('button', { name: /❤️|좋아요|투표/ })).toBeNull();
  });

  it('logged-in non-member: shows 이 보드에 참여하기, click calls joinSharedBoard with slug', async () => {
    mockUser = { id: 'u1' };
    render(<VoteIsland {...baseProps} />);

    const joinBtn = await screen.findByText('이 보드에 참여하기');
    fireEvent.click(joinBtn);

    await waitFor(() => expect(joinSharedBoard).toHaveBeenCalledTimes(1));
    expect(joinSharedBoard.mock.calls[0]?.[1]).toBe('shareslug1');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('member + voted place: ❤️ filled + count, click calls retractVote', async () => {
    mockUser = { id: 'u1' };
    getAcceptedMemberCount.mockResolvedValue(2);
    getVoteCounts.mockResolvedValue({ p1: 1 });

    render(<VoteIsland {...baseProps} initialJoined initialMyVotes={{ p1: true }} />);

    const voteBtn = await screen.findByTestId('vote-toggle-p1');
    expect(voteBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('love-count-p1')).toHaveTextContent('1');

    fireEvent.click(voteBtn);
    await waitFor(() => expect(retractVote).toHaveBeenCalledTimes(1));
    expect(retractVote.mock.calls[0]?.[1]).toBe('p1');
    expect(castVote).not.toHaveBeenCalled();
  });

  it('member + unvoted place: click calls castVote with {place_id, kind:love}', async () => {
    mockUser = { id: 'u1' };
    getAcceptedMemberCount.mockResolvedValue(2);
    getVoteCounts.mockResolvedValue({ p1: 0 });

    render(<VoteIsland {...baseProps} initialJoined initialMyVotes={{}} />);

    const voteBtn = await screen.findByTestId('vote-toggle-p1');
    expect(voteBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(voteBtn);
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
    expect(castVote.mock.calls[0]?.[1]).toMatchObject({ place_id: 'p1', kind: 'love' });
    expect(retractVote).not.toHaveBeenCalled();
  });

  it('확정 true: memberCount=2, loveCount=1 (>=0.5) shows 확정 badge', async () => {
    mockUser = { id: 'u1' };
    getAcceptedMemberCount.mockResolvedValue(2);
    getVoteCounts.mockResolvedValue({ p1: 1 });

    render(<VoteIsland {...baseProps} initialJoined initialMyVotes={{ p1: true }} />);

    expect(await screen.findByTestId('confirmed-badge-p1')).toBeInTheDocument();
  });

  it('확정 false: memberCount=3, loveCount=1 (<0.5) shows no 확정 badge', async () => {
    mockUser = { id: 'u1' };
    getAcceptedMemberCount.mockResolvedValue(3);
    getVoteCounts.mockResolvedValue({ p1: 1 });

    render(<VoteIsland {...baseProps} initialJoined initialMyVotes={{ p1: true }} />);

    await screen.findByTestId('vote-toggle-p1');
    expect(screen.queryByTestId('confirmed-badge-p1')).toBeNull();
  });

  it('legacy zero-members: memberCount=0 → no 확정, list renders without crash', async () => {
    mockUser = { id: 'u1' };
    getAcceptedMemberCount.mockResolvedValue(0);
    getVoteCounts.mockResolvedValue({});

    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ id: 'p1' }), makePlace({ id: 'p2', name_local: '카페' })]}
        initialJoined
        initialMyVotes={{}}
      />,
    );

    await screen.findByTestId('vote-toggle-p1');
    expect(screen.getByTestId('vote-toggle-p2')).toBeInTheDocument();
    expect(screen.queryByTestId('confirmed-badge-p1')).toBeNull();
    expect(screen.queryByTestId('confirmed-badge-p2')).toBeNull();
  });
});
