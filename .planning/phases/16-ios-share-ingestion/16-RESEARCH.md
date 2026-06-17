# Phase 16: iOS Share Ingestion - Research

**Researched:** 2026-06-17
**Domain:** Expo Router `+native-intent` deep-link interception + expo-share-intent 7 App Group payload bridging → existing `pending_links` drain queue → smart board routing + in-app bottom-sheet picker
**Confidence:** HIGH (library API verified against the installed source at `node_modules/expo-share-intent@7.0.0`; expo-router `redirectSystemPath` contract verified against official Expo docs; all reused infra read from current codebase)

## Summary

Phase 16 connects an already-built native capture (expo-share-intent 7 standard extension) to an already-built JS drain queue (`lib/pending.ts`). The only thing missing is the bridge. The locked architecture (D-05, "A안") adds `app/+native-intent.tsx` and routes the captured URL into `enqueuePendingLink()`, then smart-routes the user (D-01: 1 board → auto-add + navigate; 2+ boards → in-app bottom-sheet picker).

**The single most important finding that reshapes the plan:** `redirectSystemPath` in `+native-intent.tsx` runs **outside the React app context — it has NO Supabase session, NO auth state, NO mounted UI, and cannot do async board-count queries reliably** [CITED: docs.expo.dev/router/advanced/native-intent]. The official Expo and expo-share-intent pattern is that native-intent does ONE thing: detect the share deep link and **redirect to a dedicated route** (e.g. `/shareintent`) [CITED: github.com/achorein/expo-share-intent example/expo-router/app/+native-intent.ts]. The actual payload read + enqueue + smart-routing must happen **inside a mounted screen** that has auth + Supabase. So the correct decomposition of "A안" is: native-intent = thin redirect; a new mounted handler screen = read payload + enqueue + route. This preserves D-05's intent (single receive path, reuse all queue infra) while respecting the runtime constraint.

**Second key finding — the payload read is event-based, not return-based.** The native module call `ExpoShareIntentModule.getShareIntent(url)` does NOT return the payload. It reads the App Group key `${scheme}ShareKey` (= `moajoaShareKey`) and **emits the JSON string via an `onChange` listener** [VERIFIED: node_modules/expo-share-intent/build/useShareIntent.js, ExpoShareIntentModule.d.ts]. So the handler screen must register the `onChange` listener (or use `useShareIntent`/`useShareIntentContext`) — it cannot synchronously pull the value. The key `moajoaShareKey` is NOT a literal you hardcode; it's derived as `getShareExtensionKey()` = `${scheme}ShareKey` from the `moajoa` scheme. Use the library's `getShareExtensionKey()` helper, never a hardcoded string.

**Primary recommendation:** Implement A안 as TWO pieces, not one. (1) `app/+native-intent.tsx` exporting `redirectSystemPath({ path })` that detects `path.includes(\`dataUrl=${getShareExtensionKey()}\`)` and returns `'/share-handler'` (else returns `path`). (2) A new mounted route `app/share-handler.tsx` that registers expo-share-intent's `onChange` (via `ShareIntentProvider` + `useShareIntentContext`, or a direct module listener), extracts `webUrl`, calls `enqueuePendingLink(url, resolvedBoardId)`, then applies smart routing (D-01/D-03/D-04) with full auth + Supabase available. No new migration. Add `react-native-webview`-style prebuild cycle is NOT needed (no new native dep — expo-share-intent already prebuilt).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capture shared URL + write App Group payload + open app | iOS native (Share Extension target, expo-share-intent) | App Group UserDefaults (`moajoaShareKey`) | Already built (D-06 standard extension). No change. |
| Intercept `moajoa://dataUrl=…` deep link | expo-router `+native-intent.tsx` (`redirectSystemPath`) | — | Runs OUTSIDE app context — redirect-only, no auth/async [CITED: Expo docs] |
| Read payload (`onChange` event) + extract webUrl | Main App RN (mounted handler screen) | expo-share-intent module / `useShareIntentContext` | Event-based read needs a mounted component + JS runtime |
| Enqueue into `pending_links` | Main App RN (`enqueuePendingLink`) | App Group UserDefaults | Reuse Phase 3 queue verbatim (D-05 preserve infra) |
| Board-count query (D-01 routing decision) | Main App RN (handler screen) | `@moajoa/api` `listMyBoards` + Supabase | Needs auth session — only available inside app, not native-intent |
| Auto-add (1 board) + navigate + show extraction (D-03) | Main App RN | `extraction-store.ts` (`startExtraction`) + `router.replace` | Reuse existing extraction-progress store + board detail screen |
| Bottom-sheet board picker (2+ boards, D-04) | Main App RN (new sheet, `@gorhom/bottom-sheet`) | reuse `PinBottomSheet` mount/state pattern | UI-only, in-app per D-06 (no native sheet UI) |
| board_id-less item retention (D-02: logged-out / 0 boards) | `drainPendingLinks` (`:67-68` skip) | Phase 7 failed screen | Already implemented — items linger until login/board exists |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Board targeting (inbound link → which board)**
- **D-01:** Smart routing — exactly 1 board → auto-add to that board; 2+ boards → in-app bottom-sheet picker for user to choose.
- **D-02:** 0 boards OR logged-out → nowhere to add, so the link **stays in the queue** (existing `drainPendingLinks` behavior — board_id-less items preserved as `stillPending`, `lib/pending.ts:67-68`). Processed on the next drain after login/board creation. (Onboarding creates "내 첫 여행" board on first login → converges to the 1-board case.)

