/**
 * Tailwind preset built from shared design tokens.
 * apps/web/tailwind.config.ts and apps/ios's NativeWind config extend this.
 */

import { colors, radii, shadows, spacing, typography } from './index';

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        neutral: colors.neutral,
        pin: colors.pin,
        category: colors.category,
        medal: colors.medal,
        surface: colors.surface,
        success: colors.semantic.success,
        warning: colors.semantic.warning,
        danger: colors.semantic.danger,
        info: colors.semantic.info,
      },
      spacing,
      borderRadius: radii,
      boxShadow: shadows,
      fontFamily: {
        sans: typography.fonts.sans,
        mono: typography.fonts.mono,
      },
      fontSize: typography.sizes,
      fontWeight: typography.weights,
      lineHeight: typography.lineHeights,
    },
  },
};
