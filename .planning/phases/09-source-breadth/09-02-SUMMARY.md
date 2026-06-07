---
phase: 09-source-breadth
plan: 02
subsystem: edge-function/extract pipeline
tags: [source-adapter, blog, readability, deno-dom, naver, euc-kr, ssrf]
requires:
  - "09-01: SourceContent + SourceContentSchema + assertFetchableUrl + FetchImpl (pipeline/source.ts)"
provides:
  - "fetchBlogContent(url, fetchImpl) — SRC-01 blog text adapter"
  - "toNaverPostView(url) — naver iframe → PostView.naver URL rewrite"
affects:
  - "Plan 03 (index.ts source-router) calls fetchBlogContent for source_kind='blog'; feeds bodyText → claude transcript"
tech-stack:
  added:
    - "npm:@mozilla/readability@0.6.0 (article body extraction)"
    - "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts (WASM DOMParser)"
  patterns: ["normalized source adapter", "injectable fetch seam", "SSRF-guarded fetch", "selector-first-Readability-fallback", "charset-aware decode"]
key-files:
  created:
    - supabase/functions/extract-youtube/pipeline/blog.ts
    - supabase/functions/extract-youtube/pipeline/blog.test.ts
  modified:
    - supabase/functions/extract-youtube/deno.lock
decisions:
  - "deno-dom Document cast uses `as any` (+ deno-lint-ignore) instead of `as unknown as Document` because Deno's default lib has no DOM `Document` type (TS2304); runtime is unaffected"
  - "Tests build a real Response from fixtures (not a hand-rolled stub) so res.text()/arrayBuffer()/headers behave exactly like real fetch"
  - "EUC-KR fixture ships raw bytes (Deno has no EUC-KR encoder) — ASCII tags are byte-identical, Korean word '한글' embedded as C7 D1 B1 DB"
  - "Verification runs from the function dir (where deno.json provides npm dep context); running from repo root fails because the root node_modules forces Deno's package-resolution mode"
  - "Committed the (already-tracked) deno.lock update — pins readability + deno_dom integrity hashes for reproducible Edge deploys"
metrics:
  duration: ~12m
  completed: 2026-06-08
  tasks: 2
  files: 3
requirements: [SRC-01]
---

# Phase 9 Plan 02: Blog Source Adapter Summary

`fetchBlogContent` (SRC-01): fetches a blog page, parses it with deno-dom's WASM `DOMParser`, extracts the article body with `@mozilla/readability`, handles the Naver iframe special-case (URL rewrite to `PostView.naver` + `se-main-container`/`postViewArea` selector chain), defends against EUC-KR mojibake, routes every fetch through the Plan-01 `assertFetchableUrl` SSRF guard, and returns a Zod-validated `SourceContent`. 8 mocked Deno tests green; full pipeline suite (36) green with youtube regression 0.

## What Was Built

### Task 1 — toNaverPostView rewrite + test scaffold (commit 33185ac)
- `toNaverPostView(url): string | null` — detects `blog.naver.com`/`m.blog.naver.com` (via `hostname.endsWith('blog.naver.com')`), prefers existing `blogId`/`logNo` query params, else matches path `/^\/([^/]+)\/(\d+)/` → `https://blog.naver.com/PostView.naver?blogId=<id>&logNo=<no>`; returns `null` for non-naver hosts.
- `blog.test.ts` scaffold with 3 rewrite tests (path form, query form, non-naver → null). All green.

### Task 2 — fetchBlogContent adapter (commit 138ad1a)
- `fetchBlogContent(url, fetchImpl = fetch): Promise<SourceContent>` following the plan's 10-step spec:
  1. `assertFetchableUrl(url)` **FIRST** (SSRF guard T-09-01) — before any fetch.
  2. `toNaverPostView()` rewrite; tracks `isNaver` to select the selector path.
  3. `fetchImpl(target, { headers: browser-UA + ko-KR, signal: AbortSignal.timeout(10_000) })`; throws `blog fetch ${status}` on `!res.ok` (Pitfall 1 / T-09-04).
  4. `decodeBody`: charset-aware — `euc-kr`/`ms949`/`cp949` → `TextDecoder('euc-kr').decode(arrayBuffer())`, else `res.text()` (Pitfall 3).
  5. `DOMParser().parseFromString(html, 'text/html')` (WASM backend).
  6. Reads `og:title`/`og:image`/author meta **before** `Readability.parse()` (parse mutates the DOM).
  7. Naver selector path: `div.se-main-container` → `div#postViewArea` fallback.
  8. Readability fallback (static blogs + naver-empty), cast at the deno-dom/DOM-lib type boundary.
  9. Throws `blog: 본문을 추출하지 못했어요` on empty body → router maps to `extraction_status='failed'`.
  10. `SourceContentSchema.parse({...})` Zod-validates the normalized output.
- Only `textContent` is extracted (never `article.content` HTML) → plain text to Claude (threat T-09-02 mitigation).
- 5 mocked-fetch tests added (static-tistory, naver-SE3, naver-legacy-postViewArea, EUC-KR-no-mojibake, SSRF-reject-before-fetch). 8 total green.

## Verification

