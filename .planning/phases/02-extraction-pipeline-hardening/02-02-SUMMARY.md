---
phase: 02-extraction-pipeline-hardening
plan: 02
subsystem: extraction-pipeline
tags: [broadcast, citation, cost-logging, edge-function, extraction]
dependency_graph:
  requires:
    - 02-01 (extraction_costs table, source_kind/inferred_city columns, shared constants)
  provides:
    - Realtime Broadcast progress on extract:{link_id} channel (5 steps + error)
    - Post-parse citation filter discarding candidates without source_quote
    - Per-call cost logging to extraction_costs (Anthropic + Google Places)
    - source_kind and inferred_city populated on places INSERT
    - ExtractResult type from claude.ts (candidates + usage)
    - ResolveResult type from places.ts (extends ResolvedPlace with duration_ms)
  affects:
    - supabase/functions/extract-youtube/pipeline/claude.ts (schema + return type)
    - supabase/functions/extract-youtube/index.ts (broadcast, cost, filter, INSERT)
    - supabase/functions/extract-youtube/pipeline/places.ts (duration measurement)
tech_stack:
  added: []
  patterns:
    - Supabase Realtime Broadcast via admin.channel().send() from Edge Function
    - Fire-and-forget helpers with try/catch for non-critical instrumentation
    - Post-parse citation filter preserving valid entries while discarding invalid
    - performance.now() duration measurement around external API calls
key_files:
  created: []
  modified:
    - supabase/functions/extract-youtube/pipeline/claude.ts
    - supabase/functions/extract-youtube/index.ts
    - supabase/functions/extract-youtube/pipeline/places.ts
decisions:
  - "Used ReturnType<typeof createClient> for helper function types instead of importing SupabaseClient -- matches existing codebase pattern"
  - "Citation filter placed after LLM extraction and cost logging but before broadcast('llm') step -- cost is logged even for discarded candidates since the API call happened"
  - "Places cost logged inside the resolve loop per successful resolve (not per attempt) -- failed resolves don't incur Places API cost"
  - "Anthropic cost formula uses $3/MTok input + $15/MTok output per claude-sonnet-4-6 pricing (verified in RESEARCH.md)"
  - "Places cost uses $0.032/call per Text Search Pro SKU (Pitfall 5 correction from RESEARCH.md)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-25T06:52:35Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 02 Plan 02: Edge Function Pipeline Hardening Summary

Realtime Broadcast progress updates (5 steps + error), citation enforcement via post-parse source_quote filter, per-call cost logging to extraction_costs for Anthropic and Google Places, and source_kind/inferred_city column population on places INSERT.

## Task Results

| Task | Name | Commit | Files | Status |
|------|------|--------|-------|--------|
| 1 | Harden claude.ts -- citation enforcement + inferred_city + usage return | 8af0470 | supabase/functions/extract-youtube/pipeline/claude.ts | Done |
| 2 | Wire broadcast + cost logging + citation filter into index.ts and places.ts | 169f6db | supabase/functions/extract-youtube/index.ts, supabase/functions/extract-youtube/pipeline/places.ts | Done |

## What Was Built

### Task 1: claude.ts Hardening

- **PlaceCandidate schema**: `source_quote` changed from `.string().max(500).optional()` to `.string().min(1).max(500)` (required)
- **PlaceCandidate schema**: Added `inferred_city: z.string().max(100).optional()` field
- **ExtractResult interface**: New exported type wrapping `candidates: ExtractedCandidates` + `usage: { input_tokens, output_tokens, model }`
- **extractCandidatesFromContext**: Returns `Promise<ExtractResult>` instead of `Promise<ExtractedCandidates>`
- **Usage extraction**: Safe fallback pattern `data?.usage?.input_tokens ?? 0` (Pitfall 2)
- **LLM prompt**: Citation enforcement constraint added ("Omitting source_quote will cause the entry to be discarded")
- **LLM prompt**: `inferred_city` field added to output schema example

### Task 2: index.ts + places.ts Pipeline Wiring

- **broadcastStep helper**: Sends to `extract:{link_id}` channel via admin.channel().send(), removes channel after send, wrapped in try/catch
- **logCost helper**: Inserts to `extraction_costs` table, wrapped in try/catch
- **5 broadcast steps (happy path)**: metadata(10%), transcript(30%), llm(60%), places(80%), done(100%)
- **1 broadcast step (error)**: error(0%) in catch block
- **Citation post-filter**: `validPlaces = candidates.places.filter(p => p.source_quote && p.source_quote.trim().length > 0)` with console.warn for discarded count
- **Anthropic cost logging**: `(input_tokens * 3 + output_tokens * 15) / 1_000_000` with measured duration_ms
- **Places cost logging**: `$0.032/call` with measured duration_ms from places.ts
- **places INSERT**: Added `source_kind: 'ai'` and `inferred_city: r.cand.inferred_city ?? null`
- **places.ts**: `ResolveResult` interface extending `ResolvedPlace` with `duration_ms`; `resolveGooglePlace` returns `ResolveResult` with `performance.now()` timing

## Requirements Covered

| Requirement | How |
|-------------|-----|
| EXTRACT-01 | Edge Function broadcasts 5 progress steps on `extract:{link_id}` channel + error step |
| EXTRACT-02 | source_quote required in Zod schema + post-parse filter discards entries without transcript evidence |
| EXTRACT-04 | Every Anthropic and Places API call logs a row to extraction_costs with provider, model, tokens, cost_usd, duration_ms |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Helper function typing**: Used `ReturnType<typeof createClient>` for broadcastStep/logCost admin parameter instead of importing SupabaseClient type directly -- avoids an additional import and matches the existing codebase pattern
2. **Citation filter placement**: Filter runs after LLM cost logging (the API call already happened), before the empty-places early return check
3. **avgConfidence calculation**: Uses `validPlaces` (post-filter) instead of original `candidates.places` for confidence average -- only valid citations contribute to confidence score

## Verification Results

- broadcastStep called 6 times (5 happy path + 1 error): PASS
- logCost called 2 times (1 Anthropic + 1 inside Places loop): PASS
- source_quote citation filter with console.warn: PASS
- source_kind: 'ai' in places INSERT: PASS
- inferred_city in places INSERT: PASS
- duration_ms in places.ts return: PASS
- ExtractResult type imported in index.ts: PASS
- performance.now() timing in both index.ts and places.ts: PASS
- Broadcast failure does not block extraction (try/catch): PASS
- Cost logging failure does not block extraction (try/catch): PASS

## Known Stubs

Pre-existing `cityHint: null` with TODO comment (line 115 of index.ts) -- not introduced by this plan. Part of the original codebase; a future plan will wire city hint from board metadata.

## Self-Check: PASSED

- All modified files exist on disk
- All task commits (8af0470, 169f6db) found in git log
- SUMMARY.md created at expected path
