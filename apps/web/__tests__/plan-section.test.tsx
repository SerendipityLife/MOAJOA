import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLAN_STEP_KO, type Link, type Place, type PlanItem, type Trip } from '@moajoa/core';

// 실 컴포넌트(BottomSheet · Button · SelectPill · DurationPills · PlaceList)를 그대로 쓴다.
import {
  PlanSection,
  type PlanSectionProps,
  type PlanWithItemsView,
} from '@/app/moa/[id]/_components/plan-section';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    owner_id: 'host',
    representative_id: 'host',
    title: '오사카 모아',
    description: null,
    visibility: 'private',
    share_slug: null,
    city_code: 'osaka',
    start_date: null,
    end_date: null,
    cover_image_url: null,
    share_mode: null,
    companion: null,
    day_count: 4,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    board_id: 't1',
    link_id: 'l1',
    added_by: 'host',
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

function makeLink(overrides: Partial<Link>): Link {
  return {
    id: 'l1',
    board_id: 't1',
    added_by: 'host',
    source_kind: 'youtube',
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    original_url: 'https://youtu.be/abcdefghijk',
    title: null,
    thumbnail_url: null,
    author_name: null,
    summary_ko: null,
    external_id: null,
    extraction_status: 'ready',
    extraction_error: null,
    extraction_confidence: 0.9,
    extracted_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'i1',
    plan_id: 'plan-1',
    place_id: 'p1',
    day_index: 0,
    sort_order: 0,
    leg_travel_seconds: null,
    is_anchor: false,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(items: PlanItem[]): PlanWithItemsView {
  return {
    id: 'plan-1',
    trip_id: 't1',
    status: 'draft',
    travel_mode: 'transit',
    collaborative: false,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    plan_items: items,
  };
}

const onSelectDay = vi.fn();
const onGenerate = vi.fn();
const onSaveDuration = vi.fn();
const onMovePlaceToDay = vi.fn();
const onMoveItemToDay = vi.fn();
const onMoveToPool = vi.fn();
const onTravelModeChange = vi.fn();
const onShare = vi.fn();

beforeEach(() => {
  onSelectDay.mockClear();
  onGenerate.mockClear();
  onSaveDuration.mockClear();
  onMovePlaceToDay.mockClear();
  onMoveItemToDay.mockClear();
  onMoveToPool.mockClear();
  onTravelModeChange.mockClear();
  onShare.mockClear();
});

function renderSection(overrides: Partial<PlanSectionProps> = {}) {
  const props: PlanSectionProps = {
    plan: null,
    places: [makePlace({ id: 'p1' })],
    links: [],
    trip: makeTrip(),
    currentUserId: 'host',
    generating: false,
    planStep: null,
    error: null,
    selectedDay: 0,
    onSelectDay,
    onGenerate,
    onSaveDuration,
    onMovePlaceToDay,
    onMoveItemToDay,
    onMoveToPool,
    onTravelModeChange,
    onShare,
    ...overrides,
  };
  return render(<PlanSection {...props} />);
}

describe('PlanSection — 상태기계 A~E', () => {
  it('Test 1 (상태 A): 장소 0개면 [일정] 섹션 자체가 렌더되지 않는다', () => {
    const { container } = renderSection({ places: [] });
    expect(container.firstChild).toBeNull();
  });

  it("Test 2 (상태 B, D-23): plan=null + 장소≥1 → 빈 상태 카피 + '일정 만들기'", () => {
    renderSection();
    expect(screen.getByText('아직 일정이 없어요')).toBeTruthy();
    expect(
      screen.getByText('링크를 넣거나 장소를 담고 일정 만들기를 누르면 AI가 동선을 짜드려요'),
    ).toBeTruthy();
    const cta = screen.getByRole('button', { name: '일정 만들기' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    fireEvent.click(cta);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("Test 3 (상태 B-1, D-14): 추출 중 링크 2개 → 버튼 disabled + '2개 분석 중'", () => {
    renderSection({
      links: [
        makeLink({ id: 'l1', extraction_status: 'pending' }),
        makeLink({ id: 'l2', extraction_status: 'processing' }),
        makeLink({ id: 'l3', extraction_status: 'ready' }), // 완료분은 세지 않는다
      ],
    });
    const cta = screen.getByRole('button', { name: '일정 만들기' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(screen.getByText('영상에서 장소를 찾고 있어요 · 2개 분석 중')).toBeTruthy();
    fireEvent.click(cta);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('Test 4 (상태 B-2, D-13): 기간 미정 + owner → 탭 시 게이트 시트가 열리고 onGenerate 미발화', () => {
    renderSection({
      trip: makeTrip({ day_count: null, start_date: null }),
      currentUserId: 'host',
    });
    fireEvent.click(screen.getByRole('button', { name: '일정 만들기' }));
    expect(onGenerate).not.toHaveBeenCalled();

    // 게이트 시트가 열렸다 — 기간 pill + 시트 CTA.
    expect(screen.getByText('여행 기간을 알려주세요')).toBeTruthy();
    expect(screen.getByText('2박 3일')).toBeTruthy();

    // 기간 확정 → onSaveDuration(3). 생성은 island가 저장 성공 후 이어서 한다.
    fireEvent.click(screen.getByText('2박 3일'));
    fireEvent.click(screen.getByRole('button', { name: '이 기간으로 일정 만들기' }));
    expect(onSaveDuration).toHaveBeenCalledWith(3);
  });

  it('Test 5 (상태 B-3, A-9): 기간 미정 + 비-owner → disabled + 안내 카피, 시트 안 열림', () => {
    renderSection({
      trip: makeTrip({ day_count: null, start_date: null, owner_id: 'host' }),
      currentUserId: 'editor',
    });
    const cta = screen.getByRole('button', { name: '일정 만들기' }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(screen.getByText('호스트가 여행 기간을 정하면 일정을 만들 수 있어요')).toBeTruthy();

    fireEvent.click(cta);
    expect(screen.queryByText('여행 기간을 알려주세요')).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(onSaveDuration).not.toHaveBeenCalled();
  });

  it('Test 6 (상태 C): generating → disabled + 라벨 교체 + PLAN_STEP_KO 진행 카피', () => {
    renderSection({ generating: true, planStep: 'clustering' });
    const cta = screen.getByRole('button', {
      name: '일정을 짜고 있어요…',
    }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    // 진행 카피는 core 상수 — 신규 문자열 금지.
    expect(screen.getByText(PLAN_STEP_KO.clustering)).toBeTruthy();
    fireEvent.click(cta);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("Test 7 (상태 E): error → 에러 행 + '다시 시도'", () => {
    renderSection({ error: '일정을 만들지 못했어요' });
    expect(screen.getByText('일정을 만들지 못했어요')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

describe('PlanSection — 상태 D (Day 탭 + 타임라인)', () => {
  it('Test 8 (상태 D): Day 탭 + sort_order 순 타임라인 + 번호 배지 = sort_order+1', () => {
    renderSection({
      trip: makeTrip({ day_count: 2 }),
      places: [
        makePlace({ id: 'p1', name_local: '공항' }),
        makePlace({ id: 'p2', name_local: '호텔' }),
      ],
      // 일부러 역순으로 넣어 정렬을 검증한다.
      plan: makePlan([
        makeItem({ id: 'i2', place_id: 'p2', day_index: 0, sort_order: 1 }),
        makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 }),
      ]),
      selectedDay: 0,
    });

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]!.textContent).toContain('공항');
    expect(rows[1]!.textContent).toContain('호텔');
    // 번호 배지 = sort_order + 1 (그날 방문 순서). place-list의 seq_no와 다른 체계.
    expect(rows[0]!.querySelector('span[aria-hidden]')!.textContent).toBe('1');
    expect(rows[1]!.querySelector('span[aria-hidden]')!.textContent).toBe('2');
  });

  it('Test 9 (W8 Day 탭 수): day_count=6인데 items가 Day 0~3에만 있어도 탭이 6개', () => {
    renderSection({
      trip: makeTrip({ day_count: 6 }),
      places: [makePlace({ id: 'p1' })],
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 3, sort_order: 0 })]),
      selectedDay: 3,
    });
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByText('Day 6')).toBeTruthy();
  });

  it('Test 10 (빈 Day): items가 0인 Day를 고르면 빈 상태 카피가 렌더된다', () => {
    renderSection({
      trip: makeTrip({ day_count: 6 }),
      places: [makePlace({ id: 'p1' })],
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 })]),
      selectedDay: 4, // 비어 있는 Day 5
    });
    expect(
      screen.getByText('이 날은 아직 비어 있어요. 아래에서 장소를 넣어보세요'),
    ).toBeTruthy();
  });

  it('Test 11 (day_count null 폴백): 레거시 플랜도 max(day_index)+1로 탭이 뜬다', () => {
    renderSection({
      trip: makeTrip({ day_count: null, start_date: '2026-08-01', end_date: '2026-08-03' }),
      places: [
        makePlace({ id: 'p1' }),
        makePlace({ id: 'p2' }),
        makePlace({ id: 'p3' }),
      ],
      plan: makePlan([
        makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 }),
        makeItem({ id: 'i2', place_id: 'p2', day_index: 1, sort_order: 0 }),
        makeItem({ id: 'i3', place_id: 'p3', day_index: 2, sort_order: 0 }),
      ]),
    });
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it("Test 12 (D-17 미배치 풀): pool = places − plan_items, 헤딩 '아직 안 넣은 곳 N'", () => {
    const pooled: string[] = [];
    const { rerender, container } = renderSection({
      trip: makeTrip({ day_count: 1 }),
      places: [
        makePlace({ id: 'p1', name_local: '배치됨' }),
        makePlace({ id: 'p2', name_local: '미배치A' }),
        makePlace({ id: 'p3', name_local: '미배치B' }),
      ],
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 })]),
      renderPool: (pool) => {
        pooled.push(...pool.map((p) => p.id));
        return null;
      },
    });
    expect(screen.getByText('아직 안 넣은 곳 2')).toBeTruthy();
    expect(pooled).toEqual(['p2', 'p3']);

    // 풀이 0개면 섹션 미렌더.
    const allPlaced: PlanSectionProps = {
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 })]),
      places: [makePlace({ id: 'p1', name_local: '배치됨' })],
      links: [],
      trip: makeTrip({ day_count: 1 }),
      currentUserId: 'host',
      generating: false,
      planStep: null,
      error: null,
      selectedDay: 0,
      onSelectDay,
      onGenerate,
      onSaveDuration,
      onMovePlaceToDay,
      onMoveItemToDay,
      onMoveToPool,
      onTravelModeChange,
      onShare,
    };
    rerender(<PlanSection {...allPlaced} />);
    expect(container.textContent).not.toContain('아직 안 넣은 곳');
  });

  it("Test 13 (D-25): '일정 다시 만들기' 아래 수동 배치 보존 문구가 항상 렌더된다", () => {
    renderSection({
      trip: makeTrip({ day_count: 1 }),
      places: [makePlace({ id: 'p1' })],
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 })]),
    });
    expect(screen.getByRole('button', { name: /일정 다시 만들기/ })).toBeTruthy();
    expect(screen.getByText('직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요')).toBeTruthy();
  });

  it('Test 14 (A-10 이동수단): 세그먼트 변경 → onTravelModeChange만, 재생성 미발화', () => {
    renderSection({
      trip: makeTrip({ day_count: 1 }),
      places: [makePlace({ id: 'p1' })],
      plan: makePlan([makeItem({ id: 'i1', place_id: 'p1', day_index: 0, sort_order: 0 })]),
    });
    fireEvent.click(screen.getByRole('button', { name: '도보' }));
    expect(onTravelModeChange).toHaveBeenCalledWith('walk');
    // 유료 API 이중 지출 방지 — 토글은 저장만 한다.
    expect(onGenerate).not.toHaveBeenCalled();
    // 변경 후에만 안내 문구 노출.
    expect(
      screen.getByText('이동수단을 바꿨어요. 일정 다시 만들기를 누르면 경로를 새로 계산해요'),
    ).toBeTruthy();
  });
});
