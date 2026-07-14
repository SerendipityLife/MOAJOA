import { describe, expect, it } from 'vitest';
import { memberColor } from '@/lib/member-color';
import { palette } from '@/lib/palette';

/**
 * Pure-function tests for D-20 pin color assignment (MOA-06).
 * Owner is pinned to brand[600] (outside the member palette); participants take
 * palette.member cyclically by join order (created_at asc). Colors come from
 * lib/palette only — never interpolate user strings (T-05-05-01 lineage).
 */
describe('memberColor', () => {
  const OWNER = 'owner';

  it('host (userId === ownerId) → brand[600], regardless of member list', () => {
    expect(memberColor(OWNER, OWNER, [])).toBe(palette.brand[600]);
  });

  it('first joiner (join order index 0) → palette.member[0]', () => {
    expect(memberColor('u1', OWNER, ['u1', 'u2'])).toBe(palette.member[0]);
  });

  it('7th member (index 6) cycles back to palette.member[0] (% 6)', () => {
    const ids = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    expect(memberColor('u6', OWNER, ids)).toBe(palette.member[0]);
  });

  it('userId not in the list → defensive default palette.member[0]', () => {
    expect(memberColor('ghost', OWNER, ['u1', 'u2'])).toBe(palette.member[0]);
  });

  it('palette is the locked 6 colors (regression guard)', () => {
    expect(palette.member.length).toBe(6);
    expect([...palette.member]).toEqual([
      '#D73B23',
      '#5C7F15',
      '#168628',
      '#158173',
      '#9450E2',
      '#D52399',
    ]);
  });

  it('the host pin is never one of the member colors', () => {
    expect(palette.member).not.toContain(palette.brand[600]);
  });

  /**
   * Pin the literal so a palette edit can't silently regress the a11y contract:
   * pins carry a white label, and Royal Blue (brand-500, #4886E4) only reaches
   * 3.62:1 behind white — below AA. brand-600 is 5.22:1. See /design.md §7.4.
   */
  it('host pin is brand-600 #2A6ACB, not Royal Blue #4886E4', () => {
    expect(memberColor(OWNER, OWNER, [])).toBe('#2A6ACB');
    expect(memberColor(OWNER, OWNER, [])).not.toBe('#4886E4');
  });
});
