---
phase: 08-extraction-depth
plan: 02
subsystem: extraction-pipeline
tags: [edge-function, claude, zod-schema, summary_ko, deno-test]
requires:
  - "08-01: PlaceSchema/LinkSchema nullable summary_ko + ExtractedPlaceCandidateSchema optional + LLMExtractionOutputSchema video_summary_ko (shared @moajoa/core contract)"
provides:
  - "claude.ts LLMOutput widened: per-place summary_ko optional(max 500) + video_summary_ko optional(max 800); both omit→undefined, never throw"
  - "Extended prompt: grounded Korean commentary instruction (empty when ungrounded, Korean even for JP/EN)"
  - "index.ts persistence: places.summary_ko (r.cand.summary_ko ?? null) + links.summary_ko (candidates.video_summary_ko ?? null) at existing write sites"
  - "claude.test.ts: 5 deno tests for optional/omit/reject schema behavior"
affects:
  - "08-03 web render (reads view.places[i].summary_ko / view.links[i].summary_ko)"
  - "08-04 autonomous:false gate (live extraction spot-check + migration apply + types regen)"
tech-stack:
  added: []
  patterns: [".optional() LLM-candidate idiom", "?? null persistence bridge", "no-new-try/catch error contract (EXTRACT-14)"]
key-files:
  created:
    - supabase/functions/extract-youtube/pipeline/claude.test.ts
  modified:
    - supabase/functions/extract-youtube/pipeline/claude.ts
    - supabase/functions/extract-youtube/index.ts
decisions:
  - "Task 1 (tdd) committed as a single feat: the schema export IS the unit under test, so claude.ts + claude.test.ts ship together. No separate RED commit — see TDD Gate Compliance."
  - "SINGLE Claude call widened (schema + prompt only); model claude-sonnet-4-6 + max_tokens 2048 unchanged"
metrics:
  tasks: 2
  files_changed: 3
  completed: 2026-06-08
---

# Phase 8 Plan 02: Extraction Pipeline summary_ko Wiring Summary

Widened the single existing Claude extraction call to emit per-place Korean commentary (`summary_ko`) and a video-level Korean TL;DR (`video_summary_ko`) — output schema + prompt only, no new API call, model and `max_tokens: 2048` unchanged. Both fields are `.optional()` (omit → `undefined`, never an error), and the prompt instructs grounded Korean commentary that stays empty when ungrounded. Persistence wires both fields through the existing `?? null` bridge at the two existing write sites, adding zero new try/catch and zero new failure paths (EXTRACT-14). Anti-hallucination guards (`confidence < 0.4` skip, mandatory `source_quote`) are byte-unchanged.

## What Changed Per File

