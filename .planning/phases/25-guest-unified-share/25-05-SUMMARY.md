---
phase: 25-guest-unified-share
plan: 05
subsystem: testing
tags: [supabase, smoke-test, rls, realtime, walrus, anon-session, place-seq, bash, mjs]

# Dependency graph
requires:
  - phase: 25-guest-unified-share
    provides: "0029 로컬 적용(join_moa·add_manual_place·cast_date_vote_authed·hide_place_as_member)·share_mode·trip_messages"
  - phase: 24-host-flow
    provides: "realtime_events_smoke.mjs(postgres_changes+WALRUS RLS)·0026 publication"
  - phase: 23-web-share-foundation
    provides: "익명 sign-in·join_moa RPC·place_seq_concurrency.sh·web_share_smoke.sh"
provides:
  - "익명-세션 게스트 RLS 실증: join 전 places/votes/trip_messages direct-read 0건, join 후 add_manual_place(editor)·votes·trip_messages·cast_date_vote_authed 통과 (SHARE-03)"
  - "게스트 익명 join_moa 후 add_manual_place INSERT가 호스트 구독 moa 채널로 fan-out ≥1 AND 비멤버 익명 0건 (SHARE-04, T-25-15)"
  - "게스트 추가 장소 #N+1 이어지는 순번(결번/중복 0, 서버 채번 forge 불가) (SHARE-04, MOA-01, T-25-16)"
  - "realtime_events_smoke.mjs env 자동 로드(supabase status) — 래퍼 없이 standalone 실행"
