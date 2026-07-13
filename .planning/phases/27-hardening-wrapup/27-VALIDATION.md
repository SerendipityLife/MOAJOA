---
phase: 27
slug: hardening-wrapup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web/core/api) + deno test (EF pipeline) + jest (iOS — 동결, 무접촉) |
| **Config file** | `apps/web/vitest.config` (include `__tests__/**`) · 각 EF `deno.json` tasks.test |
| **Quick run command** | `pnpm --filter @moajoa/web test:run` (web만) / `cd supabase/functions/extract-youtube && deno task test` (EF) |
| **Full suite command** | `CI=true pnpm -r test` (⚠ web bare `test`=watch — CI=true 필수) |
| **Estimated runtime** | ~60초 (풀 스위트) |

---

## Sampling Rate

- **After every task commit:** 변경 워크스페이스 스위트 (`pnpm --filter @moajoa/web test:run` 또는 `deno task test`)
- **After every plan wave:** `CI=true pnpm -r test` + `pnpm -r --parallel run typecheck`
- **Before `/gsd-verify-work`:** 풀 스위트 그린 (기준선: web 267 · core 192 · api 112 · deno EF 31) + `apps/ios` diff 0
- **Max feedback latency:** ~90초

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (플래너가 태스크 확정 시 채움) | — | — | SEC-01 | T-18-09 미러 | 비멤버 익명 세션 extract-youtube 403·claim 오염 0 / 멤버 통과(ready 링크 409) | smoke | 신규 게이트 스모크 (`supabase/tests/`, web_share_smoke.sh 익명 signup 패턴) | ❌ W0 | ⬜ pending |
| (〃) | — | — | SEC-01 | — | EF pipeline 무회귀 | deno unit | `cd supabase/functions/extract-youtube && deno task test` | ✅ | ⬜ pending |
| (〃) | — | — | NAME-01 | — | "가고싶어" 라이브 잔여 0 | grep | `grep -rn "가고싶어" apps/web --include="*.tsx"` → vote-island(dead) 제외 0건 | — | ⬜ pending |
| (〃) | — | — | NAME-01 | — | 변경 파일 테스트 무회귀 | vitest | `pnpm --filter @moajoa/web test:run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SEC-01 게이트 스모크 스크립트 (`supabase/tests/` — web_share_smoke.sh 익명 signup 패턴 재사용, ready-링크 멤버=409/비멤버=403 무비용 트릭)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 2인극 통합 UAT (SC-3 + Phase 25 잔여 + Phase 28 라이브 2건 + presence) | SC-3 | 카카오 실로그인·iPhone 실기기·유료 API 왕복 | 27-HUMAN-UAT.md 체크리스트 (하이브리드 — Claude 브라우저 실증 가능분 선소진) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (web은 반드시 `test:run` 또는 `CI=true`)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
