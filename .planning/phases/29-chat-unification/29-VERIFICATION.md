---
phase: 29-chat-unification
verified: 2026-07-14T06:20:00Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "라이브 /poll 통일 채팅 스팟 체크 (29-04 Task 3 잔여 a/b/c)"
    expected: "(a) 시크릿 /poll/{code}에 '채팅' 섹션 + '참여하면 지금까지의 대화를 볼 수 있어요' (한마디 없음) (b) 전송 → 닉네임 게이트 → 메시지 목록 표시 (c) 호스트 /moa 채팅탭에 /poll 메시지 보임 + 호스트 답장이 /poll에 실시간 수신"
    why_human: "실브라우저 2인극 + Vercel 배포 전파 + 원격 realtime — 프로그램 검증 불가"
  - test: "dates 공유 게스트 라이브 채팅 (2 브라우저)"
    expected: "dates /t/{slug} 링크에서 join 후 MoaIsland 채팅탭 접근·전송 가능, 장소 추가 FAB 없음, 호스트 /moa에서 메시지 수신"
    why_human: "실브라우저 2인극 — RLS·realtime의 라이브 경로는 코드/smoke로만 검증됨"
  - test: "presence '지금 N명 보는 중' 2세션 확인"
    expected: "/poll 게스트 join + /moa 호스트 동시 접속 시 양쪽 카운트 2 — poll 자체 presence 은퇴 후 채팅 presence가 유일 표면"
    why_human: "실시간 presence 동작은 라이브 세션 2개 필요"
  - test: "iOS 호스트 투표 broadcast 수신 (poll:{tripId} 'vote' 계약)"
    expected: "/poll에서 투표 시 iOS plan 탭 집계 갱신 — 채널 프로토콜 무변경(grep 고정)이므로 저위험 회귀 앵커"
    why_human: "iOS 실기기/시뮬 수신 확인은 프로그램 검증 불가 (iOS 동결로 코드 diff 0은 확인됨)"
---

# Phase 29: Chat Unification (채팅 단일화) Verification Report

**Phase Goal:** 두 갈래로 분절된 대화 기능을 채팅(`trip_messages`) 하나로 통일 — poll 한마디(date_comments/poll-chat)와 모아 채팅탭(trip_messages/moa-chat)의 분절 해소, dates 공유 게스트 채팅 접근 개방, 한마디 은퇴.
**Verified:** 2026-07-14T06:20:00Z
**Status:** human_needed (자동 검증 전부 통과 — 라이브 스팟 체크 4건 잔여)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (requirement axis)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | CHAT-04: dates 공유 게스트가 채팅(trip_messages)에 접근·참여 | ✓ VERIFIED | guest-surface.tsx:331-357 dates 분기가 both 미러(`MoaIsland + hideHostControls + hidePlaceAdd + pollSlot`) — `shareMode !== 'dates'` 가드 0건. smoke (7): voter role trip_messages POST 201/GET 200 런타임 실증. guest-surface 15케이스 그린 |
| SC2 | CHAT-05: 호스트·게스트가 공유 모드 무관 같은 저장소에서 대화 | ✓ VERIFIED | poll-guest-island.tsx: `joinMoaByPollCode`(0032 RPC) → `listTripMessages`/`sendTripMessage`(trip_messages) + `moaChannelName(tripId)` 채널 — /t·/moa와 동일 메커니즘. 0032 Local\|Remote 정합 실측(migration list). 라이브 수렴은 human 항목 |
| SC3 | CHAT-06: poll 한마디 은퇴·중복 대화 표면 제거 | ✓ VERIFIED | poll-chat.tsx 부재(git rm e7fb6b6) · PollChat 소비 grep 0건 · postComment/deleteComment repo 전체 0건 · HC-7 은퇴 문자열 3종(한마디·마감 카피·삭제 확인) apps/web 0건 |
| SC4 | CHAT-07: 기존 채팅 무회귀 (영속 이력·presence·멘션 답장 칩) | ✓ VERIFIED | moa-chat 10·moa-island 36 그린(hidePlaceAdd는 additive optional — 기존 케이스 무수정). 29-03/29-04 범위에서 moa-chat/moa-tab-bar/nickname-gate-sheet/moa-island diff 0. 전 스위트 그린(core 192·api 111·web 278·ios 128, 오케스트레이터 실행 + 본 검증에서 재확인 73+111) |

### Observable Truths — Plan must_haves (15)

