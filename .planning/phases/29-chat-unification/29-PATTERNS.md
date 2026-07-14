# Phase 29: Chat Unification (채팅 단일화) - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 12 (create 3 · modify 8 · delete 1)
**Analogs found:** 12 / 12 — 전 파일이 레포 내 검증된 analog 보유 (신규 발명 0)

> 이 phase의 특성: 모든 빌딩블록이 이미 존재한다. 신규 파일 2개(래퍼 island + 0032 마이그레이션)조차 기존 코드의 미러/합성이다. 아래 excerpt는 전부 **현재 HEAD 기준 실측 라인 번호**.

## File Classification

| New/Modified File | Op | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|-----|------|-----------|----------------|---------------|
| `apps/web/app/t/[slug]/_components/guest-surface.tsx` | MODIFY | client island (게스트 표면 허브) | request-response + realtime | **자기 자신의 `both` 분기** (:345-378) | exact (self-analog) |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` | MODIFY (제거 위주) | client island (투표) | broadcast realtime | 자기 자신 (제거 지도) | exact |
| `apps/web/app/poll/[code]/page.tsx` | MODIFY | RSC page (SSR 셸) | request-response (cached SSR) | 자기 자신 (:81-87 island 마운트 idiom) | exact |
| `apps/web/app/poll/[code]/_components/poll-guest-island.tsx` (이름 plan 재량) | **CREATE** | client island (게이트 + 채널 소유) | event-driven (postgres_changes + presence) + CRUD | `guest-surface.tsx` (게이트) + `moa-island.tsx` (채널) 합성 | exact composite |
| `apps/web/app/poll/[code]/_components/poll-chat.tsx` | DELETE | — | — | — | — |
| `packages/api/src/queries/date-polls.ts` | MODIFY (제거) | API typed query | RPC request-response | 자기 자신 (:94-118 제거 대상) | exact |
| `packages/api/src/queries/memberships.ts` | MODIFY (append) | API typed query | RPC request-response | 같은 파일 `joinMoa` (:24-31) | exact |
| `supabase/migrations/0032_join_moa_by_poll_code.sql` | **CREATE** | migration (DEFINER RPC) | DDL / RPC | `0025_web_share.sql` `join_moa` (:64-99) + `0029` grant idiom | exact |
| `apps/web/__tests__/poll-guest-island.test.tsx` | **CREATE** | test | — | `apps/web/__tests__/moa-island.test.tsx` 채널 스텁 (:5-37) | exact |
| `packages/api/src/queries/memberships.test.ts` | MODIFY (append) | test | — | 같은 파일 `makeRpcClient` (:13-35) | exact |
| `apps/web/__tests__/guest-surface.test.tsx` · `poll-vote-island.test.tsx` · `packages/api/src/queries/date-polls.test.ts` | MODIFY (은퇴 케이스 재작성) | test | — | 자기 자신 (RESEARCH 은퇴 지도 라인 참조) | exact |
| `supabase/tests/web_share_smoke.sh` | MODIFY (append) | smoke test | HTTP/psql probe | 같은 파일 섹션 (6) (:64-127) | exact |

**절대 무수정 (회귀 앵커):** `moa-chat.tsx` · `moa-island.tsx`(F-2 optional prop 예외는 plan 결정) · `moa-tab-bar.tsx` · `nickname-gate-sheet.tsx` · `apps/ios/**`

---

## Pattern Assignments

### 1. `guest-surface.tsx` — dates→both 수렴 (D-01)

**Analog:** 자기 자신의 `both` 분기. 변경은 가드 2곳 제거 + dates 분기 재작성 + embedded 라인 제거.

**제거할 가드 1** — 세션 effect (guest-surface.tsx:112-118):
```typescript
const stored = getStoredNickname();
if (stored) setNickname(stored);
if (shareMode !== 'dates') {          // ← 이 가드 제거 — dates 재방문 멤버도 hydrate
  await hydrateMember(uid, stored);
  if (!active) return;
}
setJoined(true);
```

**제거할 가드 2** — handleConfirmNickname (guest-surface.tsx:248):
```typescript
if (shareMode !== 'dates') await hydrateMember(uid, nick);  // ← 가드 제거
setJoined(true);
gateResolve.current?.({ uid, nickname: nick });
```
순서 불변: `hydrateMember` 완료 → `setJoined(true)` → `gateResolve` (RESEARCH Q4-2 — 순서 바꾸면 게이트 resolve와 MoaIsland 마운트 경합).

**제거할 라인** — embedded prop 전달 (guest-surface.tsx:299-301, 주석에 "한마디" 포함 — HC-7 grep 앵커라 주석도 재서술):
```typescript
// both: 모아 [채팅] 탭·presence가 있으므로 poll 자체 한마디·보는중은 중복 → 숨김.
// dates: poll이 화면 전부라 한마디·presence가 유일한 소셜 표면 → 유지.
embedded={shareMode === 'both'}
```

**dates 분기가 미러할 both 분기 원형** (guest-surface.tsx:345-378 — 이것이 복사 대상):
```tsx
if (shareMode === 'both') {
  return (
    <>
      {joined && moaSeed ? (
        <MoaIsland
          {...moaSeed}
          hideHostControls
          pollSlot={
            pollMeta != null ? (
              <section>
                <h3 className="text-sm font-semibold text-neutral-700">날짜 정하기</h3>
                {pollSection}
              </section>
            ) : undefined
          }
        />
      ) : (
        <>{/* 비join: sibling 렌더 — dates는 현행 유지(A-2): pollSection + gate만 */}</>
      )}
      {gate}
    </>
  );
}
```
현재 dates 분기 (:336-343)는 `<>{pollSection}{gate}</>`만 — joined && moaSeed 시 MoaIsland 경로를 both과 동일하게 추가. **pollSection을 pollSlot과 sibling 양쪽에 동시 렌더 금지** (Pitfall 8 — 같은 `poll:{tripId}` topic 2채널 = 배달 탈취).

**Imports pattern** (guest-surface.tsx:1-24 — 워크스페이스 import에 `.js` extension 없음, `@moajoa/api` barrel):
```typescript
import { getMyTripRole, getVoteCounts, joinMoa, listTripMessages, /* … */ } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { getStoredNickname, setStoredNickname } from '@/lib/device-token';
import { MoaIsland, type MoaIslandProps } from '@/app/moa/[id]/_components/moa-island';
```

---

### 2. `poll-vote-island.tsx` — PollChat·presence·embedded 제거 (D-02 + 재량 3)

**Analog:** 자기 자신 — 제거 지도 (실측 라인, RESEARCH Q5 표와 대조 확인됨):

| 제거 대상 | 실측 라인 | 비고 |
|-----------|-----------|------|
| `import { PollChat } from './poll-chat'` | :14 | |
| `embedded?: boolean` prop 선언 + JSDoc(주석에 "한마디") | :68-73 | destructure :108도 |
| `viewers` state | :121 | |
| `sharedChannel` state + JSDoc | :126-133 | PollChat 전달용 — orphan |
| stored-nickname hydrate effect | :137-141 | **Pitfall 1 봉합 지점** (아래) |
| presence config + `setSharedChannel(channel)` | :174-179 | `channelRef.current = channel`(:178)은 **유지** — vote broadcast `.send()`(:286-290)용 |
| presence sync 바인딩 | :186-188 | broadcast 'vote' 바인딩(:182-185)은 **유지** — iOS 수신 계약 |
| SUBSCRIBED 시 `channel.track(...)` | :189-193 | subscribe 자체는 유지 |
| cleanup의 `setSharedChannel(null)` | :197 | |
| nickname 재-track effect | :204-208 | |
| closed 분기 PollChat 마운트 | :371-373 | `{!embedded && <PollChat …/>}` |
| presence 스트립 렌더 + 주석 | :422-429 | `{!embedded && viewers > 0 && …}` |
| open 분기 PollChat 마운트 | :560-562 | |

**Pitfall 1 봉합** (1줄 surgical — poll-vote-island.tsx:137-141 현재 코드):
```typescript
useEffect(() => {
  if (nicknameProp || initialNickname) return;   // ← `|| onRequireMember` 추가
  const stored = getStoredNickname();
  if (stored) setNickname(stored);
}, [nicknameProp, initialNickname]);
```
이유: RPC 선택은 `onRequireMember` **존재**(:265), 게이트 호출은 nickname **부재**(:243)로 분기 — stored nickname만 있고 세션 없는 재방문자가 `castDateVoteAuthed` 401을 맞는다.

**유지 (무접촉):** castVote optimistic+rollback(:235-304), vote broadcast 송신(:286-290), inline 닉네임 게이트(:381-414 — /poll 래퍼가 onRequireMember를 주면 자동 스킵), GridCalendar 전체.

---

### 3. `poll/[code]/page.tsx` — 통일 채팅 탑재 (D-03)

**Analog:** 자기 자신의 island 마운트 idiom (page.tsx:80-87):
```tsx
{/* Static cached props ONLY — votes/tally/presence/chat hydrate inside. */}
<PollVoteIsland
  code={code}
  tripId={poll.trip_id}
  mode={poll.mode}
  status={poll.status}
  options={poll.options ?? []}
