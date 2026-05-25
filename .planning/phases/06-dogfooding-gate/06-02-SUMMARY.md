---
phase: 06-dogfooding-gate
plan: 02
subsystem: dogfooding-prep
tags: [dogfooding, ground-truth, sample-videos, baseline-input]
requires: []
provides: [sample-matrix, ground-truth-template, ground-truth-guide]
affects: [".planning/dogfooding/ground-truth/", ".planning/dogfooding/samples.json"]
tech_stack:
  added: []
  patterns: ["sample_id 일치 (md ↔ json ↔ ground-truth file)", "TBD URL slot (dogfooding-time fill)", "high/medium/low confidence_label"]
key_files:
  created:
    - .planning/dogfooding/sample-videos.md
    - .planning/dogfooding/samples.json
    - .planning/dogfooding/ground-truth/_template.json
    - .planning/dogfooding/ground-truth/README.md
  modified: []
decisions:
  - "D-03 (12 영상) + D-04 (3 cat × 2 city × 2 length × 2 lang/source matrix) + D-05 (samples.json schema) lock"
  - "URL은 dogfooding 시작 직전 본인이 채움 — 영상 unavailability 회피"
metrics:
  duration_min: 2
  completed: "2026-05-26"
  tasks: 2
  files_changed: 4
  commits: 1
---

# Phase 6 Plan 02: Sample 12 Videos + Ground-Truth Template Summary

EXTRACT-07 baseline 측정의 입력이 되는 12개 sample 영상 매트릭스, samples.json schema, ground-truth 작성 템플릿 + README를 준비. URL과 ground_truth 내용은 dogfooding 시작 직전 본인이 채움 (영상 unavailability + 본인 시청 시점 적합도 확보).

## Tasks Completed

### Task 1: sample-videos.md (12 영상 매트릭스 + 작업 상태)

- `.planning/dogfooding/sample-videos.md` 신규 (54 lines)
- D-04 매트릭스 12행 그대로 (sample-01 ~ sample-12) + URL 칸은 TBD slot × 12 + ground_truth 진행 상태 ⬜→🟨→✅
- Selection Procedure (영상 선정 기준 + length bucket 정의 short ≤10분 / long >10분)
- Out of scope (D-08 — 자동 매칭은 v2 EXTRACT-08)
- Status 카운터 (URLs 0/12, ground_truth 0/12)

### Task 2: samples.json + ground-truth/_template.json + ground-truth/README.md

3개 파일 동시 생성:

- **samples.json** (135 lines): D-05 schema 12 entries — JSON parse 통과, `id` / `category` / `city` / `length_bucket` / `transcript_lang` / `transcript_source` / `ground_truth_places: []` / `notes`. URL은 빈 string (dogfooding 시점에 sample_id로 sample-videos.md와 동기화).
- **ground-truth/_template.json** (24 lines): 한 영상의 ground truth 한 entry 템플릿. `confidence_label` 필드 high/medium/low 포함. `cp _template.json sample-XX.json` 후 채움.
- **ground-truth/README.md** (56 lines): per-video procedure (8 steps — copy template / 메타 / 수동 시청 1.5x / Google Maps place_id 검색 / confidence_label 기준 / first_mention_sec / notes / completed_*). Matching with extraction 섹션 (D-06 a primary place_id + b fallback normalized name+city + 6 failure label 분류). Quality bar (gt_count ≥ 3, place_id ≥ 80%). v1 out-of-scope (시간 구간, 발화자, 긍/부정 라벨).

## Verification

- Task 1: `test -f` + `grep sample-01/sample-12/TBD ×12/D-04` → PASS
- Task 2: `samples.json` JSON.parse → 12 entries ✓ + 각 entry id/category/city/Array(ground_truth_places) ✓; `_template.json` confidence_label 필드 ✓; `README.md` google_place_id 언급 ✓ → PASS

## Commits

- `ed9f644` — docs(06-02): sample 12 videos matrix + ground-truth template + README (4 files, +269)

## User-side Actions (Deferred to Dogfooding Day 0)

본 plan은 schema + 가이드 작성까지가 scope. 실제 채움은 dogfooding 본인 작업:

- **URL 12개 채움:** dogfooding 시점에 viewable한 YouTube 영상 12개 선정 → sample-videos.md TBD slot + samples.json `url: ""` 양쪽 sample_id로 동기화 (예상 10~20분 일회성)
- **ground_truth/sample-XX.json 12개 채움:** 영상당 평균 5~15분 × 12 = 약 1~3시간 일회성. 평균 5~15 places × 12 = 약 100 pair. → Plan 06-05의 baseline 평가 입력
- **Recommended timing:** dogfooding Day 0 (pre-dogfooding-checklist.md sign-off 직전 또는 직후). 영상 선정과 ground-truth 작성을 동일 시점에 두는 게 sample 일관성에 유리.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `.planning/dogfooding/sample-videos.md` exists
- `.planning/dogfooding/samples.json` exists (JSON valid, 12 entries)
- `.planning/dogfooding/ground-truth/_template.json` exists
- `.planning/dogfooding/ground-truth/README.md` exists
- Commit `ed9f644` exists in `git log`
