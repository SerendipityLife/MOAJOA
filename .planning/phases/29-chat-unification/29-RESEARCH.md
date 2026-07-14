# Phase 29: Chat Unification (채팅 단일화) - Research

**Researched:** 2026-07-14
**Domain:** 내부 리팩토링 — Supabase Realtime 채팅 표면 통일 (trip_messages / moa:{tripId}), 한마디(date_comments) 은퇴
**Confidence:** HIGH (전 핵심 질문을 실제 마이그레이션 SQL·컴포넌트 코드 직접 판독으로 확인 — 웹 리서치 불필요)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**방향 (사용자 확정 2026-07-14, 재질문 금지):** 채팅(`trip_messages`)으로 완전 통일. 한마디 은퇴. dates 공유 게스트 + /poll 방문자에게도 통일 채팅 개방. 두 표면이 같은 저장소·채널에서 대화. 새 대화 백엔드 로직 0 — 기존 `trip_messages`/`moa:{tripId}` 채널/presence/멘션을 표면만 넓혀 재사용. 신규 마이그레이션 최소(있다면 append-only).

- **D-01: dates 공유도 `both`과 동일하게 `MoaIsland`를 마운트한다.** 현재 `guest-surface.tsx:336`의 dates 분기는 `<>{pollSection}{gate}</>`만 반환해 MoaIsland(채팅탭 포함)를 안 띄운다. `both` 분기(`:351`)는 이미 join 후 `<MoaIsland {...moaSeed} hideHostControls pollSlot={날짜 정하기 섹션} />`로 poll을 pollSlot에 넣고 채팅탭이 작동한다. dates를 이 both 경로로 수렴 — poll을 pollSlot에, 장소 리스트는 빈 상태(dates엔 장소 없음). **신규 컴포넌트 0**, 채팅탭·presence·멘션 전부 무료 재사용. dates 게이트/hydrate 경로가 both과 정합하도록 조정(현재 dates는 `hydrateMember`/`joined` MoaIsland 마운트를 스킵 — `handleConfirmNickname`의 `if (shareMode !== 'dates')` 가드 제거·재설계 필요).
- **D-02: 한마디(poll-chat) 코드를 완전 제거한다.** 삭제/제거 대상: `apps/web/app/poll/[code]/_components/poll-chat.tsx`(파일 삭제) + `PollVoteIsland`에서 PollChat 마운트·`embedded` 분기 제거 + `packages/api/src/queries/date-polls.ts`의 `postComment`/`deleteComment` 제거(호출부 소멸 후 orphan). "한마디"라는 표면·라벨 소멸.
- **D-02a: `date_comments` 테이블·데이터는 DROP하지 않는다.** append-only 마이그레이션 규칙(CLAUDE.md §4.3) 준수. 미사용 방치. DROP 마이그레이션은 별건/후속.
- **D-03: `/poll/[code]` 라우트를 유지하되, 한마디 대신 통일 채팅(`trip_messages`)을 투표 화면에 얹는다.** 라우트 은퇴 아님 — 독립 투표 페이지로 존속시키되 대화 표면을 통일 채팅으로 교체.
- **D-03a (함의):** `/poll` 방문자도 채팅/투표 참여 시 **익명 멤버 승격** 필요 — `signInAnonymously({data:{name}})` + `joinMoa(slug)` 패턴 재사용. `poll_code → trip slug` 해석 경로 필요. `/poll`이 통일 채팅을 마운트하려면 `moa:{tripId}` 채널+메시지 상태 소유자가 필요. 결과적으로 `/poll`·`/t` 채팅이 동일 `trip_messages` 메커니즘으로 수렴.

### Claude's Discretion
- **presence 통일:** poll presence(`poll:{tripId}` "보는 중")를 채팅 presence(`moa:{tripId}` "지금 N명 보는 중")로 단일화. 한마디·poll presence 소멸 후 채팅 presence가 유일 표면.
- **익명 멤버 승격 게이트 시점:** 현재는 투표/찜 시 join. 통일 후 채팅 진입에도 닉네임 게이트(guest-surface `NicknameGateSheet` + `ensureGuestMember` 재사용). 게이트 UX 세부는 재량.
- **`PollVoteIsland`의 embed 관련 prop 정리:** `embedded` prop 용도 소멸 — 잔여 회귀 없게 정리.

### Deferred Ideas (OUT OF SCOPE)
- **`date_comments` 테이블 DROP 마이그레이션** — append-only 규칙상 이번 phase 제외.
- **`/poll` 라우트 은퇴** — 반려·미채택.
- **/poll·/t 완전 통합(단일 라우트로)** — 채팅 메커니즘만 수렴, 라우트 통합은 범위 밖.
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP Success Criteria를 requirement 축으로 사용 (CHAT-04 계열 신규 발급):

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-04 | `dates` 공유 게스트가 채팅(`trip_messages`)에 접근·참여할 수 있다 | Q3 답: 0025 RLS는 role-무관 — voter도 SELECT/INSERT 통과, **신규 마이그레이션 불필요**. D-01은 guest-surface 가드 2곳 제거 + dates 분기 both 미러로 충족 (Q4) |
| CHAT-05 | 호스트와 게스트가 공유 모드 무관하게 같은 저장소에서 대화한다 | trip_messages가 이미 유일 영속 저장소 — /poll만 `join_moa_by_poll_code` DEFINER RPC(0032, Q1 답) + 채팅-소유 래퍼(Q2 답)로 합류 |
| CHAT-06 | poll 한마디(`poll-chat.tsx`)가 은퇴되고 중복 대화 표면이 제거된다 | 은퇴 대상 전수 목록 확보 (아래 "은퇴 지도") — 소스 3파일 + 테스트 3파일 + api 2함수. HC-7 grep 앵커 3종으로 게이트 |
| CHAT-07 | 기존 채팅 기능(영속 이력·presence·장소 멘션 답장 칩) 무회귀 | moa-chat/moa-island/moa-tab-bar **diff 0** 가능 확인 (모든 seam이 이미 optional prop) + 기존 moa-chat 9·moa-island 15 테스트가 회귀 앵커 |
</phase_requirements>

## Summary

이 phase는 잘 문서화된 기존 코드 위의 내부 리팩토링이다. 핵심 발견 3가지:

1. **CHAT-04(dates 게스트 채팅)는 DB 변경 0으로 성립한다.** 0016의 `can_read_trip`/`can_vote_trip` DEFINER 헬퍼를 직접 판독한 결과 둘 다 **role 필터가 없다** — accepted 멤버면 통과. `join_moa`(0025)가 dates 게스트에 부여하는 'voter' role로 trip_messages SELECT/INSERT 모두 통과한다 (F-1 해소). 웹 코드 변경은 guest-surface.tsx의 `shareMode !== 'dates'` 가드 2곳 제거 + dates 분기의 both 미러가 전부다.

2. **`/poll`의 poll_code→멤버십 경로는 신규 RPC 1개가 필요하다 (유일한 마이그레이션, 0032).** 전 마이그레이션 판독 결과 poll_code→slug 해석 RPC는 **존재하지 않는다** (`public_trip_poll`은 slug→poll 역방향, `poll_view_by_code`는 trip_id는 주지만 slug는 안 준다). share_slug를 poll_code 보유자에게 노출하는 건 두 bearer 스코프의 의도적 분리(0018 주석 명시)를 붕괴시키므로, `join_moa`를 미러한 `join_moa_by_poll_code(p_code)` DEFINER RPC 신설이 정답이다. 이 방식이면 visibility='private'인 레거시 dateless-poll trip(iOS Phase 19 생성분 — `create_dateless_trip_with_poll`은 visibility를 안 건드림)에서도 join이 성립한다.

