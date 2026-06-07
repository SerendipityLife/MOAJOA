# Phase 9: 소스 넓이 (블로그·인스타) - Research

**Researched:** 2026-06-08
**Domain:** Server-side content extraction in Deno (Supabase Edge Function) — generalize YouTube pipeline to blog + Instagram
**Confidence:** HIGH (blog/Deno stack, Instagram verdict) / MEDIUM (Naver PostView direct-fetch — needs one live spot-check, already a deferred morning gate)

## Summary

The existing `extract-youtube` Edge Function is already structured so that the only youtube-specific parts are (1) the source-kind gate at `index.ts:88`, and (2) the metadata+transcript fetch (`pipeline/youtube.ts`). Everything downstream — `extractCandidatesFromContext` (claude.ts), Google Places resolve, places upsert, broadcast, cost log, revalidate webhook, and the `extraction_status='failed' + extraction_error` failure path (`index.ts:278-287`) — is source-agnostic and reusable verbatim. This makes the CONTEXT decision (source-router → per-source text adapter → shared extractor) the correct and minimal shape.

For **blog (SRC-01)**, the standard, Deno-Deploy-compatible approach is `npm:@mozilla/readability` (the same algorithm Firefox Reader View uses) driven by `deno-dom`'s WASM `DOMParser`. This pair is confirmed to run under Deno Deploy and Supabase Edge (npm: imports + WASM are both bundled at deploy time). Tistory/velog/brunch/medium serve static server-rendered HTML, so a single `fetch` → DOMParser → Readability path covers them. **Naver blog** is the one special case: it wraps the post in an iframe, but the iframe target — `https://blog.naver.com/PostView.naver?blogId=<id>&logNo=<no>` — is itself a server-rendered HTML document fetchable with a plain `fetch` (no JS engine needed); the post body lives in `div.se-main-container` (SmartEditor 3) or `div#postViewArea` (legacy). Detect Naver by hostname, rewrite the URL to PostView, then run the same Readability/selector extraction.

