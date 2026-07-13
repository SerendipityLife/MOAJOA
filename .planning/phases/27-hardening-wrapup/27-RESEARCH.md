# Phase 27: Hardening & 마감 - Research

**Researched:** 2026-07-13
**Domain:** Edge Function 멤버십 게이트(SEC-01) · 유저 대면 카피 스윕(NAME-01) · 문서 마감 · 통합 UAT
**Confidence:** HIGH (전 항목 코드베이스 실측 — 외부 라이브러리 신규 도입 0)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SEC-01: 추출 게이트 설계**
- **D-01: extract-youtube에 generate-plan의 멤버십 체크(T-18-09)를 미러.** 스카우트 실측: `extract-youtube`는 `verify_jwt=true` + `auth.getUser` 게이트(T-18-08, anon-key/service 토큰 거부)까지만 있고 **멤버십 체크가 없음** — 익명 세션도 real user session이라 getUser를 통과하므로 비멤버가 임의 `link_id`로 유료 LLM 왕복을 트리거 가능(SEC-01의 정확한 갭). `generate-plan/index.ts`가 이미 같은 EF에서 복사한 getUser 게이트 위에 can_edit_trip 미러 체크(T-18-09: service-role 쿼리로 owner OR accepted owner/editor membership, **유료 호출 전에** 검사)를 얹은 하우스 패턴이 있음 — extract-youtube는 `link_id → links.board_id(trip)` 경유로 같은 체크를 추가한다. 신규 마이그레이션·RPC 0 (기대).
- **D-02: 거부 응답은 generate-plan과 동일 포맷** — 유료 작업 전 403 `jsonError`. 클라이언트 신규 UI 0: `triggerExtraction`은 대부분 fire-and-forget(`.catch(console.error)`)이고 수동 재시도 경로는 기존 에러 토스트가 이미 처리. join_moa로 승격된 게스트(editor, accepted)는 멤버이므로 통과 — 게스트 링크 추가 흐름 무회귀.
- **D-03: 다른 유료 EF는 무변경.** `generate-plan`은 이미 게이트 완비(T-18-08/09). `resolve-place`는 온보딩 검색용으로 trip 컨텍스트가 없어 멤버십 게이트 자체가 부적용 — 범위 외. (research/plan 중 resolve-place에 getUser 게이트 부재가 확인되면 변경하지 말고 deferred로 flag만.)

**NAME-01: 카피 스윕 범위**
- **D-04: 라이브 유저 대면 표면만 스윕.** 스카우트 실측: "보드"는 이미 스윕 완료(잔여 grep 히트는 클립보드/대시보드 오탐뿐). "가고싶어" 잔여 라이브 표면 = `apps/web/app/t/[slug]/_components/guest-surface.tsx`(aria-label + 버튼 카피) + `apps/web/app/t/[slug]/page.tsx`(안내 문구 "가고싶어!"). 랜딩·로그인·OG·poll 푸터는 plan 단계에서 grep 전수 재확인(현재 스카우트로는 잔여 0으로 보임). 코드 식별자(love, vote 등)·개발자 주석은 유지 — 유저 대면 문자열만.
- **D-05: 변경 파일의 테스트 카피 단언은 같은 커밋에서 동기화** (SC-2 명시 요건).
- **D-06: 레거시 `vote-island.tsx`는 스윕 제외.** 25-03에서 GuestSurface로 교체된 뒤 자기 테스트(`vote-island.test.tsx`)에서만 임포트되는 dead code — 유저 대면 아님. 삭제하지 않고(수술적 변경 원칙) deferred 정리 항목으로만 기록. 해당 테스트의 가고싶어 단언도 그대로 유지(컴포넌트와 일관).

**2인극 UAT 구성**
- **D-07: 통합 UAT — 잔여 검증 전부 합류** (사용자 지시: "28까지 완료 후 통합 UAT"). Phase 27 SC-3 시나리오(호스트 A: 로그인→온보딩→유튜브 링크→핀→'둘다' 공유 / 게스트 B 시크릿: 즉시 렌더→닉네임 게이트→날짜투표+장소추가→채팅 "#3 어때?" / A 복귀: 실시간·찜순·순번 불변)를 축으로, 다음을 같은 UAT 문서에 합류:
  - Phase 25 잔여: iPhone 실기기 재확인(공유시트 footer CTA·달력 nav·하트) · Test 4 카카오 승격(linkIdentity) · 크로스브라우저 실시간
  - Phase 28 라이브 2건: 날짜 미정+기간 pill "2박3일"→'일정 만들기'→Day 탭 3개 · 장소 Day 3 수동 이동→'일정 다시 만들기'→위치 유지
  - presence 확인: 채팅 "지금 N명 보는 중" 입장·퇴장 실시간 수렴 (folded todo)
  - SEC-01 게이트 실증: 비멤버 익명 세션의 extract-youtube 직접 호출 403
- **D-08: 하이브리드 실행** — Claude가 브라우저 두 컨텍스트(일반+시크릿)로 자동 실증 가능한 항목을 먼저 소진하고, human-only 항목(카카오 실로그인·iPhone 실기기·카카오 승격)은 `27-HUMAN-UAT.md` 체크리스트로 분리(25-HUMAN-UAT 선례 포맷).
- **D-09: UAT에서 presence 정상 확인 시 `supabase-js-upgrade-presence` todo를 닫는다** — 근거(GAP-19D)는 supabase-js 2.45.4 시절이고 24-01에서 2.110.0으로 업그레이드됨, Phase 26 채팅 presence가 같은 스택 위에 구현됨. 확인 실패 시 todo 유지 + 증상 갱신.

