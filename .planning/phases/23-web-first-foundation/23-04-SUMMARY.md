---
phase: 23-web-first-foundation
plan: 04
subsystem: database
tags: [supabase, postgres, rls, advisory-lock, anonymous-auth, kakao-oauth, typegen]
requires:
  - phase: 23-web-first-foundation (23-01)
    provides: 0024_place_seq.sql + place_seq_concurrency.sh 하네스
  - phase: 23-web-first-foundation (23-02)
    provides: 0025_web_share.sql + web_share_smoke.sh
  - phase: 23-web-first-foundation (23-03)
    provides: config.toml 익명 sign-in ON + [auth.external.kakao] env() 블록
provides:
  - 0024·0025 로컬 실적용 (supabase db reset 클린, 42P17 = 0)
  - 재생성 database.ts — trip_messages·seq_no·share_mode·companion·last_place_seq·join_moa 반영
  - MOA-01 실증 — 동시 40건 무중복·무결번 + hard-delete 무재사용 + forge 차단 (하네스 PASS)
  - 익명 세션·join_moa 분기·trip_messages RLS 런타임·kakao authorize 실증 (smoke PASS)
affects: [23-05 core 계약, 23-06 api 계약, 23-07 human-action, phase-24, phase-25, phase-26]
tech-stack:
  added: []
  patterns: "psql INSERT...RETURNING 캡처는 -q 필수 (커맨드 태그 누출); boolean||text는 'true'/'false' 캐스트 (psql 표시형 t/f 아님)"
key-files:
  created: []
  modified:
    - packages/api/src/types/database.ts
    - supabase/tests/place_seq_concurrency.sh
    - supabase/tests/web_share_smoke.sh
key-decisions:
  - "KAKAO env() 치환은 더미값(dummy-local)으로 통과 — 로컬은 authorize redirect 생성까지만 검증, 실값은 23-07 human-action"
  - "0024·0025 SQL 무수정으로 게이트 통과 — 발견된 버그는 전부 테스트 스크립트(psql 사용법) 쪽"
patterns-established:
  - "psql 캡처 하네스: INSERT...RETURNING은 -qtAc, boolean 문자열 비교는 'true'/'false' 기준"
requirements-completed: [MOA-01]
duration: 7min
completed: 2026-07-08
---

# Phase 23 Plan 04: [BLOCKING] 스키마 적용 게이트 Summary

**0024·0025 로컬 실적용(reset 클린 42P17=0) + database.ts 재생성 위 core/api 무회귀, MOA-01 동시성 하네스·웹 공유 smoke 라이브 PASS**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-07T17:18:52Z
- **Completed:** 2026-07-07T17:24:39Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **[BLOCKING] 스키마 적용:** `supabase stop && start`(KAKAO 더미 env로 config.toml 익명·kakao 스위치 로딩) → `supabase db reset` 클린 — 0016~0025 전체 재적용, 출력에 `0024_place_seq`·`0025_web_share` 적용 라인, 에러 0, **42P17 0건** (성공 기준 1 전반부)
- **타입 재생성:** database.ts +66줄 additive — trip_messages(4곳)·seq_no(4)·share_mode(3)·companion(3)·last_place_seq(3)·join_moa(1) 전부 반영. 손편집 0
- **무회귀 게이트:** core 143 tests + api 74 tests 그린, 양쪽 typecheck exit 0
- **MOA-01 실증 (성공 기준 2):** 하네스 PASS — 동시 40건 8-way 무중복·무결번(40|40|40), 최고번호 hard-delete 후 무재사용(→41), soft-delete 복원 순번 유지(3|true), 클라이언트 forge 999→트리거 채번 42
- **익명·join_moa·RLS·kakao 실증 (성공 기준 3 + 4 로컬 절반):** smoke PASS — is_anonymous=true·role=authenticated 클레임, join_moa both→editor / dates→voter (D-A1), trip_messages RLS 익명 JWT GET 200(런타임 42P17 무발화, T-23-09 보강), kakao authorize `kauth.kakao.com` redirect

## PASS 출력 원문 (verify-work 근거)

```
PASS: place_seq concurrency (40|40|40, hard-delete→41, soft-restore 3|true, forge→42)
PASS: anon(is_anonymous=true, role=authenticated) + join_moa(both→editor, dates→voter) + trip_messages RLS(200) + kakao authorize
```

## Task Commits

1. **Task 1: 스택 재시작 + db reset + 타입 재생성 + 기존 스위트 그린** - `05c109a` (feat)
2. **Task 2: MOA-01 동시성 하네스 실행** - `948032f` (fix — 하네스 psql 버그 수정 포함)
3. **Task 3: 익명 + join_moa + RLS 프로브 + kakao smoke 실행** - `280d728` (fix — smoke psql 버그 수정 포함)

