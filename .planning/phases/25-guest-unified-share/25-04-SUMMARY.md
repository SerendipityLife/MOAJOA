---
phase: 25-guest-unified-share
plan: 04
subsystem: auth
tags: [supabase, linkidentity, kakao, anonymous-auth, account-promotion, nextjs]

requires:
  - phase: 25-guest-unified-share
    provides: "guest-surface(25-03) — 게스트 통합 화면·초대 카드 마운트 지점"
  - phase: 23-web-first-pivot
    provides: "config.toml kakao provider·anonymous sign-ins·23-07 원격 대시보드 활성 실증"
provides:
  - "GuestPromote — 계정 승격 최소 심 진입점(linkIdentity kakao, 익명 uid 보존 전환)"
  - "config.toml enable_manual_linking = true (로컬 — linkIdentity 전제)"
  - "/t/[slug] 초대 카드 하단 승격 진입점 마운트(C6)"
affects: [account-promotion-full-ux, guest-onboarding, verify-work-25]

tech-stack:
  added: []
  patterns:
    - "linkIdentity 승격 심 — login oauth() 미러(signInWithOAuth→linkIdentity), 성공=리다이렉트·에러만 토스트"
    - "RSC 셸이 'use client' 승격 island를 초대 카드 하단에 마운트(쿠키 무접근 유지)"

key-files:
  created:
    - "apps/web/app/t/[slug]/_components/guest-promote.tsx"
    - "apps/web/__tests__/guest-promote.test.tsx"
  modified:
    - "apps/web/app/t/[slug]/page.tsx"
    - "supabase/config.toml"

key-decisions:
  - "linkIdentity({ provider: 'kakao' }) — options 없이(plan interface 명세), login oauth의 redirectTo 미사용"
  - "secondary 스타일 = Button variant=outline(토큰 클래스만, primary CTA와 경합 방지, 신규 hex 0)"
  - "테스트를 apps/web/__tests__/에 배치(vitest include 제약) — plan 원 경로는 미수집"
  - "충돌(identity_already_exists)·전체 승격 UX deferred — Phase 25는 진입점만"

patterns-established:
  - "계정 승격 seam: 익명 uid → linkIdentity로 정식 전환(added_by/votes/memberships 자동 보존, 커스텀 재소유 0)"

requirements-completed: []  # AUTH-08 라이브 e2e는 원격 Manual linking 토글 + verify-work 몫 — Pending 유지

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 25 Plan 04: 계정 승격 최소 심 (linkIdentity) Summary

**게스트 익명 세션을 카카오 `linkIdentity`로 정식 계정 전환하는 승격 진입점 — `로그인하고 내 여행에 담기`(secondary) 버튼을 /t/[slug] 초대 카드 하단에 마운트, config.toml manual_linking 활성.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-10T20:51Z
- **Completed:** 2026-07-10T20:55Z
- **Tasks:** 3 (Task 3 = human-action 체크포인트, 자동화 부분 완료)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `GuestPromote` — `linkIdentity({ provider: 'kakao' })` 승격 진입점(익명 uid 보존 정식 전환 → 찜·추가·멤버십 이력 자동 유지). login oauth() 미러, 에러/Manual-linking 미활성 런타임 실패만 토스트.
- `/t/[slug]` 초대 카드 하단(C6, OQ-3 채택)에 승격 진입점 마운트 — RSC 셸이 client island 렌더, page.tsx 쿠키 무접근 유지.
- `config.toml` `[auth] enable_manual_linking = true`(로컬) — linkIdentity 전제. 원격 대시보드 토글은 human-action(잔여).
- 승격 렌더·`{ provider: 'kakao' }` 1회 호출·에러 토스트 테스트 3종(RED→GREEN).

## Task Commits

1. **Task 1 RED: guest-promote 실패 테스트** - `d17905a` (test)
2. **Task 1 GREEN: linkIdentity 진입점 구현** - `7533fdc` (feat)
3. **Task 2: page.tsx 초대 카드 하단 마운트** - `aaa20e3` (feat)
4. **Task 3(자동화 부분): config.toml manual_linking** - `9bb4b40` (chore)

