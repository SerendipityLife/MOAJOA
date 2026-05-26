# Phase 6 Pass / Fail Evaluator (D-20 / D-21 lock)

> **Lock:** D-20 (Pass 조건 11개 모두 ☑️) + D-21 (Fail 조건 4개 중 하나만 충족 시 fail)
> **Run when:** dogfooding Day 7 종료 후 (마지막 daily-log commit 직후, ~1시간 종합 작업)
> **Output:** Pass → `.planning/dogfooding/PASS.md` 작성 (PASS-TEMPLATE.md copy) → Phase 1.5 진입 가능 / Fail → `.planning/dogfooding/FAIL-YYYY-MM-DD.md` + 어떤 보강 phase 필요한지 본 문서가 결정

---

## Pass Criteria (D-20)

| # | Criterion | Threshold | Data source | Status |
|---|-----------|-----------|-------------|--------|
| 1 | Pre-dogfooding 체크리스트 100% 통과 | 모든 ☑️ + sign-off | `.planning/dogfooding/pre-dogfooding-checklist.md` (Plan 06-01) | ⬜ |
| 2a | Baseline overall recall | ≥ 0.70 | `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md` Part 3 "Overall recall" (Plan 06-02 ground truth + Plan 06-03 measure-accuracy.sql) | ⬜ |
| 2b | Baseline overall precision | ≥ 0.75 | 동일 파일 Part 3 "Overall precision" | ⬜ |
| 3a | 7일 daily-log commit | ≥ 7 (`git log --grep "dogfooding day" --oneline \| wc -l`) | `.planning/dogfooding/daily-log-YYYY-MM-DD.md` (Plan 06-03 양식) | ⬜ |
| 3b | 핀 누적 ≥ 10 (D-13) | Day 7 `places_cumulative >= 10` | `scripts/dogfooding/daily-aggregate.sql` 출력 (`hidden_at IS NULL`) | ⬜ |
| 4a | Friend A 5/5 ☑️ | 모든 체크박스 | `.planning/dogfooding/friend-share-checklist.md` Friend A 블록 (Plan 06-04) | ⬜ |
| 4b | Friend B 5/5 ☑️ | 모든 체크박스 | 동일 파일 Friend B 블록 | ⬜ |
| 5a | P0 incidents ≤ 1 (해당 일 fix 완료) | Count | `.planning/dogfooding/incidents.md` (Plan 06-03 양식) "End-of-Week Tally" P0 | ⬜ |
| 5b | P1 모두 v2 backlog 등록 | 100% mapped | 동일 파일 P1 행의 "Resolution or v2-backlog ref" 칸 모두 채워짐 | ⬜ |
| 6 | 신규 pitfall ≥ 1 PITFALLS.md append | Count | `.planning/research/PITFALLS.md` §"Phase 6 — Dogfooding Gate" 섹션 (본 plan Task 2 anchor) | ⬜ |

**모든 ⬜ → ☑️로 close되어야 Pass.**

---

## Fail Conditions (D-21)

다음 중 **하나라도 발생하면 Fail**:

| Condition | Trigger | Next Phase (자동 추천) |
|-----------|---------|------------------------|
| recall < 0.70 OR precision < 0.75 | Criterion 2a/2b 미달 | **Phase 6.1: 추출 보강** — failure label top 1~2 카테고리에 집중. v2 EXTRACT-08 (자동 eval framework) 시드는 보존 |
| 7일 중 P0 ≥ 2 | Criterion 5a > 1 | **Phase 6.2: 안정성 보강** — P0 incidents 원인 분석 + hotfix를 GSD plan으로 정형화 |
| 친구 1명이라도 OG/모바일 실패 | Criterion 4a 또는 4b 5/5 X | **Phase 4 잔여작업 재진입** — VIEW-* 중 fail한 항목 (예: OG kakao 캐시 vs 실제 buggy?) revisit |
| 7일 미달성 (중도 포기) | Criterion 3a < 7 commit | **STATE 재점검** — 동기 부족 또는 core value 미작동. roadmap reassess |

Fail 시:
1. 본 문서 "Conclusion" 섹션에 어느 fail condition 발동인지 기록
2. 추천된 next phase가 `ROADMAP.md`에 Phase 6.x로 추가
3. `.planning/dogfooding/PASS.md`는 작성 X — 대신 `.planning/dogfooding/FAIL-YYYY-MM-DD.md`로 dogfooding 종료 상태 stamp

---

## Decision Tree (visual)

```
Run pass-evaluator.md
   │
   ├─ All 11 Pass criteria ☑️?
   │       ├─ YES → write PASS.md (D-22) → Phase 1.5 진입 가능
   │       └─ NO → check Fail conditions
   │
   └─ Any Fail condition?
           ├─ YES → write FAIL-YYYY-MM-DD.md + recommend next phase
           └─ NO (criteria 미달이지만 fail trigger도 아님) → 모호 → 수동 판단 + 본인 sign-off로 reclassify
                                                              (대부분 P1 incident가 P0 borderline인 case)
```

---

## Conclusion (dogfooding 종료 시 본인이 채움)

- **Date:** YYYY-MM-DD
- **Verdict:** Pass / Fail (선택)
- **Pass criteria summary:** N / 11 ☑️
- **Failed criteria (if any):** list
- **Next action:**
  - If Pass: `.planning/dogfooding/PASS.md` 작성 (PASS-TEMPLATE.md copy + 채움) + ROADMAP.md Phase 1.5 unlocked 표시
  - If Fail: 추천된 phase + FAIL-YYYY-MM-DD.md 작성 (위 Fail Conditions 표 mapping 참고)

본 문서 작성 + 결과 commit (`docs(06): pass-evaluator verdict YYYY-MM-DD`) → Phase 6 close.

---

*Pass / Fail evaluator per Phase 6 D-20 / D-21. dogfooding 마지막 날 본인이 1시간 안에 종합 평가 가능하게.*
*Document created: 2026-05-26 (Plan 06-05 Task 1)*