3. **`/poll` 채팅 마운트는 MoaIsland가 아니라 경량 채팅-소유 클라이언트 island이 정답이다.** MoaIsland는 fixed inset-0 풀스크린 셸(지도+시트+탭바)이고 seed 9종(places/links/votes/plan...)을 요구한다 — /poll의 h-[400px] 페이지 섹션에 부적합. 필요한 것은 tripId + messages + 단일 `moa:{tripId}` 채널(trip_messages INSERT 바인딩 + presence)뿐. 단, 게이트는 투표(PollVoteIsland.onRequireMember)와 채팅이 **공유**해야 하므로(UI-SPEC A-7 "어느 쪽이 먼저든 1회"), 래퍼는 PollVoteIsland와 채팅 섹션을 함께 감싸는 하나의 클라이언트 island이어야 한다.

**Primary recommendation:** 마이그레이션은 0032 `join_moa_by_poll_code` 1개만. 웹 변경은 guest-surface(dates→both 수렴), poll-vote-island(PollChat/presence/embedded 제거 + stored-nickname 게이트 우회 1줄 봉합), /poll 신규 게이트+채팅 소유 island, poll-chat.tsx 삭제. moa-chat/moa-island/moa-tab-bar는 **한 줄도 수정하지 않는다**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 채팅 영속 이력·전송 권한 | Database (trip_messages + RLS 0025/0028) | — | RLS `can_read_trip`/`can_vote_trip`이 최종 게이트. 클라이언트는 통과만 |
| 실시간 fan-out·presence | Supabase Realtime (`moa:{tripId}` postgres_changes + presence) | Browser client (구독·track) | WALRUS가 구독자 JWT로 RLS 재평가 — 멤버만 이벤트 수신 (25-05 실증) |
| 익명 멤버 승격 | Database (DEFINER RPC `join_moa` / 신규 `join_moa_by_poll_code`) | Browser client (signInAnonymously + 게이트 UI) | bearer 코드 검증·self-join·role 결정은 전부 서버 (T-23-04) |
| 채팅 프레젠테이션 | Browser client (`moa-chat.tsx` — controlled, 무수정) | — | 채널·상태는 소유자 island 몫 (Phase 26 RESEARCH Q3 계약) |
| 채널·메시지 상태 소유 (dates /t) | Browser client (`moa-island.tsx` — 기존 그대로) | — | D-01: dates도 both 경로로 MoaIsland 마운트 |
| 채널·메시지 상태 소유 (/poll) | Browser client (신규 채팅-소유 래퍼 island) | — | MoaIsland 부적합 (아래 Q2) — 경량 소유자 신설 |
| poll_code→trip 해석 | Database (신규 0032 DEFINER RPC) | — | anon-grant 경로 부재 확인 — 클라이언트에서 해석 불가 |
| SSR 셸 캐시 | Frontend Server (`getCachedPoll` unstable_cache — 무수정) | — | 정적 메타만 캐시, 채팅은 전부 client hydrate (Pitfall 2 계승) |

## 핵심 연구 질문 답변 (D-03a / Plan-Input Flags)

### Q1. poll_code→slug 해석: 기존 RPC로 가능한가? → **불가. 신규 DEFINER RPC 필요 (0032)** [VERIFIED: 0016~0031 전 마이그레이션 판독]

전 마이그레이션의 anon/authenticated-grant 함수 전수 확인:

| RPC | 방향 | poll_code→slug? |
|-----|------|------------------|
| `poll_view_by_code(p_code)` (0018) | code → `{id, trip_id, mode, status, options}` | **trip_id는 반환, share_slug는 미반환** |
| `public_trip_poll(p_slug)` (0029) | slug → `{poll_code, mode, status, options}` | 역방향 |
| `public_trip_view(p_slug)` (0029) | slug → trip/places/links | 역방향 |
| `join_moa(p_share_slug)` (0025) | slug → 멤버십 | slug 필수 + `visibility in ('shared','public')` 게이트 |

**slug 노출 방식은 기각해야 한다:** 0018 주석이 명시하듯 poll_code는 share_slug와 **의도적으로 독립인 bearer 스코프**다("the anon bearer scope is separate from the authenticated trip-sharing slug"). poll_view_by_code가 share_slug를 반환하게 확장하면 poll_code 보유자가 /t 링크(더 넓은 권한 표면 — places both 모드면 editor join)를 획득한다 — 스코프 붕괴.

**추가 결정 근거 — visibility 함정:** `join_moa`는 `visibility in ('shared','public')`을 요구한다. 그런데 `create_dateless_trip_with_poll`(0018 — iOS Phase 19 온보딩 경로)은 trips를 default `visibility='private'`·share_slug null로 만든다. iOS가 공유한 기존 `/poll/{code}` 링크의 trip들은 **private이고 slug가 없다**. 따라서 slug 경유 join은 이 레거시 poll에서 구조적으로 불가능 — poll_code 자체를 bearer로 쓰는 전용 RPC만이 전 /poll 표면을 커버한다.

**신설 스펙 (0029 `public_trip_poll`/0025 `join_moa` 미러):**

```sql
-- 0032_join_moa_by_poll_code.sql (append-only, 0016~0031 무수정)
create or replace function join_moa_by_poll_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
begin
  -- bearer 코드 검증: poll_code 보유 = 이 trip의 dates-scope 참여 자격.
  -- status 게이트 없음: 채팅은 trip 소속(A-8) — poll 마감 후에도 대화 유지.
  select p.trip_id, t.owner_id into v_trip_id, v_owner_id
  from date_polls p join trips t on t.id = p.trip_id
  where p.poll_code = p_code
  limit 1;

  if v_trip_id is null then
    raise exception 'poll not found';
  end if;

  if v_owner_id = auth.uid() then
    return v_trip_id;
  end if;

  -- poll_code는 dates 시맨틱 → role 고정 'voter' (join_moa D-A1 dates 분기 미러).
  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(), 'voter', now())
  on conflict (trip_id, user_id) do nothing;  -- 멱등, 자동 승격 없음 (D-A4)

  return v_trip_id;
end;
$$;

grant execute on function join_moa_by_poll_code(text) to authenticated;
-- anon grant 없음: 익명이라도 세션 필수 (cast_date_vote_authed 0029 선례)
```

+ `packages/api/src/queries/memberships.ts`에 `joinMoaByPollCode(client, code)` 래퍼 append (joinMoa 미러) + `pnpm supabase:types` 재생성.

주의: 이 RPC는 반환된 trip_id를 래퍼가 그대로 쓰지만, /poll 페이지는 이미 SSR seed(`getCachedPoll`)로 `trip_id`를 갖고 있다 — 채널명·listTripMessages에 그 trip_id를 쓰면 된다. RPC 반환값은 검증용.

### Q2. /poll 채팅 마운트: MoaIsland류 vs 경량 채팅-소유 컴포넌트? → **경량 채팅-소유 island + 게이트 공유 래퍼** [VERIFIED: moa-island.tsx·poll-vote-island.tsx·guest-surface.tsx 판독]

