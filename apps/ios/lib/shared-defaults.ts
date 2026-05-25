import { requireNativeModule } from 'expo';
import { APP_GROUP_ID, SharedDefaultsKeys } from '@moajoa/core';

/**
 * Native module declared in apps/ios/modules/shared-defaults/.
 * Functions: getString(suiteName, key) → string|null,
 *            setString(suiteName, key, value) → void,
 *            remove(suiteName, key) → void.
 *
 * All synchronous — UserDefaults is sync on iOS, and our payloads are tiny.
 */
interface NativeShape {
  getString(suiteName: string, key: string): string | null;
  setString(suiteName: string, key: string, value: string): void;
  remove(suiteName: string, key: string): void;
}

const Native = requireNativeModule<NativeShape>('SharedDefaults');

/**
 * Typed wrapper around the iOS App Group UserDefaults. JSON-serializes
 * arbitrary values; returns null on parse failure (data treated as missing).
 *
 * APP_GROUP_ID = 'group.com.serendipitylife.moajoa' — must match the literal
 * in apps/ios/app.config.ts (Plan 03-02 lock; drift = silent nil reads per
 * RESEARCH Pitfall 2).
 */
export const SharedDefaults = {
  get<T>(key: string): T | null {
    const raw = Native.getString(APP_GROUP_ID, key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    Native.setString(APP_GROUP_ID, key, JSON.stringify(value));
  },
  remove(key: string): void {
    Native.remove(APP_GROUP_ID, key);
  },
};

// Re-export the keys constant for ergonomic call sites:
//   SharedDefaults.get<PendingLink[]>(SharedDefaultsKeys.PendingLinks)
export { SharedDefaultsKeys };
