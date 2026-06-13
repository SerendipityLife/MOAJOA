// Unit test for the background extraction store (lib/extraction-store.ts).
//
// Why: the store is what makes extraction survive leaving the board screen.
// The contract that matters to callers (boards/[id].tsx, boards.tsx, new.tsx):
//   1. startExtraction registers an active entry, opens the realtime channel,
//      and fires the Edge Function.
//   2. Intermediate broadcast steps update that entry's `step`.
//   3. 'done' clears the entry, removes the channel, toasts, and notifies
//      completion listeners with the boardId (screens reload on it).
//   4. 'error' clears the entry and toasts with a [재시도] action.
//   5. A trigger that rejects is cleaned up the same way as a server error.
//
// Mock every dependency BEFORE importing the SUT so it binds to the fakes.

const mockTrigger = jest.fn();
jest.mock('@moajoa/api', () => ({
  triggerExtraction: (...args: unknown[]) => mockTrigger(...args),
}));

let progressHandler: ((p: unknown) => void) | undefined;
const mockSubscribe = jest.fn();
const fakeChannel = { __fake: true };
jest.mock('@/lib/realtime', () => ({
  subscribeExtractProgress: (linkId: string, cb: (p: unknown) => void) => {
    progressHandler = cb;
    mockSubscribe(linkId);
    return fakeChannel;
  },
}));

const mockShowToast = jest.fn();
jest.mock('@/lib/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

const mockRemoveChannel = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { removeChannel: (...args: unknown[]) => mockRemoveChannel(...args) },
}));

import {
  startExtraction,
  getActiveExtractions,
  onExtractionComplete,
} from '@/lib/extraction-store';

beforeEach(() => {
  mockTrigger.mockReset();
  mockSubscribe.mockReset();
  mockShowToast.mockReset();
  mockRemoveChannel.mockReset();
  progressHandler = undefined;
  // Default: trigger resolves quietly (fire-and-forget). Tests that need the
  // failure path override with mockRejectedValueOnce.
  mockTrigger.mockResolvedValue({ status: 'ready', places_extracted: 0, error: null });
});

test('startExtraction registers an active entry, subscribes, and triggers', () => {
  startExtraction({ linkId: 'l1', boardId: 'b1', boardTitle: '도쿄' });

  expect(getActiveExtractions()).toEqual([
    { linkId: 'l1', boardId: 'b1', boardTitle: '도쿄', step: null, startedAt: expect.any(Number) },
  ]);
  expect(mockSubscribe).toHaveBeenCalledWith('l1');
  expect(mockTrigger).toHaveBeenCalledWith(expect.anything(), 'l1');

  // Clean up: complete it so module state is empty for the next test.
  progressHandler!({ step: 'done', places_extracted: 0 });
  expect(getActiveExtractions()).toEqual([]);
});

test('intermediate broadcast step advances the entry', () => {
  startExtraction({ linkId: 'l2', boardId: 'b2', boardTitle: '오사카' });
  progressHandler!({ step: 'transcript' });

  expect(getActiveExtractions()[0]).toMatchObject({ linkId: 'l2', step: 'transcript' });

  progressHandler!({ step: 'done', places_extracted: 1 }); // cleanup
});

test("'done' clears the entry, removes the channel, toasts, and notifies completion", () => {
  const completed = jest.fn();
  const unsub = onExtractionComplete(completed);

  startExtraction({ linkId: 'l3', boardId: 'b3', boardTitle: '교토' });
  progressHandler!({ step: 'done', places_extracted: 3 });

  expect(getActiveExtractions()).toEqual([]);
  expect(mockRemoveChannel).toHaveBeenCalledWith(fakeChannel);
  expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('3개 핀 추가됨'));
  expect(completed).toHaveBeenCalledWith('b3');

  unsub();
});

test("'error' clears the entry and toasts with a 재시도 action", () => {
  startExtraction({ linkId: 'l4', boardId: 'b4', boardTitle: '후쿠오카' });
  progressHandler!({ step: 'error', error: 'transcript not found' });

  expect(getActiveExtractions()).toEqual([]);
  expect(mockShowToast).toHaveBeenCalledWith(
    expect.stringContaining('자막이 없는 영상'),
    'error',
    expect.objectContaining({ action: expect.objectContaining({ label: '재시도' }) }),
  );
});

test('a trigger that rejects is torn down and surfaces a retry toast', async () => {
  mockTrigger.mockReset();
  mockTrigger.mockRejectedValueOnce(new Error('network down'));

  startExtraction({ linkId: 'l5', boardId: 'b5', boardTitle: '삿포로' });
  // Entry is registered synchronously before the trigger settles.
  expect(getActiveExtractions().some((e) => e.linkId === 'l5')).toBe(true);

  // Flush the rejected promise's .catch microtask.
  await Promise.resolve();
  await Promise.resolve();

  expect(getActiveExtractions().some((e) => e.linkId === 'l5')).toBe(false);
  expect(mockShowToast).toHaveBeenCalledWith(
    expect.stringContaining('잠시 후 다시 시도'),
    'error',
    expect.objectContaining({ action: expect.objectContaining({ label: '재시도' }) }),
  );
});
