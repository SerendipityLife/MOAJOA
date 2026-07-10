---
phase: 25-guest-unified-share
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - supabase/migrations/0029_public_trip_poll.sql
  - supabase/config.toml
  - packages/api/src/queries/date-polls.ts
  - packages/api/src/queries/places.ts
  - packages/core/src/types/index.ts
  - apps/web/app/t/[slug]/_components/guest-surface.tsx
  - apps/web/app/t/[slug]/_components/guest-promote.tsx
  - apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx
  - apps/web/app/t/[slug]/page.tsx
  - apps/web/app/poll/[code]/_components/poll-vote-island.tsx
  - apps/web/app/moa/[id]/_components/place-list.tsx
  - apps/web/app/moa/[id]/_components/moa-island.tsx
  - supabase/tests/web_share_smoke.sh
  - supabase/tests/realtime_events_smoke.mjs
  - supabase/tests/place_seq_concurrency.sh
  - supabase/tests/public_trip_poll_smoke.sh
  - apps/web/__tests__/guest-surface.test.tsx
  - apps/web/__tests__/guest-promote.test.tsx
  - apps/web/__tests__/guest-mocks.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
  resolved: [WR-01]
status: issues_found
---

# Phase 25: 코드 리뷰 리포트

**Reviewed:** 2026-07-10
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

게스트 익명-인증 통합 공유화면 기능을 표준 깊이로 리뷰했다. 보안 관점의 핵심 4종(RLS/DEFINER, 익명 인증 흐름, /poll 무회귀, XSS)은 대부분 견고하게 구현돼 있다.

강점(확인됨):
- **0029 DEFINER RLS**: 4개 함수 모두 `set search_path = public` 설정 완료. grant 분리 정확(read 2종 → `authenticated, anon`, write 2종 → `authenticated`만). 크로스테이블은 `am_trip_owner` 헬퍼 경유로 직접 EXISTS 없음. `hide_place_as_member`의 own-only 게이트 `am_trip_owner(...) OR added_by = auth.uid()` + else `raise`가 정확히 구현됨. `cast_date_vote_authed`는 `auth.uid()::text`를 device_token으로 서버파생.
- **Append-only(§4.3)**: diff 확인 결과 0029만 신규 추가, 0016~0028 무수정.
- **익명 인증 순서(Pitfall 4)**: `signInAnonymously → joinMoa → setStoredNickname` 순서 고정, `joined && moaSeed`일 때만 MoaIsland(채널 구독) 마운트. 세션 해석 전량 클라이언트(서버 컴포넌트 쿠키 미접근).
- **/poll 무회귀(D-10)**: prop 부재 시 poll-vote-island 동작이 기존과 동일(inline 게이트 유지, `getDeviceToken()` 폴백).
- **XSS**: 게스트 렌더 콘텐츠(닉네임/장소명)는 전부 React text child로 이스케이프됨. `dangerouslySetInnerHTML`/`.js` 워크스페이스 import 위반 0건.
- **linkIdentity fail-closed**: `GuestPromote`가 error 반환·throw 양 경로 모두 토스트 처리.

핵심 우려 1건: 0029가 만든 anti-spoof RPC(`cast_date_vote_authed`)가 실제 게스트 투표 경로에 배선되지 않아, 이 phase의 명시적 보안 목표(T-25-02 device_token spoof 차단)가 런타임에서 미충족이다. 아래 WR-01 참조.

## Warnings

### WR-01: anti-spoof RPC `cast_date_vote_authed`가 게스트 투표 경로에 미배선 — spoof 차단 목표 미충족 ✅ RESOLVED (commit 931c7f7)

> **해결됨:** `poll-vote-island.tsx` 투표 핸들러를 분기 — 게스트 임베드 경로(`onRequireMember` 존재)는
> `castDateVoteAuthed`(서버파생 device_token=auth.uid, 스푸핑 차단)로, 레거시 `/poll`(onRequireMember 부재)은
> 기존 `castDateVote` 유지(D-10 무회귀). guest-surface는 항상 onRequireMember를 전달하므로 첫-투표·재접속
> 게스트 전부 authed RPC 경유. 회귀 테스트(poll-vote-island.test — 게스트 경로 castDateVoteAuthed 호출·
> castDateVote 미호출·payload에 deviceToken 부재). web 5/5·tsc 0.


**File:** `apps/web/app/poll/[code]/_components/poll-vote-island.tsx:258`, `apps/web/app/t/[slug]/_components/guest-surface.tsx:68`

**Issue:**
0029는 device_token을 서버에서 `auth.uid()`로 파생해 클라이언트 위조를 차단하는 `cast_date_vote_authed`를 신설했고, 스모크(`public_trip_poll_smoke.sh`)·유닛(`date-polls.test.ts`)까지 갖췄다. 그러나 게스트 표면이 임베드하는 `PollVoteIsland`는 여전히 **레거시 `castDateVote`(0018)** 를 호출하며, 클라이언트가 넘긴 `deviceToken`(=`m.uid`)을 그대로 `p_device_token`으로 전송한다(poll-vote-island.tsx L258–265).

