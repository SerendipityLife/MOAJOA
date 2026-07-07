---
phase: 23-web-first-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, migration, trigger, advisory-lock, concurrency, plpgsql]

# Dependency graph
requires:
  - phase: 16-trips-baseline (0016)
    provides: places/trips 테이블 + DEFINER/search_path 트리거 idiom + places hard DELETE 정책(카운터 채택 근거)
provides:
  - supabase/migrations/0024_place_seq.sql — places.seq_no + trips.last_place_seq 카운터 + backfill + assign_place_seq() advisory-lock DEFINER 트리거 (미적용, 23-04에서 reset)
  - supabase/tests/place_seq_concurrency.sh — MOA-01 4시나리오 동시성 하네스 (미실행, 23-04에서 실행)
affects: [23-04 (BLOCKING 적용 게이트 — reset+typegen+하네스 실행), 23-05 (core 계약), 23-06 (api 계약), phase-24 (웹 장소 표면)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "순번 채번 = 단조증가 카운터(trips.last_place_seq) + pg_advisory_xact_lock(trip 스코프) — max+1 금지"
    - "트리거 함수 DEFINER + set search_path = public (0016 handle_new_auth_user idiom)"
    - "supabase/tests/ bash SQL 하네스 — superuser psql로 RLS 우회하되 트리거 발화 검증"

key-files:
  created:
    - supabase/migrations/0024_place_seq.sql
    - supabase/tests/place_seq_concurrency.sh
  modified: []

key-decisions:
  - "max(seq_no)+1 금지 — places hard DELETE 정책(0016)이 실존해 최고 순번 재사용 위험, 카운터 방식만 허용"
  - "assign_place_seq()는 SECURITY DEFINER 필수 — editor/익명 멤버는 trips UPDATE RLS 없음(invoker면 insert 실패)"
  - "backfill tiebreak=id (같은 추출 배치 created_at 동률), hidden 행 포함(순번 영구성)"
  - "grant execute 불필요 — 트리거 함수는 직접 호출 표면 없음"

patterns-established:
  - "advisory-lock 채번: pg_advisory_xact_lock(hashtextextended('place_seq:'||trip_id, 0)) → UPDATE…RETURNING INTO NEW"
  - "마이그레이션 정합 순서: nullable 추가 → backfill → not null 승격 → unique 인덱스 → 카운터 동기화 → 트리거"

requirements-completed: [MOA-01]

# Metrics
duration: 8min
completed: 2026-07-08
---

# Phase 23 Plan 01: Place Seq 채번 기반 Summary

**MOA-01 순번 영구 채번의 DB 기반 — trips.last_place_seq 카운터 + advisory-lock SECURITY DEFINER 트리거를 담은 0024 마이그레이션과 4시나리오 동시성 하네스 (적용·실행은 23-04 게이트)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-07T17:00:12Z
- **Completed:** 2026-07-07T17:08:00Z
- **Tasks:** 2
- **Files modified:** 2 (모두 신규)

## Accomplishments
- `0024_place_seq.sql`: places.seq_no + trips.last_place_seq(단조증가) + 기존 행 backfill(created_at 순, tiebreak=id, hidden 포함) + `assign_place_seq()` BEFORE INSERT 트리거(advisory xact lock + DEFINER + search_path 핀) + `places_trip_seq_key` unique 인덱스 — 한 파일 완결
- `place_seq_concurrency.sh`: (1) 동시 40건 8-way 무중복·무결번 (2) soft-delete 복원 순번 유지 (3) hard-delete 후 번호 무재사용 (4) 클라이언트 seq_no forge 차단 — 전부 exit code 단언하는 자기완결 하네스
- append-only 준수: 0016~0023 diff 0줄

## Task Commits

Each task was committed atomically:

1. **Task 1: MOA-01 동시성 하네스 스크립트 작성 (Wave 0)** - `d0f937a` (test)
2. **Task 2: 0024_place_seq.sql 마이그레이션 작성** - `7b91755` (feat)

## Files Created/Modified
- `supabase/migrations/0024_place_seq.sql` - seq_no 컬럼 + 카운터 + backfill + advisory-lock DEFINER 채번 트리거 (레포 최초 채번 마이그레이션)
- `supabase/tests/place_seq_concurrency.sh` - MOA-01 4시나리오 검증 하네스, 실행 권한 부여됨 (`test -x` 통과)

## Decisions Made
None - followed plan as specified (핵심 결정은 플랜에 선잠금: 카운터 방식·DEFINER·A7 네이밍)

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 0024 + 하네스 준비 완료 — 23-04 [BLOCKING] 게이트에서 `supabase db reset` + `pnpm supabase:types` + 하네스 실행으로 런타임 검증 (colima 선행 필요)
- 이 플랜 단독으로 "적용됨"을 주장하지 않음 — 로컬 DB 스키마는 아직 0023 상태
- Wave 1 병렬 형제 플랜: 23-02(0025 share_mode 등), 23-03(config 스위치)

## Threat Model Compliance
- T-23-01 (seq_no forge): 트리거가 클라이언트 값 무시 + unique(trip_id, seq_no) — 하네스 (4)가 단언 ✓
- T-23-02 (DEFINER elevation): search_path=public 핀 + 단일 UPDATE 문장 + 인자 없는 트리거 함수(호출 표면 없음, grant 미부여) ✓
- T-23-03 (advisory lock DoS): accept — trip 스코프 락, xact 종료 시 자동 해제 ✓

## Self-Check: PASSED

- 0024_place_seq.sql 존재 ✓ · 하네스 존재+실행권한 ✓ · 커밋 d0f937a/7b91755 존재 ✓ · 파일 삭제 0 ✓

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*
