# Phase 26: Realtime Chat - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

같은 모아에 모인 사람들이 실시간으로 대화하며 장소를 순번으로 지칭해 결정한다 — `/moa/[id]`에 **모아별 하단 탭바**(이번 phase는 `모으기`·`채팅` 2탭)를 도입하고, `채팅` 탭에 trip_messages 히스토리 + `moa:{tripId}` 단일 채널 실시간 메시지 + presence(“지금 N명 보는 중”) + `#N` 장소 멘션 답장을 붙인다.

**Requirements:** CHAT-01, CHAT-02, CHAT-03

**이번 phase 대상:** 카카오 로그인한 **호스트 + 이미 join된 멤버**. 게스트(링크로 들어온 친구)가 채팅에 참여하는 표면은 **Phase 25(게스트 통합 공유화면) 완성 후** 연동 — CHAT 성공기준의 “게스트” 부분은 25 이후 완결(코드 기반은 이번에 완성).

**범위 외:** 게스트 join·닉네임 게이트·익명 인증 표면(Phase 25), 플랜/예약/가계부 탭(미래 phase — 탭바는 자리만), 메시지 삭제·편집·읽음표시·타이핑 인디케이터·첨부, iOS 변경(전면 동결).

</domain>

<decisions>
## Implementation Decisions

### IA — 모아별 하단 탭바
- **D-01:** `/moa/[id]`에 **모아별 하단 탭바** 도입. 이번 phase는 `[모으기] [채팅]` **2탭**. iOS 여행 4탭(지도/플랜/예약/가계부) IA를 미러하되, 웹은 여기에 채팅이 추가되는 구조 — 나중에 플랜/예약/가계부로 **확장 가능하게** 설계(이번엔 자리만, 미구현).
- **D-02:** 탭 전환은 **클라이언트 상태**(별도 라우트 분리 아님). `moa-island`가 한 번만 마운트되어 **단일 realtime 채널을 유지**하고, `모으기` 뷰 ↔ `채팅` 뷰만 스위치. (라우트 분리 시 채널 재생성·상태 유실 위험 회피)
- **D-03:** `모으기` 탭 = 기존 지도 + place-sheet(장소 리스트) + 링크/장소 추출 + `함께 정하기` 그대로. `채팅` 탭 = 신규 메신저 UI. 앱 최상단 bottom-nav의 `모아`(모아 목록=홈)와 구분되는 **모아 내부 섹션 탭**.
  - 탭 이름 `모으기` 근거: 장소 + 일정(함께 정하기 날짜)을 다 “모으는” 본격 플랜 전 단계. 브랜드(모**아**) 일치. 여정 흐름 **모으기 → 플랜 → 예약 → 정산**의 출발점. (`탐색`은 장소만 연상, `지도`는 추출·정하기 기능 미표현이라 탈락)

### 채팅 범위·형태
- **D-04:** **모아 전체 대화방 1개**(장소별 스레드 아님). 카톡식 **메신저 스타일** — 닉네임 말풍선 + 하단 입력바 + 히스토리 스크롤.
- **D-05:** **풀 스코프 CHAT-01/02/03.**
  - CHAT-01: 실시간 메시지 + 새로고침 후 히스토리 유지(trip_messages 영속)
  - CHAT-02: presence “지금 N명 보는 중”(입장·퇴장 실시간 갱신)
  - CHAT-03: 장소 멘션 답장 — `#N 장소명` 인용 칩, 탭하면 해당 장소로 스크롤·하이라이트

### realtime 채널
- **D-06:** **단일 `moaChannelName(tripId)` 채널에 통합.** 기존 postgres_changes(`places` INSERT, `links` UPDATE) + **`trip_messages` INSERT**(postgres_changes) + **presence**(track/sync). “화면당 채널 2개 금지” 교훈 유지 — `모으기`·`채팅` 두 탭이 **같은 채널**을 소비(핀 반영·메시지·접속자 수 모두 이 채널).
- **D-07 (⚠️ research 필수):** 0026 publication은 `places`·`links`만 등록함. `trip_messages`의 postgres_changes가 무음 no-op 되지 않으려면 **`trip_messages`를 `supabase_realtime` publication에 추가하는 신규 마이그레이션(0028 등)** 이 필요할 가능성 높음 — Phase 24 D-14/Pitfall2와 동일 함정. planner/researcher가 확인해 마이그레이션 포함.

