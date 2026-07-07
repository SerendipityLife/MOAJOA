---
phase: 23-web-first-foundation
plan: 06
subsystem: api
tags: [supabase, typescript, vitest, rpc, tdd]

# Dependency graph
requires:
  - phase: 23-web-first-foundation (23-02/23-04)
    provides: 0025 join_moa RPC·trips.share_mode CHECK + 재생성 database.ts (join_moa Args/Returns, share_mode 타입)
  - phase: 23-web-first-foundation (23-05)
    provides: "@moajoa/core ShareMode/ShareModeType 3값 union (constants.ts, 0025 CHECK 문자 단위 잠금)"
provides:
  - "joinMoa(client, shareSlug) → trip_id — join_moa RPC typed wrapper (Phase 25 닉네임 게이트→익명 인증→join 흐름의 api seam)"
  - "shareMoa(client, tripId, shareMode) → share_slug — visibility 'shared'+share_mode 단일 UPDATE (Phase 24 [함께 정하기] 시트 seam)"
  - "memberships.test.ts·trips.test.ts 신규 — api 테스트 74→81 (joinMoa 3 + shareMoa 4)"
affects: [24-web-map-tab, 25-anon-join, 26-realtime-chat]

# Tech tracking
tech-stack:
  added: []
  patterns: ["rpc-only mock 변형 (ledger.test.ts makeClient에서 chain 없이 rpc: vi.fn()만)", "shareMoa 단일 UPDATE 시맨틱 — early-return 없이 재호출 시 share_mode 갱신 (Open Q3)"]

key-files:
  created:
    - packages/api/src/queries/memberships.test.ts
    - packages/api/src/queries/trips.test.ts
  modified:
    - packages/api/src/queries/memberships.ts
    - packages/api/src/queries/trips.ts

key-decisions:
  - "Open Q3 확정 반영: shareMoa는 shareTrip의 early-return을 제거한 단일 UPDATE — 이미 공유된 모아 재호출 시 share_mode 갱신 허용 (visibility 재설정은 no-op, ensure_share_slug는 기존 slug 재생성 안 함)"
  - "role은 클라이언트 인자 없이 0025 join_moa RPC가 share_mode로 서버 결정 (places/both→editor, dates/null→voter) — T-23-16 mitigate"
  - "shareMode 시그니처는 ShareModeType 3값 union — TS 컴파일 게이트 + DB CHECK 이중 방어 (T-23-18)"

patterns-established:
  - "rpc-only mock: query-builder chain 불필요한 RPC 래퍼 테스트는 { rpc: vi.fn() }만으로 client mock"

requirements-completed: [SHARE-01, SHARE-03] # api seam 기반 — e2e 검증은 Phase 24/25에 매핑

# Metrics
duration: 4min
completed: 2026-07-08
---

# Phase 23 Plan 06: api 계약 seam Summary

**joinMoa(join_moa RPC 래퍼)·shareMoa(visibility+share_mode 단일 UPDATE) 2개 typed query를 TDD RED→GREEN 2사이클로 잠금 — api 74→81 tests 그린, 기존 joinSharedTrip·shareTrip 무수정(iOS 동결)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-07T17:38:26Z
- **Completed:** 2026-07-07T17:42:00Z
- **Tasks:** 2 (TDD — RED/GREEN 커밋 4개)
- **Files modified:** 4 (신규 테스트 2 + 쿼리 파일 2)

## Accomplishments

- **joinMoa** (`memberships.ts`): `client.rpc('join_moa', { p_share_slug })` house 계약(첫 인자 client, `{ error }` throw, `data as string`) — joinSharedTrip 미러에서 RPC 이름만 교체. doc 주석에 서버측 role 결정(D-A1)·멱등·no role promotion(D-A4)·익명 세션 동작 명시
- **shareMoa** (`trips.ts`): `{ visibility: 'shared', share_mode }` 단일 UPDATE → `.eq('id')` → `.select('share_slug')` → `.single()`, slug null이면 `'share_slug not generated'` throw. slug 생성은 0016 ensure_share_slug 트리거 몫 — 추가 RPC 0
- api 테스트 74→81 (joinMoa 3케이스 + shareMoa 4케이스), typecheck exit 0, 기존 전 스위트 무회귀
- 기존 `joinSharedTrip`·`shareTrip` 완전 무수정 — 두 커밋 모두 삭제 라인 0 (trips.ts는 import 확장 1줄만 교체)

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1: joinMoa 쿼리 + 테스트** — RED `e7d457f` (test) → GREEN `fc0971a` (feat)
2. **Task 2: shareMoa 쿼리 + 테스트** — RED `20428e7` (test) → GREEN `a599ea5` (feat)

## Files Created/Modified

- `packages/api/src/queries/memberships.test.ts` — 신규. joinMoa 3케이스 (RPC 이름+payload 단언 / trip_id 반환 / `{ error }` rejects), rpc-only mock
- `packages/api/src/queries/memberships.ts` — joinMoa 추가 (순수 삽입, joinSharedTrip·getMyTripRole·getAcceptedMemberCount 무접촉)
- `packages/api/src/queries/trips.test.ts` — 신규. shareMoa 4케이스 (update payload·eq·select·single 체인 단언 / slug 반환 / slug null throw / `{ error }` rejects), ledger.test.ts makeChain/makeClient 미러
- `packages/api/src/queries/trips.ts` — shareMoa 추가 + import에 `ShareModeType` 확장 (`.js` 확장자 0, §4.5)

## Decisions Made

- **Open Q3 시맨틱 기록:** shareMoa는 shareTrip의 "이미 slug 있으면 early return" 분기를 의도적으로 제거한 단일 UPDATE — 모드 변경 허용, 재호출 멱등 (visibility 'shared' 재설정 no-op + 트리거가 기존 slug 보존). 날짜 확정 모아의 'dates' 숨김은 Phase 24 클라이언트 몫
- 나머지는 plan 그대로 (제공된 코드 스케치 verbatim 사용)

## TDD Gate Compliance

- RED `e7d457f` (3 failed 확인) → GREEN `fc0971a` (77 passed)
- RED `20428e7` (실패 확인) → GREEN `a599ea5` (81 passed)
- REFACTOR 커밋 없음 — 정리 불필요 (house 계약 미러라 최소형)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Verification

| Threat | Disposition | 구현 확인 |
|--------|-------------|----------|
| T-23-16 (joinMoa role 조작) | mitigate | 클라이언트 role 인자 없음 — doc 주석에 "role is decided server-side by share_mode" 명시 |
| T-23-17 (shareMoa 비-owner 호출) | mitigate | doc 주석에 "Owner-only by trips UPDATE RLS" 명시 — api 우회 경로 없음 (익명 키) |
| T-23-18 (shareMode 임의 문자열) | mitigate | 시그니처 `ShareModeType` 3값 union — TS 게이트 + DB CHECK 최종 방어 |

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 24 [함께 정하기] 시트: `shareMoa(client, tripId, mode)` import 가능 — 모드 변경 재호출 시맨틱 확정
- Phase 25 닉네임 게이트→익명 인증→참여: `joinMoa(client, slug)` import 가능 — role 분기는 서버(0025) 검증 완료(23-04 smoke)
- 남은 플랜: Wave 5 = 23-07 (human-action — 원격 마이그레이션 상태 확인·대시보드·Kakao console)

## Self-Check: PASSED

- 생성 파일 3개 실존 (memberships.test.ts·trips.test.ts·SUMMARY)
- 커밋 4개 실존 (e7d457f·fc0971a·20428e7·a599ea5), 삭제 파일 0

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*
