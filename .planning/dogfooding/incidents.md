# Dogfooding Incidents Log (D-17 / D-18 lock)

> Production 실패 발생 즉시 1행 append. 7일 종료 후 "End-of-Week Tally"를 Plan 06-05 pass-evaluator의 입력으로.
>
> **Append-only:** 발견 즉시 추가. 본 파일 row 수정/삭제 X (감사 추적). resolution이 늦게 결정되면 별도 commit으로 update.

---

## Label policy (D-17)

| Label | Definition | Trigger |
|-------|-----------|---------|
| `P0` | Core flow가 막힘. dogfooding 진행 불가 또는 신뢰 0 | "링크 추가했는데 핀 0개 영구 / 앱 cold launch 흰 화면 / RLS 거부로 본인 보드 접근 불가" |
| `P1` | Core flow 동작은 하지만 UX 손상. dogfooding은 계속 진행 가능 | "OG 카드 한글 깨짐 / step indicator 안 보임 / toast retry 무한 loop / 핀 누락 일부" |
| `expected-v1-limit` | 알려진 v1 범위 한계. 새로 발견된 게 아님 | "협업 투표 미구현 / OAuth 미지원 / 다크모드 X / `/discover` 피드 X" |
| `noise` | 추출 LLM의 일회성 hallucination — pattern 아닌 random | "한 영상에서 wrong_place 1건, 재시도 시 정상 — 재현 불가" |

## Pass impact (D-20 / D-21)

- **P0 ≤ 1** (당일 fix 완료) → Pass 가능
- **P0 ≥ 2** → **Fail** → Phase 6.2 안정성 보강 추천 (per Plan 06-05 pass-evaluator)
- **P1** → 모두 v2 backlog 또는 GitHub issue 등록 → Pass 시 그대로 v2 시드
- **expected-v1-limit** → 그냥 기록만 (Pass 영향 X)
- **noise** → 1~2건 정상, ≥ 3건이면 P1으로 reclassify

---

## Incidents

| # | Date | Label | Description | Resolution or v2-backlog ref |
|---|------|-------|-------------|------------------------------|
| 1 | 2026-MM-DD | P1 (example — 실제 incident 발생 시 본 행 삭제 후 새로 추가) | 카톡에서 미리보기 OG 카드가 옛날 보드 제목으로 캐시됨 (24h Kakao scraper TTL) | v2-backlog #N "보드 제목 변경 시 fresh slug 자동 발급" |

*(빈 행 추가 — 실제 incident 발생 시 # / Date / Label / Description / Resolution 채움)*

---

## End-of-Week Tally (Day 7 종료 시 본인이 집계)

- **P0 incidents:** ___ 건 (모두 fix complete? Y/N)
- **P1 incidents:** ___ 건 (모두 v2-backlog 등록? Y/N)
- **expected-v1-limit:** ___ 건 (기록만 — Pass 영향 X)
- **noise:** ___ 건 (≥ 3이면 P1으로 reclassify 필요)

→ Plan 06-05 `pass-evaluator.md` Criterion 5a / 5b 입력.

---

## Reclassification log (선택)

발견 시점 label을 나중에 바꾸는 경우 (예: noise였는데 같은 pattern 3번 발생 → P1):

| # | Reclassified date | From → To | Reason |
|---|------|-----------|--------|

---

*Incidents log per Phase 6 D-17 / D-18. Append-only — row 수정 X.*
*Document created: 2026-05-26 (Plan 06-03 Task 1)*
