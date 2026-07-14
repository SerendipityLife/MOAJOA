---
phase: 29-chat-unification
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-definer, rpc, migration, vitest, smoke-test]

# Dependency graph
requires:
  - phase: 25-guest-shared-surface
    provides: "0029 cast_date_vote_authed grant 선례·web_share_smoke.sh 익명 세션 idiom·joinMoa 래퍼 계약"
  - phase: 26-realtime-chat
    provides: "trip_messages RLS(0025)·0028 user_id BEFORE-INSERT 트리거·realtime publication"
provides:
  - "0032 join_moa_by_poll_code DEFINER RPC — poll_code bearer → trip voter self-join (slug 미경유, visibility 게이트 없음 — 레거시 private dateless-poll trip 커버)"
  - "joinMoaByPollCode typed wrapper (packages/api — joinMoa verbatim 미러)"
  - "database.ts에 join_moa_by_poll_code Functions 타입 (typegen 재생성)"
  - "web_share_smoke.sh (7) — voter join·bad code 400·voter trip_messages POST 201/GET 200 실증 (CHAT-04 DB 측)"
affects: [29-02, 29-03, 29-04, chat-unification, poll-guest-island]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DEFINER RPC 안전장치 5종 (bearer 검증·self-join auth.uid·owner 가드·on conflict do nothing 멱등·search_path 핀+authenticated grant만) — 0025 join_moa 계승"]

key-files:
  created:
    - supabase/migrations/0032_join_moa_by_poll_code.sql
  modified:
    - packages/api/src/types/database.ts
    - supabase/tests/web_share_smoke.sh
    - packages/api/src/queries/memberships.ts
    - packages/api/src/queries/memberships.test.ts

key-decisions:
  - "poll_code 자체를 bearer로 사용 (D-03a) — slug 노출은 bearer 스코프 분리(0018) 붕괴라 기각"
  - "0032에 visibility·poll status 게이트 없음 — 레거시 private dateless-poll trip 커버 + 채팅은 trip 소속(A-8, 마감 후 대화 유지)"
  - "role 고정 'voter' — poll_code는 dates 시맨틱 (join_moa D-A1 dates 분기 미러), share_mode 분기 없음"
  - "grant authenticated만 (anon grant 0) — 익명이라도 세션 필수 (0029 cast_date_vote_authed 선례)"

patterns-established:
  - "smoke (7): fresh 익명 세션으로 join 실증 — 기존 JWT는 선행 섹션에서 이미 멤버라 신규 세션 발급 후 role 단언"

requirements-completed: [CHAT-04, CHAT-05]

# Metrics
duration: 7min
completed: 2026-07-14
---

# Phase 29 Plan 01: poll_code Bearer Voter Join 백엔드 Summary

**join_moa_by_poll_code DEFINER RPC(0032, append-only) + joinMoaByPollCode typed 래퍼 + voter trip_messages RLS 통과 smoke 실증 — /poll 방문자가 slug 없이 poll_code만으로 통일 채팅 저장소에 합류하는 유일한 신규 백엔드 완비**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-14T00:35:34Z
- **Completed:** 2026-07-14T00:42:30Z
- **Tasks:** 3
- **Files modified:** 5 (created 1 + modified 4)

## Accomplishments

- **0032 마이그레이션 (append-only):** `join_moa_by_poll_code(p_code)` — poll_code bearer → `date_polls join trips` 서버 파생 → voter 멤버십 INSERT. join_moa(0025) 안전장치 5종 전부 계승 (bearer 검증·self-join auth.uid·owner 가드·`on conflict do nothing` 멱등·search_path 핀 + authenticated grant만). 신규 RLS 정책 0 — 42P17 무관. 0016~0031 무접촉 (plan 커밋 범위 diff 0 확인).
- **로컬 실증:** `supabase db reset` 0016→0032 클린 적용(42P17 0건) → typegen 재생성 — diff가 `join_moa_by_poll_code` Functions 타입 additive **1줄뿐** (스키마-중립 확인).
- **smoke (7) append-only (53줄 추가·0줄 삭제):** fresh 익명 세션이 (a) poll_code로 join HTTP 200 + `memberships.role='voter'` psql 단언, (b) bad code(`nope`) HTTP 400, (c) voter role로 trip_messages POST **201** + GET **200**(≥1건) — CHAT-04의 DB 측 실증(RESEARCH Q3 "voter는 role-무관 정책 통과" 런타임 확인). 기존 (1)~(6) 무회귀, 전체 exit 0.
- **joinMoaByPollCode 래퍼 (TDD RED→GREEN):** joinMoa verbatim 미러 — RPC명·`{ p_code }` 인자만 교체. api 115/115 그린 + typecheck 0, 기존 함수 본문 diff 0 (pre-Task 대비 순수 additive 18/0).

