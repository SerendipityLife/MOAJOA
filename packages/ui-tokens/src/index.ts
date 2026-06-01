/**
 * MOAJOA Design Tokens
 *
 * Single source of truth consumed by:
 * - apps/web Tailwind config (via ./tailwind.ts)
 * - apps/ios NativeWind / inline styles
 *
 * Anything that affects visual appearance and could drift between platforms
 * lives here. Component-level layout (gap-2 vs space-y-4) stays in each app.
 */

export const colors = {
  // Brand — MOAJOA Blue (ported from MOAJOA Design System app_theme).
  // 500 = signature #2979FF, 600 = button-primary #2563EB, 700 = #1D4ED8.
  brand: {
    50: '#F5F7FF', // primary-surface
    100: '#E0EAFF', // primary-light
    200: '#B3C8FF', // primary-medium
    300: '#93B4FF',
    400: '#5C93FF',
    500: '#2979FF', // primary accent — MOAJOA blue
    600: '#2563EB', // button-primary
    700: '#1D4ED8', // primary-dark / button-hover
    800: '#1E40AF',
    900: '#1B3A8F',
  },
  // Map pin states (vote-trust semantics — distinct from the place-category
  // palette below). loved tracks brand-500.
  pin: {
    candidate: '#94A3B8', // gray-400 — extracted but no votes
    loved: '#2979FF', // brand-500
    confirmed: '#16A34A', // green-600 — majority loved
    hidden: '#D1D5DB', // gray-300
  },
  // Neutral grayscale (Tailwind gray — matches design system neutrals)
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },
  // App scaffold vs card/sheet surfaces (design system: tinted scaffold,
  // white-only cards/dialogs/sheets).
  surface: {
    background: '#F5F6F8',
    raised: '#FFFFFF',
  },
  // Semantic
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
  // Place-category badge palette (chips on place cards)
  category: {
    nature: '#43A047',
    food: '#FF8F00',
    culture: '#5C6BC0',
    wellness: '#26A69A',
    shopping: '#8D6E63',
  },
  // Leaderboard / ranking medals
  medal: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  },
} as const;

export const spacing = {
  px: '1px',
  '0': '0',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
  '20': '5rem',
  '24': '6rem',
} as const;

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem', // 12px — buttons & inputs
  xl: '1rem', // 16px — cards
  '2xl': '1.5rem', // 24px — dialogs
  '3xl': '1.75rem', // 28px — bottom-sheet (top corners)
  full: '9999px', // chips (stadium) & FAB
} as const;

export const typography = {
  fonts: {
    // Korean-first, Japanese fallback (MOAJOA Design System). Loaded via
    // next/font on web, expo-font on iOS.
    sans: [
      'IBM Plex Sans KR',
      'IBM Plex Sans JP',
      'Apple SD Gothic Neo',
      'Noto Sans KR',
      'system-ui',
      'sans-serif',
    ],
    mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
  },
  sizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // Used for Korean/Japanese readability — tighter than English defaults.
  lineHeights: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.65',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.10), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
  // Flat design — shadows only on floating elements (FAB, bottom-nav).
  fab: '0 4px 16px rgba(41, 121, 255, 0.30)',
  nav: '0 -2px 20px rgba(25, 28, 30, 0.10)',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  breakpoints,
} as const;

export type Tokens = typeof tokens;