affects: [25-verification, phase-27-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "익명 세션 RLS 게이트 실증: 비멤버 direct-read 0건(빈 테이블 아닌 RLS 차단임을 시드로 증명) → join 후만 write 통과"
    - "게스트(익명 멤버) INSERT의 realtime fan-out을 service-role INSERT와 별개 시나리오로 실증(구독자 JWT WALRUS 재평가)"
    - "smoke mjs가 supabase status에서 env 자동 로드 — 래퍼/standalone 양경로 동작"

key-files:
  created: []
  modified:
    - supabase/tests/web_share_smoke.sh
    - supabase/tests/realtime_events_smoke.mjs
    - supabase/tests/place_seq_concurrency.sh

key-decisions:
  - "join 전 0건 프로브를 위해 호스트가 시드 장소+표를 먼저 삽입 — '빈 테이블'이 아니라 RLS가 차단함을 실증(T-25-17)"
  - "게스트 fan-out은 add_manual_place(RPC, editor RLS)로 INSERT — 실제 게스트 write 경로를 통과(service-role bypass 아님)"
  - "realtime mjs에 supabase status env 자동 로드 폴백 추가 — 플랜 acceptance가 래퍼 없이 `node ...mjs`를 직접 실행하므로"

patterns-established:
  - "RLS 0건 프로브는 시드 데이터를 넣어 '차단'과 '공백'을 구별한다"
  - "게스트 realtime 실증은 익명 세션의 실제 RPC write를 인서터로 사용한다"

requirements-completed: []  # AUTH-08/SHARE-03/04는 DB/realtime 레이어 실증 완료 — 라이브 e2e 마킹은 원격 0029 push + verify-work 몫(25-01 선례)

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 25 Plan 05: 익명-세션 스모크 확장 (RLS·realtime fan-out·#N+1) Summary

**웹 UI 없이 익명 세션(auth.uid, 비 device_token)이 SHARE-03/04를 만족함을 DB/realtime 레이어에서 직접 실증 — 기존 하네스 3종에 게스트 익명 케이스를 append-only 확장(전부 로컬 Supabase exit 0).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-10T11:34Z
- **Completed:** 2026-07-10T11:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **web_share_smoke.sh — 게스트 익명 RLS 프로브 (SHARE-03, T-25-17):** step 1의 익명 JWT 재사용. 호스트가 게스트-미가입 shared trip(both)에 장소·표를 시드 → 게스트 direct-read가 places/votes/trip_messages 전부 **0건(RLS 차단)** → `join_moa`(both→editor) 후에만 `add_manual_place`(added_by=auth.uid)·votes(user_id 트리거 파생, HTTP 201)·trip_messages(201)·`cast_date_vote_authed`(device_token=auth.uid 서버파생) 통과.
- **realtime_events_smoke.mjs — 게스트 익명 fan-out (SHARE-04, T-25-15):** 기존 service-role 시나리오(PASS 1/2) 뒤에 게스트 시나리오 append(PASS 2/2) — 익명 세션이 `join_moa`(both→editor) 후 `add_manual_place` INSERT → 호스트 구독(moa 채널) fan-out **host=1**, 비멤버 익명 **nonmember=0**(WALRUS 구독자 JWT RLS 재평가). 24-01 콜드스타트 2회 재시도 하드닝 재사용.
- **place_seq_concurrency.sh — 게스트 #N+1 (SHARE-04, MOA-01, T-25-16):** 기존 42개 장소 trip을 공유(both) → 익명 세션 join 후 `add_manual_place`(seq_no=999 forge 시도) → 서버 채번이 위조 무시하고 **#43** 부여, 결번/중복 0.
- **realtime mjs env 자동 로드:** `supabase status -o env`에서 ANON/SERVICE/API_URL을 폴백 로드 → 래퍼(realtime_publication_smoke.sh) 없이도 `node ...mjs` standalone exit 0.

## Task Commits

1. **Task 1: web_share_smoke 익명 세션 join 후 RLS 통과 프로브** — `fc52676` (test)
2. **Task 2: 게스트 익명 realtime fan-out + place_seq #N+1** — `50afbfe` (test)

**Plan metadata:** (아래 docs 커밋)

## Files Created/Modified

- `supabase/tests/web_share_smoke.sh` - (6) 게스트 익명 RLS 프로브 append: join 전 0건 → join 후 add_manual_place·votes·trip_messages·cast_date_vote_authed 통과
- `supabase/tests/realtime_events_smoke.mjs` - 게스트 익명 fan-out 시나리오 append(host≥1·nonmember 0) + supabase status env 자동 로드 폴백
- `supabase/tests/place_seq_concurrency.sh` - (5) 게스트 익명 add_manual_place → 이어지는 순번 #N+1 append

## Decisions Made

- **RLS 0건을 시드로 실증:** 호스트가 장소 1개 + 표 1개를 먼저 넣어, 게스트의 join 전 direct-read 0건이 '빈 테이블'이 아니라 `can_read_trip=false` RLS 차단임을 증명(T-25-17).
- **게스트 fan-out 인서터 = add_manual_place RPC:** service-role bypass가 아니라 익명 editor의 실제 write 경로(0027 add_manual_place, can_edit_trip 가드)를 통과시켜 fan-out을 실증. 기존 24-01 service-role 시나리오는 무수정 보존.
- **env 자동 로드 폴백:** 플랜 acceptance/verify가 `node supabase/tests/realtime_events_smoke.mjs`를 래퍼 없이 직접 실행하므로, 키 미주입 시 `supabase status`에서 자동 로드(래퍼 env 주입 경로는 폴백을 건너뜀 — 무회귀).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] realtime_events_smoke.mjs env 자동 로드 추가**
- **Found during:** Task 2 (realtime fan-out)
- **Issue:** 기존 mjs는 SUPABASE_ANON_KEY/SERVICE_ROLE_KEY를 env로 요구(래퍼 realtime_publication_smoke.sh가 주입) → 플랜 acceptance 명령 `node supabase/tests/realtime_events_smoke.mjs`를 직접 실행하면 "키 미주입"으로 exit 1.
- **Fix:** 파일 상단에 `supabase status -o env` 폴백 로더 추가(키 이미 주입 시 건너뜀). 래퍼 경로는 무영향.
- **Files modified:** supabase/tests/realtime_events_smoke.mjs
- **Verification:** `node ...mjs`(env 없이) exit 0 + 래퍼 `realtime_publication_smoke.sh` exit 0 둘 다 그린.
- **Committed in:** 50afbfe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** acceptance 명령이 문서대로 통과하도록 만든 필수 픽스. 기존 시나리오·래퍼 경로 무회귀, 스코프 크립 없음.

## Issues Encountered

None. 세 스모크 전부 로컬 Supabase(0029 적용, colima+docker 가동)에서 exit 0. 게스트 fan-out host=1·nonmember=0, place_seq #43.

## Known Stubs

None. 모든 산출물이 실 DB/realtime 경로에 배선됨(익명 세션 실제 RPC write·구독자 WALRUS RLS·서버 채번 실증).

## Threat Flags

None — 신규 보안 표면 없음. 이 plan은 25-01 threat register(T-25-15/16/17)의 mitigate 디스포지션을 exit-code로 실증하는 테스트만 추가.

## User Setup Required

None - 로컬 스모크는 외부 설정 불필요. (라이브 게스트 참여·realtime·#N+1의 프로덕션 검증은 원격 0029 push[human-action 게이트] + verify-work 몫 — 25-01/25-USER-SETUP.md 참조.)

## Next Phase Readiness

- **SHARE-03/04 DB/realtime 진실이 phase gate로 잠김:** 웹 컴포넌트 테스트(Plan 03, mock)가 검증 못 하는 실 RLS·realtime fan-out·서버 채번을 스모크 exit 0로 봉합.
- **블로커:** 라이브 e2e(두 브라우저·실 slug)는 원격 0029 배포 후 verify-work 몫. 로컬 스모크는 전부 그린.

## Self-Check: PASSED

- Modified files present: web_share_smoke.sh · realtime_events_smoke.mjs · place_seq_concurrency.sh (all on disk)
- Task commits present: fc52676 (test), 50afbfe (test)
- Local exit codes: web_share_smoke=0 · realtime_events_smoke=0(host=1·nonmember=0) · place_seq_concurrency=0(#43) · realtime_publication_smoke wrapper=0
- Acceptance greps: signInAnonymously|is_anonymous · join_moa · cast_date_vote_authed (web_share) · anon|익명|guest (mjs·seq) 전부 통과

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*
