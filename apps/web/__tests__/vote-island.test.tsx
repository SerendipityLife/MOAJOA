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
    google_place_id: 'gpid-1',
    address: null,
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
const getMyBoardRole = vi.fn(
  async (_client: unknown, _boardId: string, _userId: string) =>
    null as 'owner' | 'member' | null,
);
const getMyVotedPlaceIds = vi.fn(
  async (_client: unknown, _placeIds: string[], _userId: string) => [] as string[],
);

vi.mock('@moajoa/api', () => ({
  joinSharedBoard: (client: unknown, slug: string) => joinSharedBoard(client, slug),
  getAcceptedMemberCount: (client: unknown, boardId: string) =>
    getAcceptedMemberCount(client, boardId),
  getVoteCounts: (client: unknown, placeIds: string[]) => getVoteCounts(client, placeIds),
  castVote: (client: unknown, input: { place_id: string; kind: string }) =>
    castVote(client, input),
  retractVote: (client: unknown, placeId: string) => retractVote(client, placeId),
  getMyBoardRole: (client: unknown, boardId: string, userId: string) =>
    getMyBoardRole(client, boardId, userId),
  getMyVotedPlaceIds: (client: unknown, placeIds: string[], userId: string) =>
    getMyVotedPlaceIds(client, placeIds, userId),
}));

// next/navigation router.refresh
const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
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
  push.mockClear();
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
  it('logged-out: CTA + visible 🤍 that routes to /login?next= on tap (no vote cast)', async () => {
    mockUser = null;
    render(<VoteIsland {...baseProps} />);

    const cta = await screen.findByText('참여해서 투표하기');
    expect(cta.closest('a')?.getAttribute('href')).toBe('/login?next=%2Fb%2Fshareslug1');

    const heart = screen.getByTestId('vote-toggle-p1');
    fireEvent.click(heart);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?next=%2Fb%2Fshareslug1'));
    expect(castVote).not.toHaveBeenCalled();
    expect(joinSharedBoard).not.toHaveBeenCalled();
  });

  it('logged-in non-member: heart tap auto-joins then casts the vote', async () => {
    mockUser = { id: 'u1' };
    render(<VoteIsland {...baseProps} />);

    const heart = await screen.findByTestId('vote-toggle-p1');
    fireEvent.click(heart);

    await waitFor(() => expect(joinSharedBoard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(castVote).toHaveBeenCalledTimes(1));
    expect(castVote.mock.calls[0]?.[1]).toMatchObject({ place_id: 'p1', kind: 'love' });
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

  it('returning member: role=member renders voting UI without 참여하기 + hydrates my ❤️', async () => {
    mockUser = { id: 'u1' };
    getMyBoardRole.mockResolvedValueOnce('member');
    getMyVotedPlaceIds.mockResolvedValueOnce(['p1']);
    getVoteCounts.mockResolvedValueOnce({ p1: 2 });
    render(<VoteIsland {...baseProps} />);

    // No join prompt — straight to the member view with the prior vote filled.
    await screen.findByText('❤️ 많은 순');
    expect(screen.queryByText('이 보드에 참여하기')).toBeNull();
    const voteBtn = await screen.findByTestId('vote-toggle-p1');
    await waitFor(() => expect(voteBtn).toHaveAttribute('aria-pressed', 'true'));
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

  it('❤️ 많은 순 toggle: re-sorts rows by love count desc (확정 수식 제거 — 사람이 결정)', async () => {
    mockUser = { id: 'u1' };
    getVoteCounts.mockResolvedValue({ p1: 0, p2: 3 });

    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ id: 'p1', name_local: '스시집' }), makePlace({ id: 'p2', name_local: '카페' })]}
        initialJoined
        initialMyVotes={{}}
      />,
    );

    await screen.findByTestId('love-count-p2');
    const namesBefore = [...document.querySelectorAll('[data-testid^="place-row-"]')].map(
      (b) => b.textContent,
    );
    expect(namesBefore[0]).toContain('스시집');

    fireEvent.click(screen.getByText('❤️ 많은 순'));
    const namesAfter = [...document.querySelectorAll('[data-testid^="place-row-"]')].map(
      (b) => b.textContent,
    );
    expect(namesAfter[0]).toContain('카페');
    expect(screen.queryByTestId('confirmed-badge-p1')).toBeNull();
  });

  it('row expand: shows detail with Google Maps deep link + timestamped source jump', async () => {
    mockUser = { id: 'u1' };
    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ id: 'p1', source_timestamp_sec: 240, summary_ko: '참치가 유명해요' })]}
        links={[
          {
            id: 'l1',
            source_kind: 'youtube',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: null,
            thumbnail_url: null,
            author_name: null,
            summary_ko: null,
          },
        ]}
        initialJoined
        initialMyVotes={{}}
      />,
    );
    fireEvent.click(await screen.findByTestId('place-row-p1'));
    const maps = screen.getByTestId('maps-link-p1');
    expect(maps.getAttribute('href')).toContain('query_place_id=gpid-1');
    expect(maps.getAttribute('href')).toContain('google.com/maps/search');
    const source = screen.getByTestId('source-link-p1');
    expect(source.textContent).toContain('영상 4:00');
    expect(source.getAttribute('href')).toContain('t=240s');
  });

  it('blog-sourced place: detail shows 원문 보기 to the post URL', async () => {
    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ id: 'p1' })]}
        links={[
          {
            id: 'l1',
            source_kind: 'blog',
            url: 'https://example.tistory.com/1',
            title: null,
            thumbnail_url: null,
            author_name: null,
            summary_ko: null,
          },
        ]}
        initialJoined
        initialMyVotes={{}}
      />,
    );
    fireEvent.click(await screen.findByTestId('place-row-p1'));
    const source = screen.getByTestId('source-link-p1');
    expect(source.textContent).toContain('원문 보기');
    expect(source.getAttribute('href')).toBe('https://example.tistory.com/1');
  });

  it('renders commentary inline when summary_ko present (VIEW-08 carryover)', async () => {
    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ summary_ko: '여기 라멘이 유명해요' })]}
        initialJoined
        initialMyVotes={{}}
      />,
    );
    expect(await screen.findByText('여기 라멘이 유명해요')).toBeInTheDocument();
  });

  it('hides summary block when summary_ko is null (legacy row)', async () => {
    render(<VoteIsland {...baseProps} initialJoined initialMyVotes={{}} />);
    expect(await screen.findByText('스시집')).toBeInTheDocument();
    expect(screen.queryByTestId('place-summary')).toBeNull();
  });

  it('renders name_ko over name_local when present', async () => {
    render(
      <VoteIsland
        {...baseProps}
        places={[makePlace({ name_ko: '스시야', name_local: '寿司屋' })]}
        initialJoined
        initialMyVotes={{}}
      />,
    );
    expect(await screen.findByText('스시야')).toBeInTheDocument();
    expect(screen.queryByText('寿司屋')).toBeNull();
  });

  it('escapes HTML in summary_ko (no XSS)', async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <VoteIsland {...baseProps} places={[makePlace({ summary_ko: payload })]} initialJoined initialMyVotes={{}} />,
    );
    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('legacy empty counts: list renders without crash', async () => {
    mockUser = { id: 'u1' };
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
