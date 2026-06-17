// apps/ios/app/+native-intent.tsx
// expo-router deep-link escape hatch (Phase 16, D-05 "A안" — piece 1 of 2).
// Runs OUTSIDE the React app: NO Supabase, NO auth, NO mounted UI, NO async
// board queries here (RESEARCH Pitfall 1, CITED docs.expo.dev/router/advanced/native-intent).
// Its ONLY job: detect the expo-share-intent deep link and redirect to the
// mounted /share-handler screen (Plan 16-02), which does the real read/enqueue/route.
// `path` is "not guaranteed a valid URL"; must NEVER throw; must ALWAYS return a path.
import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      // Pass the original deep link through so the handler can read the payload.
      return `/share-handler?dataUrl=${encodeURIComponent(path)}`;
    }
    return path;
  } catch {
    // Per Expo docs: never crash here — fall back to a safe route.
    return '/';
  }
}
