// Unit tests for lib/onboarding.ts (Plan 05-06, D-20).
//
// Contract for [id].tsx wiring:
// - isLinkCardDismissed() reads OnboardKeys.LinkCardDismissed and returns true
//   ONLY when the stored value is the exact string 'true' (AsyncStorage stores
//   strings; we compare strictly so future writers can't accidentally enable
//   the dismiss with truthy-but-not-'true' values).
// - dismissLinkCard() writes 'true' to that key.
// - Storage failures degrade gracefully (read → false, write → silent warn) so
//   a broken AsyncStorage never crashes the board detail screen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardKeys } from '@moajoa/core';
import { isLinkCardDismissed, dismissLinkCard } from '@/lib/onboarding';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedGet = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSet = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

beforeEach(() => {
  mockedGet.mockReset();
  mockedSet.mockReset();
});

describe('isLinkCardDismissed', () => {
  test('returns true when stored value is "true"', async () => {
    mockedGet.mockResolvedValueOnce('true');
    await expect(isLinkCardDismissed()).resolves.toBe(true);
    expect(mockedGet).toHaveBeenCalledWith(OnboardKeys.LinkCardDismissed);
  });

  test('returns false when stored value is null (never written)', async () => {
    mockedGet.mockResolvedValueOnce(null);
    await expect(isLinkCardDismissed()).resolves.toBe(false);
  });

  test('returns false for non-"true" strings (strict compare)', async () => {
    mockedGet.mockResolvedValueOnce('1');
    await expect(isLinkCardDismissed()).resolves.toBe(false);
  });

  test('returns false (and does not throw) when AsyncStorage rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGet.mockRejectedValueOnce(new Error('storage offline'));
    await expect(isLinkCardDismissed()).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('dismissLinkCard', () => {
  test('writes "true" to OnboardKeys.LinkCardDismissed', async () => {
    mockedSet.mockResolvedValueOnce(undefined);
    await dismissLinkCard();
    expect(mockedSet).toHaveBeenCalledWith(OnboardKeys.LinkCardDismissed, 'true');
  });

  test('swallows AsyncStorage failures (does not throw)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedSet.mockRejectedValueOnce(new Error('disk full'));
    await expect(dismissLinkCard()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('OnboardKeys.LinkCardDismissed', () => {
  test('matches the canonical namespaced storage key (D-20 lock)', () => {
    expect(OnboardKeys.LinkCardDismissed).toBe('@moajoa/onboard:link_card_dismissed');
  });
});
