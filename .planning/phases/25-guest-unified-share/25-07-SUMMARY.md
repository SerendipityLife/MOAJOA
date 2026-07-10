---
phase: 25-guest-unified-share
plan: 07
subsystem: ui
tags: [nextjs, react, vitest, supabase, date-poll, share-sheet, guest-share]

# Dependency graph
requires:
  - phase: 25-guest-unified-share (25-01)
    provides: 0029 public_trip_poll·cast_date_vote_authed + guest-surface pollMeta fetch 경로
  - phase: 25-guest-unified-share (25-06)
    provides: MoaIsland hideHostControls prop (guest-surface MoaIsland render 배선)
  - phase: 19 (0018_date_polls)
    provides: date_polls_write/date_poll_options_write RLS(can_edit_trip) + ensure_poll_code 트리거 + api 래퍼(getPollByTrip·getPollOptions·addPollOption·removePollOption)
provides:
  - createDatePoll api 래퍼 — 기존 트립에 date_poll 직접 INSERT(0018 RLS 게이트, 마이그레이션 0)
  - share-sheet 후보 날짜 세팅 step — dates/both 공유 시 poll ensure(멱등) + 옵션 추가/삭제 UI
  - MoaIsland pollSlot prop — both 모드 게스트 join 후 [모으기] 시트 상단 날짜투표 임베드