**Post-share app entry experience**
- **D-03:** Auto-add case (1 board) → app **navigates to the target board** and the just-arrived link's **extraction progress is visible** (the pin appearing). Immediate "I threw it in" satisfaction. Explicitly NOT just a toast — take the user to the board and show the pin forming.
- **D-04:** Picker case (multiple boards) → on app open, **in-app bottom-sheet picker** ("which board?"). On select → add + extract. Reuse existing `PinBottomSheet`/sheet pattern.

### Claude's Discretion (delegated to Claude — LOCKED)
- **D-05 (receive architecture):** **A안 adopted** — `app/+native-intent.tsx` intercepts the `moajoa://dataUrl=…` deep link, reads the expo-share-intent App Group payload (`moajoaShareKey`), feeds it into the existing `enqueuePendingLink()` queue. B안 (`useShareIntent`/`ShareIntentProvider` full integration) NOT adopted. Rationale: A has minimal change surface and preserves ALL Phase 3/7 queue/drain/failed-screen/retry infra (`lib/pending.ts`, `_layout.tsx` drain mount, Phase 7 failed/retry screen) intact. Single receive path.
  > **Researcher note (does NOT override D-05):** "A안" cannot be a single native-intent file — see Summary. The faithful implementation is native-intent (redirect) + a mounted handler that does the read/enqueue/route. This still preserves all queue infra and keeps a single receive path, which is the stated intent of D-05.
- **D-06 (extension scope):** **Standard capture extension kept** — expo-share-intent 7 default (URL capture + app open). NO in-sheet native SwiftUI board-selection UI. Board selection happens in-app per D-04. Scope protection.

### Existing locked decisions (from Phase 3 — not re-litigated)
- **D-04 (Phase 3):** drain runs on cold launch + AppState 'active' both (`_layout.tsx`).
- **D-06 (Phase 3):** silent retry ≤3, 4th failure → `pending_links_failed` → boards banner / Phase 7 screen.
- **D-03 (Phase 3):** board_id-less items need a board picker — THIS Phase 16 implements it (D-01/D-04).

### Deferred Ideas (OUT OF SCOPE — ignore)
- In-sheet native board selection UI (SwiftUI) — D-06 rejected, revisit later in a friction-reduction step.
- Android share receiving — separate Phase.
- Multi-link batch share / text-body parsing — current scope is single-URL capture (activation rules MaxCount 1).
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped in ROADMAP for Phase 16; coverage is derived from CONTEXT.md decisions D-01..D-06.

| Decision | Behavior | Research Support |
|----------|----------|------------------|
| D-05 | Intercept `moajoa://dataUrl=…` and feed into `pending_links` | §"Pattern 1: native-intent redirect" + §"Pattern 2: handler screen" |
| D-05 | Read App Group payload `moajoaShareKey` | §"Payload shape" + §"Don't Hand-Roll" (use `getShareExtensionKey()` + `onChange`) |
| D-01 | 1 board → auto; 2+ → picker; query board count | §"Pattern 3: smart routing" + `listMyBoards` |
| D-02 | logged-out / 0 boards → item lingers in queue | Already implemented at `pending.ts:67-68`; §"Pitfall 4" |
| D-03 | auto case → navigate to board + show extraction progress | §"Pattern 4: navigate + extraction-store" |
| D-04 | multi case → in-app bottom-sheet picker | §"Pattern 5: board-picker sheet" (reuse PinBottomSheet pattern) |
| D-06 | standard extension, no native sheet UI | No app.config.ts plugin change needed (§"Standard Stack") |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-share-intent` | `7.0.0` | Share Extension + `getShareExtensionKey()`, `ShareIntentProvider`, `useShareIntentContext`, `parseShareIntent` | Already installed + prebuilt; provides the payload-read API [VERIFIED: node_modules/expo-share-intent/package.json = 7.0.0; npm latest = 7.0.0 (2026-06-17)] |
| `expo-router` | `~56.2.10` | `+native-intent.tsx` `redirectSystemPath` hook | Already the router; native-intent is its standard deep-link escape hatch [CITED: docs.expo.dev/router/advanced/native-intent] |
| `@gorhom/bottom-sheet` | (installed, used by `pin-sheet.tsx`) | D-04 board-picker sheet | Already the sheet lib in this app [VERIFIED: components/boards/pin-sheet.tsx imports it] |

### Supporting (already installed, additional use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@moajoa/api` | workspace | `listMyBoards(supabase)` for board-count routing | D-01 decision in handler screen [VERIFIED: packages/api/src/queries/boards.ts:4] |
| `@moajoa/api` | workspace | `addLink`, `triggerExtraction` — already used by `pending.ts` drain | Auto-add path may go through drain rather than direct call |
| `expo-linking` | `~56.0.14` | scheme detection (used internally by `getScheme`) | Indirect — via expo-share-intent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mounted handler screen reading payload | native-intent reading payload directly | **Not viable** — native-intent has no auth/Supabase/async-safe context and the read is event-based [CITED: Expo docs + node_modules source]. Rejected. |
| `ShareIntentProvider` + `useShareIntentContext` (B안-ish) | direct `ExpoShareIntentModule.addListener('onChange')` | Provider is the library-blessed, less-fragile route. Using it ONLY to read the payload in the handler screen does NOT contradict D-05's "no full B안 integration" — D-05 rejects routing receive through the hook's auto-navigation, not using the provider as a payload reader. Planner should pick the provider for robustness; document the boundary. |
| New `app/share-handler.tsx` route | redirect to existing `/(tabs)/boards` and handle there | A dedicated route keeps the share-handling state machine isolated and testable; boards.tsx is already large. Recommend dedicated route. |

