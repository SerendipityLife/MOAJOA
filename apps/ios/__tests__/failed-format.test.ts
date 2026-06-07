// Unit tests for failed-format.ts pure helpers (Plan 07-01, D-04 + 상대시각).
//
// Why: the failed-links screen renders reason badges + relative timestamps for
// each failed queue entry. Both helpers are pure (no SharedDefaults, no native),
// so we verify exact Korean copy (D-04) and deterministic relative-time
// boundaries with an injected `now` — no real clock dependence.

import { mapFailReason, formatRelativeTime } from '@/lib/failed-format';

describe('mapFailReason', () => {
  test('maps the 4 reason union values to D-04 Korean copy', () => {
    expect(mapFailReason('network')).toBe('네트워크 오류');
    expect(mapFailReason('auth')).toBe('로그인 필요');
    expect(mapFailReason('api')).toBe('서버 처리 실패');
    expect(mapFailReason('unknown')).toBe('알 수 없는 오류');
  });

  test('falls back to 알 수 없는 오류 for an unrecognized value', () => {
    // Defensive: SharedDefaults data is already-typed, but a future reason
    // string written by an older/newer build must not blank the badge.
    expect(mapFailReason('garbage' as never)).toBe('알 수 없는 오류');
  });
});

describe('formatRelativeTime', () => {
  // Fixed reference "now" so boundary math is deterministic.
  const now = Date.parse('2026-06-07T12:00:00.000Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  test('< 60s renders 방금', () => {
    expect(formatRelativeTime(ago(30 * 1000), now)).toBe('방금');
  });

  test('< 60m renders N분 전', () => {
    expect(formatRelativeTime(ago(5 * 60 * 1000), now)).toBe('5분 전');
  });

  test('< 24h renders N시간 전', () => {
    expect(formatRelativeTime(ago(3 * 60 * 60 * 1000), now)).toBe('3시간 전');
  });

  test('>= 24h renders N일 전', () => {
    expect(formatRelativeTime(ago(2 * 24 * 60 * 60 * 1000), now)).toBe('2일 전');
  });
});
