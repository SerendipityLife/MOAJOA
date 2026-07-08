# Phase 24: Host Flow (온보딩·지도탭) - Research

**Researched:** 2026-07-08
**Domain:** Next.js 15 웹 풀 서피스 — Supabase auth(카카오)·온보딩 위저드·Google Maps 지도탭·Realtime postgres_changes·공유 시트
**Confidence:** HIGH (코드베이스 실측 위주 — 신규 외부 요소는 react-day-picker 1개뿐)

## Summary

Phase 24는 "새 발명 최소" phase다. Phase 23이 잠근 계약(0024 seq_no 채번, 0025 share_mode·companion·join_moa, `TripCreateDraftSchema`, `shareMoa`, `ShareMode`, `moaChannelName`)과 v1~v2.0에서 검증된 웹 자산(Google Maps 로딩·마커 SVG·add-link+추출 트리거·resolve-place EF·bottom-sheet/chip 컴포넌트·PKCE 콜백)이 전부 실존함을 코드에서 확인했다. Phase 24의 일은 이 조각들을 `/onboarding`·`/moa`·`/moa/[id]` 3개 신규 라우트로 조립하는 것이다.

코드베이스에 **없는 것** 두 가지가 이 phase의 실제 리스크다. 첫째, **postgres_changes는 레포 최초 사용**이다 — `supabase_realtime` publication에 테이블을 추가하는 마이그레이션이 어디에도 없다(grep 0건). 신규 마이그레이션 0026으로 `alter publication supabase_realtime add table places, links`가 반드시 필요하며, 이것 없이는 구독이 조용히 이벤트 0건으로 무동작한다. 둘째, **로컬 node_modules가 stale이다** — package.json/lockfile은 supabase-js 2.110.0을 선언하지만 실제 설치본은 2.45.4(realtime-js 2.10.2, presence 프로토콜 비호환 버전)다. 실행 전 `pnpm install`이 선행 게이트다.

외부 신규 도입은 캘린더 range 픽커 하나로 제한하기를 권장한다: **react-day-picker 9.14.0** (date-fns 내장 dependency, `react-day-picker/locale`의 ko, `mode="range"` 두 탭 선택 내장). 드래그 바텀시트는 D-09가 "기존 bottom-sheet 컴포넌트 확장"으로 잠갔고, 후보 라이브러리 vaul은 **공식 unmaintained 선언** 상태이므로 pointer events 핸드롤이 맞다.

**Primary recommendation:** 신규 dep은 react-day-picker 9.14.0 하나만. 마이그레이션 0026(realtime publication)은 첫 웨이브에서 잠그고, 실행 전 `pnpm install`로 선언된 supabase-js 2.110.0을 실체화하라.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 온보딩 구조·저장 시점
- **D-01 진입 분기:** iOS Phase 17 패턴 미러 — 로그인 직후 모아 0개→`/onboarding`, 1개→그 모아 `/moa/[id]`로 바로, 2개+→`/moa` 리스트.
- **D-02 라우트 구조:** `/onboarding` 단일 라우트 + 클라이언트 스텝 상태. 중간 상태 URL 유출 없음. 브라우저 뒤로가기는 직접 처리 필요.
- **D-03 생성 시점:** 4단계 입력을 모아 마지막 단계 완료 시 `TripCreateDraftSchema`로 한 번에 생성. 빈 모아 잔여 없음. 4단계의 링크·장소는 모아 생성 직후 일괄 addLink+추출 트리거.
- **D-04 중도 이탈:** 소실 허용 — 초안 보존(localStorage 등) 없음. 4단계는 1분 내외 분량.
- **D-05 도시 선택:** 단일 선택 — `CITY_KO_MAP` 칩 9개 중 하나 또는 기타 직접입력 1개. trips 스키마 city 단일 필드와 일치.
- **D-06 날짜 입력:** 확정 시 캘린더 range 픽커(한 캘린더에서 시작·종료 탭 2번). 미정 시 안내 한 줄 후 통과(dates null). 캘린더 컴포넌트는 신규 제작 또는 경량 라이브러리 — 플래너 재량.
- **D-07 누구랑:** 칩(혼자/연인/친구/가족/동료) + 기타 직접입력 — 도시 칩과 동일 패턴. 값은 0025 `trips.companion`(≤20자) 텍스트로 저장.
- **D-08 봐둔 곳:** 링크·장소 여러 개 담아두고 '완료'로 마무리 가능. 건너뛰기 허용(ONBOARD-05).

#### 지도탭 레이아웃 (`/moa/[id]`)
- **D-09 모바일 배치:** 풀스크린 지도 + 드래그 바텀시트 장소 리스트(앵커 2~3단). 기존 `bottom-sheet` 컴포넌트 확장. 마커 탭→해당 행 스크롤+펼침(MOA-05)이 이 구조에서 자연스러움.
- **D-10 데스크톱:** 모바일 레이아웃 max-width 중앙 고정 — 구현 1벌. 유입 경로가 카톡 공유라 모바일 중심.
- **D-11 추가 진입점:** 하단 + 버튼 → 추가 바텀시트(링크 붙여넣기 / 장소 검색 탭 전환). 온보딩 4단계와 추가 UI 컴포넌트 재사용.
- **D-12 /moa 리스트:** 미니멀 — 모아 카드(이름·도시·날짜·장소 수) 목록 + 새 모아 CTA만. 이름 변경·삭제 등 관리 기능 없음.

#### 링크 추출 진행 UX
- **D-13 진행 표시:** 추가한 링크가 리스트에 '분석 중…' 행으로 즉시 뜨고, 완료 시 장소 행들로 전환. 기존 link-list 패턴 유사.
- **D-14 완료 반영:** Supabase Realtime `postgres_changes` 구독(places/links). Phase 25(게스트 실시간 반영)·26(채팅) 인프라 선행 확보. **presence는 사용 금지**(supabase-js 알려진 이슈 — todo `supabase-js-upgrade-presence.md` 참조).
- **D-15 실패 처리:** 실패 링크 행 유지 + 재시도 버튼(기존 `retry-extraction-button` 재사용 가능). 장소 0개 추출도 동일 처리.
- **D-16 지도 반응:** 새 핀 생성 시 fitBounds 재조정 + '장소 N개 추가됨' 토스트.

#### 함께 정하기 시트 + 핀 색
- **D-17 모드 선택 UI:** 바텀시트 3택 카드(날짜 정하기/장소 정하기/둘다, 각 한 줄 설명). 날짜 확정 모아는 '날짜 정하기' 숨김 → 2택 (Phase 23에서 클라이언트 몫으로 잠긴 사항의 구현).
- **D-18 공유 동작:** 클립보드 복사 기본 + 모바일이면 `navigator.share` 시스템 공유 시트 제공(카톡 도달 경로, 별도 SDK 없음).
- **D-19 재공유:** 이미 공유된 모아에서 시트를 열면 현재 mode 선택 상태로 표시, 다른 모드 선택 시 갱신+같은 링크 재복사. shareMoa 재호출 mode 갱신 계약(Phase 23 Open Q3)을 그대로 노출. slug 보존.
- **D-20 핀 색 배정:** 호스트=브랜드색 고정 + 참여자는 memberships join 순서대로 팔레트(6~8색) 순환 배정. **팔레트는 `packages/ui-tokens`에 정의**해 웹·iOS 공유 가능하게.

