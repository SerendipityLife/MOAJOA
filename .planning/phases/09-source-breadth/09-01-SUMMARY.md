---
phase: 09-source-breadth
plan: 01
subsystem: edge-function/extract pipeline
tags: [source-adapter, ssrf, instagram, claude-prompt, deno]
requires: []
provides:
  - "SourceContent interface + SourceContentSchema (Zod) + FetchImpl seam"
  - "assertFetchableUrl SSRF guard (pure, offline-testable)"
  - "fetchInstagramContent graceful-failure adapter (SRC-02)"
  - "claude.ts optional sourceKind param (youtube byte-identical default)"
affects:
  - "Plan 02 (blog.ts) consumes SourceContent + assertFetchableUrl + FetchImpl"
  - "Plan 03 (index.ts source-router) passes sourceKind to claude.ts + calls adapters"
tech-stack:
  added: []
  patterns: ["normalized source adapter", "injectable fetch seam", "SSRF deny-list guard", "prompt regression snapshot"]
key-files:
  created:
    - supabase/functions/extract-youtube/pipeline/source.ts
    - supabase/functions/extract-youtube/pipeline/source.test.ts
    - supabase/functions/extract-youtube/pipeline/instagram.ts
    - supabase/functions/extract-youtube/pipeline/instagram.test.ts
  modified:
    - supabase/functions/extract-youtube/pipeline/claude.ts
    - supabase/functions/extract-youtube/pipeline/claude.test.ts
decisions:
  - "assertFetchableUrl strips IPv6 brackets from URL.hostname before range matching (Deno retains brackets)"
  - "fetchInstagramContent is async so the spec'd throw rejects (assertRejects contract) rather than throwing synchronously"
  - "bodyLabel string includes the trailing colon so youtube line stays byte-identical and Article body:/Caption: literals appear in source for grep acceptance"
metrics:
  duration: ~5m
  completed: 2026-06-08
  tasks: 3
  files: 6
requirements: [SRC-02]
---

# Phase 9 Plan 01: Source-Adapter Foundation Summary

Shared `SourceContent` contract + `assertFetchableUrl` SSRF guard, the SRC-02 graceful-failure Instagram adapter, and an optional `sourceKind` param on `claude.ts` that keeps the YouTube prompt byte-identical (SHA-256 verified). Foundation for Plan 02 (blog.ts) and Plan 03 (index.ts source-router).

## What Was Built

