// Phase 16, V5 (CLAUDE.md §4.5): the inbound shared webUrl is untrusted external
// input. Two layers here:
//   1. extractSharedUrl — Zod http(s) guard (drops non-URL / non-http(s) text).
//   2. parseShareIntent integration — proves shareIntent.webUrl is the field the
//      handler reads out of a weburl payload.
import { extractSharedUrl } from '@/lib/share-routing';
import { parseShareIntent } from 'expo-share-intent';

describe('extractSharedUrl — V5 http(s) guard', () => {
  test('passes a full https youtube url', () => {
    expect(extractSharedUrl('https://www.youtube.com/watch?v=abc')).toBe(
      'https://www.youtube.com/watch?v=abc',
    );
  });

  test('passes a plain http url', () => {
    expect(extractSharedUrl('http://example.com')).toBe('http://example.com');
  });

  test('trims surrounding whitespace', () => {
    expect(extractSharedUrl('  https://x.com/p  ')).toBe('https://x.com/p');
  });

  test('drops plain text that is not a url', () => {
    expect(extractSharedUrl('just some text, not a url')).toBeNull();
  });

  test('drops ftp (non-http(s))', () => {
    expect(extractSharedUrl('ftp://files.example.com')).toBeNull();
  });

  test('drops javascript: scheme (non-http(s))', () => {
    expect(extractSharedUrl('javascript:alert(1)')).toBeNull();
  });

  test('drops null', () => {
    expect(extractSharedUrl(null)).toBeNull();
  });

  test('drops undefined', () => {
    expect(extractSharedUrl(undefined)).toBeNull();
  });
});

describe('parseShareIntent — webUrl extraction (fixture)', () => {
  test('extracts webUrl from a weburls payload', () => {
    const raw = JSON.stringify({
      weburls: [{ url: 'https://www.youtube.com/watch?v=abc', meta: '' }],
      text: null,
      files: [],
    });
    const result = parseShareIntent(raw, { scheme: 'moajoa' });
    expect(result.webUrl).toBe('https://www.youtube.com/watch?v=abc');
  });
});