For **Instagram (SRC-02)**, the verdict is unambiguous: **there is no reliable no-auth path in 2026.** Basic Display API reached EOL 2024-12-04; `?__a=1`/GraphQL endpoints are blocked/login-walled; oEmbed now requires an app-level access token (`app_id|app_secret`). The CONTEXT decision to ship a graceful explicit-failure path now (SRC-02's own escape hatch) is correct. Implement the IG adapter as a deterministic failure returning a clear `extraction_error`, and document the future token-based oEmbed path.

**Primary recommendation:** Add `pipeline/blog.ts` (fetch → deno-dom WASM `DOMParser` → `@mozilla/readability`, with a Naver PostView URL rewrite + selector fallback) and `pipeline/instagram.ts` (graceful explicit-failure adapter). Replace the youtube gate in `index.ts` with a source-router that maps each adapter to a normalized `{ title, bodyText, thumbnail?, author? }` and feeds `bodyText` into `extractCandidatesFromContext`'s `transcript` param, with one small `sourceKind`-aware prompt tweak. Keep the youtube path byte-for-byte unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Blog HTML fetch + article extraction | API / Edge (Deno) | — | Server-side fetch avoids CORS, hides keys, runs Readability/WASM |
| Naver iframe → PostView rewrite | API / Edge (Deno) | — | URL transform + fetch; pure server logic |
| Instagram caption fetch | API / Edge (Deno) | — | No no-auth path → deterministic failure server-side |
| Place + summary_ko extraction | API / Edge (Deno) → Anthropic | — | Reuse `claude.ts` unchanged (Phase 8) |
| Source detection | Shared (`@moajoa/core`) | client | `detectSourceKind` already used client + server |
| Client trigger gating | Frontend (web dev-tool) | iOS (deferred) | web add-link-form expands trigger; iOS = morning gate |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `npm:@mozilla/readability` | 0.6.0 (publ. 2025-03-03) | Extract main article text + title/byline/excerpt from arbitrary blog HTML | The Firefox Reader View algorithm; de-facto standard for server-side article extraction; framework-agnostic, takes any DOM `Document` [VERIFIED: npm view @mozilla/readability version → 0.6.0] |
| `deno-dom` (WASM backend) | latest (`deno-dom-wasm.ts`) | Provide a `DOMParser`/`Document` for Readability in Deno | Runs under Deno Deploy + Supabase Edge (WASM); native backend does NOT work on hosted runtimes, WASM does [CITED: deno.com manual jsx_dom/deno_dom; github b-fuze/deno-dom] |
| `npm:zod@3` | 3 (already in repo) | Validate each adapter's normalized output `{title, bodyText, ...}` | Already the repo standard; CONTEXT constraint requires Zod adapter-output validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsr:@std/assert` | (already used in tests) | Deno test assertions for adapter unit tests | Mirror `youtube.test.ts` pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `deno-dom` WASM | `npm:linkedom@0.18.12` | linkedom also runs on Deno Deploy and is faster at parse/serialize, but is intentionally NOT spec-compliant; Readability exercises enough DOM surface that the spec-compliant `deno-dom` is the safer default. Keep linkedom as fallback if a `deno-dom` API gap surfaces. [VERIFIED: npm view linkedom version → 0.18.12] [CITED: pkgpulse happy-dom-vs-jsdom-vs-linkedom-2026] |
| `@mozilla/readability` | Manual `og:`/meta + heuristics | Manual is brittle across blog platforms and re-implements what Readability already handles (boilerplate stripping, content scoring). Use og:meta only as a *supplement* for `thumbnail`/`author`, not as the body extractor. |
| Readability for Naver | Direct `se-main-container` / `postViewArea` selector | Naver's SmartEditor markup is regular enough that a direct selector is more reliable than Readability's scoring on Naver's chrome-heavy pages. Recommended: try selector first on Naver, fall back to Readability. |

**Installation:** No `package.json` install — Deno resolves at import. Add to `pipeline/blog.ts`:
```typescript
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
```
> Pin `deno-dom` to a tagged version in the actual import (e.g. `deno-dom@v0.1.x/deno-dom-wasm.ts`) at plan time — `npm view` does not apply to deno.land/x; resolve the current tag during planning. [ASSUMED: exact deno-dom tag — verify at plan time]

**Version verification:** `@mozilla/readability@0.6.0` confirmed current (npm, modified 2025-03-03). `linkedom@0.18.12` confirmed current. `deno-dom` WASM backend confirmed Deno-Deploy-compatible via official Deno manual. [VERIFIED: npm registry; CITED: deno.com manual]

## Architecture Patterns

### System Architecture Diagram

```
                 POST { link_id }
                        │
                        ▼
        ┌───────────────────────────────┐
        │  index.ts: load link row       │
        │  mark extraction_status=        │
        │  'processing'                   │
        └───────────────┬───────────────┘
                        │ link.source_kind
                        ▼
        ┌───────────────────────────────┐
        │      SOURCE ROUTER (new)        │   ← replaces youtube-only gate (L88)
        └───┬──────────┬──────────┬──────┘
            │          │          │
      youtube       blog      instagram
            │          │          │
            ▼          ▼          ▼
   youtube.ts    blog.ts    instagram.ts
   (unchanged)   (NEW)      (NEW, graceful fail)
   meta+         fetch→DOM→  → throw explicit
   transcript    Readability  "instagram: no
            │    Naver: URL   auto-extract path"
            │    rewrite→     │
            │    selector     │
            └────┬─────┴───────┘ (failure → catch → status='failed')
                 ▼
   normalized { title, bodyText, thumbnail?, author? }
                 │  (bodyText → transcript param)
                 ▼
   extractCandidatesFromContext (claude.ts, REUSED)
                 ▼
   Google Places resolve  →  places upsert  →  broadcast/cost/revalidate
                 ▼
   mark links.extraction_status = ready | manual_review | failed
```

### Recommended Project Structure
```
supabase/functions/extract-youtube/
├── index.ts              # source-router replaces youtube gate (L88)
├── pipeline/
│   ├── youtube.ts        # UNCHANGED (regression 0)
│   ├── claude.ts         # +1 optional sourceKind param (youtube default unchanged)
│   ├── places.ts         # UNCHANGED
│   ├── blog.ts           # NEW — fetch→DOMParser→Readability + Naver rewrite
│   ├── instagram.ts      # NEW — graceful explicit-failure adapter
│   ├── blog.test.ts      # NEW — mockable fetch → normalized text
│   └── instagram.test.ts # NEW — asserts explicit-failure contract
```

### Pattern 1: Normalized source adapter
**What:** Every adapter returns the same shape; the router is source-agnostic after that.
**When to use:** All sources.
```typescript
// Normalized output (validate with Zod per CONTEXT constraint)
export interface SourceContent {
  title: string;
  bodyText: string;        // → fed into claude.ts `transcript` param
  thumbnail: string | null;
  author: string | null;
  externalId?: string | null;
}
```

### Pattern 2: Blog extraction (Readability + deno-dom)
**What:** Static-HTML blogs (tistory/velog/brunch/medium).
```typescript
// Source: abeestrada.com/post/deno-readability + mozilla/readability README
import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

const res = await fetch(url, {
  headers: { 'user-agent': 'Mozilla/5.0 (compatible; MoajoaBot/1.0)', 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
  signal: AbortSignal.timeout(10_000),
});
if (!res.ok) throw new Error(`blog fetch ${res.status}`);
const html = await res.text();
const doc = new DOMParser().parseFromString(html, 'text/html');
// Readability MUTATES the doc; clone or parse a fresh doc if you also need og: meta.
const article = new Readability(doc as unknown as Document).parse();
const bodyText = (article?.textContent ?? '').trim();
```
> Read `og:image`/`og:title`/author meta from the DOM **before** calling `Readability.parse()` (it mutates/strips the tree), or parse two documents. [CITED: mozilla/readability README — parse() modifies the DOM]

### Pattern 3: Naver PostView rewrite
**What:** `blog.naver.com/<id>/<no>` and `m.blog.naver.com/...` wrap the post in an iframe whose `src` is `PostView.naver`. Rewrite to the iframe target, which is plain server-rendered HTML fetchable without a browser.
```typescript
// Detect naver host, extract blogId + logNo, hit PostView directly.
function toNaverPostView(url: string): string | null {
  const u = new URL(url);
  if (!u.hostname.endsWith('blog.naver.com')) return null;
  // path form: /<blogId>/<logNo>  OR  query form already present
  const qsBlogId = u.searchParams.get('blogId');
  const qsLogNo = u.searchParams.get('logNo');
  if (qsBlogId && qsLogNo) {
    return `https://blog.naver.com/PostView.naver?blogId=${qsBlogId}&logNo=${qsLogNo}`;
  }
  const m = u.pathname.match(/^\/([^/]+)\/(\d+)/);
  if (!m) return null;
  return `https://blog.naver.com/PostView.naver?blogId=${m[1]}&logNo=${m[2]}`;
}
```
Then fetch the PostView URL and extract from `div.se-main-container` (SE3) with `div#postViewArea` (legacy) fallback; only fall through to Readability if both selectors are empty.
```typescript
const body =
  doc.querySelector('div.se-main-container')?.textContent ??
  doc.querySelector('div#postViewArea')?.textContent ??
  null;
```
**Confidence:** MEDIUM. The PostView endpoint serving full HTML to a plain client is well-established, but Naver actively varies behavior by headers/geo. Send `accept-language: ko-KR` and a browser-like UA. **Live spot-check is required** and is already the deferred morning gate (CONTEXT `deferred`: 라이브 blog/insta 추출 스팟체크). [CITED: scrapfly.io how-to-scrape-naver — selectors `se-main-container`/`postViewArea`, `Accept-Language: ko-KR` header]

