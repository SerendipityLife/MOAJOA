import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- @moajoa/api seam (per-fn vi.fn wrap, vote-island idiom). ---
const addLink = vi.fn(
  async (_c: unknown, _i: { board_id: string; url: string }) => ({
    id: 'link-1',
    source_kind: 'youtube' as string,
  }),
);
const triggerExtraction = vi.fn(async (_c: unknown, _id: string) => ({
  status: 'ready',
  places_extracted: 1,
  error: null,
}));
const addManualPlace = vi.fn(async (_c: unknown, _i: unknown) => ({ id: 'place-1' }));
vi.mock('@moajoa/api', () => ({
  addLink: (c: unknown, i: { board_id: string; url: string }) => addLink(c, i),
  triggerExtraction: (c: unknown, id: string) => triggerExtraction(c, id),
  addManualPlace: (c: unknown, i: unknown) => addManualPlace(c, i),
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({}),
}));

// DaySelectSheet 스텁 — 자체 계약(1-based 표시 ↔ 0-based day_index 변환)은 day-select-sheet.test가
// 검증한다. 여기서는 **열림 여부 + 콜백 배선**만 관심.
vi.mock('@/app/moa/[id]/_components/day-select-sheet', () => ({
  DaySelectSheet: ({
    open,
    dayCount,
    onSelectDay,
    onSkip,
  }: {
    open: boolean;
    dayCount: number;
    onSelectDay: (dayIndex: number) => void;
    onSkip: () => void;
  }) =>
    open ? (
      <div data-testid="day-sheet">
        <span data-testid="day-count">{dayCount}</span>
        <button onClick={() => onSelectDay(1)}>day-2</button>
        <button onClick={onSkip}>day-skip</button>
      </div>
    ) : null,
}));

// @/components — BottomSheet pass-through(open일 때만 children), AddContentTabs harness
// (onAddLink/onPickPlace 콜백을 버튼으로 노출), useToast swallow.
const toast = vi.fn();
vi.mock('@/components', () => ({
  BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  AddContentTabs: ({
    onAddLink,
    onPickPlace,
  }: {
    onAddLink: (url: string) => void | Promise<void>;
    onPickPlace: (p: {
      id: string;
      name: string;
      address: string | null;
      location: { lat: number; lng: number } | null;
    }) => void | Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => void onAddLink('https://youtu.be/abc123')}>
        stage-link
      </button>
      <button
        type="button"
        onClick={() =>
          void onPickPlace({
            id: 'gp1',
            name: '스시집',
            address: '도쿄',
            location: { lat: 35.66, lng: 139.7 },
          })
        }
      >
        pick-place
      </button>
    </div>
  ),
  useToast: () => ({ toast }),
}));

// Import AFTER mocks.
import { AddSheet } from '@/app/moa/[id]/_components/add-sheet';

beforeEach(() => {
  addLink.mockClear();
  triggerExtraction.mockClear();
  addManualPlace.mockClear();
  toast.mockClear();
  addLink.mockResolvedValue({ id: 'link-1', source_kind: 'youtube' });
});

