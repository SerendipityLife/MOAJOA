import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Link, Place, Plan, PlanItem, Trip, TripMessage } from '@moajoa/core';

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
// Plan 06 — plan 허브 seam.
const getPlanByTrip = vi.fn(async (_c: unknown, _t: string): Promise<unknown> => null);
const generatePlan = vi.fn(async (_c: unknown, _b: unknown): Promise<unknown> => ({}));
const moveToDay = vi.fn(async (_c: unknown, _i: unknown): Promise<unknown> => ({}));
const moveToPool = vi.fn(async (_c: unknown, _id: string): Promise<void> => undefined);
const setTravelMode = vi.fn(async (_c: unknown, _p: string, _m: string): Promise<unknown> => ({}));
const updateTrip = vi.fn(async (_c: unknown, _id: string, _p: unknown): Promise<unknown> => ({}));
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
  getPlanByTrip: (c: unknown, t: string) => getPlanByTrip(c, t),
  generatePlan: (c: unknown, b: unknown) => generatePlan(c, b),
  moveToDay: (c: unknown, i: unknown) => moveToDay(c, i),
  moveToPool: (c: unknown, id: string) => moveToPool(c, id),
  setTravelMode: (c: unknown, p: string, m: string) => setTravelMode(c, p, m),
  updateTrip: (c: unknown, id: string, p: unknown) => updateTrip(c, id, p),
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

// MoaMap 스텁 — onMarkerTap + D-16 배선(places/labels/fitKey)만 노출.
// Google Maps는 jsdom 불가라 지도 자체 계약은 moa-map.test가 검증한다.
vi.mock('@/app/moa/[id]/_components/moa-map', () => ({
  MoaMap: ({
    places,
    labels,
    fitKey,
    onMarkerTap,
  }: {
    places: Place[];
    labels?: Record<string, number>;
    fitKey?: string | number;
    onMarkerTap: (id: string) => void;
  }) => (
    <div>
      <button data-testid="marker-p1" onClick={() => onMarkerTap('p1')}>
        marker
      </button>
      <span data-testid="map-places">{places.map((p) => p.id).join(',')}</span>
      <span data-testid="map-labels">{labels ? JSON.stringify(labels) : 'none'}</span>
      <span data-testid="map-fitkey">{fitKey === undefined ? 'none' : String(fitKey)}</span>
    </div>
  ),
}));

