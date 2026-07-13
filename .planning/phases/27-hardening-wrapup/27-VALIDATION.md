---
phase: 27
slug: hardening-wrapup
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
updated: 2026-07-14
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
| 27-01 T1 | 27-01 | 1 | SEC-01 | T-27-01/02 | 게이트 스모크 스크립트 (RED — 비멤버 403 단언이 409로 실패) | smoke | `bash supabase/tests/extract_gate_smoke.sh` (RED: exit≠0) | ❌ W0 (이 태스크가 생성) | ⬜ pending |
| 27-01 T2 | 27-01 | 1 | SEC-01 | T-27-01/02/03 | 비멤버 익명 403·claim 오염 0 / 멤버 409 / anon-key 401 (GREEN) + pipeline 무회귀 | smoke + deno unit | `bash supabase/tests/extract_gate_smoke.sh && deno task test` | ✅ (T1 산출) | ⬜ pending |
| 27-01 T3 | 27-01 | 1 | SEC-01(부속) | T-27-05 | revalidate 조건 shared 확장 (재량 채택) | grep + deno unit | `grep -n "visibility === 'shared'" index.ts && deno task test` | ✅ | ⬜ pending |
| 27-02 T1 | 27-02 | 1 | NAME-01 | T-27-06 | "가고싶어" 라이브 잔여 0 + 테스트 동커밋 무회귀 | grep + vitest | `grep -rn "가고싶어" apps/web --include="*.tsx" \| grep -v vote-island \| grep -v map-section` → 0 + `pnpm --filter @moajoa/web test:run` | ✅ | ⬜ pending |
| 27-02 T2 | 27-02 | 1 | NAME-01(문서) | T-27-07 | docs 역할 기술 v2.1 정합 | grep | docs grep 세트 (입력·저장·편집 ≥1, board_id 0 등) | — (grep) | ⬜ pending |
| 27-03 T1 | 27-03 | 2 | SEC-01·NAME-01 | T-27-11 | 배포 정합 (EF version bump + push 완료) | CLI | `supabase functions list \| grep extract-youtube \| grep ACTIVE` + `git log origin/main..main` 0줄 | — | ⬜ pending |
| 27-03 T2 | 27-03 | 2 | SC-3(준비) | — | UAT 문서 소스 4종 누락 0 | grep | 27-HUMAN-UAT.md 키워드 grep 세트 (iPhone·2박3일·presence·403·카카오 승격) | ❌ (이 태스크가 생성) | ⬜ pending |
| 27-03 T3 | 27-03 | 2 | SEC-01 | T-27-08/09/10 | 프로덕션 401/403 무비용 실증 + 비밀값 미기재 | curl + grep | UAT 항목1 `result: pass\|partial` + 토큰 grep 0 | ✅ (T2 산출) | ⬜ pending |
| 27-04 T1 | 27-04 | 3 | SC-3 | T-27-12/13/14 | [Claude] 항목 실증 + presence 판정 → todo 처리 (D-09) | live browser + grep | round 1 엔트리 + result 기록 grep | ✅ | ⬜ pending |
| 27-04 T2 | 27-04 | 3 | SC-3 | T-27-15 | human-only 5건 (카카오·iPhone·유료 2건) | manual (checkpoint) | — (human-verify) | — | ⬜ pending |
| 27-04 T3 | 27-04 | 3 | SC-3 | T-27-12 | 최종 판정 기록 (SC-3 PASS/FAIL 명시 + 집계 정합) | grep | status complete/partial + `SC-3:` 판정 + result 공란 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SEC-01 게이트 스모크 스크립트 (`supabase/tests/extract_gate_smoke.sh` — web_share_smoke.sh 익명 signup 패턴 재사용, ready-링크 멤버=409/비멤버=403 무비용 트릭) → **27-01 Task 1이 담당 (RED 선행)**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 2인극 통합 UAT human-only 5건 (카카오 실로그인·승격·iPhone 실기기·유료 API 2건) | SC-3 + D-07 합류분 | 카카오 실계정·실기기·유료 API 왕복 | 27-HUMAN-UAT.md [human] 항목 — 27-04 Task 2 checkpoint |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (27-04 T2 checkpoint 전후 T1·T3에 automated 존재)
- [x] Wave 0 covers all MISSING references (extract_gate_smoke.sh = 27-01 T1)
- [x] No watch-mode flags (web은 반드시 `test:run` 또는 `CI=true`)
- [x] Feedback latency < 90s (스모크 ~10s · web test:run ~30s · deno ~10s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-14 (planner)
