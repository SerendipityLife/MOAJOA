# Phase 25: Guest Unified Share (통합 공유화면) - Research

**Researched:** 2026-07-10
**Domain:** Supabase Anonymous Auth + RLS(익명 세션 멤버십) + Next.js SSR 캐시 경계 + 호스트 컴포넌트 재사용(realtime)
**Confidence:** HIGH (핵심 auth/RLS 사실은 실제 마이그레이션 코드 + 기존 스모크 실증 + 공식 문서로 교차확인)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 게스트 익명 신원 = Supabase 익명 인증(`signInAnonymously` → `auth.uid`). localStorage `device_token` 신원 폐기, SC3 "device_token := auth.uid" 통일 — 날짜투표(anon poll RPC)도 익명 세션 `auth.uid`를 device_token 자리에 사용. 신원 1개로 찜·장소추가(`added_by`)·날짜투표·채팅 RLS·순번 일관.
- **D-02:** 익명 세션은 lazy — 단순 열람은 비로그인 SSR(무마찰). 첫 참여 액션(찜/장소·링크 추가/날짜투표) 시점에 `signInAnonymously` → 닉네임 → `join_moa` 순 발급. SSR 캐시 무독성(poll 패턴 일치).
- **D-03 (추가 스코프):** 계정 승격 = 최소 심. 게스트가 카카오로 로그인하면 `supabase.auth.linkIdentity`로 익명 `auth.uid`를 그대로 정식 계정으로 전환 → 이력 유지. 기존 로그인 버튼/플로우 재사용, 별도 병합 화면 없음. 전체 승격 UX는 deferred.
- **D-04:** 닉네임 바텀시트 트리거 = 첫 참여 액션(D-02 결합). 열람만 하면 안 뜸.
- **D-05:** 닉네임 고정(수정 UI 없음, deferred). 재접속 시 Supabase 익명 세션(refresh token 자동 지속) + 저장 닉네임으로 동일 신원 식별, 게이트 생략.
- **D-06:** 닉네임 중복 허용 — 신원은 `auth.uid`, 닉네임은 표시 라벨. 색으로 추가 구분.
- **D-07:** 게스트 색 = 기존 `member-color.ts` 재사용 — 호스트=브랜드색 고정, 게스트=join순 6색 순환.
- **D-08:** `/t/[slug]`가 호스트 컴포넌트(`place-list`·`add-sheet`·`moa-island` 실시간)를 재사용하는 게스트용 통합 화면으로 진화. 게스트도 `[모으기][채팅]` 탭 포함. 게스트 쓰기가 호스트와 같은 채널·테이블 → SC4·채팅 자연 통합.
- **D-09:** `share_mode`가 화면 구성 결정 — `places`→`[모으기]`(+채팅), `dates`→날짜투표 전면, `both`→`[모으기]` 상단 날짜투표 섹션 + 아래 장소리스트. 날짜투표는 기존 anon poll RPC 임베드(`device_token := auth.uid`).
- **D-10:** `/poll/[code]`는 레거시 유지(NAV-04 하위호환). 신규 공유는 전부 `/t`로 통일, 리다이렉트 안 함.
- **D-11:** 게스트 링크 추가 → 자동 추출 허용(호스트와 동일, fire-and-forget). `join_moa`로 멤버가 됐으므로 SEC-01 통과. SHARE-03이 링크추가 명시.
- **D-12:** 게스트는 자기가 추가한 장소·자기 찜만 삭제 가능(`added_by = auth.uid` 기준). 남의 기여는 못 건드림.
- **D-13:** SEC-01(추출 EF 멤버십 게이트) 실제 구현은 Phase 27. Phase 25는 "게스트는 반드시 `join_moa` 후 참여"라는 멤버십 전제 구조만 세팅.

### Claude's Discretion
- 익명 세션 lazy-init을 island 내부 어디서/어떻게 트리거할지
- poll RPC를 통합 화면에 임베드하는 구체 방식
- SSR 캐시 경계 세부

### Deferred Ideas (OUT OF SCOPE)
- 게스트 계정 승격 전체 UX(병합 화면·기존 카카오 계정과의 충돌 처리) — 이번엔 linkIdentity 최소 심(D-03)만
- 닉네임 수정 UI — 이번엔 고정(D-05)
- 추출 EF 멤버십 게이트 실제 구현 — Phase 27 SEC-01(이번엔 멤버십 전제 구조만, D-13)
- 카피 스윕(보드→모아, 가고싶어→찜) — Phase 27 NAME-01
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-08 | 게스트가 닉네임만 입력하면 익명 인증으로 참여, 같은 브라우저 재접속 시 동일 신원 식별 | `signInAnonymously({options:{data:{name}}})` (§Standard Stack, Pattern A). 세션 지속 = `@supabase/ssr` 쿠키 기반(§Pitfall 3). profiles 행 자동 생성(handle_new_auth_user 트리거) — added_by/user_id FK 충족. |
| SHARE-02 | 공유링크 비로그인 SSR 즉시 렌더(모아 이름·지도·리스트 — /t·/poll 통합) | `getCachedPublicTrip`(쿠키리스 anon 캐시, `public_trip_view` DEFINER RPC) 이미 존재·유지. `share_mode`로 구성 분기(§Architecture Pattern 2). |
| SHARE-03 | 게스트가 공유 모드에 따라 찜·장소/링크 추가·날짜투표 참여(첫 상호작용 시 닉네임 게이트) | RLS 전량 `to authenticated`이고 익명 세션=authenticated role + join_moa 멤버십 → 기존 정책 그대로 통과(§RLS 검증표). 날짜투표는 `cast_date_vote`(device_token=auth.uid). |
| SHARE-04 | 게스트 참여(찜·장소추가)가 호스트 화면에 실시간 반영 | 단일 `moa:{tripId}` 채널·같은 테이블(places/votes/trip_messages postgres_changes). 게스트 쓰기가 호스트 구독에 fan-out(§Architecture Pattern 3, WALRUS RLS). |
</phase_requirements>

## Summary

