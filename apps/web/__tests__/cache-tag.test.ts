import { describe, expect, it } from 'vitest';
import { TRIP_REVALIDATE_TAG } from '@/lib/public-trip-cache';

describe('TRIP_REVALIDATE_TAG', () => {
  it('returns trip:{slug}', () => {
    expect(TRIP_REVALIDATE_TAG('abc12345')).toBe('trip:abc12345');
  });
});
