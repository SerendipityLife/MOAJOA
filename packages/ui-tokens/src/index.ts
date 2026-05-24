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
  // Brand
  brand: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316', // primary accent — warm travel orange
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },
  // Map pin states
  pin: {
    candidate: '#94A3B8', // slate-400 — extracted but no votes
    loved: '#F97316', // brand-500
    confirmed: '#16A34A', // green-600 — majority loved
    hidden: '#CBD5E1', // slate-300
  },
  // Neutral grayscale (uses Tailwind slate as base)
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  // Semantic
  semantic: {
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#0284C7',
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
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;

export const typography = {
  fonts: {
    // Korean primary, Japanese fallback. Loaded via next/font on web, expo-font on iOS.
    sans: ['Pretendard', 'IBM Plex Sans KR', 'Noto Sans JP', 'system-ui', 'sans-serif'],
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