/>
```
변경: 이 마운트를 신규 래퍼 island로 교체(래퍼가 PollVoteIsland + 채팅 섹션을 함께 감쌈 — UI-SPEC A-7 게이트 공유). props는 동일하게 SSR seed(`getCachedPoll`)에서 — `poll.trip_id`가 채널명·listTripMessages 인자의 소스. SSR 셸(generateMetadata :15-24, 크롬 :60-78, footer :89-99)은 무수정 — 채팅은 전부 client hydrate (Pitfall 2 계승).

---

### 4. `poll-guest-island.tsx` (CREATE) — 게이트+채널 소유 래퍼

두 analog의 합성. **신규 로직 0** — 아래 조각들을 그대로 미러.

**(a) 게이트 promise 브리지** — 복사원: guest-surface.tsx:92-95(ref) + :233-240(requireMember):
```typescript
const gateResolve = useRef<((v: { uid: string; nickname: string }) => void) | null>(null);
const gateReject = useRef<(() => void) | null>(null);

function requireMember(): Promise<{ uid: string; nickname: string }> {
  if (joined && userId) return Promise.resolve({ uid: userId, nickname });
  return new Promise((resolve, reject) => {
    gateResolve.current = resolve;
    gateReject.current = reject;
    setGateOpen(true);
  });
}
```
PollVoteIsland `onRequireMember`와 채팅 첫 전송이 **같은 브리지**를 공유 (A-7 "어느 쪽이 먼저든 1회").

**(b) 익명 승격** — 복사원: guest-surface.tsx:171-187 `ensureGuestMember`, `joinMoa(client, slug)` → `joinMoaByPollCode(client, code)`만 교체:
```typescript
async function ensureGuestMember(nick: string): Promise<string> {
  const client = getSupabaseBrowser();
  const { data: { user } } = await client.auth.getUser();
  let uid = user?.id ?? null;
  if (!uid) {
    const { data, error } = await client.auth.signInAnonymously({
      options: { data: { name: nick } },   // Pitfall: 미주입 시 display_name='user'
    });
    if (error) throw error;
    uid = data.user!.id;
  }
  await joinMoaByPollCode(client, code);   // ← joinMoa 대신 (유일한 차이)
  setStoredNickname(nick);
  return uid;
}
```

**(c) 게이트 confirm/취소 핸들러** — 복사원: guest-surface.tsx:242-272 (`handleConfirmNickname`/`handleCloseGate`). hydrate는 `hydrateMember` 대신 `listTripMessages`만 (**getTrip 호출 금지** — private 레거시 poll trip은 멤버여도 trips SELECT 불가, Pitfall 2). 실패 토스트 카피: `'참여하지 못했어요. 다시 시도해 주세요'` (:258 — 기존 카피 무수정).

**(d) 재방문 멤버 즉시 hydrate** — 복사원: guest-surface.tsx:99-126 세션 effect:
```typescript
const { data } = await client.auth.getUser();
const uid = data.user?.id ?? null;
if (uid) {
  const role = await getMyTripRole(client, tripId, uid).catch(() => null);
  if (role) { /* stored nickname 복원 + hydrate + setJoined(true) */ }
}
```

**(e) 채널 소유 (pre-subscribe 체인)** — 복사원: moa-island.tsx:194-231, places/links 바인딩 제외 축소:
```typescript
useEffect(() => {
  if (!joined || !userId) return;          // Pitfall 4: join 후에만 구독 (presence 오염 방지)
  const client = getSupabaseBrowser();
  const channel = client.channel(moaChannelName(tripId), {
    config: { presence: { key: userId } },
  });
  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
      (payload) => appendMessage(payload.new as TripMessage),
    )
    .on('presence', { event: 'sync' }, () =>
      setViewers(Object.keys(channel.presenceState()).length),
    )
    .subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          nickname,
          online_at: new Date().toISOString(),
        });
      }
    });
  return () => { void client.removeChannel(channel); };
}, [tripId, joined, userId]);
```
전 바인딩은 `.subscribe()` **이전** 체이닝 (#1917 — 사후 추가는 무음 no-op). `moa:{tripId}` topic의 **유일 소유자** — 같은 topic 2채널이면 나중 채널이 배달 탈취 (Phase 19/20 교훈).

**(f) id-dedup append** — 복사원: moa-island.tsx:131-133:
```typescript
function appendMessage(row: TripMessage) {
  setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
}
```

**(g) 전송 (게이트 합류)** — 복사원: moa-island.tsx:466-476 `handleSend` + requireMember 합성:
```typescript
async function handleSend(body: string, _replyTo: string | null) {
  let uid = userId, nick = nickname;
  if (!joined || !uid) {
    const m = await requireMember();  // 취소 시 reject → MoaChat이 draft 복원+토스트 (Pitfall 7 수용)
    uid = m.uid; nick = m.nickname;
  }
  const input = TripMessageCreateSchema.parse({   // §4.5 UI 경계 Zod
    trip_id: tripId, nickname: nick, body, reply_to_place_id: null,
  });
  const row = await sendTripMessage(getSupabaseBrowser(), input);
  appendMessage(row);  // postgres_changes echo는 id dedup
}
```

**(h) MoaChat 마운트 (controlled — 무수정 소비)** — props 계약: moa-chat.tsx:17-32, 마운트 원형: moa-island.tsx:662-671:
```tsx
<MoaChat
  messages={messages}
  currentUserId={userId ?? ''}
  viewers={viewers}
  onSend={handleSend}
  replyToPlaceId={null}
  onClearReply={() => {}}
  placesById={{}}          // A-9: 칩 전부 미해석·미렌더 (Pitfall 9 기존 경로)
  onChipTap={() => {}}
