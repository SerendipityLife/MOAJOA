---
phase: 06-dogfooding-gate
plan: 03
subsystem: dogfooding-tracking
tags: [dogfooding, daily-log, incidents, sql, baseline-measurement]
requires: []
provides: [daily-log-template, incidents-log, p90-sql, daily-aggregate-sql, measure-accuracy-sql]
affects: [".planning/dogfooding/", "scripts/dogfooding/"]
tech_stack:
  added: ["psql parameterized SQL (`-v var=...`)"]
  patterns: ["read-only SELECT", "percentile_cont(0.9)", "window cumulative SUM OVER", "jsonb_agg FILTER", "append-only incidents log"]
key_files:
  created:
    - .planning/dogfooding/daily-log-template.md
    - .planning/dogfooding/incidents.md
    - scripts/dogfooding/p90-duration.sql
    - scripts/dogfooding/daily-aggregate.sql
    - scripts/dogfooding/measure-accuracy.sql
    - scripts/dogfooding/README.md
  modified: []
decisions:
  - "D-10 daily log 양식 lock"
  - "D-11 SQL 3종 lock (p90/daily-aggregate/measure-accuracy)"
  - "D-08 매칭은 사람 수동 — SQL은 데이터 dump까지만"
  - "D-13 places_cumulative는 hidden_at IS NULL만 count"
  - "D-17 4-label policy P0/P1/expected-v1-limit/noise"
metrics:
  duration_min: 4
  completed: "2026-05-26"
  tasks: 2
  files_changed: 6
  commits: 1
---

# Phase 6 Plan 03: Daily Log + Incidents + SQL Scripts Summary

7일 dogfooding tracking 양식과 측정 SQL 스크립트, production incidents 4-label 양식 준비. 측정 자동화는 X (D-08) — 모든 SQL은 본인이 손으로 run + markdown 표에 paste. 일관성이 baseline 신뢰의 핵심.

## Tasks Completed

### Task 1: daily-log-template.md + incidents.md

- **`.planning/dogfooding/daily-log-template.md`** (115 lines): Meta 헤더 (start/end/보드명/board_id/sign-off SHA/samples URLs) + Day 1~7 동일 7 블록 (보드명/링크/추출 성공·실패/수동 핀/공유 활동/이슈/핀 누적/commit SHA) + End-of-Week SQL Snapshot 슬롯 (daily-aggregate + p90-duration + measure-accuracy 각각 command + expected paste) + 7일 Pass/Fail Summary 5-row 표 (7 commits / D-12 / D-13 / p90 / incidents tally).
- **`.planning/dogfooding/incidents.md`** (51 lines): D-17 4-label policy 표 (P0/P1/expected-v1-limit/noise definition + trigger) + Pass impact (D-20/D-21 — P0 ≤ 1 / P0 ≥ 2 → Fail / P1 all v2-backlog) + 5-col incidents 표 (#/Date/Label/Description/Resolution) + 1 example 행 (P1 카톡 OG 캐시 — 실제 incident 발생 시 본인이 삭제) + End-of-Week Tally 슬롯 + reclassification log.

### Task 2: SQL 스크립트 3종 + scripts/dogfooding/README.md

4개 파일:

- **`scripts/dogfooding/p90-duration.sql`** (38 lines): `percentile_cont(0.9)` over `(SELECT link_id, SUM(duration_ms) FROM extraction_costs WHERE link_id IS NOT NULL ...)` — 7일 윈도우 default. `:since` optional `-v` arg. SAVE-02 < 30000ms target.
- **`scripts/dogfooding/daily-aggregate.sql`** (45 lines): CTE 3개 (daily_links / daily_places / all_days UNION) + window SUM OVER (ORDER BY day) for cumulative. **D-13 enforce: `hidden_at IS NULL`.** `:board_id` REQUIRED.
- **`scripts/dogfooding/measure-accuracy.sql`** (44 lines): `jsonb_agg(jsonb_build_object(...))` per link FILTER hidden_at — 9 fields (id/name_local/name_ko/google_place_id/inferred_city/source_kind/confidence/video_offset_sec/quote). `:urls` REQUIRED as Postgres text[].
- **`scripts/dogfooding/README.md`** (88 lines): Setup (psql + Studio fallback) + 3 scripts (언제 run / args / expected output / PASS gate / output destination) + Output destinations summary 표 + Troubleshooting (IPv6, password URL-encode, board_id 모를 때, ARRAY literal escaping).

## Verification

- Task 1: `test -f` + `grep` (Day 7 / p90 / D-13 / P0 / P1 / expected-v1-limit) → PASS
- Task 2: `test -f` × 4 + `grep` (percentile_cont in p90 / hidden_at IS NULL in daily-aggregate / google_place_id in measure-accuracy / SUPABASE_DB_URL in README) → PASS

## Commits

- `c08802a` — docs(06-03): daily log template + incidents + 3 SQL scripts (6 files, +464)

## User-side Actions (Deferred to Dogfooding Day 1~7+1)

- **Day 1 직전:** `cp daily-log-template.md daily-log-YYYY-MM-DD.md` (YYYY-MM-DD = Day 1 시작 일) + board_id + 보드명 채움
- **Day 1~7 매일:** 한 Day 블록 update + commit `docs(06): dogfooding day N log`
- **Day 7 종료 직후:** psql 3 SQL run (`p90-duration` + `daily-aggregate` + `measure-accuracy`) → 결과 paste into daily-log + (measure-accuracy는) `extraction-baseline-YYYY-MM-DD.md` (Plan 06-05 template)
- **Incident 발생 즉시:** `incidents.md`에 1행 append (4-label 중 1개 선택)
- **Day 7 종료:** `incidents.md` End-of-Week Tally 집계 → Plan 06-05 pass-evaluator Criterion 5 입력

## Key SQL queries (reference inline)

**p90-duration.sql core:**
```sql
SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY total_ms)::int AS p90_ms,
       AVG(total_ms)::int AS avg_ms, COUNT(*) AS n_links
FROM (
  SELECT link_id, SUM(duration_ms) AS total_ms
  FROM extraction_costs
  WHERE link_id IS NOT NULL AND created_at >= COALESCE(:since::timestamptz, NOW() - INTERVAL '7 days')
  GROUP BY link_id
) t;
```

**daily-aggregate.sql core (D-13 hidden_at):**
```sql
-- places CTE
SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS places_added
FROM places
WHERE board_id = :board_id::uuid AND hidden_at IS NULL
GROUP BY 1
-- + window: SUM(...) OVER (ORDER BY d.day) AS places_cumulative
```

**measure-accuracy.sql core:**
```sql
SELECT l.url, l.extraction_status,
  COUNT(p.id) FILTER (WHERE p.hidden_at IS NULL) AS extracted_count,
  jsonb_agg(jsonb_build_object(...)) FILTER (WHERE p.id IS NOT NULL AND p.hidden_at IS NULL) AS extracted_places
FROM links l LEFT JOIN places p ON p.link_id = l.id
WHERE l.url = ANY(:urls::text[])
GROUP BY l.id, l.url, l.extraction_status;
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `.planning/dogfooding/daily-log-template.md` exists
- `.planning/dogfooding/incidents.md` exists
- `scripts/dogfooding/p90-duration.sql` exists
- `scripts/dogfooding/daily-aggregate.sql` exists
- `scripts/dogfooding/measure-accuracy.sql` exists
- `scripts/dogfooding/README.md` exists
- Commit `c08802a` exists in `git log`