MoaIsland 재사용 기각 근거 (코드 실측):
- **레이아웃 충돌:** MoaIsland는 `fixed inset-0` 풀스크린(지도 + PlaceSheet + MoaTabBar). /poll은 투표 UI 아래 h-[400px] 페이지 섹션(UI-SPEC A-6) — 구조적으로 양립 불가.
- **seed 과잉:** `MoaIslandProps`는 trip/places/links/counts/votedIds/members/profileNames/messages/plan 9종 필수. /poll 채팅에 필요한 건 tripId·messages·uid·nickname 4개.
- **불필요 바인딩:** MoaIsland 채널은 places INSERT·links UPDATE 바인딩 + reconcile(전체 refetch)을 수반 — /poll엔 장소 표면이 없다.

**권고 구조:** `/poll/[code]/_components/`에 신규 클라이언트 island 1개 (예: `poll-guest-island.tsx` — 파일명 plan 재량). **PollVoteIsland와 채팅 섹션을 함께 감싸야 한다** — 이유: UI-SPEC A-7 "투표 첫 참여도 동일 게이트 공유(어느 쪽이 먼저든 1회)". 게이트 상태(NicknameGateSheet + requireMember promise 브리지)가 투표(onRequireMember prop)와 채팅(첫 전송)의 공용 자원이므로 한 컴포넌트가 소유해야 한다. guest-surface의 `requireMember`/`gateResolve` promise 브리지 패턴(guest-surface.tsx:233-240)을 그대로 미러.