// PlanSection 스텁 — 프레젠테이션은 plan-section.test가 검증한다. island 테스트는
// **props 주입 + 콜백 → mutation 배선**만 관심(스텁이 각 콜백을 버튼으로 노출).
vi.mock('@/app/moa/[id]/_components/plan-section', () => ({
  PlanSection: (props: Record<string, unknown>) => {
    const plan = props.plan as { plan_items: PlanItem[] } | null;
    const renderPool = props.renderPool as
      | ((pool: Place[], onAddToPlan: (id: string) => void) => React.ReactNode)
      | undefined;
    const pool = (props.places as Place[]).filter(
      (p) => !(plan?.plan_items ?? []).some((it) => it.place_id === p.id),
    );
    return (
      <div data-testid="plan-section">
        <span data-testid="plan-generating">{String(props.generating)}</span>
        <span data-testid="plan-step">{(props.planStep as string) ?? 'none'}</span>
        <span data-testid="plan-error">{(props.error as string) ?? 'none'}</span>
        <span data-testid="plan-items">{plan ? String(plan.plan_items.length) : 'none'}</span>
        <span data-testid="plan-daycount">
          {String((props.trip as Trip).day_count ?? 'null')}
        </span>
        <button onClick={props.onGenerate as () => void}>plan-generate</button>
        <button onClick={() => (props.onSaveDuration as (n: number) => void)(3)}>
          plan-save-duration
        </button>
        <button onClick={() => (props.onMovePlaceToDay as (p: string, d: number) => void)('p2', 1)}>
          plan-move-p2-to-day2
        </button>
        <button
          onClick={() =>
            (props.onMoveItemToDay as (i: string, p: string, d: number) => void)('item-1', 'p1', 1)
          }
        >
          plan-move-item1-to-day2
        </button>
        <button onClick={() => (props.onMoveToPool as (i: string) => void)('item-1')}>
          plan-move-item1-to-pool
        </button>
        <button onClick={() => (props.onTravelModeChange as (m: string) => void)('walk')}>
          plan-mode-walk
        </button>
        <button onClick={() => (props.onSelectDay as (d: number) => void)(1)}>plan-day-2</button>
        <button onClick={props.onShare as () => void}>plan-share</button>
        {/* 실물 계약 미러: renderPool은 **플랜이 있을 때(상태 D)만** 호출된다.
            플랜 전에는 island이 전체 PlaceList를 직접 그리므로 여기서 부르면 리스트가 겹친다. */}
        <div data-testid="plan-pool">{plan ? renderPool?.(pool, () => {}) : null}</div>
      </div>
    );
  },
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
// MoaSwitcher 스텁 — 자체 테스트가 별도(moa-switcher.test). 스텁이 없으면 스위처가
// @/components에서 Dropdown* 을 import하는데 위 mock에는 없어서 undefined 렌더 크래시.
vi.mock('@/app/moa/[id]/_components/moa-switcher', () => ({
  MoaSwitcher: ({ title, moas }: { title: string; moas?: { id: string }[] }) => (
    <div data-testid="moa-switcher" data-moas={String(moas?.length ?? 0)}>
      {title}
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
    day_count: null,
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
  initialPlan: null,
  currentUserNickname: '나',
};

function makePlanItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'item-1',
    plan_id: 'plan-1',
    place_id: 'p1',
    day_index: 0,
    sort_order: 0,
    is_anchor: false,
    leg_travel_seconds: null,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(items: PlanItem[]): Plan & { plan_items: PlanItem[] } {
  return {
    id: 'plan-1',
    trip_id: 'trip-1',
    status: 'draft',
    travel_mode: 'transit',
    collaborative: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    plan_items: items,
  } as Plan & { plan_items: PlanItem[] };
}

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
  getPlanByTrip.mockResolvedValue(null);
  generatePlan.mockResolvedValue({});
  moveToDay.mockResolvedValue({});
  moveToPool.mockResolvedValue(undefined);
  setTravelMode.mockResolvedValue({});
  updateTrip.mockResolvedValue({});
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

  it('Test 16: FAB는 초기 렌더(collapsed 시트)에서 노출 (25-06 Gap 3 — Test A)', () => {
    render(<MoaIsland {...baseProps} />);
    expect(screen.getByLabelText('장소 추가')).toBeInTheDocument();
  });

  it('Test 17: 시트 expanded(마커 탭) → FAB 숨김 — 첫 행 하트 탭 타깃 겹침 방지 (25-06 Gap 3 — Test B)', async () => {
    render(<MoaIsland {...baseProps} />);
    fireEvent.click(screen.getByTestId('marker-p1'));
    await waitFor(() => expect(screen.queryByLabelText('장소 추가')).toBeNull());
  });

  it('Test 18: 기본 렌더(호스트, prop 미전달) → [함께 정하기] 노출 (25-06 Gap 4 — Test C 무회귀)', () => {
    render(<MoaIsland {...baseProps} />);
    expect(screen.getByText('함께 정하기')).toBeInTheDocument();
  });

  it('Test 19: hideHostControls 전달(게스트 마운트) → [함께 정하기] 부재 (25-06 Gap 4 — Test D)', () => {
    render(<MoaIsland {...baseProps} hideHostControls />);
    expect(screen.queryByText('함께 정하기')).toBeNull();
  });

  it('Test 35: 좌상단이 MoaSwitcher pill — 옛 [뒤로] 진입점 소멸 (quick-260714-kk6)', () => {
    render(<MoaIsland {...baseProps} />);
    expect(screen.getByTestId('moa-switcher')).toHaveTextContent('도쿄 모아');
    expect(screen.queryByLabelText('뒤로')).toBeNull();
  });

  it('Test A: initialTab="chat" → 탭 클릭 없이 첫 렌더에 채팅 뷰 visible (CHAT-09 착지)', () => {
    render(<MoaIsland {...baseProps} initialTab="chat" />);
    const chatWrapper = screen.getByTestId('moa-chat').parentElement!.parentElement!;
    expect(chatWrapper.className).not.toContain('hidden');
  });

  it('Test B: initialTab 미전달 → 기존 "moa" 기본 탭 (채팅 뷰 hidden — 호스트 무회귀)', () => {
    render(<MoaIsland {...baseProps} />);
    const chatWrapper = screen.getByTestId('moa-chat').parentElement!.parentElement!;
    expect(chatWrapper.className).toContain('hidden');
  });
});

// ── Plan 06 — plan 상태 허브 (D-12~D-18, D-21, D-25). ──
describe('MoaIsland — plan 허브: 생성·진행·mutation·Day↔지도 (Plan 06)', () => {
  const p2 = makePlace({ id: 'p2', seq_no: 2, name_local: '카페', lat: 35.1, lng: 139.1 });
  const p3 = makePlace({ id: 'p3', seq_no: 3, name_local: '공원', lat: 35.2, lng: 139.2 });
  const planProps = { ...baseProps, initialPlaces: [basePlace, p2, p3] };

  it('Test 20: 일정 만들기 → generatePlan 1회 + 생성 중 연타는 차단(유료 API 이중 지출 방지)', async () => {
    let resolve!: (v: unknown) => void;
    generatePlan.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<MoaIsland {...planProps} />);

    fireEvent.click(screen.getByText('plan-generate'));
    await waitFor(() => expect(screen.getByTestId('plan-generating').textContent).toBe('true'));
    // 연타 — in-flight 중에는 재호출되지 않는다.
    fireEvent.click(screen.getByText('plan-generate'));
    fireEvent.click(screen.getByText('plan-generate'));
    expect(generatePlan).toHaveBeenCalledTimes(1);

    resolve({});
    await waitFor(() => expect(screen.getByTestId('plan-generating').textContent).toBe('false'));
  });

  it('Test 21: 재생성 → is_anchor 항목이 pinned_placements + anchor_place_ids로 전달 (D-21 루프)', async () => {
    const items = [
      makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0, sort_order: 0, is_anchor: false }),
      makePlanItem({ id: 'item-2', place_id: 'p2', day_index: 1, sort_order: 0, is_anchor: true }),
      makePlanItem({ id: 'item-3', place_id: 'p3', day_index: 2, sort_order: 1, is_anchor: true }),
    ];
    render(<MoaIsland {...planProps} initialPlan={makePlan(items)} />);

    fireEvent.click(screen.getByText('plan-generate'));

    await waitFor(() => expect(generatePlan).toHaveBeenCalledTimes(1));
    const body = generatePlan.mock.calls[0]![1] as {
      trip_id: string;
      travel_mode: string;
      pinned_placements: { place_id: string; day_index: number }[];
      anchor_place_ids: string[];
      removed_place_ids: string[];
    };
    // 고정: 어느 Day에 — is_anchor 항목만.
    expect(body.pinned_placements).toEqual([
      { place_id: 'p2', day_index: 1 },
      { place_id: 'p3', day_index: 2 },
    ]);
    // 앵커: 반드시 배치 — 같은 place_id들.
    expect(body.anchor_place_ids).toEqual(['p2', 'p3']);
    expect(body.trip_id).toBe('trip-1');
    expect(body.travel_mode).toBe('transit');
    // day_count는 보내지 않는다 — 서버가 trips에서 읽는다(T-28-08).
    expect(body).not.toHaveProperty('day_count');
  });

  it('Test 22: 최초 생성(플랜 없음) → pinned_placements·anchor_place_ids 빈 배열', async () => {
    render(<MoaIsland {...planProps} />);
    fireEvent.click(screen.getByText('plan-generate'));
    await waitFor(() => expect(generatePlan).toHaveBeenCalledTimes(1));
    const body = generatePlan.mock.calls[0]![1] as {
      pinned_placements: unknown[];
      anchor_place_ids: unknown[];
    };
    expect(body.pinned_placements).toEqual([]);
    expect(body.anchor_place_ids).toEqual([]);
  });

  it('Test 23: 생성 중 plan:{tripId} 별도 broadcast 채널 구독 → planStep 갱신, 완료 시 removeChannel', async () => {
    let resolve!: (v: unknown) => void;
    generatePlan.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<MoaIsland {...planProps} />);
    // 마운트 시점에는 moa 채널 하나뿐(plan 채널은 생성 트리거에서만 연다).
    expect(channel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('plan-generate'));
    await waitFor(() => expect(channel).toHaveBeenCalledTimes(2));
    // 기존 moa 채널에 얹지 않는다 — 별도 채널이어야 사후 바인딩 no-op(#1917)을 피한다.
    expect(channel).toHaveBeenLastCalledWith('plan:trip-1');
    const planCh = lastChannel;

    const bc = onCalls.find((o) => o.type === 'broadcast');
    expect(bc).toBeDefined();
    expect(bc!.filter.event).toBe('progress');
    bc!.cb({ payload: { step: 'clustering', progress_pct: 50 } });
    await waitFor(() => expect(screen.getByTestId('plan-step').textContent).toBe('clustering'));

    resolve({});
    await waitFor(() => expect(removeChannel).toHaveBeenCalledWith(planCh));
  });

  it('Test 24: 생성 성공 → getPlanByTrip refetch로 plan 갱신 (plan_items는 realtime 대상 아님)', async () => {
    getPlanByTrip.mockResolvedValue(
      makePlan([makePlanItem({ id: 'item-1', place_id: 'p1' }), makePlanItem({ id: 'item-2', place_id: 'p2', sort_order: 1 })]),
    );
    render(<MoaIsland {...planProps} />);
    expect(screen.getByTestId('plan-items').textContent).toBe('none');

    fireEvent.click(screen.getByText('plan-generate'));

    await waitFor(() => expect(getPlanByTrip).toHaveBeenCalledWith(expect.anything(), 'trip-1'));
    await waitFor(() => expect(screen.getByTestId('plan-items').textContent).toBe('2'));
  });

  it('Test 25: 생성 실패 → planError 세팅(상태 E) + generating 해제', async () => {
    generatePlan.mockRejectedValueOnce(new Error('boom'));
    render(<MoaIsland {...planProps} />);
    fireEvent.click(screen.getByText('plan-generate'));
    await waitFor(() =>
      expect(screen.getByTestId('plan-error').textContent).toBe('일정을 만들지 못했어요'),
    );
    expect(screen.getByTestId('plan-generating').textContent).toBe('false');
  });

  it('Test 26: 기간 게이트 확정 → updateTrip(day_count) 성공 후 이어서 generatePlan (D-13)', async () => {
    render(<MoaIsland {...planProps} />);
    fireEvent.click(screen.getByText('plan-save-duration'));

    await waitFor(() =>
      expect(updateTrip).toHaveBeenCalledWith(expect.anything(), 'trip-1', { day_count: 3 }),
    );
    await waitFor(() => expect(generatePlan).toHaveBeenCalledTimes(1));
    // 저장한 기간이 PlanSection에 즉시 반영된다(Day 탭 수 = day_count).
    await waitFor(() => expect(screen.getByTestId('plan-daycount').textContent).toBe('3'));
  });

  it('Test 27: updateTrip 실패(RLS owner-only) → 에러 토스트 + 생성 미실행 (fail-closed)', async () => {
    updateTrip.mockRejectedValueOnce(new Error('rls'));
    render(<MoaIsland {...planProps} />);
    fireEvent.click(screen.getByText('plan-save-duration'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('기간을 저장하지 못했어요. 다시 시도해 주세요', {
        variant: 'error',
      }),
    );
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it('Test 28: 풀 → Day 배치 → moveToDay + plan refetch + Day N 토스트', async () => {
    const plan = makePlan([makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0 })]);
    getPlanByTrip.mockResolvedValue(
      makePlan([
        makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0 }),
        makePlanItem({ id: 'item-9', place_id: 'p2', day_index: 1 }),
      ]),
    );
    render(<MoaIsland {...planProps} initialPlan={plan} />);

    fireEvent.click(screen.getByText('plan-move-p2-to-day2'));

    await waitFor(() =>
      expect(moveToDay).toHaveBeenCalledWith(expect.anything(), {
        plan_id: 'plan-1',
        place_id: 'p2',
        day_index: 1,
        sort_order: 0,
      }),
    );
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Day 2에 넣었어요'));
    await waitFor(() => expect(screen.getByTestId('plan-items').textContent).toBe('2'));
  });

  it('Test 29: 타임라인 항목 Day 이동 → is_anchor:true가 유지되는 경로(moveToPool → moveToDay)', async () => {
    const plan = makePlan([makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0 })]);
    render(<MoaIsland {...planProps} initialPlan={plan} />);

    fireEvent.click(screen.getByText('plan-move-item1-to-day2'));

    // reorderPlanItem은 is_anchor를 세우지 않는다 — 삭제 후 재insert로 수동 배치 마커를 보장.
    await waitFor(() => expect(moveToPool).toHaveBeenCalledWith(expect.anything(), 'item-1'));
    await waitFor(() =>
      expect(moveToDay).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plan_id: 'plan-1', place_id: 'p1', day_index: 1 }),
      ),
    );
  });

  it('Test 30: 이동수단 토글 → setTravelMode만 호출, 자동 재생성 없음 (A-10 — 유료 API 방어)', async () => {
    const plan = makePlan([makePlanItem({ id: 'item-1', place_id: 'p1' })]);
    render(<MoaIsland {...planProps} initialPlan={plan} />);

    fireEvent.click(screen.getByText('plan-mode-walk'));

    await waitFor(() =>
      expect(setTravelMode).toHaveBeenCalledWith(expect.anything(), 'plan-1', 'walk'),
    );
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it('Test 31: Day 선택 → 지도에 그날 핀만 + 번호 labels + fitKey (D-16, (0,0) 제외)', async () => {
    const noCoords = makePlace({ id: 'p4', seq_no: 4, name_local: '좌표없음', lat: 0, lng: 0 });
    const plan = makePlan([
      makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0, sort_order: 0 }),
      makePlanItem({ id: 'item-2', place_id: 'p2', day_index: 1, sort_order: 0 }),
      makePlanItem({ id: 'item-3', place_id: 'p3', day_index: 1, sort_order: 1 }),
      makePlanItem({ id: 'item-4', place_id: 'p4', day_index: 1, sort_order: 2 }),
    ]);
    render(
      <MoaIsland
        {...planProps}
        initialPlaces={[basePlace, p2, p3, noCoords]}
        initialPlan={plan}
      />,
    );
    // Day 1(selectedDay=0) — p1만.
    expect(screen.getByTestId('map-places').textContent).toBe('p1');
    expect(screen.getByTestId('map-fitkey').textContent).toBe('0');
    expect(screen.getByTestId('map-labels').textContent).toBe(JSON.stringify({ p1: 1 }));

    fireEvent.click(screen.getByText('plan-day-2'));

    // Day 2 — p2·p3만(번호 = sort_order+1). (0,0)인 p4는 지도에서 제외(대서양 핀 방지).
    await waitFor(() => expect(screen.getByTestId('map-places').textContent).toBe('p2,p3'));
    expect(screen.getByTestId('map-fitkey').textContent).toBe('1');
    expect(screen.getByTestId('map-labels').textContent).toBe(JSON.stringify({ p2: 1, p3: 2 }));
  });

  it('Test 32: 플랜 없음 → 지도는 전체 places + labels·fitKey 미전달 (기존 경로 무회귀)', () => {
    render(<MoaIsland {...planProps} />);
    expect(screen.getByTestId('map-places').textContent).toBe('p1,p2,p3');
    expect(screen.getByTestId('map-labels').textContent).toBe('none');
    expect(screen.getByTestId('map-fitkey').textContent).toBe('none');
  });

  it('Test 33: 플랜 있음 → 미배치 풀은 renderPool로 PlaceList 재사용(중복 리스트 없음)', () => {
    const plan = makePlan([makePlanItem({ id: 'item-1', place_id: 'p1', day_index: 0 })]);
    render(<MoaIsland {...planProps} initialPlan={plan} />);
    const pool = screen.getByTestId('plan-pool');
    // 배치된 p1은 풀에 없고, 미배치 p2·p3만 PlaceList로 렌더된다.
    expect(pool.textContent).toContain('카페');
    expect(pool.textContent).toContain('공원');
    // 플랜이 있으면 시트 본문에 별도 전체 PlaceList를 또 그리지 않는다(A-12).
    expect(screen.getAllByText('카페')).toHaveLength(1);
  });

  it('Test 34: 게스트 마운트(hideHostControls) → PlanSection 미렌더 (T-28-28)', () => {
    render(<MoaIsland {...planProps} hideHostControls />);
    expect(screen.queryByTestId('plan-section')).toBeNull();
    // 기존 PlaceList는 그대로 보인다.
    expect(screen.getByText('스시집')).toBeInTheDocument();
  });
});

// ── 29-02 F-2 — voter 게스트(dates join)에게 장소 추가 FAB 미노출. ──
describe('MoaIsland — hidePlaceAdd (F-2, 29-02)', () => {
  it('Test 35: hidePlaceAdd 전달 → 장소 추가 FAB 미렌더 (실패하는 버튼 금지)', () => {
    render(<MoaIsland {...baseProps} hidePlaceAdd />);
    expect(screen.queryByLabelText('장소 추가')).toBeNull();
  });

  it('Test 36: 미전달 → FAB 렌더 유지 (기존 렌더 동일 — 회귀 앵커, CHAT-07)', () => {
    render(<MoaIsland {...baseProps} />);
    expect(screen.getByLabelText('장소 추가')).toBeInTheDocument();
  });
});
