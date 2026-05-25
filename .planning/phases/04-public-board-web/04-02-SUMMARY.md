---
phase: 04-public-board-web
plan: 02
subsystem: web-revalidate-route + edge-function-webhook
tags:
  - revalidate-webhook
  - edge-function-trigger
  - timing-safe-secret
  - cache-key-isolation
dependency_graph:
  requires:
    - "apps/web/lib/cache.ts BOARD_REVALIDATE_TAG (from 04-01)"
    - "apps/web/lib/env.ts getRevalidateSecret (from 04-01)"
    - "supabase/functions/extract-youtube done broadcast (from Phase 2)"
  provides:
    - "POST /api/revalidate Node-runtime route (timing-safe secret + zod body + revalidateTag)"
    - "Edge Function → web webhook fire-and-forget (visibility='public' only)"
    - "Cache-key isolation regression guard (Pitfall 1 lock)"
  affects:
    - "Wave 3 (04-04 OG image) — same BOARD_REVALIDATE_TAG invalidates both surfaces"
    - "Phase 5+ Trust UI — any future board mutations can reuse this webhook path"
tech_stack:
  added:
    - "node:crypto (built-in — no userland polyfill)"
  patterns:
    - "Length-prefix guard before timingSafeEqual (avoid throw on length mismatch)"
    - "Dynamic import + vi.stubEnv pattern for env-dependent route tests"
    - "Fire-and-forget fetch with .catch(console.warn) — D-05 lock"
    - "Server-only env access via dedicated getter (no NEXT_PUBLIC_* leak)"
key_files:
  created:
    - "apps/web/app/api/revalidate/route.ts"
    - "apps/web/__tests__/api-revalidate.test.ts"
    - "apps/web/__tests__/cache-key.test.ts"
    - ".planning/phases/04-public-board-web/deferred-items.md"
  modified:
    - "supabase/functions/extract-youtube/index.ts (+26 lines after broadcastStep('done'))"
decisions:
  - "Length-prefix guard short-circuits ≠length before timingSafeEqual (avoids throw + leaks only length, acceptable per D-20)"
  - "Edge Function fetches WEB_BASE_URL + REVALIDATE_SECRET at use-site (Deno.env.get) — missing values = silent skip (local dev noop)"
  - "Board lookup ONLY when broadcastStep('done') succeeds — failure paths skip webhook (no stale-invalidate)"
  - "visibility==='public' gate prevents wasted POSTs for private/shared boards (D-05 cost lock)"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-26"
  tasks_total: 3
  tasks_completed: 3
  files_created: 4
  files_modified: 1
  tests_added: 9
  commits: 4
---

# Phase 4 Plan 2: Revalidate Route + Edge Function Webhook Summary

**One-liner:** `/api/revalidate` Node-runtime route (zod body + `node:crypto.timingSafeEqual` + `revalidateTag`) + Edge Function `extract-youtube` fire-and-forget POST after `done` broadcast (visibility='public' only) + cache-key isolation regression guard locking Pitfall 1.

---

## Tests Added (9 total across 2 files)

| File                                          | Tests | Coverage                                                                                       |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `apps/web/__tests__/api-revalidate.test.ts`   | 8     | 200 valid · 401 wrong-secret (same+diff length) · 500 missing env · 400 missing-slug / short-slug / non-JSON · 405 GET |
| `apps/web/__tests__/cache-key.test.ts`        | 1     | Pitfall 1 guard — keyParts + tags slug-scoped, TTL=3600                                        |

`pnpm --filter @moajoa/web test:run` → **34/34 PASS** (20 from 04-01 + 9 new + 5 from concurrent 04-03 metadata work).

---

## Route Handler Signature

```ts
// apps/web/app/api/revalidate/route.ts
export const runtime = 'nodejs'; // node:crypto requires Node runtime (NOT edge)

const BodySchema = z.object({
  slug: z.string().min(8).max(32),
  secret: z.string().min(16),
});

export async function POST(request: Request): Promise<Response>;
export async function GET(): Promise<Response>; // 405

function safeEqualStr(a: string, b: string): boolean; // length-guard + timingSafeEqual
```

**Response matrix:**

| Status | Body                                       | Cause                              |
| ------ | ------------------------------------------ | ---------------------------------- |
| 200    | `{ ok: true, slug }`                       | Valid secret + valid slug          |
| 400    | `{ ok: false, error: 'invalid json' }`     | Non-JSON body                      |
| 400    | `{ ok: false, error: 'invalid body' }`     | Zod parse fail (missing/short slug)|
| 401    | `{ ok: false, error: 'unauthorized' }`     | Wrong secret (timing-safe checked) |
| 405    | `{ ok: false, error: 'method not allowed' }` | GET                              |
| 500    | `{ ok: false, error: 'misconfigured' }`    | `REVALIDATE_SECRET` env missing    |