### Claude's Discretion
- 캘린더 range 픽커의 구체 구현(자체 제작 vs 경량 라이브러리) — D-06
- 바텀시트 앵커 단수(2단 vs 3단)와 드래그 물리 — D-09
- 스텝 인디케이터·전환 애니메이션 등 온보딩 시각 디테일
- Realtime 구독 채널 구성 세부(단, Phase 26 "한 토픽 채널 2개 금지" 교훈 — `moaChannelName` 규약 참고)
- 아코디언 상세의 정보 배치 순서(주소·구글맵 딥링크·출처 타임스탬프·답장 버튼은 MOA-05 필수 요소)

### Deferred Ideas (OUT OF SCOPE)
None — 논의가 phase 범위 안에 머묾.

Reviewed todos (not folded): `eas-ios-sharesheet-verify.md`(iOS 동결로 범위 밖) · `maplink-place-enrichment.md`(추출 파이프라인 무변경) · `supabase-js-upgrade-presence.md`(D-14가 presence 회피 — Phase 26 전 재검토) · `transcript-fallback-no-description.md`(범위 밖)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-07 | 웹에서 카카오 계정으로 로그인 (기존 이메일/구글/애플 유지) | 기존 `oauth('google'|'apple')` 함수에 `'kakao'` 추가만 — provider·PKCE 콜백은 Phase 23-07에서 프로덕션 실증 완료 (§Kakao OAuth) |
| ONBOARD-03 | 로그인 직후 4단계 온보딩으로 모아 생성 (도시 칩 9개+기타) | `CITY_KO_MAP` 9개 실존, `TripCreateDraftSchema` 실존, `createTrip` 패턴 실존 — companion 포함 insert만 신규 (§온보딩 패턴) |
| ONBOARD-04 | 날짜 미정→통과(null), 확정→기간 입력 | `TripCreateDraftSchema` refine "both set or both null" 검증 확인. 캘린더: react-day-picker 9.14.0 `mode="range"` (§Calendar) |
| ONBOARD-05 | 마지막 단계 링크/장소검색/건너뛰기 | `addLink`+`triggerExtraction`+`resolve-place` EF+`addManualPlace` 전부 실존 — UI만 신규. D-03: 생성 직후 일괄 트리거 (§추가 파이프라인) |
| MOA-02 | 찜 내림차순(동률 시 순번 오름차순) 정렬, 순번 표기 불변 | `vote_counts_for_places` RPC(0016) + `places.seq_no`(0024 서버 채번) 실존 — 클라이언트 정렬 comparator만 신규 (§정렬) |
| MOA-03 | 링크 추가→자동 추출→핀 | 기존 addLink→extract-youtube EF 파이프라인 무변경. dev-tools 게이트 없는 정식 UI로 승격 (§추가 파이프라인) |
| MOA-04 | 구글 장소 검색 직접 추가 | `resolve-place` EF(query→max 5, anon JWT) + `add_manual_place` RPC(서버가 좌표 해석) 실존 (§장소 검색) |
| MOA-05 | 행 탭 아코디언(주소·구글맵·타임스탬프·답장), 마커 탭→행 스크롤+펼침 | `places.address` 컬럼 실존, `buildGoogleMapsPlaceUrl`·`buildYouTubeWatchUrl` 헬퍼 실존. 답장 버튼은 Phase 26 전 스텁 — Open Q1 (§아코디언) |
| MOA-06 | 추가자별 핀 색(호스트=브랜드), "닉네임님이 담음" | `places.added_by`+profiles "read all authenticated" RLS 확인. 팔레트는 ui-tokens 신규 추가, `buildMarkerIconUrl` fill 파라미터 확장 (§핀 색) |
| SHARE-01 | 날짜/장소/둘다 모드 공유링크 생성·복사 (날짜 확정 시 '날짜' 숨김) | `shareMoa`(재호출 mode 갱신·slug 보존) + `ShareMode` 3값 실존. 날짜 확정 숨김은 클라이언트 몫(23-06 계약 주석 확인) (§공유) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Karpathy 4**: 가정 금지·요청 범위만·surgical diff·검증 가능한 목표
- **iOS 전면 동결** — `apps/ios` 접촉 금지. 웹 생성·편집 UI는 공식 허용(D26 반전 완료)
- **마이그레이션 append-only** — 0024/0025 수정 금지, 신규는 0026부터. 적용 후 `pnpm supabase:types` 재생성
- **RLS deny-by-default** — 크로스 테이블은 SECURITY DEFINER 헬퍼만(직접 EXISTS 금지, 42P17)
- **클라이언트는 anon 키만** — 서비스 롤은 EF 안에서만
- **워크스페이스 import에 `.js` extension 금지** (Turbopack)
- **외부 입력은 Zod validate** (`@moajoa/core/schemas`)
- **`packages/core/schemas/*`·`constants.ts`·`ui-tokens` 변경은 충돌 위험 영역** — SQL과 짝지어, 최소로
- **Conventional Commits** · `.env.local` 커밋 금지
- **Flutter/Firebase 금지** · `_archive_asis/` 접촉 금지
- 기존 dev-tool 폼 격리(`NEXT_PUBLIC_ENABLE_DEV_TOOLS`)는 정식 UI로 대체될 때까지 유지 — **신규 UI에 이 게이트를 복사하지 말 것**

프로젝트 스킬 디렉토리(`.claude/skills/`)는 존재하지 않음 [VERIFIED: ls].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 카카오 OAuth 시작 | Browser (client component) | Frontend Server (PKCE 콜백 `/auth/callback`) | `signInWithOAuth`는 브라우저 리다이렉트, code exchange는 기존 서버 라우트가 처리(쿠키 verifier) |
| 진입 분기 (D-01) | Frontend Server (RSC) | — | 로그인 후 목적지는 서버 컴포넌트에서 trip count 조회 후 redirect — 클라이언트 깜빡임 방지 |
| 온보딩 4단계 | Browser (client component) | — | D-02 단일 라우트+클라이언트 스텝 상태. 제출 시에만 DB 접촉 |
| 모아 생성 + 일괄 링크 추가 | Browser → Database | Edge Function (추출) | `createTrip` insert(RLS)+DB 트리거(slug·representative·seq) → addLink → `extract-youtube` EF fire-and-forget |
| seq_no 채번 | Database (trigger) | — | 0024 advisory-lock DEFINER 트리거. **클라이언트는 seq_no를 절대 보내지 않음** |
| 장소 검색 | Edge Function (`resolve-place`) | Database (`add_manual_place` RPC) | 키 은닉+FieldMask 잠금. 좌표는 서버가 해석 — 클라이언트 좌표 불신 |
| 지도 렌더·마커 | Browser | — | Google Maps JS API, 기존 스크립트 로딩 idiom |
| 추출 완료 실시간 반영 | Database (WAL→Realtime) → Browser | Database (0026 publication 마이그레이션) | postgres_changes: places INSERT + links UPDATE, RLS(WALRUS) 필터 |
| 찜 정렬 | Browser (comparator) | Database (`vote_counts_for_places` RPC) | 집계는 RPC, 정렬은 클라이언트 — 순번 표기는 seq_no 그대로 |
| 공유링크 생성 | Database (RLS UPDATE + slug 트리거) | Browser (클립보드/navigator.share) | `shareMoa` 단일 UPDATE, owner-only는 trips RLS가 게이트 |
| 핀 색 팔레트 | ui-tokens (design token) | Browser (배정 로직) | D-20: 토큰은 ui-tokens, join순 순환 배정은 클라이언트 순수함수 |

