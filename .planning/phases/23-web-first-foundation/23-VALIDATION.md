---
phase: 23
slug: web-first-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core, packages/api) + psql SQL 하네스 (supabase local) |
| **Config file** | packages/core/vitest.config.ts · packages/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @moajoa/core test` |
| **Full suite command** | `pnpm --filter @moajoa/core test && pnpm --filter @moajoa/api test && pnpm -r typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @moajoa/core test` (해당 패키지 quick run)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green + `supabase db reset` 클린(0024·0025 포함, 42P17 recursion 0)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> 플래너가 태스크 확정 시 행을 채운다. 아래는 success criteria 기준 골격.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-* | 01 | 1 | MOA-01 | — | 채번 트리거 SECURITY DEFINER, RLS 우회 없음 | sql-concurrency | psql BEGIN…ROLLBACK 하네스 + 동시 INSERT 채번 중복·결번 0 | ❌ W0 | ⬜ pending |
| 23-01-* | 01 | 1 | MOA-01 | — | 소프트삭제·복원 후 seq 유지 | sql | psql 시나리오 (soft-delete→restore→seq 동일) | ❌ W0 | ⬜ pending |
| 23-0x-* | — | — | AUTH-08 기반 | — | 익명 세션 발급 + join_moa role 부여 (share_mode 분기) | curl+sql | curl signup anonymous → psql `select join_moa(...)` 검증 | ❌ W0 | ⬜ pending |
| 23-0x-* | — | — | SHARE-03 기반 | — | join_moa는 SECURITY DEFINER, 직접 EXISTS 0 | sql | `supabase db reset` 클린 + RLS 매트릭스 | ❌ W0 | ⬜ pending |
| 23-0x-* | — | — | 계약 seam | — | 외부 입력 Zod validate | unit | `pnpm --filter @moajoa/core test` (신규 스키마 테스트) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SQL 동시성 하네스 스크립트 (psql/pgbench 기반, RESEARCH.md Validation Architecture 참조) — MOA-01 채번 검증
- [ ] packages/core 신규 스키마 테스트 파일 (TripCreateDraft·chat 스키마·moaChannelName)
- 기존 vitest 인프라(core 143+ tests, api suite)는 그대로 사용 — 프레임워크 설치 불필요

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kakao 대시보드·콘솔 설정 | 카카오 provider 스위치 | 사용자 계정 작업 (Kakao developers console + Supabase 대시보드) | config.toml `[auth.external.kakao]` 설정 후 로컬 OAuth 시작 URL 30x 확인; 원격 대시보드는 human-action |
| 원격 익명 sign-in 토글 | 익명 sign-in | Supabase 대시보드 설정 | 로컬은 config.toml로 검증, 원격은 대시보드 토글 후 curl |
