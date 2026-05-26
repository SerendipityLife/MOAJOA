# Dogfooding SQL Scripts

> Phase 6 dogfooding tracking + EXTRACT-07 baseline 측정용 SQL 모음.
> 모든 SQL은 read-only (SELECT only). 모든 매칭은 사람 수동 (D-08) — SQL은 데이터 dump까지만.

## Setup

### psql (recommended)

```bash
# 환경변수 — Supabase Dashboard → Project Settings → Database → Connection string
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# Connection test
psql "$SUPABASE_DB_URL" -c "SELECT current_user, version();"
```

### Supabase Studio (alternative — GUI)

Dashboard → SQL Editor → 본 디렉토리 `.sql` 파일 내용 paste → 인자(`:board_id` 등)는 hardcode로 치환 후 Run.

## Scripts

### 1. `p90-duration.sql` — Save-flow p90 측정 (SAVE-02 PASS gate)

**언제 run:** Day 7 종료 직후 (전체 7일치 측정).

**Args:**
- `-v since="'YYYY-MM-DD'"` (optional) — ISO date. 미지정 시 `NOW() - INTERVAL '7 days'`.

**Expected output:**
```
 p90_ms | avg_ms | n_links
--------+--------+--------
  18432 |  12015 |     14
```

**PASS:** `p90_ms < 30000` (SAVE-02 30s target).

**Output destination:** `.planning/dogfooding/daily-log-YYYY-MM-DD.md` §"End-of-Week SQL Snapshot".

### 2. `daily-aggregate.sql` — 일자별 links / places + 핀 누적 (D-13 PASS gate)

**언제 run:** Day 7 종료 직후 (전체 7일치 daily breakdown 한 번에).

**Args:**
- `-v board_id="'<UUID>'"` (REQUIRED) — dogfooding 보드 UUID.
  - 모를 때: `psql "$SUPABASE_DB_URL" -c "SELECT id, title FROM boards WHERE owner_id = auth.uid();"`

**Expected output:**
```
    day     | links_added | places_added | places_cumulative
------------+-------------+--------------+-------------------
 2026-MM-DD |           3 |            7 |                 7
 2026-MM-DD |           2 |            4 |                11
 ...
```

**PASS (D-13):** 마지막 행 `places_cumulative >= 10` AND 모든 places는 `hidden_at IS NULL`.

**Output destination:** `.planning/dogfooding/daily-log-YYYY-MM-DD.md` §"End-of-Week SQL Snapshot".

### 3. `measure-accuracy.sql` — EXTRACT-07 baseline (extraction side dump)

**언제 run:** 12 sample 영상의 URL을 본인이 dogfooding 보드에 모두 추가한 후 (= 자연스러운 사용 흐름에 합치되 sample 12개는 의도적으로 따로 보드를 만들거나 dogfooding 보드에 섞어도 됨).

**Args:**
- `-v urls="ARRAY['https://youtu.be/A','https://youtu.be/B',...]"` (REQUIRED) — `samples.json`의 `url` 12개를 Postgres array literal로.

**Expected output:** 12행 (영상당 1행) — `url / extraction_status / extracted_count / extracted_places (jsonb)`.

**다음 단계 (사람 수동, D-08):**
1. 본 SQL 결과를 `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md` Part 2 "Per-video results" 표에 paste (extracted_count + extracted_places).
2. 같은 표의 ground_truth 칸은 `.planning/dogfooding/ground-truth/sample-XX.json`에서 본인이 row by row 채움.
3. D-06 (a) `google_place_id` 동일 → match. (b) normalized name+city → match. 둘 다 안 맞으면 D-07 failure label 1개 부여.

**Output destination:** `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md` (Plan 06-05 template).

## Output destinations summary

| Script | Paste to | When |
|--------|----------|------|
| `p90-duration.sql` | `daily-log-YYYY-MM-DD.md` §End-of-Week SQL | Day 7 |
| `daily-aggregate.sql` | `daily-log-YYYY-MM-DD.md` §End-of-Week SQL | Day 7 |
| `measure-accuracy.sql` | `extraction-baseline-YYYY-MM-DD.md` Part 2 | After dogfooding |

## Troubleshooting

**`SUPABASE_DB_URL` 연결 실패:**
- IPv6 issue: Supabase pooler(`*.pooler.supabase.com:5432`) 사용 (direct host `db.<ref>.supabase.co`는 IPv6-only 환경에서 hang)
- Password 특수문자: URL-encode 필요 (`@` → `%40`)

**`board_id` 모를 때:**
```sql
SELECT id, title, created_at FROM boards WHERE owner_id = auth.uid() ORDER BY created_at DESC;
```

**`measure-accuracy.sql` 결과가 비어 있음:**
- 본인이 그 URL을 보드에 추가 안 했음 — dogfooding 중 12 sample URL을 보드에 add link 했는지 확인
- `extraction_status='processing'` 또는 `'pending'`이면 아직 추출 안 끝남 — 30초 후 재시도

**`psql:` cannot parse ARRAY literal:**
- macOS zsh: 작은따옴표 escaping 주의. 차라리 Studio에서 paste + literal 치환이 안전

---

*SQL scripts per Phase 6 D-08 / D-11. Read-only — RLS는 본인 session 내에서만.*
*Document created: 2026-05-26 (Plan 06-03 Task 2)*
