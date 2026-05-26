-- measure-accuracy.sql — EXTRACT-07 baseline (actual extraction side)
--
-- Per-sample row with extracted places (jsonb agg). Ground truth comparison is
-- done by hand in markdown (D-08 lock — auto-matching is v2 EXTRACT-08).
--
-- Output destination: paste into .planning/dogfooding/extraction-baseline-YYYY-MM-DD.md
-- Part 2 "Per-video results" alongside ground_truth_places from
-- .planning/dogfooding/ground-truth/sample-XX.json (Plan 06-02 산출물).
--
-- Matching criteria (D-06, applied by hand in markdown):
--   (a) primary  — google_place_id 동일
--   (b) fallback — normalized name + city: replace(name, ' ', '').lower() + city
--
-- Failure label vocab (D-07): hallucination / wrong_place / wrong_city /
--                             missing_lowconf / missing_dropped / transcript_fail
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/dogfooding/measure-accuracy.sql \
--     -v urls="ARRAY['https://youtu.be/AAAA','https://youtu.be/BBBB','https://youtu.be/CCCC']"
--
-- :urls — Postgres TEXT[] array of YouTube URLs (samples.json url 칸).

SELECT
  l.url,
  l.extraction_status,
  COUNT(p.id) FILTER (WHERE p.hidden_at IS NULL) AS extracted_count,
  jsonb_agg(
    jsonb_build_object(
      'id',               p.id,
      'name_local',       p.name_local,
      'name_ko',          p.name_ko,
      'google_place_id',  p.google_place_id,
      'inferred_city',    p.inferred_city,
      'source_kind',      p.source_kind,
      'confidence',       p.confidence,
      'video_offset_sec', p.source_timestamp_sec,
      'quote',            p.source_quote
    )
    ORDER BY p.source_timestamp_sec NULLS LAST
  ) FILTER (WHERE p.id IS NOT NULL AND p.hidden_at IS NULL) AS extracted_places
FROM links l
LEFT JOIN places p ON p.link_id = l.id
WHERE l.url = ANY(:urls::text[])
GROUP BY l.id, l.url, l.extraction_status
ORDER BY l.url;
