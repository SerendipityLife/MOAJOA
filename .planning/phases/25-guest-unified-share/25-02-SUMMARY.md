---
phase: 25-guest-unified-share
plan: 02
subsystem: ui
tags: [react, next, poll-embed, place-delete, own-only, device-token, guest-surface]

# Dependency graph
requires:
  - phase: 25-guest-unified-share
    provides: "hide_place_as_member DEFINER RPC(0029) — hidePlace가 이미 RPC 경유(call-site 무변경) · castDateVoteAuthed"
  - phase: 19-date-polls
    provides: "poll-vote-island(anon castDateVote·presence·inline 닉네임 게이트)"
  - phase: 24-host-flow
    provides: "place-list(삭제 어포던스)·moa-island(currentUserId·trip 보유·handleDelete→hidePlace)"
provides:
  - "poll-vote-island optional embed seam: deviceToken/nickname/onRequireMember props (부재 시 /poll 레거시 무회귀)"
  - "place-list own-only 삭제 게이트(currentUserId/ownerId) — 게스트는 자기 장소만, 호스트는 전체"
  - "moa-island이 currentUserId + trip.owner_id를 PlaceList에 배선(host owner 분기 무회귀)"
affects: [25-03, guest-surface, poll-embed, place-delete-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "optional prop seam + fallback 체인(deviceToken ?? getDeviceToken)으로 레거시 호출부 무회귀 파라미터화"
    - "own-only 삭제는 UI 어포던스 게이트 + DB DEFINER RPC 이중 강제(D-12 airtight)"

key-files:
  created: []
  modified:
    - apps/web/app/poll/[code]/_components/poll-vote-island.tsx
    - apps/web/__tests__/poll-vote-island.test.tsx
    - apps/web/app/moa/[id]/_components/place-list.tsx
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/__tests__/place-list.test.tsx

key-decisions:
  - "deviceToken prop을 alias 없이 그대로 destructure하고 presence effect의 로컬 변수만 presenceToken으로 개명 — 계약 grep(deviceToken ?? getDeviceToken) 충족 + 상태 nickname과의 충돌은 nickname prop만 nicknameProp로 alias"
  - "onRequireMember 주입 시 inline 닉네임 게이트(if !nickname)를 (!nickname && !onRequireMember)로 축소 — 외부 BottomSheet 게이트가 신원을 소유"
  - "castVote가 setNickname 비동기 반영을 기다리지 않도록 effectiveNickname/effectiveDeviceToken 지역변수로 그 투표를 즉시 진행"

patterns-established:
  - "임베드 seam: prop 전부 부재 시 diff가 런타임 동작을 바꾸지 않는 fallback 체인(page.tsx diff 0 게이트로 실증)"
  - "own-only 어포던스 게이트는 currentUserId===undefined를 레거시 무조건 렌더로 취급(backward-compat)"

requirements-completed: []  # SHARE-03은 컴포넌트 seam만 제공 — 라이브 게스트 참여(찜·장소추가·날짜투표·닉네임 게이트)는 Plan 03 guest-surface + 원격 0029 push 몫이라 Pending 유지(25-01 SHARE-02/03 선례)

# Metrics
duration: 4min
completed: 2026-07-10
---

# Phase 25 Plan 02: Guest-Reused Component Parameterization Summary

**poll-vote-island에 deviceToken/nickname/onRequireMember optional prop seam을 열어 /t 임베드가 익명 auth.uid·외부 멤버 게이트로 날짜투표하게 하고(/poll 레거시 무회귀), place-list 삭제 어포던스를 own-only로 게이트해 게스트가 남의 장소 삭제 UI를 못 보게 한다(D-12, DB는 0029 RPC가 airtight 강제).**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-10T11:13:41Z
- **Completed:** 2026-07-10T11:17:43Z
- **Tasks:** 2 (both TDD: RED→GREEN)
- **Files modified:** 5

## Accomplishments

- **poll-vote-island 임베드 seam** — 3 optional props(`deviceToken`·`nickname`·`onRequireMember`) 추가. deviceToken은 presence key + castDateVote 인자에서 `deviceToken ?? getDeviceToken()` 폴백 체인, nickname은 state seed + stored-hydrate 스킵, onRequireMember는 첫 게스트 투표에서 외부 게이트를 1회 거쳐 `{uid, nickname}`으로 진행(inline 게이트 스킵). 세 prop 전부 부재 = /poll 레거시 완전 동일, `poll/[code]/page.tsx` diff 0.
- **place-list own-only 삭제 게이트(D-12)** — 무조건 렌더되던 삭제 버튼을 `currentUserId === undefined || added_by === currentUserId || currentUserId === ownerId`일 때만 렌더. moa-island이 `currentUserId` + `trip.owner_id` 배선(host는 owner 분기로 전 장소 삭제 유지). 삭제 블록 주석에 hide_place_as_member RPC(0029) DB own-only 연계 명시.
- **회귀 테스트** — poll-vote-island 2 신규(임베드 deviceToken/nickname·onRequireMember 게이트), place-list 4 신규(게스트 남의 장소 미렌더·자기 장소 렌더·호스트 전체 렌더·prop 부재 무조건). web 전체 144 그린·tsc 0.

## Task Commits

Each task via TDD RED→GREEN:

1. **Task 1 RED: poll-vote-island embed seam 실패 테스트** - `5198d46` (test)
2. **Task 1 GREEN: deviceToken/nickname/onRequireMember props** - `623aea7` (feat)
3. **Task 2 RED: own-only 삭제 게이트 실패 테스트** - `af1d537` (test)
4. **Task 2 GREEN: place-list own-only 게이트 + moa-island 배선** - `61788ab` (feat)

**Plan metadata:** (아래 docs 커밋)

## Files Created/Modified

- `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` - 3 optional embed props + fallback 체인 + onRequireMember 첫 투표 게이트 + inline 게이트 조건 축소
- `apps/web/__tests__/poll-vote-island.test.tsx` - 임베드 seam 2 케이스(기존 3 회귀 유지)
- `apps/web/app/moa/[id]/_components/place-list.tsx` - own-only 삭제 게이트(currentUserId/ownerId) + DB RPC 연계 주석
- `apps/web/app/moa/[id]/_components/moa-island.tsx` - PlaceList에 currentUserId + trip.owner_id 배선
- `apps/web/__tests__/place-list.test.tsx` - own-only 게이트 4 케이스(Test 15~18)

## Decisions Made

- **deviceToken prop un-alias:** 계약 grep(`deviceToken ?? getDeviceToken`)을 충족하려 deviceToken prop을 그대로 destructure하고, 충돌하던 presence effect 로컬 변수만 `presenceToken`으로 개명. nickname prop만 상태(`nickname`)와 충돌하므로 `nicknameProp`로 alias.
- **inline 게이트 축소:** `if (!nickname)` → `if (!nickname && !onRequireMember)`. onRequireMember가 있으면 외부 게이트가 신원을 소유하므로 바로 투표 UI 노출.
- **castVote 즉시 진행:** setNickname은 비동기 반영이라 onRequireMember 결과를 `effectiveNickname`/`effectiveDeviceToken` 지역변수로 받아 그 투표에 즉시 사용.

## Deviations from Plan

None - plan executed exactly as written.

동일 파일 경로 주의: 플랜 frontmatter는 테스트 파일을 `_components/__tests__/`로 표기했으나 실제 리포는 `apps/web/__tests__/`에 위치 — 실제 경로의 기존 테스트를 확장(신규 파일 생성 아님). 동작·산출물 동일이므로 deviation 아님.

## Issues Encountered

None. RED 각 태스크에서 신규 테스트가 정확히 실패(Task 1 2건·Task 2 Test 15) 후 GREEN 통과. web 144 그린·tsc 0.

## TDD Gate Compliance

| Task | RED (test) | GREEN (feat) | REFACTOR |
|------|-----------|--------------|----------|
| 1 (poll-vote-island seam) | ✓ 5198d46 | ✓ 623aea7 | — (불필요) |
| 2 (place-list own-only) | ✓ af1d537 | ✓ 61788ab | — (불필요) |

두 태스크 모두 RED→GREEN 게이트 순서 준수.

## Known Stubs

None. poll-vote-island seam은 Plan 03 guest-surface가 배선할 계약(prop 부재 시 레거시 동작)이고, own-only 게이트는 moa-island에서 실제 currentUserId/owner_id로 배선됨.

## Threat Flags

None. 새 network endpoint·auth path·schema 변경 0 — 순수 클라이언트 컴포넌트 파라미터화. T-25-05(own-only)·T-25-06(device_token 위조)·T-25-07(/poll 무회귀)는 플랜 threat_model대로 mitigate/verify.

## User Setup Required

None - 이 플랜은 외부 서비스 설정 불필요. (라이브 게스트 투표·삭제는 25-01의 원격 0029 push 게이트에 의존 — 25-01-SUMMARY / 25-USER-SETUP 참조.)

## Next Phase Readiness

- **Plan 03 guest-surface가 탐색 없이 배선할 seam 완비:** poll-vote-island(`deviceToken`=익명 auth.uid·`nickname`=저장 닉네임·`onRequireMember`=외부 BottomSheet 게이트) + place-list own-only(`currentUserId`·`ownerId`).
- **블로커:** 없음(로컬). 라이브 dates/both 임베드 투표·D-12 own-only 삭제는 25-01 원격 0029 배포 후 동작.

## Self-Check: PASSED

- Modified files present on disk (poll-vote-island.tsx·place-list.tsx·moa-island.tsx + 2 test files)
- Task commits present: 5198d46 (test)·623aea7 (feat)·af1d537 (test)·61788ab (feat)
- web 144 tests green · tsc exit 0 · page.tsx diff 0 · `.js` workspace import 0 · iOS/core/migrations untouched

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*