### 닉네임·인증
- **D-08:** 닉네임 = 로그인 사용자 `display_name`(카카오 닉네임, D-A2). `trip_messages.nickname`은 **전송 시점 스냅샷**(비정규화, chat.ts 계약). 익명 게스트 닉네임 게이트/`signInAnonymously({data:{name}})`는 Phase 25 몫.

### 멤버십·RLS 범위
- **D-09:** 이번 phase는 **호스트 + 기존 멤버**만. `trip_messages` SELECT/INSERT는 0025 RLS 헬퍼(`can_read_trip` / `auth.uid()`+`can_vote_trip`) 게이트 — 멤버만 히스토리 열람·전송. 게스트가 링크로 들어와 채팅 끼는 건 Phase 25 연동 후.

### 멘션 UX
- **D-10:** 기존 place-list `답장` 스텁 자리 → 누르면 **`채팅` 탭으로 전환 + `reply_to_place_id` 프리필**. 메시지에 `#N 장소명` 인용 칩 렌더 → 칩 탭 시 **`모으기` 탭 전환 + 해당 장소 `scrollIntoView` + 하이라이트**(기존 `openPlaceId` 경로 재사용). 장소 hard delete 시 reply_to_place_id set null(칩만 소멸, 0025 FK).

### Claude's Discretion
- 말풍선 스타일 세부(내/상대 정렬·색), 입력바·presence 표시 위치(헤더 등), 자동 스크롤(새 메시지 시 하단 고정) 동작 — 표준 메신저 관례 + UI-SPEC에서 확정.

</decisions>

<specifics>
## Specific Ideas

- **“우리 채팅방처럼”** = 카카오톡식 메신저(닉네임 말풍선·실시간·히스토리).
- **iOS 여행 4탭(지도/플랜/예약/가계부) IA를 미러** — 웹 모아도 모아별 하단 탭바로 성장. 이번엔 `모으기`/`채팅`만.
- **Phase 19 `/poll/[code]`가 최대 재사용원** — 이미 실시간 채팅 + presence + 닉네임을 구현함. moa 쪽으로 미러.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `packages/core/src/schemas/chat.ts` — `TripMessageSchema`/`TripMessageCreateSchema`(준비됨, 23-05). nickname 비정규화 D-A2 주석, body 1~140 CHECK 이중화.
- `apps/web/app/poll/[code]/_components/poll-chat.tsx` — 채팅 UI(말풍선·입력바) 재사용 analog.
- `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` — 단일 채널 realtime + **presence track/sync** + 채팅 배선 재사용 analog(GAP-19D presence는 supabase-js 2.110 업그레이드로 해소 — 24-01).
- `apps/web/app/moa/[id]/_components/moa-island.tsx` — 현 realtime 허브(단일 채널·reconcile·optimistic). 여기에 탭 상태 + 채팅 + presence를 얹는다.
- `apps/web/app/moa/[id]/_components/place-list.tsx` — `답장` 자리·`openPlaceId` 하이라이트 경로(D-10 멘션 연동).
- `packages/core` `moaChannelName` — “화면당 단일 채널” 규약.
- `supabase/migrations/0025_web_share.sql` — `trip_messages` 테이블 + RLS 3정책(SELECT can_read_trip / INSERT auth.uid+can_vote_trip / DELETE auth.uid or owner) + reply_to_place_id FK.
- `supabase/migrations/0026_realtime_publication.sql` — 현 publication(places·links만) — trip_messages 추가 마이그레이션의 analog.

</canonical_refs>

<open_questions>
## Open Questions for Research

1. **trip_messages realtime publication (D-07)** — 0026에 trip_messages 미등록. 신규 마이그레이션으로 `alter publication supabase_realtime add table trip_messages` 필요한지 확인(십중팔구 필요 — 무음 no-op 방지). 원격 push 게이트 동반.
2. **api 쿼리 신규** — `packages/api`에 `sendTripMessage`(TripMessageCreate → insert)·`listTripMessages`(trip_id, created_at asc, RLS)가 없음. poll의 메시지 send/list 패턴 확인 후 typed query 작성.
3. **단일 채널 다중 바인딩 안정성** — 한 `moa:{tripId}` 채널에 postgres_changes 3종(places/links/trip_messages) + presence(track+sync) 동시 바인딩의 구독 순서·안정성(poll-vote-island 선례 참고).
4. **presence identity** — track payload(user_id/nickname) + distinct 카운트 방식(poll 선례). anon 미포함(이번엔 인증 멤버만).
</open_questions>
