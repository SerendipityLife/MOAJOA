---
phase: 25-guest-unified-share
reviewed: 2026-07-10T16:25:36Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - apps/web/app/layout.tsx
  - apps/web/app/moa/[id]/_components/moa-island.tsx
  - apps/web/app/moa/[id]/_components/share-sheet.tsx
  - apps/web/app/t/[slug]/_components/guest-surface.tsx
  - packages/api/src/queries/date-polls.ts
  - packages/api/src/queries/date-polls.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  resolved: [CR-01, WR-01]
status: issues_found
---

# Phase 25: Code Review Report — Gap Closure (25-06/25-07)

**Reviewed:** 2026-07-10T16:25:36Z
**Depth:** standard
**Files Reviewed:** 6 (diff base `7adadae..HEAD`)
**Status:** issues_found

## Summary

Gap-closure diff(25-06 TP 제거·FAB·hideHostControls + 25-07 createDatePoll·후보 날짜 step·pollSlot)를 리뷰했다. 프론트엔드 배선 자체는 견고하다:

- **호스트 /moa 무회귀:** `hideHostControls`·`pollSlot` 둘 다 optional prop이며 미전달 시 렌더 diff 0 (moa-island.tsx:303, :322). 기존 채널·reconcile·optimistic 경로 무변경. Test 18(호스트 [함께 정하기] 노출)·Test G(places pollSlot 미전달)로 회귀 커버.
- **FAB:** `bottom-[calc(30vh+16px)]`는 place-sheet collapsed peek(`window.innerHeight * 0.3`, place-sheet.tsx:42)과 정합. expanded/add/share 열림 시 숨김도 테스트 커버(Test 6/7/16/17).
- **D-17/D-18 보존:** `visibleModes` dates 카드 필터(share-sheet.tsx:78) 및 클립보드 복사 우선(share-sheet.tsx:86)이 모드 분기보다 앞서 실행 — 테스트로 커버.
- **/poll 레거시(D-10) 무회귀:** `castDateVote`/`pollByCode`/poll 페이지 미변경. `createDatePoll`은 순수 추가.
- **TP 잔존:** 소스에서 emrldco 스크립트·`next/script` import 완전 제거. `apps/ios`·`packages/core`의 travelpayouts 참조는 Phase 20 인앱 딥링크(별도 시스템, 동결 중)로 이번 제거 대상 아님.
- **`.js` extension import 위반:** 없음.

그러나 **RLS 권한 경계에서 Critical 1건** — 이 diff가 처음으로 "editor 롤 게스트 + date_poll 공존" 상태를 만들면서, 게스트가 poll을 직접 생성·변조·삭제(투표 캐스케이드 소멸 포함)할 수 있는 권한 갭이 활성화된다.

## Critical Issues

### CR-01: 'both'/'places' 익명 게스트(editor)가 date_polls·date_poll_options를 직접 쓰기·삭제 가능 — 투표 데이터 캐스케이드 소멸 위험 ✅ RESOLVED (commit 6dd8a95)

> **해결됨:** 마이그레이션 0030이 `date_polls_write`/`date_poll_options_write`를 `can_edit_trip` →
> **`am_trip_owner`**로 교체 (D-12와 동일 정책: 호스트=모더레이션). 게스트 투표는 DEFINER RPC 경유라 무영향.
> 로컬 reset 0016→0030 클린, pg_policies로 am_trip_owner 게이트 확인. date-polls.ts docstring 동기화.


**File:** `packages/api/src/queries/date-polls.ts:182-204` (활성화 지점), 근거: `supabase/migrations/0018_date_polls.sql:100-108` + `supabase/migrations/0025_web_share.sql:89-93`

**Issue:**
`createDatePoll`이 의존하는 `date_polls_write` RLS는 `can_edit_trip(trip_id)` — owner **또는 role in ('owner','editor')** 멤버를 허용한다(0016:313-334). 그런데 `join_moa`(0025 D-A1)는 `share_mode in ('places','both')` 트립에 참여하는 게스트에게 **'editor'** 롤을 부여한다. 즉 공유 링크만 가진 익명 게스트가 닉네임 입력 후:

1. `date_polls` **INSERT** — 트립에 poll 추가 생성 (WR-01의 중복 poll과 결합)
2. `date_polls` **UPDATE** — mode flip(range↔grid, 진행 중 투표 좌초)·status 조작(closed poll 재오픈 = anon 투표 게이트 우회)
3. `date_polls` **DELETE** — `for all` 정책이라 DELETE도 허용. options→votes→comments가 전부 `on delete cascade`(0018:24, :34, :37, :48)로 **호스트의 poll과 게스트 전원의 투표가 복구 불가 소멸**
4. `date_poll_options` **DELETE** — 개별 후보 삭제 시 해당 option의 votes 캐스케이드 소멸

UI는 게이트되어 있지만(`hideHostControls`가 [함께 정하기] 숨김, `shareMoa`의 trips UPDATE는 owner-only RLS로 조기 실패) RLS가 보안 경계다(CLAUDE.md §4.4 deny-by-default 의도). anon key + 게스트 본인 JWT로 테이블 직접 호출이 가능하다.

이 갭은 0018+0025 조합에 잠재해 있었지만, **Phase 25 이전에는 poll이 'dates' 공유 트립(joiner=voter, can_edit_trip=false)에만 존재**했다. 이 diff의 both-flow(share-sheet가 기존 트립에 poll 생성 + 게스트가 editor로 join)가 처음으로 취약 조합을 실제 발생시킨다.