이 phase의 진짜 리스크는 UI가 아니라 **익명 신원(auth.uid) 하나가 찜·장소추가·날짜투표·채팅·순번·멤버십을 전부 담도록 배선하는 것**이다. 좋은 소식: 백엔드는 거의 완비돼 있다. 익명 인증은 `config.toml`에 `enable_anonymous_sign_ins = true`로 켜져 있고 원격 대시보드도 활성(23-07 실증), `supabase-js 2.110.0`은 `signInAnonymously`·`linkIdentity` 모두 지원, `join_moa` RPC(0025)와 전 테이블 RLS(`to authenticated` + `can_*_trip` DEFINER 헬퍼)는 익명 세션에 그대로 작동함이 이미 스모크로 실증됐다(is_anonymous=true·role=authenticated·both→editor/dates→voter·trip_messages RLS GET 200).

**핵심 사실(HIGH conf):** Supabase 익명 유저는 진짜 `auth.uid`를 갖고 **`authenticated` Postgres role**을 배정받는다(영구 유저와 동일, `is_anonymous` JWT 클레임으로만 구분). 따라서 `to authenticated`로 작성된 기존 RLS 정책은 익명 멤버에게 그대로 적용된다 — join_moa로 멤버십만 확보되면 places INSERT(editor)·votes(member)·trip_messages(member)·direct read가 전부 통과한다. **단, 멤버십이 없는 익명/비로그인 세션은 direct table read(places·votes·trip_messages·links·date_polls)가 RLS로 전부 0건이다.** 열람 표면은 anon-grant DEFINER RPC(`public_trip_view`·`vote_counts_for_places`·`poll_vote_tally`)로만 가능. 이 "join 전 = RPC만 / join 후 = direct read+realtime" 경계가 게스트 island 아키텍처를 결정한다.

