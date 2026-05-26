-- daily-aggregate.sql — Phase 6 D-11 (daily links + places + cumulative)
--
-- For a single dogfooding board: per-day links_added + places_added + running
-- cumulative places (D-13 enforce: hidden_at IS NULL only).
--
-- D-13 PASS gate: last row's places_cumulative >= 10 by Day 7.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/dogfooding/daily-aggregate.sql \
--     -v board_id="'00000000-0000-0000-0000-000000000000'"
--
-- :board_id — UUID of dogfooding board (single-quoted).
--   To find: psql "$SUPABASE_DB_URL" -c "SELECT id, title FROM boards WHERE owner_id = auth.uid();"

WITH daily_links AS (
  SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)                            AS links_added
  FROM links
  WHERE board_id = :board_id::uuid
  GROUP BY 1
),
daily_places AS (
  SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)                            AS places_added
  FROM places
  WHERE board_id = :board_id::uuid
    AND hidden_at IS NULL
  GROUP BY 1
),
all_days AS (
  SELECT day FROM daily_links
  UNION
  SELECT day FROM daily_places
)
SELECT
  d.day,
  COALESCE(l.links_added, 0)                                       AS links_added,
  COALESCE(p.places_added, 0)                                      AS places_added,
  SUM(COALESCE(p.places_added, 0)) OVER (ORDER BY d.day)           AS places_cumulative
FROM all_days d
LEFT JOIN daily_links  l USING (day)
LEFT JOIN daily_places p USING (day)
ORDER BY d.day;