## Standard Stack

### Core (전부 기존 — 설치 변경 없음)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.0.0 | 웹 앱 라우터 | 기존 [VERIFIED: package.json] |
| react / react-dom | 19.2.3 | UI | 기존 (web+ios 핀 일치) |
| @supabase/supabase-js | ^2.110.0 (선언) | DB·auth·realtime | **주의: node_modules는 2.45.4 stale — `pnpm install` 필수** [VERIFIED: node -e require] |
| @supabase/ssr | ^0.12.0 (선언) | 쿠키 세션 | 기존 middleware·callback 패턴 |
| tailwindcss | ^4.0.0-beta.2 | 스타일 | 기존. `@theme` + `@config` 하이브리드 [VERIFIED: globals.css] |
| @moajoa/core · api · ui-tokens | workspace | 계약·쿼리·토큰 | Phase 23 산출물 소비 |
| Google Maps JS API | v3 (script) | 지도 | 기존 로딩 idiom (`public-board-map.tsx`) |

### 신규 설치 (1개)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | 9.14.0 | D-06 캘린더 range 픽커 | 온보딩 2단계. `mode="range"`, ko locale 내장, date-fns는 자체 dependency(피어 관리 불필요) [VERIFIED: npm view — deps에 date-fns ^4.1.0, peer react>=16.8, `./locale` export 존재] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-day-picker 9.x | 자체 제작 캘린더 | 월 그리드·range 상태·locale·과거 날짜 disable을 전부 재구현(~150줄+엣지케이스). 9.x는 headless에 가깝고 classNames로 Tailwind 스타일 가능 — 라이브러리 우세 |
| react-day-picker 9.x | react-day-picker 10.0.1 | v10은 **패키지명이 `@daypicker/react`로 변경**된 직후의 신규 메이저 [CITED: daypicker.dev/upgrading] — 갓 나온 메이저 회피, 9.14.0이 안정 |
| 핸드롤 드래그 시트 | vaul (snapPoints) | vaul 레포는 **"This repo is unmaintained" 공식 선언** [VERIFIED: github.com/emilkowalski/vaul] — 도입 부적격. D-09도 "기존 bottom-sheet 확장"으로 잠김 |
| postgres_changes | `extract:{link_id}` broadcast 재구독 | broadcast는 링크당 채널 1개(채널 스프롤) + Phase 25/26 인프라 선행 확보 목적에 미달. D-14가 postgres_changes로 잠김 |

**Installation:**
```bash
pnpm install                                # stale node_modules 실체화 (supabase-js 2.110.0)
pnpm --filter web add react-day-picker@9.14.0
```

## Architecture Patterns

### System Architecture Diagram

```
[로그인 /login]
  ├─ email/password·magic (기존) ──┐
  ├─ Google/Apple OAuth (기존)     ├─→ /auth/callback (PKCE code exchange, 기존 무수정)
  └─ Kakao OAuth (신규: union에 'kakao' 추가) ──┘
                     │
                     ▼  ?next= 또는 기본 목적지
        [진입 분기 RSC]  listMyTrips count
          0개 → /onboarding    1개 → /moa/[id]    2개+ → /moa
                     │
   ┌─────────────────┴──────────────────┐
   ▼                                    ▼
[/onboarding — 클라이언트 위저드]     [/moa — 카드 리스트 (RSC+minimal)]
 step1 도시칩(CITY_KO_MAP+기타)              │ 카드 탭
 step2 날짜(range picker | 미정 통과)         ▼
 step3 누구랑 칩(+기타, ≤20자)         [/moa/[id] — 지도탭]
 step4 봐둔 곳(링크·장소검색·스킵)       ┌────────────────────────────┐
   │ 완료(1회)                          │ 풀스크린 GoogleMap (persistent)│
   ▼                                    │   마커(추가자 색, D-20)        │
 TripCreateDraftSchema.parse            │   마커탭 → 행 스크롤+펼침      │
   → trips INSERT (RLS·트리거)          ├────────────────────────────┤
   → 담아둔 링크: addLink → EF 추출     │ 드래그 시트: 장소 리스트       │
   → 담아둔 장소: add_manual_place      │  찜↓·seq tiebreak 정렬        │
   → router.replace(/moa/[id])          │  '분석 중…' 행(links pending) │
                                        │  아코디언(주소·맵·타임스탬프)  │
                                        │ [+]버튼→추가시트  [함께 정하기]│
                                        └────────────┬───────────────┘
                                                     │
        Supabase Realtime  ◄── WAL ── places INSERT / links UPDATE
        channel: moaChannelName(tripId) postgres_changes (0026 publication 필요)
        이벤트 수신 → listPlacesByTrip/listLinksByTrip refetch (reconcile)
                                                     │
        [함께 정하기 시트] 3택(날짜확정 시 2택) → shareMoa(tripId, mode)
          → slug → `${APP_URL}/t/${slug}` → clipboard.writeText + navigator.share
```

### Recommended Project Structure

```
apps/web/app/
├── onboarding/
│   ├── page.tsx                    # 클라이언트 위저드 셸 (D-02 단일 라우트)
│   └── _components/                # step-where / step-dates / step-who / step-seed
├── moa/
│   ├── page.tsx                    # 모아 카드 리스트 (D-12 미니멀)
│   └── [id]/
│       ├── page.tsx                # RSC: trip+places+links+votes 초기 로드 → island
│       └── _components/
│           ├── moa-map.tsx         # persistent map + 마커 diff (public-board-map 파생)
│           ├── place-sheet.tsx     # 드래그 바텀시트 (신규 — 기존 bottom-sheet 시각언어)
│           ├── place-list.tsx      # 정렬·아코디언·분석중 행
│           ├── add-sheet.tsx       # 링크/장소검색 탭 (온보딩 step4와 공유)
│           └── share-sheet.tsx     # 함께 정하기 3택
apps/web/lib/
│   └── member-color.ts             # join순 팔레트 배정 순수함수 (테스트 대상)
packages/ui-tokens/src/index.ts     # colors.member 팔레트 추가 (D-20)
supabase/migrations/0026_realtime_publication.sql   # 신규 (아래)
```