### Pattern 4: Instagram graceful failure (SRC-02)
**What:** No reliable no-auth caption path exists. Fail explicitly so the link lands in `extraction_status='failed'` with an actionable reason.
```typescript
// instagram.ts
export async function fetchInstagramContent(_url: string): Promise<SourceContent> {
  // Future: oEmbed with app token →
  //   GET https://graph.facebook.com/v23.0/instagram_oembed?url=<post>&access_token=<APP_ID|APP_SECRET>
  // Requires Meta app + oEmbed Read feature. Not available now → explicit fail.
  throw new Error(
    'instagram: 자동 추출 미지원 (무인증 캡션 접근 불가). 캡션을 직접 입력하거나 큐레이션 대기열로 처리하세요.',
  );
}
```
> If a best-effort `og:` meta scrape of the public post page is desired, attempt it but treat partial/empty as failure — do NOT silently mark `ready` with no places. The router's existing `catch` already maps thrown errors to `status='failed' + extraction_error` (index.ts:278-287). [VERIFIED: index.ts catch block]

### Anti-Patterns to Avoid
- **Feeding raw HTML to Claude:** strip to text first; the 12000-char `transcript` cap (`claude.ts:134`) would otherwise be consumed by markup.
- **Using deno-dom native backend:** only the WASM backend (`deno-dom-wasm.ts`) runs on hosted Supabase/Deno Deploy.
- **Reading og: meta after Readability.parse():** parse() mutates the DOM; read meta first.
- **Silent IG success:** never return `ready` with zero body — must be explicit failure (SRC-02 contract).
- **Touching the youtube branch:** CONTEXT requires regression 0; the router must dispatch youtube to the *unchanged* youtube.ts path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Main article extraction from arbitrary blogs | Custom DOM-scoring / readability clone | `@mozilla/readability` | Boilerplate removal, content scoring, byline/excerpt — years of edge cases (ads, nav, comments) |
| HTML → DOM in Deno | Regex/string parsing of HTML | `deno-dom` WASM `DOMParser` | Regex HTML parsing breaks on nested/malformed markup; Readability needs a real `Document` |
| Instagram caption no-auth | `?__a=1`/GraphQL scraping | (nothing — graceful fail) | Endpoints are login-walled/blocked in 2026; scraping violates ToS and breaks constantly |
| Source detection | New hostname switch | `detectSourceKind` (`@moajoa/core`) | Already exists, already used at insert time; reuse keeps client/server in sync |