/>
```
컨테이너: `h-[400px]` (A-6 — MoaChat은 `flex h-full` 전제라 페이지 섹션엔 고정 높이 필수). 섹션 크롬: `mt-8 border-t pt-6` + `<h3>` 헤딩 "채팅" (기존 한마디 위치·레벨 계승). 비멤버 빈 상태 카피 `참여하면 지금까지의 대화를 볼 수 있어요`는 **MoaChat 밖 섹션 레벨**에서 조건 렌더 (HC-3 — moa-chat diff 0 유지).

**(i) 게이트 UI** — `NicknameGateSheet` 무수정 재사용 (nickname-gate-sheet.tsx:23-61 — trim·빈값 토스트만 내장, 인증·join은 호출자 소유).

---

### 5. `supabase/migrations/0032_join_moa_by_poll_code.sql` (CREATE)

**Analog 1 — RPC 본문 미러:** 0025_web_share.sql:64-99 `join_moa` (안전장치 전부 계승):
```sql
create or replace function join_moa(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public          -- search_path 핀 (필수 idiom)
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
begin
  select id, owner_id, share_mode into v_trip_id, v_owner_id, v_share_mode
  from trips where share_slug = p_share_slug and visibility in ('shared','public') limit 1;
  if v_trip_id is null then raise exception 'trip not found or not shared'; end if;
  if v_owner_id = auth.uid() then return v_trip_id; end if;   -- owner self-join 가드
  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(), /* role */, now())
  on conflict (trip_id, user_id) do nothing;                  -- 멱등, 자동 승격 없음 (D-A4)
  return v_trip_id;
