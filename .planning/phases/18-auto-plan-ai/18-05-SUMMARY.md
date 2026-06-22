---
phase: 18-auto-plan-ai
plan: 05
subsystem: ios
tags: [ios, plan-tab, realtime, drag-reorder, nativewind, rntl]
requires:
  - "@moajoa/core: PLAN_STEP_KO, PlanStepType, TravelModeType, Place, Trip, planChannelName (18-01)"
  - "@moajoa/api: getPlanByTrip, generatePlan, reorderPlanItem, setTravelMode, moveToPool, moveToDay, setAnchor, setCollaborative, PlanWithItems (18-04)"
  - "generate-plan Edge Function broadcasting plan:{trip_id} progress (18-03)"
  - "apps/ios/lib/realtime.ts: subscribeExtractProgress sibling idiom"
  - "apps/ios/components/boards: place-list.tsx, step-indicator.tsx, pin-sheet.tsx (card/progress/sheet idioms)"
provides:
  - "subscribePlanProgress(tripId, cb) + PlanProgress (lib/realtime.ts; trip-scoped plan:{trip_id} broadcast sub)"
  - "filled plan.tsx States A-F: empty / pre-gen button / generating progress / draft itinerary / editing / error"
  - "components/plan/plan-item-row.tsx (PlanItemRow + LegPill): place row with drag handle + 필수 star + 제거 + leg pill"
  - "components/plan/day-section.tsx (DaySection + DayItem): Day N header + hand-rolled long-press drag reorder"
  - "components/plan/unplaced-pool.tsx (UnplacedPool): 미배치 section + 일정에 추가 affordance + coordinateless helper"
  - "components/plan/travel-mode-toggle.tsx (TravelModeToggle): 3-segment 전철/도보/차 toggle"
affects:
  - "Phase 19 (collaborative voting) reuses the 친구와 같이 정하기 flag + share surface set here"
tech-stack:
  added: []
  patterns:
    - "realtime sub sibling: subscribePlanProgress mirrors subscribeExtractProgress (channel via core builder, removeChannel cleanup)"
    - "state machine screen: loaded/generating/error/plan gating renders States A-F (mirror map.tsx load idiom)"
    - "hand-rolled drag: gesture-handler Gesture.Pan().activateAfterLongPress + Reanimated 4 useSharedValue/useAnimatedStyle/runOnJS (zero new dep)"
    - "explicit pool moves: 제거 (moveToPool) / 일정에 추가 (moveToDay) instead of cross-zone drag (D-13)"
key-files:
  created:
    - "apps/ios/components/plan/plan-item-row.tsx"
    - "apps/ios/components/plan/day-section.tsx"
    - "apps/ios/components/plan/unplaced-pool.tsx"
    - "apps/ios/components/plan/travel-mode-toggle.tsx"
    - "apps/ios/__tests__/plan.test.tsx"
  modified:
    - "apps/ios/lib/realtime.ts (appended subscribePlanProgress + PlanProgress)"
    - "apps/ios/__tests__/realtime.test.ts (3 subscribePlanProgress cases)"
    - "apps/ios/app/trip/[id]/(tabs)/plan.tsx (filled States A-F)"
decisions:
  - "DRAG LIBRARY (Open Q1): hand-rolled gesture-handler + Reanimated 4 (zero new dep), NOT react-native-reanimated-dnd and NOT react-native-draggable-flatlist. reanimated-dnd@2.0.0 is peer-compatible (verified npm) but a new native dep cannot be validated without a dev build (sim/device unavailable to the executor); the hand-roll uses installed Reanimated-4-safe primitives and only same-list reorder is needed since placed<->pool is an explicit affordance (D-13)."
  - "Travel-mode change (D-08) persists via setTravelMode then re-invokes generatePlan with the same anchors so the EF re-grounds legs per mode (no dedicated lighter recompute endpoint in v1 scope)."
  - "Regenerate confirm uses Alert.alert (header.tsx idiom) rather than a custom scrim sheet — same destructive copy, less surface."
  - "subscribePlanProgress effect is gated on `generating` (subscribes only during generation); D-01 initial-load useEffect only fetches, never calls generatePlan."
  - "@expo/vector-icons + reanimated + gesture-handler are mocked in plan.test.tsx (not in transform allowlist / need native worklets); drag reorder logic is verified on device (Task 3 UAT), the RNTL test covers the render-state contract."
metrics:
  duration: "~40min"
  completed: "2026-06-22"
  tasks: 3 of 3 (Task 3 device UAT — user-approved 2026-06-22)
  files: 7