- `cast_date_vote`(0018)는 `to authenticated, anon` grant + `p_device_token` **신뢰**(0018 L144) — 즉 스푸핑 가능한 함수다.
- `public_trip_poll`(0029)이 slug만으로 `poll_code`를 anon에게 노출하므로, 임의의 anon이 `poll_code` + 위조 `p_device_token`/`p_nickname`으로 `cast_date_vote`를 직접 POST해 타 투표자를 사칭·덮어쓰기하거나 집계를 부풀릴 수 있다.
- 결과: DB 도구(`cast_date_vote_authed`)는 존재하지만 UI에서 호출되지 않아 사실상 **dead code**이고, 게스트 날짜투표는 스푸핑 가능한 경로로 흐른다. 이 phase가 닫으려 한 정확히 그 구멍(T-25-02)이 런타임에서 열려 있다.
- 추가로 guest-surface.tsx L68 주석은 "deviceToken=auth.uid **via cast_date_vote_authed**"라고 단언하지만 실제 호출은 `castDateVote`라 주석이 코드와 불일치한다.

pre-존재 노출(0018 cast_date_vote anon grant)의 연장선이라 Critical이 아닌 Warning으로 분류하나, phase의 명시 보안 요구가 미충족이라는 점에서 우선 처리 권장.

**Fix:**
게스트(임베드) 경로에서는 `castDateVoteAuthed`(device_token 미전송, 서버파생)를 호출하도록 분기한다. 예:
```ts
// poll-vote-island.tsx castVote 내부
if (onRequireMember) {
  // 게스트: 세션 필수 · 서버파생 device_token
  await castDateVoteAuthed(client, {
    code,
    nickname: effectiveNickname,
    optionId: voteArgs.optionId,
    voteDate: voteArgs.voteDate,
    availability,
  });
} else {
  // /poll 레거시(D-10 무회귀): 기존 device_token 경로 유지
  await castDateVote(client, {
    code, deviceToken: effectiveDeviceToken, nickname: effectiveNickname,
    optionId: voteArgs.optionId, voteDate: voteArgs.voteDate, availability,
  });
}
```
배선 후 guest-surface.tsx L68 주석이 실제 동작과 일치하게 된다. (이 분기는 D-10 무회귀도 보존한다 — prop 부재 시 여전히 `castDateVote`.)

## Info

### IN-01: `public_trip_poll` — 다중 poll 시 `limit 1` 비결정적 선택

**File:** `supabase/migrations/0029_public_trip_poll.sql:111`
**Issue:** `select * into v_poll from date_polls where trip_id = v_trip.id limit 1;` — `order by` 없이 `limit 1`이라, 한 trip에 poll이 2개 이상이면 어느 행이 반환될지 비결정적이다. 현재는 trip당 poll 1개 가정이 유지되나 불변식이 DB 제약으로 보장되지 않으면 미래에 흔들릴 수 있다.
**Fix:** 결정적 선택이 필요하면 `order by created_at limit 1` 등으로 명시(또는 trip당 poll 유일 제약이 있다면 무시 가능).

### IN-02: `unhidePlace`는 여전히 `can_edit_trip` 광역 경로 — hide own-only와 비대칭

**File:** `packages/api/src/queries/places.ts:71`
**Issue:** `hidePlace`는 0029 own-only RPC로 전환됐지만 `unhidePlace`는 raw `update places set hidden_at = null`(can_edit_trip RLS)로 남아, 게스트-에디터가 타인이 숨긴 장소를 복원할 수 있는 비대칭이 있다. 현재 게스트 UI에 unhide affordance는 없어 노출 표면은 좁다.
**Fix:** unhide가 호스트 전용 복원 의도라면 own-only/host-only RPC로 대칭화하거나, 의도적 광역 허용이면 주석으로 근거를 남긴다(§4.5 why 주석).

### IN-03: `nicknameDraft`가 게이트 재오픈 시 초기화되지 않음

**File:** `apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx:25`
**Issue:** `nicknameDraft` state가 시트 close/reopen 사이 초기화되지 않아, 이전에 타이핑한 값이 다음 오픈 때 잔존한다. 기능 버그는 아니고 경미한 UX.
**Fix:** `open` prop 변화에 맞춰 draft를 리셋(예: `useEffect(() => { if (!open) setNicknameDraft(''); }, [open])`)하거나 무시.

### IN-04: 게스트 poll presence key가 인증 후 auth.uid로 재키잉되지 않음

**File:** `apps/web/app/poll/[code]/_components/poll-vote-island.tsx:167`
**Issue:** `presenceToken = deviceToken ?? getDeviceToken()`가 채널 생성 시점(마운트)에 고정되고 realtime effect deps가 `[tripId, code]`라, 임베드에서 초기 `deviceToken`(=userId)이 아직 `undefined`면 device token으로 track되고 이후 게이트 통과로 auth.uid가 확정돼도 presence key가 갱신되지 않는다. presence 카운트에는 영향 없고 동일 사용자가 device/uid 두 key로 잡히는 이중계수 여지만 있는 경미한 사안이며, 기존 패턴을 미러한 것.
**Fix:** 필요 시 인증 확정 후 presence를 재-track(닉네임 재-track effect처럼)하거나, 임베드에서 마운트 전 uid를 확정해 전달.

---

_Reviewed: 2026-07-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
