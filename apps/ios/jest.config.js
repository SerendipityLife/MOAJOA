/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@moajoa/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@moajoa/api$': '<rootDir>/../../packages/api/src/index.ts',
    '^@moajoa/ui-tokens$': '<rootDir>/../../packages/ui-tokens/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
