---
phase: 06
slug: dogfooding-gate
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-26
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for Phase 6 (Dogfooding Gate).
> Phase 6는 본질적으로 verification gate — 신규 production 코드 X, 모든 작업이 문서/SQL/checklist 작성 + 본인 수동 수행.
> 따라서 본 validation은 (a) plan 산출물 파일 존재/구조 검증 (automated) + (b) dogfooding 본인 수행 단계 (manual, by design).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | shell grep + file existence checks (no jest/vitest — Phase 6 산출물은 markdown/sql/json) |
| **Config** | N/A — plan별 `<verify><automated>` block이 single-line grep chains |
| **Quick run (any plan)** | `bash <plan's verify command>` — 모두 ≤ 5초 |
| **Full suite** | Plans 06-01 ~ 06-05의 verify commands 5개를 순차 실행 — ≤ 30초 |
| **Manual UAT** | dogfooding 본인 수행 (D-12 7일 + D-15 친구 2명) — Phase 6 본질 |

---

## Sampling Rate (Nyquist)

- **After every task commit:** plan의 verify block (grep chain) — 즉시 사실 검증
- **After every plan:** plan SUMMARY 작성 시 verify 결과 paste
- **Before `/gsd-verify-work`:** 5개 plan의 verify 모두 green + 본인이 6-01 Sign-off 시작 가능 신호
- **Before Phase 6 close:** Plan 06-05 pass-evaluator.md 11 criteria 모두 ☑️ (manual, by design)
- **Max feedback latency:** ~5s (grep) for plan산출물; ~7 days for dogfooding execution itself (D-12 lock)

---

## Per-Task Verification Map

