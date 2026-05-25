// Jest auto-mock target for apps/ios/lib/shared-defaults.ts (Plan 03-04).
// Provides an in-memory Map standing in for App Group UserDefaults.
const store = new Map<string, string>();

export const SharedDefaults = {
  get<T>(key: string): T | null {
    const raw = store.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  set<T>(key: string, value: T): void {
    store.set(key, JSON.stringify(value));
  },
  remove(key: string): void {
    store.delete(key);
  },
  __clear(): void {
    store.clear();
  },
};