## Files Created/Modified

- `packages/api/src/types/database.ts` - 0024·0025 반영 재생성 (+66줄, 생성물)
- `supabase/tests/place_seq_concurrency.sh` - psql 캡처 버그 2건 수정 (하네스 자체, 0024 무수정)
- `supabase/tests/web_share_smoke.sh` - psql 캡처 버그 1건 수정 (smoke 자체, 0025 무수정)

## Decisions Made

- KAKAO `env()` 치환은 더미값(`dummy-local`)을 인라인 env + gitignored `supabase/.env.local`에 배치 — 로컬은 authorize redirect 생성까지만 검증하므로 실값 불필요 (실값은 23-07 human-action 소관)
- **마이그레이션 SQL은 한 줄도 고치지 않고 게이트 통과** — 0024 트리거·0025 정책/RPC 동작 자체는 첫 라이브 실행에서 전부 정상. 발견된 결함은 전부 테스트 스크립트의 psql 사용법

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 하네스 TRIP/FORGE 캡처에 psql 커맨드 태그 누출**
- **Found during:** Task 2 (MOA-01 동시성 하네스 실행)
- **Issue:** `psql -tAc "insert ... returning id"`는 `-t`만으론 커맨드 태그(`INSERT 0 1`)가 출력에 섞여 `$TRIP`이 `uuid\nINSERT 0 1`이 됨 → 후속 40건 INSERT 전부 uuid 구문 오류 (23-01은 `bash -n` 구문 검사만, 라이브 실행은 이번이 최초)
- **Fix:** 두 캡처 지점(`TRIP`, `FORGE`)에 `-q` 추가 (`-qtAc`)
- **Files modified:** supabase/tests/place_seq_concurrency.sh
- **Verification:** 재실행 → 40|40|40 통과
- **Committed in:** 948032f (Task 2 commit)

**2. [Rule 1 - Bug] 하네스 soft-restore 단언 기대값 오류**
- **Found during:** Task 2
- **Issue:** `seq_no||'|'||(hidden_at is null)`은 boolean을 SQL 텍스트 캐스트(`true`)로 이어붙임 — psql 표시형 `t`를 기대한 단언은 절대 통과 불가
- **Fix:** 기대값 `3|t` → `3|true` 정정 (PASS 메시지 동기화)
- **Files modified:** supabase/tests/place_seq_concurrency.sh
- **Verification:** 재실행 → 하네스 전체 PASS, exit 0
- **Committed in:** 948032f (Task 2 commit)

**3. [Rule 1 - Bug] smoke T_BOTH/T_DATES 캡처에 동일한 커맨드 태그 누출**
- **Found during:** Task 3 (smoke 실행 전 read_first에서 동일 패턴 발견 — 선제 수정)
- **Issue:** deviation 1과 동일한 `psql -tAc` + `INSERT...RETURNING` 패턴
- **Fix:** 두 캡처 지점에 `-q` 추가
- **Files modified:** supabase/tests/web_share_smoke.sh
- **Verification:** smoke 첫 실행에 전 단언 PASS, exit 0
- **Committed in:** 280d728 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (전부 Rule 1 — 테스트 스크립트 버그)
**Impact on plan:** 스키마(0024·0025)·config는 무수정 — 게이트가 검증하려던 대상은 첫 실행에 전부 정상. 수정은 검증 도구 쪽에만 국한, scope creep 없음.

## Issues Encountered

- `supabase status`/`start`가 KAKAO env 부재 시 경고 — 플랜 예정대로 더미값으로 해소 (인라인 env + gitignored `supabase/.env.local` 추가, 커밋 안 됨)

## User Setup Required

None - 로컬 검증은 외부 설정 불요. **실제 Kakao 키·프로덕션 대시보드 설정은 23-07 human-action에서 진행** (성공 기준 4의 나머지 절반).

## Next Phase Readiness

- **Wave 3+ 언블록:** core(23-05)·api(23-06) 계약 작업이 실적용된 스키마와 재생성 타입 위에서 진행 가능 — false-positive 위험(T-23-13) 해소
- 원격 `supabase db push`는 phase 범위 외 — 23-07에서 `supabase migration list`로 상태만 확인 (Open Q1 결정)
- 익명 signup rate limit(30/hr/IP) 유의 — smoke 반복 실행 시 대기 필요할 수 있음

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*

## Self-Check: PASSED

- 파일 4종 존재 확인 (database.ts, 하네스, smoke, SUMMARY)
- 커밋 3건 존재 확인 (05c109a, 948032f, 280d728)
- 커밋 3건에 파일 삭제 0건