**Key insight:** The entire downstream (LLM extraction, Places, upsert, status transitions) already exists and is source-agnostic. The phase is 90% *plumbing a new text source into a proven pipeline* and 10% blog-HTML-extraction, not building an extraction pipeline.

## Runtime State Inventory

This is a generalize/refactor phase touching a deployed Edge Function, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `links.source_kind` already allows `'blog'`/`'instagram'` (migration 0001:227); existing rows already stamped via `addLink`. No data migration. | None — verified by reading 09-CONTEXT evidence #1, #3 |
| Live service config | Deployed function name `extract-youtube` is invoked by clients via `functions.invoke('extract-youtube')`. CONTEXT decision B keeps the name. No redeploy-rename. | Redeploy function with new internal code; name unchanged |
| OS-registered state | None — Edge Function, no OS scheduler/process state. | None |
| Secrets/env vars | New optional future secret for IG: none required now (graceful fail). `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_SERVER_KEY` already set and reused. No new required secret. | None now; document `INSTAGRAM_OEMBED_TOKEN` (app_id\|app_secret) as future |
| Build artifacts | Edge function bundles npm:/WASM at deploy. New `npm:@mozilla/readability` + `deno-dom` WASM will be bundled on next `supabase functions deploy`. | Deploy step pulls new deps; confirm bundle size OK |

**Phase-8 dependency:** `summary_ko` column must be live (08-04 morning gate) before blog extraction can persist summaries — already noted in CONTEXT constraints, not a new finding.

## Common Pitfalls

### Pitfall 1: fetch hang / no timeout
**What goes wrong:** A slow or hanging blog server stalls the function until platform timeout.
**Why:** `fetch` has no default timeout.
**How to avoid:** `signal: AbortSignal.timeout(10_000)` on every external fetch; map abort → thrown error → `status='failed'`.
**Warning signs:** Functions sitting in `processing` indefinitely.

### Pitfall 2: 403 / bot-blocking (esp. Naver)
**What goes wrong:** Default Deno UA gets 403 or a login/redirect page.
**Why:** Sites block headless/unknown agents; Naver checks `Accept-Language`/geo.
**How to avoid:** Send a browser-like `user-agent` and `accept-language: ko-KR,ko;q=0.9,en;q=0.8`. Accept that some hosts may still block → graceful fail with the status code in `extraction_error`.
**Warning signs:** Body text is a login page; selectors return empty. [CITED: scrapfly — Naver header sensitivity]

### Pitfall 3: Korean/UTF-8 mojibake
**What goes wrong:** Garbled Korean if response charset isn't UTF-8 (some legacy Tistory/Naver use EUC-KR).
**Why:** `res.text()` assumes UTF-8 unless `content-type` says otherwise.
**How to avoid:** Inspect `content-type` charset; if `euc-kr`/`ms949`, decode via `new TextDecoder('euc-kr').decode(await res.arrayBuffer())`. Deno's `TextDecoder` supports `euc-kr`.
**Warning signs:** `�` characters in `bodyText`. [ASSUMED: prevalence of EUC-KR on modern Naver/Tistory is low but nonzero — handle defensively]