_Task 1은 TDD(test→feat). REFACTOR 불필요(구현 최소)._

## Files Created/Modified
- `apps/web/app/t/[slug]/_components/guest-promote.tsx` - 승격 진입점(linkIdentity kakao, 'use client', Button outline)
- `apps/web/__tests__/guest-promote.test.tsx` - 렌더·1회 호출·에러 토스트 3케이스(login.test mock 미러)
- `apps/web/app/t/[slug]/page.tsx` - GuestPromote import + 초대 카드 하단 마운트(surgical)
- `supabase/config.toml` - `[auth] enable_manual_linking = true`

## Decisions Made
- **linkIdentity options 없이 호출** — plan `<interfaces>`가 `linkIdentity({ provider: 'kakao' })`로 명세(login oauth의 `options.redirectTo` 미사용). 승격은 현재 페이지에서 시작 → 기본 리다이렉트.
- **secondary = Button variant=outline** — 토큰 클래스만(신규 hex 0, AC3 통과), primary CTA(가고싶어)와 시각 경합 방지(C6).
- **에러 처리 이중** — 반환 `{ error }` + try/catch. Manual linking 미활성 시 런타임 throw 가능성 대비(진입점은 렌더되나 클릭 시 fail-closed, T-25-13).
- **충돌·전체 승격 UX deferred** — Phase 25는 진입점만(D-03 최소 심).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 테스트 파일 경로를 `apps/web/__tests__/`로 조정**
- **Found during:** Task 1 (RED)
- **Issue:** plan 명세 경로 `apps/web/app/t/[slug]/_components/__tests__/guest-promote.test.tsx`는 `vitest.config.ts`의 `include: ['__tests__/**/*.test.ts(x)']`에 매칭되지 않아 수집 불가(테스트 무실행 = false green).
- **Fix:** `apps/web/__tests__/guest-promote.test.tsx`에 배치(25-03 guest-surface.test 선례 동일). import는 `@/app/t/[slug]/_components/guest-promote`(bracket 경로 alias 정상 해석). verify 커맨드도 `vitest run __tests__/guest-promote.test.tsx`로 조정.
- **Files modified:** apps/web/__tests__/guest-promote.test.tsx
- **Verification:** vitest 3/3 green(수집 확인), full web 153 green
- **Committed in:** d17905a (RED) / 7533fdc (GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking — vitest include 제약, 25-02/25-03 선례)
**Impact on plan:** 경로만 조정, 동작·커버리지 동일. 스코프 크립 0.

## Issues Encountered
None.

## User Setup Required

**외부 서비스 수동 설정 필요.** linkIdentity(D-03)는 원격 Supabase 프로젝트에서 **Manual linking 활성화**가 전제다.
- **Supabase Dashboard → Authentication → Settings → Manual linking 토글 ON** (원격 — config.toml `enable_manual_linking=true`와 짝, human-action)
- 미활성 시: 승격 진입점은 렌더되나 클릭 시 linkIdentity 런타임 에러(fail-closed, 권한 상승 없음)
- **A4 확인:** linkIdentity kakao provider 지원은 문서 발췌 불완전 — 배포 전 실 카카오 승격 e2e 권장

## Next Phase Readiness
- Phase 25 5/5 plans 코드 완료(25-01~25-05). 25-04 승격 진입점·config 로컬 완비.
- **잔여 블로커(2종, human-action):**
  1. **원격 0029 마이그레이션 push** — `git push origin main`(Supabase↔GitHub 자동) 또는 `supabase db push`
  2. **원격 Manual linking 토글 ON** — 대시보드(본 plan Task 3 체크포인트)
- 라이브 게스트 승격(익명 이력 유지)·direct-read·realtime·투표는 위 2종 적용 + `/gsd-verify-work 25` 후 동작. AUTH-08 REQUIREMENTS Pending 유지.
- 상세: `25-USER-SETUP.md`.

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*

## Self-Check: PASSED
- 생성 파일 3종 전부 디스크 존재 확인
- 태스크 커밋 4종(d17905a·7533fdc·aaa20e3·9bb4b40) git log 확인
