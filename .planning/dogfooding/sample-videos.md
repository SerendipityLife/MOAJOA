# Sample Videos for EXTRACT-07 Baseline

**Decision basis:** D-03 (12개) + D-04 (matrix) + D-05 (samples.json schema). See `.planning/phases/06-dogfooding-gate/06-CONTEXT.md` §"Specific Ideas".

> 12 sample 영상 ground-truth가 EXTRACT-07 baseline 측정의 입력. URL은 dogfooding 시작 직전 본인이 채움 — 그 시점에 viewable한 영상만 선정해 unavailability 리스크 회피.

## Selection Matrix (locked per D-04)

| # | sample_id | category | city | length | transcript_lang | transcript_source | URL | ground_truth | notes |
|---|-----------|----------|------|--------|-----------------|-------------------|-----|--------------|-------|
| 1 | sample-01 | vlog | seoul | short | ko | creator | TBD | ⬜ | |
| 2 | sample-02 | vlog | seoul | long  | ko | auto    | TBD | ⬜ | |
| 3 | sample-03 | vlog | tokyo | short | ja | creator | TBD | ⬜ | |
| 4 | sample-04 | vlog | tokyo | long  | ja | auto    | TBD | ⬜ | |
| 5 | sample-05 | food | seoul | short | ko | creator | TBD | ⬜ | |
| 6 | sample-06 | food | seoul | long  | ko | auto    | TBD | ⬜ | |
| 7 | sample-07 | food | tokyo | short | ja | creator | TBD | ⬜ | |
| 8 | sample-08 | food | tokyo | long  | ko | creator | TBD | ⬜ | 한국어 creator의 도쿄 음식 영상 (06-CONTEXT 매트릭스 위반 X — 매트릭스 행 8) |
| 9 | sample-09 | walk | seoul | short | ko | auto    | TBD | ⬜ | |
| 10 | sample-10 | walk | seoul | long  | ko | creator | TBD | ⬜ | |
| 11 | sample-11 | walk | tokyo | short | ja | auto    | TBD | ⬜ | |
| 12 | sample-12 | walk | tokyo | long  | ko | auto    | TBD | ⬜ | 한국어 자막의 도쿄 walk (행 12) |

## Selection Procedure

1. YouTube에서 D-04 매트릭스의 각 (category, city, length, lang, source) 조합에 맞는 영상 검색
2. 다음 기준 우선순위로 후보 좁히기 (Claude's Discretion):
   - **시청 가능 시간:** dogfooding 시점 본인이 보고 ground truth 채울 수 있는 영상 (creator 폐쇄 X, age restriction X, geo-block X 확인)
   - **장소 풍부:** 영상당 평균 5~15개 place 언급 — 너무 적으면 precision 분모 너무 작음, 너무 많으면 ground-truth 시간 폭발
   - **자막 품질:** lang/source 매트릭스에 맞게. auto 자막은 noise 측정용, creator는 best case
   - **length bucket 정의:** short = ≤ 10분 / long = > 10분 (운영 기준)
3. URL 정해지면 표의 URL 칸 + `samples.json` 양쪽에 동기화 (sample_id 일치)
4. ground-truth 작성 진행 상태는 ⬜ → 🟨 (진행 중) → ✅ (완료)로 표 update
5. 모든 12행 ✅이면 baseline 측정 실행 (Plan 06-05 + 본 plan output을 입력으로)

## Out of scope (per D-08)

- 자동 정확도 측정 스크립트 → v2 EXTRACT-08
- precision/recall 자동 매칭 → v2 (D-06 매칭은 v1에서 본인 markdown 수동 비교)

## Status

- Matrix locked: ✓ (D-04)
- URLs filled: 0 / 12 (dogfooding 시작 직전 본인이 채움)
- Ground truth completed: 0 / 12 (`.planning/dogfooding/ground-truth/sample-XX.json` 12개 채움 — 평균 5~15분/video)

---

*Sample matrix per Phase 6 D-03 / D-04 / D-05. URL slot은 의도적 비움 — 영상 unavailability 리스크 회피.*
*Document created: 2026-05-26 (Plan 06-02 Task 1)*
