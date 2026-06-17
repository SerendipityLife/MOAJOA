// Pure-function table test for decideShareRoute (Phase 16, D-01/D-02).
// No mocks needed — share-routing.ts has zero imports / zero side effects.
import { decideShareRoute } from '@/lib/share-routing';

test('not authed → linger (0 boards)', () => {
  expect(decideShareRoute(false, 0, null)).toEqual({ kind: 'linger' });
});

test('not authed wins over board count → linger', () => {
  expect(decideShareRoute(false, 3, 'b1')).toEqual({ kind: 'linger' });
});

test('authed but 0 boards → linger', () => {
  expect(decideShareRoute(true, 0, null)).toEqual({ kind: 'linger' });
});

test('authed, exactly 1 board with id → auto', () => {
  expect(decideShareRoute(true, 1, 'b1')).toEqual({ kind: 'auto', boardId: 'b1' });
});

test('authed, 1 board but null id → picker (defensive, never auto with undefined board)', () => {
  expect(decideShareRoute(true, 1, null)).toEqual({ kind: 'picker' });
});

test('authed, 2 boards → picker', () => {
  expect(decideShareRoute(true, 2, 'b1')).toEqual({ kind: 'picker' });
});

test('authed, 5 boards → picker', () => {
  expect(decideShareRoute(true, 5, 'b1')).toEqual({ kind: 'picker' });
});
