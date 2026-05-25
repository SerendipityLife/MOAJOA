---
phase: 06-dogfooding-gate
plan: 01
subsystem: dogfooding-prep
tags: [dogfooding, deferred-consolidation, uat, checklist, infra]
requires: []
provides: [pre-dogfooding-checklist, manual-uat-N2-SQL, evidence-slots]
affects: [".planning/dogfooding/", "docs/manual-uat-phase3.md"]
tech_stack:
  added: []
  patterns: ["4-column 표 (#/항목/검증/상태+증거)", "inline evidence slot (SHA/스크린샷 경로)"]
key_files:
  created:
    - .planning/dogfooding/pre-dogfooding-checklist.md
  modified:
    - docs/manual-uat-phase3.md
decisions: ["D-01/D-02 lock — Phase 3/4/5 deferred work consolidated into single golden checklist"]
metrics:
  duration_min: 3
  completed: "2026-05-26"
  tasks: 2
  files_changed: 2
  commits: 1
---

# Phase 6 Plan 01: Pre-Dogfooding Checklist + Manual UAT N2 SQL Boost Summary

Phase 3/4/5에서 "end-of-phase batch"로 미뤄둔 모든 deferred 작업(supabase db push, env 등록, prebuild, manual UAT)을 단일 골든 체크리스트(`pre-dogfooding-checklist.md`)로 집계하고, Phase 3 manual UAT 문서에 N2 시나리오용 RLS substitute SQL + 7개 시나리오 Evidence 라인을 보강했다.

## Tasks Completed

### Task 1: pre-dogfooding-checklist.md (master golden document)

- `.planning/dogfooding/pre-dogfooding-checklist.md` 신규 (105 lines)
- 4-column 표 형식 (`# / 항목 / 검증 명령·관찰 / 상태 + 증거`)
- D-01 순서(의존성 기반) 그대로 6 섹션:
  - **A. Phase 5 → 인프라** (6 항목: supabase link/db push/backfill verify/types regen with Rule 1 WARN/typecheck/deno check)
  - **B. Phase 4 → 웹 인프라** (7 항목: openssl REVALIDATE_SECRET/Vercel env/Supabase secret/추가 envs/GCP Maps Static API enable/Edge Function deploy/webhook sanity)
  - **C. Phase 3 → iOS prebuild + 실기기 install** (4 항목: prebuild/entitlement grep/pod install/cold launch screenshot)
  - **D. Phase 3 → 실기기 manual UAT** (7 항목: Scenario 1~5 + N1 + N2 REQUIRED binary gate with inline SQL)
  - **E. Phase 4 → 실브라우저 UAT** (4 항목: iPhone Safari/timestamp jump/카톡 OG/Vercel Analytics TTFB)
  - **F. Phase 5 → iOS UAT** (5 항목: 5단계 step indicator/low-conf marker/PinBottomSheet 확인·잘못됨/first board trigger SQL/OnboardCard 영구 dismiss)
- D-02 sign-off 섹션: P0 hotfix 허용 / P1 v2-backlog 등록 / Date+initials slot

### Task 2: docs/manual-uat-phase3.md 보강 (surgical edit)

기존 파일에 2개 변경만 적용 (Karpathy §3.3 — 다른 본문 건드리지 X):
1. **N2 시나리오 본문에 RLS SQL substitute 추가** — `set_config('request.jwt.claim.sub', ...)` + `insert into places (...)` + `-- Expected: ERROR: 42501 insufficient_privilege` code block을 N2 내부에 inline. dogfooding 시점에 그대로 copy해 psql에 paste 가능.
2. **7개 시나리오(1~5 + N1 + N2) 모두에 `- Evidence: ` 라인 append** — dogfooding 시점에 본인이 commit SHA / 스크린샷 경로를 한 줄 inline 기록.

기존 시나리오 본문, 체크박스 상태, 다른 메타데이터는 unchanged.

## Verification

- Task 1: `test -f` + `grep` (A-1, ## D. Phase 3, N2 REQUIRED, Sign-off) + `wc -l = 105 >= 80` → PASS
- Task 2: `grep set_config` + `grep 42501` + `grep -c "Evidence:" = 7 >= 7` → PASS

## Commits

- `1137306` — docs(06-01): pre-dogfooding checklist + manual-uat N2 SQL boost (2 files, +125/-2)

## User-side Actions (Deferred to Dogfooding Day 0)

본 plan은 골든 문서 작성 + N2 SQL 보강까지가 scope. 실제 체크박스 close는 dogfooding 시작 직전 본인이 손으로:
- A 그룹: `supabase login` + `supabase link` + `supabase db push` (migration 0006) + `pnpm supabase:types` + `pnpm typecheck` + `deno check`
- B 그룹: `openssl rand -hex 32` + Vercel env set × 5 + Supabase Edge Function secret set + GCP Maps Static API enable + `supabase functions deploy extract-youtube` + 웹훅 sanity test
- C 그룹: `pnpm --filter @moajoa/ios prebuild` + entitlement grep + `pod install` + 실기기 install (Xcode 또는 EAS)
- D 그룹: docs/manual-uat-phase3.md 시나리오 1~5 + N1 + N2 (REQUIRED — SQL)
- E 그룹: iPhone Safari 열람 + timestamp jump + 카톡 OG + Vercel Analytics
- F 그룹: 5단계 step indicator + low-conf marker + 확인/잘못됨 mutate + first board trigger + OnboardCard

→ 모두 close되면 sign-off 시각 + 본인 이니셜 기록 → dogfooding Day 1 시작 가능.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `.planning/dogfooding/pre-dogfooding-checklist.md` exists (105 lines)
- `docs/manual-uat-phase3.md` modified (N2 SQL inline + 7 Evidence lines)
- Commit `1137306` exists in `git log`