### Claude's Discretion
- **문서 마감 깊이**: WORKSTREAMS.md·ARCHITECTURE.md의 역할 기술(웹=열람 전용 서술 등 v2.1 피봇 이전 잔재)을 현재 상태(웹=입력·저장·편집 풀 서피스, Phase 23~28 결과)로 갱신 — 범위·문장은 Claude 재량. 전면 재작성 아님, 역할 기술 수정 수준.
- **revalidate 확인 방법**: `/api/revalidate` 라우트 + `TRIP_REVALIDATE_TAG` 경로가 공유 페이지(/t/[slug]) 캐시를 실제로 갱신하는지 확인 — 스모크 방식은 재량.
- **UAT 문서 구조·순서**: SC-3 통과 판정 기준이 명확하면 시나리오 세부 구성은 재량.

### Deferred Ideas (OUT OF SCOPE)
- **레거시 `vote-island.tsx` + `vote-island.test.tsx` 삭제** — 25-03 GuestSurface 교체 후 dead code (자기 테스트에서만 임포트). 별도 정리 커밋/phase 몫 (D-06).
- **resolve-place getUser 게이트 여부** — 확인만, 이번 phase에서 변경 금지 (D-03). 부재 시 향후 하드닝 항목.
- Reviewed Todos (not folded): eas-ios-sharesheet-verify (iOS 동결 범위 외) · maplink-place-enrichment (키/비용 블록) · transcript-fallback-no-description (외부 서비스 블록)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | 추출 트리거(Edge Function)가 해당 모아의 멤버에게만 허용된다 (익명 세션의 추출 비용 남용 차단) | §게이트 삽입 지점 실측 — `extract-youtube/index.ts` getUser 게이트 L71-79 뒤·claim UPDATE L119 앞, `links.trip_id` 경유(§주의: board_id 아님), generate-plan L116-140 verbatim 미러 코드, 회귀 경로 전수(§게이트 회귀 분석), 무비용 검증 트릭(§Code Examples), 배포 명령 `--use-api`(§Pitfalls) |
| NAME-01 | 유저 대면 카피 전반에서 보드→"모아", 가고싶어→"찜"으로 표기된다 (코드 식별자는 유지) | §카피 스윕 전수 실측 — 라이브 잔여 3곳 파일:라인, "보드" 잔여 0 확인, 테스트 단언 영향 실측(guest-surface.test는 testid만 사용 → 단언 변경 0 예상, 재확인 grep 명령 제공) |
</phase_requirements>

## Summary

Phase 27은 신규 기능 0의 마감 phase다. 네 갈래 — (1) SEC-01 게이트: `extract-youtube` EF에 generate-plan의 검증된 2단 게이트 중 빠진 멤버십 체크를 이식, (2) NAME-01 카피: 라이브 표면 정확히 2파일 3곳의 "가고싶어"→"찜", (3) 문서: WORKSTREAMS·ARCHITECTURE의 v1 시절 역할 기술(웹=열람 전용) 갱신 + revalidate 확인, (4) 통합 UAT: SC-3 2인극 + Phase 25/28 잔여 + presence 폴드.

전 항목을 코드베이스에서 실측 완료했다. 핵심 발견 3가지: **(a)** CONTEXT D-01의 "links.board_id"는 구 표기 — 실제 컬럼은 `links.trip_id`다 (0016 baseline에서 boards→trips 개명, `index.ts` L145·L372에서 이미 `link.trip_id` 사용 중). **(b)** 게이트 삽입 최적 지점은 claim UPDATE(L119) **앞**이다 — claim 자체가 DB 쓰기(extraction_status→processing)라서 비멤버가 링크 상태를 오염시킬 수 있고, 기존 trip fetch(L144-149)를 앞으로 당겨 `owner_id`를 추가 select하면 신규 쿼리 1개(memberships)로 끝난다. **(c)** revalidate 확인 재량 항목에서 실제 갭 발견 — extract-youtube의 revalidate webhook은 `visibility === 'public'`일 때만 발화하는데(L426), v2.1 웹 공유(`shareMoa`)는 `visibility='shared'`를 쓰고 `/t/[slug]`는 'shared'도 렌더한다 → 공유된 모아의 추출 완료가 SSR 캐시를 갱신하지 않음(1h TTL 폴백에만 의존). D-01로 같은 파일을 이미 수정·재배포하므로 조건 1줄 확장이 자연스러운 해소책 (Claude 재량 범위 내 권고).

**Primary recommendation:** generate-plan L116-140을 trip_id 어휘로 verbatim 이식하되 claim 앞에 배치하고, 게이트 검증은 'ready' 링크에 대한 호출로 무비용 실증(멤버=409, 비멤버=403 — 유료 API 발화 0), 배포는 `supabase functions deploy extract-youtube --use-api`(colima 함정).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 추출 멤버십 게이트 (SEC-01) | Edge Function (Deno) | — | 비용 남용 차단은 서버 강제여야 함. 클라이언트는 무변경 (D-02) |
| 카피 스윕 (NAME-01) | Web 클라이언트 (RSC + island) | 테스트 (동커밋) | 유저 대면 문자열만 — DB/식별자/주석 무접촉 |
| 문서 역할 기술 | docs/ (마크다운) | — | 코드 무접촉 |
| revalidate 경로 | Web API route (Node runtime) | Edge Function (webhook 발신) | 캐시 무효화는 Next.js 쪽, 트리거는 EF 쪽 — 갭은 EF 발신 조건에 있음 |
| 통합 UAT | 라이브 배포 (Vercel + Supabase 원격) | 로컬 스모크 (게이트 403) | SC-3은 프로덕션 2브라우저, 게이트는 로컬 curl로도 실증 가능 |

## Standard Stack

**신규 의존성 0.** 이 phase는 기존 스택 위의 게이트·카피·문서·검증만이다.

