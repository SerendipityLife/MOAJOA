---
phase: 09-source-breadth
plan: 03
subsystem: edge-function
tags: [source-router, extract-youtube, blog, instagram, claude]
requires: ["09-01", "09-02"]
provides: ["source-router", "blog-auto-extract", "instagram-explicit-fail"]
affects: ["supabase/functions/extract-youtube/index.ts"]
requirements: [SRC-01, SRC-02]
tech-stack:
  added: []
  patterns: ["switch-on-source_kind router", "normalized SourceContent contract", "explicit-fail-via-existing-catch"]
key-files:
  created: []
  modified:
    - supabase/functions/extract-youtube/index.ts
decisions:
  - "Pre-gate KNOWN_SOURCES set rejects manual/null/unknown BEFORE any fetch (SSRF allowlist, T-09-01); switch default is unreachable belt-and-suspenders."
  - "Blog description = leading 300-char bodyText excerpt (checker W2) to preserve recall past claude's 12k-char transcript slice."
metrics:
  duration: ~6m
  completed: 2026-06-08
---

# Phase 9 Plan 3: index.ts Source-Router Summary

Replaced the youtube-only gate in `extract-youtube/index.ts` with a `switch (link.source_kind)` router that dispatches youtube/blog/instagram to the matching Plan-01/02 adapter, normalizes to `SourceContent`, and feeds the result into the unchanged downstream (claude → Google Places → upsert → broadcast → revalidate). YouTube path is byte-for-byte the original logic (regression 0). Function name, channel, and ResponseBody contract unchanged.

## What changed

- **Imports added** (no `.js` extensions): `fetchBlogContent` from `./pipeline/blog.ts`, `fetchInstagramContent` from `./pipeline/instagram.ts`, `type SourceContent` from `./pipeline/source.ts`.
- **Gate replaced** (~L88): the `link.source_kind !== 'youtube'` reject became a `KNOWN_SOURCES = {youtube, blog, instagram}` allowlist check. manual/null/unknown reject with the same `400 cannot auto-extract source_kind=…` WITHOUT a fetch (T-09-01 mitigation).
- **Source switch** (inside `try`, after "Mark processing"): produces `content: SourceContent`, `description: string`, `sourceKind`.
  - `case 'youtube'`: `normalizeYouTubeUrl` → `fetchYouTubeMetadata` → broadcast metadata 10 → `fetchYouTubeTranscript(meta.videoId)` → broadcast transcript 30. `content = {title, bodyText: transcript, thumbnail, author, externalId: videoId}`, `description = meta.description`, `sourceKind = 'youtube'`. **Unchanged behavior.**
  - `case 'blog'`: broadcast metadata 10 → `await fetchBlogContent(link.url)` (its internal `assertFetchableUrl` runs first) → broadcast transcript 30. `description = content.bodyText.slice(0,300)` (W2), `sourceKind = 'blog'`.
  - `case 'instagram'`: `await fetchInstagramContent(link.url)` throws an explicit Korean reason → falls through to the existing catch (L278-287) → `extraction_status='failed' + extraction_error`. Never ready.
  - `default`: 400 (unreachable — pre-gate already filtered).
- **claude call**: now `videoTitle: content.title, description, transcript: content.bodyText, cityHint, sourceKind`.
- **Downstream link-update fields** (manual_review branch + ready branch): `meta.*` → `content.*` (`title`, `thumbnail_url: content.thumbnail`, `author_name: content.author`, `external_id: content.externalId ?? null`). Everything else (citation filter, Google Places resolve, places upsert, summary_ko, revalidate webhook, cost log) untouched.

## How the youtube path stayed unchanged (regression 0)

The youtube `case` calls the identical fetchers in the identical order, broadcasts the identical steps (`metadata` 10, `transcript` 30), and passes `meta.description` to claude. `extractCandidatesFromContext` receives `sourceKind: 'youtube'` which `claude.ts` (Plan 01) treats as its default — prompt is byte-identical. The 36 existing pipeline tests (incl. youtube + claude prompt-snapshot) pass unchanged.

## W2 applied (checker warning)

For the **blog** branch, `description` is set to the leading 300 chars of `content.bodyText` rather than `''`. Rationale: `claude.ts` slices `transcript` to ≤12000 chars; long blog posts can push place-dense intro text out of that window. A leading excerpt in `description` (which claude slices to 4000 chars, separate budget) preserves recall (RESEARCH Pitfall 5 / checker W2). Blog `videoTitle` maps to `content.title` via the shared claude call.

## Deviations from Plan

**1. [Rule 2 — defense-in-depth] Pre-gate KNOWN_SOURCES set kept the early reject in addition to the switch default.**
- **Found during:** Task 1, removing the youtube-only gate.
- **Issue:** The plan said "REMOVE the gate" and rely on `default:` 400. But the switch sits *inside* the `try` (after "Mark processing"), so an unknown source_kind would mark the link `processing` before rejecting — and a `return` inside the switch leaves the link stuck in `processing`. The original gate rejected *before* the processing mark.
- **Fix:** Kept an early `KNOWN_SOURCES` allowlist check at the original gate location (before the processing mark) so manual/null/unknown reject cleanly with no state mutation and no fetch. The switch `default:` is retained as an unreachable belt-and-suspenders for exhaustiveness. Net behavior matches the plan intent (manual/null never fetched, explicit 400) and strengthens the T-09-01 allowlist.
- **Files modified:** index.ts
- **Commit:** 2aa5847

## Verification

- `deno check index.ts` — clean (no new type errors; pre-existing unused `ExtractResult` import left per Karpathy §3.3, not my orphan).
- `deno test pipeline/ --allow-net --allow-read --allow-env` — **36 passed | 0 failed** (youtube regression 0 + blog + instagram + source).
- grep acceptance: `switch (link.source_kind)` ✓, `fetchBlogContent` ✓, `fetchInstagramContent` ✓, `sourceKind` ✓, old gate gone ✓, `description,` in claude call ✓, no `.js` pipeline imports ✓, `normalizeYouTubeUrl`+`fetchYouTubeTranscript` preserved ✓, `cannot auto-extract` ✓.
- Channel `extract:{link_id}` and `ResponseBody` contract unchanged. No migration this phase.
- No live network / Anthropic / Supabase calls made (live extraction = 09-05 morning gate).

## Threat Flags

None — no new network surface beyond the planned blog/instagram adapter dispatch (already in the 09-03 threat_model). The `default`/`KNOWN_SOURCES` gate strengthens T-09-01.

## Self-Check: PASSED
- FOUND: supabase/functions/extract-youtube/index.ts
- FOUND commit: 2aa5847