래퍼 책임 (guest-surface + moa-island 축소 미러):
1. 마운트 시 세션 해석: `auth.getUser()` → uid 있으면 `getMyTripRole(tripId)` → member/owner면 즉시 hydrate (재방문 D-05 미러).
2. 게이트: `NicknameGateSheet`(무수정 재사용) → `signInAnonymously({options:{data:{name}}})` → `joinMoaByPollCode(code)` → `setStoredNickname` (ensureGuestMember 미러, joinMoa→joinMoaByPollCode만 교체).
3. join 후 hydrate: `listTripMessages(client, tripId)` (trips SELECT 불필요 — trip_messages RLS는 membership만 봄. **getTrip을 호출하지 말 것**: private 레거시 poll trip은 trips SELECT 정책상 멤버여도 visibility 게이트에 걸린다).
4. 채널: join 후에만 `client.channel(moaChannelName(tripId), {config:{presence:{key: uid}}})` — trip_messages INSERT 바인딩 + presence sync 전부 `.subscribe()` **이전** 체이닝(#1917) → SUBSCRIBED 시 `track({user_id, nickname, online_at})` (moa-island.tsx:194-231 미러, places/links 바인딩만 제외).
5. 전송: `TripMessageCreateSchema.parse` → `sendTripMessage` → append + id dedup (moa-island handleSend 미러).
6. 렌더: `<MoaChat messages currentUserId viewers onSend replyToPlaceId={null} onClearReply={noop} placesById={{}} onChipTap={noop} />` — placesById 빈 객체면 칩 전부 미해석·미렌더 (Pitfall 9 기존 경로, UI-SPEC A-9).
7. 비멤버 상태: 채널 미구독·messages=[]·viewers=0. 전용 빈 상태 카피(A-7)는 MoaChat 밖(섹션 레벨)에서 조건 렌더하면 moa-chat 무수정 유지 가능 — 또는 HC-3 additive optional prop. **권고: 섹션 레벨 처리** (moa-chat diff 0가 HC-6 회귀 앵커).

### Q3. trip_messages RLS: dates-mode voter가 이미 통과하는가? → **예. 신규 마이그레이션 불필요** [VERIFIED: 0016·0025 SQL 직접 판독]

0025 정책과 0016 헬퍼 본문 대조:

```
SELECT: can_read_trip(trip_id)  → owner OR exists(memberships … accepted_at is not null)   ← role 조건 없음
INSERT: user_id = auth.uid() AND can_vote_trip(trip_id)
        can_vote_trip → owner OR exists(memberships … accepted_at is not null)             ← role 조건 없음
```

`can_vote_trip`(0016:338-358)과 `can_read_trip`(0016:291-309)은 **둘 다 role을 보지 않는다** — accepted 멤버십 존재만 검사. `join_moa`의 dates 분기가 넣는 `role='voter', accepted_at=now()` 행으로 SELECT·INSERT 모두 통과한다. user_id는 0028 BEFORE-INSERT 트리거가 `auth.uid()`로 채운다. realtime fan-out도 동일 — WALRUS는 SELECT 정책(can_read_trip)으로 구독자별 재평가하므로 voter 멤버도 postgres_changes 이벤트를 받는다. editor role에 대해서는 `web_share_smoke.sh` (6)에서 trip_messages INSERT 201로 이미 실증(25-05); voter는 role-무관 정책이므로 동일 (smoke에 voter 케이스 append 권장 — Validation 참조).

**F-1 해소.** F-2 (FAB): `places INSERT` 정책은 `can_edit_trip` = **owner|editor만** (0016:313-334), `add_manual_place` RPC도 `can_edit_trip` 가드(0027:37). voter인 dates 게스트에게 FAB가 보이면 실패 UX → **FAB 노출 게이트 필요** (아래 Pitfall 6).

### Q4. guest-surface dates→both 수렴 시 깨질 수 있는 지점 [VERIFIED: guest-surface.tsx 판독]

변경 지점 전수 (현재 코드 라인 기준):

| 위치 | 현재 | 변경 |
|------|------|------|
| `:114` 세션 effect | `if (shareMode !== 'dates') { await hydrateMember(...) }` | 가드 제거 — dates 재방문 멤버도 hydrate 후 MoaIsland 마운트 |
| `:248` handleConfirmNickname | `if (shareMode !== 'dates') await hydrateMember(uid, nick);` | 가드 제거 — dates 첫 join도 hydrate |
| `:336-343` dates 분기 | `return <>{pollSection}{gate}</>` | both 분기 미러: `joined && moaSeed ? <MoaIsland {...moaSeed} hideHostControls pollSlot={…}/> : <>{pollSection}</>` + gate. 비join은 현행 유지 (A-2) |
| `:301` `embedded={shareMode === 'both'}` | PollVoteIsland에 전달 | **라인 제거** (A-5 — embedded prop 자체가 소멸) |

깨질 수 있는 지점 (판독으로 확인):
1. **hydrateMember의 dates 안전성:** dates trip은 places 0이 일반적. `getVoteCounts([])`는 empty short-circuit `{}` 반환 확인(votes.ts:66) — 안전. `listPlacesByTrip`/`listLinksByTrip`/`listTripMembers`/`listTripMessages`는 멤버 RLS 통과 후 빈 배열 — 안전. `getTrip`은 trips SELECT 정책(owner OR [visibility shared/public AND member]) — /t dates trip은 shareMoa가 visibility='shared'를 설정하므로 통과. **/t 경로는 안전** (/poll의 private trip과 다름).
2. **순서:** handleConfirmNickname은 `hydrateMember` 완료 후 `setJoined(true)` → `gateResolve` 순서를 유지해야 한다. 렌더 가드가 `joined && moaSeed`라 seed 없이 joined만 서는 순간이 있어도 fallback 렌더로 안전하지만, 순서를 바꾸면 게이트 resolve 후 PollVoteIsland 투표 재개와 MoaIsland 마운트가 경합한다 — 현 코드 순서(248-250) 유지.
3. **pollSlot 중복 렌더 금지:** both 분기의 기존 규율("joined 시 pollSlot으로 이동, sibling 렌더 금지") 그대로 — dates에서 pollSection을 pollSlot과 sibling 양쪽에 넣으면 poll 채널 이중 구독(같은 topic 2채널 = 배달 탈취)이 된다.
4. **테스트 갱신:** `guest-surface.test.tsx`의 dates 케이스("dates 전용 화면은 embedded=false (한마디·presence 유지)" 등)가 현행 동작을 단언 — 코드 변경과 같은 wave에서 재작성 필수.

### Q5. presence 통일 (`poll:{tripId}` → `moa:{tripId}`) 잔여 회귀 지점 [VERIFIED: poll-vote-island.tsx 판독]

`poll:{tripId}` 채널은 **투표 broadcast fan-out용으로 존속**해야 한다 (UI-SPEC: "투표 UI·집계·poll:{tripId} 투표 broadcast는 무변경") — iOS 호스트 plan 탭 `subscribePollChannel`이 같은 채널에서 vote 이벤트를 수신한다 (iOS 동결 — 채널 프로토콜 변경 금지). 제거 대상은 presence **표시·track**만:

| poll-vote-island 내 제거 대상 | 라인(현재) | 비고 |
|------|------|------|
| `viewers` state + presence sync 바인딩 | :121, :186-188 | 스트립 소멸 (A-4) |
| SUBSCRIBED 시 `channel.track(...)` | :189-193 | presence 참여 중단 |
| nickname 변경 재-track effect | :204-208 | track 소멸로 orphan |
| presence 스트립 렌더 | :424-429 | `!embedded && viewers > 0` 블록 |
| `sharedChannel` state + setSharedChannel | :131-133, :179, :197 | PollChat 전달용이었음 — PollChat 소멸로 orphan |
| `PollChat` 마운트 2곳 + import | :14, :372, :561 | D-02 |
| `embedded` prop + 관련 분기 | :73, :371, :424, :560 | A-5 — 호출부 guest-surface `:301`도 함께 |
| channel 생성 시 presence config | :175-177 | track이 없으면 `config.presence` 무의미 — 제거 가능(broadcast만 남음). 단 iOS가 이 채널 presence를 쓰는지 확인: iOS `subscribePollChannel`은 presence sync로 viewer count를 fan-out함 → **웹이 track을 끊으면 iOS 호스트 카드의 '보는 중' 카운트에서 웹 방문자가 빠진다.** iOS 동결이라 iOS 코드는 못 고침 — 카운트가 줄 뿐 크래시 없음. 수용 (아래 Assumptions A2) |

잔여 회귀 지점: (a) `channelRef`는 vote broadcast `.send()`용으로 유지 — 제거하면 투표 fan-out이 끊긴다. (b) poll-vote-island 테스트 파일의 presence/한마디 케이스 갱신. (c) MoaChat presence가 유일 표면이 되므로 /poll 채팅 비구독(비멤버) 상태에선 스트립이 아예 없음 — A-4 의도대로.

### F-3 (poll_code→slug): Q1로 해소 — slug 해석 자체를 우회 (poll_code가 직접 bearer).

## 은퇴 지도 (D-02 전수 목록)

**삭제 파일:** `apps/web/app/poll/[code]/_components/poll-chat.tsx`

**수정 파일:**
- `poll-vote-island.tsx` — 위 Q5 표 전체
- `guest-surface.tsx` — Q4 표 전체
- `packages/api/src/queries/date-polls.ts` — `postComment`(:94-106)·`deleteComment`(:109-118) 제거 (호출부는 poll-chat.tsx뿐 — 삭제 후 orphan 확인됨). `castDateVote`는 유지 — D-02 범위 밖, /poll 래퍼가 onRequireMember를 제공하면 웹 호출부는 사라지지만 surgical 원칙상 미요청 제거 금지 (§3.3)

**테스트 갱신 (같은 wave 필수):**
- `apps/web/__tests__/poll-vote-island.test.tsx` — postComment/deleteComment mock(:48-56)·한마디/embedded 케이스(:202-211) 제거·재작성
- `apps/web/__tests__/guest-surface.test.tsx` — dates/embedded 단언(:200, :213) 재작성
- `packages/api/src/queries/date-polls.test.ts` — postComment/deleteComment describe(:162-197) 제거

**유지 (무접촉):** `date_comments` 테이블·0018 RPC(post_poll_comment/delete_poll_comment — DB 함수는 마이그레이션 append-only상 제거 불가, 호출부만 소멸)·`database.ts` date_comments 타입(typegen 산출물 — 테이블이 남으므로 자연 유지)·`device-token.ts`(getDeviceToken은 castDateVote 폴백 등 잔존 참조 확인 후 처리, getStoredNickname/setStoredNickname은 계속 사용)

**HC-7 grep 앵커 (phase 완료 후 apps/web 0건):** `한마디` · `투표가 마감되어 메시지를 남길 수 없어요` · `이 메시지를 삭제할까요?` — 주의: guest-surface.tsx:299-300과 poll-vote-island.tsx:69의 **주석**에도 "한마디"가 있다. 해당 주석은 어차피 변경 라인 — 재서술 필수 (acceptance grep 오탐 선례: 24-05·26-02 deviation).

## Standard Stack

### Core (전부 기존 — 신규 설치 0)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.110.0 | realtime channel·presence·postgres_changes | 워크스페이스 고정 (Phase 20/24 결정), presence 수렴 실증 stack |
| next | 15.x | /poll SSR 셸 (무수정) | 기존 |
| zod (@moajoa/core) | 기존 | `TripMessageCreateSchema` UI 경계 검증 (§4.5) | 기존 계약 |
| vitest + @testing-library/react | 기존 | web/api 테스트 | 기존 |

**신규 npm 패키지 0. 신규 아이콘 0. 신규 hex 0** (UI-SPEC HC-2). 버전 확인은 레포 lockfile 기준 — 외부 레지스트리 조회 불필요 (의존성 추가가 없으므로).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 신규 0032 RPC | poll_view_by_code에 share_slug 추가 | bearer 스코프 붕괴 (Q1) — 기각 |
| 신규 0032 RPC | /poll URL에 slug 동반 (`/poll/[code]?s=slug`) | 기존 유통 링크 전부 무효 — 기각 |
| 경량 래퍼 island | MoaIsland 재사용 | fixed inset-0·seed 9종·불필요 바인딩 (Q2) — 기각 |

## Architecture Patterns

### System Architecture Diagram (통일 후)

```
호스트 /moa/[id] ──────────┐
                            │  moa-island.tsx (채널 소유 — 무수정)
/t/[slug] places·both·dates ┤     │  messages state · presence · 멘션
  guest-surface (D-01 수렴) ┘     │
                                  ▼
                        MoaChat (controlled 프레젠테이션 — 무수정)
                                  ▲
/poll/[code] ── poll-guest-island(신규, 채널 소유) ──┘
     │                │
     │                ├─ NicknameGateSheet(재사용) ─ signInAnonymously
     │                │      └→ join_moa_by_poll_code(0032, DEFINER) → memberships(voter)
     │                └─ listTripMessages / sendTripMessage (RLS: can_read/can_vote — role 무관)
     │
     └─ PollVoteIsland(수정: PollChat·presence·embedded 제거)
            └─ poll:{tripId} 채널 (vote broadcast 전용 존속 — iOS 호스트 수신)

Supabase Realtime: moa:{tripId} ← trip_messages INSERT (publication 0028) + presence(key=auth.uid)
Storage: trip_messages (유일 대화 저장소) · date_comments (미사용 방치 D-02a)
```

### Recommended Project Structure (변경분만)
```
supabase/migrations/0032_join_moa_by_poll_code.sql   # 신규 (유일한 마이그레이션)
packages/api/src/queries/memberships.ts               # joinMoaByPollCode append
packages/api/src/queries/date-polls.ts                # postComment/deleteComment 제거
apps/web/app/poll/[code]/page.tsx                     # PollVoteIsland → 신규 island로 교체 마운트
apps/web/app/poll/[code]/_components/
  poll-guest-island.tsx                               # 신규 — 게이트+채팅 소유 (이름 plan 재량)
  poll-vote-island.tsx                                # PollChat·presence·embedded 제거
  poll-chat.tsx                                       # 삭제
apps/web/app/t/[slug]/_components/guest-surface.tsx   # dates→both 수렴
```

### Pattern 1: 게이트 promise 브리지 (guest-surface 미러)
**What:** 첫 참여 액션(투표 또는 채팅 전송)이 `requireMember(): Promise<{uid, nickname}>`를 await — 게이트 confirm 시 resolve, 취소 시 reject.
**When to use:** /poll 래퍼가 PollVoteIsland.onRequireMember와 채팅 onSend 양쪽에 같은 브리지를 공급.
```typescript
// Source: apps/web/app/t/[slug]/_components/guest-surface.tsx:233-240 (기존 검증 코드)
function requireMember(): Promise<{ uid: string; nickname: string }> {
  if (joined && userId) return Promise.resolve({ uid: userId, nickname });
  return new Promise((resolve, reject) => {
    gateResolve.current = resolve;
    gateReject.current = reject;
    setGateOpen(true);
  });
}
```

### Pattern 2: pre-subscribe 바인딩 체인 (moa-island 미러)
**What:** postgres_changes 바인딩은 `.subscribe()` 이전에 전부 체이닝 — 이후 추가는 무음 no-op (#1917, Phase 26이 겪은 함정).
```typescript
// Source: apps/web/app/moa/[id]/_components/moa-island.tsx:194-231 (기존 검증 코드, places/links 바인딩 제외 축소)
const channel = client.channel(moaChannelName(tripId), { config: { presence: { key: uid } } });
channel
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
      (payload) => appendMessage(payload.new as TripMessage))
  .on('presence', { event: 'sync' }, () => setViewers(Object.keys(channel.presenceState()).length))
  .subscribe(async (s) => {
    if (s === 'SUBSCRIBED') await channel.track({ user_id: uid, nickname, online_at: new Date().toISOString() });
  });
```

### Anti-Patterns to Avoid
- **같은 topic 2채널:** `moa:{tripId}`를 래퍼와 다른 컴포넌트가 각각 열면 나중 채널이 배달을 탈취 (poll-chat 헤더 주석에 기록된 Phase 19/20 교훈). /poll 래퍼가 유일 소유자.
- **join 전 채널 구독:** WALRUS RLS로 SUBSCRIBED-무음-0건 + 비멤버 presence 오염. join 완료 후에만 구독 (guest-surface Pitfall 4 계승).
- **moa-chat에 분기 추가:** HC-3 — controlled props로만 소비. /poll 비멤버 빈 상태는 섹션 레벨에서.
- **payload 신뢰 후 패치:** trip_messages는 append-only INSERT라 id-dedup append가 규약 (moa-island appendMessage) — reconcile 불필요.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| /poll 익명 승격 | 새 인증 흐름 | `signInAnonymously` + 신규 RPC (ensureGuestMember 미러) | Phase 25 실증 경로 — 익명도 auth.uid 보유 authenticated role |
| 채팅 UI | /poll 전용 채팅 컴포넌트 | `MoaChat` verbatim (HC-3) | 시각·IME 가드·draft 복원 전부 검증됨 |
| 게이트 UI | inline 닉네임 폼 | `NicknameGateSheet` (카피 무수정) | UI-SPEC 계약 |
| 멤버 판정 | 클라이언트 role 캐시 | `getMyTripRole` + RLS 최종 게이트 | 클라이언트 판정은 UX용, DB가 방어 |
| poll_code 검증 | 클라이언트 trip 조회 | DEFINER RPC 내부 검증 | 클라이언트 trip_id 신뢰 금지 (0018 idiom) |

**Key insight:** 이 phase의 모든 빌딩블록이 이미 존재하고 라이브 실증됐다 — 조립과 제거만 있고 발명은 0032 RPC 하나(그마저 join_moa 미러)뿐이다.

## Runtime State Inventory (리팩토링/은퇴 phase)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `date_comments` 행 (휘발성 broadcast-only 설계 — anon SELECT 경로 원래 없음) | 없음 — D-02a 미사용 방치. 마이그레이션 불필요 |
| Stored data | localStorage: `moajoa:poll_device_token` · `moajoa:poll_nickname` | nickname은 계속 사용(게이트 skip). device_token은 castDateVote 폴백에 잔존 — 코드 정리 시 참조 확인만, 삭제 마이그레이션 없음 |
| Live service config | Supabase realtime publication — trip_messages 이미 등록(0028), date_comments는 원래 미등록 | 없음 — 확인 완료 |
| Live service config | 원격 DB: 0032 push 필요 (Supabase↔GitHub main push 자동 적용 관례) | main push 후 라이브 /poll join 동작 — human-action 게이트로 기록 |
| OS-registered state | 없음 — 웹 전용 phase | 없음 — 확인 완료 |
| Secrets/env vars | 없음 — 신규 env 0 | 없음 |
| Build artifacts | `.next` 캐시에 구 "한마디" 문자열 잔존 가능 | HC-7 grep은 소스만 대상 (`--exclude .next`), 빌드 재실행으로 자연 해소 |
| SSR cache | `getCachedPoll` unstable_cache 1h TTL — 정적 메타만이라 이번 변경과 무관(채팅은 client hydrate) | 없음 — 셸 캐시 무독성 유지 확인 |
| 유통된 링크 | 기존 `/poll/{code}` 링크 (iOS Phase 19 호스트 공유분) — private trip·slug 없음 | 0032가 poll_code 직접 bearer라 커버 (Q1 결정 근거) |

## Common Pitfalls

### Pitfall 1: stored-nickname이 게이트를 우회해 castDateVoteAuthed 401
**What goes wrong:** PollVoteIsland는 `nicknameProp` 부재 시 localStorage 닉네임을 hydrate한다(:137-141). `onRequireMember`가 있으면 castVote가 `castDateVoteAuthed`(authenticated-only grant)를 쓰는데, 레거시 /poll에서 닉네임만 저장하고 세션이 없는 재방문자는 effectiveNickname이 차 있어 **게이트를 안 거치고** authed RPC 호출 → 401 → 롤백 토스트.
**Why:** RPC 선택은 onRequireMember **존재**로, 게이트 호출은 nickname **부재**로 분기 — 두 조건이 어긋난다.
**How to avoid:** stored-hydrate skip 조건에 onRequireMember 추가 (1줄 surgical): `if (nicknameProp || initialNickname || onRequireMember) return;` — /t 임베드(guest-surface)도 같은 잠재 버그가 있었으므로 함께 봉합된다.
**Warning signs:** /poll에서 재방문자가 투표 시 "투표를 저장하지 못했어요" 토스트.

### Pitfall 2: /poll 래퍼에서 getTrip 호출
**What goes wrong:** 레거시 dateless-poll trip은 `visibility='private'` — trips SELECT 정책(owner OR [shared/public AND member])상 **voter 멤버여도 trips 행을 못 읽는다**. hydrate가 getTrip을 포함하면 join 성공 후에도 채팅이 안 뜬다.
**How to avoid:** 래퍼 hydrate는 `listTripMessages`만 (trip_messages RLS는 membership만 검사). trip_id는 SSR seed(getCachedPoll)에서.
**Warning signs:** join 후 콘솔 조용·채팅 영구 빈 화면.

### Pitfall 3: 채널 바인딩 사후 추가 (#1917)
**What goes wrong:** subscribe 후 `.on('postgres_changes', …)` 추가는 무음 no-op — 라이브 메시지가 안 온다.
**How to avoid:** Pattern 2 — 전 바인딩을 subscribe 이전 체이닝. 신규 래퍼 테스트에서 바인딩 수 단언 (moa-island.test 선례).

### Pitfall 4: join 전 채널 구독 / 비join presence 오염
**What goes wrong:** 비멤버가 moa:{tripId}를 구독하면 postgres_changes는 0건(WALRUS)이지만 presence track은 성립 — 호스트 채팅 스트립 카운트에 유령이 잡힌다.
**How to avoid:** joined 상태에서만 채널 effect 실행 (guest-surface Pitfall 4 계승). 비멤버는 viewers=0·스트립 숨김 (A-7/A-4와 정합).

### Pitfall 5: dates 수렴 시 hydrate 순서·가드 이중 제거 누락
**What goes wrong:** `shareMode !== 'dates'` 가드는 **두 곳**(:114 세션 effect, :248 handleConfirmNickname)에 있다. 한 곳만 제거하면 첫 join은 되는데 재방문 멤버가 poll-only 화면에 갇히는(또는 그 반대) 반쪽 회귀.
**How to avoid:** 두 가드를 같은 task에서 제거 + 테스트로 dates 재방문 멤버 MoaIsland 마운트 단언.

### Pitfall 6: voter 게스트에게 FAB·쓰기 표면 노출 (F-2)
**What goes wrong:** MoaIsland FAB(장소 추가)는 hideHostControls와 무관하게 렌더(:621-630). dates voter가 누르면 add_manual_place가 `can_edit_trip` 가드로 거부 — 실패하는 버튼.
**How to avoid:** UI-SPEC F-2 계약 "쓰기 권한 없는 role에겐 FAB 미노출". 옵션: (a) MoaIslandProps에 optional prop 추가(예: `hidePlaceAdd`, 미전달=기존 렌더 — 호스트/both 게스트 diff 0) + guest-surface가 `shareMode === 'dates'`일 때 전달, (b) memberships.role 실조회. **권고 (a)** — share_mode가 role의 결정자(D-A1)라 클라이언트 파생으로 충분하고 DB가 최종 방어. 단 D-A4(재-join 시 role 유지) 엣지: dates→both로 모드 변경된 trip의 기존 voter는 both 화면에서 FAB를 보게 됨 — RLS가 막으므로 실패 토스트로 수용 (기존에도 동일 엣지 존재).
**Warning signs:** dates 게스트 화면에서 [+] 탭 → "추가하지 못했어요".

### Pitfall 7: 게이트 취소 시 채팅 전송 에러 토스트
**What goes wrong:** MoaChat.onSend가 throw하면 draft 복원 + "메시지를 보내지 못했어요" 토스트 (moa-chat:70-74, 무수정 계약). /poll 래퍼의 onSend가 게이트를 열고 사용자가 **취소**하면 reject → throw 경로 → 취소인데 에러 토스트.
**How to avoid:** 완벽 해소는 moa-chat 수정(HC-3 위반 위험) — **수용 권고**: draft 복원이 더 중요한 계약이고, 토스트 1회는 경미. plan에서 명시적 비목표로 기록해 회귀 오인 방지.

### Pitfall 8: pollSlot sibling 중복 렌더
**What goes wrong:** dates joined 화면에서 pollSection을 pollSlot과 페이지 sibling 양쪽에 두면 PollVoteIsland 2개 마운트 → `poll:{tripId}` 같은 topic 2채널 → 투표 broadcast 배달 탈취.
**How to avoid:** both 분기의 기존 규율 미러 — joined면 pollSlot에만.

### Pitfall 9: 테스트·grep 앵커의 시차
**What goes wrong:** poll-vote-island.test(:202-211 한마디)·guest-surface.test(:213 embedded)·date-polls.test(:162-197 postComment)가 은퇴 대상 동작을 단언 — 코드만 지우면 스위트 RED.
**How to avoid:** 각 삭제 task에 대응 테스트 갱신을 같은 커밋으로. HC-7 grep은 `.next` 제외 소스만.

## Code Examples

핵심 예시는 위 Q1(0032 SQL 전문)·Pattern 1(게이트 브리지)·Pattern 2(채널 체인) 참조 — 전부 이 레포의 검증된 기존 코드 미러.

### /poll 래퍼 onSend (게이트 합류)
```typescript
// guest-surface requireMember + moa-island handleSend 합성 (신규 래퍼 내부)
async function handleSend(body: string, _replyTo: string | null) {
  let uid = userId, nick = nickname;
  if (!joined || !uid) {
    const m = await requireMember(); // 게이트 confirm → signInAnonymously + joinMoaByPollCode + hydrate + subscribe
    uid = m.uid; nick = m.nickname;
  }
  const input = TripMessageCreateSchema.parse({
    trip_id: tripId, nickname: nick, body, reply_to_place_id: null,
  });
  const row = await sendTripMessage(getSupabaseBrowser(), input);
  appendMessage(row); // postgres_changes echo는 id dedup
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| device_token 익명 신원 (Phase 19) | 익명 auth.uid 멤버십 (Phase 25) | 0029 cast_date_vote_authed | /poll도 이 궤도로 합류 — device_token은 레거시 폴백만 |
| broadcast-only 무이력 한마디 | trip_messages 영속 + postgres_changes | Phase 26 (0028) | 이번 phase가 마지막 broadcast-채팅 표면 제거 |
| child-owns-bindings (poll-chat) | island-owns-channel, controlled 프레젠테이션 (moa-chat) | Phase 26 RESEARCH Q3 | 신규 래퍼도 island-owns 형태 필수 |

**Deprecated/outdated:** `post_poll_comment`/`delete_poll_comment` DB 함수 — 호출부 소멸로 사실상 dead (DB 함수 제거는 append-only상 후속 별건).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 0032 join RPC에 poll `status='open'` 게이트를 **두지 않는다** (채팅은 trip 소속 — A-8 정합; 0018의 "closed = anon write 철회"는 votes/comments 스코프였다는 해석) [ASSUMED — 설계 판단] | Q1 | closed poll의 코드 보유자가 계속 멤버로 합류 가능. 사용자가 "마감 = 신규 참여 차단"을 원하면 RPC에 status 게이트 1줄 추가 |
| A2 | 웹이 poll:{tripId} presence track을 끊으면 iOS 호스트 plan 카드의 "보는 중" 카운트에서 웹 방문자가 빠진다 — 기능 파손 아닌 카운트 감소로 **수용** [VERIFIED: iOS subscribePollChannel이 presence sync 수신 (STATE 19-03), 웹 track 소멸의 영향은 추론] | Q5 | iOS 호스트가 "0명 보는 중"을 봄. iOS 동결이라 대안 없음 — presence 통일의 알려진 비용으로 기록 |
| A3 | poll_code 보유자의 voter 멤버십은 trip 전체 read(places/links/messages)를 부여 — dates 시맨틱 trip엔 통상 장소가 없어 실질 노출 미미, 그리고 D-03a가 승격 방향 자체를 잠갔으므로 수용 [ASSUMED — 스코프 확장 평가] | Security | 장소가 있는 trip의 poll_code가 유출되면 장소 목록 열람 가능. /t dates 공유와 동일한 노출 수준이라 신규 위험은 아님 |
| A4 | `castDateVote`(device_token RPC)와 `getDeviceToken`은 이번 phase에서 제거하지 않는다 — /poll이 onRequireMember 경로로 전환되면 웹 호출부가 사라질 수 있으나 D-02 범위 밖 [ASSUMED — surgical 해석] | 은퇴 지도 | plan이 /poll 투표를 authed 경로로 완전 전환하면 castDateVote가 웹 orphan이 됨 — 제거 여부는 plan에서 명시 결정 |

## Open Questions

1. **Phase 27 UAT 항목 5 (presence 수렴)가 아직 `pending`이다** [VERIFIED: 27-HUMAN-UAT.md:41 "result: pending"]
   - What we know: CONTEXT는 "Phase 27 presence pass가 이 통일의 전제 신호"라 했다. Phase 20 UAT에서 poll 채널 presence는 라이브 수렴 PASS(2.110.0). moa 채널 presence는 코드 동일 패턴이나 2인극 라이브 미확정.
   - What's unclear: moa:{tripId} presence의 라이브 수렴.
   - Recommendation: 블로커 아님 — 같은 supabase-js·같은 track/sync 패턴이 poll 채널에서 라이브 실증됐다. phase 29 UAT에 moa presence 2인극 확인을 포함시켜 27 잔여와 함께 소진.

2. **/poll 투표를 onRequireMember(authed) 경로로 전환할 것인가, 레거시 castDateVote를 병존시킬 것인가**
   - What we know: A-7은 "투표 첫 참여도 동일 게이트 공유"라 했다 → 래퍼가 onRequireMember를 전달하면 투표가 cast_date_vote_authed로 감. 이 경우 /poll 투표자도 전원 익명 멤버가 된다(신원 통일 — phase 목적 정합). device_token 투표 이력과 auth.uid 투표 이력은 dedup 키(device_token 컬럼)가 달라 **재방문자의 기존 투표가 새 신원으로 중복 행이 될 수 있다** (poll_vote_tally는 nickname distinct 집계라 available_count는 device 단위 — 같은 사람이 구 token 행 + 신 uid 행 2행 가능).
   - Recommendation: 전환을 권고 (게이트·신원 단일화가 phase 목적). 중복 투표 엣지는 낮은 확률(재방문+재투표 교집합)·낮은 피해(집계 +1)로 수용하고 plan에 명시. 병존(투표=레거시, 채팅=authed)은 게이트 2벌·신원 2벌로 A-7 위반.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm 워크스페이스 | 테스트·빌드 | ✓ | 레포 표준 | — |
| 로컬 Supabase (colima+docker) | 0032 적용·smoke | 조건부 — colima 기동 필요 (프로젝트 메모리: supabase는 colima 필요) | supabase CLI linked | smoke 없이 SQL 정적 검토 + 원격 push 후 검증 (비권장) |
| psql | smoke 스크립트 | ✓ (기존 smoke가 사용) | — | — |
| node | realtime smoke (mjs) | ✓ | — | — |
| 원격 push (main → Supabase 자동 적용) | 라이브 CHAT-04/05 | human-action 게이트 | — | 로컬 smoke로 코드 완료 판정 (25-01 선례) |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** colima 미기동 시 supabase 로컬 스택 불가 — 실행 전 `colima start` + `supabase start` 확인 절차를 plan에 포함.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (web: `@moajoa/web`, api: `@moajoa/api`) + @testing-library/react |
| Config file | apps/web/vitest 설정 (include `__tests__/**` — co-located 테스트 미수집, 25-02/25-04 선례) |
| Quick run command | `pnpm --filter @moajoa/web exec vitest run __tests__/<file>.test.tsx` (주의: `pnpm --filter @moajoa/web test`는 **watch 모드** — CI=true 또는 `exec vitest run` 필수) |
| Full suite command | `CI=true pnpm -r test` + `pnpm -r typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-04 | dates joined 게스트 → MoaIsland(채팅탭) 마운트 + pollSlot | unit | `pnpm --filter @moajoa/web exec vitest run __tests__/guest-surface.test.tsx` | ✅ 존재 — dates 케이스 재작성 (Wave 0/동일 wave) |
| CHAT-04 | voter role trip_messages INSERT/SELECT 통과 | smoke (DB) | `bash supabase/tests/web_share_smoke.sh` — **(7) voter 케이스 append 필요** (기존 (3) T_DATES join → trip_messages POST 201 + GET 200 단언) | ❌ append — Wave 0 |
| CHAT-05 | 게스트↔호스트 같은 저장소 fan-out | smoke (realtime) | `node supabase/tests/realtime_events_smoke.mjs` — 기존 게스트 fan-out 패턴에 trip_messages INSERT 케이스 append (선택 — WALRUS 검증은 25-05가 이미 실증) | ✅ 패턴 존재 |
| CHAT-05 | /poll 방문자 join → 메시지 송수신 | unit + smoke | 신규 래퍼 테스트 (`poll-guest-island.test.tsx` 등) — 채널명 `moa:{tripId}`·pre-subscribe 바인딩 수·게이트→joinMoaByPollCode 순서 단언 (moa-island.test 채널 fake 패턴 재사용) + smoke에 `join_moa_by_poll_code` rpc 프로브 append | ❌ Wave 0 |
| CHAT-06 | 은퇴 문자열 grep 0 | grep gate | `! grep -rn "한마디\|투표가 마감되어 메시지를 남길 수 없어요\|이 메시지를 삭제할까요?" apps/web --include="*.ts" --include="*.tsx" --exclude-dir=.next` | 명령만 — plan acceptance |
| CHAT-06 | poll-chat.tsx 부재 + orphan api 제거 | grep gate | `! ls apps/web/app/poll/[code]/_components/poll-chat.tsx` + `! grep -n "postComment\|deleteComment" packages/api/src/queries/date-polls.ts` | 명령만 |
| CHAT-07 | 기존 채팅 무회귀 | unit (회귀 앵커) | `pnpm --filter @moajoa/web exec vitest run __tests__/moa-chat.test.tsx __tests__/moa-island.test.tsx` — **무수정 그린** + `git diff --stat`에 moa-chat/moa-island/moa-tab-bar 0줄 (단, F-2로 moa-island에 optional prop을 추가하면 diff 발생 — plan에서 HC-6와 정합 확인: HC-6는 "채팅 경로 무회귀·moa-island 계약 무변경"이므로 additive optional prop은 기존 테스트 무수정 그린으로 입증) | ✅ 존재 |
| CHAT-07 | 호스트 /moa 라이브 채팅·presence·멘션 | manual-only | 2인극 UAT (Phase 27 항목 5 합류) — 브라우저 두 컨텍스트 | 정당: presence 수렴은 동시 세션 필요 |

### Sampling Rate
- **Per task commit:** 해당 파일 단위 `pnpm --filter @moajoa/web exec vitest run __tests__/<changed>.test.tsx` + `pnpm --filter @moajoa/web typecheck`
- **Per wave merge:** `CI=true pnpm -r test` + `pnpm -r typecheck` + web `pnpm --filter @moajoa/web build`
- **Phase gate:** full suite green + grep 게이트 전종 + 로컬 supabase에서 `supabase db reset`(0016→0032 클린·42P17 0) + smoke 3종 exit 0 → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `supabase/tests/web_share_smoke.sh` — (7) voter(dates) trip_messages INSERT 201/SELECT 200 + `join_moa_by_poll_code` 프로브 append (covers CHAT-04/05 DB 측)
- [ ] `apps/web/__tests__/poll-guest-island.test.tsx` (파일명 plan 재량) — 신규 래퍼: 게이트 브리지·채널 소유·전송 (covers CHAT-05)
- [ ] `packages/api/src/queries/memberships.test.ts` — joinMoaByPollCode rpc-only mock 케이스 append (23-06 선례 패턴)
- [ ] 기존 3 테스트 파일의 은퇴 케이스 재작성 (poll-vote-island·guest-surface·date-polls) — 삭제 task와 동일 wave
- 프레임워크 설치 불필요 — 기존 인프라가 전 요구를 커버

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase 익명 세션(`signInAnonymously` → authenticated role) — 기존 경로 재사용, 신규 인증 로직 0 |
| V3 Session Management | yes | supabase-js 세션 (localStorage) — 무변경 |
| V4 Access Control | **yes (핵심)** | RLS deny-by-default + SECURITY DEFINER 헬퍼만 (§4.4). 신규 RPC는 join_moa 안전장치 미러: bearer 검증·self-join(auth.uid)·owner 가드·멱등·search_path 핀·grant authenticated만 |
| V5 Input Validation | yes | `TripMessageCreateSchema` (body 1~140) — UI 경계 Zod (§4.5) + DB CHECK 이중화 |
| V6 Cryptography | no | 해당 없음 (bearer 코드는 기존 gen_random_bytes 발급 — 무접촉) |

### Known Threat Patterns for Supabase RLS + bearer-code stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| bearer 스코프 확장 (poll_code→trip 전체 read) | Elevation of Privilege | 신규 RPC role 고정 'voter'(editor 아님) + slug 미노출 (Q1) — 노출 상한은 /t dates 공유와 동일. Assumptions A3 기록 |
| device_token 위조로 타 투표자 사칭 | Spoofing | 기존 해소 — cast_date_vote_authed가 auth.uid 서버파생 (T-25-02). /poll authed 전환으로 적용 범위 확대 |
| 클라이언트 trip_id 신뢰 | Tampering | RPC가 poll_code에서 trip 파생 — 클라이언트 trip_id 인자 없음 (0018 idiom) |
| 직접 EXISTS RLS 재귀 (42P17) | DoS | 신규 정책 0 — 기존 DEFINER 헬퍼만. RPC 내 조인은 DEFINER 본문이라 무관 |
| 비멤버 realtime 도청 | Information Disclosure | WALRUS가 구독자 JWT로 SELECT RLS 재평가 — 25-05 smoke로 nonmember=0 실증 |
| presence 오염 (비멤버 track) | Spoofing | join 후에만 채널 구독 (Pitfall 4) — presence 자체는 RLS 밖이므로 클라이언트 규율로 방어 |

CLAUDE.md 관련 준수: 서비스 롤 클라이언트 노출 0 (전부 anon key + RLS/DEFINER) · 마이그레이션 append-only (0032 신규 파일만) · iOS diff 0.

## Project Constraints (from CLAUDE.md)

- GSD 워크플로우 준수 — 이 phase는 discuss(완료)→plan→execute 경로
- **Karpathy 4**: §3.1 가정 명시 (Assumptions Log 참조) · §3.2 요청 범위만 (메시지 삭제 이관 안 함 — A-10) · §3.3 surgical (moa-chat/moa-island/moa-tab-bar diff 0 목표, 변경 라인 전부 D-01/02/03 직결) · §3.4 검증 가능 목표 (Validation Architecture)
- 마이그레이션: `0032_join_moa_by_poll_code.sql` 단조증가 · 기존 파일 무수정 · 변경 후 `pnpm supabase:types` → database.ts 재생성 · PR에 `BREAKING DB CHANGE` 명시(신규 RPC)
- RLS: deny-by-default · 크로스테이블은 SECURITY DEFINER 헬퍼만 · 신규 정책 0 확인
- 워크스페이스 import `.js` extension 금지 · 외부 입력 Zod validate · TypeScript strict
- **iOS 전면 동결** — `apps/ios/**` diff 0 (poll:{tripId} 채널 프로토콜도 iOS 수신 계약이라 broadcast 이벤트 형태 무변경)
- `.env.local` 커밋 금지 (이번 phase 신규 env 0)
- 커밋: Conventional Commits

## Sources

### Primary (HIGH confidence — 전부 레포 직접 판독)
- `supabase/migrations/0016_trips_baseline.sql` — can_read_trip/can_vote_trip/can_edit_trip 본문·trips visibility·memberships·votes 정책
- `supabase/migrations/0018_date_polls.sql` — date_comments·poll_code bearer 설계·anon RPC 5종
- `supabase/migrations/0025_web_share.sql` — trip_messages RLS 3정책·join_moa 본문
- `supabase/migrations/0028_chat_realtime_publication.sql` — publication·user_id 트리거
- `supabase/migrations/0029_public_trip_poll.sql` — public_trip_poll·cast_date_vote_authed (0032 미러 선례)
- `supabase/migrations/0027`·`0030`·`0031` — add_manual_place 가드·poll write hardening
- `apps/web/app/moa/[id]/_components/moa-island.tsx`·`moa-chat.tsx`·`moa-tab-bar.tsx` — 채널 소유·controlled 계약
- `apps/web/app/t/[slug]/_components/guest-surface.tsx`·`nickname-gate-sheet.tsx` — dates/both 분기·게이트 브리지
- `apps/web/app/poll/[code]/page.tsx`·`poll-vote-island.tsx`·`poll-chat.tsx` — 은퇴 대상 실측
- `apps/web/lib/poll-cache.ts`·`device-token.ts` — SSR 캐시·localStorage 계약
- `packages/api/src/queries/` chat·date-polls·memberships·votes — 래퍼 계약
- `supabase/tests/web_share_smoke.sh`·`realtime_events_smoke.mjs` — smoke 패턴·기존 실증 범위
- `.planning/phases/27-hardening-wrapup/27-HUMAN-UAT.md` — presence UAT pending 확인
- `.planning/STATE.md`·`ROADMAP.md`·`REQUIREMENTS.md` — 이력·SC·CHAT-01~03 상태

### Secondary / Tertiary
- 없음 — 내부 리팩토링으로 외부 소스 불필요. supabase-js 2.110.0 presence/postgres_changes 동작은 Phase 20/25/26 라이브·smoke 실증으로 갈음.

## Metadata

**Confidence breakdown:**
- RLS 통과 판정 (Q3/F-1): HIGH — SQL 본문 직접 판독 + editor 케이스 smoke 실증
- 0032 RPC 필요성 (Q1/F-3): HIGH — 전 마이그레이션 함수 전수 확인
- 래퍼 구조 권고 (Q2): HIGH — 대상 컴포넌트 3종 전문 판독
- presence 통일 회귀 (Q5): MEDIUM — 웹 측은 코드 판독 HIGH, iOS 카운트 영향(A2)은 추론
- /poll 투표 authed 전환 엣지 (Open Q2): MEDIUM — dedup 키 충돌은 스키마 판독 기반 추론, 라이브 미실증

**Research date:** 2026-07-14
**Valid until:** 코드베이스 변경 시까지 (내부 리팩토링 — 외부 생태계 부패 없음. guest-surface/poll-vote-island에 다른 phase가 손대면 라인 참조 재확인)