## Task Commits

Each task was committed atomically:

1. **Task 1: 0032_join_moa_by_poll_code.sql 생성** - `7841600` (feat)
2. **Task 2: 로컬 적용 — db reset + typegen + smoke (7)** - `4c53a70` (test)
3. **Task 3: joinMoaByPollCode 래퍼 (TDD)** - `155dbad` (test, RED) → `f7761e6` (feat, GREEN)

## Files Created/Modified

- `supabase/migrations/0032_join_moa_by_poll_code.sql` - poll_code bearer voter self-join DEFINER RPC (신규, append-only)
- `packages/api/src/types/database.ts` - typegen 재생성 (join_moa_by_poll_code Functions 타입 1줄 additive)
- `supabase/tests/web_share_smoke.sh` - 섹션 (7) append: voter join + trip_messages RLS 프로브
- `packages/api/src/queries/memberships.ts` - `joinMoaByPollCode` append (기존 함수 무수정)
- `packages/api/src/queries/memberships.test.ts` - `join_moa_by_poll_code` describe 3케이스 append

## Decisions Made

None - followed plan as specified (0032 SQL은 RESEARCH Q1 스펙 verbatim, 래퍼는 joinMoa verbatim 미러).

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 3 (`tdd="true"`): RED `155dbad`(test — 클라이언트 미접촉 throw 스텁으로 behavioral 2/3 실패, 임포트 에러 아님) → GREEN `f7761e6`(feat — 115/115 그린). REFACTOR 불필요 (verbatim 미러라 정리 대상 0).

## Known Stubs

None — RED 단계의 throw 스텁은 GREEN에서 실구현으로 교체 완료. 하드코딩 빈 값·placeholder 0.

## Issues Encountered

None.

## User Setup Required

**원격 push는 이 plan 범위 밖** — 0032 원격 적용은 human-action 게이트(29-04 Task 3 몫, main push 시 Supabase↔GitHub 자동 적용 관례). 라이브 /poll join은 배포 후 동작 (25-01 선례).

## Requirements Note

`requirements mark-complete CHAT-04 CHAT-05` → not_found — CHAT-04 계열 ID는 phase 29 RESEARCH가 ROADMAP Success Criteria에서 신규 발급한 축으로 REQUIREMENTS.md에 미등록. 이 plan은 CHAT-04/05의 **DB 측 전제**만 전달(웹 측은 29-02~04) — REQUIREMENTS.md 등록·완료 마킹은 phase verify-work 몫으로 이관.

## Next Phase Readiness

- Wave 3(29-04 /poll 래퍼)가 탐색 없이 import할 typed seam 완비: `joinMoaByPollCode` + database.ts 타입.
- voter role의 trip_messages RLS 통과가 로컬 DB에서 실증됨 — Wave 3 false-positive 위험 해소.
- 레거시 private dateless-poll trip(visibility='private'·slug null)도 poll_code bearer로 커버됨 — /poll 전 표면 대응.

## Self-Check: PASSED

- 산출물 6파일 전부 존재 (0032 SQL·database.ts·smoke·memberships.ts/.test.ts·SUMMARY)
- 커밋 4개 전부 존재 (7841600·4c53a70·155dbad·f7761e6)

---
*Phase: 29-chat-unification*
*Completed: 2026-07-14*
