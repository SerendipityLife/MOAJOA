import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Link, Place, Trip, TripMessage } from '@moajoa/core';

// --- Realtime channel stub: .on(type, filter, cb) 콜백 캡처(poll-vote-island 선례). ---
// presence sync 바인딩도 onCalls에 type:'presence'로 잡힌다. subscribe는 콜백을
// 동기로 'SUBSCRIBED' 호출해 track 경로를 검증한다.
type OnCall = {
  type: string;
  filter: { event?: string; table?: string };
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
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ channel, removeChannel }),
}));

// --- API seam (네트워크 hydration 불필요 — seed props). ---
const listPlacesByTrip = vi.fn(async (_c: unknown, _t: string): Promise<Place[]> => []);
const listLinksByTrip = vi.fn(async (_c: unknown, _t: string): Promise<Link[]> => []);
const getVoteCounts = vi.fn(
  async (_c: unknown, _ids: string[]): Promise<Record<string, number>> => ({}),
);
const getProfileNames = vi.fn(
  async (_c: unknown, _ids: string[]): Promise<Record<string, string>> => ({}),
);
const castVote = vi.fn(async (_c: unknown, _in: unknown) => ({}));
const retractVote = vi.fn(async (_c: unknown, _id: string) => undefined);
const triggerExtraction = vi.fn(async (_c: unknown, _id: string) => ({}));
const hidePlace = vi.fn(async (_c: unknown, _id: string) => undefined);
const sendTripMessage = vi.fn(async (_c: unknown, _in: unknown): Promise<unknown> => ({}));
vi.mock('@moajoa/api', () => ({
  listPlacesByTrip: (c: unknown, t: string) => listPlacesByTrip(c, t),
  listLinksByTrip: (c: unknown, t: string) => listLinksByTrip(c, t),
  getVoteCounts: (c: unknown, ids: string[]) => getVoteCounts(c, ids),
  getProfileNames: (c: unknown, ids: string[]) => getProfileNames(c, ids),
  castVote: (c: unknown, i: unknown) => castVote(c, i),
  retractVote: (c: unknown, id: string) => retractVote(c, id),
  triggerExtraction: (c: unknown, id: string) => triggerExtraction(c, id),
  hidePlace: (c: unknown, id: string) => hidePlace(c, id),
  sendTripMessage: (c: unknown, i: unknown) => sendTripMessage(c, i),
}));

const toast = vi.fn();
vi.mock('@/components', () => ({
  useToast: () => ({ toast }),
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  },
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// MoaMap 스텁 — onMarkerTap만 노출(Google Maps는 jsdom 불가, 실지도는 manual UAT).
vi.mock('@/app/moa/[id]/_components/moa-map', () => ({
  MoaMap: ({ onMarkerTap }: { onMarkerTap: (id: string) => void }) => (
    <button data-testid="marker-p1" onClick={() => onMarkerTap('p1')}>
      marker
    </button>
  ),
}));

// AddSheet / ShareSheet 스텁 — 자체 테스트가 별도로 검증(add-sheet.test·share-sheet.test).
// island 테스트는 배선(open 상태)만 관심.
vi.mock('@/app/moa/[id]/_components/add-sheet', () => ({
  AddSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="add-sheet" /> : null),
}));
vi.mock('@/app/moa/[id]/_components/share-sheet', () => ({
  ShareSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="share-sheet" /> : null),
}));

