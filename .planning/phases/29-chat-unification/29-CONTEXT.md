# Phase 29: Chat Unification (채팅 단일화) - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

분절된 대화 기능 2종을 채팅(`trip_messages`) 하나로 통일한다:
- **한마디** (`poll-chat.tsx` / `date_comments`, Phase 19) — 익명 device_token · 무이력(broadcast-only) · presence 별도 · 멘션 없음
- **채팅탭** (`moa-chat.tsx` / `trip_messages`, Phase 26) — 멤버 auth.uid · 영속 이력(RLS SELECT) · presence · 장소 멘션 답장 칩

**방향 (사용자 확정 2026-07-14, 재질문 금지):** 채팅(`trip_messages`)으로 완전 통일. 한마디 은퇴. dates 공유 게스트 + /poll 방문자에게도 통일 채팅 개방. 두 표면이 같은 저장소·채널에서 대화.

새 대화 백엔드 로직 0 — 기존 `trip_messages`/`moa:{tripId}` 채널/presence/멘션을 표면만 넓혀 재사용. 신규 마이그레이션 최소(있다면 append-only).

</domain>

<decisions>
## Implementation Decisions

### dates 공유 채팅 진입
- **D-01: dates 공유도 `both`과 동일하게 `MoaIsland`를 마운트한다.** 현재 `guest-surface.tsx:336`의 dates 분기는 `<>{pollSection}{gate}</>`만 반환해 MoaIsland(채팅탭 포함)를 안 띄운다. `both` 분기(`:351`)는 이미 join 후 `<MoaIsland {...moaSeed} hideHostControls pollSlot={날짜 정하기 섹션} />`로 poll을 pollSlot에 넣고 채팅탭이 작동한다. dates를 이 both 경로로 수렴 — poll을 pollSlot에, 장소 리스트는 빈 상태(dates엔 장소 없음). **신규 컴포넌트 0**, 채팅탭·presence·멘션 전부 무료 재사용. dates 게이트/hydrate 경로가 both과 정합하도록 조정(현재 dates는 `hydrateMember`/`joined` MoaIsland 마운트를 스킵 — `handleConfirmNickname`의 `if (shareMode !== 'dates')` 가드 제거·재설계 필요).

### 한마디 은퇴 범위
- **D-02: 한마디(poll-chat) 코드를 완전 제거한다.** 삭제/제거 대상: `apps/web/app/poll/[code]/_components/poll-chat.tsx`(파일 삭제) + `PollVoteIsland`에서 PollChat 마운트·`embedded` 분기 제거 + `packages/api/src/queries/date-polls.ts`의 `postComment`/`deleteComment` 제거(호출부 소멸 후 orphan). "한마디"라는 표면·라벨 소멸.
- **D-02a: `date_comments` 테이블·데이터는 DROP하지 않는다.** append-only 마이그레이션 규칙(CLAUDE.md §4.3 — 기존 마이그레이션 수정 금지·prod 적용분 영구) 준수. 미사용 방치(데이터는 원래 휘발성 broadcast-only·anon SELECT 경로 없음 → 사실상 폐기). DROP 마이그레이션은 별건/후속.

### 독립 /poll/[code] 페이지
- **D-03: `/poll/[code]` 라우트를 유지하되, 한마디 대신 통일 채팅(`trip_messages`)을 투표 화면에 얹는다.** 라우트 은퇴 아님 — 독립 투표 페이지로 존속시키되 대화 표면을 통일 채팅으로 교체. 사용자 의도: "유지하되 투표화면에 채팅을 넣고 싶어".
- **D-03a (함의 — research/plan에서 설계·확인):** `/poll`은 현재 익명 `device_token` 페이지인데 `trip_messages` 채팅은 멤버(`auth.uid`) 전제(RLS SELECT는 멤버만). 따라서:
  1. `/poll` 방문자도 채팅/투표 참여 시 **익명 멤버 승격** 필요 — `signInAnonymously({data:{name}})` + `joinMoa(slug)` (guest-surface `ensureGuestMember` 패턴 재사용).
  2. **`poll_code → trip slug` 해석 경로 필요** (joinMoa는 slug 인자). anon-grant 경로로 poll_code에서 trip slug/id를 얻을 수 있는지 research 확인. 불가하면 anon-grant DEFINER RPC 신설(0029 `public_trip_poll` 선례) 또는 /poll에 slug 동반.
  3. `/poll`이 통일 채팅을 마운트하려면 `moa:{tripId}` 채널+메시지 상태 소유자가 필요(moa-chat은 controlled — island이 채널 소유). /poll이 MoaIsland류 채널-소유 래퍼를 쓸지 경량 채팅-소유 컴포넌트를 쓸지 research/plan 결정.
  4. 결과적으로 `/poll`·`/t` 채팅이 동일 `trip_messages` 메커니즘으로 수렴.

