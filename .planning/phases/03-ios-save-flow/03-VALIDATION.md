---
phase: 03
slug: ios-save-flow
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source-of-truth for `workflow.nyquist_validation` gate. Extracted from 03-RESEARCH.md §"Validation Architecture" + plan acceptance criteria.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **iOS Framework** | jest 29.x + jest-expo 54.x + @testing-library/react-native 12.x (installed by Plan 03-01 Task 2) |
| **iOS Config file** | `apps/ios/jest.config.js` (created by Plan 03-01 Task 2) |
| **iOS Setup file** | `apps/ios/jest-setup.ts` (`import '@testing-library/jest-native/extend-expect'`) |
| **iOS Quick run** | `pnpm --filter @moajoa/ios test --passWithNoTests` |
| **iOS Full suite** | `pnpm --filter @moajoa/ios test` |
| **iOS Typecheck** | `pnpm --filter @moajoa/ios typecheck` |
| **Edge Function** | Deno test (no test infra yet — covered by manual `curl` smoke from Plan 03-03) |
| **Estimated runtime** | ~5-10s typecheck, ~5-15s jest |

---

## Sampling Rate (Nyquist)

- **After every task commit:** `pnpm --filter @moajoa/ios typecheck` + relevant jest file (`pnpm --filter @moajoa/ios test <file>`).
- **After every plan wave:** Full `pnpm --filter @moajoa/ios test` + Edge Function deploy smoke (`supabase functions deploy resolve-place` + curl smoke from Plan 03-03 verify block).
- **Before `/gsd-verify-work`:** Full suite green + iOS build smoke (`pnpm --filter @moajoa/ios ios`) + real-device UAT (Plan 03-05 Task 3 checkpoint).
- **Max feedback latency:** ~15s (jest) → no 3 consecutive tasks without automated verify.

---

## Per-Task Verification Map

