# Phase 25: Guest Unified Share (통합 공유화면) - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

게스트가 공유링크 하나(`/t/[slug]`)로 **무설치 참여를 완주**한다. 분리돼 있던 `/t`(장소 열람·찜)와 `/poll`(날짜투표) 화면을 `share_mode` 인지 **단일 화면**으로 통합하고, 게스트 신원을 localStorage device_token → **Supabase 익명 인증(auth.uid)**으로 승격해 `join_moa`·RLS·순번·실시간에 태운다.

**In scope:** 통합 `/t/[slug]` 게스트 화면(호스트 컴포넌트 재사용), 첫-액션 시 익명 인증→닉네임→join_moa, 모드별 찜·장소/링크 추가·날짜투표, 게스트 기여의 호스트 실시간 반영·이어지는 순번, **최소 심 계정 승격(linkIdentity로 이력 유지)**.

**Out of scope (다른 phase):** 추출 EF 멤버십 게이트 실제 구현(Phase 27 SEC-01) · 카피 스윕(Phase 27 NAME-01) · 계정 승격 전체 UX(병합 화면·충돌 처리) · 닉네임 수정 UI.

**Requirements:** AUTH-08, SHARE-02, SHARE-03, SHARE-04 (+ D-03 linkIdentity는 아래 명시대로 추가 스코프).
</domain>

<decisions>
## Implementation Decisions

### 게스트 신원 모델
- **D-01:** 게스트 익명 신원 = **Supabase 익명 인증(`signInAnonymously` → `auth.uid`)**. localStorage `device_token` 신원은 폐기하고, SC3의 "device_token := auth.uid"대로 통일 — 날짜투표(anon poll RPC)도 익명 세션의 `auth.uid`를 device_token 자리에 사용한다. 신원 1개로 찜·장소추가(`added_by`)·날짜투표·채팅 RLS·순번이 일관.
- **D-02:** 익명 세션은 **lazy** — 단순 열람은 비로그인 SSR(무마찰). **첫 참여 액션**(찜/장소·링크 추가/날짜투표) 시점에 `signInAnonymously` → 닉네임 → `join_moa` 순으로 발급. SSR 캐시 무독성(poll 패턴 일치).
- **D-03 (추가 스코프):** **계정 승격 = 최소 심**. 게스트가 카카오로 로그인하면 `supabase.auth.linkIdentity`로 **익명 `auth.uid`를 그대로 정식 계정으로 전환** → 찜·추가 이력·멤버십 유지. 기존 로그인 버튼/플로우 재사용, 별도 병합 화면 없음. (※ 로드맵 원 requirements 목록엔 없던 사용자 추가 결정 — planner가 반영. 전체 승격 UX는 deferred.)

### 닉네임 게이트 & 재접속
- **D-04:** 닉네임 바텀시트 트리거 = **첫 참여 액션**(D-02와 결합). 열람만 하면 뜨지 않음.
- **D-05:** 닉네임 **고정** — 수정 UI 없음(deferred). 재접속 시 Supabase 익명 세션(localStorage refresh token 자동 지속) + 저장 닉네임으로 동일 신원 식별, 게이트 생략.
- **D-06:** 닉네임 **중복 허용** — 신원은 `auth.uid`, 닉네임은 표시 라벨일 뿐. 색으로 추가 구분.
- **D-07:** 게스트 색 = 기존 `member-color.ts` 재사용 — 호스트=브랜드색 고정, 게스트=join순 6색 팔레트 순환. 추가 결정 없음.

