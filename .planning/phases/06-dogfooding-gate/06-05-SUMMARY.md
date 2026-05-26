---
phase: 06-dogfooding-gate
plan: 05
subsystem: dogfooding-evaluator
tags: [dogfooding, pass-evaluator, baseline-template, sign-off, pitfalls-anchor]
requires: ["06-01", "06-02", "06-03", "06-04"]
provides: [pass-evaluator, extraction-baseline-template, pass-sign-off-template, pitfalls-phase-6-anchor]
affects: [".planning/dogfooding/", ".planning/research/PITFALLS.md"]
tech_stack:
  added: []
  patterns: ["11-row pass criteria 표 + data source mapping", "4-row fail → next-phase 추천 mapping", "D-09 5-part baseline (Meta/Per-video/Aggregate/Top5/v2 시드)", "decision tree (markdown ASCII)"]
key_files:
  created:
    - .planning/dogfooding/pass-evaluator.md
    - .planning/dogfooding/extraction-baseline-TEMPLATE.md
    - .planning/dogfooding/PASS-TEMPLATE.md
  modified:
    - .planning/research/PITFALLS.md
decisions:
  - "D-20 11 pass criteria lock (1 pre-checklist + 2a/2b recall/precision + 3a/3b commits/핀 + 4a/4b friends + 5a/5b incidents + 6 new pitfall)"
  - "D-21 4 fail conditions → next phase 1-1 mapping (Phase 6.1 추출 / 6.2 안정성 / Phase 4 재진입 / STATE 재점검)"
  - "D-22 sign-off 13 필드 lock"
  - "PITFALLS.md anchor는 idempotent append (existing file에 ## Phase 6 섹션 add)"
metrics:
  duration_min: 3
  completed: "2026-05-26"
  tasks: 2
  files_changed: 4
  commits: 1
---

# Phase 6 Plan 05: Pass-Evaluator + Baseline + Sign-Off Templates Summary

Phase 6 종료 시점에 본인이 Pass/Fail 판정과 sign-off을 단일 문서에서 결정 가능하게 evaluator + 결과 template + PITFALLS 추가 anchor를 준비. Plans 06-01 ~ 06-04 산출물이 본 plan의 입력이며, 본 plan은 dogfooding 종료 시점에 본인이 채워서 close하는 최종 evaluator + sign-off 양식 작성까지.

## Tasks Completed

### Task 1: pass-evaluator.md + extraction-baseline-TEMPLATE.md

- **`pass-evaluator.md`** (66 lines):
  - D-20 11 pass criteria 표 (1 pre-checklist / 2a recall ≥ 0.70 / 2b precision ≥ 0.75 / 3a 7 commits / 3b 핀 ≥ 10 / 4a Friend A 5/5 / 4b Friend B 5/5 / 5a P0 ≤ 1 / 5b P1 v2 mapped / 6 new pitfall ≥ 1) — 각 행에 data source (Plan 06-01~04 파일 경로) 명시
  - D-21 4 fail conditions → next phase 1-1 mapping (Phase 6.1 추출 / 6.2 안정성 / Phase 4 재진입 / STATE 재점검)
  - Decision tree (ASCII flow — All ☑️? → Pass / Any fail trigger? → Fail / 모호 → reclassify)
  - Conclusion 섹션 slot (Date / Verdict / N out of 11 / Failed criteria / Next action)
- **`extraction-baseline-TEMPLATE.md`** (94 lines): D-09 5-part 구조 그대로
  - **Part 1 Meta:** Date / Samples / Matrix lock / Matching method D-06 (a/b) / Failure label vocab D-07 (6종)
  - **Part 2 Per-video:** 10-col 표 (sample_id / url / category / city / gt_count / extracted_count / matched_count / recall / precision / failure_labels) × 12 sample 행 + 계산식 inline
  - **Part 3 Aggregate:** Overall (recall/precision/F1 + threshold + status) + By category (vlog/food/walk) + By city (seoul/tokyo) + By transcript source (auto/creator)
  - **Part 4 Top 5 Failure Modes:** 1~5 슬롯 (label + count + representative example)
  - **Part 5 v2 EXTRACT-08 Seeds:** 5 체크박스 (regression set / prompt tuning ablation / region bias / citation false-negative / auto-matching script)

### Task 2: PASS-TEMPLATE.md + PITFALLS.md anchor

