---
phase: 01-build-unblock-hygiene
plan: 03
status: complete
completed_tasks: 3
total_tasks: 3
verified_in_machine: true
verified_at: "2026-05-25T07:30:00.000Z"
---

# 01-03 SUMMARY — Web dev-tool gate + Pretendard next/font

**Status:** All 3 tasks complete + verified. V6 (curl 307) passes, V2 (build) passes, next/font/local Pretendard wire confirmed on `<html>`.

## Commits

| SHA | Subject |
|---|---|
| `31e5bfb` | feat(01-03): add lib/env helper + next/font/local Pretendard wire-up |
| `72864be` | feat(01-03): gate dev-tool boards routes and client components on NEXT_PUBLIC_ENABLE_DEV_TOOLS |

## What shipped

### Task 1 — Font + env helper (`31e5bfb`)
- **NEW** `apps/web/lib/env.ts` — `isDevToolsEnabled()`, strict `=== '1'` check (fail-safe gate-closed default).
- **MOD** `apps/web/app/layout.tsx` — `import localFont from 'next/font/local'`, 4-weight Pretendard registration (Regular/Medium/SemiBold/Bold @ 400/500/600/700, `display: 'swap'`), exposes `--font-pretendard` CSS variable on `<html>` className.
- **MOD** `apps/web/app/globals.css` — `--font-sans` first item changed from literal `'Pretendard'` to `var(--font-pretendard)` so next/font's hashed family name resolves (literal string can never match next/font's `__className_*` hash).

### Task 2 — Double gate (`72864be`)
- **MOD** `apps/web/app/boards/page.tsx` — Server Component: `if (!isDevToolsEnabled()) redirect('/login')` as FIRST statement (before auth gate).
- **MOD** `apps/web/app/boards/[id]/page.tsx` — same pattern.
- **MOD** `apps/web/app/boards/_components/create-board-button.tsx` — Client Component: `if (!isDevToolsEnabled()) return null` as FIRST line (before any hook call → React Hooks rule + tree-shaking benefit).
- **MOD** `apps/web/app/boards/[id]/_components/add-link-form.tsx` — same pattern.

## Pitfall checks (passed)
- **Pitfall D**: `redirect()` only in Server Components, Client Components use `return null` — grep confirms.
- **D-09 lock**: `apps/web/middleware.ts` untouched (`git diff apps/web/middleware.ts` empty across both commits).
- **CLAUDE.md §4.5**: No `.js` extension on workspace imports in modified files.
- **Typecheck**: `pnpm --filter @moajoa/web typecheck` exits 0 (verified 2026-05-25 post-handoff).

## Task 3 verification results (2026-05-25 07:30 UTC)

Build prerequisite: pre-existing `useSearchParams()` Suspense error in `apps/web/app/auth/callback/page.tsx` blocked `pnpm build`. Fixed in separate commit `ef2831e` (`fix(auth): wrap useSearchParams in Suspense to fix prerender`). This was a pre-existing Next.js 15 strict-prerender issue, not introduced by 01-03 — surfaced while verifying.

### V2 (build)
```
$ unset NEXT_PUBLIC_ENABLE_DEV_TOOLS && pnpm --filter @moajoa/web build
✓ Generating static pages (8/8)
Route (app)                                 Size  First Load JS
├ ○ /auth/callback                        1.1 kB         168 kB
├ ○ /boards                              2.44 kB         185 kB    ← gate dead-code-eliminated, became static
├ ƒ /boards/[id]                         3.26 kB         183 kB
```
`/boards` was detected as `○ Static` because the gate's `redirect('/login')` is the first statement and `NEXT_PUBLIC_ENABLE_DEV_TOOLS` inlined as `undefined` → Next.js prerenders the redirect at build time. Best-case tree-shaking outcome.

### V6 (307 redirects, env unset)
```
$ curl -sI http://localhost:3000/boards
HTTP/1.1 307 Temporary Redirect
x-nextjs-cache: HIT
x-nextjs-prerender: 1
location: /login

$ curl -sI http://localhost:3000/boards/some-uuid
HTTP/1.1 307 Temporary Redirect
link: </_next/static/media/37d64f18eeefe942-s.p.otf>; rel=preload; as="font"; crossorigin=""; type="font/otf",
      </_next/static/media/37df6d196b83fb77-s.p.otf>; rel=preload; as="font"; crossorigin=""; type="font/otf",
      </_next/static/media/4c6abbd43e4cb4f7-s.p.otf>; rel=preload; as="font"; crossorigin=""; type="font/otf",
      </_next/static/media/ff83d1ea747af124-s.p.otf>; rel=preload; as="font"; crossorigin=""; type="font/otf"
location: /login
```
PASS — both routes return 307 + `Location: /login`. Bonus: dynamic `/boards/[id]` response also serializes Pretendard 4-weight preload `<link>` headers, confirming next/font/local registered all 4 OTFs.

### V8 (Pretendard wire)
```
$ curl -s http://localhost:3000/login | grep -oE '<html[^>]*class[^>]*>'
<html lang="ko" class="__variable_c4a5dd">
```
PASS — next/font hashed CSS variable class is on `<html>`. globals.css `var(--font-pretendard)` resolves through this.

### Tree-shaking spot check (Assumption A3)
```
$ grep -r "createBoard" apps/web/.next/static/chunks/
FOUND (createBoard string present in client chunks)
```
**Result: A3 not satisfied** — the `createBoard` identifier survives in client chunks (likely from the API client or types). Defense-in-depth 2nd-layer Client Component gate (`return null` before any hook) is what's actually protecting users; tree-shaking would have been a bonus. Plan explicitly accepted this fallback (§Pitfall D and §"defense in depth"). No action required.

## Build blocker side fix

Commit `ef2831e` wrapped `CallbackHandler` (using `useSearchParams()`) in `<Suspense>` boundary so `/auth/callback` can prerender. Behavior unchanged in dev mode; prod build now succeeds.

## Files modified count
- 1 new file (`apps/web/lib/env.ts`)
- 6 modified files
- 0 deletions

## Phase-4 hand-off interface
- `apps/web/lib/env.ts` is the canonical place for future `NEXT_PUBLIC_*` gates — Phase 4 OG/SEO logic can colocate any similar build-time checks here.
- `pretendard.variable` on `<html>` already lives in `layout.tsx` — Phase 4 can extend `metadata` (currently untouched) without re-touching font wiring.
