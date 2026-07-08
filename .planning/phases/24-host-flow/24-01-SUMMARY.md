---
phase: 24-host-flow
plan: 01
subsystem: infra
tags: [supabase, realtime, postgres_changes, publication, walrus-rls, react-day-picker, pnpm]

# Dependency graph
requires:
  - phase: 23-web-first-foundation
    provides: "0024 place_seq · 0025 web_share(share_mode·join_moa) · places/links RLS(can_read_trip)"
provides:
  - "0026 realtime publication — places·links가 supabase_realtime에 등록 (레포 최초 postgres_changes 기반)"
  - "realtime_publication_smoke.sh + realtime_events_smoke.mjs — publication 카운트 + 이벤트 실수신 + WALRUS RLS 필터 하네스"
  - "supabase-js 2.110.0 레포 전역 실체화 (root·web·api 모두) — F-20-3 stale 재발 차단"
  - "react-day-picker 9.14.0 (web) — D-06 캘린더 range 픽커"
affects: [24-06-moa-island, 24-04-onboarding, 25-guest-share, 26-chat]

# Tech tracking
tech-stack:
  added: [react-day-picker@9.14.0, "@supabase/supabase-js@2.110.0 (root dep)"]
  patterns:
    - "postgres_changes 구독은 supabase_realtime publication 멤버십 전제 — 등록 없으면 SUBSCRIBED 무음 no-op"
    - "realtime RLS 검증: 구독자 JWT를 realtime.setAuth로 전달 → WALRUS가 SELECT 정책 평가 → 비멤버 exit-code 단언"
    - "레포-루트 스모크(.mjs)는 root node_modules 해소 — supabase-js를 root dependency로 선언"

key-files:
  created:
    - supabase/migrations/0026_realtime_publication.sql
    - supabase/tests/realtime_publication_smoke.sh
    - supabase/tests/realtime_events_smoke.mjs
  modified:
    - package.json
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "root node_modules의 npm-오염 @supabase/* 실디렉토리(2.45.4) 제거 + supabase-js를 root dependency로 선언 → 레포-루트 스모크가 2.110.0 realtime-js를 해소 (F-20-3 근본원인)"
  - "0026은 places·links만 등록 (votes는 Phase 25 몫) — additive·데이터 무변경으로 append-only 유지"
  - "스모크는 post-reset realtime WAL 콜드스타트에 대비해 최대 2회 재시도로 결정론화"

patterns-established:
  - "Realtime postgres_changes 스모크: owner ≥1 수신 AND 비멤버 0건을 exit code로 이중 단언 (WALRUS RLS 실증)"

requirements-completed: []  # MOA-03은 realtime UI(24-06)까지 필요 — 이 plan은 인프라 seam만. 원격 push 게이트도 open.

# Metrics
duration: 14min
completed: 2026-07-08
---

# Phase 24 Plan 01: Realtime Publication + 환경 게이트 Summary

**레포 최초 postgres_changes 기반을 잠금 — 0026이 places·links를 supabase_realtime publication에 등록하고, owner 수신·비멤버 0건(WALRUS RLS)을 exit code로 실증하는 스모크 하네스 완비 + stale supabase-js 2.45.4→2.110.0 전역 실체화.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-08T09:09:11Z
- **Completed:** 2026-07-08T09:22:50Z
- **Tasks:** 3 (Task 3 원격 push는 human-action 게이트로 open)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- **0026 realtime publication** — 레포 어떤 마이그레이션도 등록한 적 없던 `supabase_realtime` publication에 places·links 추가. 이것 없이는 D-14 postgres_changes 구독이 SUBSCRIBED 상태로 이벤트 0건 무음 no-op (Pitfall 2 해소).
- **이벤트 실수신 실증** — 로컬에서 owner가 places INSERT postgres_changes 이벤트를 실수신하고, 비멤버(익명)는 동일 이벤트를 수신하지 못함을 exit code로 증명 (T-24-01 정보노출 완화의 런타임 게이트).
- **supabase-js 2.110.0 전역 실체화** — root·web·api 모두 2.110.0 해소 확인. root의 npm-오염 stale 실디렉토리(2.45.4 / realtime-js 2.10.2)를 근본 제거 (F-20-3 재발 차단).
- **react-day-picker 9.14.0** 설치 (D-06 온보딩 캘린더).
- 무회귀: core 169 · api 81 · web 65 test 그린, api typecheck exit 0.

