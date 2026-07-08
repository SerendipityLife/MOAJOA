---
phase: 24-host-flow
plan: 03
subsystem: ui
tags: [nextjs, rsc, supabase, oauth, kakao, auth, routing]

# Dependency graph
requires:
  - phase: 24-host-flow (24-02)
    provides: listMyTripsWithPreview (TripPreview.place_count) + CITY_KO_MAP contract
  - phase: 23-host-flow (23-03/23-07)
    provides: Kakao provider config.toml + PKCE callback (프로덕션 실증)
provides:
  - /moa RSC 진입점 — D-01 분기 (0→/onboarding, 1→/moa/[id], 2+→리스트) 한 곳 집중
  - D-12 미니멀 카드 리스트 (이름·도시·날짜·장소 수) + 새 모아 CTA
  - /login 카카오 버튼 (AUTH-07) — signInWithOAuth({provider:'kakao'}) 기존 PKCE 콜백 경유
  - 로그인 후 기본 목적지 /moa (login + callback fallback)
affects: [24-04, 24-05, 24-06, 24-07, moa map tab, onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "분기 로직을 /moa RSC 한 곳에 집중 — login·callback은 URL만 인지 (RESEARCH Pattern 3)"
    - "OAuth provider union 확장만으로 신규 IdP 추가 (oauth() 함수 본문 무변경)"

key-files:
  created:
    - apps/web/app/moa/page.tsx
    - apps/web/__tests__/login.test.tsx
  modified:
    - apps/web/app/login/page.tsx
    - apps/web/app/auth/callback/route.ts
    - apps/web/lib/member-color.ts
    - apps/web/__tests__/place-sort.test.ts

key-decisions:
  - "새 모아 CTA는 Button 대신 primary-styled <Link> — RSC에서 onClick 없는 순수 내비게이션"
  - "city_code null 방어: '도시 미정' fallback (Trip.city_code nullable)"

patterns-established:
  - "진입 분기 단일 소스: /moa RSC가 count 기반 redirect 소유, login/callback은 목적지 URL만"

requirements-completed: [AUTH-07]  # ONBOARD-03의 진입 분기(→/onboarding)만 여기서; 4단계 위저드·모아 생성 본체는 24-04

# Metrics
duration: 18min
completed: 2026-07-08
---

# Phase 24 Plan 03: 진입 경로 (Host Flow Entry) Summary

**/moa RSC가 D-01 로그인후 분기(0→온보딩·1→지도탭·2+→리스트)와 D-12 미니멀 카드를 소유하고, /login에 카카오 버튼(AUTH-07)이 기존 PKCE 콜백 경유로 붙었다.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-08T18:33Z
- **Completed:** 2026-07-08T18:45Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `/moa` RSC — auth 게이트 + D-01 분기(정확한 순서) + D-12 미니멀 카드 리스트 + 새 모아 CTA, build 그린 라우트 테이블 `ƒ /moa`
- 카카오 로그인 버튼(#FEE500, UI-SPEC A-9) — oauth() provider union += 'kakao'만으로 배선, PKCE 콜백·이메일/구글/애플 경로 완전 무수정
- 로그인 후 기본 목적지 login·callback 양쪽 fallback `/` → `/moa` (open-redirect 가드 2곳 보존)
- login 단위 테스트 3케이스(렌더·정확 provider:'kakao' 호출·error toast) — web 77→80 그린

## Task Commits

1. **Pre-req blocking fix (member-color/place-sort)** - `576504c` (fix)
2. **Task 1: /moa RSC — D-01 분기 + D-12 카드** - `8ee3eab` (feat)
3. **Task 2: 카카오 버튼 + 목적지 /moa** - `556993f` (feat)
4. **Task 3: login 단위 테스트** - `a0b3d0e` (test)

## Files Created/Modified
- `apps/web/app/moa/page.tsx` (created) - D-01 분기 + D-12 카드 리스트 RSC
- `apps/web/__tests__/login.test.tsx` (created) - AUTH-07 카카오 OAuth 단위 검증 3케이스
- `apps/web/app/login/page.tsx` (modified) - oauth union += kakao + 카카오 버튼 + postLoginDestination /moa
- `apps/web/app/auth/callback/route.ts` (modified) - next 기본 fallback /moa (PKCE exchange 무수정)
- `apps/web/lib/member-color.ts` (modified) - noUncheckedIndexedAccess 블로킹 픽스 (24-02 잔여)
- `apps/web/__tests__/place-sort.test.ts` (modified) - noUncheckedIndexedAccess 블로킹 픽스 (24-02 잔여)

## Decisions Made
- 새 모아 CTA를 `Button`(client, onClick 기반) 대신 primary 스타일 `<Link>`로 — /moa가 RSC라 내비게이션엔 anchor가 정합
- `surface.background`/`surface.raised` = Tailwind `bg-surface-background`/`bg-surface-raised` (ui-tokens 프리셋), 카드 그림자는 토큰에 `card` 없어 `shadow-sm`+hover `shadow-md`
- `Trip.city_code` nullable → '도시 미정' fallback (plan 원문 `CITY_KO_MAP[trip.city_code] ?? trip.city_code`는 null 인덱스 타입 에러라 가드 추가)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 24-02 잔여 noUncheckedIndexedAccess 에러가 web build 차단**
- **Found during:** Task 1 (build 검증)
- **Issue:** `lib/member-color.ts:15`(tuple 인덱스 `string | undefined`)과 `__tests__/place-sort.test.ts:41`(`out[1]` possibly undefined)이 `next build`의 타입체크를 실패시킴 — 24-02가 web typecheck/build를 실행하지 않아 잔존(vitest는 esbuild라 strict 타입 미검). Task 1 acceptance(`build PASS`)를 막는 하드 블로커.
- **Fix:** 각 1줄 non-null 단언(modulo는 항상 유효 인덱스 / out은 2요소) — 로직·동작 무변경
- **Files modified:** apps/web/lib/member-color.ts, apps/web/__tests__/place-sort.test.ts
- **Verification:** `pnpm --filter @moajoa/web typecheck` exit 0, `build` PASS
- **Committed in:** 576504c (별도 fix 커밋)

**2. [Rule 1 - Bug] /moa city_code null 인덱스 타입 에러**
- **Found during:** Task 1 (typecheck)
- **Issue:** plan 원문 `CITY_KO_MAP[trip.city_code]`가 `trip.city_code: string | null`로 인덱스 불가(TS2538)
- **Fix:** `trip.city_code ? (CITY_KO_MAP[...] ?? city_code) : '도시 미정'` 3항 가드
- **Files modified:** apps/web/app/moa/page.tsx
- **Verification:** typecheck exit 0
- **Committed in:** 8ee3eab (Task 1 커밋)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** 둘 다 컴파일/빌드 정합에 필수. 신규 기능 0, 스코프 크립 없음. member-color/place-sort 픽스는 24-02 잔여로 본 plan 파일과 무관하나 공유 build 게이트를 막아 처리(별도 커밋 격리).

## TDD Gate Compliance

Task 3만 `tdd="true"`. 플랜 설계상 구현(Task 2)이 테스트(Task 3)보다 먼저라 classic RED-first 아님 — 카카오 버튼이 Task 2에서 이미 배선되어 Task 3 테스트는 GREEN으로 통과(회귀 커버리지 성격). fail-fast 위반 아님(같은 plan 내 의도된 순서). `test(24-03)` 커밋(a0b3d0e)으로 게이트 기록. 실로그인 e2e는 Vercel Preview UAT 몫(23-07 잠금).

## Issues Encountered
- `pnpm --filter @moajoa/web test:run -- login` 의 positional 필터가 전체 스위트를 돌림(14 files/80 tests) — 문제 아님, 전체 무회귀 그린 확인됨(login 3케이스 포함).

## User Setup Required
None - 카카오 provider·PKCE 콜백은 23-03/23-07에서 이미 설정·프로덕션 실증 완료. 실카카오 로그인 검증은 Vercel Preview UAT 몫.

## Next Phase Readiness
- /moa 진입점 + 카드 리스트 완성 — 24-04+ 지도탭(`/moa/[id]`)이 CTA·카드 링크 목적지로 준비됨
- **Blocker(기존):** 원격 `supabase db push`(0024·0025·0026) human-action 게이트 여전히 open — Vercel Preview e2e(카카오 실로그인 포함) 선행조건

---
*Phase: 24-host-flow*
*Completed: 2026-07-08*

## Self-Check: PASSED
- Files verified: apps/web/app/moa/page.tsx, apps/web/__tests__/login.test.tsx, 24-03-SUMMARY.md
- Commits verified: 576504c, 8ee3eab, 556993f, a0b3d0e
