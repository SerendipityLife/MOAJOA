---
phase: 27-hardening-wrapup
plan: 01
subsystem: api
tags: [supabase, edge-functions, deno, rls, security, membership-gate, revalidate]

# Dependency graph
requires:
  - phase: 18-ai-day-planner
    provides: generate-plan T-18-09 멤버십 게이트 패턴 (can_edit_trip 미러, service-role 쿼리)
  - phase: 23-web-first-foundation
    provides: web_share_smoke.sh 빌딩 블록 (익명 signup·psql 시드·HTTP code 단언)
  - phase: 24-share-view
    provides: revalidate webhook (fire-and-forget, visibility 조건)
provides:
  - extract-youtube 멤버십 게이트 — 비멤버(익명 세션 포함) 403, claim UPDATE·유료 파이프라인 앞 차단 (SEC-01)
  - supabase/tests/extract_gate_smoke.sh — 401/403/409 3단 스모크 (유료 API 발화 0)
  - revalidate webhook 'shared' visibility 발화 (shareMoa 공유 모아 SSR 캐시 무효화)
affects: [27-03 (EF 배포), 27-04 (통합 UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EF 멤버십 게이트: can_edit_trip 미러를 service-role 쿼리로 (auth.uid() null 회피) — 첫 DB 쓰기 앞 배치"
    - "무비용 게이트 스모크: extraction_status='ready' 링크로 claim 실패(409) 유도 — 유료 API 발화 0"

key-files:
  created:
    - supabase/tests/extract_gate_smoke.sh
  modified:
    - supabase/functions/extract-youtube/index.ts

key-decisions:
  - "게이트 스모크를 web_share_smoke.sh append 대신 신규 소형 스크립트로 분리 (RESEARCH Open Q3 — 기존 파일 이미 6케이스)"
  - "revalidate visibility 확장은 명시적 || 비교 사용 — includes()는 TS narrowing을 깨 trip.share_slug 접근이 타입 에러"
  - "기존 trip fetch를 게이트 위치로 통합(owner_id 컬럼 추가) — from('trips') 1회 유지, !trip 404 강화 (FK cascade상 실질 무영향)"

patterns-established:
  - "EF cold-start 504: functions serve 직후 첫 요청은 504 가능 — 스모크 전 warm-up curl 1회"

requirements-completed: [SEC-01]

# Metrics
duration: 40min
completed: 2026-07-13
---

# Phase 27 Plan 01: extract-youtube 멤버십 게이트 (SEC-01) Summary

**generate-plan T-18-09 게이트를 extract-youtube claim UPDATE 앞에 이식해 비멤버 익명 세션의 유료 추출 트리거를 403으로 차단하고, revalidate webhook을 visibility='shared'에도 발화하도록 확장 — 로컬 스모크 401/403/409 실증.**

## Performance

- **Duration:** ~40 min (인프라 복구 ~25분 포함 — 실 구현은 ~15분)
- **Started:** 2026-07-13T15:10:40Z
- **Completed:** 2026-07-13T15:50:58Z
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- **SEC-01 해소:** 익명 세션도 auth.getUser를 통과하는 갭 — 비멤버가 public_trip_view로 노출된 link_id만으로 유료 LLM 왕복(Anthropic + Places)을 트리거하던 경로를 403으로 차단. 게이트는 claim UPDATE(첫 DB 쓰기) 앞이라 extraction_status 오염(T-27-02)도 동시 차단.
- **무회귀 실증:** anon-key 원시 토큰 401(T-18-08), 멤버(owner) 409(ready 링크 재추출 거부) — 로컬 스모크 3단 전부 PASS, 유료 API 발화 0.
- **revalidate 갭 1줄 해소:** shareMoa는 visibility='shared'로 UPDATE하는데 webhook은 'public'만 발화 → 공유 모아의 추출 완료가 SSR 캐시(1h TTL)를 안 깨우던 문제. 같은 파일 재배포 편승, 별도 커밋으로 diff 추적.

## Task Commits

Each task was committed atomically:

1. **Task 1: 게이트 스모크 스크립트 (RED)** - `2a20a97` (test) — 단언 (2)가 409로 FAIL exit 1 확인 (게이트 부재 실증)
2. **Task 2: 멤버십 게이트 이식 (GREEN)** - `e3af285` (feat) — 스모크 PASS + deno test 54 passed 0 failed
3. **Task 3: revalidate 'shared' 확장** - `04f4531` (fix) — 1파일 2줄(조건+주석), deno test 54 그린 유지

## Files Created/Modified

- `supabase/tests/extract_gate_smoke.sh` (신규, 실행권한) — 401/403/409 3단 게이트 스모크. ready 링크 + 비멤버 익명 세션(join_moa 미호출) 시드, 유료 API 발화 0
- `supabase/functions/extract-youtube/index.ts` — (1) `callerId` 상수 신설 (2) 멤버십 게이트(KNOWN_SOURCES 뒤·claim 앞) + 기존 trip fetch 통합(`owner_id, city_code, share_slug, visibility` select, `eq('id', link.trip_id)`) (3) revalidate 조건 `public || shared`

## Verification Results

- `bash supabase/tests/extract_gate_smoke.sh` → exit 0, `PASS: extract gate smoke (401/403/409)` (Task 3 이후 재실행 포함)
- `deno task test` (extract-youtube) → **54 passed, 0 failed** — 플랜 기준선 "31 pass"는 Phase 28 검증 시점 수치, 이후 스위트가 확장됨. 실패 0으로 무회귀 확인
- `git diff --stat -- supabase/migrations apps/ios packages/` → 0파일 (마이그레이션 0 · iOS 동결 · 클라이언트 무변경 D-02)
- 게이트 위치: 마지막 `canEdit` L137 < `STALE_PROCESSING_MS` L148 (claim 앞) · `board_id` 0건 · `from('trips')` 1회
- 커밋 3개 시퀀스: test(RED) → feat(GREEN) → fix ✓
- 3커밋 범위 파일 삭제 0

## TDD Gate Compliance

- RED: `2a20a97` (test) — 비멤버 단언이 409로 실패함을 실행 로그로 확인
- GREEN: `e3af285` (feat) — 같은 스모크 exit 0
- REFACTOR: 불필요 (수술적 이식 — 정리 대상 없음)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] colima/docker edge runtime 컨테이너 wedge 복구**
- **Found during:** Task 1 (RED 실행)
- **Issue:** EF 요청이 응답 없이 hang → Kong 150s 타임아웃 504. edge runtime 컨테이너가 `docker kill/rm` 불가(no exit event), `colima restart`·`colima status`까지 hang — VM guest 자체가 응답 불가 상태 (코드 문제 아님, 6/21부터 떠 있던 VM의 상태 부패).
- **Fix:** `limactl stop -f` (LIMA_HOME=~/.colima/_lima) → `colima start` → stale 컨테이너 제거 → `supabase stop && start` → `supabase functions serve extract-youtube --env-file ./supabase/.env.local` 재기동. warm-up curl 후 401 정상 응답(4.5s) 확인.
- **Files modified:** 없음 (인프라만)
- **Commit:** 해당 없음

이 외 계획 그대로 실행 — 코드 deviation 0.

## Known Stubs

없음 — 게이트·revalidate 조건 모두 실동작 배선 완료.

## Threat Flags

없음 — 이 플랜의 threat_model(T-27-01~05) 범위 내 변경만. 신규 endpoint·auth 경로·스키마 변경 0. (T-27-04 resolve-place getUser 부재는 D-03 잠금대로 무접촉 — CONTEXT Deferred 유지.)

## Next Phase Readiness

- **27-03 (배포):** 이 플랜은 로컬 검증만 — `supabase functions deploy extract-youtube` 프로덕션 반영은 27-03 몫 (Pitfall 1: 머지 ≠ 배포).
- **27-04 (UAT):** shared 모아 revalidate 라이브 발화는 SSR 갱신으로 겸사 검증 예정.

## Self-Check: PASSED

- FOUND: supabase/tests/extract_gate_smoke.sh (실행권한 포함)
- FOUND: supabase/functions/extract-youtube/index.ts 게이트 (canEdit)
- FOUND: commit 2a20a97 / e3af285 / 04f4531
