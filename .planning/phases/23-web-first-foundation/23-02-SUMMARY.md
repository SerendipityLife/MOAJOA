---
phase: 23-web-first-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, migration, security-definer, anonymous-auth, kakao, bash-smoke]

# Dependency graph
requires:
  - phase: 16-trips-baseline (v2.0)
    provides: "0016 join_shared_trip RPC(미러 원본) + can_read_trip/can_vote_trip/am_trip_owner 헬퍼 + ensure_share_slug 트리거 + memberships unique(trip_id,user_id)"
  - phase: 18-date-polls (v2.0)
    provides: "0018 date_comments 테이블 shape (trip_messages의 아날로그 — nickname 비정규화·body 1~140 CHECK·(parent,created_at) 인덱스)"
provides:
  - "supabase/migrations/0025_web_share.sql — trips.share_mode('dates'|'places'|'both')·companion 컬럼(nullable), trip_messages 테이블+RLS 3정책(헬퍼-only), join_moa RPC(share_mode 기반 editor/voter 분기)"
  - "supabase/tests/web_share_smoke.sh — 익명 세션 클레임 + join_moa 분기 + trip_messages RLS 런타임 프로브(200) + kakao authorize smoke (실행은 23-04)"
affects: [23-04 (0025 적용+smoke 실행), 23-05 (ShareMode·chat.ts 계약), 23-06 (joinMoa/shareMoa 쿼리), 25-guest-unified-share, 26-realtime-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "join RPC 미러 + role 분기: join_shared_trip 안전장치 5종(bearer slug·self-join only·owner 가드·멱등·DEFINER+search_path) 유지하고 role만 서버 결정"
    - "RLS 런타임 프로브: reset(superuser)·DEFINER RPC가 밟지 않는 정책을 익명 JWT GET 200으로 실증"

key-files:
  created:
    - supabase/migrations/0025_web_share.sql
    - supabase/tests/web_share_smoke.sh
  modified: []

key-decisions:
  - "D-A1: join_moa role = share_mode in ('places','both')→'editor', 그 외('dates'·null 레거시)→'voter' — 클라이언트 role 인자 없음 (T-23-04)"
  - "D-A2: trip_messages.nickname 비정규화 (0018 미러) — 익명 유저 purge 후에도 조인 없는 히스토리 렌더"
  - "D-A4: 재-join 시 on conflict do nothing으로 기존 role 유지 — 모드 변경 후 자동 승격 없음 (T-23-08)"
  - "AUTH-08/SHARE-03/CHAT-01은 백엔드 기반만 제공 — REQUIREMENTS 체크는 traceability대로 Phase 25/26 e2e에서 (plan frontmatter 주석 명시)"

patterns-established:
  - "join RPC role 분기: DEFINER 함수 내부에서 서버가 share_mode로 role 결정 — escalation 표면 0"
  - "smoke의 RLS 런타임 프로브: 정적 grep + reset 클린만으로 안 잡히는 42P17을 authenticated GET으로 게이트"

requirements-completed: [] # AUTH-08·SHARE-03·CHAT-01 백엔드 기반만 — e2e 완료 마킹은 Phase 25/26 (traceability 소유 phase)

# Metrics
duration: 4min
completed: 2026-07-08
---

# Phase 23 Plan 02: Web Share DB Foundation Summary

**0025 마이그레이션(trips.share_mode/companion + trip_messages RLS 헬퍼-only + join_moa editor/voter 분기 RPC)과 익명세션·join분기·RLS프로브·kakao smoke 스크립트 — 전부 0016/0018 검증 idiom 미러, 적용은 23-04**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-07T17:06:05Z
- **Completed:** 2026-07-07T17:10:30Z
- **Tasks:** 2
- **Files modified:** 2 (신규 2)

## Accomplishments

- `0025_web_share.sql`: trips에 `share_mode`('dates'|'places'|'both')·`companion`(≤20자) nullable 컬럼(§4.3 레거시 안전), `trip_messages` 테이블(0018 date_comments shape 미러 — nickname 비정규화 D-A2, body 1~140 CHECK, `reply_to_place_id → places on delete set null` CHAT-03 기반, `(trip_id, created_at)` 인덱스) + RLS 3정책(SELECT=`can_read_trip` / INSERT=`auth.uid()+can_vote_trip` 신원+접근 동시검사 T-23-06 / DELETE=`auth.uid() or am_trip_owner`) — 크로스 테이블 직접 EXISTS 0건(42P17 가드)
- `join_moa(p_share_slug)` RPC: 0016 `join_shared_trip`(L631~665) 미러 — 안전장치 5종(bearer slug+`visibility in ('shared','public')` 게이트·self-join only·owner self-join 가드·`on conflict do nothing` 멱등 D-A4·DEFINER+`search_path=public` 핀) 전부 유지, 변경점은 role 하드코딩 `'voter'` → `case when v_share_mode in ('places','both') then 'editor' else 'voter' end` 분기(D-A1)뿐. grant는 `to authenticated`만(익명도 authenticated role). 기존 `join_shared_trip` 무수정(iOS 동결)
- `web_share_smoke.sh`(실행권한+`bash -n` 클린): (1) 익명 signup `data.name` 주입 → `is_anonymous=True`·`role=authenticated` JWT 클레임 단언 (2) shared trip 2개(`both`/`dates`) 셋업 + `ensure_share_slug` 트리거 slug 발급 단언 (3) join_moa both→editor·dates→voter 분기 단언 (4) trip_messages 익명 JWT GET 200 — RLS 런타임 평가 실증(42P17 발화 시 5xx→FAIL) (5) kakao authorize redirect `kauth.kakao.com` 단언 — 전부 exit code. 30/hr rate limit 주의 주석 포함

## Task Commits

Each task was committed atomically:

1. **Task 1: 익명 세션 + join_moa + trip_messages RLS 프로브 + kakao authorize smoke 스크립트** - `b17f7b3` (test)
2. **Task 2: 0025_web_share.sql 마이그레이션 작성** - `05b3c3a` (feat)

## Files Created/Modified

- `supabase/migrations/0025_web_share.sql` - share_mode/companion 컬럼 + trip_messages(+RLS) + join_moa RPC. 0023 스타일 헤더에 D-A1/A2/A4 결정 기록. 0016~0024 무수정 (append-only)
- `supabase/tests/web_share_smoke.sh` - 성공 기준 3(익명+join_moa)·4(kakao 로컬 절반) + trip_messages RLS 런타임 프로브 자기완결 단언. 실행은 23-04 [BLOCKING]

## Decisions Made

- **REQUIREMENTS 체크 보류**: 플랜 frontmatter `requirements: [AUTH-08, SHARE-03, CHAT-01]`는 "백엔드 기반만 — e2e 검증은 Phase 25/26에 매핑"이라고 주석 명시. REQUIREMENTS.md traceability도 AUTH-08/SHARE-03→Phase 25, CHAT-01→Phase 26 소유 — 여기서 완료 마킹하면 traceability 손상이므로 체크하지 않음
- 나머지는 플랜의 잠긴 기본값(D-A1/A2/A4) 그대로 — 신규 결정 없음

## Deviations from Plan

None - plan executed exactly as written.

(acceptance criteria의 금지 패턴 grep에서 `join ` 2건 매치는 전부 SQL 주석(`--` 라인: "재-join", "self-join only") — 기준인 "RLS 정책 본문"에는 0건, SQL 본문에 JOIN/직접 EXISTS 없음 확인)

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. (Kakao console·대시보드 설정은 23-07 human-action 소관)

## Next Phase Readiness

- **23-04 [BLOCKING] 게이트 준비 완료**: 0025는 미적용 상태(로컬 DB는 0024 이전 유지) — 23-04에서 colima + 스택 재시작(23-03 config 반영) + `supabase db reset`(42P17=0) + typegen + 본 smoke 실행
- **23-05/06 소비 준비**: `share_mode in ('dates','places','both')` CHECK 문자열이 core ShareMode 상수와 문자 단위 잠금 대상, `join_moa`/`trip_messages` 컬럼 shape가 chat.ts·joinMoa/shareMoa 계약의 원본
- **선행 조건**: 23-03(config.toml `enable_anonymous_sign_ins=true` + kakao 블록)이 없으면 smoke (1)·(5)가 실패함 — Wave 1 잔여

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: supabase/migrations/0025_web_share.sql
- FOUND(+x): supabase/tests/web_share_smoke.sh
- FOUND commit: b17f7b3 (test, Task 1)
- FOUND commit: 05b3c3a (feat, Task 2)
