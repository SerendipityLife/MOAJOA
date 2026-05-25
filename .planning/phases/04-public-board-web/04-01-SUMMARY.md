---
phase: 04-public-board-web
plan: 01
subsystem: web-testing-infra + shared-helpers
tags:
  - testing-infra
  - youtube-helper
  - static-maps-builder
  - cache-helper
  - i18n-city-map
dependency_graph:
  requires:
    - "packages/core (existing exports)"
    - "packages/api getPublicBoardBySlug (existing)"
    - "apps/web/lib/supabase/server.ts (existing)"
  provides:
    - "@moajoa/core CITY_KO_MAP (9 ko-KR city entries)"
    - "apps/web/lib/env.ts getRevalidateSecret + getBaseUrl + getGoogleMapsKey"
    - "apps/web/lib/youtube.ts extractYouTubeVideoId + buildYouTubeWatchUrl"
    - "apps/web/lib/og/static-maps.ts buildStaticMapsUrl + OG_GRAYSCALE_STYLE"
    - "apps/web/lib/cache.ts BOARD_REVALIDATE_TAG + getCachedPublicBoard"
    - "apps/web vitest infra (jsdom + jest-dom + @ alias)"
  affects:
    - "All Wave 2/3 plans of Phase 4 depend on these helpers"
tech_stack:
  added:
    - "vitest@^1.6.0"
    - "@vitest/coverage-v8@^1.6.0"
    - "@testing-library/react@^16.0.0"
    - "@testing-library/jest-dom@^6.5.0"
    - "jsdom@^25.0.0"
  patterns:
    - "TDD RED → GREEN with atomic commits per phase"
    - "URLSearchParams for Static Maps URL composition (no manual encode)"
    - "unstable_cache + tag pattern for SSR data cache"
    - "Closure-captured slug → mandatory keyParts entry"
key_files:
  created:
    - "apps/web/vitest.config.ts"
    - "apps/web/__tests__/setup.ts"
    - "apps/web/__tests__/youtube-id.test.ts"
    - "apps/web/__tests__/static-maps-url.test.ts"
    - "apps/web/__tests__/cache-tag.test.ts"
    - "apps/web/lib/youtube.ts"
    - "apps/web/lib/og/static-maps.ts"
    - "apps/web/lib/cache.ts"
  modified:
    - "apps/web/package.json (add test scripts + 5 devDeps)"
    - "apps/web/lib/env.ts (add 3 functions; preserve isDevToolsEnabled)"
    - "packages/core/src/constants.ts (add CITY_KO_MAP)"
    - "pnpm-lock.yaml"
decisions:
  - "11-char YouTube ID regex is correct; test fixtures use real ID dQw4w9WgXcQ (Rule 1 inline fix)"
  - "Static Maps URL signing not implemented in v1 (D-07 lock)"
  - "BOARD_REVALIDATE_TAG factory function (not string template) — type-safe consumers"
  - "getCachedPublicBoard creates supabase client INSIDE cache scope (RPC is SECURITY DEFINER, cookie-agnostic)"
metrics:
  duration_minutes: 7
  completed_date: "2026-05-26"
  tasks_total: 3
  tasks_completed: 3
  files_created: 8
  files_modified: 4
  tests_added: 20
  commits: 5
---

# Phase 4 Plan 1: Foundation — Vitest + Shared Helpers Summary

**One-liner:** Vitest+jsdom 인프라를 apps/web에 도입하고, Wave 2/3가 공유할 4개 helper (youtube URL parser/builder, Static Maps URL builder + grayscale style preset, unstable_cache 기반 public board cache, env accessors) + packages/core의 CITY_KO_MAP을 TDD RED→GREEN으로 lock.

---

## Tests Added (20 total across 3 files)

| File                                        | Tests | Coverage                                              |
| ------------------------------------------- | ----- | ----------------------------------------------------- |
| `apps/web/__tests__/youtube-id.test.ts`     | 13    | extractYouTubeVideoId (7) + buildYouTubeWatchUrl (6) — D-15 edge cases (null/0/fractional/non-YT) |
| `apps/web/__tests__/static-maps-url.test.ts` | 6     | buildStaticMapsUrl (5: empty throw, full shape, 10-marker truncate D-07, styleParams, default scale) + OG_GRAYSCALE_STYLE (1: ≥3 feature: entries) |
| `apps/web/__tests__/cache-tag.test.ts`      | 1     | BOARD_REVALIDATE_TAG('abc12345') === 'board:abc12345' |

