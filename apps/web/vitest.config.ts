import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
  },
  esbuild: {
    // 'automatic' JSX runtime — components (public-board-map.tsx 등) don't import React explicitly;
    // Next/SWC injects react/jsx-runtime at build time. vitest needs the same to render them.
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