**Installation:** None. No new package. **No `expo prebuild` required** — expo-share-intent is already prebuilt and `app.config.ts` needs no plugin change (D-06 keeps the standard extension). The native side is unchanged; this phase is pure JS/TS wiring. (Contrast Phase 14, which added `react-native-webview` and needed prebuild.)

**Version verification:** `npm view expo-share-intent version` → `7.0.0` (latest dist-tag, 2026-06-17). Installed local = `7.0.0`. [VERIFIED: npm registry + node_modules]

## Architecture Patterns

### System Architecture Diagram

```
[YouTube/Safari/KakaoTalk share sheet]
            │  user taps "저장 by MOAJOA"
            ▼
[Share Extension target (expo-share-intent, native)]
   │  writes JSON payload to App Group UserDefaults
   │    suite = group.com.serendipitylife.moajoa
   │    key   = "moajoaShareKey"  (= getShareExtensionKey() = scheme+"ShareKey")
   │  opens app via deep link:  moajoa://dataUrl=moajoaShareKey?nonce=…
            ▼
[app/+native-intent.tsx  →  redirectSystemPath({ path })]   ← runs OUTSIDE app, NO auth
   │  if path.includes(`dataUrl=${getShareExtensionKey()}`)
   │      return "/share-handler"     ← redirect ONLY
   │  else return path
            ▼
[app/share-handler.tsx  (mounted, HAS auth + Supabase)]
   │  1. ShareIntentProvider/useShareIntentContext (or onChange listener)
   │       → getShareIntent(url) reads App Group → emits onChange(jsonString)
   │       → parseShareIntent → { type:'weburl', webUrl, text, meta }
   │  2. extract webUrl  (Zod-validate it's an http(s) URL)
   │  3. decide routing:
   │       boards = await listMyBoards(supabase)   ← needs auth
   │         ├─ not authed OR boards.length===0 ──► enqueuePendingLink(url, null)
   │         │                                       (D-02: lingers; redirect /welcome or /boards)
   │         ├─ boards.length===1 ─► enqueuePendingLink(url, board.id)        (D-01/D-03)
   │         │                       → drain OR direct addLink → startExtraction
   │         │                       → router.replace(`/boards/${board.id}`)  ← navigate + progress
   │         └─ boards.length>=2 ──► open in-app bottom-sheet picker (D-01/D-04)
   │                                  on select → enqueue(url, chosen.id) → add + extract → navigate
   │  4. clearShareIntent(getShareExtensionKey())   ← prevent re-fire (Pitfall 2)
            ▼
[existing pending_links queue (lib/pending.ts) + _layout.tsx drain]
   │  drainPendingLinks(): board_id present → addLink → triggerExtraction
   │                       board_id null    → stillPending (D-02 linger)
            ▼
[extraction-store.ts  →  Supabase Realtime extract:{linkId}  →  pin appears on board]
```

### Recommended Project Structure
```
apps/ios/app/
├── +native-intent.tsx        # NEW — redirectSystemPath: detect share link → "/share-handler"
├── share-handler.tsx         # NEW — read payload, enqueue, smart-route (D-01/D-03/D-04)
├── _layout.tsx               # MAYBE wrap in <ShareIntentProvider> (if using context read)
└── boards/[id].tsx           # REUSE — navigate target; already shows extraction progress

apps/ios/components/boards/
└── board-picker-sheet.tsx    # NEW — D-04 sheet (mirror pin-sheet.tsx mount/state pattern)

apps/ios/lib/
└── share-routing.ts          # NEW — PURE function: (boardCount, authed) → routing decision
                              #        (testable without native — see Validation Architecture)
```

