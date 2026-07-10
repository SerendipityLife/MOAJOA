---
phase: 25-guest-unified-share
plan: 03
subsystem: ui
tags: [nextjs, supabase-anon-auth, realtime, guest-share, react, vitest]

requires:
  - phase: 25-01
    provides: public_trip_poll · cast_date_vote_authed · joinMoa · share_mode on public_trip_view · getPublicTripPoll wrapper
  - phase: 25-02
    provides: poll-vote-island 임베드 props(deviceToken/nickname/onRequireMember) · place-list own-only 삭제 게이트
provides:
  - GuestSurface — /t/[slug] 게스트 통합 화면 뼈대(세션 lifecycle + lazy 익명 게이트 + share_mode 3분기 + 호스트 MoaIsland/PollVoteIsland 재사용 마운트)
  - NicknameGateSheet — BottomSheet 닉네임 게이트(C1)
  - page.tsx VoteIsland → GuestSurface 교체(SSR 셸 유지)
  - guest-surface 재사용 검증 테스트 6종 + 공유 픽스처 빌더
affects: [25-04 linkIdentity 승격, 25-05 스모크 확장, phase-27 SEC-01/NAME-01, guest-realtime]

tech-stack:
  added: []
  patterns:
    - "클라이언트 전용 세션 해석(vote-island lifecycle 미러) — 서버 컴포넌트 쿠키 API 무접근으로 SSR 캐시 무독성"
    - "lazy 익명 게이트 ensureGuestMember: signInAnonymously→joinMoa→setStoredNickname 순서 고정(Pitfall 4: join 후에만 island 마운트)"
    - "호스트 컴포넌트 재사용 마운트 스왑: read-only(seed+anon RPC) → join → full MoaIsland/PollVoteIsland"
    - "share_mode 3분기 조립(places/dates/both) — 신규 realtime/투표/색/채팅 로직 0"

key-files:
  created:
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx
    - apps/web/__tests__/guest-surface.test.tsx
    - apps/web/__tests__/guest-mocks.ts
  modified:
    - apps/web/app/t/[slug]/page.tsx

key-decisions:
  - "테스트를 apps/web/__tests__/에 배치 — vitest include glob이 __tests__/**만 수집(25-02 선례). 플랜 명시 경로(_components/__tests__/)는 미수집이라 동작 동일 정렬"
  - "guest-mocks.ts는 데이터 빌더만 — vitest가 vi.hoisted 변수 export를 금지해 spy는 테스트 파일에서 vi.hoisted로 생성(vote-island.test 선례)"
  - "linkIdentity 승격 진입점(C6/D-03)은 Plan 25-04 스코프라 이 플랜에서 제외 — 뼈대는 세션·게이트·share_mode 배선까지"
  - "both 모드는 poll 섹션 + MoaIsland(fixed 호스트 레이아웃)를 형제로 렌더 — 모으기 탭 내부 poll 임베드는 MoaIsland 수정 필요(D-08 無수정)라 라이브 합성은 이월"

patterns-established:
  - "게스트 island 래퍼: SSR 쿠키리스 셸 + 클라이언트 세션 lifecycle + join-후-마운트 스왑"
  - "PollVoteIsland.onRequireMember를 GuestSurface가 promise 브리지로 소유(첫 투표 전 익명 인증·join await)"

requirements-completed: []  # AUTH-08/SHARE-02/03/04 코드 경로 전달 — 라이브는 원격 0029 push + verify-work 후 완료 처리(25-01/25-02 선례)

duration: 8min
completed: 2026-07-10
---

# Phase 25 Plan 03: Guest Surface (게스트 통합 화면 뼈대) Summary

**`/t/[slug]`를 호스트 컴포넌트 재사용 게스트 통합 화면으로 진화 — 클라이언트 전용 세션 lifecycle + lazy 익명 게이트(signInAnonymously→join_moa) + share_mode 3분기로 MoaIsland/PollVoteIsland를 실 데이터 마운트, 신규 realtime/투표/색/채팅 로직 0.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-10T11:25:26Z
- **Completed:** 2026-07-10T11:33:31Z
- **Tasks:** 3 (Task 1·2 TDD)
- **Files created:** 4 · **modified:** 1

## Accomplishments

- **NicknameGateSheet(C1)** — poll inline 닉네임 게이트를 `@/components` BottomSheet로 승격. trim·빈값 에러 토스트·Enter 확정·중복 검증 없음(D-06)·토큰 클래스만(신규 hex 0). 확정 흐름은 GuestSurface가 소유하고 시트는 `onConfirm(trimmed)`만.
- **GuestSurface(뼈대)** — 세 검증된 analog 조각 조립:
  1. 클라이언트 전용 세션 해석(vote-island L106-137 미러) — 멤버(`getMyTripRole≠null`)면 게이트 스킵하고 곧장 MoaIsland 마운트(D-05 재접속).
  2. lazy 익명 게이트 `ensureGuestMember` — 첫 참여 액션에서만 `signInAnonymously({options:{data:{name}}})` → `joinMoa(slug)` → `setStoredNickname` 순서 고정(Pitfall 4: join 완료 후에만 island 마운트=채널 구독).
  3. join 후 seed 로딩(moa/[id]/page.tsx L36-53 client 재현) — `getTrip`+`listPlacesByTrip`/`listLinksByTrip`/`listTripMembers`/`listTripMessages`+`getVoteCounts`/`getMyVotedPlaceIds`+`getProfileNames`(nameIds에 uid 포함, Pitfall 6)로 `MoaIslandProps` 전부 구성.