## Task Commits

1. **Task 1: 환경 게이트 (pnpm install + react-day-picker)** - `e9858cf` (chore)
2. **Task 2: 0026 마이그레이션 + 스모크 하네스 2종** - `a1e8db0` (feat)
3. **Task 3: 로컬 적용·타입 재생성·스모크 실행 (+cold-start 하드닝)** - `9cd0cf8` (test)

_원격 push(0024·0025·0026)는 미완 — 아래 "원격 Push 게이트" 참조._

## Files Created/Modified
- `supabase/migrations/0026_realtime_publication.sql` - places·links를 supabase_realtime publication에 등록 (2 alter 문, votes는 주석만)
- `supabase/tests/realtime_publication_smoke.sh` - pg_publication_tables 카운트(2) 단언 + node 스모크 위임
- `supabase/tests/realtime_events_smoke.mjs` - owner 수신 + 비멤버 0건 postgres_changes 실수신 스모크 (2회 재시도 하드닝)
- `package.json` - supabase-js를 root dependency로 선언 (레포-루트 스모크 해소용)
- `apps/web/package.json` - react-day-picker 9.14.0 추가
- `pnpm-lock.yaml` - 위 반영

## Decisions Made
- **root node_modules 정화 + supabase-js root dep 선언**: root에는 npm-flat 오염 실디렉토리(auth-js/functions-js/postgrest-js/realtime-js/storage-js/supabase-js/ssr, 전부 2.45.4대)가 pnpm 스토어를 가려 `node -e require` 루트 해소가 2.45.4였다(F-20-3 근본원인). apps/web·packages/api는 자체 심링크로 이미 2.110.0 정상. 실디렉토리 제거 + supabase-js를 root dependency로 선언해 레포-루트에서 실행되는 스모크(.mjs)가 2.110.0 realtime-js를 해소하게 함.
- **0026 범위 = places·links만**: votes는 Phase 25(0027) 몫 (RESEARCH Open Q3). additive·데이터 무변경으로 append-only 유지.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] root node_modules npm-오염 실디렉토리 제거 + supabase-js root dep 선언**
- **Found during:** Task 1 (환경 게이트)
- **Issue:** `pnpm install` 후에도 레포-루트 `node -e require('@supabase/supabase-js')`가 2.45.4를 해소. 원인은 root `node_modules/@supabase/*`가 이전 `npm install`의 flat 실디렉토리(2.45.4 / realtime-js 2.10.2)로 pnpm 스토어(2.110.0)를 가림. 이 상태로는 레포-루트에서 실행되는 realtime 스모크가 stale realtime-js를 써 D-14 검증 자체가 F-20-3 버그를 재현.
- **Fix:** 오염 실디렉토리 8개 제거 후 `@supabase/supabase-js: 2.110.0`을 root `dependencies`로 선언(스모크가 root에서 실행되는 유일 소비자) → `pnpm install` → root·web·api 모두 2.110.0, 번들 realtime-js 2.110.0 확인.
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `node -e require` root=2.110.0, 번들 realtime-js=2.110.0
- **Committed in:** e9858cf

**2. [Rule 3 - Blocking] core/api 테스트 스크립트명 정정 (`test:run` 부재)**
- **Found during:** Task 1·3 (무회귀 확인)
- **Issue:** 플랜은 `pnpm --filter @moajoa/core test:run` 등을 지시하나 core·api엔 `test:run` 스크립트가 없음 (`test`=`vitest run` 비-watch). web만 `test:run` 보유. 또한 web 패키지명은 `@moajoa/web`(플랜의 `--filter web` 아님). root `test`=`-r --parallel run test`는 web의 watch를 물어 hang(환경 노트와 일치).
- **Fix:** core·api는 `test`(비-watch), web은 `test:run`으로 실행. 필터는 `@moajoa/web` 사용.
- **Files modified:** 없음 (실행 방식 조정)
- **Verification:** core 169 · api 81 · web 65 그린, hang 없음
- **Committed in:** N/A (검증 절차)