**Primary recommendation:** `/t/[slug]`를 (1) SSR 쿠키리스 캐시 셸(현행 유지) + (2) 클라이언트 게스트 island 래퍼로 구성한다. 래퍼는 마운트 시 세션을 **클라이언트에서** 해석(`client.auth.getUser()`)해 멤버면 곧장 호스트 `MoaIsland`를 실 데이터로 마운트(D-05 재접속), 아니면 SSR seed 기반 read-only 뷰를 렌더하다가 **첫 참여 액션에서** lazy 게이트(닉네임 → `signInAnonymously` → `join_moa`)를 돌린 뒤 direct-read 데이터를 로드하고 채널을 구독한다. 서버 컴포넌트에서는 절대 `cookies()`/auth를 읽지 말 것(캐시 무독성). 날짜투표(dates/both)는 신규 제작 금지 — 기존 anon poll RPC를 임베드하되 slug→poll_code 노출용 **신규 anon-grant DEFINER RPC(마이그레이션 0029)** 하나가 필요하다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 공유 첫 페인트(이름·지도·리스트) | Frontend Server (SSR, cached) | — | `getCachedPublicTrip` 쿠키리스 `unstable_cache` — SHARE-02, 이미 존재 |
| 익명 신원 발급/세션 해석 | Browser (client) | Supabase Auth | `cookies()` 서버 접근 = 캐시 오염. 반드시 클라이언트(D-02) |
| join_moa 멤버십 부여 | API (SECURITY DEFINER RPC) | — | bearer slug 검증·self-join·role=share_mode 서버결정(0025) |
| 찜·장소·링크·채팅 write + RLS | Database (RLS `to authenticated`) | — | 익명=authenticated role → 기존 정책 재사용, 신규 정책 0 |
| 날짜투표 write(익명) | API (anon-grant DEFINER RPC) | Database | `cast_date_vote` — device_token 자리에 auth.uid |
| 실시간 반영(SC4) | Database (Realtime WALRUS + RLS) | Browser channel | 단일 `moa:{tripId}` postgres_changes, 구독자 JWT로 RLS 재평가 |
| 계정 승격(카카오) | Browser (`linkIdentity`) | Supabase Auth (manual linking) | 익명 uid 보존 전환, UI는 기존 `/login` 진입점만 |
| 추출 트리거(링크 추가) | Edge Function (fire-and-forget) | — | 멤버십 전제만(D-13), 실제 게이트는 Phase 27 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.0 (repo 고정) | `signInAnonymously`·`linkIdentity`·`auth.getUser`·realtime | 레포 표준. 두 API 모두 지원 확인 [VERIFIED: package.json + docs] |
| `@supabase/ssr` | ^0.12.0 (apps/web) | 브라우저 클라이언트(세션 쿠키 지속) | 기존 `getSupabaseBrowser` 소비 [VERIFIED: apps/web/package.json] |
| Next.js | 15 (App Router) | SSR 캐시 셸 + 클라이언트 island | 기존 `/t`·`/poll` 패턴 [VERIFIED: repo] |
| `@moajoa/api` queries | — | `joinMoa`·`castDateVote`·`castVote`·`sendTripMessage`·`addLink`·`triggerExtraction`·`listPlacesByTrip`·`listTripMessages`·`listTripMembers` | 전부 이미 존재, 시그니처 확인 [VERIFIED: packages/api/src/queries/*] |

### Supporting (전부 기존 자산 — 신규 설치 0)
| Asset | Purpose | When to Use |
|---------|---------|-------------|
| `apps/web/lib/supabase/browser.ts` | 캐시된 브라우저 클라이언트 | 모든 클라이언트 auth/realtime |
| `apps/web/lib/device-token.ts` | `getStoredNickname`/`setStoredNickname` | 닉네임 로컬 지속(D-05). `getDeviceToken`은 /t에서 미사용(auth.uid로 대체) |
| `apps/web/lib/member-color.ts` `memberColor()` | 게스트 색(D-07) | 순번 배지·핀·"닉네임님이 담음" |
| `apps/web/app/moa/[id]/_components/*` | MoaIsland·PlaceList·AddSheet·MoaChat·MoaTabBar·PlaceSheet·MoaMap | D-08 재사용 |
| `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` | dates/both 날짜투표 임베드 소스 | D-09 |

**Installation:** 신규 npm 설치 없음. 검증:
```bash
npm view @supabase/supabase-js version   # 최신 확인용(레포는 2.110.0 고정, 변경 금지)
```
[VERIFIED: package.json `"@supabase/supabase-js": "2.110.0"`, 24-01에서 전역 2.110.0 실체화 실증]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 익명 세션 재사용(MoaIsland 그대로) | 별도 GuestIsland 신규 작성 | 재사용이 D-08·SC4를 공짜로 줌. 신규작성은 채팅/순번/색 로직 중복 → §Anti-Patterns |
| `cast_date_vote`에 auth.uid를 클라이언트 전달 | 신규 `cast_date_vote` 서버파생 래퍼(auth.uid()) | 클라 전달=마이그레이션 0·spoof 가능(레거시와 동일 신뢰). 서버파생=작은 마이그레이션·spoof 차단. §Open Q2 |
| public_trip_view 확장(poll 포함) | 신규 `public_trip_poll(slug)` RPC | 확장이 SSR seed에 자연 편입. 둘 다 마이그레이션 1개. §Pattern 2 |

## Architecture Patterns

### System Architecture Diagram

```
                         게스트가 카톡 링크 클릭
                                  │
                                  ▼
        ┌──────────────────────────────────────────────┐
        │  Next.js SSR (RSC, cached, COOKIE-FREE)       │
        │  /t/[slug]/page.tsx                            │
        │   └─ getCachedPublicTrip(slug)                │  ← cookies() 절대 호출 X
        │        unstable_cache(['public-trip',slug])   │     (캐시 무독성, SHARE-02)
        │        fresh createClient(anon, no cookies)   │
        │        → public_trip_view(slug) DEFINER RPC   │
        │        → { trip, owner, links, places[, poll?]}│ ← 0029로 poll 추가
        └───────────────┬──────────────────────────────┘
                        │ seed props (정적 데이터)
                        ▼
        ┌──────────────────────────────────────────────┐
        │  Guest Island 래퍼 (client, 'use client')     │
        │   1) mount: client.auth.getUser()  ← 클라 only │
        │      ├─ 세션+멤버 (D-05 재접속) ─────┐          │
        │      └─ 세션 없음/비멤버 ──> read-only 뷰      │
        │           (public_trip_view seed +            │
        │            vote_counts_for_places anon RPC +  │
        │            poll_vote_tally anon RPC)           │
        │                                     │          │
        │   2) 첫 참여 액션(찜/추가/투표) ─────┤          │
        │      └─ 닉네임 시트 → signInAnonymously        │
        │            ({options:{data:{name}}})          │
        │         → join_moa(slug)  [editor|voter]      │
        │         → setStoredNickname(name)             │
        │         → 원래 액션 재개                        │
        │                                     ▼          │
        │   3) 멤버 확보 후:                              │
        │      MoaIsland 마운트(currentUserId=auth.uid)  │
        │       - listPlacesByTrip/listTripMessages     │
        │         /listTripMembers (direct read, 이제 OK)│
        │       - channel moa:{tripId} SUBSCRIBE         │
        └───────────────┬──────────────────────────────┘
                        │ INSERT places/votes/trip_messages
                        │ (added_by/user_id = auth.uid, RLS pass)
                        ▼
        ┌──────────────────────────────────────────────┐
        │  Postgres + Realtime (WALRUS + RLS 재평가)     │
        │   같은 moa:{tripId} 채널로 fan-out             │
        └───────────────┬──────────────────────────────┘
                        ▼  호스트/다른 게스트 화면 실시간 반영 (SC4)
```

### Recommended Project Structure (신규/수정 파일)
```
apps/web/app/t/[slug]/
├── page.tsx                     # 유지: SSR 셸. VoteIsland → GuestSurface 교체. cookies() 금지
├── _components/
│   ├── guest-surface.tsx        # 신규: 세션 lifecycle + share_mode 분기 + lazy 게이트 래퍼
│   ├── nickname-gate-sheet.tsx  # 신규(또는 poll 게이트 이식): BottomSheet 닉네임(C1)
│   └── (vote-island.tsx)        # 레거시 참조/부분 재사용 — GuestSurface로 대체
apps/web/app/moa/[id]/_components/
│   └── moa-island.tsx           # 재사용. currentUserId를 lazy로 받도록 최소 확장 검토(§Open Q1)
supabase/migrations/
└── 0029_public_trip_poll.sql    # 신규(필요 시): slug→poll 노출 anon-grant DEFINER RPC
                                 #  (+ 선택: cast_date_vote_authed 서버파생 래퍼, §Open Q2)
```

### Pattern 1: Lazy 익명 인증 게이트 (D-02/D-04, AUTH-08)
**What:** 첫 참여 액션 핸들러 진입부에서만 익명 세션을 발급한다. 열람은 세션 0.
**When:** 찜 토글·장소/링크 추가·날짜투표의 최초 1회.
```typescript
// Source: docs — supabase.com/docs/reference/javascript/auth-signinanonymously
//         + repo 23-05 locked call contract (packages/core/src/schemas/chat.ts 주석)
async function ensureGuestMember(client, slug, nickname: string): Promise<string> {
  const { data: { user } } = await client.auth.getUser();
  let uid = user?.id ?? null;
  if (!uid) {
    // options.data.name → raw_user_meta_data.name → handle_new_auth_user 트리거
    // → profiles.display_name (added_by/user_id FK 충족). [VERIFIED: 0016 L78-103 + 23-02 smoke]
    const { data, error } = await client.auth.signInAnonymously({ options: { data: { name: nickname } } });
    if (error) throw error;
    uid = data.user!.id;
  }
  await joinMoa(client, slug);   // 0025 DEFINER: role=share_mode(places/both→editor, dates→voter)
  setStoredNickname(nickname);   // D-05 재접속 게이트 생략용
  return uid;
}
```
**주의:** `signInAnonymously` 직후 supabase-js가 `SIGNED_IN` 이벤트로 realtime 소켓 토큰을 갱신한다. 채널 구독은 이 이후(=join_moa 완료 후)에 해야 postgres_changes가 멤버 RLS를 통과한다(§Pitfall 4).

### Pattern 2: share_mode 구성 분기 + 날짜투표 임베드 (D-09)
**What:** SSR seed의 `share_mode`로 레이아웃 결정. dates/both는 poll을 임베드.
**Problem:** `/t`는 slug로 들어오는데 poll RPC들(`poll_view_by_code`/`poll_vote_tally`/`cast_date_vote`)은 **poll_code**를 받는다. 비멤버 익명은 `date_polls` direct read가 RLS로 막혀(`can_read_trip`) slug→poll_code를 못 얻는다.
**Solution (마이그레이션 0029):** slug로 poll을 노출하는 anon-grant DEFINER RPC 추가 — 기존 `public_trip_view`(0016) 확장 또는 신규 함수. append-only 안전(신규 번호 파일에서 `create or replace`).
```sql
-- Source: 0016 public_trip_view / 0018 poll_view_by_code idiom 미러 [CITED: repo migrations]
create or replace function public_trip_poll(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_trip trips%rowtype; v_poll date_polls%rowtype; v_options jsonb;
begin
  select * into v_trip from trips where share_slug = p_slug and visibility in ('public','shared') limit 1;
  if not found then return null; end if;
  select * into v_poll from date_polls where trip_id = v_trip.id limit 1;
  if v_poll.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'start_date',o.start_date,'end_date',o.end_date)
         order by o.start_date), '[]'::jsonb)
    into v_options from date_poll_options o where o.poll_id = v_poll.id;
  return jsonb_build_object('poll_code', v_poll.poll_code, 'mode', v_poll.mode,
                            'status', v_poll.status, 'options', v_options);
end; $$;
grant execute on function public_trip_poll(text) to authenticated, anon;
```
그 후 임베드: `poll_vote_tally(code)`(anon read) + `cast_date_vote({ code, deviceToken: authUid, nickname, ... })`. `castDateVote`는 이미 `deviceToken` 파라미터를 받으므로(packages/api/src/queries/date-polls.ts) **날짜투표 쪽은 마이그레이션 0**이면 `auth.uid`를 넘기면 된다. poll_vote_island가 내부에서 `getDeviceToken()`을 직접 읽으므로(라인 147/225) `/t` 임베드는 deviceToken을 prop로 주입하도록 소폭 파라미터화가 필요하다(§Open Q3).
**When to use:** dates 또는 both 모드.

### Pattern 3: 단일 채널 실시간 재사용 (D-08, SC4)
**What:** 게스트가 호스트와 동일한 `moa:{tripId}` 채널·테이블을 쓰면 실시간이 공짜로 통합된다.
```typescript
// Source: apps/web/app/moa/[id]/_components/moa-island.tsx L158-195 [VERIFIED: repo]
// 이미 places INSERT + links UPDATE + trip_messages INSERT + presence 를 단일 채널로 바인딩.
// 게스트가 이 island을 재사용하면 SC4(실시간 반영·순번 #N+1)·채팅이 자동 충족.
```
**게스트 특이점:** MoaIsland는 마운트 시 `currentUserId`·`currentUserNickname` + seed 데이터(places/counts/votes/members/messages)를 요구한다. 비멤버 게스트는 이 direct-read 데이터를 못 얻으므로(RLS) **join 완료 후에** 데이터를 로드하고 island을 마운트한다. 순번(seq_no)은 서버 채번(0024 트리거)이라 게스트 추가도 이어지는 #N+1이 보장된다(MOA-01, forge 불가).

### Anti-Patterns to Avoid
- **서버 컴포넌트에서 `cookies()`/`auth.getUser()` 호출:** `/t/page.tsx`를 dynamic으로 만들어 SSR 캐시를 깨고, 익명 쿠키가 캐시를 오염시킨다. 세션 해석은 **전부 클라이언트**(기존 vote-island 규율).
- **비멤버 상태에서 채널 구독:** SUBSCRIBED 되지만 RLS로 이벤트 0건(무음). 반드시 join 후 구독.
- **날짜투표 신규 제작:** D-09가 금지. poll RPC/컴포넌트 임베드만.
- **`moa:{tripId}` 채널을 게스트용으로 또 하나 열기:** "한 토픽 채널 2개 금지"(Phase 19/20/26 반복 교훈). hidden 토글로 탭 전환(언마운트 X).
- **is_anonymous로 열람 제한:** 이 phase는 익명 멤버를 정식 멤버처럼 다룬다(D-01). is_anonymous 게이트는 Phase 27 SEC-01 몫.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 게스트 익명 신원 | localStorage UUID device_token 유지 | `signInAnonymously` → auth.uid (D-01) | RLS·순번·채팅이 auth.uid 하나로 일관. device_token은 dedup 핸들일 뿐 보안경계 아님 |
| 멤버십 부여 | 클라이언트 memberships INSERT | `join_moa(slug)` RPC(0025) | bearer 검증·role 서버결정·멱등·self-join. 직접 INSERT는 RLS(owner-only insert)로 막힘 |
| 계정 승격 병합 | 커스텀 row 재소유 로직 | `linkIdentity({provider:'kakao'})` | 익명 uid를 그대로 정식화 → added_by/votes/memberships 자동 보존(D-03) |
| 날짜투표 집계/저장 | 신규 투표 테이블/RPC | `cast_date_vote`·`poll_vote_tally`(0018) | anon-grant DEFINER·dedup·open-gate 이미 검증 |
| 실시간 반영 | broadcast 수동 fan-out | 단일 `moa:{tripId}` postgres_changes | WALRUS가 구독자 RLS 재평가 — 게스트 쓰기가 호스트에 자동 반영 |
| 게스트 색 배정 | 문자열 해시→색 | `memberColor(uid, ownerId, joinOrder)` | 토큰 팔레트만. 유저문자열 보간 금지(D-07) |
| profiles 행 생성 | 수동 insert | `handle_new_auth_user` 트리거(0016) | 익명 signup도 트리거가 display_name=meta.name으로 자동 생성 |

**Key insight:** 이 phase의 백엔드는 "게스트=익명 authenticated 멤버"라는 전제로 이미 설계돼 있다(0025 join_moa의 role 분기, 0018 anon RPC, 0028 트리거). 새로 만들 것은 **UI 조립 + lazy 게이트 + slug→poll 노출 RPC 1개**뿐. 그 이상은 과설계(CLAUDE.md §3.2).

## Runtime State Inventory

> rename/migration phase가 아니라 신규 기능(게스트 표면) phase다. 다만 D-01의 "device_token → auth.uid 신원 전환"이 데이터 성격을 바꾸므로 관련 항목만 명시.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `date_votes.device_token` / `date_comments.device_token`은 **레거시 /poll의 localStorage UUID**로 채워진 기존 행 존재 가능. `/t`는 auth.uid를 넣음 → 같은 사람이 /poll·/t 양쪽 투표 시 **다른 device_token으로 중복 행** 가능(dedup 키 = (poll_id, device_token, ...)) | code edit(신규 표면만 auth.uid 사용). 기존 행 마이그레이션 불필요(D-10 레거시 격리, 신규 공유는 전부 /t). 중복은 edge case로 수용 |
| Stored data (신원) | `apps/web/lib/device-token.ts`의 `moajoa:poll_device_token` localStorage 키 — /t에서는 미사용 | 코드에서 /t 경로는 auth.uid 사용. /poll은 device_token 유지(무변경) |
| Live service config | Supabase 프로젝트 Auth: **Anonymous sign-ins 토글**(원격 ON — 23-07 실증) + **Manual linking 토글**(linkIdentity 전제, 현재 config.toml에 키 없음 → §Environment Availability) | Manual linking을 config.toml + 원격 대시보드에서 활성화(human-action) |
| Secrets/env vars | 신규 없음. 카카오 OAuth(KAKAO_REST_API_KEY/SECRET) 기존 설정 재사용(D-03) | none |
| Build artifacts | `packages/api/src/types/database.ts` — 0029 마이그레이션 추가 시 재생성 필요 | `pnpm supabase:types` 후 커밋 |
| Migration deploy | 원격 DB는 0026까지 push 완료(STATE line 56), 0027/0028은 main push 시 auto 반영. **0029(신규)는 배포 게이트** | Phase 25 라이브 전 `supabase db push`(human-action) |

## Common Pitfalls

### Pitfall 1: 비멤버 익명 세션의 direct-read 0건
**What goes wrong:** 익명 로그인만 하고 join_moa 전에 `listPlacesByTrip`/`listTripMessages`/`listTripMembers`를 부르면 빈 배열이 온다(에러 아님 → 조용한 빈 화면).
**Why:** 전 테이블 SELECT RLS가 `can_read_trip(trip_id)` = 멤버십 필요. public_trip_view(DEFINER)만 anon 우회.
**Avoid:** join_moa 완료 **후에** direct-read를 호출. join 전 표면은 seed props + anon-grant RPC(vote_counts_for_places / poll_vote_tally)만.
**Warning signs:** "장소는 보이는데 찜 카운트/채팅/멤버색이 비어있다."

### Pitfall 2: SSR 캐시 오염 (cookies)
**What goes wrong:** 서버 컴포넌트에서 세션을 읽으면 `/t`가 per-user dynamic이 되고 익명 쿠키가 공유 캐시를 오염.
**Why:** `@supabase/ssr` 브라우저 클라이언트는 세션을 **쿠키**에 저장 → /t 요청에 auth 쿠키가 실린다.
**Avoid:** `getCachedPublicTrip`는 `unstable_cache` 안에서 쿠키리스 `createClient`를 새로 만든다(현행 유지). page.tsx는 `cookies()` 절대 호출 X. 세션 해석은 클라이언트 island에서만.
**Warning signs:** 다른 게스트에게 내 닉네임/찜이 캐시로 노출, 또는 캐시 미스 폭증.

### Pitfall 3: 세션 지속은 쿠키(문서상 "localStorage" 아님)
**What goes wrong:** D-05가 "localStorage refresh token"을 가정하지만 `@supabase/ssr`는 쿠키에 저장한다. 동작 결과는 동일(같은 브라우저 재접속=같은 auth.uid)이나 저장소가 다름.
**Why:** SSR 호환 위해 쿠키 사용. 공식 문서: 익명 세션은 "sign out·brFowsing data 삭제·다른 기기"에서만 소실 → **같은 브라우저=동일 신원**(D-05 충족).
**Avoid:** 재접속 판정은 저장 닉네임 유무가 아니라 `client.auth.getUser()` + `getMyTripRole`로. 닉네임 localStorage는 게이트 스킵 힌트일 뿐.
**Warning signs:** 시크릿창/쿠키삭제 후 신원 초기화(정상 동작). 다른 브라우저에서 이력 안 보임(정상).

### Pitfall 4: join 전 채널 구독 → 무음 0건
**What goes wrong:** 마운트 즉시 채널 구독하면 비멤버 토큰으로 SUBSCRIBED되어 postgres_changes 이벤트가 RLS로 전부 필터.
**Why:** Realtime WALRUS가 구독자 JWT로 RLS 재평가. 비멤버는 SELECT 0 → 이벤트 0.
**Avoid:** join_moa 후 island 마운트(=채널 구독). `signInAnonymously`→`SIGNED_IN`→소켓 토큰 갱신 완료를 보장한 뒤 구독.
**Warning signs:** "구독은 됐다는데 상대 화면 변화가 안 온다"(24-01에서 관측된 무음 no-op과 동형).

### Pitfall 5: D-12 삭제 권한이 UPDATE RLS로 airtight하지 않음 (중요)
**What goes wrong:** 호스트 `handleDelete`는 `hidePlace`(=`places` UPDATE `hidden_at`)를 쓴다. places **UPDATE** 정책은 `can_edit_trip`(=editor 누구나)라 게스트 editor가 **남의 장소도 soft-delete** 가능하다. UI(C5)는 "내 장소만 삭제 아이콘 렌더"로 가리지만 DB 경계는 아니다.
**Why:** places DELETE 정책만 `added_by=auth.uid or owner`로 제한. hidden_at은 UPDATE 경로.
**Avoid (planner 결정):** (a) 게스트 own-삭제를 hard `delete`로(DELETE 정책이 own-only 강제, seq_no 재사용은 0024가 방어) 또는 (b) 신규 DEFINER RPC `guest_hide_own_place(place_id)`(added_by=auth.uid 체크) 또는 (c) Phase 25는 UI-only 수용 + Phase 27 하드닝으로 이월. **최소 심 원칙상 (a) 또는 (c) 권장 — §Open Q4.**
**Warning signs:** 악의적 게스트가 devtools로 남의 장소를 숨김.

### Pitfall 6: 닉네임이 두 곳에 스냅샷됨
**What goes wrong:** 닉네임을 profiles.display_name(장소 라벨 소스)과 trip_messages.nickname(채팅 스냅샷)에 각각 넣어야 한다. 한쪽만 세팅하면 라벨/말풍선 이름 불일치.
**Why:** places는 added_by→profiles.display_name 조인(getProfileNames), trip_messages는 nickname 비정규화(D-A2).
**Avoid:** `signInAnonymously({data:{name}})`가 display_name을 세팅(트리거) + `sendTripMessage({nickname})`에 같은 name 전달. 둘의 소스를 하나의 게스트 닉네임 state로 통일.

## Code Examples

### 익명 세션 발급 + 메타데이터 (AUTH-08)
```typescript
// Source: supabase.com/docs/reference/javascript/auth-signinanonymously [CITED]
const { data, error } = await supabase.auth.signInAnonymously({
  options: { data: { name: nickname } },  // → raw_user_meta_data.name
});
// data.user.id = 새 auth.uid (is_anonymous:true, role:authenticated)
```

### 계정 승격 (D-03, 최소 심)
```typescript
// Source: supabase.com/docs/reference/javascript/auth-linkidentity [CITED]
// 전제: 프로젝트 Auth에서 Manual linking 활성화 필요
const { data, error } = await supabase.auth.linkIdentity({ provider: 'kakao' });
// 익명 uid를 그대로 유지한 채 kakao identity 부착 → added_by/votes/memberships 보존
// 진입점은 기존 /login 재사용(C6). 충돌(identity_already_exists) 처리는 deferred.
```

### RLS 익명-멤버 통과 (검증됨)
```sql
-- places INSERT: can_edit_trip → join_moa가 places/both에 editor 부여 → 통과 [VERIFIED: 0016 L477-480 + 0025 L91]
-- votes INSERT:  user_id=auth.uid AND can_vote_trip → 임의 멤버 통과 [VERIFIED: 0016 L536-545]
-- trip_messages: SELECT can_read_trip / INSERT can_vote_trip → 멤버 통과 [VERIFIED: 0025 L44-52]
-- 익명 세션도 authenticated role이므로 'to authenticated' 정책 그대로 적용 [CITED: auth-anonymous docs + 23-02/23-04 smoke]
```

## RLS 검증표 (익명 멤버 기준, HIGH conf)

| Action | Query/RPC | 정책 요건 | 익명 멤버 통과? | 근거 |
|--------|-----------|-----------|-----------------|------|
| 공유 열람(비멤버) | `public_trip_view(slug)` | anon grant, DEFINER | ✅ | 0016 L758 |
| 찜 카운트(비멤버) | `vote_counts_for_places` | anon grant, DEFINER | ✅ | 0016 L626 |
| 날짜투표 집계(비멤버) | `poll_vote_tally(code)` | anon grant, DEFINER | ✅ | 0018 L197 |
| join | `join_moa(slug)` | DEFINER, self-join | ✅ (both/places→editor, dates→voter) | 0025 L64-99 |
| 찜 토글 | `votes` upsert/delete | user_id=auth.uid + can_vote_trip | ✅ | 0016 L536-556 |
| 장소 추가(검색) | `add_manual_place` | invoker + can_edit_trip | ✅ editor | 0016 L763-810 |
| 링크 추가 | `links` insert | can_edit_trip | ✅ editor | 0016 L409-412 |
| 추출 트리거 | `triggerExtraction` EF | (멤버십 게이트 = Phase 27) | ✅ (현재 무게이트) | D-13 |
| 채팅 읽기 | `listTripMessages` | can_read_trip | ✅ 멤버 | 0025 L44-47 |
| 채팅 전송 | `sendTripMessage` | user_id=auth.uid + can_vote_trip | ✅ 멤버 | 0025 L49-52 + 0028 트리거 |
| 실시간 수신 | postgres_changes | 구독자 JWT RLS 재평가 | ✅ 멤버(비멤버 0건) | 0026/0028 + WALRUS |
| **자기 장소 삭제** | `hidePlace`(UPDATE hidden_at) | can_edit_trip (**own 아님!**) | ⚠️ 통과하나 남의 것도 가능 | **Pitfall 5** |
| 자기 장소 hard-delete | `places` delete | added_by=auth.uid or owner | ✅ own-only 강제 | 0016 L488-494 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/poll` device_token(localStorage UUID) 익명 | `signInAnonymously` auth.uid 익명(2.43+) | supabase-js 2.43+ / repo 23-x | 신원 1개로 RLS·순번·채팅 통합(D-01) |
| `/t`(열람·찜) + `/poll`(날짜) 분리 | share_mode 인지 통합 `/t` | Phase 25(this) | SHARE-02 통합, /poll은 레거시 유지 |
| 게스트 계정 승격 = 미지원 | `linkIdentity` 최소 심(uid 보존) | Phase 25 D-03 | 이력 유지 전환. 전체 UX는 deferred |

**Deprecated/outdated:**
- `/t`의 `VoteIsland`(단순 찜 리스트): GuestSurface + MoaIsland 재사용으로 대체(부분 참조).
- 문서(auth-anonymous)의 "metadata 미지원" 서술: signInAnonymously reference는 `options.data` 지원을 명시 — 상위 가이드가 불완전할 뿐(교차확인함).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Manual linking 토글이 현재 원격/로컬에서 **비활성** (config.toml에 키 없음) → linkIdentity(D-03) 전 활성화 필요 | Env/Runtime | linkIdentity가 런타임 에러 → 승격 실패. 활성화만 하면 해소(human-action) |
| A2 | dates/both 임베드 위해 slug→poll_code 노출 RPC(0029)가 필요 (현재 anon이 slug로 poll을 못 얻음) | Pattern 2 | 불필요하면 마이그레이션 1개 절약. 확인: 비멤버가 poll_code를 얻을 다른 경로 없음 → 필요 확실(direct read RLS 차단) |
| A3 | 원격 DB에 0027/0028이 main push로 반영됨(0026까지는 STATE 실증) | Runtime | 미반영 시 채팅/트리거 미동작 → push 확인 필요 |
| A4 | linkIdentity가 kakao provider 지원(문서는 github 예시만) | Code Ex | 미지원이면 D-03 방식 재검토. kakao가 configured OAuth provider이므로 지원 가능성 高, 배포 전 확인 |
| A5 | signInAnonymously 후 realtime.setAuth 자동 갱신(supabase-js 표준 동작) | Pitfall 4 | 수동 setAuth 필요 시 구독 전 1줄 추가 |

## Open Questions

1. **MoaIsland의 currentUserId를 lazy로 받게 확장 vs 별도 게스트 마운트 게이트**
   - 알고있는 것: MoaIsland는 마운트 시 uid+seed 데이터 요구. 게스트는 join 후에야 확보.
   - 불명확: MoaIsland를 최소 확장(pre-join placeholder 허용)할지, GuestSurface가 join 완료까지 read-only를 렌더하다 MoaIsland를 나중에 마운트할지.
   - 권장: **후자**(MoaIsland 무수정에 가깝게, surgical). read-only→join→full island 스왑.

2. **cast_date_vote: 클라이언트 auth.uid 전달 vs 서버파생 래퍼**
   - 알고있는 것: 기존 RPC는 device_token 파라미터. auth.uid를 넘기면 마이그레이션 0.
   - 불명확: spoofing 차단 위해 `cast_date_vote_authed`(device_token := auth.uid() 서버) 신규 추가할지.
   - 권장: 마이그레이션 0029를 어차피 추가하므로 **서버파생 래퍼를 같은 파일에 동봉**(spoof 차단, /poll 레거시 무영향). 과설계 우려 시 클라 전달로도 충분.

3. **poll-vote-island 파라미터화**
   - 알고있는 것: 내부에서 `getDeviceToken()` 직접 호출(L147/225).
   - 불명확: deviceToken/nickname을 prop로 주입하는 최소 변경 vs /t용 얇은 래퍼.
   - 권장: **optional deviceToken/nickname prop**(없으면 기존 getDeviceToken — /poll 무회귀).

4. **D-12 삭제 권한 강제 수준** (Pitfall 5)
   - 권장: 게스트 own-삭제를 hard `delete`(DELETE 정책이 own-only) 또는 UI-only 수용+Phase 27 이월. 최소 심 유지.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` signInAnonymously/linkIdentity | AUTH-08, D-03 | ✓ | 2.110.0 | — |
| Anonymous sign-ins (config + 원격 대시보드) | AUTH-08 | ✓ | config.toml L48 + 원격 ON(23-07) | — |
| **Manual linking (config + 원격)** | D-03 linkIdentity | ✗ | config.toml 키 없음 | 활성화 필요(human-action). 없으면 승격 진입점만 렌더, 클릭 시 에러 |
| Kakao OAuth provider | D-03 승격 | ✓ | config.toml L65 enabled + 원격 설정(23-07) | — |
| 원격 DB 마이그레이션 0016–0026 | 전 기능 | ✓ | push 완료(STATE L56) | 0027/0028 main-push, 0029 신규 push |
| colima + Docker (로컬 supabase) | 로컬 검증/typegen | ✓(가동 시) | — | MEMORY: supabase는 colima 필요 |

**Missing dependencies with no fallback:**
- **Manual linking 활성화(A1):** linkIdentity(D-03) 실행 전 필수. config.toml `[auth] enable_manual_linking = true`(로컬) + 원격 대시보드 토글. planner는 이를 human-action/설정 태스크로 명시.

**Missing dependencies with fallback:**
- 0029 마이그레이션 미배포 시 dates/both 게스트 투표만 미동작 — places 모드는 즉시 동작(부분 출시 가능).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (web: `apps/web/__tests__`, api: `packages/api/src/queries/*.test.ts`, core) + bash SQL 하네스/스모크(`supabase/tests/*.sh`) |
| Config file | vitest workspace(각 패키지). `apps/web/__tests__/setup.ts` |
| Quick run command | `pnpm --filter @moajoa/web test` (또는 대상 파일) |
| Full suite command | `pnpm test`(core+api+web) + `bash supabase/tests/<smoke>.sh` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-08 | 익명 signup(data.name)→is_anonymous·role·profiles.display_name | integration(SQL smoke) | `bash supabase/tests/web_share_smoke.sh` (기존, 익명 signup 단계 재사용) | ✅ 확장 |
| AUTH-08 | 재접속 동일 신원(getUser→member면 게이트 스킵) | unit(web) | `pnpm --filter @moajoa/web test guest-surface` | ❌ Wave 0 |
| SHARE-02 | share_mode별 SSR 렌더 분기(places/dates/both) | unit(web) | `pnpm --filter @moajoa/web test guest-surface` | ❌ Wave 0 |
| SHARE-03 | lazy 게이트: 첫 액션→닉네임→signInAnonymously→join_moa→액션 재개 | unit(web, mocked client) | `pnpm --filter @moajoa/web test guest-surface` | ❌ Wave 0 |
| SHARE-03 | 익명 멤버 RLS 통과(places INSERT editor·votes·trip_messages) | integration(SQL smoke) | `bash supabase/tests/web_share_smoke.sh`(RLS 프로브 확장) | ✅ 확장 |
| SHARE-03 | 날짜투표 device_token=auth.uid 저장·dedup | unit(api) + smoke | `pnpm --filter @moajoa/api test date-polls` | ✅ 확장 |
| SHARE-04 | 게스트 places/votes INSERT가 moa 채널로 fan-out(비멤버 0건) | integration(mjs realtime) | `node supabase/tests/realtime_events_smoke.mjs`(게스트 익명 세션 케이스 추가) | ✅ 확장 |
| SHARE-04 | 순번 #N+1 이어짐(게스트 추가) | integration(SQL 하네스) | `bash supabase/tests/place_seq_concurrency.sh`(익명 세션 추가 케이스) | ✅ 확장 |
| D-03 | linkIdentity 진입점 렌더 + provider:'kakao' 1회 호출 | unit(web) | `pnpm --filter @moajoa/web test guest-promote` | ❌ Wave 0 |
| 0029 | public_trip_poll(slug) anon read 반환 | integration(SQL smoke) | 0029 스모크(신규) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 대상 vitest 파일 (`pnpm --filter <pkg> test <file>`)
- **Per wave merge:** `pnpm test`(core+api+web) + 관련 bash 스모크
- **Phase gate:** 전 스위트 그린 + `web_share_smoke.sh`/`realtime_events_smoke.mjs`/`place_seq_concurrency.sh` exit 0 → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/t/[slug]/_components/guest-surface.test.tsx` — 세션 lifecycle·share_mode 분기·lazy 게이트(SHARE-02/03·AUTH-08 재접속)
- [ ] `apps/web/app/t/[slug]/_components/guest-promote.test.tsx`(또는 login 확장) — linkIdentity 진입점(D-03)
- [ ] `supabase/tests/*` 확장: 익명(비 device_token) 세션의 RLS/realtime/seq_no 케이스 추가 — 기존 하네스 3종에 게스트 케이스 append
- [ ] 0029 스모크: `public_trip_poll(slug)` anon 200 + poll_code 반환
- [ ] Supabase 익명 세션을 vitest에서 목킹하는 공유 픽스처(`auth.getUser`/`signInAnonymously`/`linkIdentity` mock) — 기존 login.test.tsx mock 패턴 재사용

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase 익명 인증(auth.uid) + linkIdentity 승격. 신원=서버 발급 JWT |
| V3 Session Management | yes | `@supabase/ssr` 쿠키 세션 + refresh token rotation(config L46). 서버 세션 접근 금지(캐시) |
| V4 Access Control | yes | RLS deny-by-default + `can_*_trip` SECURITY DEFINER 헬퍼(42P17 회피). join_moa로만 멤버십 |
| V5 Input Validation | yes | 외부 입력 Zod(`@moajoa/core/schemas`, TripMessageCreateSchema 등) + DB CHECK 이중화 |
| V6 Cryptography | no | 신규 암호화 없음(카카오 OAuth는 Supabase 위임) |

### Known Threat Patterns for (익명 인증 + anon-grant RPC)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 익명 세션 남용(추출 비용) | DoS | Phase 27 SEC-01(멤버십 게이트). Phase 25는 멤버십 전제 구조만(D-13) |
| device_token/auth.uid spoof(날짜투표 덮어쓰기) | Tampering | 서버파생 래퍼(§Open Q2) 또는 레거시 신뢰수준 수용(D-01) |
| D-12 삭제 권한 우회(남의 장소 hidden) | Tampering | hard-delete own-only 또는 DEFINER RPC (Pitfall 5) |
| linkIdentity identity 충돌 | Spoofing | 충돌 처리 deferred, 최소 심(D-03) — Phase 25는 진입점만 |
| RLS 크로스테이블 재귀(42P17) | — | 직접 EXISTS 0, DEFINER 헬퍼만(CLAUDE.md §4.4, 전 마이그레이션 준수 확인) |
| 익명 세션 캐시 오염(닉네임/찜 노출) | Info Disclosure | 서버 컴포넌트 쿠키 접근 금지, 쿠키리스 캐시 클라이언트(Pitfall 2) |

## Project Constraints (from CLAUDE.md)

- 마이그레이션 **append-only** — 기존 0016~0028 수정 금지, 신규 0029만 추가(§4.3).
- RLS 크로스테이블은 **SECURITY DEFINER 헬퍼 경유**, 직접 EXISTS 금지(§4.4, §5).
- 외부 입력은 **Zod validate**(`@moajoa/core/schemas`)(§4.5).
- 워크스페이스 import에 **`.js` extension 금지**(§4.5, §5).
- 컬럼 추가는 NULLABLE/DEFAULT(§4.3) — 이 phase는 컬럼 추가 없음(RPC만).
- 마이그레이션 변경 후 **`pnpm supabase:types`** 재생성(§4.3).
- **서비스 롤 키 클라이언트 노출 금지** — 익명도 anon key만(§4.4, §5).
- **iOS 코드 변경 금지**(v2.1 웹 퍼스트 동결, §5). 이 phase는 web + supabase만.
- Conventional Commits, 마이그레이션 PR에 `BREAKING DB CHANGE` 표기(§4.6).

## Sources

### Primary (HIGH confidence)
- repo 마이그레이션: `0016_trips_baseline.sql`(RLS 헬퍼·places/votes/links/memberships 정책·public_trip_view·join_shared_trip), `0018_date_polls.sql`(anon RPC·dedup), `0025_web_share.sql`(join_moa·trip_messages·share_mode), `0026`/`0028`(realtime publication·트리거) — 직접 읽음
- repo 코드: `moa-island.tsx`·`vote-island.tsx`·`poll/[code]/page.tsx`·`public-trip-cache.ts`·`browser.ts`·`device-token.ts`·`member-color.ts`·`memberships.ts`·`date-polls.ts`·`chat.ts` — 직접 읽음
- repo 설정: `supabase/config.toml`(enable_anonymous_sign_ins=true·kakao enabled·manual_linking 부재), `package.json`(supabase-js 2.110.0)
- `.planning/STATE.md`: 23-02/23-04 스모크 실증(is_anonymous·role·join_moa·trip_messages RLS), 원격 push 상태(L56)
- supabase.com/docs/reference/javascript/auth-signinanonymously — options.data 지원 [CITED]

### Secondary (MEDIUM confidence)
- supabase.com/docs/guides/auth/auth-anonymous — authenticated role·is_anonymous 클레임·updateUser/linkIdentity 승격·manual linking 요건·세션 지속 [CITED]
- supabase.com/docs/reference/javascript/auth-linkidentity — 시그니처(credentials.provider) [CITED, 예시는 github]

### Tertiary (LOW confidence)
- linkIdentity의 kakao provider 명시 지원·identity_already_exists 정확 에러명 — 문서 발췌 불완전(A4, 배포 전 확인 권장)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 실제 package.json·config.toml·마이그레이션·스모크로 교차확인
- Architecture(RLS·캐시·realtime): HIGH — 정책 코드 직접 검증 + 기존 스모크 실증
- Pitfalls: HIGH — Pitfall 1/2/4/5는 코드에서 직접 도출(특히 Pitfall 5는 UPDATE vs DELETE 정책 gap 실증)
- linkIdentity 세부(D-03): MEDIUM — 문서 발췌 불완전, manual linking 요건·kakao 지원 배포 전 확인
- 0029 필요성(A2): HIGH — 비멤버 anon이 slug로 poll을 얻을 경로가 RLS상 없음을 확인

**Research date:** 2026-07-10
**Valid until:** 2026-08-09 (안정 스택 30일). supabase-js 버전 고정·auth API 안정.