Maps each phase task to its automated test and the SAVE-* requirement(s) it covers.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SAVE-04, SAVE-05 (foundation) | T-03-01-01 (Tampering migration) | Migration idempotent + partial index preserved | unit (grep) | `grep -q "drop not null" supabase/migrations/0005_*.sql && grep -q "APP_GROUP_ID" packages/core/src/constants.ts && pnpm --filter @moajoa/core typecheck` | ✅ (created by task) | ⬜ pending |
| 03-01-02 | 01 | 1 | SAVE-01..05 (test infra) | — | Test infra loads | smoke | `pnpm --filter @moajoa/ios test --passWithNoTests` | ✅ (created by task) | ⬜ pending |
| 03-02-01 | 02 | 2 | SAVE-03 (Share Extension config) | T-03-02-01 (Tampering App Group ID) | Single-source APP_GROUP_ID | grep | `grep -q "APP_GROUP_ID" apps/ios/app.config.ts && grep -q "expo-share-intent" apps/ios/app.config.ts` | ✅ existing config | ⬜ pending |
| 03-02-02 | 02 | 2 | SAVE-03 (real-device dismiss) | — | Share Extension dismiss < 1.5s | **manual UAT** (Scenario 3 in `docs/manual-uat-phase3.md`) | real-device install + Safari share | ❌ manual only | ⬜ pending |
| 03-03-01 | 03 | 2 | SAVE-05 (resolve-place schema) | T-03-03-01 (Input Validation) | Zod validates query length + numeric ranges | unit | `pnpm --filter @moajoa/core typecheck && grep -q "ResolvePlaceQuerySchema" packages/core/src/schemas/place.ts` | ✅ (created by task) | ⬜ pending |
| 03-03-02 | 03 | 2 | SAVE-05 (Edge Function) | T-03-03-02 (auth) | Bearer token gate + service-role admin | integration (curl smoke) | `curl -X POST $SUPABASE_URL/functions/v1/resolve-place -H "Authorization: Bearer $ANON_KEY" -d '{"query":"스타벅스"}'` returns 200 + places[] | ✅ Edge Function | ⬜ pending |
| 03-03-03 | 03 | 2 | SAVE-05 (rename/delete) | T-03-03-03 (RLS) | renamePlace/deletePlace gated by can_edit_board | unit (TS) | `pnpm --filter @moajoa/api typecheck && grep -q "renamePlace" packages/api/src/queries/places.ts` | ✅ (created by task) | ⬜ pending |
| 03-04-01 | 04 | 3 | SAVE-04 (native module) | T-03-04-01 (App Group sandbox) | UserDefaults(suiteName:) write succeeds | iOS build smoke | `pnpm --filter @moajoa/ios prebuild && cd ios && pod install && cd .. && pnpm typecheck` | ✅ (created by task) | ⬜ pending |
| 03-04-02 | 04 | 3 | SAVE-04 (drain logic) | T-03-04-02 (retry storm) | retry_count > 3 → failed queue, one drain turn = one attempt | **unit** | `pnpm --filter @moajoa/ios test pending.test.ts` | ❌ created by 03-04 Task 2 — Wave 0 stub `apps/ios/__mocks__/shared-defaults.ts` exists | ⬜ pending |
| 03-04-03 | 04 | 3 | SAVE-01 (auth gate) + SAVE-04 (failed banner) | T-03-04-03 (auth bypass) | index.tsx redirects unauthenticated → /login | grep | `grep -q "Redirect" apps/ios/app/index.tsx && grep -q "listFailedPending" "apps/ios/app/(tabs)/boards.tsx"` | ✅ (created by task) | ⬜ pending |
| 03-05-01 | 05 | 4 | SAVE-02 (broadcast handler) | T-03-05-01 (broadcast payload) | mapErrorReason allow-list (4 branches + default) | **unit** | `pnpm --filter @moajoa/ios test realtime.test.ts` | ❌ created by 03-05 Task 1 | ⬜ pending |
| 03-05-02 | 05 | 4 | SAVE-02, SAVE-05 (UI integration) | T-03-05-04 (debounce) | 300ms debounce + adding flag prevents concurrent INSERT | grep + typecheck | `grep -q "subscribeExtractProgress" apps/ios/app/boards/\[id\].tsx && pnpm --filter @moajoa/ios typecheck && pnpm --filter @moajoa/ios test` | ✅ (modified by task) | ⬜ pending |
| 03-05-03 | 05 | 4 | SAVE-01..05 (real-device UAT) | T-03-05-03 (RLS) | **N2 SQL substitute test REQUIRED**: error 42501 on non-member INSERT | **manual UAT + REQUIRED SQL test** (Scenarios 1-5 + N1 + N2 in `docs/manual-uat-phase3.md`) | real-device walkthrough + SQL `set_config('request.jwt.claim.sub', '<other-uuid>', true); insert into places ...` → expect `42501` | ❌ checkpoint:human-verify | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## SAVE-* Requirement → Test File Map

This table answers: "for each requirement, which test files (or manual scenarios) verify it?"

| Requirement | Description | Automated Tests | Manual Gate |
|-------------|-------------|-----------------|-------------|
| **SAVE-01** | Login → boards → board detail | `apps/ios/app/index.tsx` redirect grep (03-04 Task 3); `pnpm --filter @moajoa/ios test` smoke | `docs/manual-uat-phase3.md` Scenario 1 (real-device login walkthrough) |
| **SAVE-02** | URL → 30s pin (p90) | `apps/ios/__tests__/realtime.test.ts` (broadcast handler — 3+ test blocks: channel name, payload routing, returned channel ref) | `docs/manual-uat-phase3.md` Scenario 2 (3 timed runs, max-of-3 ≤ 30s as preliminary p90); Phase 6 SQL aggregate is final |
| **SAVE-03** | Share sheet → 1-tap save | `grep` on app.config.ts + iOS build smoke (Plan 03-02) | `docs/manual-uat-phase3.md` Scenario 3 (real-device Safari share → MOAJOA 저장 toast, dismiss < 1.5s) — **NOT verifiable in simulator** per 03-RESEARCH §Environment Availability |
| **SAVE-04** | Offline enqueue + drain | `apps/ios/__tests__/pending.test.ts` (drainPendingLinks — retry_count++, > 3 → failed queue, dedup) | `docs/manual-uat-phase3.md` Scenario 4 (airplane mode + cold launch drain + foreground drain); N1 (retry > 3 → banner) — either unit test substitute OR live network-fail repro |
| **SAVE-05** | Manual pin search + CRUD | `supabase/functions/resolve-place` curl smoke + `packages/api/src/queries/places.ts` typecheck | `docs/manual-uat-phase3.md` Scenario 5 (+ 핀 → search → marker → rename → delete); **N2 (RLS) SQL substitute test REQUIRED** — `set_config('request.jwt.claim.sub', '<other-uuid>', true); insert into places ...` MUST return error 42501 |

