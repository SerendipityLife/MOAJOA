---
phase: 01-build-unblock-hygiene
plan: 03
status: partial
completed_tasks: 2
total_tasks: 3
verified_in_machine: false
---

# 01-03 SUMMARY — Web dev-tool gate + Pretendard next/font

**Status:** Tasks 1+2 shipped and committed. **Task 3 (build + curl 307 verification) deferred** — to be run before phase-level verification.

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

## Pending (Task 3) — to run before closing phase 1

```bash
# V6 — env unset, gate closed → 307 /login
unset NEXT_PUBLIC_ENABLE_DEV_TOOLS
pnpm --filter @moajoa/web build
pnpm --filter @moajoa/web start &
SERVER_PID=$!
sleep 4
curl -sI http://localhost:3000/boards          # expect: 307 + Location: /login
curl -sI http://localhost:3000/boards/anyid    # expect: same
# Pretendard wire check
curl -s http://localhost:3000/login | grep -oE "(__className_|--font-pretendard)" | head -5
kill $SERVER_PID
# Tree-shaking spot check
grep -r "createBoard" apps/web/.next/static/chunks/ 2>/dev/null && echo "WARN: leaked" || echo "OK: stripped"
```

## Why Task 3 was deferred

Plan 01-03 execution was interrupted mid-stream during a teammate-handoff context switch. Tasks 1+2 (file edits) were the substantive work; Task 3 is verification-only. The handoff doc (`docs/HANDOFF.md`) lists running this verify as the first close-out item — same person finishing 01-02 (iOS, owner: wcb) can knock it out in 3 minutes since both must pass before `/gsd-verify-work` on phase 1.

## Files modified count
- 1 new file (`apps/web/lib/env.ts`)
- 6 modified files
- 0 deletions

## Phase-4 hand-off interface
- `apps/web/lib/env.ts` is the canonical place for future `NEXT_PUBLIC_*` gates — Phase 4 OG/SEO logic can colocate any similar build-time checks here.
- `pretendard.variable` on `<html>` already lives in `layout.tsx` — Phase 4 can extend `metadata` (currently untouched) without re-touching font wiring.