### Pattern 1: native-intent redirect (thin, no logic)
**What:** Detect the share deep link and redirect to the handler route. Nothing else.
**When to use:** Always — this is the only safe thing to do outside app context.
```typescript
// Source: github.com/achorein/expo-share-intent example/expo-router/app/+native-intent.ts
//         + docs.expo.dev/router/advanced/native-intent (signature)
// app/+native-intent.tsx
import { getShareExtensionKey } from 'expo-share-intent';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      // Pass the original deep link through so the handler can call getShareIntent(url).
      return `/share-handler?dataUrl=${encodeURIComponent(path)}`;
    }
    return path;
  } catch {
    // Per Expo docs: never crash here — fall back to a safe route.
    return '/';
  }
}
```
> **Critical [CITED: docs.expo.dev/router/advanced/native-intent]:** `redirectSystemPath` receives `{ path, initial }`; `path` is "not guaranteed to be a valid URL"; the function may be sync or async but MUST NOT crash and MUST always return a path; it runs in a process with no auth/route context. Web is unsupported (fine — iOS only).

### Pattern 2: handler screen reads payload (event-based)
**What:** A mounted screen that obtains the App Group payload via the library's event-emitting read.
**When to use:** This is where ALL real work happens (auth available).
```typescript
// Source: node_modules/expo-share-intent/build/useShareIntent.js (read mechanism)
// Option A (recommended — provider): wrap _layout in <ShareIntentProvider>, then:
import { useShareIntentContext } from 'expo-share-intent';
// const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
// shareIntent.webUrl  ← the captured URL (type 'weburl')
// call resetShareIntent() after handling to clear the App Group key.

// Option B (direct, no provider): call the module and listen for onChange.
//   ExpoShareIntentModule.getShareIntent(url)  → triggers async onChange(jsonString)
//   parseShareIntent(jsonString, { scheme:'moajoa' }) → { type, webUrl, text, meta }
//   ExpoShareIntentModule.clearShareIntent(getShareExtensionKey())  ← clear
```
> **Why event-based [VERIFIED: ExpoShareIntentModule.d.ts]:** `getShareIntent(url: string): string` exists but the hook ignores its return and instead consumes the native `onChange` event carrying the parsed JSON. `hasShareIntent(key): boolean` and `clearShareIntent(key): Promise<void>` are the other two methods. Do not assume a synchronous return value carries the payload.

### Pattern 3: smart routing decision (PURE, testable)
**What:** Separate the routing *decision* from the I/O so it can be unit-tested without native.
```typescript
// lib/share-routing.ts
export type ShareRoute =
  | { kind: 'linger' }                       // D-02: not authed OR 0 boards
  | { kind: 'auto'; boardId: string }        // D-01/D-03: exactly 1 board
  | { kind: 'picker' };                      // D-01/D-04: 2+ boards
export function decideShareRoute(authed: boolean, boardCount: number,
                                 firstBoardId: string | null): ShareRoute {
  if (!authed || boardCount === 0) return { kind: 'linger' };
  if (boardCount === 1 && firstBoardId) return { kind: 'auto', boardId: firstBoardId };
  return { kind: 'picker' };
}
```
> Board count comes from `listMyBoards(supabase)` [VERIFIED: packages/api/src/queries/boards.ts:4 — orders by updated_at, returns Board[]]. Auth from `supabase.auth.getSession()`.

### Pattern 4: navigate + extraction progress (D-03, reuse existing)
**What:** After auto-add, navigate to the board and let the global extraction store stream the pin in.
```typescript
// Reuse: lib/extraction-store.ts startExtraction({ linkId, boardId, boardTitle })
//        — module-level store survives navigation; boards/[id].tsx already renders
//          useActiveExtractions().filter(e => e.boardId === id) (VERIFIED: boards/[id].tsx)
// Flow: addLink(supabase, {board_id, url}) → startExtraction({linkId: link.id, boardId, boardTitle})
//       → router.replace(`/boards/${boardId}`)
```
> **Decision for planner:** auto-add can EITHER (a) go through `enqueuePendingLink` + let `_layout.tsx` drain handle it, OR (b) call `addLink` + `startExtraction` directly in the handler. (b) gives the immediate D-03 "pin forming" feedback because drain's `triggerExtraction` is fire-and-forget with no UI subscription, whereas `startExtraction` registers the Realtime channel + progress store. **Recommend (b) for the auto case** (direct add + `startExtraction` + navigate), and reserve `enqueuePendingLink(url, null)` for the linger case (D-02). This still "feeds the existing queue" for the offline/no-board path, honoring D-05's reuse intent, while delivering D-03's visible progress. Flag as Open Question #1.

### Pattern 5: board-picker bottom sheet (D-04, mirror pin-sheet)
**What:** In-app sheet listing boards; on select, add + extract + navigate.
**Reuse pattern from `components/boards/pin-sheet.tsx`:**
- `@gorhom/bottom-sheet` `BottomSheet` + `BottomSheetView` with **inline `backgroundStyle`**, content in an inner `<View className=…>` (NativeWind className on `BottomSheetView` silently fails — documented at pin-sheet.tsx:5-8).
- **Keep the sheet mounted even when closed** — unmounting drops the measured layout so the first `snapToIndex` no-ops (pin-sheet.tsx:31-36 `shown` state pattern). Critical gotcha.
- `sheetRef.current?.snapToIndex(1)` to open, `.close()` to dismiss.
- List source: `listMyBoardsWithPreview(supabase)` gives board name + place_count for nicer rows (VERIFIED: boards.ts:29).