### Task 1 — source.ts contract + SSRF guard (commit 36214bb)
- `SourceContent` interface + `SourceContentSchema` (Zod, `npm:zod@3`) — adapters Zod-validate output per CONTEXT.
- `FetchImpl = typeof fetch` injectable seam for offline adapter tests.
- `assertFetchableUrl(rawUrl): URL` — pure SSRF guard (threat T-09-01): rejects non-`http(s)` schemes, `localhost`, and IP literals in `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (incl. metadata `169.254.169.254`), `::1`, `fc00::/7`, `fe80::/10`. No DNS — string/regex only.
- `source.test.ts`: 11 tests (schema accept/reject + all SSRF-reject cases via `assertThrows`).

### Task 2 — instagram.ts graceful-failure adapter / SRC-02 (commit 8402be2)
- `fetchInstagramContent(_url, _fetchImpl = fetch): Promise<SourceContent>` throws explicit `instagram: 자동 추출 미지원 ...` Korean reason — never returns ready.
- Doc comment documents the future Graph-API `instagram_oembed` token path (`INSTAGRAM_OEMBED_TOKEN = <APP_ID>|<APP_SECRET>`); none provisioned now.
- `_fetchImpl` param kept for signature parity with blog.ts (Plan 02).
- `instagram.test.ts`: 2 tests (`assertRejects` + Korean `instagram:` message via `assertStringIncludes`).

### Task 3 — claude.ts optional sourceKind / youtube regression 0 (commit 529549b)
- `ExtractInputs.sourceKind?: 'youtube' | 'blog' | 'instagram'` (default `'youtube'`).
- `buildPrompt` exported; branches ONLY (a) body label `Transcript:` → `Article body:` (blog) / `Caption:` (instagram), and (b) the timestamp-guidance constraint line (dropped/softened for non-youtube).
- **SYSTEM_PROMPT byte-identical for all sourceKinds** — not made sourceKind-aware, wording untouched (per W1 checker warning). The residual "include the timestamp" line in SYSTEM_PROMPT is tolerated for blog/insta (source_timestamp_sec schema-optional).
- `LLMOutput`/`PlaceCandidate` schema + `source_quote` grounding rules unchanged.
- `claude.test.ts`: +4 tests incl. the youtube regression-0 snapshot (byte-equality of `buildPrompt(FIXTURE)`); existing 5 LLMOutput tests still green.

## Verification

- `deno test supabase/functions/extract-youtube/pipeline/ --allow-net --allow-read --allow-env` → **28 passed, 0 failed** (source 11, instagram 2, claude 9, youtube 6).
- `deno check supabase/functions/extract-youtube/pipeline/*.ts` → clean.
- **Youtube prompt byte-identical:** SHA-256 of `buildPrompt(FIXTURE)` = `a2f01e65b5039948c15d7cd08d3d5722a97ee8c78428d031fe2c83cfaa8873d9` for BOTH the original (HEAD) `buildPrompt` and the new one → confirmed byte-for-byte. Snapshot regression test asserts the same in CI.
- **SYSTEM_PROMPT byte-identical:** diff of the `SYSTEM_PROMPT` string vs HEAD shows only a line-number shift (doc comment added above `buildPrompt`); the string body is character-for-character identical.
- `grep -rn "from './*.js'" pipeline/` → none (no `.js` import extensions).
- No migration created (source_kind pre-exists per CONTEXT evidence #1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] IPv6 bracket handling in assertFetchableUrl**
- **Found during:** Task 1 (`::1` reject test failed).
- **Issue:** Plan assumed `URL.hostname` strips IPv6 brackets; Deno retains them (`new URL('http://[::1]/x').hostname` === `'[::1]'`), so the IPv6 range checks never matched.
- **Fix:** Strip leading/trailing brackets (`.replace(/^\[|\]$/g, '')`) before IPv6 matching.
- **Files:** source.ts
- **Commit:** 36214bb

**2. [Rule 1 - Bug] fetchInstagramContent must be async to reject**
- **Found during:** Task 2 (GREEN — both `assertRejects` tests failed).
- **Issue:** A non-`async` function that throws synchronously throws at call-time inside `assertRejects`' synchronous portion, so it is not treated as a rejection.
- **Fix:** Declared the function `async` so the throw produces a rejected promise (matches the plan's `Promise<SourceContent>` return type and `assertRejects` behavior).
- **Files:** instagram.ts
- **Commit:** 8402be2

**3. [Rule 3 - Blocking] bodyLabel includes trailing colon**
- **Found during:** Task 3 (acceptance greps for `Article body:` / `Caption:` failed because labels lacked the colon and `Transcript:` only appeared as `${bodyLabel}:`).
- **Issue:** Putting the colon in the template (`${bodyLabel}:`) meant the literal acceptance strings never appeared in source.
- **Fix:** Moved the colon into each label literal and used `${bodyLabel}` in the template. Youtube output stays `Transcript:` (byte-identical, re-verified by hash); `Article body:`/`Caption:` literals now present in source.
- **Files:** claude.ts
- **Commit:** 529549b

## TDD Gate Compliance

Tasks 2 and 3 are `tdd="true"`. RED was observed for both:
- Task 2 RED: instagram test failed with `TS2307 Cannot find module './instagram.ts'`, then failed `assertRejects` until the function was made async (GREEN).
- Task 3 RED: the regression snapshot + blog/instagram tests were written against the new `buildPrompt` signature; existing tests stayed green throughout.

Test and impl for each TDD task were committed together in a single `feat` commit (the test file imports the impl module, so type-check requires both present). RED was demonstrably observed in the live test runs before GREEN. No separate `test(...)` commit was created — noted here for gate transparency.

## Notes for Downstream Plans

- Plan 02 `blog.ts`: import `SourceContent`, `SourceContentSchema`, `FetchImpl`, `assertFetchableUrl` from `./source.ts` (no `.js`). Call `assertFetchableUrl(url)` BEFORE any fetch; `SourceContentSchema.parse(...)` on output.
- Plan 03 `index.ts` router: pass `sourceKind: link.source_kind` into `extractCandidatesFromContext`; feed adapter `bodyText` via the existing `transcript` field. Keep the youtube branch identical (regression 0).

## Self-Check: PASSED
- FOUND: source.ts, source.test.ts, instagram.ts, instagram.test.ts
- FOUND commits: 36214bb, 8402be2, 529549b
