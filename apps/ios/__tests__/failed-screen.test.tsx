// Render smoke tests for the failed-links screen (Plan 07-01, Task 3).
//
// Why: the screen's contract is (a) an empty failed queue shows the empty state
// (it must NOT auto-pop — D-02), and (b) a seeded entry renders URL + 한국어
// 사유 배지(mapFailReason) + 상대시각(formatRelativeTime). We mock the native
// deps (SharedDefaults in-memory Map, @moajoa/api, supabase) the same way
// pending.test.ts does, plus expo-router so useFocusEffect runs synchronously.

// gesture-handler's jest setup mocks the native module so GestureHandlerRootView
// + Swipeable render under jest-expo without the native install() call throwing.
import 'react-native-gesture-handler/jestSetup';
import { render } from '@testing-library/react-native';
import { SharedDefaultsKeys } from '@moajoa/core';

// In-memory SharedDefaults (Plan 03-01 contract) so listFailedPending reads seed.
jest.mock('@/lib/shared-defaults', () => require('../__mocks__/shared-defaults'));

// pending.ts pulls these in at module load — stub to keep the test off-native.
jest.mock('@moajoa/api', () => ({
  addLink: jest.fn(),
  triggerExtraction: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

// expo-router: run useFocusEffect's callback once synchronously on mount and
// give router.back a stub. This mirrors boards.tsx's focus-read pattern.
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), []);
    },
  };
});

import { SharedDefaults } from '../__mocks__/shared-defaults';
import FailedLinksScreen from '@/app/boards/failed';

beforeEach(() => {
  SharedDefaults.__clear();
});

test('empty failed queue shows the empty state (no auto-pop)', () => {
  SharedDefaults.set(SharedDefaultsKeys.PendingLinksFailed, []);
  const { getByText } = render(<FailedLinksScreen />);
  expect(getByText('저장 실패한 링크가 없어요')).toBeTruthy();
});

test('one failed entry renders URL + 사유 배지 + 상대시각', () => {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  SharedDefaults.set(SharedDefaultsKeys.PendingLinksFailed, [
    {
      url: 'https://youtube.com/watch?v=abc123',
      board_id: 'board-1',
      queued_at: threeHoursAgo,
      failed_at: threeHoursAgo,
      reason: 'network',
      retry_count: 4,
    },
  ]);

  const { getByText } = render(<FailedLinksScreen />);

  expect(getByText('https://youtube.com/watch?v=abc123')).toBeTruthy();
  expect(getByText('네트워크 오류')).toBeTruthy(); // mapFailReason('network')
  expect(getByText('3시간 전')).toBeTruthy(); // formatRelativeTime(3h ago)
});