### Anti-Patterns to Avoid
- **Doing auth/board queries inside `+native-intent.tsx`** — no session there; will silently get logged-out behavior or crash. Redirect only.
- **Hardcoding `"moajoaShareKey"`** — derive via `getShareExtensionKey()` so it stays in sync with the `moajoa` scheme. (It happens to equal `moajoaShareKey` because scheme is `moajoa`, but hardcoding re-introduces the exact drift class Phase 3 Pitfall 2 warns about.)
- **Forgetting `clearShareIntent` / `resetShareIntent`** — the App Group key persists; the same URL re-fires on next foreground/relaunch → duplicate enqueue.
- **Unmounting the picker sheet when closed** — first open becomes a no-op (pin-sheet.tsx lesson).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read App Group share payload | Custom `SharedDefaults.get('moajoaShareKey')` parse | `getShareExtensionKey()` + `getShareIntent`/`onChange` (or `useShareIntentContext`) | The extension writes a structured JSON (`{text,weburls,files,meta}`), parsing differs per share type; `parseShareIntent` already normalizes it to `{type,webUrl,…}`. Re-parsing risks missing the weburl-vs-text extraction logic [VERIFIED: utils.js parseShareIntent]. |
| Derive the App Group key name | `'moajoaShareKey'` literal | `getShareExtensionKey()` | Library derives `${scheme}ShareKey`; hardcode = drift risk (Phase 3 Pitfall 2 class). |
| Deep-link interception | Custom `Linking.addEventListener` in `_layout` | `+native-intent.tsx` `redirectSystemPath` | The deep link is "unmatched route" by design; native-intent is expo-router's blessed hook and fires before routing [CITED: Expo docs]. |
| Queue / drain / retry / failed-screen | New enqueue logic | `enqueuePendingLink` / `drainPendingLinks` (lib/pending.ts) | Fully built + tested (Phase 3/7); D-05 mandates reuse. |
| Extraction progress UI | New spinner wiring | `startExtraction` + `useActiveExtractions` (extraction-store.ts) | Module-level store + Realtime channel already streams `extract:{linkId}` and survives navigation. |
| Bottom sheet | RN Modal + gestures | `@gorhom/bottom-sheet` (pin-sheet pattern) | Snap points + the mount/className gotchas already solved in pin-sheet.tsx. |

**Key insight:** Almost nothing in this phase is new logic — it is *wiring* two finished halves. The risk is in the seams (native-intent context limits, event-based read, key derivation, dedup), not in building features.

## Runtime State Inventory

This phase is client wiring only (no rename/migration), but it interacts with App Group runtime state, so the relevant subset:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (App Group) | Extension writes key `moajoaShareKey` (derived `${scheme}ShareKey`) in suite `group.com.serendipitylife.moajoa`. Existing queue keys: `pending_links`, `pending_links_failed`, `last_board_id`, `auth_status` (constants.ts:121). | Read `moajoaShareKey` via library; enqueue into `pending_links` (existing). **Clear `moajoaShareKey` after read** to prevent re-fire. |
| Live service config | None — no external service config changes. | None — verified: app.config.ts plugin unchanged (D-06). |
| OS-registered state | iOS Share Extension target already registered via prebuild; `scheme: 'moajoa'` deep link already registered. | None new — verified: no app.config.ts change needed; no prebuild. |
| Secrets/env vars | None referenced by this wiring. | None — verified by code-only scope. |
| Build artifacts | expo-share-intent already prebuilt into `ios/`. No new native dep. | **None — no `expo prebuild` needed** (unlike Phase 14). Confirm by: no change to `plugins` array. |

**`moajoaShareKey` in core constants?** Optional. CONTEXT.md leaves to planner. **Recommendation: do NOT add it to `packages/core/constants.ts`** — it's a library-internal derived value best obtained via `getShareExtensionKey()` at the iOS call site, not a cross-platform (web/Edge) constant. Adding it invites the literal-drift it's meant to avoid. [ASSUMED — see Assumptions Log A1]

## Common Pitfalls

### Pitfall 1: native-intent has no app context (auth/Supabase/UI all absent)
**What goes wrong:** Calling `listMyBoards(supabase)` or reading the session inside `redirectSystemPath` returns logged-out/empty or throws.
**Why:** `redirectSystemPath` runs in a pre-app process "outside your app … you cannot access authentication state or route context" [CITED: docs.expo.dev/router/advanced/native-intent].
**How to avoid:** native-intent redirects only; all logic in the mounted handler screen.
**Warning signs:** Share always lingers / always treated as logged-out even when authed; intermittent crashes on launch-from-share.

