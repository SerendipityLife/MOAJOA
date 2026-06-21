// Unit test for redirectSystemPath (Phase 16, D-05 — deep-link interceptor).
// Mock getShareExtensionKey so the test is deterministic and can exercise the
// throw path (T-16-03: must never crash, always return a path).
jest.mock('expo-share-intent', () => ({
  getShareExtensionKey: jest.fn(() => 'moajoaShareKey'),
}));

import { getShareExtensionKey } from 'expo-share-intent';
import { redirectSystemPath } from '@/app/+native-intent';

beforeEach(() => {
  (getShareExtensionKey as jest.Mock).mockReset();
  (getShareExtensionKey as jest.Mock).mockReturnValue('moajoaShareKey');
});

test('share deep link redirects to /share-handler with encoded payload', () => {
  const result = redirectSystemPath({ path: 'dataUrl=moajoaShareKey?nonce=abc', initial: true });
  expect(result.startsWith('/share-handler?dataUrl=')).toBe(true);
});

test('non-share app path passes through unchanged', () => {
  expect(redirectSystemPath({ path: '/trip/123/plan', initial: false })).toBe('/trip/123/plan');
});

test('deep link without share key passes through unchanged', () => {
  expect(redirectSystemPath({ path: 'moajoa://some/other', initial: true })).toBe('moajoa://some/other');
});

test('returns "/" (never crashes) when getShareExtensionKey throws', () => {
  (getShareExtensionKey as jest.Mock).mockImplementationOnce(() => {
    throw new Error('boom');
  });
  expect(redirectSystemPath({ path: 'dataUrl=moajoaShareKey', initial: true })).toBe('/');
});
