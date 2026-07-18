import { colors } from '@moajoa/ui-tokens';

/**
 * Web palette — Indigo Mono (references/reference_01). Spec: /design.md.
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

  /** Ink override — reference_01 Text. Only the manual-pin fill reads this;
   * everything else keeps the shared ui-tokens neutral (iOS parity). */
  neutral: { ...colors.neutral, 900: '#050315' },

  /** Indigo, hue ~243. brand-600 = Primary #2F27CE (pin fills, white 9.07:1). */
  brand: {
    50: '#F0EFFF',
    100: '#DEDCFF', // Secondary — light surface
    200: '#C3BFFF',
    300: '#A29CFF',
    400: '#6F66FF',
    500: '#433BFF', // Accent — focus, active
    600: '#2F27CE', // Primary — buttons, links, pin fills: white 9.07:1 on white
    700: '#2620A6',
    800: '#1E1A80',
    900: '#181563',
  },

  /**
   * Participant pin colors, cycled by join order. Chosen so they stay tellable
   * apart at pin size on map tiles: >=42 degrees of hue between any two, and
   * each clears AA (>=4.6:1) against the white initial drawn on top. The mono
   * indigo brand (243°) leaves the whole warm/green arc free for members;
   * #9450E2 (268°) sits ~25° off the brand hue — closest, still separable.
   */
  member: ['#D73B23', '#5C7F15', '#168628', '#158173', '#9450E2', '#D52399'],
} as const;
