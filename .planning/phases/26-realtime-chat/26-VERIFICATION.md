---
phase: 26-realtime-chat
verified: 2026-07-10T02:40:00Z
status: human_needed
score: 18/18 code-verifiable must-haves verified (3 roadmap SCs code-complete; live cross-browser behavior gated on 0028 deploy)
overrides_applied: 0
human_verification:
  - test: "0028을 origin/main에 push(Supabase↔GitHub 자동 적용) 후, 두 브라우저(호스트+멤버)에서 같은 /moa/[id] 채팅 탭을 열고 메시지를 주고받는다"
    expected: "한쪽에서 보낸 메시지가 상대 화면에 실시간 도착(500 없이 send 성공), 새로고침 후에도 히스토리 유지 (CHAT-01)"
    why_human: "라이브 postgres_changes 전달·send 성공은 0028(publication add + user_id 트리거)이 원격 main에 반영돼야 증명 가능. 현재 0028(ff6e8b9)은 로컬 main에만 있고 origin/main 미반영(로컬 ahead 21). 유닛은 test-seam으로 우회했고 로컬 db reset은 클린 검증됨"
  - test: "두 브라우저에서 채팅 탭 입장/퇴장 시 '지금 N명 보는 중' 카운트를 관찰한다"
    expected: "입장하면 2명, 한쪽이 닫으면 1명으로 실시간 수렴 (CHAT-02)"
    why_human: "presence sync 수렴은 실제 realtime 채널 2개 클라이언트가 있어야 관찰 가능 — 유닛은 presenceState stub로 카운트 로직만 검증"
  - test: "장소 행 답장 → 채팅 탭에서 메시지 전송 → #N 칩 탭 왕복을 라이브에서 확인"
    expected: "답장 시 채팅 탭 전환+프리필, 전송된 메시지에 #N 장소명 칩, 칩 탭 시 모으기 탭 전환+해당 장소 스크롤+ring 하이라이트 (CHAT-03)"
    why_human: "클라이언트 상태 왕복은 유닛으로 전부 검증(초록)되나, 전송된 메시지가 reply_to_place_id를 실제로 싣고 라이브 도착하는 end-to-end는 send 경로(0028 게이트)에 의존"
deferred:
  - truth: "SC1의 '게스트' 참여 표면 — 링크로 들어온 친구가 채팅에 참여"
    addressed_in: "Phase 25 (Guest Unified Share)"
    evidence: "26-CONTEXT D-09/domain: '게스트가 채팅에 참여하는 표면은 Phase 25 완성 후 연동 — 코드 기반은 이번에 완성.' 이번 phase는 호스트+기존 멤버 기준. RLS(can_read_trip/can_vote_trip)는 이미 게이트"
---

# Phase 26: Realtime Chat Verification Report

**Phase Goal:** 같은 모아에 모인 사람들이 실시간으로 대화하며 장소를 순번으로 지칭해 결정한다 — trip_messages 히스토리 + `moa:{tripId}` 단일 채널(presence·message 통합) + #N 장소 멘션 답장, [모으기][채팅] 2탭 IA.
**Verified:** 2026-07-10T02:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

**Roadmap Success Criteria (contract):**

| #   | Truth (SC)                                                                 | Status                    | Evidence |
| --- | ------------------------------------------------------------------------- | ------------------------- | -------- |
| SC1 | 접속자들이 실시간 채팅 + 새로고침 후 히스토리 유지 (CHAT-01)              | ✓ 코드완료 / 라이브→human | 단일 채널 trip_messages INSERT 바인딩+append/dedup(island L175-177,95), page.tsx `listTripMessages` seed(L40,65). 라이브 전달은 0028 원격 배포 게이트 |
| SC2 | "지금 N명 보는 중" 접속자 수 실시간 갱신(두 브라우저 수렴) (CHAT-02)      | ✓ 코드완료 / 라이브→human | presence key=currentUserId(island L161)·sync→setViewers(L179-180)·SUBSCRIBED track(L182-184). 2-브라우저 수렴은 human |
| SC3 | 답장 버튼→#N 장소명 칩→탭 시 스크롤·하이라이트 (CHAT-03)                   | ✓ VERIFIED                | 유닛 전부 초록(island 15/15). 답장→onReply(place-list L240)·프리필(island L324-326)·openPlaceFromChat(L228-232)·ring-2 하이라이트(place-list L70-78,156) |

**Plan-level must-haves (18/18 verified in code + unit tests):**