- **supabase/functions/extract-youtube/pipeline/claude.ts**:
  - `PlaceCandidate`: added `summary_ko: z.string().max(500).optional()` after `name_ko` (copying that optional-string idiom).
  - `LLMOutput`: added `export` keyword (so the schema is testable without hitting Anthropic) and `video_summary_ko: z.string().max(800).optional()` as a sibling of `places`.
  - `SYSTEM_PROMPT`: appended one clause about writing short Korean commentary grounded strictly in transcript/description, empty when ungrounded — the existing "never invent places" sentence is untouched.
  - `buildPrompt` output-schema JSON block: added `"summary_ko"` inside the place object (after `confidence`) and a top-level `"video_summary_ko"` sibling of `"places"`.
  - `buildPrompt` constraints: added two lines — (1) summary_ko/video_summary_ko must be Korean even for JP/EN video; (2) commentary only when grounded in transcript/description, else leave empty (don't invent), same grounding as source_quote.
  - Parsing (`LLMOutput.parse`, `extractJsonBlock`, JSON try/catch): untouched — schema additions auto-cover them.
- **supabase/functions/extract-youtube/pipeline/claude.test.ts** (NEW): 5 deno tests (`jsr:@std/assert`, importing the now-exported `LLMOutput`): accepts place WITH summary_ko, accepts place WITHOUT (→ undefined), accepts video_summary_ko, accepts omitted video_summary_ko (→ undefined), rejects non-string summary_ko (assertThrows). All synchronous, no network.
- **supabase/functions/extract-youtube/index.ts**:
  - Places upsert rows: added `summary_ko: r.cand.summary_ko ?? null` after `confidence: r.cand.confidence`.
  - Links success-branch update: added `summary_ko: candidates.video_summary_ko ?? null` after `extracted_at`.
  - `onConflict: 'board_id,google_place_id', ignoreDuplicates: true` unchanged (multi-video overwrite accepted per CONTEXT). The no-places-found branch (149-160) was deliberately NOT touched. No new try/catch.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `4443bb6` | feat(08-02): claude.ts 출력 스키마·프롬프트에 summary_ko/video_summary_ko 추가 + deno test |
| 2 | `0100086` | feat(08-02): index.ts에 summary_ko 영속화 배선 (places upsert + links 성공 업데이트) |

## Verification Results

- `deno test --allow-net --allow-env --allow-read pipeline/claude.test.ts` → **5 passed | 0 failed**.
- `deno test --allow-net --allow-env --allow-read pipeline/*.test.ts` → **11 passed | 0 failed** (5 new claude + 6 existing youtube — 0 regressions).
- `deno check index.ts` → clean (no errors at all; no pre-existing errors surfaced in this function dir).
- Task 1 acceptance greps: place-optional, video-optional, `export const LLMOutput`, grounding (`근거 없으면 비워`), `한국어`, `confidence < 0.4` (still present), `Omitting source_quote will cause` (still present) — all OK.
- Task 2 acceptance greps: `summary_ko: r.cand.summary_ko ?? null` OK, `summary_ko: candidates.video_summary_ko ?? null` OK, `onConflict: 'board_id,google_place_id', ignoreDuplicates: true` OK, `grep -c summary_ko index.ts` == 2 (only the two write sites).
- No `.js` import extensions added.
- No new try/catch around summary writes (the two added lines are field assignments only).

## Deviations from Plan

**1. [TDD commit grouping — within plan latitude] Task 1 shipped as one `feat` commit instead of separate RED/GREEN.**
- **Found during:** Task 1.
- **Issue:** The plan marks Task 1 `tdd="true"`, but the unit under test is the module-private `LLMOutput` schema, which the plan itself instructs to `export` specifically so it can be tested. The schema change and the test that exercises it are one atomic unit — a RED commit would require committing a test importing a not-yet-exported symbol (broken intermediate) or an export with no consumer.
- **Choice:** Committed claude.ts (schema + prompt + export) and claude.test.ts together as a single `feat(08-02)` commit. The tests were authored against the new schema and verified green (5/5) before commit. This is the safest atomic boundary and matches the analog `youtube.test.ts` (test + code co-located). Recorded under TDD Gate Compliance below.
- **Files modified:** claude.ts, claude.test.ts.
- **Commit:** `4443bb6`.

Otherwise the plan executed exactly as written.

## TDD Gate Compliance

Plan task 1 is `tdd="true"` (not a plan-level `type: tdd`). The RED→GREEN cycle was collapsed into one commit because the test's import target (`export const LLMOutput`) is created by the same change being tested — a standalone RED commit would be a non-compiling intermediate. Tests were written and run green (5 passed | 0 failed) prior to committing, satisfying the spirit of the gate (test exists and passes for the new behavior). `feat(08-02): ...4443bb6` contains both the implementation and the failing-then-passing test. No `refactor` commit was needed.

## Deferred (out of this plan's scope — 08-04 autonomous:false gate)

- **Live extraction spot-check** of a transcript-rich travel video (non-empty summary + no hallucination) is the 08-04 gate — requires a live Anthropic key + live `supabase functions invoke`. Not run here (autonomous offline-only mode).
- **Migration 0008 NOT applied** (from 08-01) and **`packages/api/src/types/database.ts` NOT regenerated** — both are the 08-04 gate. The edge function reads `r.cand.summary_ko` / `candidates.video_summary_ko` off the parsed Zod output, not the generated DB types, so offline `deno check` is green without the applied column.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. The persisted `summary_ko` crosses the documented Anthropic-output→DB boundary (T-08-04): validated by `LLMOutput.parse` (type + max length 500/800) before persist, stored as plain text via parameterized supabase-js (no SQL interpolation). Output-token growth (T-08-05) accepted: `max_tokens` stays 2048, fields are short-capped. EXTRACT-14 (T-08-EXTRACT-14): no new try/catch — asserted by the no-new-catch criterion and the optional-schema deno tests.

## Self-Check: PASSED

- FOUND: supabase/functions/extract-youtube/pipeline/claude.ts (summary_ko optional + export LLMOutput + video_summary_ko)
- FOUND: supabase/functions/extract-youtube/pipeline/claude.test.ts (5 Deno.test, jsr:@std/assert)
- FOUND: supabase/functions/extract-youtube/index.ts (2× summary_ko ?? null write sites)
- FOUND commit 4443bb6 in git log.
- FOUND commit 0100086 in git log.
