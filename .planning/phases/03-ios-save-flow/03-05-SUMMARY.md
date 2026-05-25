---
phase: 03-ios-save-flow
plan: 05
subsystem: iOS Save Flow (Wave 4 — UI capstone)
tags: [ios, bottom-sheet, realtime, broadcast, manual-pin, gorhom, modal, ui-capstone]
requires:
  - 03-01-SUMMARY.md (jest infra + extractChannelName + APP_GROUP_ID + SharedDefaultsKeys)
  - 03-03-SUMMARY.md (resolve-place Edge Function + ResolvePlace schemas + renamePlace/deletePlace helpers)
  - 03-04-SUMMARY.md (SharedDefaults module + lib/realtime.ts subscribeExtractProgress + lib/toast.tsx showToast)
provides:
  - apps/ios/app/boards/_pin-sheet.tsx PinBottomSheet (D-09 single sheet for AI + manual)
  - apps/ios/app/boards/_pin-add-modal.tsx PinAddModal (D-07 search + D-08 resolve-place + max 5)
  - apps/ios/app/boards/[id].tsx integrated UI (spinner overlay + + 핀 header + marker onPress + Modal wrap)
  - apps/ios/__tests__/realtime.test.ts (3/3 passing — channel name, payload forwarding, removeChannel identity)
affects:
  - apps/ios/package.json (@gorhom/bottom-sheet@^5.2.14 added)
  - apps/ios/app/boards/[id].tsx (surgical extension — preserved existing load(), addLink, FlatList, MapView)
tech-stack:
  added:
    - "@gorhom/bottom-sheet@^5.2.14"
  patterns:
    - "Pitfall 3 NativeWind on BottomSheetView workaround: BottomSheetView inline backgroundStyle + inner View className"
    - "Pitfall 5 broadcast cleanup: supabase.removeChannel(ch) in useEffect return"
    - "D-10 — UI reacts only to 'done' / 'error' steps; no raw 5-stage messages"
    - "D-02 last_board_id mirror to SharedDefaults on each successful addLink"
key-files:
  created:
    - apps/ios/app/boards/_pin-sheet.tsx
    - apps/ios/app/boards/_pin-add-modal.tsx
    - apps/ios/__tests__/realtime.test.ts
  modified:
    - apps/ios/app/boards/[id].tsx
    - apps/ios/package.json
    - pnpm-lock.yaml
decisions:
  - "place.link_id used as source_kind signal in PinBottomSheet (more reliable than places.source_kind column, which Phase 2 inserts may not populate consistently per migration 0004 timing)"
  - "YouTube fallback opens youtube.com search by place name (NOT direct timestamp jump) — explicit Phase 5 follow-up logged below"
  - "min query length 2 chars before debounced resolve-place call (matches PinAddModal UX: avoid noisy 1-char fires)"
  - "results.slice(0, 5) defensive cap on client even though resolve-place Edge Function already caps at 5 (D-07 lock — Edge Function is contract source)"
metrics:
  duration_seconds: 231
  completed_at: "2026-05-26"
  iphone_model: deferred
  ios_version: deferred
real_device_test_status: deferred
n2_sql_rls_test_status: deferred
---

# Phase 3 Plan 05: iOS Save Flow UI Capstone Summary

`@gorhom/bottom-sheet@^5.2.14` installed + `PinBottomSheet` + `PinAddModal` components scaffolded + `boards/[id].tsx` surgically extended with broadcast subscribe spinner overlay, `+ 핀` header modal, and marker-tap bottom sheet — completing the Phase 3 SAVE-01..05 code-complete surface.

## What Shipped

### 1. `@gorhom/bottom-sheet@^5.2.14` installed (apps/ios)

```
apps/ios/package.json: "@gorhom/bottom-sheet": "^5.2.14"
```

Reanimated v4 compatible peer (verified — `>=3.16.0 || >=4.0.0-` against installed `4.1.7`). No peer dep blocker; the two unmet peer warnings (`react-dom`, `@types/react-dom`) are pre-existing and unrelated.

### 2. `apps/ios/app/boards/_pin-sheet.tsx` — PinBottomSheet (D-09)