`pnpm --filter @moajoa/web test:run` → **20/20 PASS** in 593ms.

---

## Helpers Exported

```ts
// apps/web/lib/youtube.ts
export function extractYouTubeVideoId(url: string): string | null;
export function buildYouTubeWatchUrl(linkUrl: string, timestampSec: number | null): string | null;

// apps/web/lib/og/static-maps.ts
export interface MarkerLatLng { lat: number; lng: number }
export interface BuildStaticMapsOpts {
  places: MarkerLatLng[];
  size: { width: number; height: number };
  scale?: 1 | 2;
  apiKey: string;
  styleParams?: string[];
}
export function buildStaticMapsUrl(opts: BuildStaticMapsOpts): string;
export const OG_GRAYSCALE_STYLE: string[]; // 3 entries

// apps/web/lib/cache.ts
export const BOARD_REVALIDATE_TAG: (slug: string) => string;
export function getCachedPublicBoard(slug: string): Promise<PublicBoardView | null>;

// apps/web/lib/env.ts (extended — existing isDevToolsEnabled preserved)
export function isDevToolsEnabled(): boolean;          // existing
export function getRevalidateSecret(): string | null;  // NEW — server-only
export function getBaseUrl(): string;                  // NEW — no trailing slash
export function getGoogleMapsKey(): string | undefined; // NEW

// packages/core/src/constants.ts (extended)
export const CITY_KO_MAP: Readonly<Record<string, string>>;
// 9 entries: tokyo, osaka, kyoto, seoul, busan, jeju, fukuoka, sapporo, okinawa
```

---

## Test Coverage of D-07 / D-15

### D-07 (Static Maps 최대 10 markers)
- `truncates places to max 10` — 15-marker input asserted to produce exactly 10 lat,lng pairs in `markers=` param via regex count. URLSearchParams encodes `,` as `%2C` reliably (test assertion uses `%2C`).

### D-15 (YouTube timestamp 처리)
- timestamp `null`, `0`, `0.7` (Math.floor → 0) → `?t=` 모두 omit ✓
- timestamp `60.9` → `Math.floor(60.9) = 60` → `&t=60s` ✓
- timestamp `120` → `&t=120s` ✓
- Non-YouTube URL → null (no fallback) ✓

---

## Deviations from Plan

### Rule 1 — Inline Bug Fix: 11-char YouTube ID regex vs 12-char test fixtures

**Found during:** Task 2 GREEN run.

**Issue:** PLAN.md provided test fixtures using `ABC123_def-1` (12 chars: `A`,`B`,`C`,`1`,`2`,`3`,`_`,`d`,`e`,`f`,`-`,`1`), but RESEARCH §Pattern 7 (and the implementation it locks) uses regex `[\w-]{11}` enforcing exactly 11 chars (matching real-world YouTube IDs). This created a self-contradiction in the plan — the regex would capture only the first 11 chars (`ABC123_def-`), making the assertion fail.

**Fix:** Replaced all 18 occurrences of `ABC123_def-1` with the real 11-char ID `dQw4w9WgXcQ` (Rick Astley — well-known stable fixture). Regex unchanged (correctly enforces real-world constraint).

**Files modified:** `apps/web/__tests__/youtube-id.test.ts` (test fixture only).

**Commit:** `5647451` (feat GREEN — fix bundled with implementation as documented).

**Rationale:** This is a Rule 1 (plan defect → bug in test data) auto-fix. The contract (regex matches real YouTube IDs, 11 chars) is correct; only the example fixture was wrong.

### Other deviations
None. Plan executed exactly as written aside from the fixture correction above.

---

## Architecture Decisions

### 1. `BOARD_REVALIDATE_TAG` as factory function
PLAN's behavioral spec says `BOARD_REVALIDATE_TAG('abc12345') === 'board:abc12345'` — implemented as `(slug) => 'board:${slug}'` rather than a static string. Type-safety + IDE autocomplete in consumers.

### 2. Supabase client inside cache scope
`getCachedPublicBoard` creates `getSupabaseServer()` inside the `unstable_cache` fetcher. Per RESEARCH Pattern 1, the public_board_view RPC is `SECURITY DEFINER` — cookie state does not influence the result. If Next.js 15.5 build later complains about dynamic APIs in cache scope, refactor to the "client outside, slug only inside" variant.

