# Phase 3: iOS Save Flow — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 18 new/modified
**Analogs found:** 15 / 18 (3 has no close analog — config plugin / native Swift module / new modal route)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/ios/app/_layout.tsx` *(modify)* | RN root layout | event-driven (AppState) | `apps/ios/app/_layout.tsx` (current) | self-extend |
| `apps/ios/app/index.tsx` *(modify)* | RN screen | request-response (auth gate) | `apps/ios/app/(tabs)/boards.tsx` (auth-aware list) | role-match |
| `apps/ios/app/login.tsx` *(modify)* | RN screen | request-response | `apps/ios/app/login.tsx` (current magic-link) | self-extend |
| `apps/ios/app/boards/[id].tsx` *(modify)* | RN screen | CRUD + event-driven (broadcast) | `apps/ios/app/boards/[id].tsx` (current URL+map skeleton) | self-extend |
| `apps/ios/app/boards/_pin-sheet.tsx` *(new)* | RN component (sheet) | request-response | `apps/ios/app/boards/[id].tsx` Marker block | role-match |
| `apps/ios/app/boards/_pin-add-modal.tsx` *(new inline Modal component)* | RN modal component | request-response (debounced search) | `apps/ios/app/boards/new.tsx` (modal-shaped form) | role-match (note: rendered via React Native `<Modal presentationStyle='pageSheet'>` from boards/[id].tsx, NOT an expo-router route — see Plan 03-05) |
| `apps/ios/app/_pending.tsx` *(new modal route)* | RN modal screen | CRUD list | `apps/ios/app/(tabs)/boards.tsx` (FlatList) | role-match |
| `apps/ios/app/_failed-board.tsx` *(new modal route)* | RN modal screen | CRUD list (retry/delete) | `apps/ios/app/(tabs)/boards.tsx` (FlatList) | role-match |
| `apps/ios/lib/realtime.ts` *(new)* | RN service / helper | event-driven (broadcast subscribe) | `supabase/functions/extract-youtube/index.ts:257-275` `broadcastStep` (sender) | partial — only sender exists; receiver new |
| `apps/ios/lib/pending.ts` *(new)* | RN service | batch (drain queue) | `packages/api/src/queries/links.ts` `addLink`+`triggerExtraction` | partial — composes existing helpers |
| `apps/ios/lib/shared-defaults.ts` *(new)* | RN native module bridge (TS side) | I/O (KV) | `apps/ios/lib/supabase.ts` (lightweight singleton wrapper) | partial — no existing native bridge |
| `apps/ios/lib/toast.ts` *(new)* | RN UI singleton | event-driven | (no analog — new pattern) | none |
| `apps/ios/modules/shared-defaults/ios/SharedDefaultsModule.swift` *(new)* | iOS native Swift module | I/O (UserDefaults) | (no analog in repo — first native module) | none |
| `apps/ios/app.config.ts` *(modify)* | config | declarative | `apps/ios/app.config.ts` (current plugin list) | self-extend |
| `supabase/functions/resolve-place/index.ts` *(new)* | Edge Function | request-response | `supabase/functions/extract-youtube/index.ts` | exact (role + flow) |
| `supabase/functions/resolve-place/pipeline/places-search.ts` *(new)* | server util | request-response (Google API) | `supabase/functions/extract-youtube/pipeline/places.ts` | exact |
| `supabase/migrations/0005_resolve_place_cost.sql` *(new)* | SQL migration | DDL alter | `supabase/migrations/0004_extraction_hardening.sql` | role-match |
| `packages/api/src/queries/places.ts` *(modify)* | query helper | CRUD | `packages/api/src/queries/places.ts` (current) | self-extend |
| `packages/core/src/schemas/place.ts` *(modify)* | Zod schema | validation | `packages/core/src/schemas/place.ts` (current `PlaceAddManualSchema`) | self-extend |

---

## Pattern Assignments

### `apps/ios/app/_layout.tsx` (RN root layout, AppState event-driven)

**Analog:** Itself (`apps/ios/app/_layout.tsx` lines 1–25). Extend the existing `ready` gate with AppState listener + drain trigger.

**Existing skeleton to extend** (lines 1–25):
```ts
import 'react-native-gesture-handler';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
```

**Pattern to add:** insert a second `useEffect` (after the `ready` becomes true) that
1. fires `drainPendingLinks()` once (cold-launch),
2. registers `AppState.addEventListener('change', ...)` and calls drain on `'active'`,
3. returns `() => sub.remove()` (arrow wrap — RESEARCH Pitfall 4).

Guard against re-entry with `useRef<boolean>` in-flight flag (RESEARCH Pattern 3). Toast host component mounts inside `SafeAreaProvider` (above `<Stack>`).

**Imports to add:** `AppState, type AppStateStatus` from `react-native`; `useRef` from `react`; `drainPendingLinks` from `@/lib/pending`; `ToastHost` from `@/lib/toast`.

---

### `apps/ios/app/index.tsx` (RN screen, auth gate request-response)

**Analog:** `apps/ios/app/(tabs)/boards.tsx` lines 13–30 — `supabase` + `useEffect` async load pattern. For the auth check itself, see `apps/ios/lib/supabase.ts:16-23` (`supabase.auth.getSession()` already configured with AsyncStorage adapter).

**Current state** (Phase 1 smoke — to be REPLACED, lines 6–17):
```tsx
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-500">
      <View className="px-6 py-4 bg-white rounded-2xl shadow-lg">
        <Text className="text-2xl font-bold text-brand-700">NativeWind OK</Text>
        ...