### Pitfall 2: payload re-fires (no clear) → duplicate enqueue
**What goes wrong:** Same shared URL enqueues twice (on relaunch or next foreground).
**Why:** The App Group key persists until cleared; `getShareIntent` re-emits it. Also nonce in `moajoa://dataUrl=moajoaShareKey?nonce=…` changes per share but the *stored key* does not.
**How to avoid:** Call `resetShareIntent()` (provider) or `clearShareIntent(getShareExtensionKey())` (direct) right after a successful read. Additionally consider a dedup guard on `(url + nonce)` before enqueue.
**Warning signs:** Two pins for one share; queue grows on every app foreground.

### Pitfall 3: App Group ID drift → silent nil (Phase 3 Pitfall 2 — still live)
**What goes wrong:** Read returns nothing, no error.
**Why:** `app.config.ts` literal `group.com.serendipitylife.moajoa`, `packages/core` `APP_GROUP_ID`, the expo-share-intent `iosAppGroupIdentifier`, and the prebuilt `.entitlements` must all match. expo-share-intent uses its own `iosAppGroupIdentifier` option (already set to the same literal — VERIFIED app.config.ts:70).
**How to avoid:** Don't touch the App Group literal. If the handler reads via `SharedDefaults` for any reason, use `APP_GROUP_ID` from core. Prefer the library reader (no manual suite name).
**Warning signs:** Empty `shareIntent`, no `onChange` fired despite a real share.

### Pitfall 4: native-intent fires before auth/boards ready (D-02 interplay)
**What goes wrong:** Handler runs `decideShareRoute` before `supabase.auth.getSession()` resolves → wrongly lingers an authed user's link.
**Why:** Launch-from-share races the auth bootstrap (`_layout.tsx` sets `ready` only after `getSession()` resolves — VERIFIED _layout.tsx:34-36).
**How to avoid:** In the handler, `await supabase.auth.getSession()` (and a `listMyBoards`) before deciding; show a brief loading state. Because the link is also enqueued, even a wrong "linger" self-heals on the next drain — but for D-03 satisfaction, await readiness first.
**Warning signs:** Authed user with 1 board sees the link linger instead of auto-navigate on a cold launch from share.

### Pitfall 5: drain's `triggerExtraction` gives no visible progress (D-03 gap)
**What goes wrong:** Auto-add via `enqueuePendingLink` + drain adds the link but the user sees no "pin forming."
**Why:** drain's `triggerExtraction(...).catch(...)` is fire-and-forget with no Realtime subscription (VERIFIED pending.ts:78), whereas D-03 wants visible progress.
**How to avoid:** For the auto case, use `startExtraction` (registers `extract:{linkId}` channel + progress store) rather than drain's path. See Pattern 4 / Open Question #1.
**Warning signs:** Navigated to board but no step indicator / pin appears only after manual refresh.

### Pitfall 6: bottom-sheet first-open no-op + NativeWind className silently dropped
**What goes wrong:** Picker opens only on second trigger; or styles don't apply.
**Why:** Documented in pin-sheet.tsx:5-8, 31-36 — unmounting drops layout; className on `BottomSheetView` doesn't transform.
**How to avoid:** Keep the sheet mounted; inline `backgroundStyle`, inner `<View className>`. Copy the `shown`-state pattern.

## Code Examples

### Reading + handling in the mounted handler (sketch)
```typescript
// app/share-handler.tsx  (Option A: provider; assumes _layout wrapped in ShareIntentProvider)
// Source pattern: node_modules/expo-share-intent useShareIntentContext + this app's stores
import { useShareIntentContext } from 'expo-share-intent';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { listMyBoards, addLink } from '@moajoa/api';
import { supabase } from '@/lib/supabase';
import { enqueuePendingLink } from '@/lib/pending';
import { startExtraction } from '@/lib/extraction-store';
import { decideShareRoute } from '@/lib/share-routing';
// inside component:
//   const { shareIntent, resetShareIntent } = useShareIntentContext();
//   useEffect(() => { if (!shareIntent.webUrl) return; (async () => {
//     const { data:{ session } } = await supabase.auth.getSession();
//     const boards = session ? await listMyBoards(supabase) : [];
//     const route = decideShareRoute(!!session, boards.length, boards[0]?.id ?? null);
//     const url = shareIntent.webUrl!;
//     if (route.kind === 'linger') { await enqueuePendingLink(url, null); router.replace('/'); }
//     else if (route.kind === 'auto') {
//       const link = await addLink(supabase, { board_id: route.boardId, url });
//       startExtraction({ linkId: link.id, boardId: route.boardId, boardTitle: null });
//       router.replace(`/boards/${route.boardId}`);
//     } else { /* open picker sheet with url in state */ }
//     resetShareIntent();
//   })(); }, [shareIntent.webUrl]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Linking.getInitialURL` + manual parse | `+native-intent.tsx` `redirectSystemPath` | expo-router v3+ (SDK 50+) | Standard escape hatch for unmatched deep links; runs pre-route. |
| `useShareIntent` hook only | `ShareIntentProvider` + `useShareIntentContext` (+ `getShareExtensionKey` export) | expo-share-intent 2.x+ | Centralized read; key-derivation helper exported (use it). |