| Plan | Truth | Status | Evidence |
| ---- | ----- | ------ | -------- |
| 01 | trip_messages INSERT가 postgres_changes로 전달(publication 등록) | ✓ | 0028 L6 `alter publication supabase_realtime add table trip_messages` |
| 01 | user_id 없이 insert 가능(트리거가 auth.uid() 채움) | ✓ | 0028 L11-20 BEFORE-INSERT 트리거; chat.ts insert 객체에 user_id 키 부재(L27-32) |
| 01 | listTripMessages asc + sendTripMessage insert/return | ✓ | chat.ts L9-16(order asc), L25-36; barrel index.ts L8 |
| 02 | 메신저 말풍선 리스트(닉네임, mine/other by user_id) | ✓ | moa-chat L99 `mine = m.user_id === currentUserId` |
| 02 | 입력바 send(Enter/보내기)·clear·실패 시 복원 | ✓ | moa-chat onSend L70, maxLength 140 L158 |
| 02 | viewers prop로 "N명 보는 중" strip | ✓ | moa-chat L84-88 |
| 02 | resolvable reply_to_place_id → #N 칩 → onChipTap | ✓ | moa-chat L100-109 (Pitfall 9 unresolvable→no chip) |
| 02 | replyToPlaceId 설정 시 답장 배너 + clear(x) | ✓ | moa-chat L133-139 |
| 03 | 3번째 postgres_changes 바인딩(trip_messages INSERT) `.subscribe()` 전 | ✓ | island L175-177 before L182 subscribe; 단일 client.channel(count=1) |
| 03 | 수신 INSERT를 payload.new로 append, id dedup | ✓ | island L177 appendMessage, L95 some(id) dedup |
| 03 | sendTripMessage 후 optimistic append | ✓ | island handleSend L257-266 |
| 03 | 탭 전환 시 island 언마운트 안 됨(채널 유지) | ✓ | island L278 `contents`/`hidden` 토글, 단일 [trip.id] effect |
| 03 | presence sync→viewers 갱신; SUBSCRIBED에 track | ✓ | island L179-180, L182-184 |
| 03 | 새로고침 후 히스토리(server seed) | ✓ | page.tsx L40 listTripMessages, L65 initialMessages |
| 04 | 답장 탭→채팅 탭 + reply_to_place_id 프리필 | ✓ | place-list onReply L240; island L324-326 |
| 04 | 전송 메시지가 reply_to_place_id 싣고 #N 칩 렌더 | ✓ | handleSend parse L258, moa-chat 칩 L100-109 |
| 04 | 칩 탭→모으기 탭+스크롤+하이라이트 | ✓ | openPlaceFromChat L228-232 + place-list ring L70-78 |
| 04 | 삭제 장소 칩 소멸(reply_to_place_id set null) | ✓ | 0025 FK on delete set null; placesById는 hidden-filtered places 기반 |