end;
$$;
grant execute on function join_moa(text) to authenticated;
```
0032 변경점: bearer가 `share_slug` → `poll_code` (`date_polls p join trips t on t.id = p.trip_id where p.poll_code = p_code`), **visibility 게이트 없음**(레거시 private dateless-poll trip 커버 — Q1 근거), role 고정 `'voter'`(dates 시맨틱), poll status 게이트 없음(A-8/A1 — 채팅은 trip 소속). **RESEARCH Q1에 전문 스펙 있음 — 그대로 사용.**

**Analog 2 — grant 스코프:** 0029_public_trip_poll.sql:156 — `to authenticated`만 (anon 아님 — 익명이라도 세션 필수, `cast_date_vote_authed` 선례).

**Analog 3 — 파일 헤더 주석 관례:** 0029:1-10 — 결정 근거·append-only 명시·§4.4 준수 선언. PR description에 `BREAKING DB CHANGE` (§4.6). 적용 후 `pnpm supabase:types` → `database.ts` 재생성.

---

### 6. `packages/api/src/queries/memberships.ts` — `joinMoaByPollCode` append

**Analog:** 같은 파일 `joinMoa` (memberships.ts:17-31 — JSDoc 관례 포함 verbatim 미러):
```typescript
/**
 * Self-join a moa by its share slug. Idempotent (already a member = no-op — no
 * role promotion, D-A4). Backed by the SECURITY DEFINER join_moa RPC (0025): …
 */
