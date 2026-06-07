---
phase: 09-source-breadth
plan: 04
subsystem: web
tags: [web, dev-tool, extraction-trigger]
requires: []
provides: "Web dev-tool add-link fires triggerExtraction for blog + instagram (not only youtube)"
affects: [apps/web]
tech-stack:
  added: []
  patterns: ["fire-and-forget triggerExtraction on non-manual source_kind"]
key-files:
  created: []
  modified:
    - apps/web/app/boards/[id]/_components/add-link-form.tsx
decisions:
  - "Trigger gate broadened via `source_kind !== 'manual'` (covers youtube/blog/instagram, excludes manual) — simplest reversible condition per 09-CONTEXT Decision E"
requirements: [SRC-01, SRC-02]
metrics:
  duration: ~4m
  completed: 2026-06-08
---

# Phase 9 Plan 04: Web dev-tool add-link trigger broadening Summary

Broadened the web dev-tool add-link form so blog and instagram links also fire `triggerExtraction` (previously youtube-only), and replaced the "큐레이션 대기열" hint copy with auto-analysis wording. Display/trigger-only edit on the existing `isDevToolsEnabled()`-gated dev tool — no new UI shipped.

## What Changed

**apps/web/app/boards/[id]/_components/add-link-form.tsx** (commit `784b138`)

1. `submit()` trigger condition: `link.source_kind === 'youtube'` → `link.source_kind !== 'manual'`. youtube/blog/instagram now all fire the fire-and-forget `triggerExtraction(client, link.id)` + success toast "링크를 추가했어요 — 장소를 분석 중이에요." The `else` (manual/unknown) keeps "링크를 추가했어요." A comment notes instagram resolves server-side to `extraction_status='failed'` (Plan 01 graceful fail), surfaced via existing status UI.
2. `onChange()` hint copy:
   - blog → '블로그 — 본문을 분석해 장소를 추출합니다.' (was 큐레이션 대기열)
   - instagram → '인스타 — 분석을 시도합니다 (캡션 추출이 제한될 수 있어요).' (was 큐레이션 대기열)
   - youtube / null → unchanged.

`isDevToolsEnabled()` component gate, form structure, inputs, and buttons all unchanged.

## Verification

| Check | Result |
|-------|--------|
| `grep "source_kind !== 'manual'"` (blog triggers) | PASS |
| `! grep "큐레이션 대기열"` (no queue routing) | PASS |
| `grep "isDevToolsEnabled"` (gate intact, T-09-07) | PASS |
| No `.js` workspace import extensions | PASS |
| `pnpm --filter web typecheck` | exit 0 |
| `pnpm --filter web build` | green (11/11 pages) |

## Deviations from Plan

None — plan executed as written. The plan offered `source_kind === 'youtube' || 'blog' || 'instagram'` or the equivalent `!== 'manual'`; chose `!== 'manual'` per the plan's stated "equivalently" and Karpathy §3.2 (simplest condition). Confirmed `'manual'` is a valid `SourceKind` member (`packages/core/src/constants.ts:32`).

## Known Stubs

None.

## Self-Check: PASSED

- `apps/web/app/boards/[id]/_components/add-link-form.tsx` — FOUND (modified)
- Commit `784b138` — FOUND in `git log`
- No file deletions in commit; working tree clean except pre-existing untracked files (left untouched).