| # | Truth (plan) | Status | Evidence |
|---|--------------|--------|----------|
| 1 | 29-01: poll_code 보유자가 익명 세션으로 voter 합류 (slug 없이, private 레거시 포함) | ✓ VERIFIED | 0032: `security definer`·visibility 게이트 없음·`'voter'` 고정·`on conflict do nothing`·anon grant 0. smoke: join 200 + role='voter' + bad code 400 |
| 2 | 29-01: voter가 trip_messages 읽기 200/쓰기 201 — DB 실증 | ✓ VERIFIED | `bash supabase/tests/web_share_smoke.sh` exit 0 — 섹션 (7) PASS 라인 실측 |
| 3 | 29-01: 0016~0031 마이그레이션 무변경 | ✓ VERIFIED | `git diff 91a7b43..HEAD -- supabase/migrations/` = 0032 신규 1파일(+58)뿐 |
| 4 | 29-02: dates 게스트 join 후 both과 동일 MoaIsland(채팅탭) | ✓ VERIFIED | guest-surface.tsx:337-350 both 미러 실측 + 테스트 단언 |
| 5 | 29-02: dates 재방문 멤버 hydrate 후 곧장 MoaIsland (Pitfall 5) | ✓ VERIFIED | 세션 effect :99-124 무조건 `hydrateMember` — 가드 grep 0건, 테스트 단언 |
| 6 | 29-02: dates 게스트(voter)에 장소 추가 FAB 미노출 (F-2) | ✓ VERIFIED | moa-island.tsx:66 prop 선언·:625 `!hidePlaceAdd &&` FAB 가드·guest-surface dates 분기만 전달(both 미전달 앵커 테스트) |
| 7 | 29-02: 호스트 /moa·both/places 무회귀 | ✓ VERIFIED | moa-island 기존 34케이스 무수정 그린(36 중 신규 2 append) |
| 8 | 29-03: 한마디 표면·라벨 apps/web 완전 소멸 (HC-7 3종 0건) | ✓ VERIFIED | HC-7 grep 3종 0건 재실행 확인 |
| 9 | 29-03: poll:{tripId} 투표 broadcast 유지 (iOS 계약) | ✓ VERIFIED | poll-vote-island.tsx:160 channelRef·:163 `'vote'` 수신 바인딩·:254 `'vote'` send 실측 — 라이브 iOS 수신은 human 항목 |
| 10 | 29-03: stored nickname 재방문자 authed RPC 401 회피 (Pitfall 1) | ✓ VERIFIED | :123 `if (nicknameProp || initialNickname || onRequireMember) return;` + 테스트 케이스 그린 |
| 11 | 29-03: date_comments·0018 무접촉 (D-02a) | ✓ VERIFIED | 0018/0025/0028 diff 0 · database.ts에 date_comments 타입 잔존(2건) — DROP 없음 |
| 12 | 29-04: /poll 방문자 게이트 1회 → 익명 멤버 → trip_messages 저장 | ✓ VERIFIED | poll-guest-island.tsx:100-147 ensureGuestMember(signInAnonymously→joinMoaByPollCode→setStoredNickname)·requireMember 브리지를 투표/전송 공유(:246, :201) — 6케이스 그린. 라이브는 human 항목 |
| 13 | 29-04: /poll·/t·/moa 같은 저장소·채널 수렴 | ✓ VERIFIED | :168 `client.channel(moaChannelName(tripId))` + trip_messages INSERT 바인딩 + `sendTripMessage` — SC2와 동일 근거 |
| 14 | 29-04: 재방문 멤버 게이트 없이 이력 (getTrip 미호출 — Pitfall 2) | ✓ VERIFIED | :70-95 세션 effect getMyTripRole→listTripMessages만 · `getTrip\b` grep 0건 |
| 15 | 29-04: 비멤버 이력 미노출 + 전용 빈 상태 카피 | ✓ VERIFIED | :265-296 비join 분기 — hydrate 미실행(RLS) + '참여하면 지금까지의 대화를 볼 수 있어요' 1건 + compose 미러 |