---

## Edge Function Diff (~26 lines)

`supabase/functions/extract-youtube/index.ts`, inserted immediately after line 234 `broadcastStep('done', ...)`:

```typescript
// Fire-and-forget webhook to web /api/revalidate (per CONTEXT D-04, D-05).
try {
  const { data: board } = await admin
    .from('boards')
    .select('share_slug, visibility')
    .eq('id', link.board_id)
    .maybeSingle();

  if (board?.visibility === 'public' && board.share_slug) {
    const webBase = Deno.env.get('WEB_BASE_URL');
    const revalidateSecret = Deno.env.get('REVALIDATE_SECRET');
    if (webBase && revalidateSecret) {
      fetch(`${webBase}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: board.share_slug, secret: revalidateSecret }),
      }).catch((err) => console.warn('[revalidate-webhook] fetch failed:', err));
    }
  }
} catch (err) {
  console.warn('[revalidate-webhook] lookup failed:', err);
}
```

**Properties:**
- **Non-blocking** — outer try/catch ensures lookup failure never reverts extraction success
- **Fire-and-forget** — `fetch(...).catch(...)` with no `await` (D-05)
- **Cost-saving** — only POSTs when `visibility='public'` + `share_slug` present
- **Local-dev safe** — missing `WEB_BASE_URL` or `REVALIDATE_SECRET` = silent skip

---

## Architecture Decisions

### 1. Length-prefix guard before `timingSafeEqual`

`node:crypto.timingSafeEqual` THROWS when buffer lengths differ. A naïve direct call leaks length via exception path (also bad UX). Pre-check `a.length !== b.length` → return false short-circuits without throwing. Secret length is a known constant (64 hex chars), so the leak is acceptable per D-20.

### 2. Edge Function reads env at use-site, not module top-level

`Deno.env.get('WEB_BASE_URL')` inside the webhook block rather than module-level. Reason: env values can change across cold starts on Supabase Edge (rare but possible), and use-site reads make the missing-env path testable via `unset`. No measurable cost — `Deno.env.get` is O(1).

### 3. Webhook ONLY fires inside try-success branch (not in error catch)

The webhook block is placed AFTER the success-path `await broadcastStep(...,'done',...)` and BEFORE `return jsonOk(...)`. It is INSIDE the outer `try` so the catch handler at line ~243 (error path) does NOT trigger a stale-invalidate. Reason: if extraction failed, the board has no new pins to show — invalidating would just serve the same stale data with cache-bust overhead.

### 4. Cache-key test mocks `unstable_cache` as identity

The Pitfall 1 guard mocks `unstable_cache` to record `(fn, keyParts, opts)` and return `fn` directly (identity wrapper). This bypasses the actual cache so the test runs deterministically without leaking state between cases. The assertion is on the META (keyParts + opts), not the cached value — exactly what regression-locking demands.

---

## Deviations from Plan

**None.** Plan executed exactly as written — 3 tasks, 4 commits, RED→GREEN→test→feat order. Test expectations matched implementation on first GREEN run (no fixture corrections needed).

### Out-of-scope discoveries (logged, not fixed)

Discovered 9 pre-existing `deno check` errors in `supabase/functions/extract-youtube/index.ts` (lines 99, 103, 121, 140, 178, 189, 234, 272, 317). Confirmed pre-existing via `git stash` recheck. Logged to `.planning/phases/04-public-board-web/deferred-items.md`. Not fixed because:
- Outside Task 3 scope (would require regenerating `database.ts` + helper-generic widening across multiple plans)
- Edge Function runtime-correct (errors are local `deno check` type-strict issues only — `supabase functions deploy` works)

---

## Threat Model Compliance

All 8 STRIDE threats from PLAN frontmatter addressed:

| Threat ID    | Mitigation                                                              |
| ------------ | ----------------------------------------------------------------------- |
| T-04-02-01 S | `timingSafeEqual` + zod min(16) + length-prefix guard ✓                 |
| T-04-02-02 T | zod `min(8).max(32)` on slug caps `board:{slug}` tag space ✓            |
| T-04-02-03 I | All errors return `{ ok: false, error: <short> }` — no secret echo ✓     |
| T-04-02-04 D | Accepted (no rate limit in v1, per D-19)                                |
| T-04-02-05 E | App Router route — server-only execution context ✓                      |
| T-04-02-06 I | `REVALIDATE_SECRET` (no `NEXT_PUBLIC_*` prefix) confirmed via grep: 0 hits ✓ |
| T-04-02-07 S | Same secret both sides (web Vercel + Edge Function Deno.env) ✓          |
| T-04-02-08 T | Edge Function uses already-scoped `admin` client (no new privilege) ✓   |

**No new threat surface introduced** beyond what was modeled.

---

## REVALIDATE_SECRET Registration Checklist (User Action)

Before this plan's webhook activates in production, user must register the same secret on BOTH sides:

```bash
# 1. Generate 32-byte hex secret (64 chars)
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
# OR
openssl rand -hex 32

