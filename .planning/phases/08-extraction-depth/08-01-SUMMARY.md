---
phase: 08-extraction-depth
plan: 01
subsystem: contract-layer
tags: [migration, zod-schema, view-type, summary_ko]
requires: []
provides:
  - "places.summary_ko / links.summary_ko nullable text columns (migration 0008, NOT yet applied)"
  - "public_board_view RPC re-issued with summary_ko in both links + places jsonb objects"
  - "PlaceSchema/LinkSchema nullable summary_ko; ExtractedPlaceCandidateSchema optional summary_ko; LLMExtractionOutputSchema video_summary_ko optional"
  - "PublicBoardView Pick unions extended with summary_ko (links + places)"
affects:
  - "08-02 backend pipeline (writes against these schemas)"
  - "08-03 web render (reads view.places[i].summary_ko / view.links[i].summary_ko)"
  - "08-04 autonomous:false gate (applies migration 0008 + regenerates database.ts)"
tech-stack:
  added: []
  patterns: [".nullable() persisted vs .optional() candidate idiom", "explicit jsonb field list (no select *)", "explicit Pick opt-in to anon surface"]
key-files:
  created:
    - supabase/migrations/0008_extraction_summaries.sql
  modified:
    - packages/core/src/schemas/place.ts
    - packages/core/src/schemas/link.ts
    - packages/core/src/schemas/extraction.ts
    - packages/core/src/types/index.ts
decisions:
  - "extraction.ts carries ONLY video_summary_ko; place-level summary flows in via ExtractedPlacesPayloadSchema.shape (no duplication) — per 08-PATTERNS §5"
metrics:
  tasks: 3
  files_changed: 5
  completed: 2026-06-08
---

# Phase 8 Plan 01: Extraction Depth Contract Layer Summary

Lays the type + storage contract for place/video Korean commentary: migration 0008 adds two nullable `summary_ko` columns and re-issues `public_board_view` with the new field in both jsonb objects, and the shared `@moajoa/core` Zod schemas + `PublicBoardView` type opt into `summary_ko`. No runtime behavior — migration apply + types regen are deferred to the 08-04 gate. `packages/core` typecheck is green; migrations 0001–0007 are byte-unchanged.

## What Changed Per File

- **supabase/migrations/0008_extraction_summaries.sql** (NEW): Header comment block (0007 tone) explaining why nullable/backward-compatible and why the RPC must be re-issued. Part 1: `alter table places add column summary_ko text;` + `alter table links add column summary_ko text;`. Part 2: full `create or replace function public_board_view(p_slug text)` copied verbatim from 0006:25-90, with `'summary_ko', l.summary_ko` appended after `author_name` in the links jsonb and `'summary_ko', p.summary_ko` appended after `confidence` in the places jsonb. `security definer` / `set search_path = public` / `stable` / `grant execute ... to authenticated, anon` preserved. 0006 Parts 3-4 (trigger/backfill) NOT copied.
- **packages/core/src/schemas/place.ts**: `PlaceSchema.summary_ko: z.string().max(500).nullable()` after `source_quote`; `ExtractedPlaceCandidateSchema.summary_ko: z.string().max(500).optional()` after candidate `source_quote`.
- **packages/core/src/schemas/link.ts**: `LinkSchema.summary_ko: z.string().max(800).nullable()` after `author_name`.
- **packages/core/src/schemas/extraction.ts**: `LLMExtractionOutputSchema.video_summary_ko: z.string().max(800).optional()` (video-level TL;DR only; place-level summary arrives via `...ExtractedPlacesPayloadSchema.shape`).
- **packages/core/src/types/index.ts**: `'summary_ko'` added to the `Pick<Link, ...>` union and the `Pick<Place, ...>` union of `PublicBoardView`. The links Pick was reformatted from one-line to a multi-line union to accommodate the added member.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `91fcb69` | feat(08-01): 0008 마이그레이션 — summary_ko 컬럼 2개 + public_board_view RPC 재발행 |
| 2 | `307f4de` | feat(08-01): Zod 스키마에 summary_ko 추가 (place/link/extraction) |
| 3 | `c347837` | feat(08-01): PublicBoardView Pick 유니온에 summary_ko 추가 (links + places) |

## Verification Results

- `cd packages/core && npx tsc --noEmit` → exit 0 (after Task 2 and Task 3).
- `grep -c "'summary_ko'" supabase/migrations/0008_extraction_summaries.sql` → 3 (2 in jsonb objects + 1 in an inline comment; criterion was ≥ 2).
- `grep -c "'summary_ko'" packages/core/src/types/index.ts` → 2 (links Pick + places Pick).
- `grant execute on function public_board_view(text) to authenticated, anon` present; `security definer` present; `profiles_create_first_board` absent.
- Migrations 0001–0007: `git status --porcelain` empty — append-only respected.
- No `.js` extension on any workspace import.

## Deviations from Plan

**1. [Reformatting — within surgical scope] links Pick union split to multi-line.**
- **Found during:** Task 3.
- **Issue:** The plan/interfaces showed the `links` Pick as a single line. Adding `| 'summary_ko'` would have pushed the line past the project's Prettier width, and the existing `places` Pick is already multi-line — so a one-line `links` + multi-line `places` would be inconsistent.
- **Choice:** Reformatted the `links` Pick to the same multi-line union style as `places`. Pure formatting; the only semantic change is the added `'summary_ko'` member. Honors CLAUDE.md §3.3 (match existing style) and the autonomous-mode "safest option" rule.
- **Files modified:** packages/core/src/types/index.ts.
- **Commit:** `c347837`.

**2. [Acceptance-criterion grep count nuance — no code change]**
- The Task 1 criterion `grep -c "'summary_ko'" ... ≥ 2` returns 3 because one of the `-- NEW (Phase 8 ...)` inline comments sits on the same line as a quoted token is not the case — the 3rd match is the second jsonb line's quoted token plus... clarification: the two `'summary_ko'` jsonb entries match, and a third match comes from the comment text only if it contained the quoted form. Actual count is 3 and ≥ 2 holds. No action needed; recorded for transparency.

Otherwise the plan executed exactly as written.

## Deferred (out of this plan's scope — 08-04 autonomous:false gate)

- **Migration 0008 is NOT applied.** No `supabase db push` was run (requires a live Supabase connection / `SUPABASE_ACCESS_TOKEN`, which is the 08-04 gate, not this plan).
- **`packages/api/src/types/database.ts` is NOT regenerated.** `pnpm supabase:types` is deferred to 08-04. The monorepo build does not depend on the applied column because the web reads through the hand-maintained `PublicBoardView` Pick type, not the generated db types.

## Self-Check: PASSED

- FOUND: supabase/migrations/0008_extraction_summaries.sql
- FOUND: packages/core/src/schemas/place.ts (summary_ko nullable + optional)
- FOUND: packages/core/src/schemas/link.ts (summary_ko nullable)
- FOUND: packages/core/src/schemas/extraction.ts (video_summary_ko optional)
- FOUND: packages/core/src/types/index.ts (2× summary_ko)
- FOUND commit 91fcb69, 307f4de, c347837 in git log.
