-- p90-duration.sql — Phase 6 D-11 lock (reuses Phase 3 D-11)
--
-- Aggregates extraction_costs.duration_ms per link (SUM across all provider calls
-- for that link) → percentile_cont(0.9) over all completed links since :since.
--
-- Excludes resolve-place calls (link_id IS NULL after Phase 3 0005 migration).
--
-- SAVE-02 target: p90_ms < 30000 (30 seconds). Plan 06-05 pass-evaluator로.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/dogfooding/p90-duration.sql
--   psql "$SUPABASE_DB_URL" -f scripts/dogfooding/p90-duration.sql -v since="'2026-05-26'"
--
-- :since (optional) — ISO date. Default = NOW() - INTERVAL '7 days'.

\if :{?since}
  -- :since provided by caller
\else
  \set since '''' `date -u -v-7d +%Y-%m-%d 2>/dev/null || date -u -d '7 days ago' +%Y-%m-%d` ''''
\endif

SELECT
  percentile_cont(0.9) WITHIN GROUP (ORDER BY total_ms)::int AS p90_ms,
  AVG(total_ms)::int                                        AS avg_ms,
  COUNT(*)                                                  AS n_links
FROM (
  SELECT
    link_id,
    SUM(duration_ms) AS total_ms
  FROM extraction_costs
  WHERE link_id IS NOT NULL
    AND created_at >= COALESCE(:since::timestamptz, NOW() - INTERVAL '7 days')
  GROUP BY link_id
) t
WHERE total_ms IS NOT NULL;