### Pitfall 4: redirect handling
**What goes wrong:** Short links / mobile `m.blog.naver.com` redirect; `fetch` follows by default but the final URL may differ.
**How to avoid:** `fetch` follows redirects automatically; derive Naver `blogId/logNo` from the *final* URL (`res.url`) if the input was a shortlink.
**Warning signs:** PostView rewrite produces an empty/404 page.

### Pitfall 5: HTML size before Claude (existing 12000-char cap)
**What goes wrong:** Long articles get truncated mid-content; or raw HTML eats the budget.
**Why:** `claude.ts:134` slices `transcript` to 12000 chars.
**How to avoid:** Pass *extracted text* (not HTML); for very long posts, the existing slice is acceptable (front-loaded content). Optionally pass `article.title` into `videoTitle` and `article.excerpt` into `description` so the most salient text survives the cap.
**Warning signs:** Few/no places from long posts.

### Pitfall 6: deno-dom Document type mismatch with Readability types
**What goes wrong:** TypeScript complains that deno-dom's `Document` ≠ DOM-lib `Document` Readability expects.
**Why:** deno-dom ships its own DOM types.
**How to avoid:** Cast at the boundary: `new Readability(doc as unknown as Document)`. Runtime is fine; this is a types-only seam. [CITED: abeestrada deno-readability example uses the same pattern]

## Code Examples

### Source router (replaces youtube gate at index.ts:88)
```typescript
// index.ts — replace the `if (link.source_kind !== 'youtube') jsonError(...)` block
let content: SourceContent;
let cityHint: string | null = null; // unchanged TODO from youtube path
switch (link.source_kind) {
  case 'youtube': {
    const canonical = normalizeYouTubeUrl(link.url);
    const meta = await fetchYouTubeMetadata(canonical);
    const transcript = await fetchYouTubeTranscript(meta.videoId);
    content = { title: meta.title, bodyText: transcript, thumbnail: meta.thumbnail, author: meta.author, externalId: meta.videoId };
    // NOTE: also still pass meta.description below (see claude call)
    break;
  }
  case 'blog':
    content = await fetchBlogContent(link.url);
    break;
  case 'instagram':
    content = await fetchInstagramContent(link.url); // throws → catch → failed
    break;
  default:
    return jsonError(400, `cannot auto-extract source_kind=${link.source_kind}`);
}
```
> Keep the youtube branch logic identical to today so the existing deno test + behavior are unchanged. `description` for youtube must still flow to `extractCandidatesFromContext` — keep a `description` field on the normalized shape (empty string for blog/insta, or map blog excerpt into it). [VERIFIED: index.ts:116-122 current claude call uses meta.description]