---

## Wave 0 Requirements

These artifacts MUST exist before Wave 1+ tasks can run their unit tests:

- [ ] `apps/ios/jest.config.js` — Jest config with `preset: 'jest-expo'` + `setupFiles: ['./jest-setup.ts']` (Plan 03-01 Task 2 step B)
- [ ] `apps/ios/jest-setup.ts` — `import '@testing-library/jest-native/extend-expect';` (Plan 03-01 Task 2 step C — pinned standard option)
- [ ] `apps/ios/__mocks__/shared-defaults.ts` — in-memory Map mock for App Group UserDefaults (Plan 03-01 Task 2 step D)
- [ ] `apps/ios/__tests__/.gitkeep` — directory marker (Plan 03-01 Task 2 step E)
- [ ] `docs/manual-uat-phase3.md` — 5 numbered scenarios + N1, N2 negative scenarios (Plan 03-01 Task 2 step F)
- [ ] jest devDeps installed via `pnpm --filter @moajoa/ios add -D jest@^29.7.0 jest-expo@~54.0.0 @testing-library/react-native@^12.7.0 @testing-library/jest-native@^5.4.3 @types/jest@^29.5.12 babel-jest@^29.7.0` (Plan 03-01 Task 2 step A)

**Sampling continuity:** Plan 03-01 Task 2 creates ALL test infrastructure before any plan that depends on test files (Plan 03-04 Task 2 = pending.test.ts, Plan 03-05 Task 1 = realtime.test.ts). No Wave 1+ task references a MISSING test target.

---

## Manual-Only Verifications (Real-Device UAT Gates)

These behaviors CANNOT be automated and MUST be verified on a real iPhone via the checklist in `docs/manual-uat-phase3.md`. Real-device UAT is the Phase 3 exit gate.

| Behavior | Requirement | Why Manual | UAT Scenario | Owning Checkpoint |
|----------|-------------|------------|--------------|-------------------|
| Login flow visual + interactive | SAVE-01 | Multi-screen navigation requires real Stack rendering + AsyncStorage + supabase-js session persistence | Scenario 1 | Plan 03-05 Task 3 |
| 30-second URL → pin perception | SAVE-02 | Includes Edge Function latency, network, real Realtime broadcast — too many integration layers for unit tests | Scenario 2 (3 timed runs) | Plan 03-05 Task 3 |
| Share Extension dismiss + toast | SAVE-03 | iOS Share Extension does not work in simulator per Apple + expo-share-intent docs | Scenario 3 | **Plan 03-02 Task 2** (intermediate checkpoint) + Plan 03-05 Task 3 (final) |
| Offline → online drain (cold + foreground) | SAVE-04 | Requires real airplane mode toggle + AppState lifecycle + native SharedDefaults read across processes | Scenario 4 | Plan 03-05 Task 3 |
| + 핀 search + rename + delete UX | SAVE-05 | Requires bottom sheet gesture, marker tap on real MapView, keyboard behavior in pageSheet Modal | Scenario 5 | Plan 03-05 Task 3 |
| N1: retry > 3 → failed banner | SAVE-04 (negative) | Network failure simulation; unit test substitute acceptable (`apps/ios/__tests__/pending.test.ts`) | N1 | Plan 03-05 Task 3 |
| **N2: non-member RLS denial** | SAVE-05 (negative) | RLS enforcement must be proven, not assumed | N2 — **SQL substitute test REQUIRED** (no longer best-effort): error 42501 captured in 03-05-SUMMARY.md | Plan 03-05 Task 3 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies declared (Wave 0 = Plan 03-01 Task 2)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (typecheck + jest run after every task)
- [x] Wave 0 covers all MISSING references (jest infra + mocks + UAT doc all created in Plan 03-01 Task 2)
- [x] No watch-mode flags (`test:watch` script exists but isn't used by any verify block)
- [x] Feedback latency < 30s (typecheck ~5s, jest ~5-15s, grep < 1s)
- [x] N2 (RLS) promoted from best-effort to required SQL substitute test (binary gate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — will be approved by plan-checker after this revision lands.