### Claude's Discretion
- **presence 통일:** poll presence(`poll:{tripId}` 브로드캐스트 "보는 중")를 채팅 presence(`moa:{tripId}` "지금 N명 보는 중")로 단일화. 한마디·poll presence 소멸 후 채팅 presence가 유일 표면. Phase 27 UAT의 presence 확인(supabase-js 2.110.0)과 연결 — Phase 27 presence pass가 이 통일의 전제 신호.
- **익명 멤버 승격 게이트 시점:** 현재는 투표/찜 시 join. 통일 후 채팅 진입에도 닉네임 게이트를 태운다(guest-surface `NicknameGateSheet` + `ensureGuestMember` 재사용). 게이트 UX 세부는 재량.
- **`PollVoteIsland`의 embed 관련 prop 정리:** `embedded` prop이 한마디/poll-presence 숨김용이었으므로(guest-surface `:299-301`), 한마디 제거 후 의미가 바뀌거나 불필요해질 수 있음 — 잔여 회귀 없게 정리.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 통일 대상 백엔드 (유지·재사용)
- `apps/web/app/moa/[id]/_components/moa-chat.tsx` — 통일 채팅 프레젠테이션(controlled, island이 채널·상태 소유). 영속·presence·멘션 상위집합.
- `apps/web/app/moa/[id]/_components/moa-island.tsx` — `moa:{tripId}` 채널·메시지 상태·presence 소유. pollSlot·hideHostControls seam.
- `apps/web/app/moa/[id]/_components/moa-tab-bar.tsx` — [모으기][채팅][마이] 탭.

### dates 진입 (D-01)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` — dates/both 분기(`:280` pollSection·`:336` dates·`:345` both·`:242` handleConfirmNickname의 `shareMode !== 'dates'` 가드). 이 파일이 D-01의 주 변경 지점.
- `apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx` — 승격 게이트 UI(재사용).

### 은퇴 대상 (D-02)
- `apps/web/app/poll/[code]/_components/poll-chat.tsx` — **삭제 대상** (한마디).
- `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` — PollChat 마운트·`embedded` 분기 제거 대상.
- `packages/api/src/queries/date-polls.ts` — `postComment`(:94)·`deleteComment`(:109) 제거 대상.
- `packages/api/src/types/database.ts` — `date_comments`(:125) 타입(테이블 유지 — DROP 안 함).

### /poll 통일 채팅 (D-03)
- `apps/web/app/poll/[code]/page.tsx` — 독립 익명 투표 페이지(POLL-02, Phase 19). 통일 채팅 탑재 대상 + poll_code→slug 해석·익명 승격 설계 지점.

### 규칙·이력
- `CLAUDE.md` §4.3 (마이그레이션 append-only) · §3.3 (surgical changes) · §5 (iOS 동결)
- `.planning/ROADMAP.md` Phase 29 섹션 — Goal·Success Criteria(1~4)·Open design questions
- `.planning/phases/26-realtime-chat/` SUMMARY 계열 — trip_messages/moa 채널 구현 선례
- `.planning/phases/25-guest-unified-share/` — 익명 멤버 승격(ensureGuestMember·joinMoa) 선례

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`both` 모드 MoaIsland 마운트 경로** (guest-surface `:351`): dates에 그대로 적용 가능 — poll을 pollSlot에, 장소 빈 상태. D-01의 핵심 재사용.
- **`ensureGuestMember`** (guest-surface `:171`): `signInAnonymously` + `joinMoa` + `setStoredNickname` — /poll 익명 승격(D-03a)에 재사용.
- **`public_trip_poll` anon-grant DEFINER RPC** (0029): poll_code/slug anon 노출 선례 — poll_code→slug 해석 RPC 필요 시 미러.
- **MoaIsland의 pollSlot·hideHostControls seam**: 이미 게스트용으로 존재 — 표면 확장 시 추가 배선 최소.

### Established Patterns
- moa-chat은 **controlled** — island이 `moa:{tripId}` 채널을 pre-subscribe 체인에서 소유하고 메시지 상태를 리프트(RESEARCH Q3, moa-chat 헤더 주석). /poll에 채팅 얹으려면 채널-소유자가 필요(그냥 moa-chat만 마운트 불가).
- 익명 세션도 `auth.uid`를 가진 real user — join_moa로 멤버 승격 시 trip_messages RLS 통과(Phase 25 실증).
- 마이그레이션 append-only — DROP 대신 미사용 방치(D-02a).

### Integration Points
- `guest-surface.tsx` dates↔both 분기 통합 — hydrate/join/MoaIsland 마운트 경로.
- `poll-vote-island.tsx` — PollChat 제거 + (D-03) 통일 채팅 마운트 지점.
- `poll/[code]/page.tsx` — poll_code→trip 컨텍스트 해석.

</code_context>

<specifics>
## Specific Ideas

- 사용자 확정: "채팅으로 완전 통일"(경량 라벨정리·역방향 한마디통일 반려), dates=both처럼 MoaIsland, 한마디 코드 완전 제거, /poll 유지+통일 채팅 탑재.
- Phase 27 presence 확인(UAT 항목 5)이 이 통일의 전제 신호 — presence pass면 supabase-js 스택이 통일 채팅 presence를 지탱함이 실증됨.

</specifics>

<deferred>
## Deferred Ideas

- **`date_comments` 테이블 DROP 마이그레이션** — append-only 규칙상 이번 phase 제외. 데이터 정리가 필요하면 별도 후속.
- **`/poll` 라우트 은퇴** — 사용자가 유지+채팅 탑재를 택함(D-03). 은퇴는 반려·미채택.
- **/poll·/t 완전 통합(단일 라우트로)** — 이번엔 채팅 메커니즘만 수렴, 라우트 통합은 범위 밖.

</deferred>

---

*Phase: 29-chat-unification*
*Context gathered: 2026-07-14*
