import { SharedDefaultsKeys } from '@moajoa/core';

// Mock the native bridge BEFORE importing pending.
// The mock at __mocks__/shared-defaults.ts is an in-memory Map standing in for
// App Group UserDefaults (Plan 03-01 contract).
jest.mock('@/lib/shared-defaults', () => {
  return require('../__mocks__/shared-defaults');
});

// Mock @moajoa/api so we control addLink + triggerExtraction behavior.
const mockAddLink = jest.fn();
const mockTriggerExtraction = jest.fn();
jest.mock('@moajoa/api', () => ({
  addLink: (...args: unknown[]) => mockAddLink(...args),
  triggerExtraction: (...args: unknown[]) => mockTriggerExtraction(...args),
}));

// detectSourceKind lives in @moajoa/core. Real impl returns 'youtube' for
// youtube.com URLs and 'manual' otherwise — sufficient for these tests.

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { SharedDefaults } from '../__mocks__/shared-defaults';
import { drainPendingLinks, enqueuePendingLink } from '@/lib/pending';

beforeEach(() => {
  SharedDefaults.__clear();
  mockAddLink.mockReset();
  mockTriggerExtraction.mockReset();
});

test('drain empty queue is a no-op', async () => {
  const result = await drainPendingLinks();
  expect(result).toEqual({ ok: 0, failed: 0 });
  expect(mockAddLink).not.toHaveBeenCalled();
});

test('drain one queued link succeeds and triggers extraction for youtube', async () => {
  mockAddLink.mockResolvedValueOnce({
    id: 'link-1',
    source_kind: 'youtube',
    url: 'https://youtube.com/watch?v=x',
  });
  mockTriggerExtraction.mockResolvedValueOnce({ status: 'queued' });
  await enqueuePendingLink('https://youtube.com/watch?v=x', 'board-1');

  const result = await drainPendingLinks();

  expect(result.ok).toBe(1);
  expect(mockAddLink).toHaveBeenCalledTimes(1);
  expect(mockTriggerExtraction).toHaveBeenCalledWith(expect.anything(), 'link-1');
  expect(SharedDefaults.get(SharedDefaultsKeys.PendingLinks)).toEqual([]);
});

test('drain failure increments retry_count and keeps in queue (no second attempt same turn)', async () => {
  mockAddLink.mockRejectedValueOnce(new Error('network error'));
  await enqueuePendingLink('https://youtube.com/watch?v=y', 'board-1');

  const result = await drainPendingLinks();

  expect(result.ok).toBe(0);
  expect(mockAddLink).toHaveBeenCalledTimes(1); // Pitfall 7: no double-attempt same turn
  const remaining = SharedDefaults.get<Array<{ url: string; retry_count: number }>>(
    SharedDefaultsKeys.PendingLinks,
  );
  expect(remaining).toHaveLength(1);
  expect(remaining![0].retry_count).toBe(1);
});

test('drain moves entry to failed queue when retry_count > 3', async () => {
  // Pre-seed an entry already at retry_count = 3
  SharedDefaults.set(SharedDefaultsKeys.PendingLinks, [
    {
      url: 'https://youtube.com/watch?v=z',
      board_id: 'board-1',
      queued_at: new Date().toISOString(),
      retry_count: 3,
    },
  ]);
  mockAddLink.mockRejectedValueOnce(new Error('network failure'));

  const result = await drainPendingLinks();

  expect(result.ok).toBe(0);
  expect(result.failed).toBe(1);
  const pending = SharedDefaults.get<unknown[]>(SharedDefaultsKeys.PendingLinks);
  const failed = SharedDefaults.get<Array<{ reason: string; retry_count: number }>>(
    SharedDefaultsKeys.PendingLinksFailed,
  );
  expect(pending).toEqual([]);
  expect(failed).toHaveLength(1);
  expect(failed![0].retry_count).toBe(4);
  expect(failed![0].reason).toBe('network');
});

test('drain skips entries with null board_id (D-03 board picker case)', async () => {
  SharedDefaults.set(SharedDefaultsKeys.PendingLinks, [
    {
      url: 'https://youtube.com/watch?v=w',
      board_id: null,
      queued_at: new Date().toISOString(),
      retry_count: 0,
    },
  ]);

  const result = await drainPendingLinks();

  expect(result.ok).toBe(0);
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(SharedDefaults.get<unknown[]>(SharedDefaultsKeys.PendingLinks)).toHaveLength(1);
});

test('concurrent drain calls: second call returns immediately', async () => {
  let resolveFirst: (() => void) | undefined;
  mockAddLink.mockImplementationOnce(
    () =>
      new Promise<{ id: string; source_kind: string }>((res) => {
        resolveFirst = () => res({ id: 'link-x', source_kind: 'manual' });
      }),
  );
  await enqueuePendingLink('https://example.com', 'board-1');

  const first = drainPendingLinks();
  const second = drainPendingLinks(); // should bail out via inFlight guard
  const secondResult = await second;
  resolveFirst!();
  await first;

  expect(secondResult).toEqual({ ok: 0, failed: 0, skipped: true });
});