```

**Pattern to copy** (from `(tabs)/boards.tsx`):
```tsx
import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Index() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/(tabs)/boards' : '/login');
    });
  }, []);
  return null;
}
```

CONTEXT D-13 lock: this screen becomes a redirect-only gate.

---

### `apps/ios/app/login.tsx` (RN screen, auth)

**Analog:** Itself (lines 1–68). Currently magic-link only. CONTEXT.md SAVE-01 + Session-notes 2026-05-25 = 이메일+비번 메인 / 매직링크 토글.

**Existing pattern to extend** (line 14–24 — auth call + error Alert):
```ts
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: 'moajoa://auth-callback' },
});
if (error) {
  Alert.alert('로그인 실패', error.message);
  return;
}
```

**Pattern for password path** (same error-handling shape):
```ts
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  setInlineError(mapAuthError(error.message)); // UI-SPEC §6 error mapping
  return;
}
router.replace('/(tabs)/boards');
```

Use UI-SPEC §6 typography (16/600 primary CTA `text-white text-base font-semibold`, 14/400 inline error `text-sm text-danger`).

---

### `apps/ios/app/boards/[id].tsx` (RN screen, CRUD + broadcast-event)

**Analog:** Itself (`apps/ios/app/boards/[id].tsx` lines 1–142). Three additions:
1. broadcast subscribe + spinner overlay (D-10),
2. `+ 핀` header button → modal route (D-07),
3. `Marker onPress` → bottom sheet (D-09).

**Existing add-link pattern to wrap with broadcast** (lines 38–50):
```ts
async function onAddLink() {
  if (!url.trim() || !id) return;
  try {
    const link = await addLink(supabase, { board_id: id, url: url.trim() });
    if (link.source_kind === 'youtube') {
      triggerExtraction(supabase, link.id).catch((err) => console.error(err));
    }
    setUrl('');
    await load();
  } catch (err) {
    Alert.alert('링크 추가 실패', err instanceof Error ? err.message : String(err));
  }
}
```

**Extend with `analyzing` state + subscribe effect** (Pattern from RESEARCH §Pattern 2):
```tsx
const [analyzing, setAnalyzing] = useState<string | null>(null);

// in onAddLink, after triggerExtraction is fired:
setAnalyzing(link.id);

useEffect(() => {
  if (!analyzing) return;
  const ch = subscribeExtractProgress(analyzing, (p) => {
    if (p.step === 'done') {
      setAnalyzing(null);
      load();
      showToast(`${p.places_extracted ?? 0}개 핀 추가됨`);
    } else if (p.step === 'error') {
      setAnalyzing(null);
      showToast(mapErrorReason(p.error), 'error');
    }
  });
  return () => { supabase.removeChannel(ch); };
}, [analyzing]);
```

**Existing header to extend with `+ 핀` button** (lines 60–67):
```tsx
<View className="flex-row items-center px-4 pt-2 pb-3">
  <Pressable onPress={() => router.back()} className="px-2 py-1">
    <Text className="text-brand-500">← 뒤로</Text>
  </Pressable>
  <Text className="ml-2 text-lg font-semibold flex-1" numberOfLines={1}>
    {board?.title ?? '...'}
  </Text>
