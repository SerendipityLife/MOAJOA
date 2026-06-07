---
phase: 08-extraction-depth
plan: 03
subsystem: web-public-board
tags: [view-08, summary_ko, conditional-render, rtl-vitest, xss-safe]
requires:
  - "08-01: PublicBoardView Pick unions carry summary_ko (links + places)"
provides:
  - "PlaceSummaryList server component — name_ko ?? name_local heading + conditional escaped summary_ko"
  - "Public board page renders place commentary section + per-video TL;DR, both gated on summary_ko"
  - "place-summary-list.test.tsx (RTL): present / null(legacy) / name-preference / HTML-escaping"
affects:
  - "08-04 autonomous:false gate (real-browser UAT against applied 0008 RPC payload)"
tech-stack:
  added: []
  patterns:
    - "RTL + vitest .test.tsx (jsdom + jsx:'automatic' + @testing-library/react) — first .test.tsx in repo, ran on existing config with zero setup changes"
    - "conditional render {x.summary_ko && (...)} for legacy-null safety"
    - "JSX text interpolation (React default escaping) — no dangerouslySetInnerHTML (T-08-06 mitigation)"
key-files:
  created:
    - apps/web/app/b/[slug]/_components/place-summary-list.tsx
    - apps/web/__tests__/place-summary-list.test.tsx
  modified:
    - apps/web/app/b/[slug]/page.tsx
decisions:
  - "RTL .test.tsx ran on the existing vitest.config.ts unchanged — config already had jsdom env, globals, setup.ts (jest-dom matchers), jsx:'automatic', and a *.test.tsx include glob from a prior phase. No setup file or jsdom hint needed."
metrics:
  tasks: 2
  files_changed: 3
  duration: ~3 min
  completed: 2026-06-08
---

# Phase 8 Plan 03: Web summary_ko Conditional Render Summary

Surfaces the Korean commentary on the public web board (VIEW-08): a new server-side `PlaceSummaryList` section renders each place's name + 1~2 sentence `summary_ko`, and the existing 영상 출처 list gains a per-video TL;DR `<p>` — both gated behind `{x.summary_ko && (...)}` so legacy rows (summary_ko null) render no block and the layout stays intact. summary_ko is rendered as escaped JSX text (no `dangerouslySetInnerHTML`), closing the 4th link of the data-flow chain to the browser. Display-only — no new create/add UI (CLAUDE.md §5). 4 new RTL tests pass; `tsc --noEmit` and `next build` are clean.

## What Changed Per File

- **apps/web/app/b/[slug]/_components/place-summary-list.tsx** (NEW): `PlaceSummaryList({ places }: { places: PublicBoardView['places'] })`. Server-safe (no `'use client'`). `return null` when `places.length === 0`. `<section>` with `장소 {N}곳` heading + `<ul>`; each `<li>` (Phase 4 token `p-3 border border-neutral-200 rounded-lg`) shows `{p.name_ko ?? p.name_local}` (semibold) and conditionally `{p.summary_ko && <p data-testid="place-summary" className="text-sm text-neutral-600 mt-1">{p.summary_ko}</p>}`. No `dangerouslySetInnerHTML`; no `.js` import extension.
- **apps/web/__tests__/place-summary-list.test.tsx** (NEW): RTL + vitest. Inline `makePlace()` fixture satisfying `PublicBoardView['places'][number]`. Four tests — (1) summary present → `getByText('여기 라멘이 유명해요')`; (2) summary null (legacy) → name present but `queryByTestId('place-summary')` null; (3) `name_ko` preferred over `name_local` (`getByText('스시야')`, `queryByText('寿司屋')` null); (4) HTML payload `<img src=x onerror=alert(1)>` renders as literal text and `container.querySelector('img')` is null (React default escaping / no XSS).
- **apps/web/app/b/[slug]/page.tsx** (MODIFIED): (1) added `import { PlaceSummaryList } from './_components/place-summary-list';`; (2) `<PlaceSummaryList places={view.places} />` inserted after the map block and before the 영상 출처 section; (3) inside the existing link `<li>` inner `<div className="min-w-0">`, after the `{link.author_name && (...)}` block, added `{link.summary_ko && (<p className="text-sm text-neutral-600 mt-1 line-clamp-3">{link.summary_ko}</p>)}`. Header/map/footer/link-card structure untouched (surgical). No new create/add UI; no `dangerouslySetInnerHTML`.

## Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 (RED)  | `7889a4a` | test | PlaceSummaryList 렌더 테스트 — present/null/이름우선/이스케이프 |
| 1 (GREEN)| `db01535` | feat | PlaceSummaryList 컴포넌트 — 장소 해설 조건부 렌더 (VIEW-08) |
| 2        | `16bd93c` | feat | 공개 보드 페이지에 장소 해설 + 영상 TL;DR 조건부 노출 (VIEW-08) |

