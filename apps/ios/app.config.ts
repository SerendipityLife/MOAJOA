import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'MOAJOA',
  slug: 'moajoa',
  version: '0.1.0',
  orientation: 'portrait',
  // icon/splash assets to be added in design pass. Expo uses defaults until then.
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
    'expo-font',
    // expo-share-intent will be re-added in Phase 1.5 with a SDK 54+ compatible
    // version. We're not invoking its JS APIs yet, and it requires a native
    // build (not Expo Go) anyway.
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