---

# Phase 18 Plan 05: iOS Plan Tab (States A–F) Summary

Filled the `plan.tsx` stub with the full Phase 18 plan experience per UI-SPEC States A–F: a user-triggered 플랜 만들기 button (D-01, never auto), a trip-scoped realtime progress card during generation, a rendered draft itinerary (초안 chip, Day sections with adjacent leg pills, a 전철/도보/차 toggle defaulting to 전철, and a 미배치 pool), hand-rolled drag reorder, explicit placed↔pool moves (D-13), a 필수 anchor star (D-10), a 플랜 다시 만들기 overwrite confirm passing anchors (D-11), and a 친구와 같이 정하기 collaborative toggle (D-14, flag + share). All automated iOS tests are green and typecheck is clean; the on-device UAT (Task 3) is a `checkpoint:human-verify` that the executor cannot run and is returned to the user.

## What Was Built

- **`lib/realtime.ts` (appended):** `subscribePlanProgress(tripId, onProgress): RealtimeChannel` + `PlanProgress` interface. Mirrors `subscribeExtractProgress` — subscribes to `plan:{trip_id}` (via the core `planChannelName` builder), passes the broadcast `msg.payload` through, returns the channel for `supabase.removeChannel` cleanup. `subscribeExtractProgress` is untouched (git diff = import line + appended block only).
- **`plan.tsx` (filled):** state machine over `loaded / generating / error / plan`:
  - **State A** (no places) — the shipped stub kept verbatim (아직 플랜이 없어요 + 링크를 공유해 시작하기). No button.
  - **State B** (places, no draft) — 장소가 모였어요 + body + a full-width filled brand-500 플랜 만들기 button (≥44px). Tap → `runGenerate([])`.
  - **State C** (generating) — step-indicator-style white rounded-3xl card with `ActivityIndicator #2979FF`, title 플랜을 짜고 있어요, the three `PLAN_STEP_KO` steps (장소 불러오기 → 동선 짜기 → 이동시간 계산) driven by the broadcast, and a disabled 플랜을 짜고 있어요… footer (double-tap guard, Pitfall 5). `subscribePlanProgress` subscribed in a `generating`-gated effect; `done` refetches, `error` → State F; cleanup via `removeChannel`.
  - **State D/E** (draft + editing) — a 초안 stadium chip, a 플랜 다시 만들기 ghost action, the `TravelModeToggle`, ordered `DaySection`s (Day N + date sublabel, drag reorder, leg pills between adjacent rows), the `UnplacedPool` (32px gap + neutral-100 hairline), and the 친구와 같이 정하기 toggle.
  - **State F** (error) — 플랜을 만들지 못했어요… (or 자동 배치할 장소가 없어요… for the no-placeable case) + a 다시 시도 retry.
