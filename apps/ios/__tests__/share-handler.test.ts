// Phase 16, Plan 16-02: branch behavior of the mounted share-handler.
// Tests the exported async decision body `handleSharedUrl` directly (the screen's
// effect just calls it) — avoids RNTL render flakiness, matches the testable-seam
// philosophy of pending.test.ts. Mock topology mirrors pending.test.ts.

// 1. @moajoa/api — control listMyBoards + addLink (+ listMyBoardsWithPreview
//    so the BoardPickerSheet import resolves when share-handler is loaded).
const mockListMyBoards = jest.fn();
const mockAddLink = jest.fn();
const mockListMyBoardsWithPreview = jest.fn();
jest.mock('@moajoa/api', () => ({
  listMyBoards: (...a: unknown[]) => mockListMyBoards(...a),
  addLink: (...a: unknown[]) => mockAddLink(...a),
  listMyBoardsWithPreview: (...a: unknown[]) => mockListMyBoardsWithPreview(...a),
}));

// 2. extraction-store — startExtraction is the D-03 visible-progress path.
const mockStartExtraction = jest.fn();
jest.mock('@/lib/extraction-store', () => ({
  startExtraction: (...a: unknown[]) => mockStartExtraction(...a),
}));

// 3. pending — linger path reuses enqueuePendingLink AS-IS.
const mockEnqueuePendingLink = jest.fn();
jest.mock('@/lib/pending', () => ({
  enqueuePendingLink: (...a: unknown[]) => mockEnqueuePendingLink(...a),
}));

// 4. expo-router — capture navigation.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));

// 5. shared-defaults — in-memory App Group bridge.
jest.mock('@/lib/shared-defaults', () => require('../__mocks__/shared-defaults'));

// 6. supabase — control auth.getSession() per branch.
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => mockGetSession(...a) } },
}));

import { SharedDefaults } from '../__mocks__/shared-defaults';
import { handleSharedUrl, addAndNavigate } from '@/app/share-handler';
import { SharedDefaultsKeys } from '@moajoa/core';

const URL = 'https://www.youtube.com/watch?v=abc';

function authed() {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
}
function notAuthed() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
}

beforeEach(() => {
  SharedDefaults.__clear();
  mockListMyBoards.mockReset();
  mockAddLink.mockReset();
  mockListMyBoardsWithPreview.mockReset();
  mockStartExtraction.mockReset();
  mockEnqueuePendingLink.mockReset();
  mockReplace.mockReset();
  mockGetSession.mockReset();
});

test('not authed → enqueuePendingLink(url, null), no add/extract, navigate home', async () => {
  notAuthed();
  await handleSharedUrl(URL);
  expect(mockEnqueuePendingLink).toHaveBeenCalledTimes(1);
  expect(mockEnqueuePendingLink).toHaveBeenCalledWith(URL, null);
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('authed + 0 boards → enqueuePendingLink(url, null), no add', async () => {
  authed();
  mockListMyBoards.mockResolvedValue([]);
  await handleSharedUrl(URL);
  expect(mockEnqueuePendingLink).toHaveBeenCalledWith(URL, null);
  expect(mockAddLink).not.toHaveBeenCalled();
});

test('authed + 1 board → addLink + startExtraction + navigate to board', async () => {
  authed();
  mockListMyBoards.mockResolvedValue([{ id: 'b1' }]);
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await handleSharedUrl(URL);
  expect(mockAddLink).toHaveBeenCalledWith(expect.anything(), { board_id: 'b1', url: URL });
  expect(mockStartExtraction).toHaveBeenCalledWith(
    expect.objectContaining({ linkId: 'link-1', boardId: 'b1' }),
  );
  expect(mockReplace).toHaveBeenCalledWith('/boards/b1');
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
});

test('authed + 1 board, manual link → no startExtraction but still adds + navigates', async () => {
  authed();
  mockListMyBoards.mockResolvedValue([{ id: 'b1' }]);
  mockAddLink.mockResolvedValue({ id: 'link-2', url: 'https://example.com/random' });
  await handleSharedUrl('https://example.com/random');
  expect(mockAddLink).toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/boards/b1');
});

test('authed + 2 boards → picker branch: neither add nor enqueue', async () => {
  authed();
  mockListMyBoards.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
  await handleSharedUrl(URL);
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
});

test('non-http(s) url → nothing enqueued/added', async () => {
  authed();
  mockListMyBoards.mockResolvedValue([{ id: 'b1' }]);
  await handleSharedUrl('javascript:alert(1)');
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
});

// --- Plan 16-03: picker-select WIRING (the shared addAndNavigate helper) ---
// The board-picker sheet's onSelect → addAndNavigate(boardId, url). The gesture
// itself is device UAT (Task 2); here we assert the add+extract+navigate wiring
// the picker shares verbatim with the auto branch (single source — no drift).

test('addAndNavigate(b2, youtube) → addLink({board_id:b2, url}) once', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('b2', URL);
  expect(mockAddLink).toHaveBeenCalledTimes(1);
  expect(mockAddLink).toHaveBeenCalledWith(expect.anything(), { board_id: 'b2', url: URL });
});

test('addAndNavigate(b2, ...) → SharedDefaults.set(LastBoardId, b2)', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('b2', URL);
  expect(SharedDefaults.get(SharedDefaultsKeys.LastBoardId)).toBe('b2');
});

test('addAndNavigate(b2, youtube) → startExtraction for the new link on b2', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('b2', URL);
  expect(mockStartExtraction).toHaveBeenCalledWith(
    expect.objectContaining({ linkId: 'link-1', boardId: 'b2' }),
  );
});

test('addAndNavigate(b2, ...) → router.replace(/boards/b2)', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('b2', URL);
  expect(mockReplace).toHaveBeenCalledWith('/boards/b2');
});

test('addAndNavigate with manual/null-kind url → adds but no startExtraction', async () => {
  const manual = 'https://example.com/random';
  mockAddLink.mockResolvedValue({ id: 'link-2', url: manual });
  await addAndNavigate('b2', manual);
  expect(mockAddLink).toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/boards/b2');
});