**Deprecated/outdated:** Reading the App Group key by a hardcoded string — superseded by `getShareExtensionKey()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Do NOT add `moajoaShareKey` to `packages/core/constants.ts`; obtain via `getShareExtensionKey()` at iOS call site | Runtime State Inventory | Low — if planner prefers a documented constant, adding one is harmless as long as it equals `getShareExtensionKey()`. Recommendation is for drift-safety, not correctness-blocking. |
| A2 | expo-share-intent's `getShareIntent(url)` does not need the app fully mounted beyond a JS-runtime + an `onChange` listener; provider read works from the handler screen | Pattern 2 | Medium — if the native module requires the app's main bundle context that the handler screen provides anyway, fine; verify on-device that `onChange` fires when entering via `/share-handler`. UAT-gated. |
| A3 | No `expo prebuild` needed because no native dependency or plugin config changes | Standard Stack / Runtime State Inventory | Low-Medium — true as long as `app.config.ts plugins` is untouched. If the planner adds any native change, prebuild returns. |

## Open Questions

1. **Auto-add path: direct `addLink`+`startExtraction` vs `enqueuePendingLink`+drain.**
   - What we know: drain's `triggerExtraction` is fire-and-forget (no visible progress); `startExtraction` streams progress (D-03 needs visible "pin forming").
   - What's unclear: whether the team wants ALL paths to flow through the queue (purest D-05 reuse) at the cost of D-03 feedback, or a hybrid.
   - Recommendation: hybrid — auto case uses direct `addLink`+`startExtraction`+navigate; linger case (D-02) uses `enqueuePendingLink(url, null)`. This satisfies both D-03 and D-05's "preserve the queue infra" (queue still owns the offline/no-board path). Planner to confirm.

2. **Provider vs direct listener for the read.**
   - What we know: `ShareIntentProvider`+`useShareIntentContext` is library-blessed; D-05 rejected "B안 (useShareIntent/ShareIntentProvider full integration)".
   - What's unclear: whether "full integration" meant "let the hook drive navigation/receive" (which we still avoid) vs "never import the provider at all."
   - Recommendation: use the provider strictly as a payload *reader* in the handler; do not use its auto-reset/auto-navigation behaviors. Document the boundary so it's clearly not B안. Confirm with user during planning if ambiguous.

3. **Dedup key.** Should dedup be `(url)` or `(url+nonce)`? The nonce changes per share, so two genuine shares of the same URL would both be valid. Recommend dedup only against the *currently-being-handled* fire (clear-after-read), not a persistent url set, to allow re-sharing the same URL later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-share-intent | payload read | ✓ (installed + prebuilt) | 7.0.0 | — |
| expo-router native-intent | deep-link intercept | ✓ | 56.2.10 | — |
| @gorhom/bottom-sheet | D-04 picker | ✓ (used by pin-sheet) | installed | — |
| iOS Simulator (`pnpm sim`) | dev iteration | assumed ✓ | — | EAS dev build |
| EAS dev build | device share-sheet UAT | external (Phase 13 gate) | — | none — share-sheet cannot be exercised in simulator reliably |

**Missing dependencies with no fallback:** Real share-sheet UAT requires a device EAS build (simulator can't fully exercise third-party share sheets). The bridging *logic* is testable in-process without it (see Validation Architecture).

**Missing dependencies with fallback:** None blocking dev — all JS deps installed; no prebuild needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (preset `jest-expo`) [VERIFIED: apps/ios/jest.config.js] |
| Config file | `apps/ios/jest.config.js` |
| Quick run command | `pnpm --filter @moajoa/ios test -- pending share-routing` |
| Full suite command | `pnpm --filter @moajoa/ios test` |

> Pattern for native-touching code: mock `@/lib/shared-defaults` with the in-memory map at `apps/ios/__mocks__/shared-defaults.ts`, mock `@moajoa/api` (`addLink`/`triggerExtraction`/`listMyBoards`). [VERIFIED: __tests__/pending.test.ts:1-23]

### Phase Requirements → Test Map
| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01 | routing decision (0/1/2+ boards, authed/not) | unit (pure) | `pnpm --filter @moajoa/ios test -- share-routing` | ❌ Wave 0 (`__tests__/share-routing.test.ts`) |
| D-02 | logged-out / 0 boards → enqueue(url, null) lingers | unit | `pnpm --filter @moajoa/ios test -- share-handler` | ❌ Wave 0 (mock-based) |
| D-05 | webUrl extraction from parsed share payload | unit | `pnpm --filter @moajoa/ios test -- share-payload` | ❌ Wave 0 (feed `parseShareIntent` fixture JSON) |
| D-05 | enqueue bridges into existing pending_links | unit | reuse `__tests__/pending.test.ts` + new handler test | ⚠️ partial (pending covered; bridge new) |
| D-03 | auto case calls startExtraction + navigates | unit | mock `extraction-store` + `expo-router` `router` | ❌ Wave 0 |
| native-intent | `redirectSystemPath` returns `/share-handler` for share path, passthrough otherwise | unit (pure, mock `getShareExtensionKey`) | `pnpm --filter @moajoa/ios test -- native-intent` | ❌ Wave 0 |
| D-04 | picker → select → add + navigate | manual-only (UI/gesture) | device/sim manual | n/a — UAT |
| end-to-end | real share sheet → app → pin | manual-only | EAS device build UAT | n/a — UAT (Pitfall: simulator can't) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @moajoa/ios test -- <touched file>` (e.g. `share-routing`).
- **Per wave merge:** `pnpm --filter @moajoa/ios test` (full iOS suite) + `pnpm --filter @moajoa/ios typecheck`.
- **Phase gate:** full suite green + manual device UAT (share from YouTube → 1-board auto-navigate; 2-board picker; logged-out linger) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `apps/ios/lib/share-routing.ts` + `apps/ios/__tests__/share-routing.test.ts` — pure `decideShareRoute` (covers D-01/D-02).
- [ ] `apps/ios/__tests__/share-payload.test.ts` — feed `parseShareIntent` weburl/text fixtures, assert `webUrl` extraction.
- [ ] `apps/ios/__tests__/native-intent.test.ts` — mock `getShareExtensionKey`, assert redirect vs passthrough.
- [ ] `apps/ios/__tests__/share-handler.test.ts` — mock api/extraction-store/router; assert enqueue + branch behavior (D-02/D-03/D-05 bridge).
- [ ] (no framework install needed — Jest + jest-expo already configured.)

