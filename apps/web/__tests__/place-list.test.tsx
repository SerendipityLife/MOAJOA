import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Link, Place } from '@moajoa/core';

// useToast — 프레젠테이션 예외(A-4 답장 stub)만 사용. mock으로 흡수.
vi.mock('@/components', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Import AFTER mocks so the component picks them up.
import { PlaceList, type PlaceListProps } from '@/app/moa/[id]/_components/place-list';

// jsdom은 scrollIntoView 미구현 — openPlaceId effect가 부르므로 스텁.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    board_id: 'b1',
    link_id: 'l1',
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

function makeLink(overrides: Partial<Link>): Link {
  return {
    id: 'l1',
    board_id: 'b1',
    added_by: 'u1',
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

const onOpenPlace = vi.fn();
const onToggleVote = vi.fn();
const onRetry = vi.fn();
const onDelete = vi.fn();
const onReply = vi.fn();

function renderList(overrides: Partial<PlaceListProps> = {}) {
  const props: PlaceListProps = {
    places: [makePlace({})],
    links: [makeLink({})],
    counts: {},
    myVotes: {},
    votePending: {},
    profileNames: {},
    colorFor: () => 'rgb(255, 112, 67)',
    openPlaceId: null,
    onOpenPlace,
    onToggleVote,
    onRetry,
    onDelete,
    onReply,
    ...overrides,
  };
  return render(<PlaceList {...props} />);
}

beforeEach(() => {
  onOpenPlace.mockClear();
  onToggleVote.mockClear();
  onRetry.mockClear();
  onDelete.mockClear();
  onReply.mockClear();
});

describe('PlaceList', () => {
  it('Test 1 (MOA-02): 찜 desc로 순서, 배지는 seq_no 그대로', () => {
    const { container } = renderList({
      places: [
        makePlace({ id: 'a', link_id: null, seq_no: 1, name_local: '가게A' }),
        makePlace({ id: 'b', link_id: null, seq_no: 2, name_local: '가게B' }),
      ],
      links: [],
      counts: { a: 1, b: 3 },
    });
    const rows = Array.from(container.querySelectorAll('[data-place-id]'));
    // 렌더 순서: love 3인 b 먼저, love 1인 a 다음
    expect(rows.map((r) => r.getAttribute('data-place-id'))).toEqual(['b', 'a']);
    // 배지 표기는 정렬 인덱스가 아니라 seq_no — b=2, a=1
    expect(rows[0]!.querySelector('span[aria-hidden]')!.textContent).toBe('2');
    expect(rows[1]!.querySelector('span[aria-hidden]')!.textContent).toBe('1');
  });

  it('Test 2 (MOA-02 동률): 같은 찜 수면 seq_no asc', () => {
    const { container } = renderList({
      places: [
        makePlace({ id: 'x', link_id: null, seq_no: 5, name_local: '가게X' }),
        makePlace({ id: 'y', link_id: null, seq_no: 2, name_local: '가게Y' }),
      ],
      links: [],
      counts: { x: 2, y: 2 },
    });
    const rows = Array.from(container.querySelectorAll('[data-place-id]'));
    expect(rows.map((r) => r.getAttribute('data-place-id'))).toEqual(['y', 'x']);
  });

  it('Test 3 (MOA-05): 행 클릭 → onOpenPlace, openPlaceId 시 아코디언 4요소', () => {
    renderList({
      places: [
        makePlace({
          id: 'p1',
          address: '도쿄도 시부야',
          source_timestamp_sec: 240,
        }),
      ],
      openPlaceId: 'p1',
    });
    // 행 클릭 → 토글
    fireEvent.click(screen.getByText('스시집'));
    expect(onOpenPlace).toHaveBeenCalledWith(null); // 이미 열림 → 닫기

    // 아코디언 4요소
    expect(screen.getByText('도쿄도 시부야')).toBeTruthy();
    expect(screen.getByText('구글맵에서 보기')).toBeTruthy();
    expect(screen.getByText('출처 4:00')).toBeTruthy();
    expect(screen.getByText('답장')).toBeTruthy();
  });

  it('Test 4 (MOA-06): 닉네임 라벨 + 배지 backgroundColor = colorFor', () => {
    const { container } = renderList({
      places: [makePlace({ id: 'p1', added_by: 'u1' })],
      profileNames: { u1: '철수' },
      colorFor: () => 'rgb(255, 112, 67)',
    });
    expect(screen.getByText('철수님이 담음')).toBeTruthy();
    const badge = container.querySelector('[data-place-id="p1"] span[aria-hidden]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe('rgb(255, 112, 67)');
  });

  it('Test 5 (하트): 하트 클릭 → onToggleVote, 행 토글 미발화', () => {
    renderList({ places: [makePlace({ id: 'p1' })] });
    fireEvent.click(screen.getByLabelText('찜'));
    expect(onToggleVote).toHaveBeenCalledWith('p1');
    expect(onOpenPlace).not.toHaveBeenCalled();
  });

  it('Test 6 (D-13): processing 링크 → "분석 중…" 행', () => {
    renderList({
      places: [],
      links: [makeLink({ id: 'l1', title: '도쿄 브이로그', extraction_status: 'processing' })],
    });
    expect(screen.getByText('분석 중…')).toBeTruthy();
    expect(screen.getByText('도쿄 브이로그')).toBeTruthy();
  });

  it('Test 7 (D-15): failed·0추출 링크 → 실패 행 + 재시도', () => {
    renderList({
      places: [],
      links: [
        makeLink({ id: 'l1', extraction_status: 'failed' }),
        makeLink({ id: 'l2', extraction_status: 'ready' }), // ready인데 장소 0개
      ],
    });
    const failures = screen.getAllByText('장소를 찾지 못했어요');
    expect(failures).toHaveLength(2);
    const retries = screen.getAllByText('재시도');
    fireEvent.click(retries[0]!);
    expect(onRetry).toHaveBeenCalledWith('l1');
  });

  it('Test 8 (empty): 장소·링크 0 → empty state', () => {
    renderList({ places: [], links: [] });
    expect(screen.getByText('아직 담은 장소가 없어요')).toBeTruthy();
  });

  it('Test 9 (H-01): manual 링크(pending)는 "분석 중…" 아닌 미지원 실패 행 + 재시도 없음', () => {
    renderList({
      places: [],
      links: [makeLink({ id: 'l1', source_kind: 'manual', extraction_status: 'pending' })],
    });
    expect(screen.queryByText('분석 중…')).toBeNull();
    expect(screen.getByText('지원하지 않는 링크예요')).toBeTruthy();
    expect(screen.queryByText('재시도')).toBeNull();
  });

  it('Test 10 (삭제): 열린 행의 삭제 버튼 → onDelete(placeId), 행 토글 미발화', () => {
    renderList({ places: [makePlace({ id: 'p1' })], openPlaceId: 'p1' });
    fireEvent.click(screen.getByText('삭제'));
    expect(onDelete).toHaveBeenCalledWith('p1');
    expect(onOpenPlace).not.toHaveBeenCalled();
  });

  it('Test 11 (삭제): 닫힌 행에는 삭제 버튼 없음 (아코디언 확장 시에만)', () => {
    renderList({ places: [makePlace({ id: 'p1' })], openPlaceId: null });
    expect(screen.queryByText('삭제')).toBeNull();
  });

  it('Test 12 (삭제): 분석중·실패 행에는 삭제 버튼 없음 (실 장소 행만)', () => {
    renderList({
      places: [],
      links: [
        makeLink({ id: 'l1', extraction_status: 'processing' }),
        makeLink({ id: 'l2', extraction_status: 'failed' }),
      ],
    });
    expect(screen.queryByText('삭제')).toBeNull();
  });

  it('Test 13 (D-10 답장): 열린 행의 답장 버튼 → onReply(placeId), 행 토글 미발화', () => {
    renderList({ places: [makePlace({ id: 'p1' })], openPlaceId: 'p1' });
    fireEvent.click(screen.getByText('답장'));
    expect(onReply).toHaveBeenCalledWith('p1');
    expect(onOpenPlace).not.toHaveBeenCalled();
  });

  it('Test 14 (IN-01 잔상): 1.5s 타이머 전에 행을 닫으면 하이라이트 링이 즉시 사라진다', () => {
    const base: PlaceListProps = {
      places: [makePlace({ id: 'p1' })],
      links: [makeLink({})],
      counts: {},
      myVotes: {},
      votePending: {},
      profileNames: {},
      colorFor: () => 'rgb(255, 112, 67)',
      openPlaceId: 'p1',
      onOpenPlace,
      onToggleVote,
      onRetry,
      onDelete,
      onReply,
    };
    const { container, rerender } = render(<PlaceList {...base} />);
    const row = () => container.querySelector('[data-place-id="p1"]');
    // 열린 직후엔 하이라이트 링(data-highlighted='true')
    expect(row()?.getAttribute('data-highlighted')).toBe('true');

    // 타이머(1.5s) 종료 전에 닫으면 — 잔상 없이 즉시 해제되어야 함
    rerender(<PlaceList {...base} openPlaceId={null} />);
    expect(row()?.getAttribute('data-highlighted')).toBeNull();
  });
});
