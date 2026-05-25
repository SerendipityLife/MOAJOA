---
phase: 1
slug: build-unblock-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract. Phase 1 success criteria are largely manual (real-device behavior), so this contract emphasizes typecheck/build automation + a small set of curl-based smoke tests + scripted manual checklists. PROJECT.md Out of Scope locks "no CI / no unit test framework for v1".

Authoritative source for V1..V8 falsifiable slices and Pitfalls A..G: `01-RESEARCH.md` §"Validation Architecture" and §"Pitfalls (Phase 1 specific)".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (decision locked — no jest/vitest in Phase 1; v1 Out of Scope per PROJECT.md) |
| **Config file** | none |
| **Quick run command** | `pnpm -r --filter "@moajoa/*" typecheck` |
| **Full suite command** | `pnpm -r --filter "@moajoa/*" typecheck && pnpm --filter @moajoa/web build` |
| **Estimated runtime** | ~25–60s for quick; ~90–180s for full (web build dominated) |

---

## Sampling Rate

- **After every task commit:** Run quick run command — `pnpm -r --filter "@moajoa/*" typecheck`
- **After every plan wave:** Run full suite — typecheck + web build
- **Before `/gsd-verify-work`:** Full suite green + V1..V8 from RESEARCH all passed (V3/V4/V7 manual screenshots collected in `docs/SESSION-NOTES-YYYY-MM-DD.md`)
- **Max feedback latency:** ~60s for typecheck (per-task); ~180s for build (per-wave). Real-device install (V4) is out of band.

---

## Per-Requirement Verification Map

(Per-task table is filled by the planner during PLAN.md generation. The req-level mapping below stays canonical.)

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | iOS 앱이 실기기에서 빌드·실행 | manual (gated) | `npx expo run:ios --device` (path A) OR `eas build --profile development --platform ios` (path B) | ❌ — Wave 1/2 creates `apps/ios/.npmrc`, `eas.json`, `apps/ios/assets/` |
| BUILD-02 | NativeWind className 시각 적용 | manual (smoke screen) | (manual) NativeWind smoke screen — orange bg + white card visible on device | ❌ — Wave 2 creates smoke JSX in `apps/ios/app/index.tsx` |
| BUILD-03 | App icon · splash · 워드마크 | manual + script | `pnpm --filter @moajoa/ui-tokens run export-assets` then `ls -la apps/ios/assets/{icon,adaptive-icon,splash}.png` | ❌ — Wave 1 creates SVG sources + Wave 3 wires assets into `app.config.ts` |
| WEB-01 | dev tool 폼 env 게이트 | smoke (curl) | `NEXT_PUBLIC_ENABLE_DEV_TOOLS= pnpm --filter @moajoa/web build && pnpm --filter @moajoa/web start &` then `curl -sI http://localhost:3000/boards` → 307 + `Location: /login` | ❌ — Wave 4 adds `redirect()` to `apps/web/app/boards/page.tsx` |
| WEB-02 | env 미설정 web 진입 한정 | manual + smoke | Same as WEB-01 + `curl -sI http://localhost:3000/boards/any-id` → same redirect | ❌ — Wave 4 also patches `boards/[id]/page.tsx` |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 1 has no Wave 0 (no test framework being introduced). Instead, the planner injects the following "infrastructure prerequisites" tasks into Wave 1:

- [ ] `apps/ios/.npmrc` — single-line `node-linker=hoisted` (D-02 scope: ios only)
- [ ] `apps/web/lib/env.ts` — `isDevToolsEnabled()` helper exporting `process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1'`
- [ ] `packages/ui-tokens/src/brand/` directory + `wordmark.svg`, `icon.svg` (outlined paths — no text element per Pitfall C)
- [ ] `packages/ui-tokens/scripts/export-assets.mjs` (sharp-based, idempotent on same machine)
- [ ] `apps/ios/assets/fonts/` directory (currently absent)
- [ ] `apps/web/assets/` directory (currently absent)

These are not tests but missing artifacts the validation map depends on. Wave 0 is considered "complete" when these six paths exist (verified by `test -e` / `test -d`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS app launches on real device | BUILD-01 | Requires Apple developer signing + physical hardware | (path A) `npx expo run:ios --device <udid>` → tap on home screen → app launches past splash. (path B) Install via EAS QR / Expo Orbit → same. |
| NativeWind className visually applies | BUILD-02 | Silent failure invisible to typecheck/build | Open device. The Phase 1 `app/index.tsx` smoke screen MUST show: orange background (`bg-orange-500`), centered white card (`bg-white rounded-2xl p-6`), Pretendard text. If background is white-default or card is unstyled → BUILD-02 fails. |
| App icon, splash, wordmark visible | BUILD-03 | Visual brand check | Device home screen shows MOAJOA icon (orange "M" pin on white, not default Expo). Cold launch shows white splash with orange wordmark for ~1s. |
| Web build with env=`1` shows forms | WEB-01 (positive case) | Authenticated-only path | `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1 pnpm --filter @moajoa/web build && pnpm --filter @moajoa/web start` → log in via existing auth → navigate to `/boards` → "새 보드" button visible. |
| 4-hour timebox switch logged (if triggered) | BUILD-01 (success criterion #3 in ROADMAP) | Behavioral / decision artifact | If path A blocked > 4h: `docs/SESSION-NOTES-YYYY-MM-DD.md` contains a section with hh:mm timestamps, stuck signals from RESEARCH §"4-Hour Timebox Heuristic", and the switch decision. If path A succeeded ≤4h: no log required. |

---

## Validation Sign-Off

- [ ] All Phase 1 requirements (BUILD-01/02/03, WEB-01, WEB-02) have at least one automated **or** manual verification mapped above
- [ ] Sampling continuity: typecheck runs after every task commit
- [ ] Wave 0 (infrastructure prerequisites) complete before Wave 2
- [ ] No watch-mode flags used (CI-free project)
- [ ] Feedback latency < 60s for typecheck, < 180s for build
- [ ] `nyquist_compliant: true` set in frontmatter when all above pass
- [ ] V1..V8 from `01-RESEARCH.md` §"V1..V8 Falsifiable Validation Slices" all checked

**Approval:** pending

---

*Phase: 01-build-unblock-hygiene · VALIDATION drafted 2026-05-25 from `01-RESEARCH.md` §"Validation Architecture".*