</View>
```

Insert right-aligned `Pressable onPress={() => setAddPinOpen(true)}` (parent component owns `addPinOpen` state and renders `<Modal visible={addPinOpen} presentationStyle='pageSheet'><PinAddModal .../></Modal>`) — copy `Pressable` styling from boards.tsx line 36–41 (`bg-brand-500 px-4 py-2 rounded-lg` + `text-white text-sm font-medium`). NOTE: Plan 03-05 chose inline Modal (not expo-router route) — see Plan 03-05 Task 2 for the authoritative approach.

**Marker onPress → bottom sheet** (extends line 102–109):
Current Marker has no `onPress`. Add `onPress={() => setSelectedPin(p)}` + render `<PinBottomSheet pin={selectedPin} onClose={() => setSelectedPin(null)} onChange={load} />` outside MapView.

**Typography normalization for UI-SPEC §typography active set:**
- List item title currently `text-sm font-medium` (line 131) → **change to `text-base font-semibold`** (16/600).
- List item meta currently `text-xs text-neutral-500` (line 134) → **change to `text-sm text-neutral-500`** (14/400).
- helper text currently `text-xs text-neutral-500` (line 88) → **change to `text-sm text-neutral-500`** (14/400).
- 추가 button label currently `text-sm font-medium` (line 84) → **change to `text-base font-semibold`** (16/600 CTA).

---

### `apps/ios/app/boards/_pin-sheet.tsx` (RN sheet component, new)

**Analog:** Existing Marker block + Alert pattern from `boards/[id].tsx` line 48 (Alert.alert with destructive action) — copy the destructive Alert shape.

**Library:** `@gorhom/bottom-sheet@^5.2.14` (RESEARCH §Standard Stack).

**Pattern to follow** (UI-SPEC §3 Pin Bottom Sheet — snap [25%, 50%]):
```tsx
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRef, useState } from 'react';
import type { Place } from '@moajoa/core';
import { hidePlace, renamePlace } from '@moajoa/api'; // renamePlace = new (places.ts extension)