### Core (기존 — 버전 실측)
| Library | Version | Purpose | 확인 위치 |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.110.0 | web/api 클라이언트 (presence 확인 대상 D-09) | `apps/web/package.json` L24, `packages/api/package.json` L21 `[VERIFIED: 코드베이스]` |
| @supabase/ssr | ^0.12.0 | web SSR 클라이언트 | `apps/web/package.json` L23 `[VERIFIED]` |
| Deno | 2.8.0 | EF 런타임·테스트 | `deno --version` 실측 `[VERIFIED]` |
| supabase CLI | 2.101.0 | EF 배포·로컬 스택 | `supabase --version` 실측 `[VERIFIED]` |
| zod (EF) | npm:zod@3 | EF 요청 검증 (기존) | `extract-youtube/deno.json` `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| service-role 미러 쿼리 (generate-plan 패턴) | `can_edit_trip` RPC 직접 호출 | RPC는 `auth.uid()` 기반이라 service-role 컨텍스트에서 null — generate-plan 주석이 이미 이 이유로 미러를 선택 (L117-119). 미러 유지 (D-01 잠금) |
| curl 스모크로 게이트 검증 | index.ts 단위 테스트 하네스 신설 | EF index.ts는 `Deno.serve` 핸들러라 기존 테스트 하네스 부재(pipeline/*.test.ts만 존재). 하네스 신설은 범위 초과 — 스모크가 하우스 선례 (T-18-08도 동일) |

## Architecture Patterns

### 게이트 데이터 흐름 (SEC-01 — 목표 상태)

```
클라이언트 (member 세션) ──POST {link_id}──▶ extract-youtube EF
                                              │
                              [1] verify_jwt=true (게이트웨이, config.toml L74-75 기존)
                                              │
                              [2] auth.getUser(token) — L71-79 기존 (T-18-08)
                                              │  anon-key/service 토큰 → 401
                              [3] link 로드 (L93-100 기존) → link.trip_id 획득
                                              │  KNOWN_SOURCES 체크 (L104-107 기존)
                              [4] ★신규: trip 로드(owner_id 포함) + 멤버십 체크
                                              │  owner OR accepted owner/editor 아니면 → 403
                              [5] claim UPDATE (L119 기존 — 첫 DB 쓰기)
                                              │
                              [6] 유료 파이프라인 (oEmbed→transcript→Claude→Places)
