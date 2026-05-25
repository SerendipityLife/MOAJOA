import type { ExpoConfig } from 'expo/config';

// Single source of truth for App Group identifier (also exported as APP_GROUP_ID
// from packages/core for runtime code; duplicated here as literal because
// app.config.ts is evaluated by Metro before any monorepo resolution).
// Mismatch with packages/core APP_GROUP_ID = silent nil from UserDefaults
// (Phase 3 RESEARCH Pitfall 2).
const APP_GROUP_ID = 'group.com.serendipitylife.moajoa';

const config: ExpoConfig = {
  name: 'MOAJOA',
  slug: 'moajoa',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'moajoa',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.serendipitylife.moajoa',
    supportsTablet: false,
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: '내 주변 장소를 보여주려면 위치 권한이 필요해요.',
    },
    entitlements: {
      'com.apple.security.application-groups': [APP_GROUP_ID],
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        backgroundColor: '#FFFFFF',
        resizeMode: 'contain',
        imageWidth: 234,
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Pretendard-Regular.otf',
          './assets/fonts/Pretendard-Medium.otf',
          './assets/fonts/Pretendard-SemiBold.otf',
          './assets/fonts/Pretendard-Bold.otf',
        ],
      },
    ],
    [
      'expo-share-intent',
      {
        iosAppGroupIdentifier: APP_GROUP_ID,
        iosShareExtensionName: 'MOAJOA 저장',
        iosActivationRules: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsWebPageWithMaxCount: 1,
          NSExtensionActivationSupportsText: 1,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://moajoa.app',
    eas: {
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: 'ShareExtension',
                bundleIdentifier: 'com.serendipitylife.moajoa.ShareExtension',
                entitlements: {
                  'com.apple.security.application-groups': [APP_GROUP_ID],
                },
              },
            ],
          },
        },
      },
    },
  },
};

export default config;
