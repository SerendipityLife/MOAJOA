import { describe, expect, it } from 'vitest';
import { memberColor } from '@/lib/member-color';
import { colors } from '@moajoa/ui-tokens';

/**
 * Pure-function tests for D-20 pin color assignment (MOA-06).
 * Owner is pinned to brand[500] (outside the palette); participants take
 * colors.member cyclically by join order (created_at asc). Colors come from
 * ui-tokens only — never interpolate user strings (T-05-05-01 lineage).
 */
describe('memberColor', () => {
  const OWNER = 'owner';

  it('host (userId === ownerId) → brand[500], regardless of member list', () => {
    expect(memberColor(OWNER, OWNER, [])).toBe(colors.brand[500]);
  });

  it('first joiner (join order index 0) → colors.member[0]', () => {
    expect(memberColor('u1', OWNER, ['u1', 'u2'])).toBe(colors.member[0]);
  });

  it('7th member (index 6) cycles back to colors.member[0] (% 6)', () => {
    const ids = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    expect(memberColor('u6', OWNER, ids)).toBe(colors.member[0]);
  });

  it('userId not in the list → defensive default colors.member[0]', () => {
    expect(memberColor('ghost', OWNER, ['u1', 'u2'])).toBe(colors.member[0]);
  });

  it('palette is the A-2 locked 6 colors (regression guard)', () => {
    expect(colors.member.length).toBe(6);
    expect(colors.member[0]).toBe('#FF7043');
    expect([...colors.member]).toEqual([
      '#FF7043',
      '#AB47BC',
      '#26A69A',
      '#FFB300',
      '#EC407A',
      '#7CB342',
    ]);
  });
});