export function PinBottomSheet({ pin, onClose, onChange }: {
  pin: Place | null;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const ref = useRef<BottomSheet>(null);
  if (!pin) return null;
  return (
    <BottomSheet ref={ref} snapPoints={['25%', '50%']} enablePanDownToClose onClose={onClose}>
      <BottomSheetView className="px-6 pt-2 pb-6">
        {/* handle is BottomSheet built-in */}
        <Text className="text-lg font-semibold text-neutral-900 mt-3">{pin.name_local}</Text>
        <Text className="text-sm text-neutral-600 mt-1">{pin.address ?? pin.name_ko ?? ''}</Text>
        <View className="self-start mt-2 px-1.5 py-0.5 rounded-md bg-neutral-100">
          <Text className="text-sm text-neutral-700">{pin.source_kind === 'manual' ? '수동' : 'AI'}</Text>
        </View>
        {/* action buttons — UI-SPEC §3 */}
      </BottomSheetView>
    </BottomSheet>
  );
}
```

**Delete Alert shape** (copy from `[id].tsx:48`):
```ts
Alert.alert('핀 삭제', '정말 삭제할까요?', [
  { text: '취소', style: 'cancel' },
  { text: '삭제', style: 'destructive', onPress: async () => {
      await hidePlace(supabase, pin.id);
      onChange(); onClose();
  } },
]);
```

> **NativeWind + BottomSheetView pitfall** (RESEARCH Pitfall 3): put className on **inner `<View>`**, not directly on `BottomSheetView`. The wireframe above already does this.

---

### `apps/ios/app/boards/_pin-add-modal.tsx` (RN inline Modal component, debounced search)

> **Approach alignment (descriptive note):** PATTERNS.md is descriptive; Plan 03-05 is authoritative. Plan 03-05 implements this as an inline React Native `<Modal presentationStyle='pageSheet'>` controlled by parent `boards/[id].tsx` via `addPinOpen` state — NOT as an expo-router modal route. The form skeleton below still applies; only the mounting mechanism differs.

**Analog:** `apps/ios/app/boards/new.tsx` (modal-shaped single-input form) + `[id].tsx` FlatList pattern.

**Modal mounting (Plan 03-05 chosen approach):** Parent `boards/[id].tsx` renders:
```tsx
<Modal visible={addPinOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddPinOpen(false)}>
  <PinAddModal boardId={id} onClose={() => setAddPinOpen(false)} onAdded={load} />
</Modal>
```
No `Stack.Screen` registration needed — React Native `<Modal>` is the host. KeyboardAvoidingView wraps content for iOS keyboard behavior.

**Existing modal-form skeleton to copy** (`new.tsx` lines 30–55):
```tsx
return (
  <SafeAreaView className="flex-1 bg-white">
    <View className="px-6 pt-6">
      <Text className="text-2xl font-semibold mb-6">새 보드</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="..."
        autoFocus
        className="border border-neutral-300 rounded-lg px-4 py-3 text-base mb-4"
      />
      ...
```

**Debounce pattern** (RESEARCH §Don't Hand-Roll — useEffect + setTimeout cleanup):
```ts
const [query, setQuery] = useState('');
const [results, setResults] = useState<ResolvePlaceResult[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (query.length < 1) { setResults([]); return; }
  const t = setTimeout(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-place', { body: { query } });
      if (!error) setResults(data?.places ?? []);
    } finally {
      setLoading(false);
    }
  }, 300);
  return () => clearTimeout(t);
}, [query]);
```

Note: `supabase.functions.invoke` shape copied from `packages/api/src/queries/links.ts:53-58` `triggerExtraction`.

**Result tap → addManualPlace:**
```ts
const onSelect = async (p: ResolvePlaceResult) => {
  await addManualPlace(supabase, { board_id, google_place_id: p.google_place_id });
  showToast('핀 추가됨');
  onAdded();   // parent reload
  onClose();   // dismiss the <Modal>
};
```
(Plan 03-05 uses `onClose` callback instead of `router.back()` since this is a component, not a route.)
Wraps existing `addManualPlace` (`packages/api/src/queries/places.ts:37-48`) — already calls `add_manual_place` RPC.

---

### `apps/ios/lib/realtime.ts` (broadcast subscribe helper, new)

**Analog:** `supabase/functions/extract-youtube/index.ts:257-275` `broadcastStep` (sender side — channel name + event name + payload shape).

**Sender side** (read-only — to mirror as receiver):
```ts
// supabase/functions/extract-youtube/index.ts:257
async function broadcastStep(admin, linkId, step, progressPct, detail?) {
  const channel = admin.channel('extract:' + linkId);
  await channel.send({
    type: 'broadcast',
    event: 'progress',
    payload: { step, progress_pct: progressPct, ...(detail ?? {}) },
  });
  admin.removeChannel(channel);
}
```

**Receiver pattern** (RESEARCH §Pattern 2):
```ts
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ExtractProgress {
  step: 'metadata' | 'transcript' | 'llm' | 'places' | 'done' | 'error';
  progress_pct: number;
  places_extracted?: number;
  error?: string;
}