- **share_mode 3분기(D-09)** — `places`→호스트 MoaIsland 재사용 / `dates`→`getPublicTripPoll(slug)`로 poll_code 획득 후 PollVoteIsland 임베드(deviceToken=auth.uid·onRequireMember 게이트) / `both`→poll 섹션 + 장소 리스트.
- **page.tsx surgical 교체** — VoteIsland → GuestSurface, `board`(share_mode 포함) seed props 전달. SSR 셸·초대 카드·출처 섹션·generateMetadata·getCachedPublicTrip·쿠키 무접근 전부 유지.

## Task Commits

1. **RED: guest-surface 테스트 + 픽스처** — `ababe25` (test)
2. **Task 1: nickname-gate-sheet** — `8eca62c` (feat)
3. **Task 2: guest-surface** — `dcdea3e` (feat, GREEN)
4. **Task 3: page.tsx 교체** — `d34e7fd` (feat)

## Files Created/Modified

- `apps/web/app/t/[slug]/_components/guest-surface.tsx` — 세션 lifecycle + lazy 게이트 + share_mode 분기 + join-후-마운트 스왑(≈290줄)
- `apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx` — BottomSheet 닉네임 게이트(C1)
- `apps/web/__tests__/guest-surface.test.tsx` — 6 케이스(SHARE-02 3분기·SHARE-03 게이트 순서/빈값 차단·AUTH-08 재접속 스킵)
- `apps/web/__tests__/guest-mocks.ts` — makeTrip/makePlace/makeBoard 빌더
- `apps/web/app/t/[slug]/page.tsx` — GuestSurface 마운트 지점 교체(diff 최소)

## Decisions Made

- **테스트 경로 정렬:** 플랜은 `_components/__tests__/`를 명시했지만 vitest `include`가 `__tests__/**`만 수집 → `apps/web/__tests__/`에 배치(25-02와 동일 정렬, 동작 동일).
- **guest-mocks.ts = 데이터 빌더만:** vitest가 `vi.hoisted` 변수의 모듈 간 export를 금지(`Cannot export hoisted variable`) → spy는 테스트 파일에서 `vi.hoisted`로 생성(vote-island.test 선례). 픽스처 파일은 순수 빌더 유지.
- **linkIdentity 승격(C6/D-03) 제외:** Plan 25-04(W3) 스코프. 이 뼈대는 세션·게이트·share_mode 배선까지.
- **both 합성 이월:** poll 섹션 + MoaIsland(fixed 호스트 레이아웃)를 형제로 렌더. "모으기 탭 상단에 poll 임베드"는 MoaIsland 수정이 필요(D-08 無수정 권장)해 라이브 합성은 verify-work/후속 이월.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — grep 게이트 오탐] guest-surface 주석의 `cookies()` 리터럴 재서술**
- **Found during:** Task 2 acceptance 검증
- **Issue:** docstring의 "서버 컴포넌트 cookies() 미접근" 문구가 `! grep -q "cookies("` 무독성 게이트에 오탐
- **Fix:** "쿠키 API 미접근"으로 의미 보존 재서술(24-05·26-02 선례)
- **Files modified:** guest-surface.tsx (주석)
- **Verification:** `! grep -q "cookies("` 통과 · 실제 서버 쿠키 접근 코드 0
- **Committed in:** `dcdea3e`

**2. [정렬 — deviation 아님] 테스트 파일 실제 경로 + guest-mocks 구성**
- vitest include glob 제약으로 테스트를 `apps/web/__tests__/`에 배치, spy는 테스트 파일 vi.hoisted. 동작 동일이라 기능 deviation 아님(25-02 선례).

---

**Total deviations:** 1 auto-fixed (Rule 1 grep 오탐) + 1 경로 정렬(비-deviation). **Impact:** 신규 기능 0, 계약·동작 무변경.

## Threat Surface Scan

플랜 `<threat_model>`(T-25-08~11) 범위 내. 신규 trust boundary 없음:
- T-25-08(캐시 오염): guest-surface `'use client'` + page.tsx cookies() 무접근(grep 통과) 유지.
- T-25-09(비멤버 구독): join_moa 완료 후에만 MoaIsland 마운트(=구독) — Pitfall 4 코드로 강제.
- 신규 network endpoint/auth path/schema 변경 0(RPC·마이그레이션 무접촉).

## Issues Encountered

- `vi.hoisted` 변수 export 금지 → guest-mocks.ts를 데이터 빌더로 축소하고 spy를 테스트 파일로 이동. 해결 후 6/6 그린.

## Next Phase Readiness

- **검증:** web 144→**150 그린**(guest-surface 6 신규 무회귀) · web typecheck 0 · **web build PASS**(`ƒ /t/[slug]` 3.53kB/219kB) · iOS/core/migrations 무접촉 · `.js` 워크스페이스 import 0 · 삭제 0.
- **라이브 게이트(변함없음):** 게스트 direct-read·realtime·dates/both 투표는 **원격 0029 push**(human-action, 25-01 이래 open) + verify-work 후 동작. AUTH-08/SHARE-02/03/04 REQUIREMENTS는 배포 전까지 Pending 유지(25-01/25-02 선례).
- **Ready for 25-04**(linkIdentity 승격 진입점 C6/D-03) · 25-05(스모크 확장).

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*

## Self-Check: PASSED

- 4 created files + SUMMARY on disk (`[ -f ]` 확인)
- 4 task commits(ababe25·8eca62c·dcdea3e·d34e7fd) git log 확인
- web 150 그린 · typecheck 0 · build PASS · acceptance grep 전종 통과