### 모드별 화면 구성
- **D-08:** `/t/[slug]`가 **호스트 컴포넌트(`place-list`·`add-sheet`·`moa-island` 실시간)를 재사용**하는 게스트용 통합 화면으로 진화. 게스트도 `[모으기][채팅]` 탭 포함 호스트와 거의 동일. 게스트 쓰기가 호스트와 같은 채널·테이블을 타므로 SC4(실시간 반영·순번 #N+1)·채팅이 자연 통합.
- **D-09:** **`share_mode`가 화면 구성 결정** — `places`→`[모으기]`(+채팅), `dates`→날짜투표 전면, `both`→`[모으기]` 상단 날짜투표 섹션 + 아래 장소리스트. 날짜투표는 기존 anon poll RPC 임베드(`device_token := auth.uid`).
- **D-10:** `/poll/[code]`는 **레거시 유지**(NAV-04 하위호환) — 기존 링크 안 깨짐. 신규 공유는 전부 `/t`로 통일, 리다이렉트 안 함.

### 게스트 권한 & 추출 비용
- **D-11:** 게스트 링크 추가 → **자동 추출 허용**(호스트와 동일, fire-and-forget). `join_moa`로 멤버가 됐으므로 SEC-01("비멤버 차단")을 통과. SHARE-03이 링크추가 명시.
- **D-12:** 게스트는 **자기가 추가한 장소·자기 찜만 삭제** 가능(`added_by = auth.uid` 기준). 남의 기여는 못 건드림.
- **D-13:** SEC-01(추출 EF 멤버십 게이트) **실제 구현은 Phase 27**. Phase 25는 "게스트는 반드시 `join_moa` 후 참여(비멤버 익명 세션은 추출 불가)"라는 **멤버십 전제 구조만** 세팅.

### Claude's Discretion
- 익명 세션 lazy-init을 island 내부 어디서/어떻게 트리거할지, poll RPC를 통합 화면에 임베드하는 구체 방식, SSR 캐시 경계 — planner/research 재량.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 로드맵·요구사항
- `.planning/ROADMAP.md` §Phase 25 — goal·SC1~4·depends_on. §Phase 27 — SEC-01/NAME-01 경계(이번 phase가 전제만 세팅).
- `.planning/REQUIREMENTS.md` — AUTH-08, SHARE-02/03/04(§공유), MOA-03/04/06(호스트·게스트 공통), NAME-01/SEC-01(Phase 27), "게스트 계정 승격 UI — 다음 단계"(D-03이 최소 심으로 일부 당김).

### 재사용 대상 코드 (기존 자산)
- `apps/web/app/t/[slug]/page.tsx` + `_components/{map-section,public-board-map,vote-island}.tsx` — 현재 비로그인 SSR 공유뷰. 통합 화면의 출발점.
- `apps/web/app/poll/[code]/page.tsx` + `_components/{poll-vote-island,poll-chat}.tsx` — 기존 익명 날짜투표(닉네임 게이트·presence·anon RPC). dates 모드 임베드 소스 + 레거시 유지.
- `apps/web/app/moa/[id]/_components/{moa-island,place-list,add-sheet,moa-chat,moa-tab-bar}.tsx` — 호스트 realtime 허브·컴포넌트. D-08 재사용 대상.
- `packages/api/src/queries/memberships.ts` — `joinMoa(slug)` RPC(0025, SECURITY DEFINER, auth.uid로 voter join, idempotent).
- `packages/api/src/queries/date-polls.ts` — `castDateVote` 등 anon poll RPC(device_token 파라미터 → auth.uid로 전환 대상).
- `apps/web/lib/device-token.ts` — 현재 닉네임/토큰 localStorage 헬퍼. 익명-세션 닉네임 저장으로 용도 조정.
- `apps/web/lib/member-color.ts` — D-07 게스트 색.

### 마이그레이션·설정
- `supabase/migrations/0025_*.sql` — `join_moa` RPC(기존). 
- ⚠️ Supabase **Anonymous Sign-ins**를 프로젝트 Auth 설정에서 활성화해야 함(설정 게이트). date-poll RPC의 device_token→auth.uid 통일 및 anon RLS 영향은 새 마이그레이션이 필요할 수 있음(append-only 신규 번호).

### 이전 phase 결정(이어받음)
- `.planning/phases/26-realtime-chat/26-CONTEXT.md` — D-02 `[모으기][채팅]` 클라이언트 상태 탭바, D-09 게스트 채팅 표면은 Phase 25 몫(join_moa 멤버십 = 채팅 RLS SELECT 전제).
- `.planning/phases/24-*/24-CONTEXT.md` — D-11 AddContentTabs, D-13 링크추가 fire-and-forget 추출, D-18 shareMoa→클립보드.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `joinMoa(slug)` RPC: 백엔드 준비 완료 — 익명 세션 발급 직후 호출.
- `/t/[slug]` SSR 셸 + `getCachedPublicTrip`: 첫 페인트 캐시(SC1) 이미 존재. 가변 데이터는 클라이언트 하이드레이션.
- `moa-island` realtime 허브: 단일 `moa:{tripId}` 채널(places INSERT·votes·trip_messages·presence). 게스트 화면이 이걸 재사용하면 SC4가 자동 충족.
- `place-list`·`add-sheet`·`moa-chat`·`moa-tab-bar`: props-driven, 재사용 용이.
- poll anon RPC(`castDateVote`) + `poll-vote-island`: dates 모드 임베드 소스.

### Established Patterns
- 익명 열람 SSR + 클라이언트 하이드레이션(쿠키리스 캐시 무독성, RESEARCH Pitfall 2).
- 단일 채널/화면(Phase 26 "한 토픽 채널 2개 금지").
- fire-and-forget 추출(D-13), 낙관적 찜+rollback(vote-island).

### Integration Points
- `/t/[slug]/page.tsx`: VoteIsland → 게스트용 moa-island(또는 확장)로 교체.
- 익명 세션 lazy-init 지점: 첫 참여 액션 핸들러(찜/추가/투표) 진입부.
- date-poll RPC: device_token 인자 → `auth.uid` 소스로 전환.
</code_context>

<specifics>
## Specific Ideas

- 신원 통일이 이 phase의 뼈대: **"익명 세션 auth.uid 하나가 찜·추가·투표·채팅·순번·멤버십을 전부 담는다."**
- Supabase Anonymous Sign-ins 활성화 + `linkIdentity`(익명→카카오) 패턴은 research가 공식 문서로 확인 필요(핵심 리스크).
- dates 모드 날짜투표는 새로 만들지 말고 기존 poll RPC/컴포넌트를 임베드(device_token 자리만 auth.uid로).
</specifics>

<deferred>
## Deferred Ideas

- **게스트 계정 승격 전체 UX** — 병합 화면·기존 카카오 계정과의 충돌 처리 등. 이번엔 linkIdentity 최소 심(D-03)만.
- **닉네임 수정 UI** — 이번엔 고정(D-05).
- **추출 EF 멤버십 게이트 실제 구현** — Phase 27 SEC-01. 이번엔 멤버십 전제 구조만(D-13).
- **카피 스윕(보드→모아, 가고싶어→찜)** — Phase 27 NAME-01.

### Reviewed Todos (not folded)
없음 — todo 매칭 미실행(gsd-tools 환경).
</deferred>

---

*Phase: 25-guest-unified-share*
*Context gathered: 2026-07-10*
