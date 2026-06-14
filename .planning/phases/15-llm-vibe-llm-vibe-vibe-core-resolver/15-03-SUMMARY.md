---
phase: 15
plan: 03
subsystem: apps/ios + apps/web
tags: [category, vibe, resolver, delegation, taxonomy]
requires:
  - "placeVibe / VIBE_META / Vibe from @moajoa/core (15-01)"
provides:
  - "iOS vibeOf — thin wrapper over core placeVibe; VIBE_STYLE over 6 canonical vibes"
  - "web categoryVisual — thin wrapper over core placeVibe; VIBE_VISUAL over 6 canonical vibes"
affects:
  - "boards.tsx / place-list.tsx (iOS) — source-compatible, unchanged"
  - "vote-island.tsx (web) — source-compatible, unchanged"
tech-stack:
  added: []
  patterns:
    - "Client mappers delegate bucketing to core placeVibe; keep only per-client icon + tint/tone"
    - "Shared color + labelKo pulled from core VIBE_META; icons stay per-client (Ionicons vs lucide)"
key-files:
  created: []
  modified:
    - apps/ios/lib/category.ts
    - apps/web/lib/category-icon.ts
decisions:
  - "iOS cafe entry: Ionicons 'cafe' glyph, coffee tint #F6EEE6 / textOn #6F4218"
  - "web bar→food, lodging→other now collapse via placeVibe (Beer/Building2 buckets removed)"
metrics:
  duration: "~4 min"
  completed: 2026-06-14
  tasks: 2
  files: 2
---

# Phase 15 Plan 03: Client Vibe Mapper Delegation Summary

Replaced the two duplicated, vibe-key-blind client mappers (`vibeOf`, `categoryVisual`) with thin wrappers over the core `placeVibe` resolver, unifying the taxonomy on the 6 canonical vibes (cafe added, wellness/bar/lodging buckets removed) while each client keeps only its own icon library mapping and pulls the shared color/label from core `VIBE_META`.

## What Was Built

- **iOS `apps/ios/lib/category.ts`** — Removed local `RULES` substring table and local `Vibe` type. Now imports `placeVibe, VIBE_META, type Vibe` from `@moajoa/core` (no `.js` extension). `vibeOf(category)` is a thin wrapper returning `placeVibe(category)`. `VIBE_STYLE` rebuilt over exactly the 6 canonical keys: `cafe` added (Ionicons `cafe` glyph, amber coffee tint/textOn), `wellness` dropped. `color` + `labelKo` sourced from `VIBE_META[vibe]`; `textOn`, `tint`, `icon` stay per-client. `VibeStyle` shape (color/textOn/tint/icon/labelKo) preserved so `boards.tsx` and `place-list.tsx` stay source-compatible.
- **web `apps/web/lib/category-icon.ts`** — Removed local `BUCKETS` substring table. Now imports `placeVibe, type Vibe` from `@moajoa/core` (no `.js` extension). `VIBE_VISUAL: Record<Vibe, { icon: LucideIcon; tone: string }>` keyed by the 6 vibes (food→Utensils, cafe→Coffee, nature→TreePine, culture→Landmark, shopping→ShoppingBag, other→MapPin). Orphaned `Beer` (bar) and `Building2` (lodging) lucide imports removed — bar→food, lodging→other now collapse via `placeVibe`. `categoryVisual(category)` returns `VIBE_VISUAL[placeVibe(category)]`, keeping the exact `{ icon, tone }` shape `vote-island.tsx` consumes.

## Verification

- iOS `pnpm typecheck` (tsc --noEmit) — clean. ✓
- web `pnpm typecheck` (tsc --noEmit) — clean. ✓
- Both mappers delegate to `placeVibe`; no local substring tables remain (grep: `RULES`/`BUCKETS` → NONE). ✓
- Caller files (`boards.tsx`, `place-list.tsx`, `vote-island.tsx`) NOT in the diff. ✓
- A bare vibe key like `'cafe'` now resolves to the correct icon/color on both clients (previously fell to grey). ✓
- No `.js` extension on core imports; no orphaned imports; surgical diffs only. ✓

## Deviations from Plan

None — plan executed exactly as written. Both tasks committed in sequence; no auto-fixes required.

## Self-Check: PASSED