**3. [Rule 2 - Reliability] realtime 스모크 post-reset WAL 콜드스타트 하드닝**
- **Found during:** Task 3 (스모크 최초 실행)
- **Issue:** `supabase db reset` 직후 realtime 컨테이너 재시작으로 WAL 디코딩이 콜드스타트 → 첫 실행에서 SUBSCRIBED는 됐으나 10s 창 내 이벤트 0건(owner=0·nonmember=0). 워밍 후 재실행은 즉시 owner=1. Task 3 자체가 reset→smoke 순서라 이 콜드패스에 항상 노출 → 정확한 하네스가 플래키하면 [BLOCKING] 게이트가 오탐.
- **Fix:** .mjs 이벤트 수신 단계를 최대 2회 insert+대기 재시도로 감쌈 (owner≥1 조건, 비멤버 0건은 전 시도 걸쳐 불변). 진단으로 filter/event-type가 아닌 콜드스타트가 원인임을 격리 확인.
- **Files modified:** supabase/tests/realtime_events_smoke.mjs
- **Verification:** 하드닝 후 스모크 재현성 있게 exit 0 (owner=1·nonmember=0)
- **Committed in:** 9cd0cf8

---

**Total deviations:** 3 (2 blocking, 1 reliability)
**Impact on plan:** 전부 검증 정합성·재현성에 필요. 스코프 크립 없음 — 신규 기능 0, plan의 산출물 계약(0026·스모크 2종·dep) 그대로.

## Issues Encountered
- **원격 push 차단 (아래 게이트)** — auto-mode classifier가 프로덕션 `supabase db push`를 거부. 로컬 전 작업은 완료·검증됨.

## 원격 Push 게이트 (HUMAN-ACTION — 미완, 명시적 open)

**상태:** 로컬 전 작업 완료·검증. 원격 push만 미실행.

- `supabase migration list` 실측(2026-07-08): 원격(`xfoauhsraguyrifingct`, LINKED)은 **0016~0023 정합, 0024·0025·0026 미적용**. 로컬은 0026까지 정합.
- `supabase db push` 시도 → auto-mode classifier가 프로덕션 배포로 거부(체크포인트 경계). Claude는 강제하지 않음.
- CLI 인증은 keychain으로 되어 있고 원격 DB 접근(migration list)은 비대화형으로 동작함 — DB 비밀번호 프롬프트 없음.

**사용자가 터미널에서 실행할 것:**
```bash
cd /Users/wcb/Documents/MOAJOA
supabase db push        # 0024·0025·0026 세 개 적용 (append-only·additive)
supabase migration list # Local·Remote가 0026까지 정합인지 확인
```
push 후 원격에 join_moa·trip_messages·share_mode·seq_no·realtime publication이 갖춰져 **Vercel Preview e2e 차단 요소 해소**. 그 전까지 프로덕션 웹 공유·join·채팅·실시간 반영 미동작 (로컬 개발·downstream local 검증은 무영향).

## User Setup Required
None (별도 외부 서비스 설정 없음). 위 "원격 Push 게이트"는 사용자 터미널 1회 실행 건.

## Next Phase Readiness
- **로컬 realtime 기반 확보** — downstream 24-06(moa-island postgres_changes)이 무음 no-op 없이 로컬에서 동작 가능. supabase-js 2.110.0·react-day-picker 9.14.0 준비 완료.
- **Wave 1 병렬(24-02·24-03)** 로컬 개발 언블록.
- **차단 잔여:** 원격 push (위 human-action 게이트) — Vercel Preview e2e 전 사용자 실행 필요.

## Self-Check: PASSED
- FOUND: supabase/migrations/0026_realtime_publication.sql
- FOUND: supabase/tests/realtime_publication_smoke.sh
- FOUND: supabase/tests/realtime_events_smoke.mjs
- FOUND: commits e9858cf · a1e8db0 · 9cd0cf8

---
*Phase: 24-host-flow*
*Completed (local): 2026-07-08 — 원격 push 게이트 open*