### 3. `URLSearchParams` for Static Maps
Tested empirically: Node's URLSearchParams encodes `,` as `%2C` and `|` as `%7C`. Test assertions reference both encodings explicitly. Result matches Google Static Maps API expectations (it accepts either).

### 4. `vitest run --passWithNoTests` baseline
Initial empty-suite must pass so subsequent waves can add their own tests without breaking the gate. Default vitest fails on empty suite, so `--passWithNoTests` is part of `test:run` baseline.

---

## Cost / Cycle Time

| Step                              | Time   |
| --------------------------------- | ------ |
| pnpm install (vitest + 5 deps)    | ~8s    |
| First empty vitest run            | ~1.5s  |
| typecheck (apps/web)              | ~3s    |
| TDD cycle (RED → GREEN per Task)  | ~30s each |
| Total wall-clock                  | ~7 min |

No bundler/Next config conflicts encountered — Vitest's separate Vite config sidesteps Turbopack entirely.

---

## Open Issues for Downstream Plans

1. **Pretendard `.otf` size check** — RESEARCH warned that 2× weights (~520KB total) risks Next.js `next/og` 500KB bundle limit. **Deferred to Plan 04-04** (OG image implementation will measure `ls -la apps/web/public/fonts/` and decide subset vs woff2 conversion).

2. **`metadataBase`** — RESEARCH recommended adding `metadataBase: new URL(getBaseUrl())` to root `app/layout.tsx` so relative OG image paths resolve to absolute URLs. **Deferred to Plan 04-02** (page.tsx generateMetadata extension).

3. **`/api/revalidate` route handler** — uses `getRevalidateSecret()` exported here. **Implemented in Plan 04-03** (webhook + Edge Function POST).

4. **Pin click → `buildYouTubeWatchUrl`** — `PublicBoardMap` needs `links` prop addition. **Implemented in Plan 04-02** (page + map component).

5. **Static Maps key referer restriction** — RESEARCH noted GCP Console should add Maps Static API to the existing `NEXT_PUBLIC_GOOGLE_MAPS_KEY` allowlist. **Manual ops task, no code change** — flag for user-side checklist before first production deploy.

---

## TDD Gate Compliance

Per Plan `type: tdd`, 3 RED/GREEN cycles executed atomically. Git log shows the required sequence:

| Commit  | Type | Gate    | Scope                                          |
| ------- | ---- | ------- | ---------------------------------------------- |
| f155efb | feat | (infra) | vitest install + env + CITY_KO_MAP (no test gate — infra only) |
| d790bfc | test | RED     | youtube-id failing tests                       |
| 5647451 | feat | GREEN   | youtube.ts implementation passes 13/13         |
| 3257f35 | test | RED     | static-maps + cache-tag failing tests          |
| 55b64d4 | feat | GREEN   | static-maps.ts + cache.ts pass remaining 7/7   |

REFACTOR commits omitted — implementations were minimal and clean on first GREEN.

---

## Self-Check: PASSED

**Files verified to exist:**
- apps/web/vitest.config.ts ✓
- apps/web/__tests__/setup.ts ✓
- apps/web/__tests__/youtube-id.test.ts ✓
- apps/web/__tests__/static-maps-url.test.ts ✓
- apps/web/__tests__/cache-tag.test.ts ✓
- apps/web/lib/youtube.ts ✓
- apps/web/lib/og/static-maps.ts ✓
- apps/web/lib/cache.ts ✓
- apps/web/lib/env.ts (extended) ✓
- packages/core/src/constants.ts (extended with CITY_KO_MAP) ✓

**Commits verified in git log:**
- f155efb feat(04-01) infra ✓
- d790bfc test(04-01) RED youtube ✓
- 5647451 feat(04-01) GREEN youtube ✓
- 3257f35 test(04-01) RED static-maps + cache-tag ✓
- 55b64d4 feat(04-01) GREEN static-maps + cache ✓

**Verification commands:**
- `pnpm --filter @moajoa/web test:run` → 20/20 pass
- `pnpm --filter @moajoa/web typecheck` → exit 0
- `grep -rn "from '@moajoa/.*\.js'" apps/web/` → 0 hits (CLAUDE.md §4.5 compliance)

Plan 04-01 complete — Wave 2 (04-02 page.tsx + map) and Wave 3 (04-03 webhook, 04-04 OG image) unblocked.
