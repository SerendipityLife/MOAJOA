# Extraction Baseline — YYYY-MM-DD

> **Lock:** D-09 (5-part 구조) + D-06 (precision/recall) + D-07 (6 failure labels)
> **Sample size:** 12 videos (D-03)
> **Authoring:** 수동 (D-08) — `scripts/dogfooding/measure-accuracy.sql` 출력 (Plan 06-03) + `.planning/dogfooding/ground-truth/sample-XX.json` (Plan 06-02) 사람 수동 비교
>
> **How to use:** dogfooding 종료 직후 본 template를 `cp extraction-baseline-TEMPLATE.md extraction-baseline-YYYY-MM-DD.md` 후 5-part 채움.

---

## Part 1: Meta + Sampling decisions

- **Date measured:** YYYY-MM-DD (within dogfooding Day 1~7 or 직후)
- **Samples used:** 12 (`.planning/dogfooding/samples.json` v `<commit-SHA>` as of `<date>`)
- **Sampling matrix (D-04):** 3 categories × 2 cities × 2 lengths × 2 transcript sources × langs (12행 lock)
- **Matching method (D-06):**
  - (a) primary — `google_place_id` 동일
  - (b) fallback — normalized name + city (`replace(/\s/g,'').toLowerCase()` + city 동일)
- **Failure label vocabulary (D-07):** `hallucination` / `wrong_place` / `wrong_city` / `missing_lowconf` / `missing_dropped` / `transcript_fail`

---

## Part 2: Per-video results

| sample_id | url | category | city | gt_count | extracted_count | matched_count | recall | precision | failure_labels |
|-----------|-----|----------|------|----------|-----------------|---------------|--------|-----------|----------------|
| sample-01 | https://youtu.be/XXXX | vlog | seoul |  |  |  |  |  |  |
| sample-02 | https://youtu.be/XXXX | vlog | seoul |  |  |  |  |  |  |
| sample-03 | https://youtu.be/XXXX | vlog | tokyo |  |  |  |  |  |  |
| sample-04 | https://youtu.be/XXXX | vlog | tokyo |  |  |  |  |  |  |
| sample-05 | https://youtu.be/XXXX | food | seoul |  |  |  |  |  |  |
| sample-06 | https://youtu.be/XXXX | food | seoul |  |  |  |  |  |  |
| sample-07 | https://youtu.be/XXXX | food | tokyo |  |  |  |  |  |  |
| sample-08 | https://youtu.be/XXXX | food | tokyo |  |  |  |  |  |  |
| sample-09 | https://youtu.be/XXXX | walk | seoul |  |  |  |  |  |  |
| sample-10 | https://youtu.be/XXXX | walk | seoul |  |  |  |  |  |  |
| sample-11 | https://youtu.be/XXXX | walk | tokyo |  |  |  |  |  |  |
| sample-12 | https://youtu.be/XXXX | walk | tokyo |  |  |  |  |  |  |

**Computation (per row):**
- `recall = matched_count / gt_count`
- `precision = matched_count / extracted_count`
- `failure_labels` = comma-separated `<label>:<count>` for the row's mismatches (예: `hallucination:1, missing_dropped:2`)

---

## Part 3: Aggregate

### Overall (PASS criteria — D-20 #2)

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Overall recall | `SUM(matched_count) / SUM(gt_count)` = ? | ≥ 0.70 | ⬜ |
| Overall precision | `SUM(matched_count) / SUM(extracted_count)` = ? | ≥ 0.75 | ⬜ |
| Overall F1 | `2*r*p/(r+p)` = ? | (bonus) | — |

### By category

| Category | n | recall | precision | dominant failure |
|----------|---|--------|-----------|------------------|
| vlog | 4 |  |  |  |
| food | 4 |  |  |  |
| walk | 4 |  |  |  |

### By city

| City | n | recall | precision | dominant failure |
|------|---|--------|-----------|------------------|
| seoul | 6 |  |  |  |
| tokyo | 6 |  |  |  |

### By transcript source

| Source | n | recall | precision | dominant failure |
|--------|---|--------|-----------|------------------|
| auto | 6 |  |  |  |
| creator | 6 |  |  |  |

---

## Part 4: Top 5 Failure Modes

각 항목 = label + count + 1~2 representative example (sample_id reference + 추출 결과의 wrong/missing place 인용).

1. **<label-1>** (N건) — 예시: sample-XX의 "<place_name>" 케이스. <왜 발생했는지 한 줄>
2. **<label-2>** (N건) — 예시: ...
3. **<label-3>** (N건) — 예시: ...
4. **<label-4>** (N건) — 예시: ...
5. **<label-5>** (N건) — 예시: ...

---

## Part 5: v2 EXTRACT-08 Seeds

본 baseline에서 도출된 v2 evaluation framework 시드:

- [ ] 본 12 `samples.json`을 v2 EXTRACT-08의 regression test set의 초기 세트로 보존
- [ ] failure label top 1~2를 v2 EXTRACT-09 prompt tuning의 우선 ablation target
- [ ] (예: `wrong_city`가 top이면) v2에서 `inferred_city` 기반 region bias 도입 우선
- [ ] (예: `missing_dropped`가 top이면) Phase 2 D-04 citation 강제의 false-negative 분석 우선
- [ ] 자동 매칭 스크립트 (D-08 deferred) 우선순위 1순위 — D-06 (a) place_id + (b) normalized name+city 로직 직접 구현

본 문서가 closed되면 `.planning/dogfooding/pass-evaluator.md` Criterion 2 ☑️ 가능.

---

*Extraction baseline per Phase 6 D-09 / D-06 / D-07 / D-08. ground-truth 비교는 사람 수동 — Plan 06-05의 PASS criterion 2 입력.*
*Document created: 2026-05-26 (Plan 06-05 Task 1)*
