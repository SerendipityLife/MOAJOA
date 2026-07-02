---
phase: 20
slug: affiliate-booking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core, packages/api, apps/web) / jest 29.x (apps/ios, `--watchman=false`) |
| **Config file** | per-package (packages/core, packages/api vitest; apps/ios jest.config) |
| **Quick run command** | `pnpm --filter <changed-package> test` |
| **Full suite command** | `pnpm -r test && pnpm -r typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <changed-package> test`
- **After every plan wave:** Run `pnpm -r test && pnpm -r typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*(planner fills — expected: booking deep-link assembly tests in packages/core, checklist query tests in packages/api)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 시스템 브라우저 쿠키 보존 + 검색 딥링크 실착지 | ATTR-02 / BOOK-03 | Klook/KKday 봇차단(403) — 실기기만 렌더 확인 가능 (RESEARCH confidence LOW 항목) | 실기기에서 카드 탭 → Safari 착지 페이지 확인 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
