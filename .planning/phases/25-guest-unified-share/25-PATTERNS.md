# Phase 25: Guest Unified Share (통합 공유화면) - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 11 (신규 5 · 수정 6)
**Analogs found:** 10 / 11 (1 partial — GuestSurface 조합 신규)

> 이 phase의 백엔드는 "게스트 = 익명 authenticated 멤버" 전제로 이미 설계됨. 신규 작성은
> **UI 조립(GuestSurface + 닉네임 게이트) + lazy 게이트 배선 + slug→poll 노출 RPC 1개**뿐.
> 아래는 각 신규/수정 파일이 어느 기존 파일의 어느 줄을 복사·미러할지의 진실원본.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0029_public_trip_poll.sql` | migration (DEFINER RPC) | request-response (anon read) | `0016` `public_trip_view` + `0018` `poll_view_by_code` | exact idiom |
| `apps/web/app/t/[slug]/_components/guest-surface.tsx` | component (client island 래퍼) | event-driven + request-response | `vote-island.tsx`(세션 해석) + `poll-vote-island.tsx`(닉네임 게이트·client hydration) + `moa-island.tsx`(마운트 대상) | role-match (조합 신규) |
| `apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx` | component (bottom sheet) | request-response (form) | `poll-vote-island.tsx` L321-355 (닉네임 게이트) + `@/components` BottomSheet | exact (이식) |
| `apps/web/app/t/[slug]/page.tsx` | route (SSR shell) | request-response (cached SSR) | 자기 자신 L62-131 (VoteIsland 마운트 지점) | exact (in-place 교체) |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` | component | event-driven | 자기 자신 L84-88·147·225 (deviceToken 소스) | exact (파라미터화) |
| `packages/api/src/queries/date-polls.ts` | service (RPC wrapper) | request-response | 자기 자신 L38-43 (`pollByCode`), L16-36 (`castDateVote`) | exact |
| `apps/web/lib/device-token.ts` | utility | file-I/O (localStorage) | 자기 자신 L29-39 (`getStoredNickname`/`setStoredNickname`) | exact (재사용, 신원 로직 미변경) |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` | component | event-driven | 자기 자신 (무수정 권장 — Open Q1) | reuse as-is |
| `apps/web/app/t/[slug]/_components/guest-surface.test.tsx` | test | — | `vote-island.test.tsx` + `login.test.tsx` (client mock) | exact (mock 픽스처 재사용) |
| `apps/web/app/t/[slug]/_components/guest-promote.test.tsx` | test | — | `login.test.tsx` L1-55 (`signInWithOAuth` mock) | exact |
| `supabase/tests/web_share_smoke.sh` (외 2종) | test (bash smoke) | — | 기존 하네스 (익명 세션 케이스 append) | 확장 |

---

## Pattern Assignments

### `supabase/migrations/0029_public_trip_poll.sql` (migration, anon-grant DEFINER RPC)

**Analog:** `supabase/migrations/0016_trips_baseline.sql` L689-758 (`public_trip_view`) + `supabase/migrations/0018_date_polls.sql` L147-164 (`poll_view_by_code`)

**핵심 계약:** append-only 신규 번호 파일 안에서 `create or replace function` + `security definer` + `set search_path = public` + `grant execute … to authenticated, anon`. 기존 0016~0028 **절대 수정 금지**(CLAUDE.md §4.3). slug로 poll을 노출해 비멤버 익명이 `date_polls` direct-read RLS(`can_read_trip`)를 우회하게 함.

**DEFINER RPC 시그니처 idiom** (0016 L689-695 미러):
```sql
create or replace function public_trip_poll(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip trips%rowtype;
  v_poll date_polls%rowtype;
  v_options jsonb;
begin
  select * into v_trip from trips
  where share_slug = p_slug and visibility in ('public','shared')
  limit 1;
  if not found then return null; end if;
  ...
```

**옵션 배열 집계 idiom** (0018 L154-157 `poll_view_by_code`에서 verbatim 미러 — 새 SQL 발명 금지):
```sql
select coalesce(jsonb_agg(jsonb_build_object(
  'id', o.id, 'start_date', o.start_date, 'end_date', o.end_date
) order by o.start_date), '[]'::jsonb)
into v_options from date_poll_options o where o.poll_id = v_poll.id;

return jsonb_build_object('poll_code', v_poll.poll_code, 'mode', v_poll.mode,
                          'status', v_poll.status, 'options', v_options);
```

**anon grant idiom** (0016 L758 / 0018 L164 verbatim):
```sql
grant execute on function public_trip_poll(text) to authenticated, anon;
```

**선택 동봉 (Open Q2 — spoof 차단 서버파생 래퍼):** 같은 0029 파일에 `cast_date_vote_authed`(device_token := `auth.uid()` 서버파생) 추가 검토. 기존 `cast_date_vote`(0018 L125-144)를 미러하되 `p_device_token` 인자 제거하고 본문에서 `auth.uid()::text` 사용. `/poll` 레거시는 무영향(기존 RPC 유지). 과설계 우려 시 클라 전달(`castDateVote({ deviceToken: authUid })`)로 마이그레이션 0.

**후속 필수:** `pnpm supabase:types` → `packages/api/src/types/database.ts` 재생성 후 커밋(§4.3). PR에 `BREAKING DB CHANGE` 표기(§4.6).

---

### `apps/web/app/t/[slug]/_components/guest-surface.tsx` (component, client island 래퍼)

**Analog (조합):** `vote-island.tsx`(세션 해석 lifecycle) + `poll-vote-island.tsx`(닉네임 게이트·client-only hydration) + `moa-island.tsx`(join 후 마운트 대상)

이 파일이 이 phase의 뼈대. 세 analog의 검증된 조각을 조립한다 — 신규 realtime/채팅/색 로직 **작성 금지**(재사용이 D-08·SC4를 공짜로 줌).

**1) `'use client'` + 세션 해석 lifecycle** — `vote-island.tsx` L106-137 미러(**클라이언트에서만** `getUser`, 서버 컴포넌트 cookies() 금지 = 캐시 무독성):
```typescript
// vote-island.tsx L116-132 template
let active = true;
(async () => {
  const client = getSupabaseBrowser();
  const { data } = await client.auth.getUser();
  if (!active) return;
  const uid = data.user?.id ?? null;
  setUserId(uid);
  if (uid) {
    const role = await getMyTripRole(client, tripId, uid).catch(() => null);
    if (!active) return;
    if (role) setJoined(true);   // D-05 재접속: 멤버면 게이트 스킵
  }
  ...
})();
return () => { active = false; };
```
게스트 특이점: 멤버(`role != null`)면 곧장 `MoaIsland`를 실 데이터로 마운트. 비멤버면 SSR seed 기반 read-only 뷰(place-list props-only + `vote_counts_for_places`/`poll_vote_tally` anon RPC)만.

**2) Lazy 익명 게이트** — RESEARCH Pattern 1 (`ensureGuestMember`). 첫 참여 액션 핸들러 진입부에서만. 순서 = `signInAnonymously` → `join_moa` → `setStoredNickname` → 원래 액션 재개:
```typescript
async function ensureGuestMember(client, slug, nickname: string): Promise<string> {
  const { data: { user } } = await client.auth.getUser();
  let uid = user?.id ?? null;
  if (!uid) {
    const { data, error } = await client.auth.signInAnonymously({
      options: { data: { name: nickname } },   // → raw_user_meta_data.name → handle_new_auth_user 트리거 → profiles.display_name
    });
    if (error) throw error;
    uid = data.user!.id;
  }
  await joinMoa(client, slug);   // memberships.ts L24-31 — 0025 DEFINER, role=share_mode
  setStoredNickname(nickname);   // device-token.ts L36 — D-05 재접속 게이트 스킵
  return uid;
}
```
**Pitfall 4 주의:** `signInAnonymously`→`SIGNED_IN`→소켓 토큰 갱신 완료 후(=`join_moa` 완료 후)에만 채널 구독. 비멤버 구독은 RLS로 무음 0건.

**3) join 후 MoaIsland 마운트** — `moa/[id]/page.tsx` L36-67의 seed 로딩을 클라이언트에서 재현(join 완료 후 direct-read가 이제 통과). props 계약은 `moa-island.tsx` L30-42 `MoaIslandProps` 그대로:
```typescript
// moa/[id]/page.tsx L36-53 seed 패턴을 client에서 재현
const [places, links, members, initialMessages] = await Promise.all([
  listPlacesByTrip(client, tripId), listLinksByTrip(client, tripId),
  listTripMembers(client, tripId), listTripMessages(client, tripId),
]);
const [counts, myVotedPlaceIds] = await Promise.all([
  getVoteCounts(client, placeIds),
  getMyVotedPlaceIds(client, placeIds, uid),
]);
const nameIds = [...new Set([...places.map((p) => p.added_by), trip.owner_id, uid])];
const profileNames = await getProfileNames(client, nameIds);   // Pitfall 6: display_name 소스
```
→ `<MoaIsland currentUserId={uid} currentUserNickname={profileNames[uid] ?? nickname} … />` (Open Q1 권장: MoaIsland 무수정, read-only→join→full island 스왑).

**4) share_mode 분기** (D-09, UI-SPEC C2) — SSR seed의 `share_mode`로 레이아웃 결정:
- `places` → MoaIsland 재사용(`[모으기][채팅]` 탭 + FAB)
- `dates` → `<PollVoteIsland>` 임베드 전면 + 채팅
- `both` → `[모으기]` 탭 상단 poll 섹션 + 아래 장소 리스트

**테스트 seam 규약:** `vote-island.tsx` L30-35 / `poll-vote-island.tsx` L47-53 처럼 `initialJoined`/`initialNickname` 등 prop seam으로 네트워크 하이드레이션 스킵 가능하게(테스트가 client mock 없이 렌더).

**에러 처리:** optimistic + rollback + `useToast` — `vote-island.tsx` L182-196 verbatim. 카피는 UI-SPEC Copywriting Contract 준수(`투표를 저장하지 못했어요.` 등).

---

### `apps/web/app/t/[slug]/_components/nickname-gate-sheet.tsx` (component, bottom sheet)

**Analog:** `poll-vote-island.tsx` L321-355 (닉네임 게이트 입력+CTA) + `@/components` BottomSheet

poll의 inline-card 게이트를 **BottomSheet로 승격**(UI-SPEC C1, OQ-1). 입력·CTA·확정 로직은 verbatim 이식.

**입력 + 확정 idiom** (`poll-vote-island.tsx` L198-206 `confirmNickname` + L333-351):
```typescript
function confirmNickname() {
  const trimmed = nicknameDraft.trim();
  if (!trimmed) {
    toast('닉네임을 정해야 참여할 수 있어요.', { variant: 'error' });  // UI-SPEC 카피로 조정
    return;
  }
  setNickname(trimmed);
  setStoredNickname(trimmed);
}
```
```tsx
<input
  type="text" value={nicknameDraft}
  onChange={(e) => setNicknameDraft(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter') confirmNickname(); }}
  placeholder="닉네임" maxLength={20}
  className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300"
/>
<button type="button" onClick={confirmNickname}
  className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
  시작하기
</button>
```

**카피 (UI-SPEC C1 · Copywriting Contract 확정값 — poll verbatim 아님):**
- heading: `닉네임을 정해주세요`
- body: `이 이름으로 담고 투표한 게 표시돼요.`
- placeholder: `닉네임` (maxLength 20)
- 에러: `닉네임을 정해야 참여할 수 있어요.`
- CTA: `시작하기`

**BottomSheet 껍데기:** `@/components` BottomSheet (white bg, `rounded-t-3xl`, 핸들 `h-1.5 w-10` — UI-SPEC Spacing). 다른 시트(add-sheet/share-sheet) 시각 일관. 신규 hex/spacing 금지 — 토큰 클래스만.

---

### `apps/web/app/t/[slug]/page.tsx` (route, SSR shell — MODIFIED)

**Analog:** 자기 자신 L62-131

**최소 수술(surgical, §3.3):** L124-131의 `<VoteIsland …>` 마운트를 `<GuestSurface …>`로 교체. SSR 셸(브랜드 한 줄 L79-85 · 초대 카드 L98-111 · 출처 섹션 L133-180)·`generateMetadata`·`getCachedPublicTrip`는 **전부 유지**. `cookies()`/auth **절대 호출 X**(Pitfall 2 — 캐시 무독성).

**교체 지점** (현재 L124-131):
```tsx
{view.board.id && (
  <VoteIsland slug={slug} tripId={view.board.id} places={view.places} links={view.links} />
)}
```
→ GuestSurface는 seed props(`view.board`/`places`/`links` + `share_mode`)를 받아 세션 lifecycle·게이트·share_mode 분기를 소유. 초대 카드는 게스트 화면 최상단 컨텍스트로 유지(UI-SPEC C3, OQ-2 — 배치는 planner 재량).

**주의:** SSR `<h1>` weight 700(L88) → 600 정렬은 UI-SPEC 권장(호스트 일관), 확정 아니면 pre-existing 예외로 유지.

---

### `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` (component — MODIFIED)

**Analog:** 자기 자신 L84-88 (Props) · L147 · L225 (`getDeviceToken()` 직접 호출)

**최소 파라미터화(Open Q3):** `/t` 임베드가 익명 `auth.uid`를 deviceToken 자리에 주입하도록 **optional prop** 추가. 없으면 기존 `getDeviceToken()` 사용 → `/poll` 레거시 **무회귀**(D-10).

**현재 직접 호출 2곳** (prop fallback으로 감쌀 지점):
```typescript
// L147 (channel presence key)
const deviceToken = getDeviceToken();
// L225 (castDateVote 인자)
await castDateVote(client, { code, deviceToken: getDeviceToken(), nickname, ... });
```
→ `deviceToken ?? getDeviceToken()` · `nickname ?? getStoredNickname()` 형태의 optional prop 주입. Props 인터페이스(L41-53)에 `deviceToken?`/`nickname?` seam 추가 — 기존 test seam(`initialNickname`) 스타일과 동형.

**시각·집계·투표 로직 무변경** — 가능/불가 버튼·진행바·최다 배지는 verbatim(UI-SPEC C2 "poll-vote-island verbatim").

---

### `packages/api/src/queries/date-polls.ts` (service, RPC wrapper — MODIFIED)

**Analog:** 자기 자신 L38-43 (`pollByCode`) · L16-36 (`castDateVote`)

**추가할 wrapper** (`pollByCode` L38-43 house contract 미러 — client-first arg, `{ data, error } throw`, RLS-only):
```typescript
/** Read slug→poll (poll_code/mode/status/options) via anon-grant DEFINER RPC (0029). */
export async function getPublicTripPoll(client: MoajoaSupabaseClient, slug: string): Promise<unknown> {
  const { data, error } = await client.rpc('public_trip_poll', { p_slug: slug });
  if (error) throw error;
  return data;
}
```

**`castDateVote`(L16-36)는 수정 불필요** — 이미 `deviceToken` 파라미터를 받으므로 호출부가 `auth.uid`를 넘기면 됨(마이그레이션 0). Open Q2에서 서버파생 래퍼(`cast_date_vote_authed`) 채택 시에만 신규 wrapper 추가.

**후속:** 0029 추가 후 `pnpm supabase:types` 재생성해야 `client.rpc('public_trip_poll')` 타입 통과.

---

### `apps/web/lib/device-token.ts` (utility — 재사용, 신원 로직 미변경)

**Analog:** 자기 자신 L29-39 (`getStoredNickname`/`setStoredNickname`)

**변경 없음 권장(§3.2·§3.3):** `/t`는 `getStoredNickname`(L30)/`setStoredNickname`(L36)만 소비(닉네임 로컬 지속 = D-05 게이트 스킵 힌트). `getDeviceToken`(L16-24, localStorage UUID)은 **`/t`에서 미사용** — 신원은 `auth.uid`(D-01). `/poll` 레거시는 계속 `getDeviceToken` 사용하므로 이 파일은 건드리지 않는다. 재접속 판정은 저장 닉네임이 아니라 `client.auth.getUser()` + `getMyTripRole`로(Pitfall 3).

---

### `apps/web/app/moa/[id]/_components/moa-island.tsx` (component — 무수정 권장)

**Analog:** 자기 자신 L30-42 (`MoaIslandProps`) · L158-195 (단일 채널 realtime)

**Open Q1 권장 = 무수정(가장 surgical).** GuestSurface가 join 완료까지 read-only를 렌더하다 join 후 MoaIsland를 **실 데이터로 마운트**. MoaIsland는 이미 props-driven(`currentUserId`·seed 데이터)이라 게스트 uid를 넘기면 그대로 동작. 단일 `moa:{tripId}` 채널(L160-190)·순번(seq_no 서버 채번)·색(`memberColor` L109)·채팅이 전부 재사용됨 → SC4 자동 충족.

**절대 하지 말 것:** 게스트용 별도 채널/island 신규 작성(Anti-Pattern "한 토픽 채널 2개 금지"). 탭 전환은 hidden 토글(L278·L362-366), 언마운트 X.

---

### `apps/web/app/t/[slug]/_components/guest-surface.test.tsx` + `guest-promote.test.tsx` (test)

**Analog:** `apps/web/__tests__/login.test.tsx` L1-43 (client mock 픽스처) + `vote-island.test.tsx` L27-50 (mutable 세션 mock)

**공유 Supabase client mock 픽스처** (`vote-island.test.tsx` L27-34 verbatim — `auth.getUser` mutable 세션):
```typescript
let mockUser: { id: string } | null = null;
const authGetUser = vi.fn(async () => ({ data: { user: mockUser } }));
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getUser: authGetUser } }),
}));
```
→ 확장: `signInAnonymously`·`linkIdentity` mock 추가. `guest-promote.test.tsx`는 `login.test.tsx` L5-9의 `signInWithOAuth` mock 패턴을 `linkIdentity({ provider: 'kakao' })`로 미러(D-03 진입점 1회 호출 검증).

**@moajoa/api query mock** (`vote-island.test.tsx` L36-50 스타일): `joinMoa`·`castDateVote`·`listPlacesByTrip` 등 vi.fn 목킹. Import AFTER mocks(login.test.tsx L31-32 규율).

**커버리지:** SHARE-02(share_mode 분기) · SHARE-03(lazy 게이트 순서) · AUTH-08(재접속 게이트 스킵) · D-03(linkIdentity 1회).

---

## Shared Patterns

### 클라이언트 전용 세션 해석 (캐시 무독성)
**Source:** `apps/web/app/t/[slug]/_components/vote-island.tsx` L106-137 · `apps/web/lib/public-trip-cache.ts` L31-51
**Apply to:** GuestSurface (전 모드)
서버 컴포넌트에서 `cookies()`/`auth.getUser()` **절대 호출 X**. `getCachedPublicTrip`는 `unstable_cache` 안에서 쿠키리스 `createClient`(public-trip-cache.ts L41). 세션 해석·게이트는 전부 client island에서(Pitfall 2).

### 익명 세션 발급 (AUTH-08)
**Source:** RESEARCH Pattern 1 + supabase-js `signInAnonymously` (레포 2.110.0)
**Apply to:** GuestSurface `ensureGuestMember`
```typescript
await client.auth.signInAnonymously({ options: { data: { name: nickname } } });
// → raw_user_meta_data.name → handle_new_auth_user 트리거(0016 L78) → profiles.display_name
```

### 멤버십 부여 (직접 INSERT 금지)
**Source:** `packages/api/src/queries/memberships.ts` L24-31 (`joinMoa`)
**Apply to:** GuestSurface 게이트
`joinMoa(client, slug)` — 0025 SECURITY DEFINER, role=share_mode 서버결정(places/both→editor, dates→voter), idempotent, self-join(auth.uid). 클라이언트 memberships 직접 INSERT는 RLS로 막힘.

### 게스트 색 배정 (D-07)
**Source:** `apps/web/lib/member-color.ts` L8-16 (`memberColor`)
**Apply to:** GuestSurface·MoaIsland(재사용)·순번 배지·핀·"닉네임님이 담음"
```typescript
memberColor(userId, ownerId, memberIdsInJoinOrder)  // 호스트=brand[500], 게스트=member 6색 순환
```
`listTripMembers`(memberships.ts L70-82, created_at asc) + `memberColor()`. 사용자 문자열 색 보간 금지 — 토큰값만.

### 낙관적 찜 + rollback + toast
**Source:** `apps/web/app/t/[slug]/_components/vote-island.tsx` L182-196 (= `moa-island.tsx` L204-217 동일 template)
**Apply to:** GuestSurface·PollVoteIsland 투표 핸들러
optimistic set → RPC → catch에서 rollback + `toast(…, { variant: 'error' })`. 카피는 UI-SPEC Copywriting Contract.

### anon-grant DEFINER RPC (append-only)
**Source:** `0016` L689-758 · `0018` L124-197
**Apply to:** 0029 migration
`create or replace function … security definer set search_path = public` + `grant execute … to authenticated, anon`. 기존 마이그레이션 수정 절대 금지. 크로스테이블은 DEFINER 헬퍼 경유(직접 EXISTS 금지 §4.4).

### 계정 승격 진입점 (D-03, 최소 심)
**Source:** `apps/web/app/login/page.tsx` L105-115 (`oauth('kakao')`) — `signInWithOAuth`를 `linkIdentity`로 미러
**Apply to:** C6 진입점 (`로그인하고 내 여행에 담기`)
```typescript
await supabase.auth.linkIdentity({ provider: 'kakao' });  // 익명 uid 보존 → 이력 유지
```
전제: 프로젝트 Auth **Manual linking 활성화**(A1 — human-action, config.toml 키 없음). 진입점만, 충돌 처리 deferred.

---

## No Analog Found

없음. 모든 신규 파일이 기존 검증된 analog의 조각을 재사용/미러함. GuestSurface만 "조합 신규"(단일 analog 없음 — vote-island 세션 lifecycle + poll-vote-island 게이트 + moa-island 마운트의 조립).

---

## Human-Action / Env Gates (planner가 태스크로 명시)

| Gate | 근거 | Action |
|------|------|--------|
| Supabase **Manual linking** 활성화 | RESEARCH A1 · Env Availability | `config.toml [auth] enable_manual_linking = true` + 원격 대시보드 토글. 미활성 시 linkIdentity 런타임 에러 |
| 0029 migration 배포 | RESEARCH Runtime Inventory | `supabase db push`(colima 필요 — MEMORY) → `pnpm supabase:types` 재생성·커밋 |
| Anonymous sign-ins | config.toml L48 ✓ ON (23-07 실증) | 이미 활성 — 확인만 |

---

## Metadata

**Analog search scope:** `apps/web/app/t/[slug]`, `apps/web/app/poll/[code]/_components`, `apps/web/app/moa/[id]`, `apps/web/app/login`, `apps/web/lib`, `apps/web/__tests__`, `packages/api/src/queries`, `supabase/migrations/{0016,0018,0025}`
**Files scanned:** 15 (analog 10 직접 read + 5 grep 확인)
**Pattern extraction date:** 2026-07-10