export function subscribeExtractProgress(
  linkId: string,
  onProgress: (p: ExtractProgress) => void,
): RealtimeChannel {
  const channel = supabase
    .channel('extract:' + linkId)
    .on('broadcast', { event: 'progress' }, (msg) => onProgress(msg.payload as ExtractProgress))
    .subscribe();
  return channel;
}
```

**Channel-name + event-name + payload shape MUST match sender exactly** — checker should `grep -rn "extract:" supabase/functions/ apps/ios/lib/` to verify alignment.

---

### `apps/ios/lib/pending.ts` (drain service, new)

**Analog:** `packages/api/src/queries/links.ts` `addLink` (line 24–39) + `triggerExtraction` (line 50–59) — composed. Plus `apps/ios/app/boards/[id].tsx:38-50` for the existing add-link try/catch shape.

**Existing add+trigger composition** (`[id].tsx` lines 41–45):
```ts
const link = await addLink(supabase, { board_id: id, url: url.trim() });
if (link.source_kind === 'youtube') {
  triggerExtraction(supabase, link.id).catch((err) => console.error(err));
}
```

**Drain shape** (RESEARCH §Common Operation 1 — full code block already in RESEARCH lines 716-794). Key points to copy:
- `SharedDefaults.get<Pending[]>('pending_links') ?? []`
- For each entry: `await addLink(...)`, then conditional `triggerExtraction(...)`.
- `retry_count++ on fail`; entries with `retry_count > 3` move to `pending_links_failed`.
- **One drain turn = at most one attempt per entry** (RESEARCH Pitfall 7 — no inner retry loop).
- Final `SharedDefaults.set(KEY, stillPending)` and `SharedDefaults.set(KEY_FAILED, [...prev, ...failed])`.

---

### `apps/ios/lib/shared-defaults.ts` (TS native module bridge, new)

**Analog:** `apps/ios/lib/supabase.ts` (lightweight singleton wrapper pattern).

**Existing singleton wrapper pattern to mirror** (`lib/supabase.ts` lines 1–23):
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { Database } from '@moajoa/api';

const url = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
...
export const supabase = createClient<Database>(...);
```

**Bridge skeleton** (RESEARCH §Pattern 4):
```ts
import { requireNativeModule } from 'expo';
const Native = requireNativeModule('SharedDefaults');

const APP_GROUP = 'group.com.serendipitylife.moajoa';

export const SharedDefaults = {
  get<T>(key: string): T | null {
    const raw = Native.getString(APP_GROUP, key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  set<T>(key: string, value: T): void {
    Native.setString(APP_GROUP, key, JSON.stringify(value));
  },
  remove(key: string): void { Native.remove(APP_GROUP, key); },
};
```

> **Before writing this module**, run RESEARCH §Pattern 4 alternative check: `grep -rn "UserDefaults" node_modules/expo-share-intent/ios/` — if `expo-share-intent` exposes SharedDefaults helpers, wrap them instead. Otherwise create new module.

---

### `apps/ios/lib/toast.ts` (toast singleton, new — no analog)

No existing toast in codebase. Build from scratch per UI-SPEC §1 Toast component contract:
- position: `mx-4 px-4 py-3 rounded-xl shadow-md`, mounted at top of `SafeAreaProvider` in `_layout.tsx`
- bg: `bg-neutral-900` (success) / `bg-danger` (error)
- text: `text-white text-sm` (14/400)
- single instance (queue replaced on new toast)
- module-level event emitter + `useSyncExternalStore` consumer in `<ToastHost />`

---

### `apps/ios/modules/shared-defaults/ios/SharedDefaultsModule.swift` (native Swift module, new — no analog)

No existing native modules in repo. Use Expo Modules API per RESEARCH §Pattern 4:
```swift
import ExpoModulesCore

public class SharedDefaultsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SharedDefaults")
    Function("getString") { (suiteName: String, key: String) -> String? in
      return UserDefaults(suiteName: suiteName)?.string(forKey: key)
    }
    Function("setString") { (suiteName: String, key: String, value: String) in
      UserDefaults(suiteName: suiteName)?.set(value, forKey: key)
    }
    Function("remove") { (suiteName: String, key: String) in
      UserDefaults(suiteName: suiteName)?.removeObject(forKey: key)
    }
  }
}
```
Plus `expo-module.config.json` per Expo Modules API docs.

---

### `apps/ios/app.config.ts` (config, modify)

**Analog:** Itself (lines 1–58). Three plugin/entitlement additions per RESEARCH §Pattern 1:
1. Add `ios.entitlements['com.apple.security.application-groups']: [APP_GROUP]`.
2. Add `expo-share-intent` plugin entry with `iosAppGroupIdentifier`, `iosShareExtensionName`, `iosActivationRules`.
3. Add `extra.eas.build.experimental.ios.appExtensions[]` with matching entitlement.

**Single-source for App Group ID** (RESEARCH Pitfall 2):
```ts
const APP_GROUP = 'group.com.serendipitylife.moajoa';
// then reference APP_GROUP in all 3 locations (entitlements, plugin, eas appExtensions)
```

