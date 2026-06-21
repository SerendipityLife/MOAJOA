# Phase 17: Trip Foundation & IA 재편 - Research

**Researched:** 2026-06-21
**Domain:** Expo Router IA 재편 (nested dynamic-route tabs) · Supabase 스키마 squash/reset + RLS 헬퍼 이전 · 제휴 SubID 포맷 계약 (`packages/core`)
**Confidence:** HIGH (Expo Router 패턴 = Context7 official docs · 제휴 포맷 = official provider docs · 스키마/RLS = 코드베이스 직접 확인 · Supabase squash = official CLI docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (research WITHIN these — do NOT relitigate)

**Trip ↔ Board 데이터 모델 (식별자 계약)**
- **D-01:** trip = board, **1:1**. `trip_id`가 캐노니컬 트립 스코프 식별자이며 board의 id와 동일 개념. 한 여행 = 한 장소 묶음 = 한 trip.
- **D-02:** DB 테이블을 **`boards` → `trips`로 물리 rename**. 신규 코드는 trip 어휘 사용. `packages/core`는 `Trip`/`TripId`를 캐노니컬로 노출.
- **D-03:** 마이그레이션 전략 = **스키마 squash/리셋(trips-native)**. 0001~0015를 trips 중심 단일 깨끗한 스키마로 압축. **기존 도그푸딩 데이터 전소실을 사용자가 명시 승인.** ⚠️ CLAUDE.md §4.3/§5 append-only 규칙을 이번 마일스톤 리셋에 한해 의도적으로 override. 이후 마이그레이션은 다시 append-only. RLS 헬퍼(SECURITY DEFINER, 0002·0005 패턴)·트리거·`join_shared_board`(0009)·뷰(0013)를 새 trips 스키마로 이전. 로컬/Supabase DB reset 필요(Windows 동료 포함).

**SubID / 어트리뷰션 포맷 (ATTR-01, Day1 잠금 — 변경 불가)**
- **D-04:** SubID 컨텍스트 = **`tripId.placeId.userId`** (placeId optional — eSIM·교통 등 장소 없는 예약은 생략).
- **D-05:** 인코딩 = **opaque click 토큰**. SubID = 짧은 토큰(예: `c_<base62>`). `booking_clicks` 행이 `{trip_id, place_id?, user_id, provider, created_at}` 보유.
- **D-06:** **Phase 17이 잠그는 것 = 계약만**: `buildAffiliateUrl(provider, productParams, subId)` 시그니처 + 토큰 포맷 + `BookingClickContext`(`{tripId, placeId?, userId}`) Zod 타입 + 프로바이더별 SubID 주입 위치(Travelpayouts `marker=ID.subID`, Stay22 campaign/AID + claimed domain). **손조립 절대 금지** (Pitfall 1).
- **D-07:** 토큰 민팅(booking_clicks INSERT) + redirect EF은 **Phase 20**. 단 squash 때문에 **빈 `booking_clicks` 테이블은 Phase 17 리셋 스키마에 포함**하는 것이 깔끔 — 최종 위치는 plan-phase 판단.

**"일정 정해짐" 여행 생성 입력 (SETUP-01/02)**
- **D-08:** 도시 입력 = **프리셋 리스트(일본 도시) + "기타"**. `city_code` 깨끗 유지. Google Autocomplete는 Phase 2.
- **D-09:** 날짜 = **범위 필수(시작~종료)**. 당일치기 = 종료=시작 허용.
- **D-10:** 대표(결제자) = **생성자 자동 대표**. `trips.representative_id` FK(→ profiles). 재지정은 나중.
- **D-11:** "일정 정해졌나요?" **분기는 노출**하되, 미정 탭은 **비활성 + "곧 제공"**(Phase 19가 채움).

**기존 링크 호환 & 라우트 (NAV-04 — 재해석)**
- **D-12:** NAV-04 = **"라우트 위생"으로 재해석** (데이터 복구 아님).
- **D-13:** 옛 라우트 = **클린 브레이크**. 앱 `boards/[id]` 제거 → `trip/[id]`. `share-handler`를 trip 플로우로 repoint. 레거시 리다이렉트 alias 없음.
- **D-14:** 웹 공개 공유 라우트 = **`/b/[slug]` → `/t/[slug]`(또는 `/trip/[slug]`)로 변경**. slug는 `trips`에 위치.
- **D-15:** ⚠️ ROADMAP Phase 17 Success Criterion #5 / NAV-04("기존 공유 링크가 깨지지 않고 열린다")는 문자 그대로 **WAIVED**. 플래너·verifier는 #5를 하드 게이트로 삼지 말 것. "옛 URL 패턴 제거/이전, 신규 공유 경로 동작"으로 갱신.

### Claude's Discretion (research options, recommend)
- 4탭 진입 시 기본 착지 탭: PRODUCT §6 = `plan` (재논의 불요). Phase 17에선 빈 상태로 착지.
- "마지막 본 여행"(N개 진입) 영속화 위치: 로컬(AsyncStorage) vs `profiles` 컬럼 — 플래너 판단. 로컬이 단순.
- 토큰 base62 구현 세부, RLS 헬퍼 재구성 방식, 프리셋 도시 목록 정확한 항목.

### Deferred Ideas (OUT OF SCOPE)
- Google Places Autocomplete 도시 입력 — Phase 2.
- 멀티시티 trip(여러 city_code) — 현재 단일 도시. 추후.
- 대표 재지정 UI / 멤버 초대 — Phase 19 이후.
- 옛 `boards/[id]` 리다이렉트 alias — 외부 사용자 생기면 재고(현재 클린 브레이크).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | 진입 시 여행 0개→온보딩, 1개→바로, 2개+→마지막 본 여행 | §Pattern 1 (진입 분기 명시 함수) + §Pattern 5 ("마지막 본 여행" AsyncStorage 권장) |
| NAV-02 | 여행 안 하단 탭(지도·플랜·예약·가계부) + 탭바 항상 보임 | §Pattern 2 (`trip/[id]/(tabs)/_layout` nested Tabs) + §System Architecture Diagram |
| NAV-03 | 새 여행·여행 전환·내 정보를 헤더에서 접근 (새 여행≠탭) | §Pattern 3 (trip-scoped header via `Stack.Screen options` + `useGlobalSearchParams`) — FAB 제거 |
| NAV-04 | (D-12/15 재해석) 라우트 위생 — 옛 패턴 제거/이전, 신규 공유 경로 동작 | §Pattern 4 (클린 브레이크: 앱 `boards/[id]`→`trip/[id]`, 웹 `/b/[slug]`→`/t/[slug]`, share-handler repoint) |
| ATTR-01 | 모든 예약 딥링크가 trip(가능시 place) SubID로 생성 | §Standard Stack (provider 포맷) + §Pattern 6 (`buildAffiliateUrl` 단일 헬퍼 + opaque 토큰 + Zod) |
| SETUP-01 | "일정 정해짐" 분기에서 날짜·도시 입력해 여행 생성 | §Pattern 7 (트립 생성 UI: 도시 프리셋 + 날짜 범위 필수) + §Code Examples (TripCreate Zod) |
| SETUP-02 | 여행에 대표(결제자) 지정 | §Schema (trips.representative_id FK) + D-10 생성자 자동 대표 |
</phase_requirements>

## Summary

이 phase는 **세 개의 독립적 기술 도메인**을 한 번에 잠근다: (1) Expo Router IA를 전역 5탭에서 trip-스코프 4탭(`trip/[id]/(tabs)/{map,plan,book,ledger}`)으로 뒤집고, (2) Supabase 스키마를 0001~0015 → trips-native 단일 베이스라인으로 squash 하면서 모든 SECURITY DEFINER RLS 헬퍼·트리거·`join_shared_board`·`public_board_view`를 새 테이블 이름으로 이전하고, (3) `packages/core`에 `buildAffiliateUrl` + `BookingClickContext` + opaque 토큰 포맷 계약을 잠근다(민팅·EF는 Phase 20).

검증된 결론: **세 도메인 모두 표준 패턴이 존재하며 손조립이 불필요하다.** Expo Router는 동적 라우트 폴더 안에 `(tabs)` 그룹을 중첩하는 패턴을 공식 지원하고(Context7 HIGH), Supabase CLI는 `db dump`로 baseline을 만들고 `db reset`/`migration repair`로 히스토리를 재설정하는 공식 squash 워크플로우를 제공한다(official docs HIGH). 제휴 포맷은 **양 프로바이더 모두 임의 영숫자 토큰을 허용** — Travelpayouts SubID는 최대 128자 `[A-Za-z0-9_-]`, Stay22 campaign은 명시적 제약 없음 — 이므로 `c_<base62>` 토큰(~12자)은 Day1부터 구조적으로 안전하다(official provider docs HIGH/MEDIUM).

가장 큰 리스크는 코드량이 아니라 **회귀의 침묵성**이다 (Pitfall 7): 중첩 `_layout`을 한 번에 뒤집으면 탭바 유실/이중중첩이 조용히 숨고, share-handler/index/native-intent를 한 phase에서 함께 고치지 않으면 한쪽만 새 라우트를 안다. RLS는 squash 시 직접 EXISTS로 회귀하면 0002에서 고쳤던 42P17 재귀 버그가 부활한다.

**Primary recommendation:** 4 plan으로 분리 — (P1) squash 마이그레이션 + core `Trip`/`TripId` Zod 리네임(동일 PR, D-02/03) · (P2) `buildAffiliateUrl` + `BookingClickContext` + opaque 토큰 (TDD, 순수 함수) · (P3) Expo Router 4탭 재편 + 0/1/N 진입분기 + trip-scoped 헤더 + FAB 제거 + share-handler/native-intent/index 동시 수정 · (P4) "일정 정해짐" 트립 생성 UI(도시 프리셋·날짜 범위·자동 대표) + 미정 "준비 중" 스텁 + 웹 `/t/[slug]` 라우트 이전. "마지막 본 여행"은 **AsyncStorage** 권장(profiles 컬럼 불필요 — 디바이스 로컬 선호로 충분).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| trip 데이터 모델 (`trips` 테이블, RLS, 트리거) | Database / Storage | — | 식별자 계약의 진실 원천. RLS는 DB가 강제 (CLAUDE.md §4.4) |
| `trip_id` 캐노니컬 식별자 + Zod 계약 | packages/core | DB (FK) · API · iOS · Web | core가 단일 정의, 모든 클라이언트가 import |
| 4탭 IA + 진입 분기 (0/1/N) | iOS (Expo Router) | — | 네비게이션은 클라이언트 라우터. 진입 로직은 `index.tsx` |
| trip-scoped 헤더 (전환/프로필) | iOS (Expo Router layout) | — | 라우트 머신의 layout 레벨 |
| `buildAffiliateUrl` + SubID 인코딩 | packages/core | EF (Phase 20 소비) | 손조립 금지 — 단일 헬퍼가 마커/SubID 누락을 구조적으로 차단 |
| 토큰 민팅 (booking_clicks INSERT) | Edge Function (Phase 20) | DB | service-role 쓰기. **Phase 17은 빈 테이블 스키마만** |
| 웹 공개 공유 (`/t/[slug]` SSR) | Frontend Server (Next.js) | DB (public RPC) | SSR 비로그인 열람. `public_board_view` → `public_trip_view` |
| 트립 생성 입력 (도시·날짜·대표) | iOS | core (Zod) · API · DB | 입력 UI는 iOS, validate는 core Zod, persist는 API/DB |
| share 인입 라우팅 | iOS (`+native-intent` + `share-handler`) | — | trip 라우트로 repoint (D-13) |

## Standard Stack

### Core (모두 기존 — 신규 의존 0)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-router` | ~56.2.11 (현 설치) | 파일기반 라우팅 + nested layout | 이미 채택. 동적 라우트 + 중첩 탭 공식 지원 [VERIFIED: apps/ios/package.json] |
| `expo` | ~56.0.12 (SDK 56) | RN 런타임 | 현 SDK [VERIFIED: apps/ios/package.json] — ⚠️ Context7 `/websites/expo_dev`는 SDK 54/55 브랜치만. 56 = 55 패턴과 동일 (Stack composition API는 55+) |
| `@react-native-async-storage/async-storage` | 2.2.0 (현 설치) | "마지막 본 여행" 영속화 | 이미 OnboardKeys/SharedDefaults 패턴 존재 [VERIFIED: apps/ios/package.json] |
| `zod` | ^3.23.8 (현 설치) | `Trip`/`TripId`/`BookingClickContext` 계약 | core 전체가 이미 zod. 외부입력 validate는 CLAUDE.md §4.5 [VERIFIED] |
| Supabase CLI | (글로벌) | squash/reset/types regen | `supabase:reset`/`supabase:types` 스크립트 존재 [VERIFIED: package.json] |
| `expo-web-browser` | ~56.0.5 (현 설치) | (Phase 20용) 시스템 브라우저 | 이미 설치 — Phase 17은 미사용, Phase 20 Pitfall 2 대비 존재 확인만 [VERIFIED] |

### Supporting (이미 존재하는 자산)
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `BoardSchema` (board.ts) | trip 모양 이미 보유 (city_code/start_date/end_date/share_slug/cover) | `TripSchema`로 rename + `representative_id` 추가 |
| `Limits`/`BoardVisibility` (constants.ts) | 도메인 한도·enum | trip 어휘로 이전 (`BoardsPerUser`→`TripsPerUser` 등) |
| `listMyBoards`/`createBoard`/`getPublicBoardBySlug` (packages/api) | 트립 쿼리 | trip 어휘로 rename, 시그니처 동일 |
| SECURITY DEFINER 헬퍼 (0001/0002/0009) | RLS 재귀 회피 | squash 시 trips 스키마에 그대로 이전 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AsyncStorage "마지막 본 여행" | `profiles.last_trip_id` 컬럼 | DB 컬럼은 멀티디바이스 sync 가능하나 마이그레이션+RLS+왕복 추가. 단일 사용자·단순성 우선 → **AsyncStorage 권장** (D Discretion) |
| 스키마 squash (clean reset) | board→trip ALTER RENAME (append-only) | RENAME이 데이터 보존이나 D-03이 데이터 전소실 명시 승인 + 히스토리 청결 우선 → **squash 확정** |
| Stay22 `campaign` 파라미터에 토큰 | Stay22 `subid` 별도 파라미터 | Stay22 공식 어트리뷰션 파라미터는 `aid`+`campaign`. campaign이 자유 라벨 → 토큰 주입 위치 [CITED: community.stay22.com] |
| opaque `c_<base62>` 토큰 | 평문 `tripId.placeId.userId` | 평문은 (a) UUID×3 = ~108자 길이 부담 (b) 제3자 네트워크에 식별자 노출. opaque 토큰이 길이·프라이버시 둘 다 우위 (Pitfall: SubID에 PII 인코딩 금지) → **opaque 확정 (D-05)** |

**Installation:** 신규 패키지 설치 없음 — 전부 기존 의존성.

**Version verification:** [VERIFIED: apps/ios/package.json + root package.json — 2026-06-21 직접 read] expo ~56.0.12 / expo-router ~56.2.11 / RN 0.85.3 / async-storage 2.2.0 / zod ^3.23.8 / @supabase/supabase-js 2.45.4 (pnpm override). ⚠️ Context7 expo 인덱스가 SDK 54/55만 노출하므로 56 전용 API 변경은 plan-phase에서 `expo-router@56` 실측 권장 (특히 Stack composition API).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── APP ENTRY ───────────────────────────┐
│  app/index.tsx  (진입 분기 — NAV-01)                              │
│    session? ──no──▶ /welcome                                     │
│       │yes                                                       │
│       ▼  listMyTrips(count)                                      │
│    ┌──────────┬───────────────┬──────────────────────────┐      │
│    │ 0 trips  │  1 trip        │  N trips                  │      │
│    ▼          ▼                ▼                           │      │
│  /onboarding  trip/<id>/plan   AsyncStorage[last_trip_id] │      │
│  (생성 분기)                     ?? trips[0].id → /plan      │      │
└────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────── app/trip/[id]/_layout.tsx (Stack, 1 screen) ─────────┐
│  Stack.Screen options={{ header: <TripHeader tripId> }}          │
│    TripHeader:  [현재 여행 ▾ 전환]      [프로필 →/me]  (NAV-03)    │
│       │ useGlobalSearchParams() → id                             │
│       ▼ getTrip(id) → title                                     │
│  ┌──────── trip/[id]/(tabs)/_layout.tsx  (Tabs — NAV-02) ──────┐ │
│  │  탭바 항상 보임:                                             │ │
│  │  [지도 map] [플랜 plan] [예약 book] [가계부 ledger]          │ │
│  │     │          │           │            │                   │ │
│  │     ▼          ▼ (착지)     ▼            ▼                   │ │
│  │  map.tsx   plan.tsx     book.tsx    ledger.tsx              │ │
│  │  (지도핀)  (빈상태→18)  (준비중→20)  (준비중→21)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────── SHARE INGESTION (repoint — D-13) ───────────────────┐
│  +native-intent.tsx ──redirect──▶ share-handler.tsx              │
│    handleSharedUrl: addAndNavigate → router.replace(             │
│      `/trip/${tripId}/plan`)   ← 변경: 옛 `/boards/${id}`        │
└──────────────────────────────────────────────────────────────────┘

┌──────────── WEB PUBLIC (Next.js SSR — D-14) ────────────────────┐
│  /t/[slug]/page.tsx  ──RPC──▶  public_trip_view(slug)           │
│    (옛 /b/[slug] 파일트리 이동 + RPC 이름 이전)                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────── core 식별자 계약 (ATTR-01) ─────────────────────────┐
│  packages/core:                                                  │
│    BookingClickContext = { tripId, placeId?, userId }  (Zod)    │
│    buildAffiliateUrl(provider, productParams, subId) → URL      │
│       provider='travelpayouts' → ...&marker=ID.${subId}         │
│       provider='stay22'        → ...&aid=AID&campaign=${subId}  │
│    subId 포맷: c_<base62>  (Phase 20이 booking_clicks에서 민팅)  │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (iOS app — after rename)
```
apps/ios/app/
├── index.tsx                    # 진입 분기 0/1/N (NAV-01) — 확장
├── welcome.tsx                  # (유지)
├── onboarding.tsx (or 분기)      # 0 trips → "일정 정해짐?" 분기 (SETUP-01)
├── +native-intent.tsx           # repoint → /share-handler (유지, 변경 적음)
├── share-handler.tsx            # repoint → /trip/<id>/plan (D-13)
├── trip/
│   ├── [id]/
│   │   ├── _layout.tsx          # Stack + TripHeader (NAV-03)
│   │   └── (tabs)/
│   │       ├── _layout.tsx      # Tabs (NAV-02) — 탭바 항상 보임
│   │       ├── map.tsx          # 지도 핀 (옛 boards/[id] 콘텐츠 이식)
│   │       ├── plan.tsx         # 착지 탭, 빈 상태 (Phase 18 채움)
│   │       ├── book.tsx         # "준비 중" 스텁 (Phase 20)
│   │       └── ledger.tsx       # "준비 중" 스텁 (Phase 21)
│   └── new.tsx (or trip/create)  # "일정 정해짐" 생성 UI (SETUP-01/02)
└── (제거) boards/, (tabs)/{boards,discover,friends,new}
```
⚠️ `(tabs)/me.tsx`(내 정보)는 헤더 프로필 진입으로 보존 필요 — 위치는 plan-phase 판단 (`me.tsx`를 trip 밖 전역 스택 스크린으로 두는 것이 자연스러움).

### Pattern 1: 진입 분기 명시 함수 (NAV-01)
**What:** `index.tsx`에서 0/1/N을 명시적 분기로. 각 케이스 단위 테스트 가능하게 순수 함수로 분리.
**When to use:** 앱 cold launch + 인증 상태 변화 시.
**Example:**
```typescript
// 순수 함수 — packages/core 또는 iOS lib. 단위 테스트 대상 (Pitfall 7 엣지).
// "마지막 여행이 방금 삭제됨" 엣지: lastTripId가 trips에 없으면 trips[0]로 폴백.
export function decideEntryRoute(
  trips: { id: string }[],
  lastTripId: string | null,
): { kind: 'onboarding' } | { kind: 'trip'; tripId: string } {
  if (trips.length === 0) return { kind: 'onboarding' };
  if (trips.length === 1) return { kind: 'trip', tripId: trips[0].id };
  const last = lastTripId && trips.some((t) => t.id === lastTripId) ? lastTripId : trips[0].id;
  return { kind: 'trip', tripId: last };
}
// index.tsx: route.kind==='trip' → <Redirect href={`/trip/${route.tripId}/plan`} />
//            route.kind==='onboarding' → <Redirect href="/onboarding" />
```
**Note:** 현 `index.tsx`는 이미 `supabase.auth.onAuthStateChange` 구독으로 재평가 — 이 패턴 보존, board 분기만 trip 0/1/N으로 교체. [VERIFIED: apps/ios/app/index.tsx]

### Pattern 2: 동적 라우트 안의 중첩 탭 (NAV-02 — 탭바 항상 보임)
**What:** `trip/[id]/(tabs)/_layout.tsx`에 `<Tabs>` — `(tabs)` 그룹은 URL에 안 드러나며 4탭을 항상 렌더.
**When to use:** trip 스코프 4탭.
**Example:**
```tsx
// app/trip/[id]/(tabs)/_layout.tsx
// Source: Context7 /websites/expo_dev — docs.expo.dev/router/advanced/tabs
import { Tabs } from 'expo-router';
export default function TripTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false /* 헤더는 부모 Stack이 소유 */ }}>
      <Tabs.Screen name="map" options={{ title: '지도' }} />
      <Tabs.Screen name="plan" options={{ title: '플랜' }} />
      <Tabs.Screen name="book" options={{ title: '예약' }} />
      <Tabs.Screen name="ledger" options={{ title: '가계부' }} />
    </Tabs>
  );
}
```
**핵심:** 탭바 유실 회귀(Pitfall 7)를 피하려면 헤더는 **부모 Stack `_layout`** 이, 탭바는 **`(tabs)/_layout`** 이 소유 — 한 레이아웃에 둘을 섞지 않는다. 상세 push가 필요하면 `(tabs)` 안에 또 다른 Stack을 중첩 (이중 `(tabs)` 금지).

### Pattern 3: trip-scoped 헤더 + 동적 param (NAV-03)
**What:** 부모 `trip/[id]/_layout.tsx` Stack의 `header`에 커스텀 컴포넌트. 왼쪽 "현재 여행 ▾"(전환), 오른쪽 프로필. FAB는 제거 (새 여행=헤더/온보딩 액션).
**When to use:** 모든 4탭에서 공통으로 보이는 트립 헤더.
**Example:**
```tsx
// app/trip/[id]/_layout.tsx
// Source: Context7 /websites/expo_dev — docs.expo.dev/router/advanced/stack (dynamic options)
import { Stack, useGlobalSearchParams } from 'expo-router';
export default function TripLayout() {
  const { id } = useGlobalSearchParams<{ id: string }>(); // layout에서 동적 param 접근
  return (
    <Stack screenOptions={{ header: () => <TripHeader tripId={id} /> }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
// TripHeader: getTrip(id) → title; 왼쪽 Pressable "현재 여행 ▾" → 전환 시트;
//             오른쪽 Pressable → router.push('/me')
```
**Note:** layout 내부 param 접근은 `useGlobalSearchParams` (focus 무관 업데이트). 화면 내부는 `useLocalSearchParams`. [CITED: docs.expo.dev/versions/latest/sdk/router] SDK 55+는 `Stack.Title`/`Stack.Header` composition API도 가능하나 SDK 56 동작은 plan-phase 실측.

### Pattern 4: 클린 브레이크 라우트 이전 (NAV-04 재해석 — D-13/14)
**What:** 옛 라우트를 **삭제하고** 새 라우트로 이전. 리다이렉트 alias 없음 (외부 사용자 0명).
**iOS:** `app/boards/` 트리 제거 → `app/trip/[id]/(tabs)/map.tsx`로 콘텐츠 이식. `share-handler.tsx`의 `router.replace('/boards/${boardId}')` → `/trip/${tripId}/plan`. `+native-intent`는 `/share-handler`만 가리키므로 변경 거의 없음 (handler 내부만 수정).
**Web:** `apps/web/app/b/[slug]/` 트리 전체를 `/t/[slug]/`로 이동 (page/error/not-found/opengraph-image/_components 모두). RPC `public_board_view` → `public_trip_view` 이름 이전(squash 시). `/api/revalidate?slug=` 웹훅 경로는 EF에서 호출하므로 같이 점검.
**Anti-pattern:** D-15에 따라 옛 `/b/[slug]` 리다이렉트를 **추가하지 말 것** — 외부 사용자 부재로 사용자가 명시 waive. (Pitfall 7의 "하위호환 리다이렉트"는 이 phase에서 의도적으로 적용 안 함.)

### Pattern 5: "마지막 본 여행" 영속화 (NAV-01 N케이스) — **AsyncStorage 권장**
**What:** trip 진입 시 `AsyncStorage.setItem(TripKeys.LastTripId, id)`, `index.tsx`에서 read.
**Why AsyncStorage over profiles column:** (a) `OnboardKeys`/`SharedDefaultsKeys` 패턴 이미 존재 — 일관성 (b) DB 컬럼은 마이그레이션+RLS+왕복 추가인데 단일 사용자엔 과함 (c) D Discretion "로컬이 단순" 명시. **권장:** `constants.ts`에 `TripKeys = { LastTripId: '@moajoa/trip:last_id' }` 추가 (기존 네임스페이스 패턴 미러). [VERIFIED: constants.ts OnboardKeys 패턴]

### Pattern 6: 단일 `buildAffiliateUrl` 헬퍼 (ATTR-01 — 손조립 금지)
**What:** `packages/core`에 딥링크를 만드는 **유일한** 함수. provider별 SubID 주입 위치를 캡슐화.
**Example:** (§Code Examples 참조 — 전체 구현)
**Anti-pattern:** 어디서든 URL 문자열을 손으로 조립하는 코드 → 마커/SubID 누락이 가능해짐. ESLint/grep로 `stay22.com`/`tp.st`/`marker=` 리터럴이 core 밖에 없는지 검증 가능.

### Pattern 7: 트립 생성 입력 (SETUP-01/02)
**What:** "일정 정해졌나요?" 분기 → 정해짐: 도시 프리셋 picker + 날짜 범위(시작~종료 필수) + 자동 대표. 미정: 비활성 탭 + "곧 제공".
**도시 프리셋:** 기존 `CITY_KO_MAP`(tokyo/osaka/kyoto/seoul/busan/jeju/fukuoka/sapporo/okinawa) 재사용 가능 + "기타". 일본 중심이므로 일본 도시 우선 정렬. [VERIFIED: constants.ts CITY_KO_MAP]
**날짜:** `start_date`/`end_date` 둘 다 필수 (D-09). 당일치기 = end=start 허용. core `TripCreateSchema`에서 `end_date >= start_date` refine.
**대표:** 생성 시 `representative_id = 본인` 자동 (D-10). 트리거 또는 클라가 set.

### Anti-Patterns to Avoid
- **이중 `(tabs)` 중첩:** 탭바 안에 탭바 → 탭바 유실/중복 (Pitfall 7). 헤더=부모 Stack, 탭=`(tabs)`로 책임 분리.
- **share-handler만 고치고 index/native-intent 방치:** 한쪽만 새 라우트를 앎 → 저장 플로우 끊김. **세 파일 한 plan에서 (Pitfall 7).**
- **RLS에서 직접 EXISTS (다른 테이블):** squash 시 0002에서 고친 42P17 재귀 부활. SECURITY DEFINER 헬퍼 경유 (CLAUDE.md §4.4).
- **딥링크 URL 손조립:** core 밖에서 affiliate URL 문자열 조립 금지 (Pitfall 1).
- **SubID에 PII(이메일/이름):** opaque 토큰만 — 제3자 네트워크 노출 (Security Mistakes).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 스키마 baseline 생성 | 수작업 SQL 재작성 | `supabase db dump -f .../00000000000001_baseline.sql` (로컬 reset 후) | 현 스키마 정확 스냅샷, 누락 방지 [CITED: supabase docs] |
| 마이그레이션 히스토리 재설정 | `schema_migrations` 직접 DELETE 즉흥 | `supabase migration repair` + 문서화된 reset 순서 | 공식 경로, 히스토리 정합성 [CITED: supabase CLI ref] |
| DB 타입 재생성 | 수작업 타입 편집 | `pnpm supabase:types` (`gen types typescript --local`) | 스크립트 존재, board→trip 타입 자동 반영 [VERIFIED: package.json] |
| affiliate URL 조립 | provider별 인라인 문자열 | `buildAffiliateUrl` 단일 core 헬퍼 | 마커/SubID 누락 구조적 차단 (Pitfall 1) |
| share_slug 생성 | 새 토큰 생성기 | 기존 `ensure_share_slug` 트리거 (~60bit, 0001) | 검증됨, squash 시 그대로 이전 [VERIFIED: 0001_init.sql] |
| 비로그인 초대 join | 새 RLS insert 정책 | 기존 `join_shared_board` SECURITY DEFINER (0009) | bearer-invite 모델 검증됨, Phase 19 재사용 [VERIFIED: 0009] |
| nested tab 라우팅 | 커스텀 탭 상태 머신 | expo-router `(tabs)` 그룹 + `Tabs.Screen` | 공식 패턴 [CITED: docs.expo.dev/router/advanced/tabs] |
| 진입 영속화 | 커스텀 storage 래퍼 | AsyncStorage + 기존 `*Keys` 네임스페이스 패턴 | 일관성, 이미 설치 [VERIFIED: constants.ts] |

**Key insight:** 이 phase의 모든 "어려운" 부분(스키마 squash, RLS 재귀, nested 탭, affiliate 포맷)은 **이 코드베이스에 이미 검증된 패턴이 있거나 공식 도구가 있다.** 신규 발명 0. 위험은 발명이 아니라 **이전 시 누락/회귀**다.

## Runtime State Inventory

> Phase 17은 rename/reset phase이므로 필수. grep은 파일을 찾지 squash 후 런타임 상태를 찾지 못한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Supabase `boards`/`memberships`/`links`/`places`/`votes` 행 — **전소실 승인됨 (D-03)**. PostGIS `geog` generated 컬럼 + GIST 인덱스 재생성 필요. | **데이터 마이그레이션 불필요** (전소실). 새 trips 스키마에 동일 인덱스/생성컬럼 재정의 (code) |
| **Live service config** | Supabase **linked 프로젝트**의 `supabase_migrations.schema_migrations` 히스토리 테이블 (0001~0015 등록됨) — git에 없는 원격 DB 상태. Realtime broadcast 채널 `extract:{link_id}` (코드 상수, 데이터 아님). | linked DB를 squash 베이스라인으로 reset + `migration repair`. **Windows 동료도 로컬 reset 필요** (D-03) [CITED: supabase docs] |
| **OS-registered state** | None — verified: iOS App Group(`group.com.serendipitylife.moajoa`)은 share payload 키만, board id 미포함. Task Scheduler/launchd 등록 없음 (모바일 앱). | None |
| **Secrets/env vars** | None 영향 — `SUPABASE_ANON_KEY`/service role 키는 테이블명 무관. `NEXT_PUBLIC_ENABLE_DEV_TOOLS`는 dev tool 게이트(코드). | None (키 불변) |
| **Build artifacts / installed packages** | `packages/api/src/types/database.ts` — board 타입이 박힌 **생성 산출물**. squash 후 stale. `apps/ios` Metro 캐시 (라우트 구조 변경 시). | `pnpm supabase:types` 재생성 (필수, CLAUDE.md §4.3). Metro 캐시 클리어 권장 |

**AsyncStorage 상태 (디바이스):** `SharedDefaultsKeys.LastBoardId`(App Group) + (있다면)앱 AsyncStorage `last_board_id` — board id를 캐시. trip 진입 시 무의미해짐. Action: **TripKeys.LastTripId 신규 키** 도입 (옛 키 마이그레이션 불필요 — 데이터 전소실로 board id도 무효).

**Web revalidate webhook:** EF → `/api/revalidate?slug=...` (VIEW-06). slug는 trips로 이전되나 값 형식 동일 → 웹훅 경로명만 점검.

## Common Pitfalls

### Pitfall 1: 중첩 레이아웃 빅뱅 회귀 — 탭바 유실 (PITFALLS.md Pitfall 7 구체화)
**What goes wrong:** `(tabs)/{boards,discover,me,friends,new}` 전역 → `trip/[id]/(tabs)/{map,plan,book,ledger}` 스코프로 통째 뒤집을 때, 헤더와 탭을 한 `_layout`에 섞거나 `(tabs)`를 이중 중첩하면 탭바가 사라지거나 탭 안에 탭이 생긴다.
**Why it happens:** expo-router는 라우트 머신이라 한 번에 뒤집으면 회귀가 조용히 숨음 (타입드 라우트도 런타임 진입순서는 못 잡음).
**How to avoid:** 책임 분리 — 헤더=부모 `trip/[id]/_layout`(Stack), 탭바=`trip/[id]/(tabs)/_layout`(Tabs). 4탭 + (필요시)상세 push에서 탭바가 보이는지 디바이스 확인을 verify 기준으로.
**Warning signs:** 상세 화면에서 탭바 사라짐 / 탭 안에 탭.

### Pitfall 2: 흩어진 라우트 수정 — share 플로우 끊김 (PITFALLS.md Pitfall 7)
**What goes wrong:** `index.tsx`(진입), `share-handler.tsx`(인입), `+native-intent.tsx`(리다이렉트) 중 일부만 trip 라우트로 고치면 한쪽만 새 구조를 알아 저장이 끊긴다.
**How to avoid:** 세 파일을 **같은 plan**에서 수정. `share-handler`의 `addAndNavigate` → `/trip/${tripId}/plan` 변경, `listMyBoards`→`listMyTrips`, `board_id`→`trip_id`. [VERIFIED: share-handler.tsx 현재 `/boards/${boardId}`로 replace]
**Warning signs:** share-handler가 여전히 `/boards/...`로 보냄 / 진입은 trip인데 share는 board.

### Pitfall 3: RLS 재귀 부활 — squash 시 42P17 (CLAUDE.md §4.4)
**What goes wrong:** 새 trips 스키마에서 `boards: shared members can read` 류 정책을 직접 EXISTS로 재작성하면 0002에서 고친 `boards↔memberships` 무한재귀(42P17)가 부활.
**Why it happens:** 1개 깨끗한 마이그레이션으로 압축하면서 "이번엔 직접 써도 되겠지"로 헬퍼 우회.
**How to avoid:** `am_board_owner`/`am_board_member`/`can_read_board`/`can_edit_board`/`can_vote_board`를 **trips 버전으로 이전** (이름은 `am_trip_owner` 등 또는 유지). 모든 cross-table 체크는 SECURITY DEFINER 헬퍼 경유. `set search_path = public` 유지. [VERIFIED: 0001/0002 — 헬퍼 5개 + 트리거 + RPC 3개]
**Warning signs:** 정책 body에 `exists(select ... from <다른테이블>)` 직접 / squash 후 board select가 42P17.

### Pitfall 4: 누락된 SECURITY DEFINER 자산 — 공유/공개/투표 깨짐
**What goes wrong:** squash 시 `ensure_share_slug` 트리거, `join_shared_board`, `accepted_member_count`, `vote_counts_for_places`, `public_board_view`(→trip), `set_updated_at`/`handle_new_auth_user` 트리거, `places_default_added_by` 등 **0001~0015에 흩어진 함수/트리거**를 빠뜨리면 공유·공개열람·투표·자동 added_by가 조용히 깨진다.
**How to avoid:** squash 전 **전 마이그레이션의 함수/트리거/RPC 인벤토리**를 만들고 1:1 체크. `supabase db dump`가 자동 캡처하나 **수동 검수 필수** (특히 0013의 최신 `public_board_view` body가 0001보다 필드 많음 — 최신본을 가져와야 함). [VERIFIED: 0013이 google_place_id/address/summary_ko 추가한 최신 view]
**Warning signs:** 공개 보드가 빈 places / 투표 카운트 0 / 새 가입자 profile 미생성.

### Pitfall 5: Day1 SubID 포맷 후회 — 길이/charset 미검증
**What goes wrong:** opaque 토큰 포맷을 임의로 잡았다가 Phase 20에서 provider 한도 초과 발견 → 포맷 변경 = 초기 어트리뷰션 영구 익명화 (Pitfall 1, 복구 불가).
**How to avoid:** 토큰을 **양 provider 한도 안**으로 Day1 확정. Travelpayouts: 최대 128자, `[A-Za-z0-9_-]` [VERIFIED: support.travelpayouts.com]. Stay22 campaign: 명시 제약 없음, 영숫자+`_` 예시 [CITED: community.stay22.com]. `c_<base62>` (~10-14자)는 양쪽 안전 — base62는 `[0-9A-Za-z]`로 두 charset 교집합 안. **`_`/`-` 회피** (base62만 쓰면 양 provider 안전).
**Warning signs:** 토큰에 `.`/`/`/`=` 등 URL 위험문자 / 토큰 길이 무제한.

## Code Examples

### `buildAffiliateUrl` + `BookingClickContext` (ATTR-01, packages/core)
```typescript
// packages/core/src/booking.ts (신규)
// Source: Travelpayouts marker=ID.subID (support.travelpayouts.com/.../203955653),
//         Stay22 aid+campaign (community.stay22.com/allez-deep-links-...)
import { z } from 'zod';

/** 트립 스코프 클릭 컨텍스트 — Phase 20이 booking_clicks로 민팅. placeId optional (D-04). */
export const BookingClickContextSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
});
export type BookingClickContext = z.infer<typeof BookingClickContextSchema>;

/** opaque click 토큰. base62만 사용 (Travelpayouts·Stay22 charset 교집합). 길이 ≤ 32 ≪ 128 한도. */
export const ClickTokenSchema = z.string().regex(/^c_[0-9A-Za-z]{8,30}$/);
export type ClickToken = z.infer<typeof ClickTokenSchema>;

export const AffiliateProvider = ['travelpayouts', 'stay22'] as const;
export type AffiliateProviderType = (typeof AffiliateProvider)[number];

/**
 * 딥링크를 만드는 유일한 헬퍼 (손조립 금지 — Pitfall 1). productParams는
 * provider별 상품 식별자(hotelname/address/marker base 등). subId는 opaque 토큰.
 * Phase 17은 계약/시그니처만 잠금 — Phase 20이 productParams 실값과 민팅을 채움.
 */
export function buildAffiliateUrl(
  provider: AffiliateProviderType,
  productParams: Record<string, string>,
  subId: ClickToken,
): string {
  // 예시 골격 — 실제 base URL/marker ID/aid는 Phase 20에서 env로 주입.
  if (provider === 'travelpayouts') {
    // marker=<ID>.<subId>  (SubID는 marker에 dot으로 append)
    const sp = new URLSearchParams({ ...productParams, sub_id: subId });
    return `https://tp.st/PLACEHOLDER?${sp.toString()}`;
  }
  // stay22: aid 고정 + campaign에 토큰 주입 + claimed domain 필요
  const sp = new URLSearchParams({ ...productParams, campaign: subId });
  return `https://www.stay22.com/allez/PROVIDER?${sp.toString()}`;
}
```
**Phase 17 잠금 범위 (D-06):** 시그니처 + 토큰 포맷 + Zod 타입 + provider별 주입 위치. **민팅/실 base URL/marker ID = Phase 20.** 단위 테스트로 "subId가 항상 URL에 포함됨 / base62 외 입력 거부 / provider별 올바른 파라미터 키"를 잠근다.

### `TripSchema` rename (board.ts → trip.ts, D-02)
```typescript
// packages/core/src/schemas/trip.ts (board.ts에서 이전)
import { z } from 'zod';
import { TripVisibility, Limits } from '../constants';