export async function joinMoa(
  client: MoajoaSupabaseClient,
  shareSlug: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_moa', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}
```
신규 함수: `client.rpc('join_moa_by_poll_code', { p_code: code })` — 나머지 형태 동일. import 소스는 `'../client'`의 `MoajoaSupabaseClient` 타입 (`.js` extension 금지).

---

### 7. `packages/api/src/queries/date-polls.ts` — postComment/deleteComment 제거

**제거 대상 실측:** `postComment` :93-106 (JSDoc 포함), `deleteComment` :108-118. 호출부는 poll-chat.tsx뿐 — 파일 삭제 후 orphan. `castDateVote`(:60-84)·`getPollTally`(:86-91)·`confirmPollDate`(:120~)는 **무접촉** (A4 — surgical).

---

### 8. `apps/web/__tests__/poll-guest-island.test.tsx` (CREATE)

**Analog:** moa-island.test.tsx:5-37 — 채널 스텁 (바인딩 캡처 + 동기 SUBSCRIBED):
```typescript
type OnCall = { type: string; filter: { event?: string; table?: string }; cb: (arg?: unknown) => void };
let onCalls: OnCall[] = [];
function makeChannel() {
  const ch: Record<string, unknown> = {};
  ch.on = vi.fn((type, filter, cb) => { onCalls.push({ type, filter, cb }); return ch; });
  ch.track = vi.fn();
  ch.presenceState = vi.fn(() => ({}));
  ch.subscribe = vi.fn((cb?: (s: string) => void) => { cb?.('SUBSCRIBED'); return ch; });
  return ch;
}
const channel = vi.fn((_name: string, _opts?: unknown) => { const ch = makeChannel(); lastChannel = ch; return ch; });
const removeChannel = vi.fn();
vi.mock('@/lib/supabase/browser', () => ({ getSupabaseBrowser: () => ({ channel, removeChannel }) }));
```
+ `vi.mock('@moajoa/api', …)` 개별 vi.fn 위임 패턴 (:60-76) + MoaChat 스텁 (:179-210 — 배선만 검증, 프레젠테이션은 moa-chat.test 몫). 단언 대상: 채널명 `moa:{tripId}`(= `moaChannelName`), pre-subscribe 바인딩 수, join 전 미구독, 게이트→`joinMoaByPollCode` 순서. **위치 제약:** `apps/web/__tests__/`에만 수집됨 (vitest include — 25-02/25-04 선례). 실행: `pnpm --filter @moajoa/web exec vitest run __tests__/<file>.test.tsx` (bare `test`는 watch 모드).

---

### 9. `packages/api/src/queries/memberships.test.ts` — append

**Analog:** 같은 파일 :13-35 `makeRpcClient` + joinMoa describe:
```typescript
function makeRpcClient(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => Promise.resolve(result));
  const client = { rpc } as unknown as MoajoaSupabaseClient;
  return { client, rpc };
}
// 케이스 3종: rpc 인자 검증 / 반환값 / error throw
expect(rpc).toHaveBeenCalledWith('join_moa', { p_share_slug: SLUG });
```
신규 describe는 `('join_moa_by_poll_code', { p_code: CODE })`로 동일 3종.

---

### 10. `supabase/tests/web_share_smoke.sh` — (7) append

**Analog:** 같은 파일 섹션 (6) (:64-127) — 익명 JWT 재사용 + curl RPC + psql 단언 idiom:
```bash
# join RPC 호출 (:91-92 미러 — join_moa_by_poll_code로 교체)
curl -s -X POST "$API/rest/v1/rpc/join_moa" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$SLUG_GUEST\"}" > /dev/null