Current placeholder comment at line 44–46 ("expo-share-intent will be re-added in Phase 3") is the insertion point.

---

### `supabase/functions/resolve-place/index.ts` (Edge Function, new — exact analog)

**Analog:** `supabase/functions/extract-youtube/index.ts` (entire file). Copy structurally — same patterns for:
- auth gate (lines 57–60)
- admin client construction (lines 48–53)
- Zod request validation (lines 62–71)
- error JSON helpers (lines 304–317)

**Imports pattern to copy** (extract-youtube/index.ts lines 18–25):
```ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
```

**Auth + body validation** (extract-youtube/index.ts lines 57–71):
```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'unauthorized');

let body: unknown;
try { body = await req.json(); } catch { return jsonError(400, 'invalid json body'); }
const parsed = RequestSchema.safeParse(body);
if (!parsed.success) return jsonError(400, 'invalid body: ' + parsed.error.message);
```

**Admin client** (extract-youtube/index.ts lines 48–53):
```ts
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRole) return jsonError(500, 'server misconfigured');
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
```

**Cost logging** (extract-youtube/index.ts lines 277–302) — adapt to `link_id: null`:
```ts
await admin.from('extraction_costs').insert({
  link_id: null,                // requires 0005 migration
  provider: 'google_places',
  model: 'text-search',
  cost_usd: 0.032,
  duration_ms,
}).catch((e) => console.warn('[cost-log] failed:', e));
```

**Error JSON helpers** (extract-youtube/index.ts lines 304–317) — copy verbatim.

**deno.json** (copy from `supabase/functions/extract-youtube/deno.json`):
```json
{ "imports": { "supabase-js": "jsr:@supabase/supabase-js@2", "zod": "npm:zod@3" } }
```

---

### `supabase/functions/resolve-place/pipeline/places-search.ts` (Google API wrapper, new — exact analog)

**Analog:** `supabase/functions/extract-youtube/pipeline/places.ts` (entire file, 80 lines).

**Field mask + endpoint constants to copy verbatim** (places.ts lines 27–35):
```ts
const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
].join(',');
```

**Fetch call shape** (places.ts lines 37–51):
```ts
const res = await fetch(PLACES_TEXT_SEARCH_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'X-Goog-Api-Key': inputs.apiKey,
    'X-Goog-FieldMask': FIELD_MASK,
  },
  body: JSON.stringify({
    textQuery: inputs.query,
    languageCode: inputs.languageCode,
    maxResultCount: 5,                       // 5 instead of 1 — D-07
    ...(inputs.lat && inputs.lng ? {
      locationBias: {
        circle: { center: { latitude: inputs.lat, longitude: inputs.lng }, radius: 50000 },
      },
    } : {}),
  }),
});
```

**Response mapping** (places.ts lines 58–78 — adapt to list of 5):
```ts
const places = (data?.places ?? []).map((p: any) => ({
  google_place_id: p.id,
  displayName: p.displayName?.text ?? '',
  formattedAddress: p.formattedAddress ?? null,
  location: { lat: p.location?.latitude, lng: p.location?.longitude },
  primaryType: p.primaryType ?? null,
}));
```

> **Phase 2 D-12 enforcement** (RESEARCH Pitfall 6): `X-Goog-FieldMask` MUST be the same `FIELD_MASK` constant. Phase 3 verify:
> ```bash
> grep -rn "X-Goog-FieldMask" supabase/functions/ | grep -v "FIELD_MASK"  # must be 0
> ```

---

### `supabase/migrations/0005_resolve_place_cost.sql` (migration, new)

**Analog:** `supabase/migrations/0004_extraction_hardening.sql` (header style + comment convention).

**Header comment template** (0004 lines 1–13):
```sql
-- =============================================================================
-- {short title}
-- =============================================================================
-- {what + why}
-- =============================================================================
```

**Statement** (resolve `extraction_costs.link_id` NOT NULL constraint — RESEARCH Pitfall 9):
```sql
-- 0005_resolve_place_cost.sql
-- Allow standalone API cost rows (manual searches, no link_id) for resolve-place
-- Edge Function. Phase 3 D-08 + Phase 2 D-09 ("one row per API call").

alter table extraction_costs
  alter column link_id drop not null;

-- Widen provider check to include manual search variant (optional — index-friendly).
alter table extraction_costs
  drop constraint if exists extraction_costs_provider_check;
alter table extraction_costs
  add constraint extraction_costs_provider_check
  check (provider in ('anthropic', 'google_places'));
-- Note: existing rows already use 'google_places' for both extraction + manual search.
```