### Pattern 1: Realtime postgres_changes (레포 최초 — 0026 마이그레이션 필수)

**What:** places INSERT·links UPDATE를 DB WAL에서 구독해 리스트·지도에 반영.
**When to use:** `/moa/[id]` 마운트 시 1회 구독, 언마운트 시 removeChannel.

```sql
-- 0026_realtime_publication.sql — 신규 파일 (append-only)
-- postgres_changes는 publication 멤버십이 전제. 현재 어떤 테이블도 등록 안 됨 (grep 0건).
alter publication supabase_realtime add table places;
alter publication supabase_realtime add table links;
```
[VERIFIED: supabase.com/docs/guides/realtime/postgres-changes — "alter publication supabase_realtime add table ..." + 마이그레이션 grep 0건]

```typescript
// Source: supabase docs + 기존 poll-vote-island.tsx 채널 idiom
// ONE channel per screen (Phase 19/20 교훈) — moaChannelName을 지금부터 사용해
// Phase 26이 같은 채널에 broadcast/presence를 추가하게 한다. presence 사용 금지 (D-14).
const channel = client
  .channel(moaChannelName(tripId))
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
    () => void reconcile())          // payload 패치 대신 refetch — RLS·hard-delete·hidden_at 안전
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'links', filter: `trip_id=eq.${tripId}` },
    () => void reconcile())
  .subscribe();
// cleanup: client.removeChannel(channel)  — poll-vote-island idiom
```

주의사항:
- RLS 테이블의 이벤트는 구독자 JWT로 WALRUS가 필터 — 호스트는 trip 멤버/owner라 `can_read_trip` 계열 정책 통과. supabase-js 2.110은 auth 토큰을 자동 전달. [CITED: supabase docs "Row Level Security... works automatically for public schema"]
- DELETE 이벤트는 PK만 옴(replica identity). places에는 hard-delete 경로가 실존(0016) — **payload로 상태 패치하지 말고 refetch로 reconcile**하는 이유.
- `filter: 'trip_id=eq.<uuid>'` 서버사이드 평가 지원. [CITED: supabase docs filter 목록]

### Pattern 2: Kakao OAuth — 기존 함수 확장 1줄

```typescript
// apps/web/app/login/page.tsx — 기존 oauth()의 union만 확장
async function oauth(provider: 'google' | 'apple' | 'kakao') {
  const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl() },   // 기존 /auth/callback PKCE 경유
  });
  if (error) toast(error.message, { variant: 'error' });
}
```
provider·redirect·동의항목은 Phase 23-07에서 프로덕션 실증 완료(authorize 302→kauth.kakao.com, KOE 마커 0). 카카오 e2e는 Vercel Preview에서, 로컬은 이메일 대체 (성공 기준 1). [VERIFIED: 23-07-SUMMARY 실측 기록 + login/page.tsx·auth/callback/route.ts 실코드]

### Pattern 3: 진입 분기 (D-01) — 서버 컴포넌트 redirect

로그인 직후 목적지는 현재 두 곳에서 계산된다: `postLoginDestination()`(login/page.tsx)과 `/auth/callback`의 `next` 기본값 — 둘 다 dev-tools면 `/boards`, 아니면 `/`. **권장:** 두 기본값을 `/moa`로 바꾸고, `/moa/page.tsx`(RSC)가 `listMyTrips` count로 0개→`redirect('/onboarding')`, 1개→`redirect(`/moa/${id}`)`, 2개+→리스트 렌더. 분기 로직이 한 곳(RSC)에 모여 콜백·로그인 페이지는 URL만 안다.

### Pattern 4: 온보딩 제출 — 생성 + 일괄 시드 (D-03)

```typescript
// TripCreateDraftSchema.parse(draft) 후:
const trip = await createMoaDraft(client, draft);   // 신규 typed query — trips INSERT에
                                                    // title·city_code·start/end·companion
for (const url of draft.seedLinks) {
  const link = await addLink(client, { board_id: trip.id, url });
  if (link.source_kind !== 'manual') {
    triggerExtraction(client, link.id).catch(console.error);  // fire-and-forget (기존 idiom)
  }
}
for (const g of draft.seedPlaces) {
  await addManualPlace(client, { board_id: trip.id, google_place_id: g.placeId });
}
router.replace(`/moa/${trip.id}`);   // 도착하면 postgres_changes가 추출 완료를 반영
```
주의: 기존 `createTrip`은 companion을 insert하지 않음 — **`packages/api`에 draft용 쿼리 추가 필요**(기존 createTrip 무수정, 23-06 "기존 함수 무수정" 선례). `seq_no`는 절대 보내지 않음(0024 트리거 채번·forge 차단).

### Pattern 5: 찜 정렬 comparator (MOA-02)

```typescript
// 순수함수 — 단위 테스트 대상. 정렬이 바뀌어도 순번 표기는 place.seq_no 그대로.
export function sortByLove(places: Place[], loveCounts: Record<string, number>): Place[] {
  return [...places].sort((a, b) =>
    (loveCounts[b.id] ?? 0) - (loveCounts[a.id] ?? 0) || a.seq_no - b.seq_no,
  );
}
```
집계는 `getVoteCounts`(→ `vote_counts_for_places` RPC, authenticated+anon grant 확인) [VERIFIED: votes.ts + 0016 L613].

### Pattern 6: 핀 색 배정 (D-20)

```typescript
// packages/ui-tokens/src/index.ts — colors에 append (기존 키 무수정)
member: ['#FF7043', '#AB47BC', '#26A69A', '#FFCA28', '#5C6BC0', '#EC407A'], // 예시 6색 — UI-SPEC에서 확정
// 호스트는 colors.brand[500] 고정

// apps/web/lib/member-color.ts — 순수함수
// owner는 memberships 행이 없음(설계상 — getMyTripRole 주석 확인) → 참여자만 순환
export function memberColor(userId: string, trip: Trip, members: Membership[]): string {
  if (userId === trip.owner_id) return colors.brand[500];
  const ordered = [...members].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const i = ordered.findIndex((m) => m.user_id === userId);
  return colors.member[(i < 0 ? 0 : i) % colors.member.length];
}
```
`buildMarkerIconUrl`은 fill을 토큰에서만 고르는 순수함수 — **확장 시에도 user 문자열을 SVG에 넣지 않는 계약 유지**(T-05-05-01). "닉네임님이 담음"은 `places.added_by` → profiles(`read all authenticated` RLS [VERIFIED: 0016 L66]) `display_name`.

### Pattern 7: 드래그 바텀시트 핸드롤 (D-09)