- `deno test --allow-net --allow-read pipeline/blog.test.ts` (from function dir) → **8 passed, 0 failed**.
- `deno test --allow-net --allow-read --allow-env pipeline/` → **36 passed, 0 failed** (source 11, instagram 2, claude 9, youtube 6, blog 8). Youtube regression 0.
- `deno check pipeline/blog.ts pipeline/blog.test.ts` → clean.
- Acceptance greps all pass: `assertFetchableUrl`, `se-main-container`, `postViewArea`, `euc-kr`, `AbortSignal.timeout`, `SourceContentSchema.parse` present; no `.js` import extension on workspace/deno-dom imports.
- Import resolution pre-verified live: `deno_dom@v0.1.56` WASM + `@mozilla/readability@0.6.0` download and parse a sample doc successfully.
- No migration created. SSRF guard fires before `mockFetch` (`mock.called === false` asserted in Test 5).
- **NOTE (deferred):** live blog spot-check over the real network (real tistory/naver URLs, Naver geo/header sensitivity per RESEARCH A1) is the Plan 05 morning gate (autonomous:false) — this plan's tests are mocked, no live network hit.

## Threat Model Compliance

| Threat ID | Mitigation in code | Verified |
|-----------|--------------------|----------|
| T-09-01 (SSRF) | `assertFetchableUrl(url)` called first; Test 5 asserts reject before fetch | ✅ grep + test |
| T-09-02 (script injection) | only `textContent` extracted, never `article.content`/innerHTML | ✅ code review |
| T-09-04 (DoS) | `AbortSignal.timeout(10_000)`; downstream 12000-char claude cap | ✅ grep |
| T-09-05 (mojibake) | EUC-KR/MS949 charset-aware decode; Test 4 asserts no `�` | ✅ test |

No new threat surface beyond the plan's `<threat_model>` (server-side fetch of a user URL, already covered by T-09-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Document` type unavailable in Deno default lib**
- **Found during:** Task 2 (`deno check` — TS2304 `Cannot find name 'Document'`).
- **Issue:** The RESEARCH Pitfall-6 pattern `doc as unknown as Document` assumes a DOM-lib `Document` type, but Deno's default type context (no `dom` lib) doesn't define `Document`, so type-check failed.
- **Fix:** Cast to `any` with a `deno-lint-ignore no-explicit-any` directive at the deno-dom→Readability boundary. Runtime behavior identical (deno-dom Document is structurally compatible); this is a types-only seam.
- **Files:** blog.ts
- **Commit:** 138ad1a

**2. [Rule 3 - Blocking] `Response` body typing rejects `Uint8Array` for the EUC-KR fixture**
- **Found during:** Task 2 (`deno check` — TS2345/TS2322; `Uint8Array.buffer` widens to `ArrayBufferLike`/`SharedArrayBuffer`).
- **Issue:** `new Response(uint8Array)` is valid at runtime but the lib type for `BodyInit` doesn't list `Uint8Array`.
- **Fix:** Cast the fixture body `as BodyInit` in the test mock (runtime-valid). Test-only; no production impact.
- **Files:** blog.test.ts
- **Commit:** 138ad1a

### Environment note (not a plan deviation)
- Tests must be run **from the function directory** (`supabase/functions/extract-youtube`) so `deno.json`'s `imports` provide the npm dependency context. Running from repo root fails (`Could not find a matching package … in node_modules`) because the repo's root `node_modules` forces Deno into package-resolution mode. This matches how Plan 01's suite was run. Documented so the Plan 05 gate / verifier uses the right cwd.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Per the same pattern as Plan 01, test + impl for each task were committed together in a single `feat` commit (the test file imports the impl module, so type-check requires both present). RED was observed in live runs before GREEN:
- Task 1: rewrite tests written against `toNaverPostView` and went green once the function matched all three forms.
- Task 2: the adapter tests initially failed `deno check` (the two type errors above = RED), then passed all 8 after the boundary casts (GREEN).
No separate `test(...)` commit was created — noted here for gate transparency.

## Known Stubs

None. `fetchBlogContent` is fully wired (Plan 03 connects it to the index.ts router). Instagram remains the intentional graceful-fail adapter from Plan 01 (SRC-02), unchanged here.

## Notes for Downstream Plans

- Plan 03 `index.ts` router: `case 'blog': content = await fetchBlogContent(link.url); break;` — `fetchBlogContent` already returns the normalized `SourceContent`; feed `content.bodyText` into `extractCandidatesFromContext`'s `transcript` param and pass `sourceKind: 'blog'` (from Plan 01) so the prompt uses the "Article body:" label and drops timestamp guidance.
- A thrown error from `fetchBlogContent` (timeout, !ok, empty body) carries an explicit Korean reason → the existing index.ts catch maps it to `extraction_status='failed' + extraction_error`.
- Plan 05 morning gate: live spot-check of a real tistory + a real naver URL over the network (Naver geo/header sensitivity, RESEARCH A1). If Naver blocks the Edge egress region, fall back to treating naver like instagram (graceful fail) until a proxy is added.

## Self-Check: PASSED
- FOUND: supabase/functions/extract-youtube/pipeline/blog.ts
- FOUND: supabase/functions/extract-youtube/pipeline/blog.test.ts
- FOUND commits: 33185ac, 138ad1a