## Verification Results

- **vitest (plan target):** `pnpm vitest run __tests__/place-summary-list.test.tsx` → 4 passed, 0 failed.
- **vitest (full web suite):** 48 passed, 5 failed. All 5 failures are in `__tests__/marker-svg.test.ts` (Phase 5) — PRE-EXISTING and unrelated (see Deviations). 8/9 other suites pass; 0 regressions introduced by 08-03.
- **tsc:** `pnpm tsc --noEmit` → exit 0 (PublicBoardView.summary_ko types resolve via 08-01).
- **build:** `pnpm build` → exit 0; "✓ Compiled successfully", 11/11 static pages, `/b/[slug]` route built (2.83 kB).
- **grep acceptance:**
  - `grep "p.summary_ko &&"` place-summary-list.tsx → present (OK)
  - `grep "p.name_ko ?? p.name_local"` place-summary-list.tsx → present (OK)
  - `grep "dangerouslySetInnerHTML"` place-summary-list.tsx → FAILS (OK, XSS-safe)
  - `grep "import { PlaceSummaryList }"` page.tsx → present (OK)
  - `grep "<PlaceSummaryList places={view.places} />"` page.tsx → present (OK)
  - `grep "link.summary_ko && ("` page.tsx → present (OK)
  - `grep "dangerouslySetInnerHTML"` page.tsx → FAILS (OK, XSS-safe)
- No `.js` extension on any workspace import.

## TDD Gate Compliance

Task 1 followed RED→GREEN: `test(08-03)` commit `7889a4a` (failing — component absent, confirmed by run), then `feat(08-03)` commit `db01535` (4/4 passing). No REFACTOR commit (component already minimal). Gate sequence intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking acceptance criterion] Removed the literal token `dangerouslySetInnerHTML` from the component's doc comment.**
- **Found during:** Task 1, after writing the component.
- **Issue:** The component's header comment originally read "never via dangerouslySetInnerHTML", which made the acceptance criterion `grep -q "dangerouslySetInnerHTML" ... FAILS` falsely match (and thus the criterion would have failed) even though the component never *uses* it.
- **Fix:** Rephrased the comment to "never as raw HTML" — preserves the documented XSS-safe intent and the T-08-06 reference, while keeping the grep clean. No behavioral change; the escaping vitest case still proves the mitigation.
- **Files modified:** apps/web/app/b/[slug]/_components/place-summary-list.tsx.
- **Commit:** folded into `db01535` (made before the GREEN commit).

### Out-of-Scope (NOT fixed — logged to deferred-items.md)

**2. Pre-existing failing suite `apps/web/__tests__/marker-svg.test.ts` (5 tests).**
- The Phase 5 test asserts manual-pin `fill="#0F172A"`, but a later `feat(ui)` palette change made `lib/marker-svg.ts` emit `#111827`; the test was never updated. Proven independent of 08-03 by stashing this plan's `page.tsx` change and re-running the suite (still 5 fails). 08-03 touches none of those files. Per SCOPE BOUNDARY, not fixed here; recorded in `.planning/phases/08-extraction-depth/deferred-items.md` with a suggested Phase-5 test-sync follow-up. The plan's "0 regressions" intent holds — 08-03 introduced no new failures.

## Threat Model Compliance

- **T-08-06 (stored XSS via summary_ko):** mitigated by construction — both files render `{p.summary_ko}` / `{link.summary_ko}` as JSX text (React HTML-escapes), no `dangerouslySetInnerHTML` (grep-asserted FAIL on both files), and the escaping vitest case confirms an `<img onerror>` payload renders inert (no `<img>` element). 
- **T-08-07 (info disclosure):** only `summary_ko` (already opted into the 08-01 Pick) is newly rendered; no `added_by`/`google_place_id`/address fields surfaced. No new threat surface beyond the registered ones.

## Deferred (out of this plan's scope — 08-04 autonomous:false gate)

- **Live-browser UAT** against the real RPC payload (with applied migration 0008 column + regenerated `database.ts`) is the 08-04 gate. This plan verified offline only (RTL + tsc + build); migration 0008 remains unapplied per 08-01.

## Self-Check: PASSED

- FOUND: apps/web/app/b/[slug]/_components/place-summary-list.tsx
- FOUND: apps/web/__tests__/place-summary-list.test.tsx
- FOUND: apps/web/app/b/[slug]/page.tsx (PlaceSummaryList import + render + link.summary_ko conditional)
- FOUND commit 7889a4a (test), db01535 (feat component), 16bd93c (feat page) in git log.