- `snapPoints={['25%', '50%']}` lock (UI-SPEC §3 exact)
- `enablePanDownToClose`, sheetRef snapToIndex(1) on `place` set, sheetRef.close() on null
- **Source kind detection via `place.link_id !== null`** (not `place.source_kind`) — places.source_kind column from migration 0004 may not be populated consistently for Phase 2 legacy inserts; `link_id` is the reliable contract (manual = link_id null via add_manual_place RPC)
- Actions:
  - **이름 수정** — always visible; inline TextInput (autoFocus + onBlur save) → `renamePlace(supabase, id, trimmed)` → onChanged()
  - **영상에서 위치 보기** — conditional `{isAI && (...)}` — opens `Linking.openURL("https://www.youtube.com/results?search_query=...")` (Phase 5 follow-up — see Trade-offs below)
  - **삭제** — `Alert.alert("핀 삭제", "정말 삭제할까요?", [취소|삭제 destructive])` → `deletePlace(supabase, id)` → onChanged + onClose
- Pitfall 3 workaround: BottomSheetView gets inline `backgroundStyle={{backgroundColor:'#fff'}}` + handleStyle props; all NativeWind className styling lives in the inner `<View className="px-6 pt-2 pb-6 bg-white">`

### 3. `apps/ios/app/boards/_pin-add-modal.tsx` — PinAddModal (D-07/D-08)

- 300ms debounced search via `useEffect` + `setTimeout` + cleanup
- Min query length 2 chars (avoid noisy 1-char fires)
- `supabase.functions.invoke('resolve-place', { body: { query, language: 'ko' } })` → `results.slice(0, 5)` defensive cap
- Empty state copy: "검색 결과가 없어요. 다른 키워드로 시도해 보세요."
- Loading state: ActivityIndicator + "검색 중..."
- Tap result → `addManualPlace(supabase, { board_id, google_place_id })` → "핀 추가됨" toast → onAdded + onClose
- `KeyboardAvoidingView` `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (UI-SPEC §4 lock)
- Korean copywriting fixtures from UI-SPEC §4: "취소" / "핀 추가" header / "장소명, 주소, 지하철역..." placeholder

### 4. `apps/ios/__tests__/realtime.test.ts` — 3/3 PASS

Three unit tests covering Plan 03-04's `subscribeExtractProgress`:

1. Channel name is `extract:{link_id}` (matches Phase 2 broadcast sender)
2. `'broadcast' / event:'progress'` handler forwards `msg.payload` to caller's `onProgress` callback
3. Return value is the same channel reference `supabase.channel(...)` returned, enabling `supabase.removeChannel(ch)` cleanup pattern (Pitfall 5)

Mock pattern: `jest.mock('@/lib/supabase', ...)` BEFORE importing the SUT; fake channel with mockable `on` / `subscribe` chained methods.

### 5. `apps/ios/app/boards/[id].tsx` — Surgical integration

Diff scope (preserved existing): `load()`, `addLink` core call, MapView setup, FlatList list rendering, RefreshControl, URL TextInput + "추가" button, source kind helper text.

Added (all Karpathy §3.3 — directly traced to plan requirements):

- New state: `analyzing: string | null`, `selectedPlace: Place | null`, `addPinOpen: boolean`
- `useEffect([analyzing, load])` subscribing to broadcast progress; cleanup calls `supabase.removeChannel(ch)`
- `mapErrorReason(raw?)` file-scope helper — 4 branches per UI-SPEC §1 lock: transcript / no_place|places_empty / quota|429 / default
- `onAddLink` extended: on success calls `SharedDefaults.set(SharedDefaultsKeys.LastBoardId, id)` (D-02 mirror), sets `analyzing=link.id` for YouTube links, triggerExtraction now has explicit failure path that resets `analyzing` + emits error toast
- Header: `+ 핀` Pressable inserted to right of `board.title` Text; `text-brand-500 text-base`
- Marker: `onPress={() => setSelectedPlace(p)}` wires marker tap to PinBottomSheet
- Spinner overlay: rendered when `analyzing` truthy — absolute inset-0, `backgroundColor: 'rgba(255,255,255,0.7)'`, ActivityIndicator size="large" color="#F97316" (brand-500), "분석 중..." label
- `<PinBottomSheet>` rendered as sibling — driven by `selectedPlace`
- `<Modal animationType="slide" presentationStyle="pageSheet">` wrapping `<PinAddModal>` — visible bound to `addPinOpen`

Done toast: ``${p.places_extracted ?? 0}개 핀 추가됨`` (UI-SPEC §1 fixture).
Error toast: ``분석 실패: ${mapErrorReason(p.error)}`` with kind `'error'`.

## Verification

```bash
$ pnpm --filter @moajoa/ios typecheck
# exit 0 — no errors