```

**삽입 지점 근거:** generate-plan 주석 "Must happen BEFORE any paid Claude/Routes call"(L117). extract-youtube에서 첫 유료 호출은 L219(Claude)지만, claim UPDATE(L119)가 이미 DB 상태 변이(`extraction_status→processing`)라서 비멤버가 남의 링크를 'processing'으로 오염 가능 — 게이트는 **claim 앞** L107~108 사이가 정답. 부수 효과: 기존 trip fetch(L144-149, `city_code, share_slug, visibility` select)를 게이트 위치로 당기고 `owner_id`를 select에 추가하면 trip 쿼리 재사용 — 신규 쿼리는 memberships 1개뿐. `[VERIFIED: index.ts 실측]`

### 멤버십 시맨틱 (can_edit_trip 미러 — 0016 L313-336)

owner(`trips.owner_id = caller`) OR memberships 행이 존재하며 `accepted_at IS NOT NULL` AND `role IN ('owner','editor')`. `[VERIFIED: 0016_trips_baseline.sql L313-336]`

**join_moa 승격 게스트 통과 확인** (`0025` L64-93 실측): `insert into memberships (..., role, accepted_at) values (..., case when share_mode in ('places','both') then 'editor' else 'voter' end, now())` — places/both 게스트는 editor + accepted_at=now() → 게이트 통과. dates 게스트는 voter → 게이트 거부지만 **dates 모드 게스트 표면엔 링크 추가 UI 자체가 없고**(guest-surface dates 분기는 poll만 렌더) links INSERT RLS도 `can_edit_trip`이라 애초에 링크를 못 만든다 — 회귀 0. `[VERIFIED: 0025 마이그레이션 + guest-surface.tsx 분기 실측]`

### 게이트 회귀 분석 — triggerExtraction 호출부 전수 `[VERIFIED: grep 전수]`

| 호출부 | 파일:라인 | 호출자 컨텍스트 | 에러 처리 (기존) | 회귀 |
|--------|----------|----------------|-----------------|------|
| 온보딩 제출 | `apps/web/app/onboarding/page.tsx:120` | 방금 trip 생성한 owner | fire-and-forget `.catch(console.error)` | 없음 |
| add-sheet (호스트/게스트 공용) | `apps/web/app/moa/[id]/_components/add-sheet.tsx:61` | 호스트=owner / 게스트=join_moa 후 editor·accepted | fire-and-forget `.catch(console.error)` | 없음 |
| moa-island 재시도 | `apps/web/app/moa/[id]/_components/moa-island.tsx:459` | 멤버 (재시도 버튼은 멤버 화면에만) | `.catch(() => toast('장소를 찾지 못했어요'))` — D-02가 말한 기존 토스트 | 없음 |
| 게스트 add 경로 | guest-surface → MoaIsland 마운트는 **join_moa 성공 후에만** (25-03 Pitfall 4) | editor·accepted | add-sheet과 동일 | 없음 |

`triggerExtraction` 래퍼(`packages/api/src/queries/links.ts:61-70`): `client.functions.invoke('extract-youtube', ...)` — supabase-js functions.invoke는 non-2xx에서 error를 반환하고 래퍼가 throw → 403은 기존 error throw 경로로 전파. 시그니처 무변경 (D-02). generate-plan의 403이 이미 같은 경로로 프로덕션 동작 중이라 검증된 전파 방식. `[VERIFIED: links.ts 실측 + generate-plan 라이브 선례]`

### NAME-01 카피 스윕 전수 실측 `[VERIFIED: grep -rn "가고싶어"·"보드" apps/web packages 전수, 2026-07-13]`

**변경 대상 (라이브 표면 — 정확히 2파일 3곳):**

| 파일:라인 | 현재 문자열 | 비고 |
|----------|------------|------|
| `apps/web/app/t/[slug]/_components/guest-surface.tsx:319` | `aria-label="가고싶어"` | read-only 비멤버 뷰 하트 버튼 |
| `apps/web/app/t/[slug]/_components/guest-surface.tsx:325` | 버튼 텍스트 `가고싶어` (+count) | 같은 버튼 |
| `apps/web/app/t/[slug]/page.tsx:115` | `가고 싶은 곳에 <span>가고싶어!</span>를 눌러주세요.` | SSR 초대 카드 안내 문구 |

**변경 제외 (근거 포함):**
- `vote-island.tsx` L221·235·293·310 + `vote-island.test.tsx` L121·148·187·206 — dead code, D-06 잠금
- `map-section.tsx:11` — 개발자 주석 (D-04: 주석 유지)
- "보드" 라이브 잔여 **0** — 전수 grep 히트는 `share-sheet.tsx:25,173`(주석 "클립보드")·`guest-promote.tsx:19`(주석 "대시보드")·`share-sheet.test.tsx:147`("클립보드")·`vote-island.test.tsx:149`("이 보드에 참여하기" — dead-code 테스트, D-06 제외)뿐
- 랜딩(`app/page.tsx`)·로그인(`app/login`)·poll(`app/poll`)·OG(`opengraph-image`)·metadata — "가고싶어"·"보드" 히트 0 `[VERIFIED]`

**테스트 단언 영향 (D-05):** `guest-surface.test.tsx`는 하트 버튼을 `data-testid="guest-vote-{id}"`로만 조회 — "가고싶어" 텍스트/aria 단언 없음. `page.tsx` 문구를 단언하는 테스트도 없음(`metadata.test.ts`·`og-image.test.ts` 히트 0). **예상 테스트 변경 0** — 단, plan acceptance에 재확인 grep(`grep -rn "가고싶어" apps/web --include="*.test.tsx" | grep -v vote-island`) 포함 권장. `[VERIFIED: 테스트 파일 실측]`

**호스트 표면은 이미 "찜" 사용 중** (moa-island·place-list 주석·prop 문서) — 신규 어휘 도입이 아니라 잔여 정리. `[VERIFIED]`

### 문서 마감 대상 실측 `[VERIFIED: docs 실측]`

| 파일 | 위치 | 잔재 내용 | 갱신 방향 |
|------|------|----------|----------|
| `docs/WORKSTREAMS.md` | §2 (L46-48) | "Web — 공개 보드 열람", "본래 web의 역할은 **열람·공유 랜딩**만", `/b/[slug]`·dev-tools 격리 할 일 목록 | 웹=입력·저장·편집 풀 서피스 (v2.1 피봇, Phase 23~28). `/t/[slug]`·`/moa`·`/onboarding` 현행 라우트 |
| `docs/WORKSTREAMS.md` | §1 (iOS) | `apps/ios/app/boards/[id].tsx` 등 구 라우트 기반 할 일 목록 | iOS = v2.1 전면 동결 명시 (트립 4탭 구조는 v2.0 산출물) |
| `docs/ARCHITECTURE.md` | L19-21 | 헤딩 "Next.js for Web (열람), Expo for iOS (저장)" | 역할 반전 반영 |
| `docs/ARCHITECTURE.md` | Data flow 2개 | `[iOS] Share Sheet` 기점 + `board_id` + `/b/<slug>` 어휘 | 웹 기점 흐름 + trip_id + /t/[slug] (재량 — 역할 기술 수정 수준, 전면 재작성 아님) |

### revalidate 경로 실측 + 갭 (재량 항목의 실제 발견)

**배선 (정상):** `apps/web/app/api/revalidate/route.ts` — POST `{slug, secret}` → Zod → `timingSafeEqual`(Node runtime) → `revalidateTag(TRIP_REVALIDATE_TAG(slug))`. 태그 `trip:{slug}`는 `apps/web/lib/public-trip-cache.ts:13`에 정의, `getCachedPublicTrip`의 `unstable_cache` tags + `revalidate: 3600`(1h TTL 폴백)에 배선. `/t/[slug]/page.tsx`와 `opengraph-image`가 같은 fetcher를 공유하므로 태그 1개로 두 표면 동시 무효화. 단위 테스트 `api-revalidate.test.ts` 존재. `[VERIFIED]`

**갭 (발견):** webhook 발신 측 `extract-youtube/index.ts:426` — `if (trip?.visibility === 'public' && trip.share_slug)`일 때만 POST. 그런데:
- v2.1 웹 공유 `shareMoa`(`packages/api/src/queries/trips.ts:219`)는 `visibility: 'shared'`로 UPDATE
- `/t/[slug]`의 `public_trip_view`(0029 L29·L107)는 `visibility in ('public','shared')` 렌더

→ **공유된('shared') 모아에서 추출이 완료돼도 revalidate webhook이 발화하지 않는다.** SSR 첫 페인트(장소 리스트 스냅샷)와 OG 핀 수가 최대 1h stale. 가변 데이터는 클라이언트 하이드레이션이 커버하므로 심각도는 낮으나, "revalidate 확인" SC를 라이브로 검증하면 shared 트립에서 실패한다. **권고:** D-01이 같은 파일을 수정·재배포하므로 발신 조건을 `['public','shared'].includes(trip?.visibility)`로 1줄 확장 — Claude 재량 범위("revalidate 확인") 내 자연스러운 해소. 문서화-only도 가능하나 마감 phase 취지상 fix 권장. `[VERIFIED: 3파일 교차 실측]`

### Anti-Patterns to Avoid
- **게이트를 claim 뒤에 배치:** 비멤버 호출이 링크를 'processing'으로 오염 (10분 stale 창) — 반드시 claim 앞
- **can_edit_trip RPC를 EF에서 직접 호출:** service-role 컨텍스트에서 `auth.uid()` null → 항상 false. 미러 쿼리 필수 (generate-plan L117-119 주석)
- **aria-label을 코드 식별자로 오인해 스킵:** aria-label은 스크린리더 유저 대면 — NAME-01 대상 (guest-surface L319)
- **`pnpm --filter @moajoa/web test` bare 실행:** watch 모드 진입 (`"test": "vitest"`) — CI=true 또는 `test:run` 사용

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 멤버십 판정 로직 | 새 판정 규칙·RPC | generate-plan L116-140 미러 (owner OR accepted owner/editor) | 프로덕션 검증 완료(Phase 18·28 라이브), 0016 can_edit_trip과 시맨틱 정합 |
| 403 응답 포맷 | 새 에러 shape | 기존 `jsonError(403, 'forbidden')` 헬퍼 (extract-youtube L538-543 기존) | 클라이언트 throw 경로 무변경 (D-02) |
| 익명 세션 부트스트랩 (게이트 스모크) | 새 인증 스크립트 | `supabase/tests/web_share_smoke.sh` L12-29 패턴 (`POST /auth/v1/signup` + anon key) | 익명 signup·join_moa 케이스 이미 구현 — append 확장이 선례 (25-05) |
| UAT 문서 포맷 | 새 템플릿 | `25-HUMAN-UAT.md` 포맷 (frontmatter + Tests[expected/result] + Summary + Gaps) | D-08 잠금 — 25 선례 계승 |

**Key insight:** 이 phase의 전 산출물이 기존 하우스 패턴의 이식·완성이다. 신규 설계가 하나라도 등장하면 범위 초과 신호.

## Common Pitfalls

### Pitfall 1: EF 코드 머지 ≠ 배포
**What goes wrong:** index.ts 수정 후 main push만 하면 프로덕션 extract-youtube는 구버전 그대로 — 게이트 미적용 상태로 UAT 진행.
**How to avoid:** `supabase functions deploy extract-youtube --use-api` 후 `supabase functions list`로 version bump 확인 (generate-plan v2 배포 선례, STATE L394).
**Warning signs:** 라이브에서 비멤버 403이 안 나오면 배포 누락부터 의심.

### Pitfall 2: colima에서 기본 `functions deploy` 실패
**What goes wrong:** `failed to open eszip: ENOENT ... /var/folders/...` — colima는 `$HOME`만 VM 마운트하는데 CLI가 macOS 임시 디렉터리에 번들 출력. `[VERIFIED: STATE L395 실측 기록]`
**How to avoid:** `--use-api` 플래그 (서버측 번들링, docker 불필요).

### Pitfall 3: 게이트 검증에서 유료 API 발화
**What goes wrong:** 멤버 통과 케이스를 pending 링크로 검증하면 Claude+Places 실호출 (비용).
**How to avoid:** `extraction_status='ready'`인 링크로 호출 — 게이트가 claim 앞이므로 멤버=409("already extracted"), 비멤버=403. 두 응답 코드 차이만으로 게이트 실증, 유료 호출 0. (아래 Code Examples 참조)

### Pitfall 4: web 테스트 watch 모드
**What goes wrong:** `apps/web`의 `test` 스크립트는 bare `vitest` — CI 없이 실행하면 watch로 매달림.
**How to avoid:** `pnpm --filter @moajoa/web test:run` 또는 `CI=true pnpm -r test`. `[VERIFIED: package.json + 메모리 선례]`

### Pitfall 5: 익명 signup rate limit
**What goes wrong:** 게이트 스모크 반복 실행 시 익명 signup IP당 30/hr 제한 (web_share_smoke.sh L5 주석). UAT 중 시크릿 브라우저 반복 재생성도 소모.
**How to avoid:** 스모크에서 세션 재사용, UAT에서 게스트 세션 보존.

### Pitfall 6: CONTEXT의 "links.board_id"를 그대로 구현
**What goes wrong:** 컬럼은 `links.trip_id` (0016 baseline이 boards→trips 개명). board_id로 select하면 즉시 에러.
**How to avoid:** `link.trip_id` 사용 — index.ts L145·L372가 이미 쓰는 어휘. `[VERIFIED: 0016 L365 + index.ts]`

### Pitfall 7: 문서 갱신이 CLAUDE.md·모노레포 구조 서술과 충돌
**What goes wrong:** WORKSTREAMS 재작성 중 CLAUDE.md §4.1(이미 v2.1 반영됨)과 다른 서술 도입.
**How to avoid:** CLAUDE.md §4.1·§5의 현행 서술(웹=입력·저장·편집 풀 서피스, iOS 동결)을 기준 어휘로 사용.

### Pitfall 8: presence 확인을 /poll에서만 수행
**What goes wrong:** folded todo의 원 증상은 /poll presence지만, D-07의 확인 표면은 모아 채팅("지금 N명 보는 중", `moa:{tripId}` 채널). 채팅 presence만 확인하고 todo를 닫으면 /poll 잔여 여부 미확인.
**How to avoid:** D-09 문면상 "채팅 presence 입장·퇴장 수렴" 확인이 기준 — 같은 supabase-js 2.110.0 스택이므로 채팅 수렴 확인으로 todo 닫기 충분 (todo의 근본 원인이 SDK 버전이었고 이미 해소된 버전). /poll 별도 확인은 선택.

## Code Examples

### 미러 원본 — generate-plan T-18-09 게이트 (L116-140 verbatim)
```typescript
// Source: supabase/functions/generate-plan/index.ts L116-140 [VERIFIED]
// ---- Edit-rights check (T-18-09, Security V4) -------------------------------
// Must happen BEFORE any paid Claude/Routes call. Mirror the can_edit_trip
// helper (0016 L313-336) with a service-role query, since auth.uid() is null
// under the service role: owner OR an accepted owner/editor membership.
const { data: trip, error: tripErr } = await admin
  .from('trips')
  .select('id, owner_id, start_date, end_date, day_count')
  .eq('id', trip_id)
  .maybeSingle();
