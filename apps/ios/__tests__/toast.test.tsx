// Unit tests for toast.tsx action slot + 8s error default (Plan 05-03, D-10).
//
// Why: contract for [id].tsx retry wiring is (a) showToast options-object
// signature is backward-compatible with Phase 3 2-arg callers, (b) action
// button renders with underline + label, (c) tapping action calls onPress
// AND auto-dismisses (so caller doesn't need to manage toast lifecycle),
// (d) error kind default duration is 8000ms not 5000ms.

import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { showToast, hideToast, ToastHost } from '@/lib/toast';

// SafeAreaProvider is required for useSafeAreaInsets inside ToastHost when
// rendered in a jest environment (no native context provided by default).
// initialMetrics gives deterministic 0 insets so layout assertions stay stable.
function renderToastHost() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ToastHost />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  // Clear any leftover toast between tests so listeners start clean.
  hideToast();
});

describe('showToast action slot', () => {
  test('renders action label with underline + font-semibold when action provided', () => {
    const { getByText } = renderToastHost();
    act(() => {
      showToast('분석 실패: 자막이 없는 영상', 'error', {
        action: { label: '재시도', onPress: () => {} },
      });
    });
    const actionNode = getByText('재시도');
    const cls = actionNode.props.className as string;
    expect(cls).toContain('underline');
    expect(cls).toContain('font-semibold');
    expect(cls).toContain('text-white');
  });

  test('tapping action button invokes onPress', () => {
    const onPress = jest.fn();
    const { getByText } = renderToastHost();
    act(() => {
      showToast('분석 실패', 'error', { action: { label: '재시도', onPress } });
    });
    fireEvent.press(getByText('재시도'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('omitting action renders single text toast (Phase 3 regression guard)', () => {
    const { getByText, queryByText } = renderToastHost();
    act(() => {
      showToast('핀 추가됨');
    });
    expect(getByText('핀 추가됨')).toBeTruthy();
    expect(queryByText('재시도')).toBeNull();
  });
});

describe('showToast duration defaults', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("kind='error' default duration is 8000ms (D-10: was 5000ms in Phase 3)", () => {
    const { queryByText } = renderToastHost();
    act(() => {
      showToast('에러 메시지', 'error');
    });
    expect(queryByText('에러 메시지')).toBeTruthy();
    // Advance just past Phase 3's old 5s default — must still be visible.
    act(() => {
      jest.advanceTimersByTime(5500);
    });
    expect(queryByText('에러 메시지')).toBeTruthy();
    // Advance past the new 8s default + fade-out (200ms) — must be gone.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(queryByText('에러 메시지')).toBeNull();
  });

  test("kind='info' default duration is 3000ms", () => {
    const { queryByText } = renderToastHost();
    act(() => {
      showToast('정보');
    });
    expect(queryByText('정보')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(queryByText('정보')).toBeNull();
  });

  test('explicit durationMs option overrides defaults', () => {
    const { queryByText } = renderToastHost();
    act(() => {
      showToast('짧은 토스트', 'error', { durationMs: 1000 });
    });
    expect(queryByText('짧은 토스트')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(queryByText('짧은 토스트')).toBeNull();
  });
});
