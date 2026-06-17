# Phase 16: iOS Share Ingestion - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 8 new + 2 possible-modify = 10
**Analogs found:** 10 / 10 (every new file has a strong in-repo analog — this phase is wiring, not greenfield)

> Mental model from RESEARCH (load-bearing): "A안" decomposes into **two pieces** — `+native-intent.tsx` (thin redirect, runs OUTSIDE app context, no auth/Supabase) and a mounted `share-handler.tsx` (does the read/enqueue/route with auth available). Do not put board-count queries or `enqueuePendingLink` inside `+native-intent.tsx`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/ios/app/+native-intent.tsx` | route (deep-link interceptor) | transform (path → path) | `apps/ios/app/index.tsx` (Redirect-only route) + RESEARCH Pattern 1 | role-match (no existing native-intent; index.tsx is the closest "redirect-only route") |
| `apps/ios/app/share-handler.tsx` | screen (mounted handler) | event-driven → request-response | `apps/ios/app/index.tsx` (auth-gated mounted screen) + `apps/ios/app/boards/[id].tsx` (addLink+startExtraction+navigate) | exact (composes two existing screen patterns) |
| `apps/ios/lib/share-routing.ts` | utility (pure decision fn) | transform | `apps/ios/lib/pending.ts` (pure-ish helpers, no React) | role-match |
| `apps/ios/components/boards/board-picker-sheet.tsx` | component | event-driven (select → callback) | `apps/ios/components/boards/pin-sheet.tsx` (PinBottomSheet) | exact |
| Payload reader wiring (inside share-handler) | service-glue | event-driven (onChange) | `expo-share-intent` `useShareIntentContext` + `apps/ios/lib/shared-defaults.ts` | exact (library API) |
| `apps/ios/__tests__/share-routing.test.ts` | test | unit (pure) | `apps/ios/__tests__/pending.test.ts` | exact |
| `apps/ios/__tests__/share-payload.test.ts` | test | unit (fixture) | `apps/ios/__tests__/pending.test.ts` | role-match |
| `apps/ios/__tests__/native-intent.test.ts` | test | unit (mock) | `apps/ios/__tests__/pending.test.ts` | role-match |
| `apps/ios/__tests__/share-handler.test.ts` | test | unit (mock) | `apps/ios/__tests__/pending.test.ts` | exact (same mock topology) |
| MODIFY `apps/ios/app/_layout.tsx` | route (root layout) | — | self (current `_layout.tsx`) | exact — only wrap in `<ShareIntentProvider>` if provider-read chosen |

`apps/ios/lib/pending.ts` is **reuse-as-is** (D-05). Do NOT modify it; `share-handler.tsx` imports `enqueuePendingLink` for the linger path only.

---

## Pattern Assignments

### `apps/ios/app/+native-intent.tsx` (route, redirect-only)

**Analog:** `apps/ios/app/index.tsx` (the only other "this route exists purely to redirect" file) + RESEARCH §Pattern 1.

**Key constraint (from RESEARCH Pitfall 1, CITED Expo docs):** runs OUTSIDE the React app — NO Supabase, NO auth, NO async board queries. Redirect only. Must never throw; always return a path.

**Imports / signature pattern** (the redirect helper is a named export, not a default React component — unlike every other file in `app/`):
```typescript
import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return `/share-handler?dataUrl=${encodeURIComponent(path)}`;
    }
    return path;
  } catch {
    return '/';
  }
}
```

**Why `getShareExtensionKey()` not `'moajoaShareKey'` literal:** RESEARCH Anti-Patterns + Phase 3 Pitfall 2 (App Group / key drift = silent nil). The library derives `${scheme}ShareKey`. Never hardcode.

---

### `apps/ios/app/share-handler.tsx` (screen, event-driven → request-response)

**Analogs:** `apps/ios/app/index.tsx` (auth-gated mounted screen with `getSession` effect) for the auth-readiness shape, and `apps/ios/app/boards/[id].tsx` (lines 85-105) for the add+extract+navigate shape.

**Auth-readiness pattern — copy from `index.tsx` lines 12-24** (await session before deciding; Pitfall 4 says launch-from-share races auth bootstrap):
```typescript
// index.tsx:13-24 — the canonical "wait for getSession, react to auth changes" effect
useEffect(() => {
  let mounted = true;
  supabase.auth.getSession().then(({ data }) => {
    if (mounted) setAuthed(data.session !== null);
  });
  // ...
}, []);
```

**Payload read pattern (event-based) — library API, NOT `SharedDefaults.get` re-parse** (RESEARCH §Don't Hand-Roll). `index.js` exports: `getShareExtensionKey`, `parseShareIntent`, `useShareIntentContext`, `ShareIntentProvider` [VERIFIED node_modules/expo-share-intent/build/index.js]. Module methods: `getShareIntent(url): string`, `clearShareIntent(key): Promise<void>`, `hasShareIntent(key): boolean` [VERIFIED ExpoShareIntentModule.d.ts:9-11]. Recommended: provider read.
```typescript
import { useShareIntentContext } from 'expo-share-intent';
// const { shareIntent, resetShareIntent } = useShareIntentContext();
// shareIntent.webUrl  ← captured URL (type 'weburl'); call resetShareIntent() after handling (dedup, Pitfall 2)
```

**Core add+extract+navigate pattern — copy verbatim shape from `boards/[id].tsx` lines 89-102** (this is the D-03 "visible pin forming" path; use `startExtraction`, NOT drain's fire-and-forget `triggerExtraction` — Pitfall 5):
```typescript
// boards/[id].tsx:89-102 — addLink → (mirror LastBoardId) → startExtraction
const link = await addLink(supabase, { board_id: id, url: value });
SharedDefaults.set(SharedDefaultsKeys.LastBoardId, id);
const addedKind = detectSourceKind(link.url);
if (addedKind !== null && addedKind !== 'manual') {
  startExtraction({ linkId: link.id, boardId: id, boardTitle: board?.title ?? null });
}
```
Then navigate: `router.replace(\`/boards/${route.boardId}\`)`. The target screen already renders `useActiveExtractions().filter(e => e.boardId === id)` (boards/[id].tsx:42) and reloads on `onExtractionComplete` (boards/[id].tsx:79-83), so D-03 progress shows with no change to the board screen.

**Linger path (D-02) — reuse `enqueuePendingLink` AS-IS** (pending.ts:29). For not-authed OR 0 boards: `await enqueuePendingLink(url, null)` then `router.replace('/')`. The drain at `_layout.tsx` + the `!item.board_id` skip at `pending.ts:67-68` already handle lingering. Do not reimplement.

**Input validation (V5 / CLAUDE.md §4.5):** Zod-validate `shareIntent.webUrl` is an `http(s)` URL before enqueue — untrusted external input.

> **Open Question #1 for planner (from RESEARCH):** auto-case = direct `addLink`+`startExtraction` (D-03 visible) vs `enqueuePendingLink`+drain (no progress). RESEARCH recommends the hybrid above. Confirm in plan.

---

### `apps/ios/lib/share-routing.ts` (utility, pure)

**Analog:** `apps/ios/lib/pending.ts` — same convention: plain TS module, no React, importable by tests with no native mocks. (`share-routing` is even purer — no `SharedDefaults` at all, so it needs zero mocks.)

**Signature (from RESEARCH §Pattern 3):**
```typescript
export type ShareRoute =
  | { kind: 'linger' }                 // D-02: !authed OR 0 boards
  | { kind: 'auto'; boardId: string }  // D-01/D-03: exactly 1 board
  | { kind: 'picker' };                // D-01/D-04: 2+ boards
export function decideShareRoute(authed: boolean, boardCount: number,
                                 firstBoardId: string | null): ShareRoute { /* ... */ }
```
Board count source: `listMyBoards(supabase)` [VERIFIED packages/api/src/queries/boards.ts:4 — returns `Board[]` ordered by updated_at]. Picker rows can use `listMyBoardsWithPreview` (boards.ts:29) for name + place_count.

---

### `apps/ios/components/boards/board-picker-sheet.tsx` (component, D-04)

**Analog:** `apps/ios/components/boards/pin-sheet.tsx` (PinBottomSheet) — exact pattern, `@gorhom/bottom-sheet`.

**Mount-stays-alive gotcha — copy `shown`-state pattern from pin-sheet.tsx:31-47** (RESEARCH Pitfall 6; unmounting drops measured layout → first `snapToIndex` no-ops):
```typescript
// pin-sheet.tsx:28-47 — ref + keep-mounted + imperative open/close
const sheetRef = useRef<BottomSheet>(null);
const [shown, setShown] = useState<Place | null>(null);
useEffect(() => {
  if (place) { setShown(place); /* ... */ sheetRef.current?.snapToIndex(1); }
  else { sheetRef.current?.close(); }
}, [place]);
```

**NativeWind-on-BottomSheetView gotcha — copy structure from pin-sheet.tsx:148-160:** inline `backgroundStyle` on `<BottomSheet>`/`<BottomSheetView>`, all visible content in an inner `<View className="...">`. `className` on `BottomSheetView` silently fails.
```typescript
<BottomSheet ref={sheetRef} index={-1} snapPoints={['40%', '90%']}
  enablePanDownToClose onClose={onClose}
  backgroundStyle={{ backgroundColor: '#fff' }}>
  <BottomSheetView>
    {shown && <View className="px-6 pt-2 pb-6 bg-white">{/* board rows */}</View>}
  </BottomSheetView>
</BottomSheet>
```
On select: same add+extract+navigate as share-handler core pattern above.

---

### Tests (all mirror `apps/ios/__tests__/pending.test.ts`)

**The mock topology to copy (pending.test.ts:1-30):**
```typescript
// 1. Mock the native bridge with the in-memory map BEFORE importing the SUT:
jest.mock('@/lib/shared-defaults', () => require('../__mocks__/shared-defaults'));
// 2. Mock @moajoa/api with jest.fn() per query you exercise:
const mockAddLink = jest.fn(); const mockListMyBoards = jest.fn();
jest.mock('@moajoa/api', () => ({ addLink: (...a) => mockAddLink(...a), /* ... */ }));
// 3. Stub supabase:
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
// 4. beforeEach: SharedDefaults.__clear(); mockX.mockReset();
import { SharedDefaults } from '../__mocks__/shared-defaults';
```
The mock `SharedDefaults` exposes `__clear()` (mocks/shared-defaults.ts:17-19) for `beforeEach` reset.

- **`share-routing.test.ts`** — pure, NO mocks needed. Table-test `decideShareRoute` over {authed×0/1/2+ boards}. Closest to pending.test.ts:32-36 assert style.
- **`share-payload.test.ts`** — feed `parseShareIntent(fixtureJson, { scheme: 'moajoa' })` weburl/text fixtures; assert `webUrl` extraction. Mock only `expo-share-intent` if needed; prefer real `parseShareIntent`.
- **`native-intent.test.ts`** — mock `getShareExtensionKey` (`jest.mock('expo-share-intent', () => ({ getShareExtensionKey: () => 'moajoaShareKey' }))`); assert `redirectSystemPath` returns `/share-handler...` for share path, passthrough otherwise, `/` on throw.
- **`share-handler.test.ts`** — full mock topology above + mock `@/lib/extraction-store` (`startExtraction`) + `expo-router` `router`. Assert: linger→`enqueuePendingLink(url,null)`; auto→`addLink`+`startExtraction`+`router.replace`. Same `mockReset` discipline as pending.test.ts:26-30.

Run command: `pnpm --filter @moajoa/ios test -- share-routing share-payload native-intent share-handler` (jest-expo, [VERIFIED jest.config.js]).

---

### MODIFY `apps/ios/app/_layout.tsx` (only if provider-read chosen)

**Current state (preserve):** drain mount on cold launch + AppState 'active' (`_layout.tsx:22-53`), `getSession`→`ready` gate (`:34-36`). **Do not touch the drain logic** — D-05 preserves it.

**Only change:** wrap the render tree (`:57-65`) in `<ShareIntentProvider>` IF the handler reads via `useShareIntentContext` (RESEARCH §Pattern 2 Option A). This does NOT contradict D-05's "no B안" — provider is used strictly as a payload reader, not for auto-navigation (RESEARCH Open Question #2; document the boundary in the plan). If the direct `getShareIntent`/`onChange` listener route is chosen instead, `_layout.tsx` needs no change.

---

## Shared Patterns

### App Group key derivation (drift-safety)
**Source:** `expo-share-intent` `getShareExtensionKey()` + `apps/ios/lib/shared-defaults.ts` (`APP_GROUP_ID` from `@moajoa/core`).
**Apply to:** `+native-intent.tsx`, `share-handler.tsx`.
Never hardcode `'moajoaShareKey'`. Never hand-roll `SharedDefaults.get('moajoaShareKey')` for the payload — use the library reader (parses the structured `{text,weburls,files,meta}` JSON correctly). Phase 3 Pitfall 2 (drift = silent nil) is still live.

### Queue reuse (D-05 — do not break)
**Source:** `apps/ios/lib/pending.ts` (`enqueuePendingLink`, `drainPendingLinks`, failed/retry) — fully built + tested.
**Apply to:** `share-handler.tsx` linger path imports `enqueuePendingLink` AS-IS. The `_layout.tsx` drain + `pending.ts:67-68` null-board_id skip already implement D-02 lingering. Do not add new enqueue logic.

### Extraction progress (D-03)
**Source:** `apps/ios/lib/extraction-store.ts` (`startExtraction` — registers Realtime `extract:{linkId}` + module store) consumed by `apps/ios/app/boards/[id].tsx:42,79-83`.
**Apply to:** share-handler auto path + picker-sheet select path. Use `startExtraction` (visible progress) NOT drain's `triggerExtraction` (fire-and-forget, Pitfall 5).

### Module-level store / no-React-in-lib convention
**Source:** `pending.ts` (module `inFlight` guard), `extraction-store.ts` (module Maps + `useSyncExternalStore`).
**Apply to:** `share-routing.ts` stays a pure function module (no store needed). Dedup-after-read guard, if added, follows clear-after-read (Pitfall 2 / Open Question #3) — not a persistent URL set.

### Bottom-sheet conventions
**Source:** `components/boards/pin-sheet.tsx:5-8` (className gotcha doc), `:31-47` (keep-mounted), `:148-160` (inline backgroundStyle + inner View).
**Apply to:** `board-picker-sheet.tsx`.

---

## No Analog Found

None. Every new file maps to an existing pattern. The only genuinely-new surface is the `redirectSystemPath` named-export shape in `+native-intent.tsx` (no prior named-export route in `app/`), and its body is fully specified by RESEARCH §Pattern 1 + the achorein example.

---

## Metadata

**Analog search scope:** `apps/ios/app/`, `apps/ios/lib/`, `apps/ios/components/boards/`, `apps/ios/__tests__/`, `apps/ios/__mocks__/`, `packages/api/src/queries/`, `packages/core/src/constants.ts`, `apps/ios/node_modules/expo-share-intent/build/`.
**Files scanned:** 11 source + 3 library build files.
**Pattern extraction date:** 2026-06-17