부수: date-polls.ts:10-12 주석("host-only date_polls update")과 addPollOption/removePollOption/setPollMode docstring의 "owner-gated" 표기가 실제 정책(owner+editor)과 불일치 — 이 오기가 리뷰·설계에서 갭을 가려왔다.

**Fix:** 새 마이그레이션(append-only)으로 write 정책을 owner-only로 교체. 호스트 플로우(share-sheet·iOS plan 탭)는 전부 owner가 수행하므로 기능 영향 없음:

```sql
-- 00XX_date_polls_owner_write.sql
drop policy date_polls_write on date_polls;
create policy date_polls_write on date_polls for all to authenticated
  using (am_trip_owner(trip_id)) with check (am_trip_owner(trip_id));

drop policy date_poll_options_write on date_poll_options;
create policy date_poll_options_write on date_poll_options for all to authenticated
  using (exists (select 1 from date_polls p where p.id = date_poll_options.poll_id and am_trip_owner(p.trip_id)))
  with check (exists (select 1 from date_polls p where p.id = date_poll_options.poll_id and am_trip_owner(p.trip_id)));
```

동시에 date-polls.ts:10-12 및 각 docstring의 "host-only"/"owner-gated" 표기를 실제 정책과 일치시킬 것.

## Warnings

### WR-01: `date_polls.trip_id` 유니크 제약 없음 + handleShare in-flight 가드 없음 → 중복 poll 생성 시 `getPollByTrip.maybeSingle()`이 영구 실패 ✅ RESOLVED (commit 6dd8a95)

> **해결됨:** 0030에 중복 정리(delete keep-oldest) + `date_polls_trip_id_key` unique 인덱스,
> share-sheet에 `sharing` in-flight 가드(버튼 disabled). api 106·web 165 그린.


**File:** `apps/web/app/moa/[id]/_components/share-sheet.tsx:80-119, 175` / `packages/api/src/queries/date-polls.ts:160-164, 192-197`

**Issue:**
`date_polls.trip_id`는 일반 인덱스만 있고 unique가 아니다(0018:20). 멱등 처리(`existing ?? createDatePoll`)는 정상 경로에서 재공유 중복을 막지만(테스트 커버), 레이스에 뚫린다:

- [링크 복사하기] 버튼(share-sheet.tsx:175)은 async 진행 중 disabled 되지 않음 — 모바일 더블탭 시 `handleShare` 2회 진입 → 둘 다 `getPollByTrip` null 관측 → `createDatePoll` 2회 → **poll 2행**
- 멀티 디바이스 동시 공유도 동일

poll이 2행이 되면 `getPollByTrip`의 `.maybeSingle()`이 이후 **항상 에러**(PostgREST multi-row) — 웹 share-sheet의 dates/both 재공유와 iOS plan 탭(`apps/ios/app/trip/[id]/(tabs)/plan.tsx:293`) 둘 다 영구적으로 깨진다. 또한 `getPublicTripPoll`(0029)이 어느 poll을 반환하느냐에 따라 게스트 투표가 갈라질 수 있다.

**Fix:** 이중 방어 —

```tsx
// share-sheet.tsx: in-flight 가드
const [sharing, setSharing] = useState(false);
async function handleShare() {
  if (!selected || sharing) return;
  setSharing(true);
  try { /* 기존 본문 */ } finally { setSharing(false); }
}
// ...
<Button className="w-full" disabled={!selected || sharing} onClick={() => void handleShare()}>
```

```sql
-- 새 마이그레이션 (DB-level 불변식 — 트립당 poll 1개)
create unique index date_polls_trip_id_uniq on date_polls (trip_id);
```

(라이브 DB에 이미 중복 poll이 있으면 인덱스 생성 전 정리 필요. 현재 라이브 배포 게이트 상태라 지금이 적기.)

## Info

### IN-01: 스테일 `.next` 빌드 아티팩트에 Travelpayouts 스크립트 잔존

**File:** `apps/web/.next/server/app/*.html` (generated)
**Issue:** 소스(layout.tsx)에서는 emrldco.com 스크립트가 완전 제거됐으나, 로컬 `.next` 산출물에는 `<link rel="preload" href="https://emrldco.com/...">`가 남아 있다. 소스 문제는 아니고 재빌드로 사라지지만, Gap 2(클릭 하이재킹) 검증을 로컬 빌드로 할 경우 오판 여지가 있다.
**Fix:** 라이브 검증 전 `pnpm build` 재실행(배포 시 자동 해소). 별도 코드 변경 불필요.

### IN-02: GuestSurface `links` prop 선언·전달되나 미사용 (pre-existing)

**File:** `apps/web/app/t/[slug]/_components/guest-surface.tsx:42, 70-79`
**Issue:** `GuestSurfaceProps.links`가 선언되고 테스트에서도 전달되지만 컴포넌트에서 destructure되지 않음(hydrateMember가 `listLinksByTrip`으로 자체 fetch). 이번 diff가 만든 것은 아니므로 언급만 — surgical 원칙상 별도 정리 커밋으로 처리 권장.
**Fix:** (별도 작업) prop 제거 또는 read-only 뷰에서 활용.

---

_Reviewed: 2026-07-10T16:25:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