if (tripErr) return jsonError(500, tripErr.message);
if (!trip) return jsonError(404, 'trip not found');

let canEdit = trip.owner_id === callerId;
if (!canEdit) {
  const { data: membership } = await admin
    .from('memberships')
    .select('role, accepted_at')
    .eq('trip_id', trip_id)
    .eq('user_id', callerId)
    .maybeSingle();
  canEdit = !!membership &&
    membership.accepted_at !== null &&
    (membership.role === 'owner' || membership.role === 'editor');
}
if (!canEdit) return jsonError(403, 'forbidden');
```

### extract-youtube 이식 스케치 (삽입 지점: L107 KNOWN_SOURCES 체크 뒤, L108 claim 앞)
```typescript
// 기존 L144-149 trip fetch를 이 위치로 이동 + owner_id 추가 select.
// callerId는 기존 getUser 게이트(L76-79)의 caller.user.id.
const { data: trip, error: tripErr } = await admin
  .from('trips')
  .select('owner_id, city_code, share_slug, visibility') // owner_id 추가, 나머지 기존 용도 유지
  .eq('id', link.trip_id)                                 // ★ trip_id (board_id 아님)
  .maybeSingle();
if (tripErr) return jsonError(500, tripErr.message);
if (!trip) return jsonError(404, 'trip not found');
// 이하 canEdit 블록은 generate-plan verbatim (trip_id → link.trip_id 어휘만)
```
주의: 기존 L144-149의 후속 사용처(`trip?.city_code` L162, revalidate 블록 L426)는 이동 후에도 같은 변수로 동작 — 단 `maybeSingle` null 허용이 `jsonError(404)`로 강화되므로 기존 "trip 없어도 진행" 시맨틱이 바뀐다 (링크가 있는데 trip이 없는 경우는 FK cascade상 불가능이라 실질 무영향).

### 무비용 게이트 스모크 (Pitfall 3 트릭)
```bash
# Source: supabase/tests/web_share_smoke.sh 익명 signup 패턴 재사용 [VERIFIED]
# 전제: extraction_status='ready'인 link_id (기존 trip에서 조회)
# (1) anon key 원시 토큰 → 401 (T-18-08 기존 게이트)
curl -s -o /dev/null -w "%{http_code}" -X POST "$API/functions/v1/extract-youtube" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$READY_LINK_ID\"}"   # expect 401
# (2) 비멤버 익명 세션 → 403 (신규 게이트, SEC-01 핵심)
GUEST_TOKEN=$(curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{}' | jq -r .access_token)
# → expect 403 (join_moa 미호출 상태)
# (3) 멤버(owner) 세션 → 409 "already extracted" (게이트 통과 실증, 유료 호출 0)
```

### EF 테스트 실행 (기존 하네스 — index.ts 미포함 주의)
```bash
# Source: supabase/functions/extract-youtube/deno.json tasks.test [VERIFIED]
cd supabase/functions/extract-youtube && deno task test
# = deno test --allow-net --allow-env --allow-read pipeline/*.test.ts
# pipeline 모듈만 — index.ts 핸들러 게이트는 위 curl 스모크로 검증 (하우스 선례)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| boards/board_id 어휘 | trips/trip_id (0016 baseline squash) | Phase 17 (2026-06-21) | CONTEXT D-01의 "board_id"는 정정 필요 — 실제 `links.trip_id` |
| supabase-js 2.45.4 (presence 깨짐 GAP-19D) | 2.110.0 (24-01 업그레이드) | Phase 24 (2026-07) | D-09 presence todo가 stale일 가능성 높음 — UAT 확인으로 닫기 |
| 웹=열람 전용 (D26) | 웹=입력·저장·편집 풀 서피스 | Phase 23 (2026-07-08 공식 반전) | docs 2종의 역할 기술이 이 반전 이전 상태 — 이번 phase 갱신 대상 |

## UAT 소스 취합 실측 (D-07 통합 문서 재료)

### Phase 25 잔여 (25-HUMAN-UAT.md 실측 — status: partial)
- Test 1 (원격 0029 push): **pass** · Test 2 (Manual linking ON): **pass** — 배포 게이트 2종 해소됨
- Test 3 잔여 (round 3까지 진행, 2026-07-12 기록): **호스트 iPhone 실기기 재확인**(공유시트 footer CTA·달력 nav·하트 — 사용자 기기), **크로스브라우저 실시간**
- Test 4: **pending** — D-12 own-only 삭제 라이브 + 카카오 linkIdentity 승격 (human-only)

### Phase 28 라이브 2건 (28-VERIFICATION.md frontmatter uat_pending 원문)
1. "날짜 미정 모아 + 기간 pill '2박3일' → '일정 만들기'" → expected "Day 탭 3개 (day_count 기준). 1개가 아니어야 함" (유료 API 왕복이라 human/live)
2. "장소를 Day 3으로 수동 이동 → '일정 다시 만들기'" → expected "그 장소가 Day 3에 그대로 유지 (D-25 카피대로)"

### Presence (folded todo)
- 원 증상: /poll presence sync 미동작 (realtime-js 2.10.2 ↔ 서버 프로토콜 비호환, `presence_state` 미수신). 2.108.2에서 PASS 실측 기록 있음 → 현재 2.110.0.
- 확인 기준: 모아 채팅 "지금 N명 보는 중" 두 브라우저 입장·퇴장 수렴 → pass 시 `.planning/todos/pending/supabase-js-upgrade-presence.md` 닫기 (D-09).

### UAT 사전 조건 (실측)
| 조건 | 상태 | 근거 |
|------|------|------|
| 원격 마이그레이션 0016~0031 | ✅ 최신 | 28-VERIFICATION SC-2 "0031 원격 적용 완료" + 25-HUMAN-UAT Test 1 pass `[VERIFIED]` |
| generate-plan EF | ✅ v2 ACTIVE (day_count 포함) | STATE L394 (2026-07-13 배포) `[VERIFIED]` |
| Manual linking (카카오 승격 전제) | ✅ ON | 25-HUMAN-UAT Test 2 pass `[VERIFIED]` |
| main ↔ origin | ahead 2 (docs-only: 27-CONTEXT 커밋) — 코드는 라이브 정합 | `git log origin/main..main` 실측 `[VERIFIED]` |
| Phase 27 변경 후 추가 배포 | main push (Vercel + Supabase 자동 적용) + **extract-youtube EF 수동 배포** `--use-api` | Pitfall 1·2 |
| 배포처 | moajoa-web.vercel.app | ROADMAP Phase 28 잠금 결정 1 `[CITED: ROADMAP]` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | main push 시 Vercel 프로덕션 자동 재배포 | UAT 사전 조건 | 낮음 — Supabase 마이그레이션 자동 적용은 실측 선례(25-HUMAN-UAT Test 1) 있으나 Vercel 훅은 이 세션에서 미확인. UAT 시작 시 배포 커밋 해시 확인으로 커버 `[ASSUMED]` |
| A2 | supabase-js functions.invoke가 403에서 error 반환(throw 전파) | 게이트 회귀 분석 | 매우 낮음 — generate-plan 403이 동일 경로로 프로덕션 동작 중(하우스 선례). 실패 시 재시도 토스트가 안 뜨는 정도 `[ASSUMED — 하우스 선례로 보강]` |

기타 전 항목은 `[VERIFIED]` — 코드베이스·마이그레이션·문서 직접 실측.

## Open Questions

1. **revalidate visibility 갭을 fix할 것인가, 문서화만 할 것인가**
   - What we know: 갭 실재 (§revalidate 실측). fix는 extract-youtube 조건 1줄 + 이미 예정된 재배포에 편승.
   - What's unclear: "revalidate 확인"(재량)의 해석 — 확인 결과가 '동작 안 함'일 때의 조치 범위.
   - Recommendation: fix 포함 (마감 phase 취지 + 수술적 1줄 + 동일 파일·동일 배포). plan에서 별도 태스크로 명시해 diff 추적 가능하게.
2. **NAME-01 대체 카피 문안** — "가고싶어"→"찜"의 정확한 문장 (예: page.tsx L115 "가고 싶은 곳에 찜을 눌러주세요"). 기계적 치환으로 충분하나 aria-label("찜")과 안내 문구의 자연스러움은 planner/executor 재량.
3. **게이트 스모크의 영구 하네스 여부** — 1회성 curl 검증 vs `supabase/tests/`에 스크립트로 남기기. 권고: 기존 스모크 파일 append 또는 신규 소형 스크립트 (25-05 append 선례) — UAT 문서에 결과만 남기는 것보다 재실행 가능성이 낫다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| deno | EF 테스트·check | ✓ | 2.8.0 | — |
| supabase CLI | EF 배포·로컬 스택·스모크 | ✓ | 2.101.0 | — |
| colima (docker) | 로컬 supabase 스택 | ✓ (running) | aarch64 | — (⚠ EF 배포는 `--use-api` 필수) |
| node / pnpm | web/core/api 테스트·빌드 | ✓ | v22.17.0 / 9.12.0 | — |
| Vercel 프로덕션 (moajoa-web.vercel.app) | 라이브 UAT | ✓ (Phase 25/28 UAT 진행 이력) | — | — |
| 카카오 실계정·iPhone 실기기 | human-only UAT 항목 | 사용자 몫 | — | 27-HUMAN-UAT.md 체크리스트 분리 (D-08) |

**Missing dependencies with no fallback:** 없음.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (web/core/api) + deno test (EF pipeline) + jest (iOS — 동결, 무접촉) |
| Config file | `apps/web/vitest.config` (include `__tests__/**`) · 각 EF `deno.json` tasks.test |
| Quick run command | `pnpm --filter @moajoa/web test:run` (web만) |
| Full suite command | `CI=true pnpm -r test` (⚠ web bare `test`=watch — CI=true 필수) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | 비멤버 익명 세션 extract-youtube 403 / 멤버 통과 | smoke (로컬 supabase + curl) | 신규 스모크 (web_share_smoke.sh 패턴) — ❌ Wave 0 | ❌ |
| SEC-01 | EF pipeline 무회귀 | deno unit | `cd supabase/functions/extract-youtube && deno task test` | ✅ (index.ts 게이트는 미커버 — 스모크 몫) |
| NAME-01 | 카피 치환 + 잔여 0 | grep acceptance | `grep -rn "가고싶어" apps/web --include="*.tsx" \| grep -v vote-island \| grep -v "주석 파일"` → 0 | — (grep) |
| NAME-01 | 변경 파일 테스트 무회귀 | vitest | `pnpm --filter @moajoa/web test:run` | ✅ (단언 변경 0 예상 — §카피 스윕 실측) |
| SC-3 UAT | 2인극 전체 통과 | live (하이브리드) | 수동 + Claude 브라우저 — 27-HUMAN-UAT.md | ❌ Wave 최종 |

### Sampling Rate
- **Per task commit:** 변경 워크스페이스 스위트 (`pnpm --filter @moajoa/web test:run` 또는 `deno task test`)
- **Per wave merge:** `CI=true pnpm -r test` + `pnpm -r --parallel run typecheck`
- **Phase gate:** 풀 스위트 그린 (기준선: web 267 · core 192 · api 112 · deno EF 31 — Phase 28 검증 시점 `[VERIFIED: 28-VERIFICATION frontmatter]`) + iOS diff 0

### Wave 0 Gaps
- [ ] SEC-01 게이트 스모크 스크립트 (`supabase/tests/` — web_share_smoke.sh 익명 signup 패턴 재사용, ready-링크 409/403 무비용 트릭)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | verify_jwt + `auth.getUser` (기존 T-18-08 — anon/service 토큰 거부) |
| V4 Access Control | **yes — 이 phase의 핵심** | can_edit_trip 미러 (owner OR accepted owner/editor) — generate-plan 검증 패턴 이식 |
| V5 Input Validation | yes | zod RequestSchema (기존, 무변경) |
| V6 Cryptography | yes (revalidate secret) | `timingSafeEqual` (기존, 무변경) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 익명 세션 유료 추출 남용 (SEC-01 갭) | Tampering / DoS(비용) | 멤버십 게이트를 첫 DB 쓰기(claim)·유료 호출 전에 배치 |
| 비멤버의 링크 상태 오염 (processing 강제) | Tampering | 동일 게이트가 claim 앞에 있으면 자동 차단 |
| link_id 열거 (public_trip_view가 anon에 link id 노출) | Information Disclosure | 게이트가 link_id 지식만으로는 무력화 — 멤버십 필요 |
| resolve-place anon-key 통과 (getUser 부재 — L63-66 Bearer prefix만) | DoS(비용, $0.032/call) | **이번 phase 변경 금지 (D-03)** — deferred 하드닝 항목으로 flag ✅ 확인됨: getUser 게이트 부재 실측 (헤더 주석 L9-10이 의도적 설계였음을 명시) |

## Project Constraints (from CLAUDE.md)

- **GSD 워크플로우** — plan은 wave 병렬화 + atomic commit (§2)
- **Karpathy 4** — 특히 Surgical Changes: 카피 스윕 중 인접 코드 정리 금지, vote-island 삭제 금지(D-06과 정합) (§3.3) · Goal-Driven: 검증 가능한 acceptance (grep 0건, 403 응답 코드) (§3.4)
- **마이그레이션 append-only** — 이 phase 신규 마이그레이션 0 기대 (D-01) — 준수 확인 게이트 `git diff supabase/migrations` 0 (§4.3)
- **iOS 전면 동결** — `apps/ios` diff 0 게이트 (§5)
- **워크스페이스 import `.js` extension 금지** (§4.5)
- **서비스 롤 키는 EF 안에서만** — 게이트는 service-role admin 클라이언트 사용 (기존 패턴, 준수) (§4.4)
- **Conventional Commits** + 마이그레이션 없으므로 BREAKING DB CHANGE 불필요 (§4.6)
- **커밋 문서화**: `.planning/config.json` commit_docs=true

## Sources

### Primary (HIGH confidence — 전부 코드베이스 실측)
- `supabase/functions/extract-youtube/index.ts` — 전문 (게이트 부재·삽입 지점·revalidate 조건 L426)
- `supabase/functions/generate-plan/index.ts` L60-169 — T-18-08/09 미러 원본
- `supabase/functions/resolve-place/index.ts` L1-100 — getUser 부재 확인 (D-03 flag)
- `supabase/migrations/0016_trips_baseline.sql` — links.trip_id L365 · can_edit_trip L313-336
- `supabase/migrations/0025_*.sql` L64-93 — join_moa accepted_at/role 시맨틱
- `supabase/migrations/0029_public_trip_poll.sql` L29·107 — visibility ('public','shared')
- `packages/api/src/queries/links.ts` L61-70 · `trips.ts` L212-227 (shareMoa visibility='shared')
- `apps/web/app/t/[slug]/{page.tsx, _components/guest-surface.tsx}` — NAME-01 실측 위치
- `apps/web/app/api/revalidate/route.ts` + `apps/web/lib/public-trip-cache.ts` — revalidate 배선
- `apps/web/__tests__/` grep 전수 — 카피 단언 영향 0 확인
- `supabase/config.toml` L74-85 — verify_jwt 상태
- `supabase/tests/web_share_smoke.sh` — 익명 세션 스모크 패턴
- `.planning/phases/25-guest-unified-share/25-HUMAN-UAT.md` · `.planning/phases/28-add-trip-redesign-ai/28-VERIFICATION.md` · `.planning/todos/pending/supabase-js-upgrade-presence.md` — UAT 재료 원문
- `.planning/STATE.md` L394-395 — EF 배포 `--use-api` 함정 실측 기록
- `docs/WORKSTREAMS.md` L46-48 등 · `docs/ARCHITECTURE.md` L19-21 등 — 문서 잔재 실측
- 로컬 환경 프로브 — deno 2.8.0 · supabase CLI 2.101.0 · colima running · git ahead 2 (docs-only)

### Secondary (MEDIUM)
- supabase-js functions.invoke non-2xx → error 반환 동작 — 하우스 선례(generate-plan 403 프로덕션 동작)로 보강 (A2)

### Tertiary (LOW)
- 없음 — 외부 웹 리서치 불필요 (신규 기술 도입 0)

## Metadata

**Confidence breakdown:**
- SEC-01 게이트 (삽입 지점·미러 코드·회귀 경로): HIGH — 전 파일 실측, 미러 원본 verbatim 확보
- NAME-01 카피 (잔여 위치·테스트 영향): HIGH — grep 전수 + 테스트 파일 실측
- 문서 마감·revalidate: HIGH — 잔재 위치·갭 3파일 교차 실측 (fix 여부만 open question)
- UAT 취합·사전 조건: HIGH — 소스 문서 3종 원문 + 배포 상태 실측 (Vercel 훅만 ASSUMED)

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (내부 코드베이스 기반 — 이 phase 실행 전까지 유효; 원격 배포 상태는 UAT 시작 시 재확인)