기존 `bottom-sheet.tsx`는 모달(백드롭+닫힘) — 지도탭 리스트 시트는 **상시 표시·non-modal**이므로 신규 컴포넌트로 만들되 시각 언어(white·rounded-t-3xl·drag handle)를 미러. 드래그 물리(재량 권장안):
- 앵커 **2단**(collapsed: 핸들+헤더 ~30vh peek, expanded: ~85vh) — 3단은 half 앵커의 가치가 불명확, 단순 우선
- handle/헤더에 `onPointerDown` → `setPointerCapture` → move 중 `translateY` 직접 세팅(transition off) → `onPointerUp`에 가까운 앵커로 snap(transition on, 250ms ease-out — 기존 시트와 동일 타이밍)
- 릴리즈 속도(마지막 move의 delta 부호)로 플릭 방향 바이어스
- 리스트 스크롤과 충돌 방지: 시트가 expanded이고 리스트 scrollTop>0이면 드래그 시작 안 함(핸들 영역 드래그는 항상 허용)
- 마커 탭 → `rowRef.scrollIntoView({behavior:'smooth'})` + 아코디언 펼침 + 시트가 collapsed면 expanded로

### Anti-Patterns to Avoid

- **지도 re-init**: `public-board-map.tsx`는 정적 SSR용이라 places 변경 시 map을 통째로 다시 만든다 — 라이브 지도탭에서 이걸 복사하면 realtime 이벤트마다 지도가 깜빡인다. **map 인스턴스는 ref로 1회 생성, 마커만 diff**(추가/제거) 하라.
- **payload로 상태 패치**: postgres_changes payload를 믿고 로컬 상태를 수술하면 hard-delete(PK만 옴)·hidden_at·RLS 엣지에서 드리프트 — refetch reconcile이 기존 optimistic+reconcile idiom과 일치.
- **한 토픽 채널 2개**: `moa:{tripId}` 하나에 모든 바인딩. `extract:{link_id}` broadcast를 병행 구독하지 말 것.
- **dev-tools 게이트 복사**: `add-link-form.tsx` 첫 줄의 `isDevToolsEnabled()` return-null은 구 방침 — 신규 정식 UI에 복사 금지. 기존 `/boards`는 무수정 보존.
- **presence 사용**: D-14 명시 금지. `pnpm install` 후 2.110이면 기술적으로 동작하지만 결정이 잠겨 있다.
- **seq_no·role 클라이언트 전송**: 둘 다 서버 결정(0024 트리거·0025 RPC).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 캘린더 월 그리드·range 상태 | 자체 date 그리드 | react-day-picker 9.14.0 `mode="range"` | 윤년·주 시작·locale·min/max·두-탭 시맨틱 내장 |
| 장소 검색 | 클라이언트 Places API 호출 | `resolve-place` EF + `add_manual_place` RPC | 키 은닉·FieldMask 잠금·비용 로깅·좌표 서버 해석 완비 |
| 순번 채번 | max(seq)+1 클라 계산 | 0024 트리거 (아무것도 안 보냄) | 동시성·hard-delete 재사용 문제를 advisory lock으로 이미 해결 |
| 공유 slug | 클라 랜덤 문자열 | 0016 `ensure_share_slug` 트리거 (shareMoa가 노출) | 엔트로피·유일성·visibility 게이트 검증 완료 |
| 추출 진행 반영 | 폴링 setInterval | postgres_changes (0026) | D-14 잠금 + Phase 25/26 인프라 선행 |
| 구글맵 place 딥링크 | URL 수작업 | `buildGoogleMapsPlaceUrl` (lib/maps-url.ts) | Maps URLs API 스펙(query 필수+query_place_id) 이미 처리 |
| 유튜브 타임스탬프 링크 | `?t=` 문자열 조립 | `buildYouTubeWatchUrl` (lib/youtube.ts) | 기존 단위 테스트 커버 |
| 링크 종류 감지 | 정규식 신규 | `detectSourceKind` (@moajoa/core) | youtube/blog/instagram/manual 판별 기존 |

**Key insight:** 이 phase의 백엔드·헬퍼는 사실상 전부 존재한다. 신규 발명이 필요한 것은 (a) 드래그 시트 물리, (b) 정렬·색 배정 순수함수, (c) 0026 publication — 이 셋뿐이다.

## Common Pitfalls

### Pitfall 1: stale node_modules — 선언 2.110.0 vs 설치 2.45.4
**What goes wrong:** realtime-js 2.10.2(2.45.4 동봉)로 실행되어 realtime 동작이 선언 버전과 다름. F-20-3에서 이미 한 번 이걸로 presence가 조용히 죽었다.
**Why it happens:** lockfile은 2.110.0인데 [VERIFIED: pnpm-lock.yaml L8] `pnpm install`이 마지막 bump 후 재실행되지 않음 [VERIFIED: node_modules/.pnpm에 @supabase+supabase-js@2.45.4만 존재].
**How to avoid:** Phase 24 첫 작업 전 `pnpm install` → `node -e "console.log(require('@supabase/supabase-js/package.json').version)"`으로 2.110.x 확인. (메모리 노트: worktree 병렬 빌드 깨짐 — 순차 실행.)
**Warning signs:** 채널 subscribe는 OK인데 postgres_changes 이벤트가 안 옴, presence 관련 콘솔 경고.

### Pitfall 2: publication 미등록 → postgres_changes 무음 no-op
**What goes wrong:** 구독 상태는 `SUBSCRIBED`인데 이벤트가 영영 0건. 에러도 없다.
**Why it happens:** 레포의 어떤 마이그레이션도 `supabase_realtime` publication에 테이블을 추가하지 않았다 [VERIFIED: grep 0건].
**How to avoid:** 0026 마이그레이션을 첫 웨이브에 넣고 로컬 `supabase db reset`+curl/스크립트로 이벤트 실수신을 게이트로 검증. 원격에는 `supabase db push`(0024·0025·0026 함께) — Vercel Preview e2e 전 필수.
**Warning signs:** '분석 중…' 행이 영영 전환 안 됨(추출 자체는 성공).

### Pitfall 3: 원격 DB가 0023까지만 적용됨
**What goes wrong:** Vercel Preview에서 shareMoa(share_mode 컬럼 없음)·seq_no 표시가 전부 런타임 에러.
**Why it happens:** 23-07 실측 — 원격은 0016~0023 정합, 0024/0025 미적용. push는 Phase 23 범위 외로 잠겼다.
**How to avoid:** Preview e2e 전 `supabase db push` (0024+0025+0026) — human-action 체크포인트로 플랜에 명시. 로컬 개발은 이미 적용 상태라 무관.

### Pitfall 4: 지도 useEffect deps에 places 넣고 map 재생성
**What goes wrong:** realtime 이벤트마다 지도 깜빡임+카메라 리셋 — D-16(fitBounds 재조정+토스트)이 불가능해짐.
**How to avoid:** map·markers를 ref로 유지, places diff로 마커 add/remove만. fitBounds는 **장소 수가 증가했을 때만** 호출(사용자 팬 중 강제 리셋 방지).

