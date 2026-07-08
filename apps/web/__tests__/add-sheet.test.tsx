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
    onPickPlace: (p: { id: string; name: string; address: string | null }) => void | Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => void onAddLink('https://youtu.be/abc123')}>
        stage-link
      </button>
      <button
        type="button"
        onClick={() => void onPickPlace({ id: 'gp1', name: '스시집', address: '도쿄' })}
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

  it('MOA-04: 검색 결과 탭 → addManualPlace + 닫힘 (onAdded 미호출 — realtime 경로)', async () => {
    const onClose = vi.fn();
    const onAdded = vi.fn();
    render(<AddSheet tripId="trip-1" open onClose={onClose} onAdded={onAdded} />);

    fireEvent.click(screen.getByText('pick-place'));

    await waitFor(() =>
      expect(addManualPlace).toHaveBeenCalledWith(
        {},
        { board_id: 'trip-1', google_place_id: 'gp1' },
      ),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAdded).not.toHaveBeenCalled();
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
