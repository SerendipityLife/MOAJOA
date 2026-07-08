-- 0026_realtime_publication.sql — Phase 24 Host Flow (D-14 postgres_changes)
--
-- 결정 기록:
--   D-14: 추출 완료 실시간 반영은 Supabase Realtime postgres_changes (presence 금지).
--   postgres_changes는 supabase_realtime publication 멤버십이 전제 — 이 레포의 어떤
--   마이그레이션도 테이블을 등록한 적 없음 (grep 0건). 등록 없이는 구독이
--   SUBSCRIBED 상태로 이벤트 0건 무음 no-op (RESEARCH Pitfall 2).
--   범위: places(INSERT 반영) + links(extraction_status UPDATE 반영)만.
--   votes는 Phase 25 몫(0027) — D-14가 places/links만 잠갔다 (RESEARCH Open Q3).
--
-- 42P17/RLS: 이벤트는 구독자 JWT로 WALRUS가 RLS(can_read_trip 계열, 0016) 평가 —
--   publication 등록은 노출 표면일 뿐 필터는 기존 SELECT 정책이 담당. 신규 정책 0.
--
-- Append-only: 0016..0025 are NEVER modified.

alter publication supabase_realtime add table places;
alter publication supabase_realtime add table links;