affects: [25-guest-unified-share verify-work, 27-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "poll ensure 멱등 패턴: getPollByTrip → null이면 createDatePoll (재공유 시 기존 poll·옵션 재사용)"
    - "island 임베드 슬롯: MoaIsland optional pollSlot?: ReactNode (미전달=호스트 diff 0, hideHostControls 선례)"

key-files:
  created: []
  modified:
    - packages/api/src/queries/date-polls.ts
    - packages/api/src/queries/date-polls.test.ts
    - apps/web/app/moa/[id]/_components/share-sheet.tsx
    - apps/web/__tests__/share-sheet.test.tsx
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/guest-surface.test.tsx

key-decisions:
  - "dates/both 공유 경로는 navigator.share 생략 — 호스트가 후보 날짜부터 세팅하도록 시트를 이어감(링크는 이미 클립보드, D-18). places 경로는 기존 동작 diff 0"
  - "옵션 단계 실패 토스트를 공유 실패 토스트와 분리('저장하지 못했어요...') — 링크 발급은 이미 성공한 상태라 오도 방지"
  - "완료 버튼은 후보 0개면 disabled — 빈 poll 공유 방지 넛지(plan 원안)"

patterns-established:
  - "게스트/호스트 화면 분기 확장은 병렬 컴포넌트가 아니라 MoaIsland optional prop 추가로 (hideHostControls→pollSlot 연속)"

requirements-completed: [SHARE-03]

# Metrics
duration: 14min
completed: 2026-07-10
---

# Phase 25 Plan 07: 웹 날짜투표 FULL FLOW (UAT Gap 1) Summary

**createDatePoll RLS 직접 INSERT 래퍼 + share-sheet 2-step(공유→후보 날짜 세팅) + MoaIsland pollSlot 임베드로 웹 호스트 dates/both 공유가 투표 가능한 date_poll을 만들고 게스트가 join 후에도 날짜투표 섹션을 보게 함 — 신규 마이그레이션 0**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-10T16:03:37Z
- **Completed:** 2026-07-10T16:17:16Z
- **Tasks:** 3 (전부 TDD RED→GREEN)
- **Files modified:** 7

## Accomplishments

- **Gap 1 FULL FLOW (blocker) 폐쇄:** 웹 '둘다/날짜 정하기' 공유가 share_mode만 UPDATE하고 date_poll을 만들지 않던 문제 종결 — shareMoa 후 getPollByTrip→(null이면) createDatePoll(range)→getPollOptions→후보 날짜 step 자동 전환. 기존 poll 존재 시 재사용(멱등, 테스트 앵커).
- **후보 날짜 세팅 UI:** 같은 시트 options step — rangeLabel(`6/14–6/16`) 목록 + 삭제(aria-label "후보 삭제", 44px, danger) + date input 2개·추가(가드: 둘 다 입력+종료>=시작, 위반 toast '날짜를 확인해 주세요') + 완료(0개 disabled). UI-SPEC 토큰만, 신규 hex 0(danger `text-[#EF4444]`는 place-list 확립 idiom).
- **UAT 증상 "닉네임 입력 후엔 호스트형 화면만" 해소:** MoaIsland는 fixed inset-0라 sibling pollSection을 덮음 → `pollSlot?: ReactNode`로 [모으기] PlaceSheet의 PlaceList 직전 임베드(UI-SPEC C2). guest-surface both 분기: joined 시 sibling→pollSlot 이동(중복 렌더 0), 비join sibling·dates/places 분기·pollMeta fetch·게이트 무변경.
- **재사용 강제 준수:** 신규 마이그레이션 0·RPC 0 — 0018 RLS(date_polls_write=can_edit_trip)+ensure_poll_code 트리거+기존 옵션 래퍼+0029 게스트 읽기/투표 경로(무수정) 재사용. PollVoteIsland 코드 무수정(D-10 /poll 레거시 무회귀).
- web 159→**165 그린**(+6: share-sheet 4·guest-surface 2) · api 103→**106 그린**(+3) · 전 스위트(core 173·ios 128 포함) exit 0 · tsc 0.

## Task Commits

1. **Task 1: createDatePoll 래퍼** — RED `64298fd` (test) → GREEN `f55f5b4` (feat)
2. **Task 2: share-sheet 후보 날짜 세팅 step** — RED `cd11963` (test) → GREEN `ef1a26c` (feat)
3. **Task 3: both 모드 pollSlot 임베드** — RED `57cd4f9` (test) → GREEN `e516f8f` (feat)

_TDD: 각 RED 커밋에서 behavior 실패 확인(Task 1: 3/3 fail · Task 2: 3/4 fail · Task 3: Test F fail — 회귀 케이스는 설계상 사전 pass) 후 GREEN._

## Files Created/Modified

- `packages/api/src/queries/date-polls.ts` — createDatePoll append (setPollMode 'no new RPC' idiom 미러, 기존 함수 무수정)
- `packages/api/src/queries/date-polls.test.ts` — createDatePoll 3케이스 (shaped insert·{error} throw·mode 기본 range)
- `apps/web/app/moa/[id]/_components/share-sheet.tsx` — step state('mode'|'options') + poll ensure + options step UI + rangeLabel 3줄 미러
- `apps/web/__tests__/share-sheet.test.tsx` — @moajoa/api mock 5함수 확장 + 4케이스(Gap 1·멱등·추가/삭제·places 회귀)
- `apps/web/app/moa/[id]/_components/moa-island.tsx` — pollSlot?: ReactNode prop + PlaceList 직전 렌더(3줄+주석)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` — both 분기 joined 시 pollSlot 전달·sibling 제거(비join 경로 무변경)
- `apps/web/__tests__/guest-surface.test.tsx` — MoaIsland 스텁 pollSlot 확장 + Test F/G

## Decisions Made

- dates/both 공유 후 navigator.share 생략(plan이 위임한 재량 결정 — 링크는 클립보드에 이미 복사됨, 호스트 플로우가 후보 날짜 세팅으로 이어져야 함. 코드 주석 기록)
- 나머지는 plan 원안 그대로(잠금 결정 집행: FULL FLOW·멱등 ensure·같은 파일 유지·grid 토글/0-vote 잠금 미도입)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 테스트 기대값 정정 — rangeLabel 실제 출력 형식**
- **Found during:** Task 2 (share-sheet options step GREEN 단계)
- **Issue:** RED 테스트가 poll-vote-island rangeLabel doc 주석의 축약 표기 `6/14–16`을 기대했으나 실제 함수 출력은 `6/14–6/16`(`${fmt(start)}–${fmt(end)}` — 양끝 모두 월/일)
- **Fix:** 테스트 기대값 3곳을 `6/14–6/16`으로 정정(구현은 poll-vote-island L71-77 verbatim 미러 유지 — /poll 표시와 동일)
- **Files modified:** apps/web/__tests__/share-sheet.test.tsx
- **Verification:** share-sheet 9/9 그린
- **Committed in:** ef1a26c (Task 2 GREEN 커밋)

---

**Total deviations:** 1 auto-fixed (Rule 1 — 테스트 픽스처 버그, 구현·plan 계약 무변경)
**Impact on plan:** 없음 — 표시 형식은 기존 /poll 화면과 동일한 함수 미러라 오히려 일관성 확보.

## Issues Encountered

None

## Verification Results

- `grep "export async function createDatePoll"` present + `! ls supabase/migrations | grep ^0030` → PASS
- share-sheet acceptance grep(createDatePoll·getPollByTrip·addPollOption·removePollOption) → PASS
- pollSlot grep: moa-island 3곳(선언·destructure·렌더) + guest-surface `pollSlot=` → PASS
- `CI=true pnpm --filter @moajoa/api test date-polls` → 33/33 PASS
- `CI=true pnpm --filter @moajoa/web test share-sheet guest-surface moa-island` → 9+10+19 PASS
- `CI=true pnpm test` (core 173·api 106·web 165·ios 128) → exit 0 PASS
- `pnpm --filter @moajoa/web exec tsc --noEmit` → exit 0 PASS
- iOS/core/migrations diff 0 (`git diff --stat 64298fd^..HEAD -- apps/ios packages/core supabase/migrations` = 0줄) PASS
- 라이브 검증 통과분 무접촉: 0029 게스트 투표 경로·닉네임 게이트·재접속·D-12·SSR 코드 diff 0 (guest-surface는 both 분기 렌더 블록만 변경)

## Known Stubs

None — 새 UI는 전부 실 데이터 배선(addPollOption/removePollOption 왕복, 로컬 state 동기화). 하드코딩 빈값·placeholder 0.

## User Setup Required

None - no external service configuration required. (배포 게이트 2종은 이미 pass — 본 plan 무관.)

## Next Phase Readiness

- **Phase 25 gap closure 완료(7/7 plans)** — UAT blocker 2종(클릭 도달·날짜투표 full flow) 전부 코드 종결
- 라이브 재검증(UAT Test 3 재실행)은 배포 후: 호스트 '둘다 정하기' 공유→후보 날짜 2개 추가→시크릿 /t/[slug] 날짜투표 렌더+투표+집계, both join 후 [모으기] 상단 날짜투표 유지
- UAT Test 4(D-12 own-only + linkIdentity 승격)도 배포 후 pending

---
*Phase: 25-guest-unified-share*
*Completed: 2026-07-10*

## Self-Check: PASSED

- 수정 파일 4종(+SUMMARY) 존재 확인 · 커밋 6개(64298fd·f55f5b4·cd11963·ef1a26c·57cd4f9·e516f8f) 존재 확인 · 파일 삭제 0 · 신규 마이그레이션 0
