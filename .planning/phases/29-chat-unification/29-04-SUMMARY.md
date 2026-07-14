---
phase: 29-chat-unification
plan: 04
subsystem: ui
tags: [react, nextjs, realtime, presence, anonymous-auth, poll, tdd]

# Dependency graph
requires:
  - phase: 29-chat-unification (29-01)
    provides: 0032 join_moa_by_poll_code RPC + joinMoaByPollCode typed 래퍼 (게이트 confirm의 join 경로)
  - phase: 29-chat-unification (29-03)
    provides: PollVoteIsland 투표 전용 정리(PollChat/presence/embedded 소멸) — 래퍼가 채널·게이트를 충돌 없이 소유
  - phase: 26-realtime-chat
    provides: MoaChat controlled 프레젠테이션 + trip_messages/moa:{tripId} 채널 계약
  - phase: 25-guest-unified-share
    provides: guest-surface 게이트 브리지·ensureGuestMember analog + NicknameGateSheet
provides:
  - poll-guest-island.tsx — /poll/[code] 게이트+채팅 채널-소유 래퍼 (PollVoteIsland와 게이트 공유, A-7 어느 쪽이 먼저든 1회)
  - /poll·/t·/moa 대화의 단일 메커니즘 수렴 — trip_messages 저장소 + moa:{tripId} 채널 (CHAT-05)
  - /poll 투표 authed 전환 — onRequireMember 전달로 castDateVoteAuthed 경로 (Open Q2 채택)
  - 원격 0032 적용 완료 (migration list Local·Remote 0032 정합) — 라이브 /poll 채팅 join 전제 해소
affects: [29 verify-work (라이브 스팟 체크 a/b/c), 향후 /poll 표면 작업 전부]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "채널-소유 경량 래퍼: fixed inset-0 셸(MoaIsland) 재사용 대신 페이지 섹션용 h-[400px] 컨테이너 + MoaChat controlled 소비 — topic당 1채널 규약 유지"
    - "비멤버 compose 미러: MoaChat 미마운트 상태에서 compose row만 verbatim 복제(자체 draft/sending) — 성공 시 joined 전환으로 MoaChat이 이력과 함께 인계"
    - "acceptance grep 금지어는 주석에서도 회피: 'getTrip' 리터럴을 'trips 단건 조회'로 재서술 (24-05/26-02 선례 연장)"

key-files:
  created:
    - apps/web/app/poll/[code]/_components/poll-guest-island.tsx
    - apps/web/__tests__/poll-guest-island.test.tsx
  modified:
    - apps/web/app/poll/[code]/page.tsx

key-decisions:
  - "Open Q2 채택: /poll 투표를 authed 경로로 전환(onRequireMember 상시 전달) — 재방문자의 구 device_token 투표행 + 신 uid 투표행 중복 엣지는 낮은 확률·낮은 피해(집계 +1)로 수용, 코드 주석 기록 (T-29-19 accept)"
  - "재방문 hydrate는 listTripMessages만 — trips 단건 조회 API 미호출 (Pitfall 2: 레거시 dateless-poll trip은 visibility='private'라 voter 멤버여도 trips SELECT 불가)"
  - "비멤버 = MoaChat 미마운트 + A-7 전용 빈 상태 카피 + compose 미러 — moa-chat.tsx diff 0 유지 (HC-3)"
  - "원격 push는 human-action 게이트 유지(24-01/25-01 선례) — Claude가 대신 push하지 않고 체크포인트 2회로 사용자 확인"

patterns-established:
  - "human-action 체크포인트에서 전제 실측 재검증: 사용자 approved 후에도 supabase migration list로 Remote 컬럼을 실확인 — 1차 approved 시 0032 미적용(origin/main 33커밋 미push)을 잡아냄"

requirements-completed: [CHAT-05, CHAT-07]

# Metrics
duration: ~12min 실작업 (human-action 게이트 왕복 2회 제외)
completed: 2026-07-14
---

# Phase 29 Plan 04: /poll 통일 채팅 (D-03) Summary

**신규 채널-소유 래퍼 poll-guest-island가 PollVoteIsland와 채팅 섹션을 함께 감싸 게이트 1회 공유(A-7) — signInAnonymously→join_moa_by_poll_code(0032)→trip_messages·moa:{tripId} 합류로 /poll·/t·/moa 대화 수렴(CHAT-05), page.tsx는 마운트 교체만, 원격 0032 적용은 human-action 2회 왕복 끝에 정합 확인**

## Performance

- **Duration:** ~12 min 실작업 (2026-07-14T04:14Z 시작, Task 1-2 완료 04:29Z경 — 이후 human-action 체크포인트 왕복 2회)
- **Tasks:** 2 auto (Task 1 TDD RED→GREEN, Task 2 마운트 교체) + 1 checkpoint:human-action (resolved)
- **Files:** 2 created + 1 modified

## Accomplishments