$ pnpm --filter @moajoa/ios test
PASS __tests__/realtime.test.ts
PASS __tests__/pending.test.ts
Tests:       9 passed, 9 total
```

All grep acceptance criteria from the plan PASS:
- `"@gorhom/bottom-sheet"` in package.json ✓
- snapPoints `['25%', '50%']` in _pin-sheet ✓
- renamePlace + deletePlace imports + use ✓
- `isAI && (` conditional in _pin-sheet ✓
- `border-danger` + `text-danger` for delete button ✓
- resolve-place call + 300 debounce in _pin-add-modal ✓
- KeyboardAvoidingView ios padding behavior ✓
- subscribeExtractProgress + removeChannel(ch) + PinBottomSheet + PinAddModal + SharedDefaults.set + ActivityIndicator size="large" + 분석 중... + + 핀 + mapErrorReason in [id].tsx ✓
- 4 mapErrorReason branches present (transcript / no_place|places_empty / quota|429 / default) ✓

## Manual UAT Log (Real-Device Scenarios 1-5 + N1 + N2)

**real_device_test_status: deferred** — Auto-mode chained execution. Real device + Apple Maps share sheet + cold launch drain UAT defer to end-of-phase batch (matches Plan 03-02 + 03-04 prior deferred pattern; STATE.md already tracks "iOS native build smoke deferred").

| Scenario | Status | Notes |
|----------|--------|-------|
| SAVE-01 login → boards → detail | deferred | Requires real device + Apple sign-in; covered by Plan 03-04 auth gate restoration |
| SAVE-02 URL → 30s pin (p90 from 3 runs) | deferred | Requires live Edge Function deploy + real network; Phase 6 SQL aggregate is authoritative anyway (D-11) |
| SAVE-03 share sheet 1-tap save | deferred | Requires Share Extension prebuild + paid Apple Developer device-provisioning; Plan 03-02 already deferred this same gate |
| SAVE-04 offline enqueue + drain | partial-deferred | Unit test substitute already PASS (pending.test.ts 6/6 covers retry-budget → failed migration); real cold-launch enqueue path verified at component-level only |
| SAVE-05 + 핀 search → add → rename → delete | deferred | Requires live resolve-place deploy. Code paths verified via typecheck + integration grep — wiring is correct |
| N1 retry > 3 → failed banner | PASS via unit test substitute | `pending.test.ts` "drain moves entry to failed queue when retry_count > 3" — covered in Plan 03-04 (RED→GREEN); preserved here |
| N2 RLS denial (SQL substitute test) | **deferred** | `supabase login` not authenticated in this session; CLI cannot reach a live project. The Plan 03-03 RLS contract already passes through `can_edit_board()` SECURITY DEFINER helper (verified in 0001/0002 migrations); end-of-phase UAT batch will run the `set_config('request.jwt.claim.sub', '<other-uuid>', true)` substitute test against the live project |

**n2_sql_rls_test_status: deferred** — supabase CLI not authenticated in current session (`Access token not provided`). End-of-phase UAT pass will run the SQL substitute test against the live `serendipitylife/moajoa` project and record exact error code 42501 + policy name. Until then, RLS enforcement relies on the static contract: `places.insert` policy → `can_edit_board(board_id)` SECURITY DEFINER helper → `EXISTS (membership where user_id = auth.uid() AND board_id = ...)`.

## Decisions Made

- **link_id (not source_kind) used to detect AI vs manual pins.** Migration 0004 added `places.source_kind` but Phase 2 INSERT paths may have predated that and not all rows have it populated; `link_id IS NULL` is the binary reliable signal for manual pins (add_manual_place RPC leaves it null). Cleaner code path with no risk of legacy data showing wrong sheet button visibility.
- **YouTube fallback = search results URL, not direct timestamp jump.** `place.source_timestamp_sec` exists in the schema but we don't have `link.url` on `place` row directly. v1 opens `youtube.com/results?search_query={name}` so the user has *some* way to verify AI-inferred locations. Phase 5 follow-up below.
- **Min query length 2 chars before resolve-place fires.** Avoids 1-char noise (and Google API spend) without making the modal feel laggy. UI-SPEC didn't lock this — researcher discretion.
- **Defensive `results.slice(0, 5)` cap on client.** D-07 caps at 5 server-side (resolve-place Edge Function `maxResultCount: 5`) but the client cap is cheap defense-in-depth against future Edge Function regressions.

## Deviations from Plan

**None — plan executed as written.**

The plan included a TS type fix during initial test authoring (TS7022 self-referencing `ch` object). Resolved by lifting the `FakeChannel` interface declaration and switching from inline `on:jest.fn(handler)` to `on:jest.fn()` + `.mockImplementation(...)` after object creation. This is a test-authoring style adjustment, not a deviation from plan intent.

## Phase 3 Closing Notes — Revisit in Phase 5

### Trust UI deferrals from this plan (logged for Phase 5)

1. **"영상에서 위치 보기" opens youtube.com search results, not direct timestamp jump.** The current implementation in `_pin-sheet.tsx`:
   ```ts
   Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(place.name_local)}`)
   ```
   To do a true timestamp jump we need `link.url` + `place.source_timestamp_sec`. PinBottomSheet currently receives `Place` only — Phase 5 should either:
   - extend the data load to join `place.link_id → link.url` and pass `link.url` as a prop, OR
   - introduce a `place_with_link` view that denormalizes the source url + timestamp.
   Then construct `https://youtube.com/watch?v={id}&t={source_timestamp_sec}s`. Phase 5 Trust UI scope explicitly owns "in-app YouTube timestamp player" — that's where the proper implementation lands.

