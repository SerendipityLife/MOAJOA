import { describe, expect, it } from 'vitest';
import { BOARD_REVALIDATE_TAG } from '@/lib/cache';

describe('BOARD_REVALIDATE_TAG', () => {
  it('returns board:{slug}', () => {
    expect(BOARD_REVALIDATE_TAG('abc12345')).toBe('board:abc12345');
  });
});
