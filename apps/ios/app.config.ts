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
    // Hermes 복귀 (v1.2 Phase 11, 2026-06-12): jsEngine 제거 = SDK 기본 Hermes.
    // 과거 JSC로 우회했던 이유는 supabase-js의 dynamic OTEL_PKG import에 붙은
    // /* webpackIgnore */ 류 magic comment가 Hermes 바이트코드 컴파일러에서
    // 깨졌기 때문. RN 0.81+가 first-party JSC를 제거했고 SDK 56은 Hermes v1이
    // 기본이라 더는 JSC 유지가 비용. RN 0.78+ Hermes 개선으로 해소 가정 —
    // 회귀(hermesc 실패) 시 babel.config.js에 magic comment 제거 transform 적용.
    // GMSApiKey는 react-native-maps 1.27 config plugin이 주입(아래 plugins 참조).
    // 옛 ios.config.googleMapsApiKey(Expo built-in)는 1.27에서 폐지된
    // `pod 'react-native-google-maps'`(존재 안 함)를 주입해 pod install 실패 →
    // 제거. 1.27은 `react-native-maps/Google` subspec + 자체 플러그인 사용. (v1.2 11-03)
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
      'react-native-maps',
      {
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
      },
    ],
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
        // 표시 라벨은 raw 문자열, 내부 Xcode 타깃명은 영숫자만 남겨 정제됨([^a-zA-Z0-9] 제거).
        // 'MOAJOA 저장'은 "MOAJOA"로 정제돼 메인 앱 타깃과 충돌 → 플러그인이 skip하므로 Latin 토큰을 분리.
        iosShareExtensionName: '저장 by MOAJOA',
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
      projectId: 'a186ba87-ad59-4f2f-a719-326e51eda3fd',
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
