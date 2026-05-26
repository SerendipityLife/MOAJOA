# Phase 6 Dogfooding Gate — PASS

**Sign-off date:** YYYY-MM-DD
**Dogfooder:** <본인 이니셜>
**Verdict:** PASS (per `.planning/dogfooding/pass-evaluator.md`)

> **How to use:** Phase 6 evaluator가 11/11 ☑️일 때 본 template를 `cp PASS-TEMPLATE.md PASS.md` 후 채움 + commit (`docs(06): pass sign-off YYYY-MM-DD`).

---

## Sign-off (D-22)

| Field | Value |
|-------|-------|
| Dogfooding 기간 | YYYY-MM-DD ~ YYYY-MM-DD (7일) |
| Baseline recall | 0.XX (≥ 0.70 ✓) |
| Baseline precision | 0.XX (≥ 0.75 ✓) |
| Baseline F1 | 0.XX (참고) |
| Day 7 핀 누적 | NN개 (≥ 10 ✓, `hidden_at IS NULL`) |
| p90 extraction duration | NNNN ms (< 30000 ✓) |
| P0 incidents | 0 또는 1 (fix complete ✓) |
| P1 v2 backlog 등록 | N건 → `v2-backlog.md` / GitHub issues |
| 신규 pitfalls PITFALLS.md append | N건 |
| Friend A device + verdict | 예: iOS 18.x ko-KR / 5-5 ✓ |
| Friend B device + verdict | 예: Android 14 ko-KR / 5-5 ✓ |
| Friend A 한 줄 피드백 | "..." |
| Friend B 한 줄 피드백 | "..." |

---

## Phase 1.5 Unlock

- [ ] `ROADMAP.md`에 Phase 1.5 (협업·투표) 항목 status를 "Not started → Unlocked"로 update
- [ ] `STATE.md` "Current Position" 섹션에 Phase 6 complete + 1.5 ready 기록
- [ ] `PROJECT.md` §"Dogfooding Gate" status를 ✓로 update
- [ ] `/gsd-extract-learnings`로 Phase 6 패턴/결정/실수 추출

---

## Artifacts Index (Phase 6 종합)

- Pre-dogfooding checklist: `.planning/dogfooding/pre-dogfooding-checklist.md` (Plan 06-01)
- Sample matrix: `.planning/dogfooding/sample-videos.md` + `samples.json` (Plan 06-02)
- Ground truth: `.planning/dogfooding/ground-truth/sample-*.json` (12 files, Plan 06-02 template)
- Daily log: `.planning/dogfooding/daily-log-YYYY-MM-DD.md` + 7 commits (Plan 06-03 template)
- Baseline: `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md` (Plan 06-05 template)
- Friend share: `.planning/dogfooding/friend-share-checklist.md` + `screenshots/friend-{A,B}/` (Plan 06-04)
- Incidents: `.planning/dogfooding/incidents.md` (Plan 06-03)
- Evaluator: `.planning/dogfooding/pass-evaluator.md` (Plan 06-05)
- New pitfalls: `.planning/research/PITFALLS.md` §"Phase 6 — Dogfooding Gate" (Plan 06-05 anchor)

---

*PASS sign-off per Phase 6 D-22. dogfooding 마지막 day commit으로 Phase 6 close.*
*Document created: 2026-05-26 (Plan 06-05 Task 2)*
