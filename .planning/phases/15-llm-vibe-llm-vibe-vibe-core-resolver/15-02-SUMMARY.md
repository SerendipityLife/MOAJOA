---
phase: 15-llm-vibe-llm-vibe-vibe-core-resolver
plan: 02
subsystem: extraction (supabase edge function)
status: complete
tags: [llm, vibe, category, extract-youtube, edge-function]
requires: []
provides:
  - "PlaceCandidate.vibe optional enum (6 canonical keys) in claude.ts"
  - "prompt emits a per-place vibe bucket"
  - "map-link places borrow a vibe from same-named LLM candidate"
  - "places.category insert = primaryType ?? vibe ?? null"
affects:
  - supabase/functions/extract-youtube/pipeline/claude.ts
  - supabase/functions/extract-youtube/pipeline/claude.test.ts
  - supabase/functions/extract-youtube/index.ts
tech-stack:
  added: []
  patterns:
    - "local enum duplicated from @moajoa/core Vibe (Deno can't import workspace pkg)"
    - "name-normalized lookup map to borrow vibe across resolution paths"
key-files:
  created: []
  modified:
    - supabase/functions/extract-youtube/pipeline/claude.ts
    - supabase/functions/extract-youtube/pipeline/claude.test.ts
    - supabase/functions/extract-youtube/index.ts
decisions:
  - "D4: LLM assigns vibe in the single existing Claude call — zero added API cost"
  - "D3: places.category = primaryType ?? vibe ?? null (Google type wins for text-search, vibe key for map-link)"
  - "D5: no confidence gating on vibe — it's color only"
  - "vibe enum defined locally in claude.ts (Deno standalone), kept in sync with core Vibe by comment"
metrics:
  duration: ~10m code+tests; deploy + UAT 2026-06-15
  completed: yes
---

# Phase 15 Plan 02: LLM vibe in extraction pipeline Summary

Gave the YouTube extraction Edge Function a coarse `vibe` per place at zero added API cost: the existing Claude call now emits one of 6 canonical vibe keys per place, map-link places (which aren't LLM candidates) borrow a vibe by normalized-name match, and the insert stores `places.category = primaryType ?? vibe ?? null` so previously-grey map-link cards get a color.

## What was built

**Task 1 — vibe field + prompt + regression snapshot (`feat 01f692b`)**
- Added `vibe: z.enum(['food','cafe','nature','culture','shopping','other']).optional()` to `PlaceCandidate` with a "keep in sync with @moajoa/core Vibe" comment (Deno can't import the workspace package).
- Added a `"vibe"` line to the prompt output schema (adjacent to `inferred_city`) and one constraint line describing the 6 buckets.
- Updated the `YOUTUBE_PROMPT_REGRESSION_0` snapshot byte-for-byte and added 3 parse tests (valid vibe → kept, omitted → undefined, out-of-set `'bar'` → throws, covering threat T-15-03).
- `deno test pipeline/claude.test.ts`: 12 passed / 0 failed.

**Task 2 — map-link vibe borrow + category insert (`feat 86d2052`)**
- Built `llmVibeByName` (Map<normalizedName, vibe>) from `validPlaces` (keyed on both `name_local` and `name_ko`), once, before the seed loop.
- Each map-link seed sets `cand.vibe = llmVibeByName.get(normalizeName(mlp.name)) ?? (mlp.label ? llmVibeByName.get(normalizeName(mlp.label)) : undefined)`. No match → undefined (resolver → 'other').
- Insert row changed to `category: r.place.primaryType ?? r.cand.vibe ?? null`. Text-search entries already carry the full LLM `cand` (with `.vibe`), so they keep their richer Google primaryType automatically.
- `place.primaryType: null` for map-link seeds left unchanged — vibe lives on `cand`, not `place`.
- `deno check index.ts`: no new type errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deno test flag `--allow-none` rejected by Deno 2.8**
- **Found during:** Task 1 verification
- **Issue:** The plan's verify command `deno test pipeline/claude.test.ts --allow-none` fails — `--allow-none` is not a valid argument in Deno 2.8.0 (`error: unexpected argument '--allow-none' found`).
- **Fix:** Ran `deno test pipeline/claude.test.ts` (no flag); the suite needs no special permissions. 12/12 pass.
- **Files modified:** none (verification command only).
- **Commit:** n/a

## Checkpoint Status — PASSED (2026-06-15)

**Task 3 (`checkpoint:human-verify`, gate=blocking) is COMPLETE.**
- Deployed: `supabase functions deploy extract-youtube` → version 78 ACTIVE (project xfoauhsraguyrifingct).
- Live UAT (iOS sim): extracted a short 도쿄 맛집 video → 13 new places, link "분석 완료". New place cards render category colors — 🍴 맛집(amber) for 라멘/우동/꼬치집, ☕ 카페(brown) for 멍커피 — with Korean labels + addresses + ▶timestamps. placeVibe coloring confirmed end-to-end.
- Note: an earlier test video (ah1GfjuSxkM) returned 0 places → manual_review (content/transcript issue, unrelated to this change). A transiently-stuck "분석중" spinner was a client-side realtime miss (in-memory extraction store didn't receive the terminal broadcast), cleared on app relaunch — not a server hang.

## Known Stubs

None. (The borrowed-vibe map yields `undefined` on no-match, which is the intended D4 fallback, not a stub.)

## Self-Check: PASSED

- All 3 modified files exist.
- Both commits (01f692b, 86d2052) present in git log.
- `vibe` present in claude.ts (3 matches) and index.ts (6 matches).