# trip_messages INSERT 201 프로브 (:114-117 그대로 — voter 케이스로 T_DATES 대상 재사용)
MCODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/trip_messages" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"trip_id\":\"$T_GUEST\",\"nickname\":\"게스트닉네임\",\"body\":\"게스트 채팅\"}")
[ "$MCODE" = "201" ] || { echo "FAIL: …"; exit 1; }
```
poll_code 시드는 기존 (d) 블록(:120-122)의 `date_polls`/`poll_code` psql 패턴 재사용. 신규 케이스: voter(dates join)로 trip_messages INSERT 201 + SELECT 200, `join_moa_by_poll_code` 프로브(role='voter' 단언 — :47-50 idiom).

---

## Shared Patterns

### 게이트 promise 브리지 (투표·채팅 공용)
**Source:** `guest-surface.tsx:233-240` — Apply to: 신규 래퍼 island. 위 4(a) 참조. 취소 시 reject → 채팅 경로에선 MoaChat이 draft 복원+에러 토스트 1회 (Pitfall 7 — **수용, 명시적 비목표**).

### pre-subscribe 채널 체인 + join 후 구독
**Source:** `moa-island.tsx:194-231` — Apply to: 신규 래퍼. 바인딩 사후 추가 금지(#1917) · join 전 구독 금지(WALRUS 무음 0건 + presence 유령) · topic당 1채널.

### id-dedup append (reconcile 금지)
**Source:** `moa-island.tsx:131-133` — trip_messages는 append-only INSERT — payload 신뢰 + id dedup이 규약. places식 전체-refetch reconcile 불필요.

### UI 경계 Zod 검증
**Source:** `moa-island.tsx:467-472` — `TripMessageCreateSchema.parse` (from `@moajoa/core`) → insert. §4.5.

### DEFINER RPC 안전장치 5종 (신규 RPC 필수 체크리스트)
**Source:** `0025:64-99` + `0029:156` — bearer 검증 · self-join only(`auth.uid()`, 클라이언트 uid 인자 0) · owner 가드 · `on conflict do nothing` 멱등 · `set search_path = public` + `grant to authenticated`만.

### 에러 토스트 카피 (기존 무수정 재사용)
- 참여 실패: `'참여하지 못했어요. 다시 시도해 주세요'` (guest-surface.tsx:258)
- 전송 실패: MoaChat 내장 (moa-chat.tsx:73) — 래퍼 onSend는 throw 전파만

---

## No Analog Found

없음 — 전 파일이 exact analog 보유. 유일한 "발명"인 0032 RPC조차 RESEARCH Q1에 전문 SQL이 있고 join_moa 미러다.

---

## Retirement Map (D-02 — analog가 아닌 제거 좌표)

| Target | 좌표 |
|--------|------|
| `poll-chat.tsx` | 파일 전체 삭제 |
| `poll-vote-island.tsx` | 위 §2 표 (실측 라인) |
| `guest-surface.tsx:299-301` | embedded 전달 + "한마디" 주석 |
| `date-polls.ts:93-118` | postComment/deleteComment |
| `apps/web/__tests__/poll-vote-island.test.tsx` | postComment/deleteComment mock(:48-56)·한마디/embedded 케이스(:202-211) — 삭제 task와 **같은 커밋** |
| `apps/web/__tests__/guest-surface.test.tsx` | dates/embedded 단언(:200, :213) 재작성 |
| `packages/api/src/queries/date-polls.test.ts` | postComment/deleteComment describe(:162-197) |
| HC-7 grep 게이트 | `! grep -rn "한마디\|투표가 마감되어 메시지를 남길 수 없어요\|이 메시지를 삭제할까요?" apps/web --include="*.ts" --include="*.tsx" --exclude-dir=.next` |

---

## Metadata

**Analog search scope:** `apps/web/app/{moa,t,poll}/**` · `packages/api/src/queries/` · `supabase/migrations/` · `supabase/tests/` · `apps/web/__tests__/`
**Files scanned:** 15 (전문 판독 12 + 부분 판독 3)
**Pattern extraction date:** 2026-07-14
**라인 번호 유효성:** 현재 HEAD (67ee119) 기준 실측. guest-surface/poll-vote-island에 다른 변경이 선행되면 재확인 필요.
