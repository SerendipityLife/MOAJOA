/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // setupFilesAfterEnv (NOT setupFiles) — jest-native extends `expect`, which
  // only exists after the test framework is loaded.
  setupFilesAfterEnv: ['./jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@moajoa/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@moajoa/api$': '<rootDir>/../../packages/api/src/index.ts',
    '^@moajoa/ui-tokens$': '<rootDir>/../../packages/ui-tokens/src/index.ts',
  },
  // pnpm-aware: pnpm hoists deps under node_modules/.pnpm/<pkg>@version/node_modules/<pkg>.
  // The standard jest-expo pattern keys off "node_modules/(?!pkg)" which never matches
  // when the package lives at "node_modules/.pnpm/pkg@version/node_modules/pkg". We
  // therefore allow .pnpm/ in the don't-ignore branch too.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  // Note: testPathIgnorePatterns must NOT include a bare '/ios/' — that pattern
  // would match this project's root (apps/ios/) and silently swallow every test.
  // We target the native prebuild output and Android-only dirs explicitly instead.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/ios/',
    '<rootDir>/android/',
  ],
};