- **CHAT-05 코드 완결:** /poll/[code] 방문자가 첫 채팅 전송(또는 첫 투표)에서 닉네임 게이트 1회 → 익명 멤버 승격 → 메시지가 trip_messages에 저장·moa:{tripId} 채널로 실시간 수신 — /t·/moa와 동일 메커니즘
- **게이트 promise 브리지 공유 (A-7):** PollVoteIsland `onRequireMember`와 채팅 첫 전송이 같은 requireMember 브리지 소유 — 어느 쪽이 먼저든 게이트 1회
- **채널 소유 규율:** `joined && userId`일 때만 구독(Pitfall 4/T-29-15 — Test 1이 join 전 `channel()` 미호출 단언), pre-subscribe 바인딩 2개 체이닝(#1917), 언마운트 removeChannel 동일 인스턴스, /poll 내 moa:{tripId} topic 유일 소유자
- **Pitfall 2 준수:** 재방문 hydrate가 listTripMessages만 호출 — trips 단건 조회 grep 0건 (레거시 private dateless-poll trip에서 join 후 영구 빈 화면이 되는 함정 회피, Test 2/3이 미호출 단언)
- **비멤버 표면 (A-7):** 섹션 상시 렌더 + 전용 빈 상태 카피 "참여하면 지금까지의 대화를 볼 수 있어요" + moa-chat compose verbatim 미러(IME 조합 가드·maxLength 140·draft 복원·에러 토스트) — 이력은 hydrate 자체 미실행(RLS 정직 전달, T-29-18)
- **Open Q2 채택:** /poll 투표 authed 전환 — deviceToken=uid·onRequireMember 전달로 castDateVoteAuthed(auth.uid 서버파생) 경로, 중복투표 엣지 수용 주석 기록 (T-29-19)
- **CHAT-07 무회귀:** moa-chat/moa-island/moa-tab-bar/nickname-gate-sheet 이 plan diff 0 · 기존 채팅 스위트(moa-chat 10·moa-island 36) 무수정 그린 · apps/ios 무접촉
- **원격 0032 적합:** human-action 게이트 resolved — `supabase migration list` Remote 컬럼 0032 정합 실측

## Task Commits

1. **Task 1 RED: failing poll-guest-island cases** - `fe9fb50` (test — render-null 스텁으로 6/6 behavior 실패, 임포트 에러 아님·26-01 선례)
2. **Task 1 GREEN: poll-guest-island — unified chat on /poll (D-03)** - `a64c246` (feat — 6/6 그린 + moa-chat 10·moa-island 36 무회귀 + web tsc 0)
3. **Task 2: mount unified chat island on /poll page** - `3289bde` (feat — surgical 교체, 풀 게이트: core 192·api 111·web 278·ios 128 + typecheck 0 + build PASS)

**Checkpoint (Task 3, human-action):** 코드 커밋 없음 — 원격 DB 상태만. 아래 참조.

## TDD Gate Compliance

test(`fe9fb50`) → feat(`a64c246`) 순서 정합. RED는 render-null 스텁으로 6케이스 전부 behavior 단언에서 실패(임포트 에러 아님) 실증 후 GREEN.

## Files Created/Modified

- `apps/web/app/poll/[code]/_components/poll-guest-island.tsx` (302줄, min_lines 150 충족) - 게이트 promise 브리지(guest-surface :233-240 미러)·ensureGuestMember(joinMoa→joinMoaByPollCode만 교체)·재방문 세션 effect(hydrate=listTripMessages만)·채널 effect(moa-island :194-231 축소 미러, trip_messages INSERT+presence sync)·id-dedup append·handleSend(TripMessageCreateSchema Zod 경계)·MoaChat controlled 마운트(placesById={} A-9)·비멤버 compose 미러·NicknameGateSheet 재사용
- `apps/web/__tests__/poll-guest-island.test.tsx` (338줄) - moa-island.test 채널 스텁 verbatim + auth(getUser/signInAnonymously) seam + @moajoa/api 개별 vi.fn 위임 + 컴포넌트 3종 스텁. 6케이스: 비멤버 렌더(채널 미호출)·첫 전송 게이트 순서(invocationCallOrder)·재방문 hydrate·채널 소유(moaChannelName 산출값 정확 일치·바인딩 2·track·removeChannel)·dedup·게이트 취소 draft 복원
- `apps/web/app/poll/[code]/page.tsx` - import·마운트 블록·chat hydrate 주석만 교체(PollVoteIsland→PollGuestIsland, props 동일) — generateMetadata·SSR 크롬·footer·getCachedPoll diff 0, RSC 유지

## Decisions Made

- Open Q2 채택 (plan 명시 소비): /poll 투표 authed 전환 + 중복투표 엣지 수용 — 코드 주석으로 T-29-19 기록
- RED를 render-null 스텁과 함께 커밋 — 신규 파일 특성상 임포트 에러 RED를 피하고 behavior 실패로 실증 (26-01 선례)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] acceptance grep 오탐 — 주석 리터럴 재서술**
- **Found during:** Task 1 (acceptance criteria 검증)
- **Issue:** poll-guest-island 주석 2곳의 `getTrip` 리터럴이 acceptance 게이트 `! grep -n "getTrip\b"`에 오탐 (코드 경로는 처음부터 미호출)
- **Fix:** "trips 단건 조회 (API) 호출 금지"로 의미 보존 재서술 — 24-05/26-02 선례
- **Files modified:** apps/web/app/poll/[code]/_components/poll-guest-island.tsx
- **Commit:** `a64c246` (GREEN에 포함)