// MoaChat / MoaTabBar 스텁 — 자체 프레젠테이션 테스트가 별도(moa-chat.test).
// island 테스트는 배선(message/viewers/onSend props + 탭 전환)만 관심.
vi.mock('@/app/moa/[id]/_components/moa-chat', () => ({
  MoaChat: ({
    messages,
    viewers,
    onSend,
    replyToPlaceId,
    onChipTap,
  }: {
    messages: TripMessage[];
    viewers: number;
    onSend: (body: string, replyToPlaceId: string | null) => Promise<void>;
    replyToPlaceId: string | null;
    onChipTap: (placeId: string) => void;
  }) => (
    <div data-testid="moa-chat">
      <span data-testid="viewers">{viewers}</span>
      <span data-testid="reply-target">{replyToPlaceId ?? ''}</span>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            {m.body}
            {m.reply_to_place_id && (
              <button onClick={() => onChipTap(m.reply_to_place_id!)}>
                chip-{m.reply_to_place_id}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button onClick={() => void onSend('hi', null)}>chat-send</button>
    </div>
  ),
}));
vi.mock('@/app/moa/[id]/_components/moa-tab-bar', () => ({
  MoaTabBar: ({ onTabChange }: { onTabChange: (tab: 'moa' | 'chat') => void }) => (
    <div>
      <button onClick={() => onTabChange('moa')}>tab-모으기</button>
      <button onClick={() => onTabChange('chat')}>tab-채팅</button>
    </div>
  ),
}));

// Import AFTER mocks.
import { MoaIsland, type MoaIslandProps } from '@/app/moa/[id]/_components/moa-island';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    board_id: 'b1',
    link_id: null,
    added_by: 'u1',
    google_place_id: 'gpid-1',
    name_local: '스시집',
    name_ko: null,
    name_en: null,
    lat: 35,
    lng: 139,
    category: 'restaurant',
    address: null,
    source_timestamp_sec: null,
    source_quote: null,
    summary_ko: null,
    note: null,
    hidden_at: null,
    source_kind: 'ai',
    confidence: 0.9,
    seq_no: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTrip(overrides: Partial<Trip>): Trip {
  return {
    id: 'trip-1',
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
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const basePlace = makePlace({});

// TripMessageCreateSchema.parse(handleSend)가 trip_id uuid를 요구 — 전송 경로 테스트용.
const UUID_TRIP = '11111111-1111-1111-1111-111111111111';

function makeMessage(overrides: Partial<TripMessage>): TripMessage {
  return {
    id: 'm1',
    trip_id: 'trip-1',
    user_id: 'u2',
    nickname: '친구',
    body: '안녕',
    reply_to_place_id: null,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const baseProps: MoaIslandProps = {
  trip: makeTrip({}),
  currentUserId: 'u1',
  initialPlaces: [basePlace],
  initialLinks: [],
  initialCounts: {},
  initialMyVotedPlaceIds: [],
  memberIdsInJoinOrder: [],
  initialProfileNames: { u1: '나' },
  initialMessages: [],
  currentUserNickname: '나',
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  vi.clearAllMocks();
  onCalls = [];
  lastChannel = null;
  listPlacesByTrip.mockResolvedValue([]);
  listLinksByTrip.mockResolvedValue([]);
  getVoteCounts.mockResolvedValue({});
  getProfileNames.mockResolvedValue({});
  castVote.mockResolvedValue({});
  retractVote.mockResolvedValue(undefined);
  triggerExtraction.mockResolvedValue({});
  hidePlace.mockResolvedValue(undefined);
  sendTripMessage.mockResolvedValue({});
});

describe('MoaIsland — 채널 lifecycle + reconcile + optimistic 찜 (D-14/16)', () => {
  it('Test 1: moa:{tripId} 단일 채널 + postgres_changes 3바인딩(places/links/trip_messages) + presence sync + SUBSCRIBED track', () => {
    render(<MoaIsland {...baseProps} />);
    expect(channel).toHaveBeenCalledTimes(1);
    // moa: prefix + presence key(currentUserId) 정확 단언 (ONE channel per screen).
    expect(channel).toHaveBeenCalledWith('moa:trip-1', {
      config: { presence: { key: 'u1' } },
    });
    const pg = onCalls.filter((o) => o.type === 'postgres_changes');
    expect(pg).toHaveLength(3);
    const places = pg.find((o) => o.filter.table === 'places');
    const links = pg.find((o) => o.filter.table === 'links');
    const msgs = pg.find((o) => o.filter.table === 'trip_messages');
    expect(places?.filter.event).toBe('INSERT');
    expect(links?.filter.event).toBe('UPDATE');
    expect(msgs?.filter.event).toBe('INSERT');
    // presence sync 바인딩 존재.
    expect(onCalls.some((o) => o.type === 'presence' && o.filter.event === 'sync')).toBe(true);
    expect(lastChannel!.subscribe).toHaveBeenCalled();
    // SUBSCRIBED 콜백에서 track({user_id, nickname}).
    expect(lastChannel!.track).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', nickname: '나' }),
    );
  });

  it('Test 2: 언마운트 시 removeChannel이 동일 채널 인스턴스로 호출', () => {
    const { unmount } = render(<MoaIsland {...baseProps} />);
    const ch = lastChannel;
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(ch);
  });

  it('Test 3: places INSERT 콜백 → listPlacesByTrip refetch + 장소 +1이면 토스트', async () => {
    const p2 = makePlace({ id: 'p2', seq_no: 2, added_by: 'u2', name_local: '카페' });
    listPlacesByTrip.mockResolvedValue([basePlace, p2]);
    render(<MoaIsland {...baseProps} />);
    const insert = onCalls.find((o) => o.filter.table === 'places');
    expect(insert).toBeDefined();
    insert!.cb();
    await waitFor(() => expect(listPlacesByTrip).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalledWith('장소 1개 추가됨'));
  });

  it('Test 4: 하트 토글 → castVote·count 즉시 +1, reject 시 원복 + 에러 토스트', async () => {
    castVote.mockRejectedValueOnce(new Error('fail'));
    render(<MoaIsland {...baseProps} />);
    const heart = screen.getByLabelText('찜');
    expect(heart.textContent).toContain('0');
    fireEvent.click(heart);
    expect(castVote).toHaveBeenCalledTimes(1);
    expect(heart.textContent).toContain('1'); // optimistic
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('투표를 저장하지 못했어요.', { variant: 'error' }),
    );
    expect(heart.textContent).toContain('0'); // rollback
  });

  it('Test 5: 마커 탭(onMarkerTap) → place-list 해당 행 aria-expanded=true', async () => {
    render(<MoaIsland {...baseProps} />);
    expect(screen.queryByRole('button', { expanded: true })).toBeNull();
    fireEvent.click(screen.getByTestId('marker-p1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument(),
    );
  });

  it('Test 6: FAB는 기본 노출, add 시트가 열리면 숨겨짐 (시트 위 부유 방지)', () => {
    render(<MoaIsland {...baseProps} />);
    const fab = screen.getByLabelText('장소 추가');
    expect(fab).toBeInTheDocument();
    fireEvent.click(fab);
    expect(screen.getByTestId('add-sheet')).toBeInTheDocument();
    expect(screen.queryByLabelText('장소 추가')).toBeNull();
  });

  it('Test 7: 함께 정하기(share) 시트가 열리면 FAB 숨겨짐', () => {
    render(<MoaIsland {...baseProps} />);
    fireEvent.click(screen.getByText('함께 정하기'));
    expect(screen.getByTestId('share-sheet')).toBeInTheDocument();
    expect(screen.queryByLabelText('장소 추가')).toBeNull();
  });

  it('Test 8: 삭제 → optimistic 제거 + hidePlace(placeId) + 성공 토스트', async () => {
    render(<MoaIsland {...baseProps} />);
    // 마커 탭으로 p1 행 아코디언 확장 → 삭제 버튼 노출.
    fireEvent.click(screen.getByTestId('marker-p1'));
    const del = await screen.findByText('삭제');
    fireEvent.click(del);
    // optimistic: 행 즉시 제거.
    await waitFor(() => expect(screen.queryByText('스시집')).toBeNull());
    expect(hidePlace).toHaveBeenCalledWith(expect.anything(), 'p1');
    await waitFor(() => expect(toast).toHaveBeenCalledWith('삭제했어요'));
  });

  it('Test 9: 삭제 실패 → reconcile 복원 + 에러 토스트', async () => {
    hidePlace.mockRejectedValueOnce(new Error('fail'));
    listPlacesByTrip.mockResolvedValue([basePlace]); // reconcile이 되돌림.
    render(<MoaIsland {...baseProps} />);
    fireEvent.click(screen.getByTestId('marker-p1'));
    fireEvent.click(await screen.findByText('삭제'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('삭제하지 못했어요', { variant: 'error' }),
    );
    await waitFor(() => expect(screen.getByText('스시집')).toBeInTheDocument());
  });

  it('Test 10: trip_messages INSERT 콜백 → 메시지 append + 동일 id 재수신 시 dedup', async () => {
    render(<MoaIsland {...baseProps} />);
    const msgBinding = onCalls.find((o) => o.filter.table === 'trip_messages');
    expect(msgBinding).toBeDefined();
    // 채팅 탭으로 전환(뷰는 hidden 토글 — 언마운트 아님).
    fireEvent.click(screen.getByText('tab-채팅'));
    msgBinding!.cb({ new: makeMessage({ id: 'm1', body: '안녕' }) });
    await waitFor(() => expect(screen.getByText('안녕')).toBeInTheDocument());
    // 같은 id 재수신 → 중복 렌더 없음.
    msgBinding!.cb({ new: makeMessage({ id: 'm1', body: '안녕' }) });
    await waitFor(() => expect(screen.getAllByText('안녕')).toHaveLength(1));
  });

  it('Test 11: presence sync 콜백 → viewers 카운트(distinct key)', async () => {
    render(<MoaIsland {...baseProps} />);
    const presence = onCalls.find((o) => o.type === 'presence');
    expect(presence).toBeDefined();
    (lastChannel!.presenceState as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      { u1: [], u2: [] },
    );
    presence!.cb();
    fireEvent.click(screen.getByText('tab-채팅'));
    await waitFor(() => expect(screen.getByTestId('viewers').textContent).toBe('2'));
  });

  it('Test 12: 탭 전환은 채널을 재생성/제거하지 않음(단일 채널 유지 D-02)', () => {
    render(<MoaIsland {...baseProps} />);
    expect(channel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('tab-채팅'));
    fireEvent.click(screen.getByText('tab-모으기'));
    expect(channel).toHaveBeenCalledTimes(1);
    expect(removeChannel).not.toHaveBeenCalled();
  });

  it('Test 13: 전송 → sendTripMessage 1회 + 반환 row optimistic append', async () => {
    sendTripMessage.mockResolvedValue(makeMessage({ id: 'm-sent', body: 'hi', trip_id: UUID_TRIP }));
    render(<MoaIsland {...baseProps} trip={makeTrip({ id: UUID_TRIP })} />);
    fireEvent.click(screen.getByText('tab-채팅'));
    fireEvent.click(screen.getByText('chat-send'));
    await waitFor(() => expect(sendTripMessage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('hi')).toBeInTheDocument());
  });

  it('Test 14: 답장 버튼(CHAT-03) → 채팅 탭 전환 + replyToPlaceId 프리필', async () => {
    render(<MoaIsland {...baseProps} />);
    // p1 행 아코디언 확장(마커 탭) → 답장 버튼 노출.
    fireEvent.click(screen.getByTestId('marker-p1'));
    fireEvent.click(await screen.findByText('답장'));
    // island이 replyToPlaceId='p1' 프리필 + 채팅 뷰 활성화.
    await waitFor(() => expect(screen.getByTestId('reply-target').textContent).toBe('p1'));
    const chatWrapper = screen.getByTestId('moa-chat').parentElement!.parentElement!;
    expect(chatWrapper.className).not.toContain('hidden');
  });

  it('Test 15: #N 칩 탭(CHAT-03) → 모으기 탭 전환 + openPlaceId + 하이라이트', async () => {
    render(
      <MoaIsland
        {...baseProps}
        initialMessages={[makeMessage({ id: 'm1', reply_to_place_id: 'p1', body: '여기 어때' })]}
      />,
    );
    fireEvent.click(screen.getByText('tab-채팅'));
    fireEvent.click(screen.getByText('chip-p1'));
    // 모으기 뷰에서 p1 행이 열리고(aria-expanded) 짧은 하이라이트 큐가 켜진다.
    await waitFor(() =>
      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument(),
    );
    const row = document.querySelector('[data-place-id="p1"]');
    expect(row).toHaveAttribute('data-highlighted', 'true');
  });
});
