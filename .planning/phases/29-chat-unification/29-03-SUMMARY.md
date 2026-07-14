---
phase: 29-chat-unification
plan: 03
subsystem: ui
tags: [react, nextjs, poll-vote-island, retirement, api-cleanup, tdd]

# Dependency graph
requires:
  - phase: 29-chat-unification (29-02)
    provides: guest-surface embedded 전달 라인 선은퇴 — PollVoteIsland embedded prop 제거가 tsc-safe
  - phase: 19-date-poll
    provides: poll-chat.tsx·postComment/deleteComment (은퇴 대상)
provides:
  - poll-chat.tsx 부재 — 한마디 표면·라벨 apps/web 소스에서 완전 소멸 (CHAT-06, HC-7 grep 3종 0건)
  - PollVoteIsland 투표 전용 island — PollChat 마운트·presence 표시/track·embedded prop 제거, vote broadcast 유지
  - Pitfall 1 봉합 — stored-nickname hydrate가 onRequireMember 게이트를 우회하지 않음 (T-29-11)
  - date-polls.ts postComment/deleteComment orphan 제거
affects: [29-04 poll-guest-island 래퍼 (poll page 채팅 탑재)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "은퇴 수술의 유지 앵커를 acceptance grep으로 고정: channelRef·'vote' 존재 grep = iOS broadcast 계약 회귀 차단 (T-29-12)"
    - "삭제 전 소비-형태-한정 grep (from './x'|<X): 설명 주석 오탐 배제 — moa-chat.tsx diff-0 앵커 보존"

key-files:
  created: []
  modified:
    - apps/web/app/poll/[code]/_components/poll-vote-island.tsx
    - apps/web/__tests__/poll-vote-island.test.tsx
    - packages/api/src/queries/date-polls.ts
    - packages/api/src/queries/date-polls.test.ts
  deleted:
    - apps/web/app/poll/[code]/_components/poll-chat.tsx

key-decisions:
  - "presence 표면은 채팅 presence(moa:{tripId})로 단일화 (재량 1/A-4) — poll:{tripId} 채널은 vote broadcast 전용으로 축소, 채널 프로토콜('vote' 이벤트)은 무변경 (iOS 수신 계약)"
  - "date_comments 테이블·0018 DB 함수 무접촉 (D-02a) — DROP은 append-only 규칙상 별건 후속, T-29-13 accept"
  - "castDateVote(device_token 레거시 경로)·getDeviceToken 유지 — /poll 래퍼의 authed 전환은 D-02 범위 밖 (surgical §3.3)"

patterns-established:
  - "stored-hydrate 게이트 정합: RPC 선택 분기(onRequireMember 존재)와 게이트 호출 분기(nickname 부재)가 어긋나지 않게 hydrate skip 조건을 게이트 존재에 정렬"

requirements-completed: [CHAT-06, CHAT-07]

# Metrics
duration: ~15min (세션 인터럽트 제외 실작업)
completed: 2026-07-14
---

# Phase 29 Plan 03: 한마디 은퇴 (D-02) Summary

**poll-chat.tsx 삭제 + PollVoteIsland에서 PollChat 마운트·presence 표시/track·embedded prop 은퇴 + api postComment/deleteComment orphan 제거 — vote broadcast(iOS 계약)·투표 UI·집계는 무접촉, 부수로 stored-nickname 게이트 우회(Pitfall 1) 1줄 봉합**

## Performance

- **Duration:** ~15 min 실작업 (2026-07-14T00:56Z 시작, 세션 리밋 인터럽트 1회 후 재개, 04:11Z 완료)
- **Tasks:** 2 (Task 1 TDD RED→GREEN, Task 2 삭제+정리)
- **Files:** 4 modified + 1 deleted

## Accomplishments

- **CHAT-06:** 한마디 표면·라벨 완전 소멸 — HC-7 grep 3종(`한마디`·`투표가 마감되어 메시지를 남길 수 없어요`·`이 메시지를 삭제할까요?`) apps/web 소스 0건. 29-02가 guest-surface 몫을 선소진했으므로 이 plan에서 전량 0 달성
- **CHAT-07 무회귀:** 투표 optimistic·롤백·집계·inline 게이트·GridCalendar 무수정 — 기존 5케이스 무수정 그린, `channelRef`·broadcast `'vote'` 바인딩·`.subscribe()` 유지 (iOS 호스트 plan 탭 수신 계약, T-29-12)
- **Pitfall 1 봉합 (T-29-11):** stored-hydrate effect skip 조건에 `|| onRequireMember` 1줄 — stored nickname만 있고 세션 없는 재방문자가 게이트 우회로 `castDateVoteAuthed` 401을 맞는 UX 결함 제거 (RED로 현행 우회 실증 후 GREEN)
- **presence 단일화 (재량 1/A-4):** poll 자체 presence 표시("지금 N명 보는 중")·track·sync 바인딩 제거 — 채팅 presence(`moa:{tripId}`)가 유일 표면. 알려진 비용: iOS 호스트 "보는 중" 카운트에서 웹 방문자 누락 (T-29-14 accept)
- **api orphan 0:** `postComment`/`deleteComment` 래퍼·테스트 describe·COMMENT 픽스처 제거 — `castDateVote`·`getPollTally`·`confirmPollDate` 등 나머지 전부 무접촉
- **D-02a:** date_comments 테이블·0018 DB 함수 무접촉 — supabase/migrations 이 plan diff 0

## Task Commits

1. **Task 1 RED: retire 한마디/embedded cases, add stored-nickname gate case** - `fc4f11e` (test — 신규 Pitfall 1 케이스만 실패, 유지 5케이스 그린 확인)
2. **Task 1 GREEN: retire PollChat/presence/embedded from poll-vote-island (D-02)** - `376b8c4` (feat — 6/6 그린 + tsc 0)
3. **Task 2: delete poll-chat and orphaned comment queries (D-02)** - `e7fb6b6` (feat — git rm + api 정리, 전 스위트 exit 0)

## TDD Gate Compliance

test(`fc4f11e`) → feat(`376b8c4`) 순서 정합. RED는 타깃 실패(Pitfall 1 케이스 1건만 fail, 5 pass) — import 에러 아님.

## Files Created/Modified

- `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` (627→575줄, min_lines 300 충족) - PollChat import·마운트 2곳(closed/open)·embedded prop 선언/destructure/가드 3곳·viewers/sharedChannel state·presence config/sync/track/re-track effect 제거. 유지: channelRef(:투표 broadcast .send)·'vote' 바인딩·castVote 전체·inline 게이트·GridCalendar. Pitfall 1 봉합 1줄(deps 배열 무변경 — onRequireMember는 안정 함수 prop 관례)
- `apps/web/__tests__/poll-vote-island.test.tsx` - postComment/deleteComment/Dialog mock·embedded 케이스 은퇴, getStoredNickname configurable vi.fn 승격, Pitfall 1 케이스 추가, track/presenceState 스텁 정리 (GREEN이 orphan화한 것만)
- `packages/api/src/queries/date-polls.ts` - postComment/deleteComment 블록(JSDoc 포함) 제거 + 헤더 SECURITY 주석의 comment RPC 언급 정리 — 나머지 wrapper 전부 무접촉
- `packages/api/src/queries/date-polls.test.ts` - postComment/deleteComment describe + import + COMMENT 픽스처 제거 — 나머지 케이스 무수정
- `apps/web/app/poll/[code]/_components/poll-chat.tsx` - **삭제** (이 plan의 유일한 파일 삭제, 의도됨)

## Decisions Made

None beyond plan — plan 원안 그대로. 재량 판단 1건(문서화만): GREEN 커밋에 테스트 파일의 orphan 스텁 정리(Dialog mock·track/presenceState) 포함 — 이번 변경이 orphan화한 것만 제거 (§3.3), 신규 동작 0.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 세션 리밋 인터럽트 1회 (Task 1 GREEN 수술 중간) — 재개 후 uncommitted diff를 grep으로 재검증하고 남은 제거 좌표(마운트 2곳·presence 스트립·doc 주석 `viewers` 리터럴)만 완료. 기능 영향 0.
- `git add 'apps/web/.../[code]/...poll-chat.tsx'` pathspec이 삭제 후 글롭 미매칭 — `git rm`이 이미 스테이징했으므로 무해 (커밋 정상).

## Known Stubs

None. 은퇴 plan 특성상 신규 표면 0 — 하드코딩 빈값·placeholder 미도입.

## Threat Flags

None — 신규 네트워크 엔드포인트·auth 경로·스키마 변경 없음 (제거 전용). threat_model의 mitigate 2종(T-29-11 게이트 봉합·T-29-12 broadcast 유지 grep 고정) 모두 적용됨.

## Verification

- Task 1: 필터 스위트 6/6 그린 · web tsc 0 · 은퇴 식별자 grep(`PollChat|embedded|viewers|sharedChannel|.track(`) 0건 · channelRef/'vote' 존재 · `onRequireMember) return` 1건 · 한마디 0건
- Task 2: poll-chat.tsx 부재 · postComment/deleteComment repo grep 0 · HC-7 3종 0건 · migrations diff 0 · `CI=true pnpm -r test` exit 0 (core 192·api 111·web 272) · `pnpm -r typecheck` exit 0
- 회귀 앵커: 99b8db3..HEAD에서 apps/ios·supabase/migrations·moa-chat/moa-island/moa-tab-bar diff 0 · 삭제 파일 poll-chat.tsx 1개뿐

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **29-04 (Wave 3) 언블록:** PollVoteIsland가 투표 전용으로 정리되어 poll-guest-island 래퍼가 채널 소유(`moa:{tripId}`)·게이트·MoaChat 마운트를 충돌 없이 조립 가능. `onRequireMember` 게이트 경로는 Pitfall 1 봉합 상태로 인계.
- **라이브 검증:** /poll 투표·broadcast 실회귀 확인은 phase 완료 배포 후 verify-work 몫 (0032 원격 push는 29-04 human-action).

## Requirements Marking Note

CHAT-06/CHAT-07은 REQUIREMENTS.md 미등록 (phase 29가 ROADMAP Success Criteria에서 발급한 축 — 29-01/29-02 선례 동일). 등록·완료 마킹은 phase verify-work 몫으로 이관. 이 plan은 CHAT-06(중복 대화 표면 제거)과 CHAT-07(투표·broadcast·기존 채팅 무회귀)을 코드 레벨에서 전달.

## Self-Check: PASSED

- 수정 4파일 + 삭제 1파일(부재 확인) + SUMMARY 존재 확인
- 커밋 3개(fc4f11e·376b8c4·e7fb6b6) git log 존재 확인
- TDD 게이트: test→feat 순서 정합, RED 타깃 실패 실증

---
*Phase: 29-chat-unification*
*Completed: 2026-07-14*
