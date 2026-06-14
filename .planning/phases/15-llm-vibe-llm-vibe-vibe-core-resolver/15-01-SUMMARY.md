---
phase: 15
plan: 01
subsystem: packages/core
tags: [category, vibe, resolver, taxonomy, tdd]
requires: []
provides:
  - "placeVibe(category) — single canonical vibe resolver"
  - "Vibe type — 6 canonical keys"
  - "VIBE_META — shared color hex + Korean label per vibe"
affects:
  - "15-02 (Edge insert normalizes category against this contract)"
  - "15-03 (iOS vibeOf / web categoryVisual swap to core resolver)"
tech-stack:
  added: []
  patterns:
    - "Pure string→enum resolver with ordered substring rules (cafe before food)"
    - "Color as shared token in core; icons stay per-client"
key-files:
  created:
    - packages/core/src/category.ts
    - packages/core/src/category.test.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - "cafe hex #8D5A2B (amber/coffee) chosen distinct from food #FF8F00 since cafe split out of food"
  - "cafe substring rule ordered before food so coffee/bakery/cafe aren't swallowed"
  - "wellness/onsen/spa/lodging carry no rule → fall through to 'other' default (D1 collapse)"
metrics:
  duration: "~3 min"
  completed: 2026-06-14
  tasks: 2
  files: 3
---

# Phase 15 Plan 01: Core Vibe Resolver Summary

Single canonical `placeVibe()` resolver in `@moajoa/core` mapping both exact vibe keys and Google Places primaryType substrings to 6 canonical vibes (food/cafe/nature/culture/shopping/other), with `VIBE_META` exposing a shared color hex + Korean label per vibe.

## What Was Built

- **`Vibe` type** (D1): exactly `food | cafe | nature | culture | shopping | other`.
- **`placeVibe(category: string | null | undefined): Vibe`** (D2/D3): lowercases input, returns it directly if it is one of the 6 exact vibe keys, otherwise scans ordered substring rules (first hit wins), else defaults to `other`. Case-insensitive; null/empty/undefined → `other`.
- **`VIBE_META`**: `Record<Vibe, { color: string; labelKo: string }>` — surviving vibe colors reused from the old iOS mapper; cafe gets a new amber hex `#8D5A2B` distinct from food `#FF8F00`. Korean labels: 맛집/카페/자연/명소/쇼핑/기타.
- **Barrel re-export**: `export * from './category';` appended to `packages/core/src/index.ts` (no `.js` extension per CLAUDE.md §4.5).

## TDD Cycle

| Gate | Commit | Result |
|------|--------|--------|
| RED  | `1125c4c` test(15-01) | 22 assertions, suite fails (category.ts absent) |
| GREEN| `3dd96b2` feat(15-01) | 22/22 pass, `tsc --noEmit` clean |

REFACTOR: not needed — implementation already minimal.

Tests run via `npx vitest run` in `packages/core` (root has vitest v1.6.1 hoisted; package `pnpm test` is a no-op echo, so vitest was invoked directly per plan guidance).

## Re-bucketing from old iOS taxonomy

The old iOS `vibeOf` had `wellness` (removed) and lacked `cafe` (new). Migration applied:
- `cafe`/`coffee`/`bakery`/`dessert`/`tea` → **cafe** (was food).
- `bar`/`izakaya`/`pub` → **food** (D1).
- `spa`/`gym`/`onsen`/`hot_spring`/`lodging`/`hotel`/`wellness`/`health` → **other** (no rule, falls through).

## Deviations from Plan

None — plan executed exactly as written. Both TDD gates committed in sequence; no auto-fixes required.

## Out-of-Scope Observations (not touched)

At commit time the working tree contained pre-existing/unrelated modifications NOT part of this plan, left untouched per scope boundary:
- `apps/ios/app.config.ts` — dirty before this plan started (initial git snapshot).
- `supabase/functions/extract-youtube/pipeline/claude.ts` and `claude.test.ts` — modified, belong to plan 15-02/15-04 scope (LLM vibe field).
- `.planning/phases/15-.../.gitkeep` — untracked scaffolding.

Only `packages/core/src/category.ts`, `category.test.ts`, and `index.ts` were staged/committed.

## Verification

- `placeVibe` returns one of 6 canonical keys for every input class (vibe key, Google type, null/empty/undefined). ✓
- `cafe` is distinct from `food`; `onsen`/`lodging`/`spa` → `other`. ✓
- Core barrel re-exports `placeVibe`/`VIBE_META`/`Vibe`; `tsc --noEmit` clean. ✓
- No `.js` extension on the barrel import. ✓

## Self-Check: PASSED

- packages/core/src/category.ts — FOUND
- packages/core/src/category.test.ts — FOUND
- 15-01-SUMMARY.md — FOUND
- RED commit 1125c4c — FOUND
- GREEN commit 3dd96b2 — FOUND
- core barrel re-export — FOUND
