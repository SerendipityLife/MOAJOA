---
phase: 02-extraction-pipeline-hardening
plan: 01
subsystem: extraction-pipeline
tags: [migration, schema, constants, rls, extraction]
dependency_graph:
  requires: []
  provides:
    - extraction_costs table (service-role only cost logging)
    - places.source_kind column (ai/manual distinction)
    - places.inferred_city column (LLM-inferred city)
    - EXTRACT_CHANNEL_PREFIX constant (Realtime Broadcast channel naming)
    - PlaceSourceKind constant (mirrors DB CHECK)
    - ExtractionStep constant (broadcast progress steps)
  affects:
    - supabase/functions/extract-youtube (will consume new table + constants in 02-02)
    - packages/api/src/types/database.ts (needs regeneration via pnpm supabase:types)
tech_stack:
  added: []
  patterns:
    - append-only migration with IF NOT EXISTS for idempotency
    - RLS enabled with no permissive policies (service-role-only table)
    - as const arrays with derived types for shared domain constants
key_files:
  created:
    - supabase/migrations/0004_extraction_hardening.sql
  modified:
    - packages/core/src/constants.ts
decisions:
  - "Used lowercase SQL keywords to match existing migration style (0001_init.sql pattern)"
  - "ADD COLUMN IF NOT EXISTS for idempotency in case of partial migration re-runs"
  - "ExtractionStep includes 'error' as a terminal step alongside 'done' for complete progress broadcast coverage"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-25T06:45:42Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 01: DB Migration + Shared Constants Summary

Schema hardening migration (0004) adding source_kind/inferred_city columns to places and extraction_costs table for per-call cost logging, plus shared TypeScript constants for Realtime Broadcast channel prefix, place source kind, and extraction progress steps.

## Task Results

| Task | Name | Commit | Files | Status |
|------|------|--------|-------|--------|
| 1 | Create migration 0004_extraction_hardening.sql | f2a4bee | supabase/migrations/0004_extraction_hardening.sql | Done |
| 2 | Add extraction constants to @moajoa/core + verify FieldMask | 7f0af3a | packages/core/src/constants.ts | Done |

## What Was Built

### Migration 0004 (Task 1)

- **ALTER places**: Added `source_kind` column (`text NOT NULL DEFAULT 'ai'`, CHECK `('ai', 'manual')`) using `ADD COLUMN IF NOT EXISTS`
- **ALTER places**: Added `inferred_city` column (nullable text) using `ADD COLUMN IF NOT EXISTS`
- **CREATE extraction_costs**: 9-column table (id, link_id, provider, model, input_tokens, output_tokens, cost_usd, duration_ms, created_at) with FK to links(id) ON DELETE CASCADE
- **RLS**: Enabled on extraction_costs with zero permissive policies (service role only access per D-11)
- **Indexes**: `extraction_costs_link_idx` on link_id, `extraction_costs_created_idx` on created_at DESC

### Shared Constants (Task 2)

- `EXTRACT_CHANNEL_PREFIX = 'extract:'` -- prevents Realtime Broadcast channel name mismatch (Pitfall 1 from RESEARCH.md)
- `PlaceSourceKind = ['ai', 'manual'] as const` + `PlaceSourceKindType` -- mirrors DB CHECK constraint
- `ExtractionStep = ['metadata', 'transcript', 'llm', 'places', 'done', 'error'] as const` + `ExtractionStepType` -- broadcast progress step names per D-02

### EXTRACT-05 Verification

Confirmed `supabase/functions/extract-youtube/pipeline/places.ts` FIELD_MASK uses explicit fields only (`places.id,places.displayName,places.formattedAddress,places.location,places.primaryType`). No wildcard `'*'` present.

## Requirements Covered

| Requirement | How |
|-------------|-----|
| EXTRACT-03 | source_kind + inferred_city columns added; existing source_timestamp_sec and source_quote already cover video_offset_sec and quote (per D-07) |
| EXTRACT-04 | extraction_costs table with all D-08 columns, FK, RLS, indexes |
| EXTRACT-05 | FieldMask verified as explicit-only via grep (no wildcard) |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Lowercase SQL keywords**: Matched existing migration style from 0001_init.sql rather than using uppercase SQL (plan verification script expected uppercase `ENABLE ROW LEVEL SECURITY` but plan text said "Follow existing migration style from 0001_init.sql (lowercase SQL keywords)")
2. **IF NOT EXISTS**: Used for both ALTER TABLE ADD COLUMN statements for idempotent re-runs

## Verification Results

- Migration file exists with all required columns, constraints, and indexes
- No wildcard FieldMask in places.ts (EXTRACT-05 confirmed)
- Constants file exports all 3 new constants + 2 new types
- No existing migration files (0001-0003) were modified
- No existing constants were modified or removed
- Pre-existing TypeScript errors (Zod module not installed in worktree) are unrelated to changes

## Self-Check: PASSED

- All created files exist on disk
- All task commits (f2a4bee, 7f0af3a) found in git log