**Score:** 18/18 plan must-haves verified in code; 3 roadmap SCs code-complete (SC1·SC2 라이브 부분 human, SC3 완전 검증)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SC1 '게스트' 참여 표면 | Phase 25 (Guest Unified Share) | 26-CONTEXT D-09: 게스트 채팅 표면은 Phase 25 연동 후 완결; 이번 phase는 호스트+멤버 코드 기반 완성 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0028_chat_realtime_publication.sql` | publication add + user_id 트리거 | ✓ VERIFIED | 20 lines; alter publication(L6) + BEFORE-INSERT trigger(L11-20); 로컬 db reset 42P17=0 검증(26-01) |
| `packages/api/src/queries/chat.ts` | listTripMessages + sendTripMessage | ✓ VERIFIED | 37 lines; insert 객체 user_id 부재; barrel export |
| `packages/api/src/queries/chat.test.ts` | 쿼리 계약 유닛 | ✓ VERIFIED | 6/6 green |
| `apps/web/.../moa-chat.tsx` | 표시 채팅 표면 | ✓ VERIFIED | 173 lines; forbidden(channel/broadcast/@moajoa/api) 0 매치 |
| `apps/web/.../moa-tab-bar.tsx` | 클라이언트 상태 2탭 바 | ✓ VERIFIED | 81 lines; button onClick, next/link·usePathname 없음(D-02) |
| `apps/web/.../moa-island.tsx` | 채널 확장+탭+send+멘션 | ✓ VERIFIED | 384 lines; 단일 채널·3 바인딩·track·openPlaceFromChat |
| `apps/web/.../page.tsx` | 히스토리 seed + self nickname | ✓ VERIFIED | listTripMessages(L40), user.id in nameIds(L51) |
| `apps/web/.../place-list.tsx` | 답장→onReply + 하이라이트 | ✓ VERIFIED | onReply(L240), ring-2 하이라이트(L70-78,156); 채팅은 곧 열려요 stub 제거 |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| sendTripMessage | trip_messages INSERT (user_id 없이) | from('trip_messages').insert 객체 no user_id | ✓ WIRED |
| index.ts | ./chat | barrel `export * from './chat'` | ✓ WIRED |
| moa-chat input | onSend | await onSend(body, replyToPlaceId) L70 | ✓ WIRED |
| moa-chat #N chip | onChipTap | Chip onClick L107 | ✓ WIRED |
| moa-tab-bar button | onTabChange | button onClick L36 | ✓ WIRED |
| island channel effect | trip_messages INSERT append | .on(postgres_changes, table:'trip_messages') L175-177 | ✓ WIRED |
| island handleSend | sendTripMessage | parse→send→append L258-266 | ✓ WIRED |
| page.tsx | listTripMessages | RSC seed→initialMessages L40,65 | ✓ WIRED |
| subscribe callback | channel.track | if SUBSCRIBED→track L182-184 | ✓ WIRED |
| place-list 답장 | island reply prefill | onReply(p.id)→setReplyToPlaceId+setActiveTab('chat') L324-326 | ✓ WIRED |
| moa-chat #N chip | island openPlaceFromChat | onChipTap→setActiveTab('moa')+openPlaceId+expanded L228-232 | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| moa-chat | messages | island state ← initialMessages(listTripMessages DB query) + postgres_changes payload.new | ✓ (실 DB seed + 라이브 append) | ✓ FLOWING (라이브 append는 0028 배포 게이트) |
| moa-chat | viewers | island ← channel.presenceState() sync | ✓ (라이브 presence) | ⚠️ 라이브 수렴은 human |
| place-list | placesById 칩 resolve | island places state(hidden-filtered) | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| api chat 쿼리 계약 | `pnpm --filter @moajoa/api test` | 97 passed (chat 6/6) | ✓ PASS |
| moa-chat 표시 | vitest run moa-chat.test.tsx | 9 passed | ✓ PASS |
| moa-island 배선/멘션 | vitest run moa-island.test.tsx | 15 passed | ✓ PASS |
| place-list 답장 | vitest run place-list.test.tsx | 13 passed | ✓ PASS |
| web 타입체크 | `pnpm --filter web exec tsc --noEmit` | exit 0 | ✓ PASS |
| 라이브 realtime 전달/presence 수렴 | (2-브라우저) | — | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CHAT-01 | 26-01,02,03 | 실시간 채팅 + 히스토리 유지 | ✓ SATISFIED (코드) | 단일 채널 바인딩+seed; 라이브는 0028 배포 후 human |
| CHAT-02 | 26-02,03 | "N명 보는 중" presence | ✓ SATISFIED (코드) | presence key/sync/track; 2-브라우저 수렴 human |
| CHAT-03 | 26-02,04 | 장소 멘션 답장 루프 | ✓ SATISFIED | 유닛 전부 초록; 클라이언트 왕복 완전 검증 |

REQUIREMENTS.md의 Phase 26 매핑은 CHAT-01/02/03 3건 — 전부 plan frontmatter에서 청구됨. 고아 requirement 없음.

### Anti-Patterns Found

없음. 터치된 소스 파일(moa-chat/moa-island/place-list/moa-tab-bar/chat.ts) TODO·placeholder·`채팅은 곧 열려요` stub 0 매치. Plan 03의 onChipTap no-op placeholder는 Plan 04에서 openPlaceFromChat로 정상 교체됨.

### Human Verification Required

프론트matter `human_verification` 참조. 핵심: **0028(ff6e8b9)을 origin/main에 push**(현재 로컬 main만, ahead 21) → Supabase↔GitHub 자동 적용 후 2-브라우저 라이브 스모크:
1. 메시지 실시간 전달 + send 성공 + 새로고침 히스토리 (CHAT-01)
2. "지금 N명 보는 중" 입장/퇴장 수렴 (CHAT-02)
3. 답장 → #N 칩 → 스크롤·하이라이트 라이브 왕복 (CHAT-03)

이는 VALIDATION.md·전 SUMMARY가 명시한 배포 게이트이며 **코드 갭이 아님** — 코드와 로컬 db reset 증명은 완결.

### Gaps Summary

코드 갭 없음. 모든 아티팩트가 존재·실체·배선·데이터 흐름을 만족하고 유닛/타입체크가 전부 초록(api 97, web moa-chat 9 + moa-island 15 + place-list 13, tsc 0). 로드맵 SC1·SC2의 라이브 크로스-브라우저 동작만 0028 원격 배포에 게이트되어 human 검증으로 라우팅. SC1의 '게스트' 부분은 Phase 25로 명시적 이연(D-09). D-02(클라이언트 상태 탭바)·D-06/07(단일 채널+publication)·D-08(닉네임 스냅샷)·D-09(멤버 RLS)·D-10(멘션 루프) 결정 전부 코드에서 준수 확인.

---

_Verified: 2026-07-10T02:40:00Z_
_Verifier: Claude (gsd-verifier)_