### Pitfall 5: navigator.share의 AbortError·게이트 조건
**What goes wrong:** 사용자가 공유 시트를 닫으면 reject — 이를 에러 토스트로 처리하면 UX 오염. 데스크톱/비보안 컨텍스트에선 API 자체가 없음.
**How to avoid:** `if (navigator.share)` 게이트 + `catch (e) { if (e.name !== 'AbortError') toast(...) }`. 클립보드 복사(`navigator.clipboard.writeText`)를 기본으로 먼저 수행하고 share는 추가 제공(D-18 순서 그대로). 둘 다 HTTPS(secure context) 필요 — localhost는 secure 취급. [ASSUMED — 표준 Web API 동작, MDN 준거]
**Warning signs:** 데스크톱 Chrome에서 share 버튼 무반응.

### Pitfall 6: 온보딩 뒤로가기 (D-02)
**What goes wrong:** 단일 라우트 위저드에서 브라우저 back이 step 후퇴가 아니라 `/onboarding` 이탈이 됨.
**How to avoid (재량 권장):** step 전진 시 `history.pushState({step})` + `popstate` 리스너로 step 후퇴 처리. D-04(소실 허용)라 이탈해도 데이터 걱정은 없음 — 최소 구현은 "이탈 허용+스텝 내 뒤로 버튼 제공"이며, pushState 처리는 있으면 좋은 수준. 과설계 금지.

### Pitfall 7: react-day-picker CSS와 Tailwind v4
**What goes wrong:** `react-day-picker/style.css`는 글로벌 CSS — 클라이언트 컴포넌트에서 import하면 Next가 거부하거나 스타일 순서가 꼬일 수 있음.
**How to avoid:** `app/globals.css`에 `@import 'react-day-picker/style.css';`를 추가하거나, 아예 default CSS 없이 `classNames` prop으로 Tailwind 클래스를 직접 매핑(칩·시트와 시각 일관성에 유리). [ASSUMED — v9 classNames API는 안정 계약이나 Tailwind v4 beta 조합은 이 세션에서 렌더 실증 안 함 → 첫 스파이크에서 확인]

### Pitfall 8: '분석 중…' 행의 소스 판별
**What goes wrong:** places만 구독하면 "장소 0개 추출(manual_review)"·실패를 감지 못함 — 행이 영영 '분석 중'.
**How to avoid:** links UPDATE(extraction_status 전이: pending→processing→ready|failed|manual_review [VERIFIED: constants.ts ExtractionStatus])를 함께 구독(Pattern 1). ready인데 장소 0개·failed 모두 실패 행+재시도(D-15) — `RetryExtractionButton` 로직 재사용(단 dev-tools 문구·router.refresh 대신 reconcile).