- **`components/plan/plan-item-row.tsx`** — `PlanItemRow` (place-card mirroring place-list.tsx: white rounded-2xl + ROW_SHADOW + vibe-tinted leading icon + text-sm/600 name + text-xs neutral-500 subtitle) with a `reorder-three` drag handle (≥44px), a 필수 star (filled brand + 필수 tag when set), and a 제거 glyph (#EF4444 → moveToPool). `LegPill` export = brand-50 `{n}분` chip / neutral 이동시간 — when null.
- **`components/plan/day-section.tsx`** — `DaySection` (Day N header + date sublabel) with a hand-rolled `DraggableRow`: `Gesture.Pan().activateAfterLongPress(250)` + Reanimated 4 `useSharedValue`/`useAnimatedStyle`/`runOnJS`; on drop computes a slot delta from `translationY` and calls `onReorder(itemId, toIndex)`. `DayItem` type exported.
- **`components/plan/unplaced-pool.tsx`** — `UnplacedPool`: 미배치 title + helper, a 위치 정보가 없어… line when any place is coordinateless, pool rows with an `add-circle-outline` brand 일정에 추가 affordance (→ moveToDay). Coordinateless `(0,0)` places render without the add button (D-09).
- **`components/plan/travel-mode-toggle.tsx`** — `TravelModeToggle`: 3-segment 전철/도보/차 (default 전철), active = brand-50 tint + brand-600 label + brand glyph; ≥44px segments.
- **Tests:** `realtime.test.ts` +3 cases (channel name `plan:{trip_id}`, payload pass-through, channel identity). `plan.test.tsx` (RNTL): State A empty render, State B button render + no auto-generate, button tap → generatePlan called with `{ trip_id, anchor_place_ids: [] }`, State D 초안 chip + Day 1 header + place name.

## Drag-Library Decision (RESEARCH Open Q1)

**Chosen: hand-rolled `react-native-gesture-handler` ~2.31.2 + `react-native-reanimated` ~4.3.1 (both already installed, zero new dependency).**

- `react-native-draggable-flatlist` was rejected outright (Pitfall 3 — Reanimated 2/3, breaks on this Reanimated 4 / New Arch project). It is NOT in `package.json` (verified).
- `react-native-reanimated-dnd@2.0.0` is peer-compatible (verified via `npm view`: reanimated ≥4.2.0, gesture-handler ≥2.28.0, worklets ≥0.7.0, RN ≥0.80.0 — all satisfied). RESEARCH recommends it for `pnpm sim`/EAS, but its README marks cross-list dragging as roadmap and the executor cannot run a dev build (sim/device unavailable) to validate a newly-linked native module — an unvalidated new native dep is a runtime-crash risk jest (native-mocked) would not catch.
- The hand-roll only needs **same-list (in-day) reorder**, because placed↔pool is an explicit affordance (제거 / 일정에 추가), not cross-zone drag (D-13). This is the simpler of the two drag surfaces and uses primitives RESEARCH confirms are Reanimated-4-safe and installed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jest could not import `@expo/vector-icons` / Reanimated 4 / gesture-handler in plan.test.tsx**
- **Found during:** Task 2 (RNTL test run)
- **Issue:** `@expo/vector-icons` ships untranspiled ESM not in the jest `transformIgnorePatterns` allowlist (`SyntaxError: Cannot use import statement outside a module`); Reanimated 4 / worklets throw `Native part of Worklets doesn't seem to be initialized` at import time under jest.
- **Fix:** Added scoped `jest.mock` for `@expo/vector-icons` (Ionicons → string stub), `react-native-reanimated` (minimal `default.View` + identity worklet hooks), and `react-native-gesture-handler` (no-op Gesture.Pan chain + pass-through GestureDetector) inside `plan.test.tsx`. Drag reorder LOGIC is verified on device (Task 3 UAT); the RNTL test covers the render-state contract (A/B/D + the generatePlan call). Scoped to the test file — no change to global `jest-setup.ts` (avoids touching the passing 12-suite baseline).
- **Files modified:** apps/ios/__tests__/plan.test.tsx
- **Commit:** b461d05

### Plan-scope choices documented (not deviations)
- Travel-mode change re-invokes `generatePlan` (no separate lighter recompute endpoint in v1) — see decisions.
- Regenerate confirm uses `Alert.alert` (one of the two UI-SPEC-permitted idioms) rather than a custom scrim sheet.

## Known Stubs

None that block the plan's goal. The draft itinerary, pool, toggle, anchors, and collaborative flag are all wired to live `@moajoa/api` queries. (Leg recompute on a single drag is deferred to the next regenerate per D-07 — a documented design choice, not a stub.)

## Verification

- `cd apps/ios && pnpm test -- --watchman=false` → **13 suites / 79 tests PASS** (includes realtime: 6, plan: 4).
- `cd apps/ios && pnpm typecheck` → **exit 0** (clean).
- D-01 confirmed: initial-load `useEffect` only fetches; `generatePlan`/`runGenerate` are reachable only from button presses + the regenerate confirm (RNTL test asserts no generatePlan on mount).
- `react-native-draggable-flatlist` absent from package.json (grep = 0).
- Required plan.tsx strings present: 플랜 만들기, 플랜을 짜고 있어요…, 초안, subscribePlanProgress, generatePlan, removeChannel, 다시 만들기, 친구와 같이 정하기.

## Deferred: Device/Sim UAT (Task 3 — checkpoint:human-verify)

PLAN-01..05 require a physical-device/sim run (`pnpm --filter @moajoa/ios sim`) the executor cannot perform. The code and automated tests are complete and committed; the on-device UAT (button → realtime progress → draft render; drag reorder; 제거/일정에 추가; 필수 + regenerate; mode toggle leg recompute; collaborative share) is returned to the user as a checkpoint. PLAN-01..05 remain Pending until UAT signs off.

## Commits

- `5a454b9` feat(18-05): add subscribePlanProgress realtime subscription
- `cb63909` feat(18-05): add plan components (day-section, item-row, pool, mode-toggle)
- `b461d05` feat(18-05): fill plan.tsx States A-F + RNTL test

## Self-Check: PASSED

All 9 created/modified files exist on disk; all 3 task commits (5a454b9, cb63909, b461d05) present in git log. Tests green (79/79), typecheck exit 0.
