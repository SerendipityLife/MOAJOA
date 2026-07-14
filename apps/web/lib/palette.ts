import { colors } from '@moajoa/ui-tokens';

/**
 * Web palette — Banana Mania × Royal Blue. Spec: /design.md.
 *
 * The TypeScript twin of the `@theme` block in app/globals.css. Tailwind can't
 * read TS, so the hexes are stated in both places; both derive from design.md.
 * This module exists for the JS-side consumers that a CSS variable can't reach
 * — the map marker SVGs, which interpolate a literal fill into a data: URL.
 *
 * Why not just edit @moajoa/ui-tokens? It is shared with apps/ios, which is
 * frozen during the v2.1 web-first pivot (CLAUDE.md §5), so changing it there
 * would move iOS's visuals too. Anything not restated below (neutral, surface,
 * medal, …) still comes straight from ui-tokens.
 */
export const palette = {
  ...colors,

  /** hue 216, anchored on Royal Blue at 500. */
  brand: {
    50: '#F0F6FF',
    100: '#DDEAFE',
    200: '#BDD5FA',
    300: '#91B8F3',
    400: '#6A9EEC',
    500: '#4886E4', // Royal Blue — identity only: 3.62:1 on white, large text
    600: '#2A6ACB', // action — buttons, links, pin fills: 5.22:1 on white
    700: '#2158AB',
    800: '#18468B',
    900: '#14376B',
  },

  /**
   * Participant pin colors, cycled by join order. Chosen so they stay tellable
   * apart at pin size on map tiles: >=42 degrees of hue between any two, >=44
   * from the Royal Blue host pin, and >=29 from Banana Mania. Each clears AA
   * (>=4.6:1) against the white initial drawn on top.
   *
   * The old palette's amber (#FFB300) is gone — it collided with Banana Mania.
   */
  member: ['#D73B23', '#5C7F15', '#168628', '#158173', '#9450E2', '#D52399'],
} as const;