describe('AddSheet', () => {
  it('MOA-03: 링크 제출 → addLink + triggerExtraction(비-manual) + onAdded + 닫힘', async () => {
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(
      <AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />,
    );

    fireEvent.click(screen.getByText('stage-link'));

    await waitFor(() =>
      expect(addLink).toHaveBeenCalledWith({}, { board_id: 'trip-1', url: 'https://youtu.be/abc123' }),
    );
    expect(triggerExtraction).toHaveBeenCalledWith({}, 'link-1');
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('MOA-03: manual 링크는 triggerExtraction 미호출', async () => {
    addLink.mockResolvedValueOnce({ id: 'link-2', source_kind: 'manual' });
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />);

    fireEvent.click(screen.getByText('stage-link'));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(triggerExtraction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('MOA-04: 검색 결과 탭 → addManualPlace + onAdded(즉시 reconcile) + 닫힘', async () => {
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />);

    fireEvent.click(screen.getByText('pick-place'));

    await waitFor(() =>
      expect(addManualPlace).toHaveBeenCalledWith(
        {},
        {
          board_id: 'trip-1',
          google_place_id: 'gp1',
          name_local: '스시집',
          lat: 35.66,
          lng: 139.7,
          address: '도쿄',
        },
      ),
    );
    // 방금 담은 장소가 realtime 지연/누락과 무관하게 즉시 보이도록 onAdded 호출.
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('addManualPlace reject → 에러 토스트 + 시트 유지(onAdded·onClose 미호출)', async () => {
    addManualPlace.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />);

    fireEvent.click(screen.getByText('pick-place'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('추가하지 못했어요. 다시 시도해 주세요', {
        variant: 'error',
      }),
    );
    expect(onAdded).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('addLink reject → 에러 토스트 + 시트 유지(onClose 미호출)', async () => {
    addLink.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />);

    fireEvent.click(screen.getByText('stage-link'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('추가하지 못했어요. 다시 시도해 주세요', {
        variant: 'error',
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });
});

// ── Plan 06 — 검색 추가 Day 배치 분기 (D-19 · D-20 · D-24). ──
describe('AddSheet — 플랜 유무에 따른 Day 배치 분기 (SC-5)', () => {
  it('D-19: 플랜 없음 → Day를 묻지 않고 바로 담고 안내 토스트', async () => {
    const onClose = vi.fn();
    const onPlacePickedForDay = vi.fn();
    render(
      <AddSheet
        tripId="trip-1"
        open
        onClose={onClose}
        onAdded={vi.fn()}
        planExists={false}
        onPlacePickedForDay={onPlacePickedForDay}
      />,
    );

    fireEvent.click(screen.getByText('pick-place'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        '지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요',
      ),
    );
    // 플랜이 없으면 moveToDay의 plan_id가 없어 Day 배치가 물리적으로 불가능하다.
    expect(screen.queryByTestId('day-sheet')).toBeNull();
    expect(onPlacePickedForDay).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('D-20: 플랜 있음 → DaySelectSheet가 열리고 Day 수가 전달된다', async () => {
    render(
      <AddSheet
        tripId="trip-1"
        open
        onClose={vi.fn()}
        onAdded={vi.fn()}
        planExists
        dayCount={3}
        onPlacePickedForDay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('pick-place'));

    await waitFor(() => expect(screen.getByTestId('day-sheet')).toBeInTheDocument());
    expect(screen.getByTestId('day-count').textContent).toBe('3');
    // D-24 토스트는 플랜 없음 경로 전용 — 여기선 Day를 직접 묻는다.
    expect(toast).not.toHaveBeenCalled();
  });

  it('D-20: Day 2 선택 → onPlacePickedForDay(placeId, 1) (0-based day_index)', async () => {
    const onPlacePickedForDay = vi.fn();
    render(
      <AddSheet
        tripId="trip-1"
        open
        onClose={vi.fn()}
        onAdded={vi.fn()}
        planExists
        dayCount={3}
        onPlacePickedForDay={onPlacePickedForDay}
      />,
    );

    fireEvent.click(screen.getByText('pick-place'));
    fireEvent.click(await screen.findByText('day-2'));

    // 배치(moveToDay)는 plan을 소유한 island이 실행한다 — add-sheet은 addManualPlace까지만.
    expect(onPlacePickedForDay).toHaveBeenCalledWith('place-1', 1);
    expect(screen.queryByTestId('day-sheet')).toBeNull();
  });

  it("D-20: '아직 모르겠다' → 배치하지 않고 풀에 남긴다 (즉시 재생성·자동 append 없음)", async () => {
    const onPlacePickedForDay = vi.fn();
    render(
      <AddSheet
        tripId="trip-1"
        open
        onClose={vi.fn()}
        onAdded={vi.fn()}
        planExists
        dayCount={3}
        onPlacePickedForDay={onPlacePickedForDay}
      />,
    );

    fireEvent.click(screen.getByText('pick-place'));
    fireEvent.click(await screen.findByText('day-skip'));

    expect(onPlacePickedForDay).not.toHaveBeenCalled();
    expect(screen.queryByTestId('day-sheet')).toBeNull();
    // 장소 자체는 이미 담겼다 — 미배치 풀('아직 안 넣은 곳')에 노출된다.
    expect(addManualPlace).toHaveBeenCalledTimes(1);
  });

  it('링크 추가 경로는 무회귀 — 플랜이 있어도 Day를 묻지 않는다 (추출이 비동기)', async () => {
    const onClose = vi.fn();
    render(
      <AddSheet
        tripId="trip-1"
        open
        onClose={onClose}
        onAdded={vi.fn()}
        planExists
        dayCount={3}
        onPlacePickedForDay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('stage-link'));

    await waitFor(() => expect(addLink).toHaveBeenCalledTimes(1));
    expect(triggerExtraction).toHaveBeenCalledWith({}, 'link-1');
    expect(screen.queryByTestId('day-sheet')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