**Score:** 19/19 truths verified (SC 4 + plan 15)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0032_join_moa_by_poll_code.sql` | DEFINER RPC, contains `security definer` | ✓ VERIFIED | 58줄 — 안전장치 5종(bearer 검증·auth.uid self-join·owner 가드·멱등·search_path 핀+authenticated grant) 전부 실측 |
| `packages/api/src/queries/memberships.ts` | exports `joinMoaByPollCode` | ✓ VERIFIED + WIRED | :46 `rpc('join_moa_by_poll_code', { p_code` — poll-guest-island.tsx:6/:113에서 import·호출 |
| `packages/api/src/types/database.ts` | contains `join_moa_by_poll_code` | ✓ VERIFIED | Functions 타입 1건 (typegen additive) |
| `supabase/tests/web_share_smoke.sh` | 섹션 (7) 프로브 | ✓ VERIFIED + PASSING | 실행 exit 0 — 섹션 (7) PASS 출력 실측 |
| `apps/web/app/t/[slug]/_components/guest-surface.tsx` | dates→both 수렴, contains `hidePlaceAdd` | ✓ VERIFIED + WIRED | dates 분기 both 미러 · 가드/embedded/한마디 0건 |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` | `hidePlaceAdd?: boolean` additive prop | ✓ VERIFIED + WIRED | 3건(선언·destructure·FAB 가드) — 정확히 plan 스펙 |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` | 투표 전용(은퇴 후), min 300줄 | ✓ VERIFIED | 575줄 · 은퇴 식별자 5종 0건 · channelRef/'vote' 유지 |
| `packages/api/src/queries/date-polls.ts` | postComment/deleteComment orphan 제거 | ✓ VERIFIED | repo 전체 grep 0건 · api 111 그린 |
| `apps/web/app/poll/[code]/_components/poll-chat.tsx` | **부재** (삭제) | ✓ VERIFIED | 파일 없음 · 소비처 0건 |
| `apps/web/app/poll/[code]/_components/poll-guest-island.tsx` | 게이트+채팅 채널-소유 래퍼, min 150줄 | ✓ VERIFIED + WIRED | 304줄 · page.tsx가 마운트 · 필수 패턴 6종 전부 존재 |
| `apps/web/app/poll/[code]/page.tsx` | contains `PollGuestIsland`, RSC 유지 | ✓ VERIFIED | PollGuestIsland 3건 · PollVoteIsland 0건 · 'use client' 0건 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| memberships.ts | join_moa_by_poll_code RPC | client.rpc | ✓ WIRED | :46 실측 + smoke 런타임 통과 |
| web_share_smoke.sh | trip_messages RLS (voter) | curl REST 프로브 | ✓ WIRED | 섹션 (7) POST 201/GET 200 실행 PASS |
| guest-surface (dates) | MoaIsland | joined && moaSeed 조건 마운트 | ✓ WIRED | :337-350, hidePlaceAdd 전달 |
| guest-surface handleConfirmNickname | hydrateMember | shareMode 무관 무조건 호출 | ✓ WIRED | :246 `await hydrateMember(uid, nick)` — 가드 0 |
| poll-vote-island | poll:{tripId} broadcast | channelRef.send | ✓ WIRED | :160/:254 — 투표 fan-out 유지 |
| poll-vote-island stored hydrate | onRequireMember 게이트 | skip 조건 | ✓ WIRED | :123 `\|\| onRequireMember) return` |
| poll-guest-island | join_moa_by_poll_code | joinMoaByPollCode(client, code) | ✓ WIRED | :113 |
| poll-guest-island | moa:{tripId} 채널 | moaChannelName + pre-subscribe 체이닝 | ✓ WIRED | :168-188 — 바인딩 2개 subscribe 이전, joined&&userId 가드, removeChannel cleanup |
| poll-guest-island | MoaChat | controlled props 무수정 소비 | ✓ WIRED | :255-264 — messages/onSend 실데이터 배선 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| poll-guest-island | `messages` | listTripMessages hydrate(:84,:134) + postgres_changes append(:175) + sendTripMessage echo(:212) | Yes (smoke 실증) | ✓ FLOWING |
| poll-guest-island | `viewers` | presence sync → presenceState 카운트(:177-179) | Yes (라이브는 human) | ✓ FLOWING |
| poll-guest-island | `placesById={{}}` / `replyToPlaceId={null}` | 의도적 상수 (A-9 — /poll엔 장소 리스트 부재, 칩 결정론적 미렌더) | 설계 계약 (주석 기록) | ✓ 스텁 아님 |
| guest-surface (dates) | `moaSeed` | 기존 hydrateMember 경로 (both과 공유 — 무조건 호출로 복원) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 영향 web 스위트 5파일 | `CI=true pnpm --filter web test -- <5 files>` | 73/73 passed | ✓ PASS |
| api 스위트 (래퍼 포함) | `CI=true pnpm --filter @moajoa/api test` | 111/111 passed | ✓ PASS |
| DB 스모크 (1)~(7) | `bash supabase/tests/web_share_smoke.sh` | exit 0 — (7) voter join 200·bad 400·POST 201/GET 200 | ✓ PASS |
| 원격 0032 정합 | `supabase migration list` | `0032 \| 0032` Local\|Remote 일치 | ✓ PASS |
| 전 스위트+빌드 | 오케스트레이터 직전 실행 | core 192·api 111·web 278·ios 128 그린, build PASS | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHAT-04 | 29-01, 29-02 | dates 게스트 채팅 접근·참여 | ✓ SATISFIED (코드+DB) / 라이브는 human | SC1 근거 |
| CHAT-05 | 29-01, 29-04 | 공유 모드 무관 같은 저장소 대화 | ✓ SATISFIED (코드+DB+원격 0032) / 라이브 수렴은 human | SC2 근거 |
| CHAT-06 | 29-03 | 한마디 은퇴·중복 표면 제거 | ✓ SATISFIED | SC3 근거 |
| CHAT-07 | 29-02, 29-03, 29-04 | 기존 채팅 무회귀 | ✓ SATISFIED (자동) / presence·멘션 라이브는 human | SC4 근거 |

**등록 노트:** CHAT-04~07은 ROADMAP Phase 29 Success Criteria에서 발급된 phase-local 축으로 REQUIREMENTS.md 미등록 (CHAT-01~03만 존재, Phase 26). 4개 SUMMARY 전부 동일하게 verify-work 이관을 기록 — **verify-work에서 REQUIREMENTS.md 등록·완료 마킹 필요** (gap 아님, 사전 합의된 처리). ORPHANED 요구사항 없음 — REQUIREMENTS.md에 Phase 29 매핑 자체가 아직 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 없음 (TODO/FIXME/placeholder/빈 반환 0건, 수정 파일 8종 스캔) | — | — |

### Human Verification Required

#### 1. 라이브 /poll 통일 채팅 스팟 체크 (29-04 Task 3 잔여 a/b/c)

**Test:** 시크릿 브라우저에서 기존 `/poll/{code}` 열기 → (a) 투표 UI 아래 "채팅" 섹션 + "참여하면 지금까지의 대화를 볼 수 있어요" 확인(한마디 없음) → (b) 메시지 입력·보내기 → 닉네임 게이트 → 메시지 목록 표시 → (c) 호스트 브라우저 /moa 채팅탭에서 해당 메시지 확인 + 호스트 답장이 /poll에 실시간 수신.
**Expected:** 3항목 전부 성공 — /poll·/moa 대화 수렴 (SC2 라이브 실증).
**Why human:** 실브라우저 2인극 + Vercel 배포 전파(eea5cc3..3289bde 방금 push) + 원격 realtime.

#### 2. dates 공유 게스트 라이브 채팅

**Test:** dates 모드 `/t/{slug}` 링크를 시크릿에서 열기 → 닉네임 join → 채팅탭에서 전송 → 호스트 /moa에서 수신 확인. 장소 추가 FAB이 없는지 확인.
**Expected:** 게스트 채팅 참여 성공 + FAB 미노출 (SC1/F-2 라이브 실증).
**Why human:** 실브라우저 2인극.

#### 3. presence "지금 N명 보는 중" 2세션

**Test:** /poll 게스트 join 상태 + 호스트 /moa 채팅탭 동시 접속 → 양쪽 카운트 확인.
**Expected:** 카운트 2 — poll 자체 presence 은퇴 후 채팅 presence(`moa:{tripId}`)가 유일 표면 (CHAT-07 presence 무회귀).
**Why human:** 라이브 세션 2개 필요.

#### 4. iOS 호스트 투표 broadcast 수신 (저위험)

**Test:** /poll에서 투표 → iOS plan 탭 집계 실시간 갱신 확인.
**Expected:** 갱신됨 — `poll:{tripId}` 'vote' 프로토콜 무변경(grep 고정·iOS diff 0 확인됨).
**Why human:** iOS 실기기/시뮬 수신은 프로그램 검증 불가. 알려진 수용 비용: iOS "보는 중" 카운트에서 웹 방문자 누락 (T-29-14 accept — 결함 아님).

### Gaps Summary

코드 레벨 gap 없음. 4개 plan의 must_haves 19건 전부 실코드·실행 검증 통과 — SUMMARY 주장과 코드 실측 불일치 0건. 사용자 결정 5종(D-01 dates→both 수렴 · D-02 한마디 완전 제거 · D-02a date_comments DROP 금지 · D-03 /poll 유지+채팅 탑재 · D-03a poll_code bearer 승격) 전부 이행 확인. RESEARCH pitfall 봉합 실측: Pitfall 1(:123 skip 조건), Pitfall 2(getTrip 0건), Pitfall 4(joined&&userId 채널 가드), Pitfall 5(가드 2곳 동시 제거), Pitfall 8(pollSlot 단독 렌더). 잔여는 라이브 스팟 체크 4건(위 human 항목)과 CHAT-04~07 REQUIREMENTS.md 등록 — 둘 다 verify-work 몫.

---

_Verified: 2026-07-14T06:20:00Z_
_Verifier: Claude (gsd-verifier)_