## Security Domain

> `security_enforcement` key absent in config → treated as enabled. Scope is iOS client wiring; threat surface is minimal but the inbound URL is untrusted external input.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (read) | Routing depends on `supabase.auth.getSession()`; logged-out path must NOT add to any board (D-02). |
| V3 Session Management | no | No new session handling. |
| V4 Access Control | yes | `addLink` goes through existing RLS (`can_edit_board`); handler must not bypass it (use `@moajoa/api`, anon key only — CLAUDE.md §4.4). |
| V5 Input Validation | yes | The shared `webUrl` is untrusted external input → Zod-validate it's an `http(s)` URL before enqueue (CLAUDE.md §4.5: external input always Zod). `detectSourceKind` then classifies. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for {Expo iOS deep-link + App Group}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/garbage deep link path to `redirectSystemPath` | Tampering | `path` "not guaranteed valid" — guard with `getShareExtensionKey()` check, try/catch, fallback `/`; never `eval`/navigate to attacker-controlled route. |
| Injected non-URL text in share payload | Tampering / Input | Zod-validate `webUrl` is http(s); drop/ignore non-URL text (activation rules already limit, but validate). |
| Replay of stored App Group payload (re-fire) | — (dup, not security-critical) | `clearShareIntent` after read + dedup guard. |
| Service-role key exposure | Info Disclosure | N/A — client uses anon key only; no Edge change (CLAUDE.md §5). |

## Sources

### Primary (HIGH confidence)
- `node_modules/expo-share-intent@7.0.0` build output — `ExpoShareIntentModule.d.ts` (`getShareIntent`/`clearShareIntent`/`hasShareIntent`, `onChange` event), `utils.js` (`getShareExtensionKey` = `${scheme}ShareKey`, `parseShareIntent`), `useShareIntent.js` (read-via-onChange mechanism), `ExpoShareIntentModule.types.d.ts` (IosShareIntent payload shape).
- docs.expo.dev/router/advanced/native-intent — `redirectSystemPath({ path, initial })` signature, "outside your app … no auth/route context", "do not crash, always return a path".
- Codebase: `apps/ios/lib/pending.ts`, `lib/shared-defaults.ts`, `lib/extraction-store.ts`, `app/_layout.tsx`, `app/index.tsx`, `app/boards/[id].tsx`, `components/boards/pin-sheet.tsx`, `packages/api/src/queries/boards.ts`, `packages/core/src/constants.ts`, `apps/ios/jest.config.js`, `__tests__/pending.test.ts`.
- npm registry: `expo-share-intent` latest = 7.0.0 (verified 2026-06-17).

### Secondary (MEDIUM confidence)
- github.com/achorein/expo-share-intent example `expo-router/app/+native-intent.ts` — redirect pattern (`path.includes(\`dataUrl=${getShareExtensionKey()}\`)` → `/shareintent`). Verified via WebFetch; pattern consistent with installed lib's `getShareExtensionKey`.
- Phase 3 RESEARCH (`03-RESEARCH.md`) — App Group drift / silent-nil pitfall, drain concurrency.

### Tertiary (LOW confidence)
- General WebSearch on native-intent examples (Evan Bacon demo, Expo issue #32725) — corroborating only; not relied on for the contract.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps installed + version-verified; payload API read from installed source.
- Architecture (native-intent = redirect, handler = read/route): HIGH — Expo docs + library source agree native-intent has no app context and read is event-based. The two-piece decomposition is the only viable form of D-05's "A안".
- Pitfalls: HIGH — drawn from Expo docs + this codebase's own documented gotchas (pin-sheet, pending, App Group drift).
- Validation: HIGH — existing Jest/jest-expo + mock pattern directly reusable.

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable; expo-share-intent 7 + expo-router 56 are current SDK 56 line)
