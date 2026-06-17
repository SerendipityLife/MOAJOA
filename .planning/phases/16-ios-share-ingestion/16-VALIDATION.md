---
phase: 16
slug: ios-share-ingestion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 16-RESEARCH.md "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (preset `jest-expo`) [VERIFIED: apps/ios/jest.config.js] |
| **Config file** | `apps/ios/jest.config.js` |
| **Quick run command** | `pnpm --filter @moajoa/ios test -- <touched file>` (e.g. `share-routing`) |
| **Full suite command** | `pnpm --filter @moajoa/ios test` |
| **Estimated runtime** | ~15 seconds (jest-expo cold ~30s) |

> Pattern for native-touching code: mock `@/lib/shared-defaults` with the in-memory map at `apps/ios/__mocks__/shared-defaults.ts`; mock `@moajoa/api` (`addLink`/`triggerExtraction`/`startExtraction`/`listMyBoards`) and `expo-router` `router`. [VERIFIED: __tests__/pending.test.ts:1-23]

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @moajoa/ios test -- <touched file>`
- **After every plan wave:** Run `pnpm --filter @moajoa/ios test` + `pnpm --filter @moajoa/ios typecheck`
- **Before `/gsd-verify-work`:** Full suite green + manual device UAT (share from YouTube → 1-board auto-navigate; 2-board picker; logged-out linger)
- **Max feedback latency:** 30 seconds (in-process unit tests)

---

## Per-Task Verification Map

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-01 | routing decision (0/1/2+ boards, authed/not) | unit (pure) | `pnpm --filter @moajoa/ios test -- share-routing` | ❌ W0 (`__tests__/share-routing.test.ts`) | ⬜ pending |
| D-02 | logged-out / 0 boards → enqueue(url, null) lingers | unit | `pnpm --filter @moajoa/ios test -- share-handler` | ❌ W0 (mock-based) | ⬜ pending |
| D-05 | webUrl extraction from parsed share payload | unit | `pnpm --filter @moajoa/ios test -- share-payload` | ❌ W0 (feed `parseShareIntent` fixture JSON) | ⬜ pending |
| D-05 | enqueue bridges into existing pending_links | unit | reuse `__tests__/pending.test.ts` + new handler test | ⚠️ partial (pending covered; bridge new) | ⬜ pending |
| D-03 | auto case calls `startExtraction` + navigates | unit | mock `extraction-store` + `expo-router` `router` | ❌ W0 (`__tests__/share-handler.test.ts`) | ⬜ pending |
| native-intent | `redirectSystemPath` returns `/share-handler` for share path, passthrough otherwise | unit (pure, mock `getShareExtensionKey`) | `pnpm --filter @moajoa/ios test -- native-intent` | ❌ W0 (`__tests__/native-intent.test.ts`) | ⬜ pending |
| V5 | inbound `webUrl` Zod-validated http(s) before enqueue | unit | `pnpm --filter @moajoa/ios test -- share-payload` | ❌ W0 | ⬜ pending |
| D-04 | picker → select → add + navigate | manual-only (UI/gesture) | device/sim manual | n/a — UAT | ⬜ pending |
| end-to-end | real share sheet → app → pin | manual-only | EAS device build UAT | n/a — UAT (simulator can't) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ios/lib/share-routing.ts` + `apps/ios/__tests__/share-routing.test.ts` — pure `decideShareRoute` (covers D-01/D-02)
- [ ] `apps/ios/__tests__/share-payload.test.ts` — feed `parseShareIntent` weburl/text fixtures, assert `webUrl` extraction + Zod http(s) guard (V5)
- [ ] `apps/ios/__tests__/native-intent.test.ts` — mock `getShareExtensionKey`, assert redirect vs passthrough
- [ ] `apps/ios/__tests__/share-handler.test.ts` — mock api/extraction-store/router; assert enqueue + branch behavior (D-02/D-03/D-05 bridge)
- [ ] (no framework install needed — Jest + jest-expo already configured)

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Bottom-sheet board picker select → add + navigate | D-04 | UI gesture / sheet mount not reliably testable in-process | On sim/device with 2+ boards: share a YouTube link → picker appears → pick a board → link added + navigated, pin forms |
| Real share sheet → app → pin | end-to-end | Third-party share sheets can't be fully exercised in simulator | EAS dev build on device: YouTube app → Share → 저장 by MOAJOA → app opens, routes per board count |
| Logged-out / 0-board linger | D-02 | Cross-launch persistence + auth state | Logged out: share a link → nothing added; log in + ensure ≥1 board → next drain processes it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (share-routing, share-payload, native-intent, share-handler)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