## Checkpoint Resolution (Task 3 — human-action)

- **1차 "approved" (반려):** `supabase migration list` 실측 결과 Remote 컬럼에 0032 공란 — 근본 원인은 origin/main이 33커밋 뒤(eea5cc3, Phase 27-02에 정지)라 0032 커밋(`7841600`, 29-01)이 GitHub에 미도달 → Supabase↔GitHub 자동 적용 미트리거. 진행 중단하고 사용자에게 보고 (plan 지시 준수).
- **2차 resolved:** 사용자 명시 요청으로 orchestrator가 `git push origin main` 실행 (eea5cc3..3289bde, 33커밋 — Phase 28+29 전체 배포). `supabase migration list` 재실측: **0032 | 0032 정합 확인.**
- **라이브 스팟 체크 (a/b/c)는 잔여:** Vercel 배포 전파 후 `/gsd-verify-work`에서 소진 — (a) 시크릿 /poll 채팅 섹션+A-7 카피 (b) 게이트→전송 (c) /moa 채팅탭 수렴+실시간 수신.

## Issues Encountered

- 1차 approved 시 원격 미적용 발견 (위 Checkpoint Resolution) — human-action 전제를 실측으로 재검증하는 것이 필수임을 재확인. 코드 영향 0.

## Known Stubs

None blocking. 의도적 상수 배선 3종 (A-9 설계 계약 — 스텁 아님): `placesById={{}}`(칩 전부 미해석·미렌더 — /poll엔 장소 리스트 부재)·`replyToPlaceId={null}`+`onClearReply` no-op(답장 작성 UI 미노출)·`onChipTap` no-op. 전부 UI-SPEC A-9 결정론적 미렌더 경로, 코드 주석 기록.

## Threat Flags

None — 신규 네트워크 엔드포인트·스키마 변경 없음. threat_model 처분 전부 적용: T-29-15 mitigate(joined&&userId 채널 가드 + Test 1/4 단언), T-29-16 mitigate(TripMessageCreateSchema Zod + 0028 트리거·RLS 승계), T-29-17 mitigate 기존 승계, T-29-18 mitigate(비멤버 hydrate 미실행 + A-7 카피), T-29-19 accept(주석 기록), T-29-20 accept 기존.

## Verification

- Task 1: 신규 6/6 + moa-chat 10 + moa-island 36 그린 · web tsc 0 · 필수 패턴 grep(joinMoaByPollCode·moaChannelName·TripMessageCreateSchema·<MoaChat·<NicknameGateSheet·<PollVoteIsland) 전부 존재 · trips 단건 조회 grep 0 · A-7 카피 1건 · `.js` 워크스페이스 import 0 · 무수정 앵커 4종 diff 0
- Task 2: page.tsx PollVoteIsland 0건·PollGuestIsland 3건·'use client' 0건 · HC-7 grep 3종 0건 · `CI=true pnpm -r test`(core 192·api 111·web 278·ios 128) exit 0 · `pnpm -r typecheck` exit 0 · `pnpm --filter web build` PASS(`ƒ /poll/[code]` 2.98kB/208kB) · diff가 import·마운트·주석에 한정
- Task 3: `supabase migration list` Remote 0032 정합 (2차 검증)

## User Setup Required

완료됨 — 원격 0032 적용 (사용자 지시로 origin/main push → GitHub 연동 자동 적용, 정합 실측). 라이브 스팟 체크 3항목은 verify-work 몫.

## Next Phase Readiness

- **Phase 29 4/4 plans 실행 완료** — D-01(dates→both 수렴)·D-02(한마디 은퇴)·D-03(/poll 통일 채팅) 전부 코드 전달, 원격 0032 정합.
- **다음: `/gsd-verify-work 29`** — 라이브 스팟 체크 a/b/c (Vercel 배포 전파 후) + Phase 29 Success Criteria 4종 UAT. CHAT-05/06/07은 REQUIREMENTS.md 미등록 축(29-01~03 선례) — 등록·마킹은 verify-work 몫.

## Self-Check: PASSED

- 생성 2파일(poll-guest-island.tsx·poll-guest-island.test.tsx) + 수정 1파일(page.tsx) 존재 확인
- 커밋 3개(fe9fb50·a64c246·3289bde) git log 존재 확인
- TDD 게이트: test→feat 순서 정합, RED behavior 실패 실증
- 원격 0032: migration list Remote 컬럼 정합 실측

---
*Phase: 29-chat-unification*
*Completed: 2026-07-14*
