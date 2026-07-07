---
phase: 23
slug: web-first-foundation
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
signed: 2026-07-08
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 01 | 1 | MOA-01 | — | 하네스 자체 (Wave 0 산출) | bash syntax | `bash -n supabase/tests/place_seq_concurrency.sh` | ❌ W0 → 23-01이 생성 | ⬜ pending |
| 23-01-T2 | 01 | 1 | MOA-01 | T-23-01/02 | 채번 트리거 DEFINER+search_path, forge 차단 | static grep | `grep pg_advisory_xact_lock 0024` + append-only diff | ❌ → 23-01이 생성 | ⬜ pending |
| 23-02-T1 | 02 | 1 | AUTH-08 기반 | — | smoke 자체 (Wave 0 산출) | bash syntax | `bash -n supabase/tests/web_share_smoke.sh` | ❌ W0 → 23-02가 생성 | ⬜ pending |
| 23-02-T2 | 02 | 1 | SHARE-03 기반 | T-23-04..09 | join_moa DEFINER·self-join only·헬퍼-only RLS·직접 EXISTS 0 | static grep | 0025 grep (CHECK 값·grant·정책 3종) | ❌ → 23-02가 생성 | ⬜ pending |
| 23-03-T1 | 03 | 1 | AUTH-07/08 기반 | T-23-10 | 시크릿 placeholder만 커밋 | grep | config.toml + .env.local.example grep | ✅ | ⬜ pending |
| 23-03-T2 | 03 | 1 | 기준 5 | — | D26 반전 | grep | `grep -c '보드 생성.*UI 추가' CLAUDE.md` = 0 | ✅ | ⬜ pending |
| 23-04-T1 | 04 | 2 | 기준 1 | T-23-13/09 | [BLOCKING] 실적용 — false-positive 방어, 42P17=0 | integration | `pnpm supabase:reset && pnpm supabase:types` + 기존 스위트 | ✅ (스크립트 존재) | ⬜ pending |
| 23-04-T2 | 04 | 2 | MOA-01 | T-23-01 | 동시성·삭제·forge 실증 | sql-concurrency | `bash supabase/tests/place_seq_concurrency.sh` (PASS + exit 0) | 23-01 산출 | ⬜ pending |
| 23-04-T3 | 04 | 2 | 기준 3·4(로컬) | T-23-04/08 | 익명 is_anonymous + join_moa 분기 + kakao redirect | curl+sql | `bash supabase/tests/web_share_smoke.sh` (PASS + exit 0) | 23-02 산출 | ⬜ pending |
| 23-05-T1 | 05 | 3 | 계약 seam | T-23-14 | ShareMode ↔ 0025 CHECK 문자 잠금 + Zod validate | unit (vitest) | `pnpm --filter @moajoa/core test` | ❌ W0 → TDD로 생성 | ⬜ pending |
| 23-05-T2 | 05 | 3 | MOA-01 미러 | T-23-15 | seq_no·draft refine Zod 강제 | unit (vitest) | `pnpm --filter @moajoa/core test && typecheck` | ❌ W0 → TDD로 생성 | ⬜ pending |
| 23-06-T1 | 06 | 4 | SHARE-03 기반 | T-23-16 | joinMoa — 클라이언트 role 인자 없음 | unit (vitest) | `pnpm --filter @moajoa/api test` | ❌ W0 → TDD로 생성 | ⬜ pending |
| 23-06-T2 | 06 | 4 | SHARE-01 기반 | T-23-17/18 | shareMoa — owner RLS 게이트 + ShareModeType union | unit (vitest) | `pnpm --filter @moajoa/api test && typecheck` | ❌ W0 → TDD로 생성 | ⬜ pending |
| 23-07-T1 | 07 | 5 | Open Q1 | — | 원격 상태 실측 (push 미실행) | cli | `supabase migration list` | ✅ | ⬜ pending |
| 23-07-T2 | 07 | 5 | AUTH-07 기반 | T-23-10/19 | 대시보드·콘솔 — 시크릿 레포 밖 | human-action | 사용자 approved + authorize redirect 확인 | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Nyquist 준수: 자동 커맨드가 없는 태스크는 23-07-T2(human-action 체크포인트) 하나뿐이며, 이는 Manual-Only Verifications에 등재된 사용자 계정 작업. Wave 0 갭(하네스·smoke·신규 테스트 파일)은 전부 해당 산출 플랜(23-01/02/05/06) 안에서 코드와 같은 플랜으로 생성된다.

---

## Wave 0 Requirements

- [ ] SQL 동시성 하네스 스크립트 `supabase/tests/place_seq_concurrency.sh` — 23-01 Task 1이 생성, 23-04 Task 2가 실행 (MOA-01)
- [ ] 익명+join_moa+kakao smoke `supabase/tests/web_share_smoke.sh` — 23-02 Task 1이 생성, 23-04 Task 3이 실행
- [ ] packages/core 신규 스키마 테스트 (chat.test.ts·trip draft·ShareMode 가드·place.test.ts) — 23-05가 TDD로 생성
- [ ] packages/api 신규 쿼리 테스트 (memberships.test.ts·trips.test.ts) — 23-06이 TDD로 생성
- 기존 vitest 인프라(core 143+ tests, api suite)는 그대로 사용 — 프레임워크 설치 불필요

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kakao 대시보드·콘솔 설정 | 카카오 provider 스위치 (기준 4 프로덕션 절반) | 사용자 계정 작업 (Kakao developers console + Supabase 대시보드) | 23-07 Task 2 checkpoint — 완료 후 `https://<ref>.supabase.co/auth/v1/authorize?provider=kakao` → kauth.kakao.com redirect 확인 |
| 원격 익명 sign-in 토글 | 익명 sign-in (프로덕션) | Supabase 대시보드 설정 | 로컬은 23-04 smoke로 검증 완료 — 원격은 대시보드 토글 후 동일 curl |