**Append-only rule** (CLAUDE.md §4.3): do NOT modify 0004 in place. Use new file 0005.

---

### `packages/api/src/queries/places.ts` (query helpers, modify)

**Analog:** Itself (lines 1–62). Extends with `renamePlace`, `deletePlace` (hard delete is already `deleteBoard`-shaped; soft delete uses existing `hidePlace`).

**Existing function shape to follow** (places.ts lines 50–61):
```ts
export async function hidePlace(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('places')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
```

**New functions to add** (same signature shape):
```ts
export async function renamePlace(
  client: MoajoaSupabaseClient,
  id: string,
  name_local: string,
): Promise<Place> {
  const { data, error } = await client
    .from('places')
    .update({ name_local })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}

// deletePlace = hard delete; use hidePlace for soft. D-09 default uses hidePlace.
export async function deletePlace(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('places').delete().eq('id', id);
  if (error) throw error;
}
```

**RLS coverage** (`supabase/migrations/0001_init.sql:397-409`):
- `places: update` policy uses `can_edit_board(board_id)` → `renamePlace` passes for board members. ✓
- `places: delete` policy: `added_by = auth.uid() or board owner` → `deletePlace` passes for self-added or board owner. ✓
- No new migration needed for these CRUD paths.

---

### `packages/core/src/schemas/place.ts` (Zod schema, modify)

**Analog:** Itself (lines 1–77). `PlaceAddManualSchema` already exists (line 52–58). Add `ResolvePlaceQuery` and `ResolvePlaceResult` schemas.

**Existing pattern to mirror** (place.ts lines 51–58):
```ts
export const PlaceAddManualSchema = z.object({
  board_id: z.string().uuid(),
  google_place_id: z.string().min(1),
  note: z.string().max(500).optional(),
});

export type PlaceAddManual = z.infer<typeof PlaceAddManualSchema>;
```

**New schemas to add** (server contract from RESEARCH §Pattern 5 — same `z.object` + `z.infer` pattern):
```ts
export const ResolvePlaceQuerySchema = z.object({
  query: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  language: z.string().default('ko'),
});
export type ResolvePlaceQuery = z.infer<typeof ResolvePlaceQuerySchema>;

export const ResolvePlaceResultSchema = z.object({
  google_place_id: z.string().min(1),
  displayName: z.string(),
  formattedAddress: z.string().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  primaryType: z.string().nullable(),
});
export type ResolvePlaceResult = z.infer<typeof ResolvePlaceResultSchema>;
```