- **`PASS-TEMPLATE.md`** (44 lines): D-22 sign-off 13-row 표 (Dogfooding 기간 / recall / precision / F1 / 핀 누적 / p90 / P0 / P1 v2 / new pitfalls / Friend A device+verdict / Friend B device+verdict / 피드백 × 2) + Phase 1.5 Unlock 4-check (ROADMAP / STATE / PROJECT / `/gsd-extract-learnings`) + Artifacts Index (Plan 06-01~05 산출물 한 곳에서 reference).
- **`PITFALLS.md`** (modified): file end에 `## Phase 6 — Dogfooding Gate` anchor section append (D-19, Success Criterion 5). 기존 섹션은 unchanged. "_Empty until dogfooding starts_" placeholder — dogfooding 중 본인이 발견한 신규 pitfall을 1행씩 추가.

## Verification

- Task 1: `grep` (recall / 0.70 / 0.75 / Friend A / Fail Conditions in pass-evaluator) + `grep` (Top 5 Failure Modes / hallucination / Part 5 in baseline-TEMPLATE) → PASS
- Task 2: `grep` (Sign-off / D-22 / Friend A / Phase 1.5 in PASS-TEMPLATE) + `grep` (Phase 6 in PITFALLS.md) → PASS

## Commits

- `e11400c` — docs(06-05): pass-evaluator + baseline + PASS templates + PITFALLS Phase 6 anchor (4 files, +249)

## Phase 6 Workflow (전체 흐름)

```
[Plans 06-01 ~ 06-04 산출물 — 본 plan의 입력]
   pre-dogfooding-checklist.md (06-01)
   sample-videos.md + samples.json + ground-truth/* (06-02)
   daily-log-template.md + incidents.md + scripts/*.sql + scripts/README (06-03)
   friend-share-checklist.md + screenshots/README (06-04)
       ↓
[Dogfooding Day 0]
   pre-dogfooding-checklist.md 모두 ☑️ + sign-off
   ground-truth/sample-01~12.json 12개 채움 (수동 시청, 평균 5~15분/video)
   daily-log-YYYY-MM-DD.md cp + meta 채움
       ↓
[Dogfooding Day 1~7]
   매일 daily-log Day N 블록 update + commit
   incident 발생 즉시 incidents.md 1행 append
   Day 5~6 친구 2명 share + screenshots/friend-A,B/ 채움 + checklist Friend A/B 블록 close
       ↓
[Dogfooding Day 7+1 — Plan 06-05 산출물 활용]
   scripts/dogfooding/p90-duration.sql + daily-aggregate.sql run → daily-log paste
   scripts/dogfooding/measure-accuracy.sql run → extraction-baseline-YYYY-MM-DD.md Part 2 paste
   ground-truth/*.json + extraction 결과 수동 매칭 → Part 2 recall/precision/failure_labels 채움
   Part 3 Aggregate 계산 + Part 4 Top 5 + Part 5 v2 seeds
   incidents.md End-of-Week Tally 집계
   pass-evaluator.md 11 criteria 평가
       ↓
[Verdict]
   All ☑️ → PASS-TEMPLATE.md cp → PASS.md 채움 + sign-off → ROADMAP/STATE/PROJECT update → Phase 1.5 unlocked
   Any fail trigger → FAIL-YYYY-MM-DD.md + next phase 추천 → Phase 6.x로 ROADMAP add
```

## User-side Actions (Deferred — Phase 6 종료 시점)

본 plan은 template까지 — 실제 update는 dogfooding 종료 시 본인:

- **ROADMAP.md:** Phase 6 status `[ ] → [x]` + 완료일 + Phase 1.5 항목 status를 "Not started → Unlocked"
- **STATE.md:** "Current Position" Phase 6 complete 기록 + "Next action" Phase 1.5 entry
- **PROJECT.md:** §"Dogfooding Gate" status ✓
- **`/gsd-extract-learnings`:** Phase 6 패턴/결정/실수 추출 → docs/SESSION-NOTES-* 또는 .planning/research/ 에 누적

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `.planning/dogfooding/pass-evaluator.md` exists (11 criteria + 4 fail conditions + decision tree + Conclusion)
- `.planning/dogfooding/extraction-baseline-TEMPLATE.md` exists (D-09 5-part)
- `.planning/dogfooding/PASS-TEMPLATE.md` exists (D-22 sign-off)
- `.planning/research/PITFALLS.md` modified (Phase 6 anchor section appended idempotently)
- Commit `e11400c` exists in `git log`
