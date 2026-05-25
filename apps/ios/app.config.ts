import type { ExpoConfig } from 'expo/config';

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
    // expo-share-intent will be re-added in Phase 3 (NOT Phase 1.5 — D-16 보정)
    // with a SDK 54+ compatible version. We're not invoking its JS APIs yet,
    // and it requires a native build (not Expo Go) anyway.
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://moajoa.app',
  },
};

export default config;