Schema is shared between Edge Function (validates request) and iOS modal (types result). Server should re-declare in Edge Function (Deno can't import workspace) but the shape MUST match — checker verify by diff.

---

## Shared Patterns

### Authentication / Authorization

**Source:** `supabase/functions/extract-youtube/index.ts` lines 57–60 (Edge Function side); `apps/ios/lib/supabase.ts` lines 16–23 (client side).

**Apply to:** `supabase/functions/resolve-place/index.ts`, all iOS screens (gated via `_layout.tsx` + `index.tsx` redirect).

```ts
// Server (Edge Function):
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) return jsonError(401, 'unauthorized');

// Client (iOS):
// supabase.functions.invoke handles auth via stored session automatically.
// No manual token forwarding needed.
```

---

### Error handling (server)

**Source:** `supabase/functions/extract-youtube/index.ts` lines 304–317.

**Apply to:** `supabase/functions/resolve-place/index.ts`.

```ts
function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
```

---

### Error handling (client UI)

**Source:** `apps/ios/app/boards/[id].tsx` lines 47–49 + `apps/ios/app/boards/new.tsx` lines 22–25.

**Apply to:** Phase 3, replace `Alert.alert` for non-destructive flows with `showToast(msg, 'error')` per UI-SPEC §Toast contract. Keep `Alert.alert` for destructive confirmations (UI-SPEC §3 핀 삭제).

```ts
// Existing pattern (Alert):
catch (err) {
  Alert.alert('링크 추가 실패', err instanceof Error ? err.message : String(err));
}

// Phase 3 pattern (toast for transient errors):
catch (err) {
  showToast(err instanceof Error ? err.message : '잠시 후 다시 시도', 'error');
}
```

---

### Cost logging (Edge Function side)

**Source:** `supabase/functions/extract-youtube/index.ts` lines 277–302 (`logCost`).

**Apply to:** `resolve-place` Edge Function (Phase 2 D-09 — one row per API call). `link_id: null` for standalone manual searches (requires 0005 migration). Always wrap in `.catch(...)` to avoid silent failure of the main flow.

---

### Broadcast (server send → client subscribe)

**Source:**
- Sender: `supabase/functions/extract-youtube/index.ts` lines 257–275 (`broadcastStep`).
- Receiver (new): `apps/ios/lib/realtime.ts` `subscribeExtractProgress`.

**Apply to:** `apps/ios/app/boards/[id].tsx` (URL add flow only). Channel name `extract:{link_id}`, event `progress`, payload `{ step, progress_pct, ...detail }`. **Cleanup is mandatory** — `supabase.removeChannel(ch)` in `useEffect` return.

---

### RLS — SECURITY DEFINER helper pattern

**Source:** `supabase/migrations/0002_fix_rls_recursion.sql` lines 18–48 (`am_board_owner`, `am_board_member`); `supabase/migrations/0001_init.sql` lines 263+ (`can_edit_board`).

**Apply to:** No new policies needed in Phase 3 — `places.insert/update/delete` policies already cover the manual pin paths via `can_edit_board`. Phase 3 only adds 0005 (alter constraint). If any new policy IS needed, use this pattern (never inline cross-table `EXISTS`).

---

### Workspace imports (no `.js` extension)

**Source:** `CLAUDE.md` §4.5; `apps/ios/app/boards/[id].tsx` line 1.

**Apply to:** All new iOS files.

```ts
// ✅
import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind, type Board, type Link, type Place } from '@moajoa/core';

// ❌ NEVER
import { foo } from '@moajoa/api.js';
```

---

### NativeWind class normalization (UI-SPEC §typography)

**Active scale (Phase 3):** 4 sizes (`text-2xl`, `text-lg`, `text-base`, `text-sm`) × 2 weights (`font-regular`/none, `font-semibold`).

**Forbidden during Phase 3:** `text-xs`, `font-medium`, `font-bold` (all current uses must be reassigned per UI-SPEC §Typography "Reassignment audit" table).

**Apply to:** All RN files modified/created in Phase 3. Checker should run:
```bash
grep -rn "text-xs\|font-medium\|font-bold" apps/ios/app/ apps/ios/lib/  # ideally 0 after Phase 3
```

---

## No Analog Found

Files genuinely new — planner should use RESEARCH.md patterns rather than scan for analogs:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/ios/lib/toast.ts` | UI singleton | event-driven | No existing toast in codebase; built from UI-SPEC §1 contract |
| `apps/ios/modules/shared-defaults/ios/SharedDefaultsModule.swift` | iOS native Swift | I/O (UserDefaults) | First Expo Module in repo; pattern from RESEARCH §Pattern 4 + Expo Modules API docs |
| `apps/ios/modules/shared-defaults/expo-module.config.json` | Module manifest | declarative | First Expo Module — use Expo template |

> **Optional pre-check before writing native module:** `grep -rn "UserDefaults\|SharedDefaults" node_modules/expo-share-intent/ios/`. If `expo-share-intent` already exposes an App Group SharedDefaults bridge, wrap that instead and skip the new native module entirely.

---

## Metadata

**Analog search scope:**
- `apps/ios/app/**` (all 9 existing screens)
- `apps/ios/lib/**` (only `supabase.ts`)
- `packages/api/src/queries/**` (boards, links, places)
- `packages/core/src/schemas/**` (place, link, index)
- `supabase/functions/extract-youtube/**` (index, pipeline/places, pipeline/claude)
- `supabase/migrations/**` (0001, 0002, 0004)

**Files scanned:** ~22 source files, fully read.

**Pattern extraction date:** 2026-05-26
