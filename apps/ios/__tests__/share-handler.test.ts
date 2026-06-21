// Phase 16, Plan 16-02: branch behavior of the mounted share-handler (trip vocab 17-04).
// Tests the exported async decision body `handleSharedUrl` directly (the screen's
// effect just calls it) — avoids RNTL render flakiness, matches the testable-seam
// philosophy of pending.test.ts. Mock topology mirrors pending.test.ts.

// 1. @moajoa/api — control listMyTrips + addLink (+ listMyTripsWithPreview so the
//    TripPickerSheet import resolves when share-handler is loaded).
const mockListMyTrips = jest.fn();
const mockAddLink = jest.fn();
const mockListMyTripsWithPreview = jest.fn();
jest.mock('@moajoa/api', () => ({
  listMyTrips: (...a: unknown[]) => mockListMyTrips(...a),
  addLink: (...a: unknown[]) => mockAddLink(...a),
  listMyTripsWithPreview: (...a: unknown[]) => mockListMyTripsWithPreview(...a),
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

// 5. AsyncStorage — in-memory last-trip persistence (LastTripId).
const mockSetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: (...a: unknown[]) => mockSetItem(...a) },
}));

// 6. supabase — control auth.getSession() per branch.
const mockGetSession = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: (...a: unknown[]) => mockGetSession(...a) } },
}));

// 7. TripPickerSheet — stub the component module so the heavy native import chain
//    (@gorhom/bottom-sheet → react-native-reanimated) never loads under jest. The
//    sheet's GESTURE is device UAT (Task 4); this suite tests only the
//    add+extract+navigate WIRING (addAndNavigate) + the handler's branch logic.
jest.mock('@/components/boards/trip-picker-sheet', () => ({ TripPickerSheet: () => null }));

import { handleSharedUrl, addAndNavigate } from '@/app/share-handler';
import { TripKeys } from '@moajoa/core';

const URL = 'https://www.youtube.com/watch?v=abc';

function authed() {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
}
function notAuthed() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
}

beforeEach(() => {
  mockListMyTrips.mockReset();
  mockAddLink.mockReset();
  mockListMyTripsWithPreview.mockReset();
  mockStartExtraction.mockReset();
  mockEnqueuePendingLink.mockReset();
  mockReplace.mockReset();
  mockGetSession.mockReset();
  mockSetItem.mockReset();
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

test('authed + 0 trips → enqueuePendingLink(url, null), no add', async () => {
  authed();
  mockListMyTrips.mockResolvedValue([]);
  await handleSharedUrl(URL);
  expect(mockEnqueuePendingLink).toHaveBeenCalledWith(URL, null);
  expect(mockAddLink).not.toHaveBeenCalled();
});

test('authed + 1 trip → addLink + startExtraction + navigate to trip plan', async () => {
  authed();
  mockListMyTrips.mockResolvedValue([{ id: 't1' }]);
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await handleSharedUrl(URL);
  expect(mockAddLink).toHaveBeenCalledWith(expect.anything(), { board_id: 't1', url: URL });
  expect(mockStartExtraction).toHaveBeenCalledWith(
    expect.objectContaining({ linkId: 'link-1', boardId: 't1' }),
  );
  expect(mockReplace).toHaveBeenCalledWith('/trip/t1/plan');
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
});

test('authed + 1 trip, manual link → no startExtraction but still adds + navigates', async () => {
  authed();
  mockListMyTrips.mockResolvedValue([{ id: 't1' }]);
  mockAddLink.mockResolvedValue({ id: 'link-2', url: 'https://example.com/random' });
  await handleSharedUrl('https://example.com/random');
  expect(mockAddLink).toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/trip/t1/plan');
});

test('authed + 2 trips → picker branch: neither add nor enqueue', async () => {
  authed();
  mockListMyTrips.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
  await handleSharedUrl(URL);
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
});

test('non-http(s) url → nothing enqueued/added', async () => {
  authed();
  mockListMyTrips.mockResolvedValue([{ id: 't1' }]);
  await handleSharedUrl('javascript:alert(1)');
  expect(mockEnqueuePendingLink).not.toHaveBeenCalled();
  expect(mockAddLink).not.toHaveBeenCalled();
  expect(mockGetSession).not.toHaveBeenCalled();
});

// --- Plan 16-03: picker-select WIRING (the shared addAndNavigate helper) ---
// The trip-picker sheet's onSelect → addAndNavigate(tripId, url). The gesture
// itself is device UAT (Task 4); here we assert the add+extract+navigate wiring
// the picker shares verbatim with the auto branch (single source — no drift).

test('addAndNavigate(t2, youtube) → addLink({board_id:t2, url}) once', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('t2', URL);
  expect(mockAddLink).toHaveBeenCalledTimes(1);
  expect(mockAddLink).toHaveBeenCalledWith(expect.anything(), { board_id: 't2', url: URL });
});

test('addAndNavigate(t2, ...) → AsyncStorage.setItem(LastTripId, t2)', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('t2', URL);
  expect(mockSetItem).toHaveBeenCalledWith(TripKeys.LastTripId, 't2');
});

test('addAndNavigate(t2, youtube) → startExtraction for the new link on t2', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('t2', URL);
  expect(mockStartExtraction).toHaveBeenCalledWith(
    expect.objectContaining({ linkId: 'link-1', boardId: 't2' }),
  );
});

test('addAndNavigate(t2, ...) → router.replace(/trip/t2/plan)', async () => {
  mockAddLink.mockResolvedValue({ id: 'link-1', url: URL });
  await addAndNavigate('t2', URL);
  expect(mockReplace).toHaveBeenCalledWith('/trip/t2/plan');
});

test('addAndNavigate with manual/null-kind url → adds but no startExtraction', async () => {
  const manual = 'https://example.com/random';
  mockAddLink.mockResolvedValue({ id: 'link-2', url: manual });
  await addAndNavigate('t2', manual);
  expect(mockAddLink).toHaveBeenCalled();
  expect(mockStartExtraction).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/trip/t2/plan');
});
