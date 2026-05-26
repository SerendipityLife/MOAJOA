# Dogfooding Daily Log (D-10 / D-11 / D-12 / D-13 lock)

> 7일 dogfooding 중 매일 1 commit으로 update. 양식 고민 없이 동일 골격으로 채워서 baseline 평가 입력으로 사용 (Plan 06-05).
>
> **How to use:** dogfooding Day 1 시작 시 본 template를 `cp daily-log-template.md daily-log-YYYY-MM-DD.md` (YYYY-MM-DD = Day 1 시작 일) 후 채움. 매일 한 Day 블록 update + commit message `docs(06): dogfooding day N log`.
>
> **Pass criteria reference (D-12 / D-13):**
> - D-12: 보드 행위 (링크 추가 / 수동 핀 / 이름 수정 / 공유) ≥ 1회/day (7일 모두)
> - D-13: 핀 누적 ≥ 10 (Day 7 시점, `hidden_at IS NULL`만 count)
> - D-20 #5: `git log --grep "dogfooding day" --oneline | wc -l` ≥ 7

---

## Meta

| Field | Value |
|-------|-------|
| Start date | YYYY-MM-DD |
| End date | YYYY-MM-DD (+6일) |
| 본인 dogfooding 보드명 | "내 일본 여행" 등 |
| board_id (UUID) | (사용자가 `select id, title from boards where owner_id = auth.uid();`로 조회 후 paste) |
| Pre-dogfooding sign-off SHA | `pre-dogfooding-checklist.md` sign-off 시점 commit SHA |
| samples.json URLs filled | YES / NO (Plan 06-02 산출물) |

---

## Day 1 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 성공 N건 / 실패 N건. 실패 사유 inline: (예: `failed - LLM JSON 깨짐, 1회 retry로 ready`)
- **수동 핀 수:** N
- **공유 활동:** (D-12 ≥ 1 보드 행위 증명 — 링크 추가도 카운트됨. 친구 공유는 보너스)
- **발견 이슈:** (`incidents.md` 1행 mirror — label / description 짧게)
- **핀 누적:** N (cumulative `places` count `hidden_at IS NULL`)
- **Day 1 commit:** `docs(06): dogfooding day 1 log` — SHA `<git rev-parse HEAD>`

## Day 2 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** 
- **발견 이슈:** 
- **핀 누적:** N
- **Day 2 commit:** `docs(06): dogfooding day 2 log` — SHA `<git rev-parse HEAD>`

## Day 3 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** 
- **발견 이슈:** 
- **핀 누적:** N
- **Day 3 commit:** `docs(06): dogfooding day 3 log` — SHA `<git rev-parse HEAD>`

## Day 4 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** 
- **발견 이슈:** 
- **핀 누적:** N
- **Day 4 commit:** `docs(06): dogfooding day 4 log` — SHA `<git rev-parse HEAD>`

## Day 5 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** (Day 5~6 권장 — 보드에 ≥ 5 핀 있을 때 친구 share. `friend-share-checklist.md` Plan 06-04 산출물)
- **발견 이슈:** 
- **핀 누적:** N
- **Day 5 commit:** `docs(06): dogfooding day 5 log` — SHA `<git rev-parse HEAD>`

## Day 6 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** 
- **발견 이슈:** 
- **핀 누적:** N
- **Day 6 commit:** `docs(06): dogfooding day 6 log` — SHA `<git rev-parse HEAD>`

## Day 7 — YYYY-MM-DD

- **보드명:** 
- **추가한 링크 수:** N
- **추출 성공/실패:** 
- **수동 핀 수:** N
- **공유 활동:** (Day 7: 보드 전체 review, low-conf 핀 confirm/reject 정리)
- **발견 이슈:** 
- **핀 누적:** N (D-13 ≥ 10 PASS gate)
- **Day 7 commit:** `docs(06): dogfooding day 7 log` — SHA `<git rev-parse HEAD>`

---

## End-of-Week SQL Snapshot

Day 7 종료 시 본인이 SQL 2~3개 run 후 결과 paste. 스크립트는 `scripts/dogfooding/*.sql` (Plan 06-03 산출물).

### daily-aggregate.sql

**Command:**
```bash
psql "$SUPABASE_DB_URL" -f scripts/dogfooding/daily-aggregate.sql -v board_id="'<UUID>'"
```

**Expected output (paste here):**
```
 day        | links_added | places_added | places_cumulative
 -----------+-------------+--------------+------------------
 2026-MM-DD | N           | N            | N
 ...
```

→ D-13 PASS: 마지막 행 `places_cumulative ≥ 10`.

### p90-duration.sql

**Command:**
```bash
psql "$SUPABASE_DB_URL" -f scripts/dogfooding/p90-duration.sql -v since="'YYYY-MM-DD'"
```

**Expected output (paste here):**
```
 p90_ms  | avg_ms | n_links
 --------+--------+--------
 NNNNN   | NNNNN  | NN
```

→ SAVE-02 PASS: `p90_ms < 30000`.

### measure-accuracy.sql (Baseline measurement input)

12 sample 영상 URL을 array로 받아 places 추출.

**Command:**
```bash
psql "$SUPABASE_DB_URL" -f scripts/dogfooding/measure-accuracy.sql \
  -v urls="ARRAY['https://youtu.be/A','https://youtu.be/B',...]"
```

→ 결과는 `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md`에 paste (Plan 06-05 template 사용).

---

## 7일 Pass / Fail Summary

| # | Criterion | Check | Status |
|---|-----------|-------|--------|
| 1 | 7 daily commits | `git log --grep "dogfooding day" --oneline \| wc -l` ≥ 7 | ⬜ |
| 2 | D-12: ≥ 1 보드 행위/day | 각 Day 블록의 "추가한 링크 수" + "수동 핀 수" + "공유 활동" 중 ≥ 1 | ⬜ |
| 3 | D-13: 핀 누적 ≥ 10 | Day 7 places_cumulative ≥ 10 | ⬜ |
| 4 | p90 < 30s | p90-duration.sql 결과 `p90_ms < 30000` | ⬜ |
| 5 | Incidents 정리 | `.planning/dogfooding/incidents.md` "End-of-Week Tally" 채워짐 | ⬜ |

모두 ☑️이면 baseline + friend share + PASS evaluator로 진행 (Plan 06-05).

---

*Daily log template per Phase 6 D-10 / D-11 / D-12 / D-13. Copy → daily-log-YYYY-MM-DD.md → 7회 commit.*
*Document created: 2026-05-26 (Plan 06-03 Task 1)*
