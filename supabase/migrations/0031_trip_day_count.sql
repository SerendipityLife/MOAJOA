-- 0031_trip_day_count.sql — Phase 28 D-08. 기간 pill 저장용 trips.day_count.
--
-- 목적: 날짜가 미정인 모아의 AI 일정 Day 수 소스. Phase 18 엔진의 유일한 결함
--       ("start/end_date가 null이면 무조건 1일 플랜")을 컬럼 하나로 고친다.
--
-- null 의미: 기간 미정. 레거시 모아(0016~0030 시절 생성분)는 전부 null이며,
--            아무 것도 깨지지 않는다 (nullable = 레거시 안전, §4.3).
--
-- 소비자: generate-plan Edge Function — `trip.day_count ?? computeDayCount(start, end)`
--         (D-09, Phase 28-03). day_count가 항상 우선한다. 캘린더로 정확 날짜를 확정하는
--         쓰기 경로는 day_count를 파생값으로 함께 저장해 드리프트를 0으로 유지한다.
--
-- ⚠ 상한 30 결속 (BLOCKER): 이 CHECK의 `30`은 `Limits.TripDayCountMax`
--   (packages/core/src/constants.ts)와 **반드시 같은 숫자**여야 한다. 같은 상한이
--   core Zod(TripSchema/TripCreateDraftSchema/TripUpdateSchema)와 위저드 캘린더 max
--   제약에도 걸려 있다. SQL은 상수를 import할 수 없으므로 이 주석이 유일한 결속 장치다.
--   세 숫자가 어긋나면 정상 입력(장기 여행)이 Zod를 통과해 INSERT까지 갔다가 여기서
--   거부되어 모아 생성이 통째로 실패한다 — 방어가 사용자 기능을 깨는 버그로 변한다.
--   상한을 바꾸려면 constants.ts · 이 CHECK · 캘린더 max 세 곳을 동시에 바꿔라.
--
-- 비용 방어: 임의의 큰 Day 수로 Claude 프롬프트·Routes leg 호출을 부풀리는 경로를
--            DB 레벨에서 차단한다 (T-28-02) — 클라이언트 우회 불가.
--
-- 신규 RLS·트리거·함수 0: trips UPDATE는 기존 0016 "trips: owner full access" 정책을
--   그대로 승계한다 (owner 전용 — editor 멤버는 day_count 쓰기 불가, T-28-01).
--   D-13 기간 게이트 UI를 owner에게만 노출해 심층방어 2겹 (UI-SPEC A-9).
--
-- Append-only (§4.3): 0016..0030 are NEVER modified. 0030은 poll_write_hardening이
--   이미 점유했으므로 이 파일이 0031이다.

alter table trips add column day_count int
  check (day_count is null or (day_count between 1 and 30));

comment on column trips.day_count is
  '여행 기간 Day 수 (1..30, Limits.TripDayCountMax). null = 기간 미정. generate-plan EF가 computeDayCount(start,end)보다 우선 소비 (Phase 28 D-08/D-09).';