export const TripSchema = z.object({
  id: z.string().uuid(),                              // = trip_id (캐노니컬)
  owner_id: z.string().uuid(),
  representative_id: z.string().uuid(),               // NEW (D-10, SETUP-02) — 생성자 자동
  title: z.string().min(1).max(Limits.TripTitleMax),
  description: z.string().max(Limits.TripDescMax).nullable(),
  visibility: z.enum(TripVisibility),
  share_slug: z.string().min(8).max(32).nullable(),
  city_code: z.string().max(20).nullable(),
  start_date: z.string().date().nullable(),
  end_date: z.string().date().nullable(),
  cover_image_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Trip = z.infer<typeof TripSchema>;
export type TripId = Trip['id'];                       // 캐노니컬 식별자 타입

// "일정 정해짐" 생성: 날짜 범위 필수 (D-09), end >= start.
export const TripCreateSchema = z.object({
  title: z.string().min(1).max(Limits.TripTitleMax),
  city_code: z.string().max(20),                       // 프리셋 또는 'other' (D-08)
  start_date: z.string().date(),                       // 필수 (D-09)
  end_date: z.string().date(),                         // 필수 (당일치기=start)
}).refine((v) => v.end_date >= v.start_date, { message: 'end_date must be >= start_date' });
export type TripCreate = z.infer<typeof TripCreateSchema>;
```
**Note:** 기존 `BoardSchema`는 이미 city_code/start/end/share_slug/cover 보유 — `representative_id` 추가 + 어휘 rename만. [VERIFIED: board.ts]

### squash 마이그레이션 워크플로우 (D-03)
```bash
# 1. 로컬을 현 스키마로 채운 뒤 baseline 덤프 (스키마만, 데이터 제외)
supabase db reset                       # 0001~0015 적용된 깨끗한 로컬
# 2. trips-native 베이스라인을 손으로 작성 (board→trip rename 반영) 또는 dump 후 편집
#    → supabase/migrations/0016_trips_baseline.sql  (단일 파일)
#    ⚠️ 0001~0015 파일은 보존 (히스토리), 0016이 새 시작점.
#    또는: 0001~0015 아카이브 + 0016만 남기는 전략 — plan-phase 결정.
# 3. 로컬 재적용 검증
supabase db reset                       # 0016 단독으로 전 스키마 재현되는지
# 4. 타입 재생성 (CLAUDE.md §4.3 필수)
pnpm supabase:types                     # → packages/api/src/types/database.ts
# 5. linked 원격 reset (외부 사용자 0명 — D-03 승인)
#    migration repair로 히스토리 정합 후 push. Windows 동료도 로컬 reset.
```
**Source:** [CITED: supabase.com/docs — db dump baseline + migration repair + db reset]. ⚠️ **정확한 원격 reset 순서(repair vs schema_migrations 처리)는 plan-phase에서 linked 프로젝트 상태 확인 후 확정** — 외부 사용자 0명이라 데이터 위험 없음.

### RLS 헬퍼 이전 (squash, Pitfall 3)
```sql
-- 새 0016 baseline 안에서 — board→trip rename, 직접 EXISTS 절대 금지.
create or replace function am_trip_owner(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from trips where id = p_trip_id and owner_id = auth.uid());
$$;
grant execute on function am_trip_owner(uuid) to authenticated;
-- am_trip_member / can_read_trip / can_edit_trip / can_vote_trip 동일 패턴 이전.
-- 정책: using (visibility in ('shared','public') and am_trip_member(id))  ← 헬퍼 경유.
```
**이전 필수 목록 (squash 검수 체크리스트):** `set_updated_at`, `handle_new_auth_user`(트리거), `ensure_share_slug`(트리거 ×2), `am_*`/`can_*` 헬퍼 5개, `links_default_added_by`/`places_default_added_by`/`votes_default_user_id`(트리거), `join_shared_board`, `accepted_member_count`, `vote_counts_for_places`, `public_trip_view`(0013 최신 body), `add_manual_place`. PostGIS `geog` generated 컬럼 + GIST 인덱스. [VERIFIED: 0001+0002+0009+0013 직접 확인]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `boards` 전역 5탭 IA | `trips` 스코프 4탭 (`trip/[id]/(tabs)`) | Phase 17 (now) | 진입·헤더·share 모두 재배선 |
| append-only 마이그레이션 | 일회성 squash (0001~0015 → 0016 baseline) | Phase 17만 예외 (D-03) | 이후 다시 append-only |
| 가운데 ＋ FAB (새 보드) | FAB 제거, 새 여행=헤더/온보딩 액션 | Phase 17 (PRODUCT §11) | `(tabs)/_layout` NewBoardFab 삭제 |
| 베어 affiliate 링크 (SubID 없음) | `buildAffiliateUrl` + opaque 토큰 (Day1) | Phase 17 계약 (Pitfall 1) | 초기 전환 어트리뷰션 보존 |

**Deprecated/outdated:**
- `apps/ios/app/(tabs)/{boards,discover,friends,new}.tsx` + `boards/[id].tsx` — trip 라우트로 이전/삭제 (D-13).
- `apps/web/app/b/[slug]/` — `/t/[slug]/`로 이동 (D-14). `apps/web/app/boards/[id]`(dev tool)는 별도 — plan-phase 판단.
- `SharedDefaultsKeys.LastBoardId` / 앱 last_board_id — `TripKeys.LastTripId`로 대체 (데이터 전소실로 마이그레이션 불요).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SDK 56 expo-router의 nested `(tabs)` + `useGlobalSearchParams` in layout 동작이 SDK 54/55 문서와 동일 | Pattern 2/3 | LOW — 패턴 안정적. 단 Stack composition API(55+) 동작은 plan-phase 실측 권장 |
| A2 | Stay22 `campaign` 파라미터가 base62 토큰을 길이/charset 제약 없이 수용 | Standard Stack, Pitfall 5 | LOW — 공식문서 "no limit on campaign IDs", 영숫자 예시. base62는 안전 영역. Phase 20 실 전환으로 최종 검증 |
| A3 | linked 원격 DB를 squash 베이스라인으로 reset 가능 (외부 사용자 0 전제) | Code Examples (squash) | LOW — D-03 데이터 전소실 승인. 정확한 repair 순서만 plan-phase 실측 |
| A4 | `me.tsx`(내 정보)를 trip 밖 전역 스택 스크린으로 유지 가능 | Project Structure | LOW — 헤더 프로필이 `router.push('/me')`. 위치는 plan-phase 판단 |
| A5 | base62 인코딩이 `_`/`-` 없이 양 provider charset 교집합 안 | Pitfall 5, Code Examples | LOW — base62=`[0-9A-Za-z]`, 양 provider 모두 영숫자 허용 |

**확정(verified, 가정 아님):** Travelpayouts SubID 128자/`[A-Za-z0-9_-]`/`marker=ID.subID` · Stay22 `aid`+`campaign` 구조 · 코드베이스 RLS 헬퍼 인벤토리 · 현 패키지 버전 · BoardSchema가 이미 trip 모양.

## Open Questions

> **STATUS (plan-phase, 2026-06-21): ALL RESOLVED.** Q1-Q3 resolved by Plan 03 (0016 squash);
> Q4 resolved by Plan 04 (me relocated, friends/discover deleted with the (tabs) tree).

1. **0001~0015 파일 처리: 아카이브 vs 삭제 vs 보존** — **RESOLVED (Plan 03 Task 2).**
   - What we know: squash는 0016 단일 baseline 생성 (D-03). 로컬/원격 reset.
   - Resolution: Plan 03 Task 2가 `supabase db reset` 동작 확인 후 옛 파일을 `supabase/migrations/_archive/`로 이동(히스토리 보존, 활성 셋에서 제외) — reset이 contiguous history를 요구해 깨지면 그대로 두고 0016을 새 baseline으로 선언하는 fallback을 SUMMARY에 기록. 외부 사용자 0이라 어느 쪽도 안전.

2. **`booking_clicks` 빈 테이블을 0016에 포함할지 (D-07)** — **RESOLVED (Plan 03 Task 1).**
   - What we know: 민팅은 Phase 20. squash라 지금 넣으면 깔끔.
   - Resolution: Plan 03 Task 1 step 2가 **빈 테이블 + deny-by-default RLS(owner-read만)를 0016에 포함**. FK는 `trip_id`/`place_id?`/`user_id`(votes 모양). Phase 20이 INSERT 경로/redirect EF 추가.

3. **`representative_id` 자동 set: 트리거 vs 클라이언트** — **RESOLVED (Plan 03 Task 1 step 4 + Plan 01).**
   - What we know: 생성자 자동 대표 (D-10).
   - Resolution: 트리거(`trips_default_representative`, `coalesce(new.representative_id, auth.uid())`)로 결정 — `*_default_added_by` 패턴과 일관 + 클라 누락 방지. 클라는 representative 필드를 보내지 않음(Plan 05 Task 2). [VERIFIED: links_default_added_by 패턴]

4. **`me`/`friends`/`discover` 전역 탭의 운명** — **RESOLVED (Plan 04 Task 2 + Task 3).**
   - What we know: 4탭은 trip 스코프. me는 헤더 프로필로 접근.
   - Resolution: **`me` → `apps/ios/app/me.tsx` 글로벌 trip-out 스크린으로 relocate** (Plan 04 Task 2; 헤더 프로필 글리프가 `/me`로 라우팅). **`friends`/`discover`는 `(tabs)` 트리와 함께 삭제** (Plan 04 Task 3) — 둘 다 CONTEXT상 **Deferred 기능**(discover=v2/다시장, friends/멤버초대=Phase 19)이라 Phase 17에 들어갈 화면이 없음. me 하위로 옮기지 않고 각자 소유 phase에서 재도입. 클린 브레이크(D-13)와 일관.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | squash/reset/types | ✓ (스크립트 존재) | — (글로벌) | — |
| Docker (local Supabase) | `supabase db reset` 로컬 | 가정 ✓ (기존 워크플로우) | — | plan-phase 확인 |
| linked Supabase 프로젝트 | 원격 reset | ✓ (config.toml linked) | — | — |
| Expo SDK 56 + dev build | iOS 라우트 검증 | ✓ | 56.0.12 | `pnpm sim` (expo run:ios는 Xcode26서 깨짐 — CLAUDE.md) |
| pnpm | 워크스페이스 빌드/타입 | ✓ | — | — |

**Missing dependencies with no fallback:** 없음 (전부 기존 워크플로우).
**Missing dependencies with fallback:** iOS 실기기 검증은 `pnpm sim` 또는 EAS (로컬 `expo run:ios`는 Xcode26 깨짐 — CLAUDE.md 명시).

## Validation Architecture

> nyquist_validation = true (config.json). 포함.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (core) | **Vitest** ([VERIFIED: category.test.ts `import from 'vitest'`]) |
| Framework (iOS) | **Jest** (`jest-expo` ~56.0.5) — `jest.config.js` 존재. ⚠️ 이 환경 `--watchman=false` 필요 (Phase 16 노트) |
| Framework (web) | Vitest (`apps/web/vitest.config.ts`) |
| core test 스크립트 | ⚠️ `package.json`은 `"test": "echo no tests"` 인데 `category.test.ts`는 vitest로 실행됨 → **Wave 0: core test 스크립트를 vitest로 배선** |
| Quick run (core) | `pnpm --filter @moajoa/core test` (스크립트 수정 후) |
| Quick run (iOS) | `pnpm --filter @moajoa/ios test -- --watchman=false` |
| Full suite | `pnpm -r --parallel run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTR-01 | `buildAffiliateUrl`가 항상 subId를 URL에 포함, provider별 올바른 키 | unit | `pnpm --filter @moajoa/core test booking` | ❌ Wave 0 (`booking.test.ts`) |
| ATTR-01 | ClickToken base62 외 입력 거부 (Zod) | unit | (동일) | ❌ Wave 0 |
| SETUP-01 | `TripCreateSchema` end<start 거부, 날짜 필수 | unit | `pnpm --filter @moajoa/core test trip` | ❌ Wave 0 (`trip.test.ts`) |
| NAV-01 | `decideEntryRoute` 0/1/N + "마지막 삭제됨" 엣지 | unit | `pnpm --filter @moajoa/ios test -- --watchman=false` | ❌ Wave 0 (`entry-route.test.ts`) |
| NAV-02 | 4탭 + 탭바 항상 보임 | manual (디바이스) | `pnpm sim` 수동 | manual-only (라우트 머신 런타임) |
| NAV-03 | 헤더 전환/프로필 접근 | manual (디바이스) | `pnpm sim` 수동 | manual-only |
| NAV-04 | 옛 `boards/` 라우트 제거, share→trip | unit (share-routing) + manual | `pnpm --filter @moajoa/ios test` | 부분 (share 라우팅 단위 가능) |
| SETUP-02 | trips.representative_id = 생성자 | integration (DB) | squash 적용 후 SQL 검증 | manual-only (DB) |
| D-03 | squash baseline이 0016 단독으로 전 스키마 재현 | integration | `supabase db reset` 성공 + `supabase:types` clean | manual-only |

### Sampling Rate
- **Per task commit:** 해당 패키지 quick run (core: vitest / iOS: jest --watchman=false)
- **Per wave merge:** `pnpm -r --parallel run test` + `pnpm typecheck`
- **Phase gate:** 풀스위트 green + `supabase db reset` 성공 + `supabase:types` diff clean + 디바이스 UAT(4탭/헤더/진입분기/share) 전 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] core `package.json` `test` 스크립트를 `vitest run`으로 배선 (현재 echo stub)
- [ ] `packages/core/src/booking.test.ts` — ATTR-01 (buildAffiliateUrl + ClickToken)
- [ ] `packages/core/src/schemas/trip.test.ts` — SETUP-01 (TripCreateSchema)
- [ ] `apps/ios/lib/entry-route.test.ts` (또는 core) — NAV-01 (decideEntryRoute 0/1/N + 엣지)
- [ ] iOS jest는 `jest-expo` 설치됨 — 신규 config 불요, `--watchman=false` 주의

## Security Domain

> security_enforcement absent = enabled. 포함.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 기존 Supabase auth 불변 (이 phase 변경 없음) |
| V3 Session Management | no | 변경 없음 |
| V4 Access Control | **yes** | RLS deny-by-default + SECURITY DEFINER 헬퍼 (squash 시 이전 필수). anon은 `public_trip_view` RPC만 |
| V5 Input Validation | **yes** | zod — `TripCreateSchema`(날짜·도시), `ClickTokenSchema`(base62 regex), `BookingClickContextSchema`(UUID) |
| V6 Cryptography | no (이 phase) | share_slug = 기존 `gen_random_bytes` (~60bit). 토큰 민팅=Phase 20 |

### Known Threat Patterns for {Supabase RLS + affiliate SubID + Expo Router}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RLS 직접 cross-table EXISTS → 42P17 / 우회 | Elevation / DoS | SECURITY DEFINER 헬퍼 경유 (CLAUDE.md §4.4, 0002 패턴) |
| SubID에 PII 인코딩 → 제3자 노출 | Information Disclosure | opaque base62 토큰만, tripId/userId 평문 금지 (Security Mistakes) |
| 토큰 charset에 URL 위험문자 → 어트리뷰션 깨짐 | Tampering | base62 regex Zod 가드, `.`/`/`/`=` 금지 |
| service role 키 클라 노출 | Elevation | EF 내부만 service role, 클라 anon (CLAUDE.md §4.4) — Phase 17은 클라 코드만, 민팅 EF=Phase 20 |
| share_slug bearer-invite 과노출 | Information Disclosure | ~60bit 엔트로피 + `join_shared_board` SECURITY DEFINER (검증됨, 이전) |
| 도시/날짜 미검증 입력 | Tampering | `TripCreateSchema` Zod + DB CHECK (city_code 길이, 날짜 range) |

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/expo_dev` — nested tabs (`(tabs)` 그룹 + `Tabs.Screen`), 동적 라우트 in tabs, `Stack.Screen options` 동적 설정, `useGlobalSearchParams`/`useLocalSearchParams`. docs.expo.dev/router/advanced/{tabs,stack}, /router/basics/common-navigation-patterns
- 코드베이스 직접 read (2026-06-21): `0001_init.sql`, `0002_fix_rls_recursion.sql`, `0009_join_shared_board.sql`, `0013_public_view_place_detail.sql`, `board.ts`, `constants.ts`, `index.tsx`, `(tabs)/_layout.tsx`, `share-handler.tsx`, `+native-intent.tsx`, `_layout.tsx`, `package.json`×3, `category.test.ts` — RLS 헬퍼/트리거/RPC 인벤토리, 패키지 버전, 테스트 프레임워크
- [Travelpayouts — ID and SubID](https://support.travelpayouts.com/hc/en-us/articles/203955653-ID-and-SubID-Affiliate-marker-and-additional-marker) — SubID 최대 128자, `[A-Za-z0-9_-]`, `marker=ID.subID`, `?sub_id=` 동적
- [Supabase CLI — Database Migrations / db reset / migration repair](https://supabase.com/docs/guides/deployment/database-migrations) — squash, `db dump` baseline, repair 순서

### Secondary (MEDIUM confidence)
- [Stay22 — Allez Deep Links 가이드](https://community.stay22.com/allez-deep-links-everything-you-need-to-know) — `aid`+`campaign` 구조, campaign 제약 없음, claimed domain
- [Stay22 — Affiliate Tracking 분석](https://blog.stay22.com/breaking-down-stay22-analytics-for-affiliate-tracking) — campaign ID, 24h Booking 쿠키, 도메인 claim (milestone PITFALLS.md 인용)
- 밀스톤 리서치 `.planning/research/{SUMMARY,PITFALLS,STACK}.md` — Pitfall 1/7/9, Phase A 정의

### Tertiary (LOW confidence — plan-phase 실측 권장)
- SDK 56 expo-router 구체 동작 (Context7 인덱스는 54/55) — Stack composition API SDK 56 검증
- linked DB squash repair 정확 순서 — linked 프로젝트 상태 확인 후

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 전부 기존 의존성, 버전 직접 확인
- Architecture (Expo Router nested tabs): HIGH — Context7 official 패턴 직접 인용 (SDK 56 미세동작만 MEDIUM)
- Schema squash + RLS 이전: HIGH — 코드베이스 인벤토리 직접 확인 + Supabase official docs (원격 repair 순서만 MEDIUM)
- 제휴 SubID 포맷: HIGH (Travelpayouts) / MEDIUM (Stay22 campaign 제약 미명시 — base62 안전영역이라 LOW 리스크)
- Pitfalls: HIGH — milestone PITFALLS.md(Pitfall 1/7/9) + 코드 RLS 42P17 패턴 직접 확인

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (안정 도메인 30일. expo-router SDK 56 정식문서 인덱싱 시 A1 재확인)