Maps Phase 6 plan tasks to their automated verification and EXTRACT-07 coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | EXTRACT-07 (pre-dogfooding gate doc) | T-06-01-01 (migration push tamper) | append-only confirmed in checklist | grep | `test -f .planning/dogfooding/pre-dogfooding-checklist.md && grep -q "## D. Phase 3" && grep -q "N2 (REQUIRED" && wc -l ≥ 80` | ✅ (created by task) | ⬜ pending |
| 06-01-02 | 01 | 1 | EXTRACT-07 (UAT N2 SQL inline) | T-06-01-05 (false-positive RLS check) | 42501 expected outcome explicit | grep | `grep -q "set_config" docs/manual-uat-phase3.md && grep -q "42501" && grep -c "Evidence:" ≥ 7` | ✅ (modified by task) | ⬜ pending |
| 06-02-01 | 02 | 1 | EXTRACT-07 (sample matrix) | T-06-02-03 (URL unavailability) | URLs as TBD slot — chosen at dogfooding time | grep | `grep -q "sample-12" .planning/dogfooding/sample-videos.md && grep -c "TBD" ≥ 12` | ✅ (created by task) | ⬜ pending |
| 06-02-02 | 02 | 1 | EXTRACT-07 (ground truth schema) | T-06-02-01 (manual auth err) | confidence_label weighting available | json+grep | `node -e "const a=require('./.planning/dogfooding/samples.json'); if(a.length!==12)process.exit(1)" && grep -q "confidence_label" .planning/dogfooding/ground-truth/_template.json` | ✅ (3 files created) | ⬜ pending |
| 06-03-01 | 03 | 1 | EXTRACT-07 (daily-log + incidents) | T-06-03-03 (commit 누락) | 7-commit grep check inlined in template | grep | `grep -q "Day 7" .planning/dogfooding/daily-log-template.md && grep -q "P0\|P1\|expected-v1-limit" .planning/dogfooding/incidents.md` | ✅ (2 files created) | ⬜ pending |
| 06-03-02 | 03 | 1 | EXTRACT-07 (measurement SQL) | T-06-03-01 (board_id leak) | SELECT-only SQL; hidden_at IS NULL gate | grep | `grep -q "percentile_cont" scripts/dogfooding/p90-duration.sql && grep -q "hidden_at IS NULL" scripts/dogfooding/daily-aggregate.sql && grep -q "google_place_id" scripts/dogfooding/measure-accuracy.sql` | ✅ (4 files created) | ⬜ pending |
| 06-04-01 | 04 | 1 | EXTRACT-07 (friend share form) | T-06-04-01 (chat leak in screenshot) | "What NOT to include" rule explicit | grep | `grep -q "Friend A" .planning/dogfooding/friend-share-checklist.md && grep -q "Friend B" && grep -q "비로그인" && wc -l ≥ 50` | ✅ (created by task) | ⬜ pending |
| 06-04-02 | 04 | 1 | EXTRACT-07 (screenshot naming) | T-06-04-02 (PII in meta) | locale labeling rule explicit | grep | `grep -q "friend-A" .planning/dogfooding/screenshots/README.md && grep -q "locale" && grep -q "D-16"` | ✅ (created by task) | ⬜ pending |
| 06-05-01 | 05 | 2 | EXTRACT-07 (pass evaluator + baseline template) | T-06-05-02 (misread metrics) | calculation formula inline | grep | `grep -q "0.70" .planning/dogfooding/pass-evaluator.md && grep -q "0.75" && grep -q "Fail Conditions" && grep -q "Top 5 Failure Modes" .planning/dogfooding/extraction-baseline-TEMPLATE.md` | ✅ (2 files created) | ⬜ pending |
| 06-05-02 | 05 | 2 | EXTRACT-07 (PASS sign-off + PITFALLS anchor) | T-06-05-03 (PII leak via PITFALLS) | "general description, no friend-A label" policy in plan | grep | `grep -q "D-22" .planning/dogfooding/PASS-TEMPLATE.md && grep -q "Phase 6" .planning/research/PITFALLS.md` | ✅ (created/appended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## EXTRACT-07 → Test File Map

Phase 6의 유일한 requirement.

| Requirement | Description | Automated Tests | Manual Gate |
|-------------|-------------|-----------------|-------------|
| **EXTRACT-07** | Sample 영상 10~20개에 대한 expected/actual 비교 baseline 측정 결과 문서화 | (a) Plan 06-02 산출물 (samples.json 12 entry + ground-truth/ template) — `node -e "require('./samples.json').length===12"`<br>(b) Plan 06-03 measure-accuracy.sql — `grep "google_place_id"`<br>(c) Plan 06-05 extraction-baseline-TEMPLATE.md — `grep "Top 5 Failure Modes"` | (a) 12 ground-truth/<sample-XX>.json 본인이 채움 (평균 2시간 일회성)<br>(b) Plan 06-05 pass-evaluator.md Criterion 2a/2b ☑️ — recall ≥ 0.70 AND precision ≥ 0.75 (D-20)<br>(c) `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md`가 D-09 5-part 구조로 작성 |

---

## Wave 0 Requirements

Phase 6는 production 코드 변경 X이므로 Wave 0 별도 의존성 X. 모든 plan이 directory(`.planning/dogfooding/`, `scripts/dogfooding/`) 생성으로 시작 가능.

**Setup steps (executor will mkdir if missing):**

- [x] `.planning/dogfooding/` (Plans 06-01 ~ 06-05 모두 사용)
- [x] `.planning/dogfooding/ground-truth/` (Plan 06-02)
- [x] `.planning/dogfooding/screenshots/` (Plans 06-01 evidence + 06-04)
- [x] `scripts/dogfooding/` (Plan 06-03 SQL)

**Sampling continuity:** Plans 06-01 ~ 06-04 (Wave 1)은 file-disjoint이라 병렬 실행 가능. 06-05 (Wave 2)는 prior 4개 산출물을 reference하지만 그것들의 파일 path만 알면 되므로 hard dependency는 path 합의(본 VALIDATION 표)에 있음.

---

## Manual-Only Verifications (Dogfooding 본인 수행 — by design)

이 단계들은 자동화 X — Phase 6 본질이 "본인이 실제로 사용한다"이므로.

| Behavior | Requirement / D-XX | UAT Scenario | Owning Plan |
|----------|---------------------|--------------|-------------|
| Pre-dogfooding 체크리스트 모두 ☑️ | D-01/D-02 | `.planning/dogfooding/pre-dogfooding-checklist.md` 모든 섹션 A~F + Sign-off | 06-01 (양식 작성) |
| 12 ground-truth/<sample-XX>.json 채움 | D-05 | `.planning/dogfooding/ground-truth/sample-{01..12}.json` 모두 작성 | 06-02 (template) |
| 7일 daily-log + commit | D-10/D-12 | `git log --grep "dogfooding day" --oneline \| wc -l ≥ 7` | 06-03 (template) |
| 핀 누적 ≥ 10 by Day 7 | D-13 | `psql -f scripts/dogfooding/daily-aggregate.sql` Day 7 places_cumulative | 06-03 (SQL) |
| 친구 2명 share 검증 5/5 ☑️ | D-14/D-15 | `.planning/dogfooding/friend-share-checklist.md` Friend A + Friend B 모두 ☑️ + screenshots/friend-{A,B}/ 4종 | 06-04 (form) |
| Baseline 측정 markdown 작성 | D-09 | `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md` 5 parts 모두 채워짐 | 06-05 (template) |
| Pass evaluator close + Sign-off | D-20/D-22 | `.planning/dogfooding/pass-evaluator.md` 11 criteria ☑️ + `.planning/dogfooding/PASS.md` 작성 | 06-05 (evaluator + template) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (grep chains, ≤ 5s)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (directories created by tasks themselves; no prior test scaffold needed)
- [x] No watch-mode flags (no test runners in Phase 6)
- [x] Feedback latency < 30s (grep < 1s, json parse < 1s)
- [x] Manual gates explicitly enumerated as dogfooding-本인 수행 (by design — Phase 6 본질)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — will be approved after Plans 06-01 ~ 06-05 PASS verify blocks during execution.