### Pitfall 9: 정렬 재계산과 순번 표기 혼동
**What goes wrong:** 리스트를 정렬 인덱스로 넘버링하면 MOA-02 위반(순번 표기는 seq_no 불변).
**How to avoid:** 행 넘버 배지는 항상 `place.seq_no` (#{seq_no}), 정렬은 배열 순서만 바꿈. comparator 단위 테스트로 고정.

## Code Examples

### resolve-place 호출 (MOA-04 검색 UI)
```typescript
// Source: supabase/functions/resolve-place/index.ts 계약 (실코드)
const { data, error } = await client.functions.invoke('resolve-place', {
  body: { query, language: 'ko' },          // query 1..200자
});
// data: { places: ResolvedPlace[] }  (max 5)
// 선택 후: addManualPlace(client, { board_id: tripId, google_place_id: picked.id })
```

### shareMoa + 복사/공유 (SHARE-01, D-17/18/19)
```typescript
// Source: packages/api/src/queries/trips.ts shareMoa (실코드 계약)
const slug = await shareMoa(client, tripId, mode);   // 재호출 = mode 갱신, slug 보존
const url = `${process.env.NEXT_PUBLIC_APP_URL}/t/${slug}`;
await navigator.clipboard.writeText(url);
toast('링크를 복사했어요');
if (navigator.share) {
  try { await navigator.share({ url }); }
  catch (e) { if ((e as Error).name !== 'AbortError') throw e; }
}
// 날짜 확정 모아(trip.start_date != null)면 'dates' 카드 숨김 → 2택 (클라이언트 몫, 23-06 주석)
// 재공유 시트: trip.share_mode를 현재 선택 상태로 프리셋 (D-19)
```

### 캘린더 range (D-06)
```typescript
// Source: react-day-picker v9 공개 API (npm exports 확인: './locale' 존재)
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';

<DayPicker
  mode="range"
  locale={ko}
  selected={range}
  onSelect={setRange}          // 첫 탭 = from, 둘째 탭 = to (같은 날 재탭 = 당일치기)
  disabled={{ before: new Date() }}
/>
// 제출: start_date = format(range.from), end_date = format(range.to ?? range.from)
// TripCreateDraftSchema가 end>=start·both-or-null을 최종 검증
```

### 기존 채널 lifecycle idiom (참고 — poll-vote-island.tsx)
```typescript
// Source: apps/web/app/poll/[code]/_components/poll-vote-island.tsx (실코드)
const channel = client.channel(pollChannelName(tripId), { /* config */ });
channel.on('broadcast', { event: 'vote' }, () => void refetchTally()).subscribe();
// cleanup에서 client.removeChannel(channel) — moa 채널도 동일 lifecycle
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 웹 생성·편집 UI 금지 (WEB-01/02) | 웹 = 입력·저장·편집 풀 서피스 | Phase 23 (2026-07) D26 반전 | 신규 UI에 dev-tools 게이트 불필요 |
| `shareTrip` (early-return, mode 없음) | `shareMoa` (mode 갱신 허용, slug 보존) | Phase 23-06 | 재공유 시트가 mode 변경을 그대로 노출 (D-19) |
| `join_shared_trip` (role='voter' 고정) | `join_moa` (share_mode→editor/voter 서버 분기) | 0025 | Phase 24는 링크 생성만 — join은 Phase 25 소비 |
| broadcast-only realtime (extract/plan/poll 채널) | postgres_changes (0026 publication) | Phase 24 최초 도입 | DB가 이벤트 소스 — EF 무수정으로 실시간 반영 |
| supabase-js 2.45.4 (presence 깨짐) | 2.110.0 (선언·lockfile) | 20-01 bump | **`pnpm install` 재실행 필요** — 현재 stale |
| react-day-picker 8.x (date-fns peer) | 9.x (date-fns 내장) · 10.x는 `@daypicker/react`로 개명 | v9 2024, v10 2026 | 9.14.0 채택 — peer 관리 불필요 |
| vaul (drawer with snapPoints) | 공식 unmaintained | 2026 확인 | 드래그 시트는 핸드롤 (D-09와도 일치) |

**Deprecated/outdated:**
- `add_manual_place`의 클라이언트 좌표 전달 방식: 없음 — RPC가 서버에서 해석 (현행 유지)
- `/boards/[id]` dev-tool 표면: 보존하되 무수정 — 정식 UI가 `/moa/[id]`로 대체

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-day-picker 9.x `classNames`/style.css가 Tailwind v4 beta 파이프라인에서 문제없이 동작 | Pitfall 7, Stack | 낮음 — 최악의 경우 classNames로 전량 자체 스타일. 첫 스파이크에서 렌더 확인 |
| A2 | navigator.share/clipboard 동작 조건(secure context, AbortError) | Pitfall 5 | 낮음 — 표준 Web API. 클립보드 fallback이 항상 존재 |
| A3 | SECURITY DEFINER 헬퍼를 호출하는 RLS 정책(can_read_trip 등)이 Realtime WALRUS 평가에서도 정상 동작 | Pattern 1 | 중간 — WALRUS는 구독자 역할로 정책을 평가하며 DEFINER 함수 호출은 일반 SQL과 동일하게 실행될 것으로 추정. 0026 적용 후 로컬 2-클라이언트 스모크로 실증 필요 (Wave 0/1 검증 항목) |
| A4 | 호스트 화면에도 찜(하트) 토글을 두는 것이 MOA-02 e2e 검증에 필요 | Open Q2 | 낮음 — castVote/retractVote가 canonical refs에 있어 의도로 추정되나 명시 결정은 아님 |

## Open Questions

1. **아코디언 '답장 버튼'(MOA-05 필수 요소)의 Phase 24 동작** — 채팅은 Phase 26.
   - What we know: MOA-05가 버튼 존재를 요구, CHAT-03이 실제 동작(인용 칩) 정의. PRODUCT.md·CONTEXT에 Phase 24 시점 동작 정의 없음.
   - What's unclear: disabled 스텁 vs 탭 시 "곧 제공" 안내 vs 미표시.
   - Recommendation: 버튼은 렌더하되 disabled+안내(예: "채팅은 곧 열려요") — MOA-05 요소 충족 + Phase 26이 핸들러만 교체. 플래너가 UI-SPEC에서 확정.
2. **호스트 찜 토글 UI 포함 여부** — MOA-02는 정렬만 요구하지만 게스트 찜은 Phase 25에나 발생. 호스트가 찜할 수 없으면 Phase 24 e2e에서 정렬 검증 불가.
   - Recommendation: 행에 하트 토글 포함 (`castVote`/`retractVote` — canonical refs에 이미 등재). 기존 `/t/[slug]` vote-island의 optimistic+reconcile idiom 재사용.
3. **votes 테이블도 0026 publication에 포함?** — Phase 25(게스트 찜 실시간 반영, SHARE-04)가 필요로 함.
   - Recommendation: D-14는 places/links만 잠갔으므로 0026은 places+links로 최소화. votes는 Phase 25 마이그레이션(0027)으로 — 단, 플래너가 "한 번에 넣어 push 횟수 절약"을 선호하면 0026에 포함해도 무해(추가 구독이 없으면 no-op). 어느 쪽이든 append-only 준수.
4. **`/moa/[id]` 접근 권한** — 호스트 전용? 멤버(editor/voter)도 접근? Phase 25가 `/t/[slug]`를 게스트 표면으로 쓰므로 Phase 24는 로그인+can_read(RLS가 자연 게이트) 기준으로 렌더하면 충분. 명시 결정 없음 — 플래너 확인.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | 빌드·테스트 | ✓ | v22.17.0 | — |
| pnpm | 모노레포 | ✓ | 9.12.0 | — |
| colima (Docker) | supabase local | ✓ 실행 중 | aarch64 VM | — |
| supabase local stack | 마이그레이션·스모크 | ✓ 실행 중 (0025까지 적용) | — | — |
| supabase-js (설치본) | realtime·auth | ✗ **stale 2.45.4** | 선언 2.110.0 | `pnpm install` 재실행 (필수 게이트) |
| 원격 Supabase 마이그레이션 | Vercel Preview e2e | ✗ 0023까지만 | — | `supabase db push` (0024·0025·0026) — human-action |
| `apps/web/.env.local` | 로컬 dev (maps 키 등) | ✓ 존재 | — | — |
| NEXT_PUBLIC_GOOGLE_MAPS_KEY | 지도탭 | 파일 존재로 추정 ✓ | — | 키 부재 시 기존 fallback 문구 렌더 |
| 카카오 로그인 e2e | AUTH-07 | Vercel Preview에서만 | — | 로컬은 이메일 로그인 대체 (성공 기준 1에 명시) |
| react-day-picker | D-06 | 미설치 | 9.14.0 (registry 확인) | 설치 1줄 |

**Missing dependencies with no fallback:**
- 없음 — 전부 명령 1회로 해소 가능(`pnpm install`, `supabase db push`).

**Missing dependencies with fallback:**
- supabase-js stale → `pnpm install` (Wave 0 성격의 선행 작업으로 플랜에 명시)
- 원격 0024/0025/0026 미적용 → push는 Preview e2e 직전 human-action 체크포인트

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^1.6.0 (jsdom, globals, RTL) — apps/web · vitest — packages/core·api |
| Config file | `apps/web/vitest.config.mts` (include: `__tests__/**/*.test.{ts,tsx}`, alias `@`) |
| Quick run command | `pnpm --filter web test:run` (= `vitest run --passWithNoTests`) |
| Full suite command | 패키지별 순차: `pnpm --filter @moajoa/core test:run && pnpm --filter @moajoa/api test:run && pnpm --filter web test:run` — **`pnpm -r test`는 watch 모드로 hang (금지)** |

주의: 테스트 파일은 `apps/web/__tests__/`에 배치(co-located `_components/*.test.tsx`는 include 글롭이 못 잡음 — 19-04 실측 deviation).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-07 | 카카오 버튼 → signInWithOAuth('kakao') 호출 | unit (mock client) | `pnpm --filter web test:run -- login` | ❌ Wave 0 |
| ONBOARD-03 | 4단계 완료 → TripCreateDraft parse 성공 + 생성 호출 | component (RTL) | `pnpm --filter web test:run -- onboarding` | ❌ Wave 0 |
| ONBOARD-04 | 미정→dates null 통과 / 확정→range 두 탭 | component | 위와 동일 파일 | ❌ Wave 0 |
| ONBOARD-05 | 링크·장소 담기·건너뛰기 → 시드 일괄 처리 | component + unit | 위와 동일 | ❌ Wave 0 |
| MOA-02 | sortByLove comparator (love desc, seq asc, 표기 불변) | unit (순수함수) | `pnpm --filter web test:run -- sort` | ❌ Wave 0 |
| MOA-03 | 링크 추가→addLink+triggerExtraction 호출·분석중 행 | component (mock) | `pnpm --filter web test:run -- place-list` | ❌ Wave 0 |
| MOA-04 | 검색→resolve-place invoke→add_manual_place | component (mock) | `pnpm --filter web test:run -- add-sheet` | ❌ Wave 0 |
| MOA-05 | 행 탭 아코디언 4요소·마커탭 스크롤+펼침 | component + manual(지도) | `pnpm --filter web test:run -- place-list` | ❌ Wave 0 |
| MOA-06 | memberColor 순수함수(호스트 브랜드·join순 순환) | unit | `pnpm --filter web test:run -- member-color` | ❌ Wave 0 |
| SHARE-01 | 모드 선택→shareMoa→URL 복사·날짜확정 시 2택 | component (mock clipboard) | `pnpm --filter web test:run -- share-sheet` | ❌ Wave 0 |
| — 0026 | publication 등록 후 postgres_changes 실수신 | script/manual smoke | `supabase/tests/` bash 하네스 (23-01 선례) 또는 psql `select * from pg_publication_tables` | ❌ Wave 0 |
| — 카카오 e2e | Vercel Preview 실로그인 | manual-only | 브라우저 UAT (로컬 불가 — provider redirect URI가 프로덕션 기준, 23-07 잠금) | — |
| — 실시간 e2e | 추출 완료 실반영·핀 등장 | manual smoke | 로컬 2탭 브라우저 (verify-work) | — |

### Sampling Rate
- **Per task commit:** 해당 패키지만 `pnpm --filter <pkg> test:run` + `pnpm --filter <pkg> typecheck`
- **Per wave merge:** core→api→web 순차 3종 test:run + web `pnpm --filter web build`
- **Phase gate:** 3패키지 그린 + build PASS + 로컬 realtime 스모크 → `/gsd-verify-work` (iOS 128 tests는 무접촉이므로 회귀 대상 아님 — 단 core/constants·ui-tokens 변경 시 `pnpm --filter @moajoa/ios test` 1회 확인)

### Wave 0 Gaps
- [ ] `pnpm install` — stale supabase-js 실체화 (테스트 이전의 환경 게이트)
- [ ] `apps/web/__tests__/onboarding.test.tsx` — ONBOARD-03/04/05
- [ ] `apps/web/__tests__/place-sort.test.ts` — MOA-02 comparator
- [ ] `apps/web/__tests__/member-color.test.ts` — MOA-06 배정 함수
- [ ] `apps/web/__tests__/place-list.test.tsx` — MOA-03/05 (분석중 행·아코디언)
- [ ] `apps/web/__tests__/add-sheet.test.tsx` — MOA-04
- [ ] `apps/web/__tests__/share-sheet.test.tsx` — SHARE-01
- [ ] `supabase/tests/realtime_publication_smoke.sh` — 0026 publication + 이벤트 수신 (23-01/02 bash 하네스 선례)
- 프레임워크 설치 불필요 — vitest·RTL·jsdom 전부 기존

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase GoTrue OAuth(kakao 포함) + 서버사이드 PKCE exchange (기존 `/auth/callback` — 무수정 재사용) |
| V3 Session Management | yes | @supabase/ssr 쿠키 세션 + middleware 토큰 refresh (기존) |
| V4 Access Control | yes | RLS deny-by-default. shareMoa owner-only = trips UPDATE RLS. seq_no·join role = 서버 결정. `/moa/[id]` 데이터는 can_read_trip 계열이 자연 게이트 |
| V5 Input Validation | yes | Zod: `TripCreateDraftSchema`(companion ≤20·dates refine), URL 입력은 `detectSourceKind`+addLink, 검색어는 resolve-place EF RequestSchema(1..200) |
| V6 Cryptography | no | 신규 암호화 없음 — slug/토큰 생성은 DB 트리거(gen_random_bytes) 기존 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| open redirect via ?next= | Spoofing | 기존 가드 재사용: `startsWith('/') && !startsWith('//')` (login·callback 양쪽 실존 — 신규 진입 분기에도 동일 적용) |
| SVG 마커 인젝션 | Tampering | `buildMarkerIconUrl` 순수함수 계약 유지 — user 문자열(닉네임 등)을 SVG에 절대 삽입 금지 (T-05-05-01). 색상은 토큰 리터럴만 |
| seq_no forge | Tampering | 0024 트리거가 클라이언트 값 무시 — 신규 insert 경로에서도 seq_no 미전송 유지 |
| 추출 트리거 비용 남용 | DoS | Phase 27 SEC-01 범위(멤버십 게이트) — Phase 24는 로그인 사용자만 UI 노출로 완화. resolve-place는 Bearer JWT 게이트 기존 |
| 서비스 롤 노출 | Info Disclosure | 클라이언트는 anon 키만 (CLAUDE.md §4.4) — 신규 코드 전부 `getSupabaseBrowser()`/`@supabase/ssr` 경유 |
| XSS via 링크/장소명 렌더 | Tampering | React 기본 이스케이프 + `dangerouslySetInnerHTML` 미사용 (기존 코드 관례 — public-board-map의 innerHTML은 정적 문구만) |
| postgres_changes 정보 누출 | Info Disclosure | WALRUS가 구독자 JWT로 RLS 평가 — 비멤버는 이벤트 미수신. A3 스모크로 실증 |

## Sources

### Primary (HIGH confidence)
- 코드베이스 실측: `packages/core/src/constants.ts`·`schemas/trip.ts`·`schemas/place.ts`, `packages/api/src/queries/{trips,votes,places,links,memberships}.ts`, `supabase/migrations/0016·0024·0025`, `supabase/functions/resolve-place/index.ts`, `apps/web/app/{login,auth/callback,boards,poll,t}`, `apps/web/lib/{marker-svg,maps-url}.ts`, `apps/web/components/{bottom-sheet,chip}.tsx`, `packages/ui-tokens/src/index.ts`, `apps/web/vitest.config` — 전부 이 세션에서 직접 읽음
- supabase.com/docs/guides/realtime/postgres-changes — publication SQL·RLS·filter·replica identity [CITED]
- npm registry: react-day-picker@9.14.0 (deps/exports), vaul@1.1.2, supabase-js 2.110.1 latest [VERIFIED: npm view]
- `.planning/phases/23-*/`·STATE.md — 23-04~23-07 실측 기록(원격 0023, KOE205, 하네스 선례)
- github.com/emilkowalski/vaul — unmaintained 공지 [VERIFIED: WebFetch]

### Secondary (MEDIUM confidence)
- daypicker.dev/upgrading — v9→v10 변경(패키지 개명·classNames 키) [CITED — 요약 fetch]
- `.planning/todos/pending/supabase-js-upgrade-presence.md` — presence 비호환 격리 증거(2.10.2 vs 2.108.2 실측)

### Tertiary (LOW confidence)
- 없음 — WebSearch 미사용(모든 외부 주장을 registry/공식 docs/실코드로 검증)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 dep 1개(react-day-picker)까지 registry 검증, 나머지는 기존 실코드
- Architecture: HIGH — 전 패턴이 기존 코드 idiom 파생. 유일한 신규 메커니즘(postgres_changes)은 공식 docs 검증 + A3 스모크 항목화
- Pitfalls: HIGH — 1·2·3·8은 이 세션 실측(stale node_modules, publication 0건, 원격 0023), 5·7은 표준 API 지식(ASSUMED 표기)

**Research date:** 2026-07-08
**Valid until:** 2026-08-07 (안정 스택 — 단 supabase-js 설치 상태는 실행 시점 재확인)
