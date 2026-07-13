---
phase: 28
slug: add-trip-redesign-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web: jsdom + @testing-library, api/core: node) |
| **Config file** | `apps/web/vitest.config.ts` (include `__tests__/**` — 테스트는 반드시 `apps/web/__tests__/`에, 25-02/25-04 선례) |
| **Quick run command** | `pnpm --filter @moajoa/web test -- --run <파일>` |
| **Full suite command** | `pnpm --filter @moajoa/web test -- --run` + `pnpm --filter @moajoa/api test` + `pnpm --filter @moajoa/core test` + `pnpm --filter @moajoa/ios test`(무회귀 확인용) |
| **Estimated runtime** | ~90 seconds (패키지 순차) |

---

## Sampling Rate

- **After every task commit:** 해당 영역 파일 단위 `pnpm --filter @moajoa/web test -- --run <파일>`
- **After every plan wave:** web+api+core 전 스위트 `--run` + `tsc --noEmit` + `next build`
- **Before `/gsd-verify-work`:** 전 스위트(core·api·web·ios) 그린 + build PASS + grep 게이트(iOS diff 0 · 기존 마이그레이션 무수정 · `.js` import 0 · 신규 hex 0)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(플래너가 PLAN.md 작성 시 채움 — SC-1~6 → 28-RESEARCH.md `## Validation Architecture`의 Test Map 기준)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/plan-section.test.tsx` — SC-4 Day 그룹/게이트 (plan fixture 포함)
- [ ] `apps/web/__tests__/select-pill.test.tsx` (신규 컴포넌트 채택 시) — SC-1 선택 상태
- [ ] `apps/web/__tests__/duration-gate-sheet.test.tsx` — D-13 기간 미정 게이트
- [ ] 프레임워크 설치: 불필요 (기존 vitest 하네스)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실 generate-plan N-Day 생성·진행 broadcast | SC-4 | 유료 API(Claude·Routes)·realtime — jsdom 불가 | 로컬 supabase + `functions serve` 스모크 → 배포 후 UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
