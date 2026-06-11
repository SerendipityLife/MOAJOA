-- =============================================================================
-- 0010_extraction_started_at
-- =============================================================================
-- links.extraction_started_at — set when the extractor claims a link
-- (extraction_status → 'processing').
--
-- Why: if the Edge Function dies between the claim and its catch handler
-- (wall-clock timeout, isolate eviction), the link is wedged in 'processing'
-- forever and every retry is rejected. This timestamp lets the claim query
-- treat stale 'processing' rows (older than the extractor's runtime ceiling)
-- as reclaimable.
--
-- NULLABLE on purpose: backward-compatible, no downtime (CLAUDE.md §4.3).
-- Rows claimed by pre-0010 code have NULL — the extractor treats those as
-- reclaimable too, so legacy wedged rows self-heal on the next trigger.
-- =============================================================================

alter table links add column extraction_started_at timestamptz;