### claude.ts minimal source-aware tweak (Question 4 recommendation)
```typescript
// claude.ts — add ONE optional field; youtube callers omit it → default 'youtube' → prompt unchanged.
export interface ExtractInputs {
  anthropicKey: string;
  videoTitle: string;
  description: string;
  transcript: string;
  cityHint: string | null;
  sourceKind?: 'youtube' | 'blog' | 'instagram'; // NEW, optional, default 'youtube'
}
// In buildPrompt, switch the noun used for the body:
//   youtube → "Transcript:"  (current, unchanged)
//   blog    → "Article body:" and drop timestamp guidance
//   instagram → "Caption:"
```
**Recommendation:** Option (b) minimal — add an optional `sourceKind` and branch only the label + the timestamp sentence in the prompt. This keeps youtube byte-identical (default path), tells the LLM blog input is an article (so it won't hallucinate `source_timestamp_sec`), and is one localized change. Do NOT change the schema or `source_quote` grounding rules. [VERIFIED: claude.ts buildPrompt structure]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instagram Basic Display API for captions | EOL — gone | 2024-12-04 | No no-auth caption path; must use Graph API + app token |
| Instagram `?__a=1` JSON scrape | Login-walled / blocked | ~2021→ ongoing | Unreliable; do not use |
| Instagram oEmbed (no token) | oEmbed requires app access token (`app_id\|app_secret`) + oEmbed Read | 2020→ | Future IG path needs a Meta app |
| jsdom on edge | deno-dom (WASM) / linkedom | — | jsdom does NOT run on Deno Deploy; deno-dom WASM + linkedom do |

**Deprecated/outdated:**
- Instagram Basic Display API — dead, do not reference.
- deno-dom native (non-WASM) backend on hosted runtimes — use WASM backend.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `blog.naver.com/PostView.naver?blogId=X&logNo=Y` returns full SE3 HTML to a plain `fetch` (no JS) with ko-KR headers | Pattern 3 | If Naver geo/header-blocks the Edge region, Naver posts fail → fall back to graceful failure for naver specifically. Verify in morning live spot-check (already deferred). |
| A2 | Exact current `deno-dom` deno.land/x tag | Installation | Wrong tag → import 404; resolve current tag at plan time. |
| A3 | EUC-KR encoding still appears on some Korean blogs | Pitfall 3 | Low risk; defensive decode is cheap and harmless if unused. |
| A4 | Readability `textContent` is adequate place-density text for the LLM (vs `content` HTML) | Pattern 2 | If extraction quality is low, pass `article.content` stripped, or `article.excerpt` into description. Tunable, non-blocking. |

## Open Questions

1. **Naver from Supabase's Edge region**
   - What we know: PostView is server-rendered HTML; Naver is header/geo sensitive.
   - What's unclear: whether Supabase's hosted Edge egress IP/geo gets blocked.
   - Recommendation: implement with ko-KR headers + browser UA; verify in the deferred live spot-check; if blocked, treat naver like instagram (graceful fail) until a proxy is added.

2. **Which blog hosts to claim "supported" for SRC-01 acceptance**
   - What we know: tistory/velog/brunch/medium are static → high confidence; naver needs the rewrite.
   - Recommendation: SRC-01 acceptance = Readability path works on at least one static host (tistory/velog) + naver rewrite path returns non-empty body in spot-check. Unknown hosts → graceful fail.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `npm:@mozilla/readability` | SRC-01 blog body | ✓ (npm, bundled at deploy) | 0.6.0 | linkedom-based manual selector |
| `deno-dom` WASM | SRC-01 DOM parse | ✓ (Deno Deploy + Supabase Edge support WASM) | resolve tag at plan time | `npm:linkedom@0.18.12` |
| Supabase Edge npm:/WASM bundling | both adapters | ✓ | Deno 1.46 runtime | — |
| Instagram no-auth caption API | SRC-02 | ✗ | — | Graceful explicit-failure (SRC-02 escape hatch) |
| Existing `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_SERVER_KEY` | downstream | ✓ (already set) | — | — |

**Missing with no fallback:** none that block the phase (IG's "missing" IS the spec'd outcome).
**Missing with fallback:** Instagram auto-extract → graceful failure (acceptable per SRC-02).

## Validation Architecture

`workflow.nyquist_validation: true` → section included. Existing pattern: Deno tests with `jsr:@std/assert`, run via `deno test` (see `pipeline/youtube.test.ts`, `claude.test.ts`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno built-in test runner + `jsr:@std/assert` |
| Config file | none (Deno native; mirrors existing `*.test.ts`) |
| Quick run command | `deno test supabase/functions/extract-youtube/pipeline/ --allow-net --allow-read` |
| Full suite command | `deno test supabase/functions/ --allow-net --allow-read --allow-env` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRC-01 | Static blog HTML → normalized `{title, bodyText}` (Readability), mocked fetch | unit | `deno test .../pipeline/blog.test.ts` | ❌ Wave 0 |
| SRC-01 | Naver URL → PostView rewrite produces correct `PostView.naver?blogId=&logNo=` | unit | `deno test .../pipeline/blog.test.ts` | ❌ Wave 0 |
| SRC-01 | Naver HTML (se-main-container fixture) → bodyText non-empty; legacy postViewArea fallback | unit | `deno test .../pipeline/blog.test.ts` | ❌ Wave 0 |
| SRC-01 | EUC-KR / non-UTF8 fixture decodes without mojibake | unit | `deno test .../pipeline/blog.test.ts` | ❌ Wave 0 |
| SRC-02 | Instagram adapter throws explicit `instagram:` error (graceful-fail contract) | unit | `deno test .../pipeline/instagram.test.ts` | ❌ Wave 0 |
| youtube | existing extractVideoId/normalize tests still green (regression 0) | unit | `deno test .../pipeline/youtube.test.ts` | ✅ |

**Mockability:** adapters take a `url` and call `fetch`; inject a `fetchImpl` param (default `globalThis.fetch`) so tests pass a stub returning fixture HTML — no network. This keeps `mockable fetch → adapter → normalized text` per the brief.

### Sampling Rate
- **Per task commit:** `deno test supabase/functions/extract-youtube/pipeline/ --allow-net --allow-read`
- **Per wave merge:** full suite above
- **Phase gate:** full suite green + deferred live spot-check (naver/tistory) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pipeline/blog.test.ts` — covers SRC-01 (static, naver rewrite, selector fallback, encoding)
- [ ] `pipeline/instagram.test.ts` — covers SRC-02 explicit-failure
- [ ] HTML fixtures: one static-blog sample, one Naver SE3 (`se-main-container`), one legacy (`postViewArea`)
- [ ] Adapter `fetchImpl` injection seam for deterministic tests

## Security Domain

`security_enforcement` not explicitly false → included (lightweight; this is server-side fetch, not auth surface).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Zod-validate adapter output `{title, bodyText, ...}` (CONTEXT constraint); `link.url` already Zod-validated at insert (`LinkAddSchema`) |
| V5 SSRF | yes | Adapters fetch arbitrary user-supplied URLs server-side — restrict to known blog/IG hosts via `detectSourceKind` (router only dispatches detected kinds); do NOT fetch `null`/manual kinds |
| V6 Cryptography | no | No new crypto |
| V2/V3 Auth/Session | no | Function already gates on `Authorization: Bearer` (index.ts:63); unchanged |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via crafted blog URL (internal IPs, file://) | Tampering/Info Disclosure | Only `https?` + host already matched by `detectSourceKind`; reject non-blog hosts; `fetch` won't follow `file:`; consider blocking RFC1918 if resolving is added |
| Script injection from extracted HTML | Tampering | We extract **text** (`textContent`), never render extracted HTML; Claude receives plain text. If `article.content` (HTML) is ever used downstream, sanitize with DOMPurify first |
| Resource exhaustion (huge HTML) | DoS | `AbortSignal.timeout`; existing 12000-char cap bounds LLM input |

## Sources

### Primary (HIGH confidence)
- `supabase/functions/extract-youtube/index.ts`, `pipeline/{youtube,claude}.ts` — current pipeline (read this session)
- `packages/core/src/schemas/link.ts` — `detectSourceKind` (read this session)
- Deno manual — deno-dom / linkedom on Deno Deploy: https://deno.com/manual@v1.32.1/advanced/jsx_dom/linkedom , https://github.com/b-fuze/deno-dom
- Supabase Edge — npm: + WASM support: https://supabase.com/docs/guides/functions/dependencies , https://supabase.com/docs/guides/functions/wasm
- npm registry — `@mozilla/readability@0.6.0` (2025-03-03), `linkedom@0.18.12` (verified via `npm view`)
- mozilla/readability README: https://github.com/mozilla/readability

### Secondary (MEDIUM confidence)
- Deno + Readability working example (imports/code pattern): https://abeestrada.com/post/deno-readability/
- Naver selectors + header sensitivity: https://scrapfly.io/blog/posts/how-to-scrape-naver
- Instagram 2026 API state (oEmbed token required, Basic Display EOL): https://developers.facebook.com/docs/instagram-platform/oembed/ , https://sociavault.com/blog/instagram-api-deprecated-alternative-2026

### Tertiary (LOW confidence)
- Naver PostView direct-fetch viability (A1) — corroborated by multiple scraping guides but not byte-verified this session; deferred live spot-check confirms.

## Metadata

**Confidence breakdown:**
- Standard stack (Readability + deno-dom on Deno): HIGH — official Deno docs + npm versions + working example.
- Blog architecture / router reuse: HIGH — read the actual code; downstream is source-agnostic.
- Naver PostView technique: MEDIUM — technique well-documented, live spot-check pending (already a deferred gate).
- Instagram verdict: HIGH — multiple 2026 sources agree, Basic Display EOL is official.
- claude.ts reuse: HIGH — read the prompt/schema; minimal optional param is non-breaking.

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 for blog/Deno stack (stable); 2026-06-22 for Instagram (fast-moving API policy).