2. **5-step progress messages (D-10 deferred).** Phase 3 spinner shows only "분석 중..." — Phase 5 Trust UI surfaces the metadata / transcript / llm / places progress per UI-SPEC §1 "Phase 5 lock for trust UI". The `subscribeExtractProgress` handler already receives all 5 steps via `ExtractProgress.step`; UI just ignores them in Phase 3.

3. **Low-confidence pin shading.** UI-SPEC §"Color" deferred "Manual 핀 vs AI 핀의 시각 차별화 색(점선·옅은 색)" to Phase 5. Currently both pins use default MapKit red. Phase 5 Trust UI will use `place.confidence` (Phase 2 schema) to dim < 0.7 markers + add the "확정" / "추정" badge.

### Plan 03-02/03-04/03-05 batched real-device UAT

End-of-Phase 3 UAT pass should run:

1. `pnpm --filter @moajoa/ios prebuild --clean` (re-prebuild — Plans 03-02 + 03-04 added native modules; 03-05 added @gorhom/bottom-sheet which has native code)
2. `cd apps/ios/ios && pod install` (CocoaPods sync for both expo-share-intent and gorhom/bottom-sheet)
3. `pnpm --filter @moajoa/ios ios --device`
4. Walk through `docs/manual-uat-phase3.md` scenarios 1-5
5. SQL substitute test for N2 (via `supabase` CLI once authenticated, or direct SQL Editor in Supabase Dashboard)
6. Record on STATE.md / dedicated UAT log

### Phase 3 SAVE-* requirements coverage

- **SAVE-01 (auth gate → boards → detail):** Plan 03-04 restored D-13 auth gate; this plan extends boards/[id].tsx — code path complete, real-device verification deferred.
- **SAVE-02 (URL → 30s pin):** subscribe + spinner + done toast complete; p90 measurement via Phase 6 SQL aggregate is authoritative (D-11) so no client-side timing instrumentation needed here.
- **SAVE-03 (share-sheet save):** Plan 03-02 wired expo-share-intent config plugin; this plan added the `last_board_id` mirror that Share Extension reads.
- **SAVE-04 (offline drain):** Plan 03-04 drainPendingLinks + AppState wiring + N1 retry-budget covered.
- **SAVE-05 (manual pin CRUD):** This plan completes the UI — PinAddModal for create, PinBottomSheet for rename/delete; Plan 03-03 added the underlying renamePlace/deletePlace/addManualPlace helpers + resolve-place Edge Function.

## Self-Check: PASSED

- ✓ `apps/ios/app/boards/_pin-sheet.tsx` exists
- ✓ `apps/ios/app/boards/_pin-add-modal.tsx` exists
- ✓ `apps/ios/__tests__/realtime.test.ts` exists
- ✓ `apps/ios/app/boards/[id].tsx` modified
- ✓ `apps/ios/package.json` declares `"@gorhom/bottom-sheet": "^5.2.14"`
- ✓ Commit `bb70256` (Task 1) exists in git log
- ✓ Commit `aa20be7` (Task 2) exists in git log
- ✓ `pnpm --filter @moajoa/ios typecheck` exit 0
- ✓ `pnpm --filter @moajoa/ios test` 9/9 pass
- ✓ Real-device + N2 SQL UAT explicitly documented as deferred with reason
