// Pure-function table test for decideShareRoute (Phase 16, D-01/D-02; trip vocab 17-04).
// No mocks needed — share-routing.ts has zero imports / zero side effects.
import { decideShareRoute } from '@/lib/share-routing';

test('not authed → linger (0 trips)', () => {
  expect(decideShareRoute(false, 0, null)).toEqual({ kind: 'linger' });
});

test('not authed wins over trip count → linger', () => {
  expect(decideShareRoute(false, 3, 't1')).toEqual({ kind: 'linger' });
});

test('authed but 0 trips → linger', () => {
  expect(decideShareRoute(true, 0, null)).toEqual({ kind: 'linger' });
});

test('authed, exactly 1 trip with id → auto', () => {
  expect(decideShareRoute(true, 1, 't1')).toEqual({ kind: 'auto', tripId: 't1' });
});

test('authed, 1 trip but null id → picker (defensive, never auto with undefined trip)', () => {
  expect(decideShareRoute(true, 1, null)).toEqual({ kind: 'picker' });
});

test('authed, 2 trips → picker', () => {
  expect(decideShareRoute(true, 2, 't1')).toEqual({ kind: 'picker' });
});

test('authed, 5 trips → picker', () => {
  expect(decideShareRoute(true, 5, 't1')).toEqual({ kind: 'picker' });
});