# 2. Register on Vercel (Production + Preview)
# Dashboard → Project → Settings → Environment Variables → Add
# Name: REVALIDATE_SECRET    Value: <64-char-hex>

# 3. Register on Supabase Edge Function
supabase secrets set REVALIDATE_SECRET=<same-64-char-hex> WEB_BASE_URL=https://moajoa.app

# 4. Re-deploy Edge Function to pick up new secrets
supabase functions deploy extract-youtube
```

**Important:** Same secret value on both sides. Rotation = redeploy both.

---

## Manual UAT Items (Deferred — Phase 6 dogfooding gate)

1. **Live POST curl smoke** — once deployed, verify:
   ```bash
   curl -X POST https://moajoa.app/api/revalidate \
     -H 'content-type: application/json' \
     -d '{"slug":"<real-public-slug>","secret":"<REVALIDATE_SECRET>"}'
   # Expect: 200 + { ok: true, slug: "<real-public-slug>" }
   ```

2. **End-to-end webhook flow** — save a YouTube link to a public board (iOS) → check Vercel function logs for `[revalidate]` activity → reload `/b/{slug}` → confirm new pins visible (cache invalidated within ~1s).

3. **Wrong-secret defense** — POST with malformed secret → verify Vercel logs show 401 only (no stack trace, no secret echo in logs).

4. **Local dev noop check** — start `extract-youtube` locally without `WEB_BASE_URL` set, save a public board link, confirm extraction succeeds + no webhook attempt logged.

---

## Cost / Cycle Time

| Step                                          | Time   |
| --------------------------------------------- | ------ |
| Task 1 RED (write 8 tests + fail-verify)      | ~20s   |
| Task 1 GREEN (route handler + 8/8 pass)       | ~30s   |
| Task 2 (cache-key isolation test)             | ~25s   |
| Task 3 (Edge Function insert + grep verify)   | ~25s   |
| Verification + deferred-items.md + SUMMARY    | ~50s   |
| **Total wall-clock**                          | **~3 min** |

---

## TDD Gate Compliance

Plan `type: tdd`. Gate sequence verified in git log:

| Commit  | Type | Gate    | Scope                                                       |
| ------- | ---- | ------- | ----------------------------------------------------------- |
| 3cf1899 | test | RED     | api-revalidate failing tests (route doesn't exist yet)      |
| 9d5164f | feat | GREEN   | /api/revalidate route handler — 8/8 pass                    |
| 060484f | test | (guard) | cache-key isolation regression lock (passes 04-01 contract) |
| c87fd59 | feat | (impl)  | Edge Function fire-and-forget webhook insertion             |

RED → GREEN sequence for Task 1 satisfied. Tasks 2 + 3 follow regression-guard + non-test patterns by plan design. REFACTOR omitted (implementations minimal + clean on first GREEN).

---

## Self-Check: PASSED

**Files verified to exist:**
- apps/web/app/api/revalidate/route.ts ✓
- apps/web/__tests__/api-revalidate.test.ts ✓
- apps/web/__tests__/cache-key.test.ts ✓
- supabase/functions/extract-youtube/index.ts (modified +26 lines) ✓
- .planning/phases/04-public-board-web/deferred-items.md ✓

**Commits verified in git log:**
- 3cf1899 test(04-02) RED ✓
- 9d5164f feat(04-02) GREEN ✓
- 060484f test(04-02) cache-key guard ✓
- c87fd59 feat(04-02) Edge Function webhook ✓

**Verification matrix (all pass):**
- `pnpm --filter @moajoa/web test:run` → 34/34 (9 new + 25 pre-existing)
- `grep timingSafeEqual apps/web/app/api/revalidate/route.ts` → 4 hits
- `grep "from 'next/cache'" route.ts` → 1
- `grep "runtime = 'nodejs'" route.ts` → 1
- `grep "/api/revalidate" supabase/functions/extract-youtube/index.ts` → 2
- `grep "visibility === 'public'"` → 1
- `grep -rn "NEXT_PUBLIC_REVALIDATE" apps/web/` → **0 hits** (secret correctly server-only)

Plan 04-02 complete — Wave 2 50% done (04-03 in progress separately). Wave 3 (04-04 OG image) unblocked since `BOARD_REVALIDATE_TAG` invalidates both `/b/[slug]/page.tsx` and `opengraph-image.tsx` per D-03.
