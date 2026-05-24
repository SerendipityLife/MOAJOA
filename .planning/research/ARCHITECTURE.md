# Architecture Research

**Domain:** Link-to-Map travel app (Expo iOS 저장 · Next.js Web 공개 열람 · Supabase 백엔드)
**Researched:** 2026-05-25
**Confidence:** HIGH (high-level shape는 이미 docs/ARCHITECTURE.md에 결정됨. 본 문서는 **v1 MVP 완성을 위한 통합 아키텍처** 6개 영역에 한정)

---

## 0. Scope 명시

본 문서는 docs/ARCHITECTURE.md의 high-level data flow (링크→Edge→places)를 **재연구하지 않는다**. 대신 v1 MVP를 self-dogfooding 수준까지 끌어올리기 위해 **현재 미해결인 통합 아키텍처 6개 영역**을 정의한다. 각 영역에 대해:

1. 컴포넌트 경계 (무엇이 무엇과 통신하는가)
2. 데이터 흐름 방향
3. Build order implication (무엇이 무엇을 unblock하는가)

순으로 다룬다.

---

## 1. iOS 빌드 unblocking — pnpm hoisting 전략

### 현재 상태

- 루트 `.npmrc`: `shamefully-hoist=false`, `public-hoist-pattern[]=` (비움), `auto-install-peers=true`
- 의도된 이유: `apps/ios`가 RN 0.74 시절 `@types/react@18`을 썼고 `apps/web`은 `@types/react@19`이라서 hoist 시 충돌
- 실제 현 상태: `apps/ios/package.json`을 보면 **`@types/react: ~19.1.17`**, **`react: 19.1.0`**, **`react-native: 0.81.5`**, **`expo: ~54.0.34`** — React 19 통일 완료. **`.npmrc`의 주석 이유는 stale**

### 2026년 권장 패턴 (Expo SDK 54 기준)

Expo SDK 54부터 **isolated 의존성**을 공식 지원. SDK 54 미만에서 필요했던 `nodeLinker=hoisted` 강제는 더이상 default 권장이 아님. 다만:

> "Not all packages you install will work and some React Native libraries may cause build or resolution errors when used with isolated dependencies. If you encounter issues, switch to hoisted." — Expo 공식 monorepo 가이드

→ **isolated를 우선 시도, podspec 경로 에러 발생 시 `apps/ios`에 한정해서 hoisted로 fallback** 하는 게 최소 침습.

### 권장 컴포넌트 경계

```
┌─────────────────────────────────────────────────────────────┐
│ Root: pnpm-workspace.yaml                                    │
│  - packages: apps/*, packages/*                              │
│  - (선택) nodeLinker: hoisted ← 전역 강제 (가장 단순, 그러나  │
│                                  web/ios 타입 충돌 재발 위험) │
└─────────────────────────────────────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
│ apps/ios    │      │ apps/web    │      │ packages/*  │
│ .npmrc      │      │ (root 따름) │      │ (root 따름) │
│ node-linker │      │             │      │             │
│  =hoisted   │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
       │
       │ Metro config에 watchFolders로
       │ 모노레포 root 추가 필수
       ▼
┌─────────────────┐
│ Pods (Cocoa)    │
│ podspec resolve │
│ → ios/Pods/...  │
└─────────────────┘
```

### 의사결정 트리

1. **1차 시도:** 현재 `.npmrc` 유지 + `pnpm install` 후 `cd apps/ios && pnpm prebuild --clean && pnpm pod-install`
   - 성공 → 끝. 굳이 hoist 안 함
2. **2차 (실패 시):** `apps/ios/.npmrc`에 `node-linker=hoisted` (apps/ios 디렉토리 한정)
   - 이게 [Callstack 가이드](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces)와 [Zn4rK gist](https://gist.github.com/Zn4rK/ed60c380e7b672e3089074f51792a2b8)가 권장하는 패턴
3. **3차 (그래도 실패):** 루트에 `shamefully-hoist=true` (전역) — `.npmrc` 주석을 업데이트하고 web 타입 회귀 테스트
4. **4차 (마지막):** EAS Build (클라우드) — 로컬 toolchain 우회. WORKSTREAMS.md의 옵션 B

**핵심 원칙:** Expo SDK 54 autolinking 개선으로 transitive 의존성도 잡힘. **`metro.config.js`의 `watchFolders` + `disableHierarchicalLookup`**이 podspec resolve보다 더 흔한 실제 원인이므로 그쪽도 함께 확인.

### Build order implication

**P0 블로커.** 이게 안 풀리면 Share Extension·Realtime 구독·지도 핀 클릭 등 *iOS-only* 기능을 어떤 것도 검증할 수 없다. 다른 5개 영역 전에 (또는 최소한 병렬로) 해결되어야 함.

---

## 2. Share Extension boundary — expo-share-intent ↔ 메인 앱

### 핵심 제약

iOS Share Extension은 **별도 프로세스**. 메인 앱이 닫혀있어도 동작하지만:

- **Background Task는 앱이 사용자에 의해 kill되면 안 돌아감** (Expo 공식 BackgroundTask 문서 명시)
- Share Extension의 lifetime은 매우 짧음 (수 초). 네트워크 호출 보장 X
- iOS는 App Group을 통해서만 Extension ↔ App 간 파일/UserDefaults 공유 가능

### 권장 아키텍처: "Defer Network, Persist Locally"

```
┌──────────────────────────────────────────────────────────────┐
│ Share Sheet (카톡/사파리)                                     │
│   └─ User taps "MOAJOA"                                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Share Extension (별도 프로세스, lifetime ~3s)                 │
│   1. expo-share-intent로 URL 수신                              │
│   2. (옵션 A) 즉시 Supabase insert 시도 (네트워크 OK일 때만)   │
│      (옵션 B) App Group의 SharedDefaults에 URL을 enqueue       │
│   3. UI: "보드 선택" 모달 또는 default 보드에 자동 저장        │
│   4. Extension close                                          │
└──────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │ (옵션 A: 즉시)                │ (옵션 B: defer)
            ▼                               ▼
┌────────────────────────┐    ┌────────────────────────────────┐
│ Supabase links INSERT  │    │ AppGroup SharedDefaults        │
│ + Edge Function invoke │    │ pendingLinks: [url1, url2,...] │
└────────────────────────┘    └────────────────┬───────────────┘
                                               │
                                               │ 메인 앱 다음 launch 시
                                               ▼
                              ┌────────────────────────────────┐
                              │ Main App (_layout.tsx)         │
                              │  - Drain pendingLinks queue    │
                              │  - INSERT links rows           │
                              │  - Trigger Edge Function       │
                              └────────────────────────────────┘
```

### 권장: 옵션 A를 1차 시도, 실패 시 B로 fallback

이유:
- 옵션 A의 supabase-js insert는 단순 HTTPS 호출. Extension lifetime 안에 1초 내 끝남
- Edge Function invoke는 **fire-and-forget** — 응답 기다리지 말고 그냥 invoke만. 추출은 백그라운드에서 진행, 결과는 Realtime으로
- 사용자가 오프라인일 때만 옵션 B로 자동 fallback (URL을 SharedDefaults에 enqueue)

### 보드 선택 UX

세 가지 패턴 중 v1은 **"마지막 사용 보드 + 1탭으로 다른 보드 선택"** 권장:

| 패턴 | UX | 구현 난이도 |
|---|---|---|
| 매번 보드 선택 모달 | 명확하지만 friction 큼 | 중 |
| **마지막 보드 default + 변경 옵션** | 80% 자동, 20% 선택 | 중 (recommended) |
| 항상 "Inbox" 보드로 → 나중에 메인앱에서 이동 | 가장 빠른 저장 | 저 (alternative) |

`expo-router/native-intent` (`+native-intent.ts` 파일)로 incoming URL을 특정 라우트로 redirect 가능 — Share Extension UI로 `/share` 라우트를 띄우는 식.

### Build order implication

iOS 빌드 unblock (#1) → 메인 앱 핵심 동작 (login → boards → detail) → **그 다음에** Share Extension 추가. Share Extension은 별도 native 빌드를 강제하므로, 메인 앱 빌드가 안정화된 후에 시작. **Phase 1.5의 핵심 입력 경로** (PROJECT.md Active 명시).

---

## 3. 공개 보드 SSR architecture — Next.js 15 + RPC + 캐싱

### 현재 코드 분석

`apps/web/app/b/[slug]/page.tsx`는 이미:
- `async` Server Component
- `getPublicBoardBySlug(supabase, slug)`로 SECURITY DEFINER RPC 호출
- `generateMetadata`에서도 같은 RPC 호출 (2회 호출 — Next.js의 자동 dedup으로 1회로 합쳐짐)
- 익명 SSR (Server Cookies가 없어도 동작 — RPC가 SECURITY DEFINER이므로)

### 누락된 것

- **명시적 캐싱 전략 없음** — 현재 매 요청마다 Supabase RPC 호출 (TTFB 800ms 예산 위험)
- **Realtime invalidation 없음** — 새 place 추가돼도 SSR 캐시가 stale 채로 남음
- **OG 이미지 동적 생성 없음** — `view.board.cover_image_url`만 사용 (대부분의 보드는 없음)

### 권장 캐싱 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│ 사용자: 카톡에서 /b/abc123 클릭                                │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Vercel Edge Network                                          │
│   ├─ Cache HIT (cache tag: board:abc123) → 즉시 반환 (~50ms) │
│   └─ Cache MISS → 아래로                                      │
└──────────────────────────────────────────────────────────────┘
                            │ MISS
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js 15 Server Component (Edge runtime)                   │
│   const view = await fetch(supabaseRpcUrl, {                 │
│     next: { tags: [`board:${slug}`], revalidate: 3600 }      │
│   })                                                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase RPC: public_board_view(slug)                        │
│   SECURITY DEFINER · visibility='public'만 노출               │
└──────────────────────────────────────────────────────────────┘

         ─── invalidation 경로 (별개 flow) ───

┌──────────────────────────────────────────────────────────────┐
│ Edge Function: extract-youtube 완료                          │
│   ├─ places UPSERT 끝나면                                     │
│   └─ POST https://moajoa.app/api/revalidate?slug=abc123      │
│      Header: x-revalidate-secret: <env>                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js Route Handler: /api/revalidate                       │
│   revalidateTag(`board:${slug}`)                             │
│   → 다음 요청부터 cache MISS, 신선한 데이터                    │
└──────────────────────────────────────────────────────────────┘
```

### 구현 키 포인트

1. **`fetch`로 RPC 호출** (supabase-js client 대신, 또는 wrapper 안에서):
   - Next.js 15의 `next: { tags, revalidate }` 옵션은 `fetch`에만 적용됨
   - supabase-js는 내부 fetch를 그대로 노출하지 않으므로, `getPublicBoardBySlug`를 fetch 기반으로 재작성하거나 [supabase-cache-helpers](https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers) 사용 고려
2. **Revalidation secret** — Edge Function이 호출할 webhook을 secret으로 보호
3. **`revalidate: 3600`은 fallback** — 정상 흐름은 webhook이 즉시 invalidate. webhook 실패 시 1시간 후 자동 갱신
4. **익명 클라이언트 키** — `getSupabaseServer`가 anon key로 RPC 호출. RLS는 RPC 내부에서 SECURITY DEFINER로 enforce

### OG 이미지 분리

`/b/[slug]/opengraph-image.tsx`에 별도 라우트로 분리:

```
app/b/[slug]/
  ├─ page.tsx                 (SSR 보드 페이지)
  └─ opengraph-image.tsx      (동적 OG, @vercel/og)
```

- `runtime = 'edge'`
- 동일 RPC 호출 (자동 dedup) → 보드 제목 + 첫 핀 위치 → JSX → PNG
- Vercel이 자동으로 `cache-control: public, immutable, max-age=31536000` 추가
- 사이즈 < 500KB 제약 (Satori는 flexbox만, no grid)

### Build order implication

캐싱 + invalidation은 **OG 이미지·SEO 폴리시·반응형**(WORKSTREAMS Web §1) 작업과 함께 처리. 추출 파이프라인의 progress event(#4)가 먼저 정의되면 webhook 트리거 구조를 같이 설계할 수 있음.

---

## 4. 추출 파이프라인 observability — "extracting... 3 places found"

### 현재 상태

`supabase/functions/extract-youtube/index.ts`는 **synchronous** 응답만:
- 클라이언트가 `supabase.functions.invoke('extract-youtube', { link_id })` 호출
- Edge Function이 끝까지 다 돌고 (최대 30초) 결과 반환
- 그 사이 클라이언트는 spinner만 표시

### 문제

- p90 30초 = 사용자가 손 놓고 기다림. UX 나쁨
- 중간 단계 (transcript 받음 / Claude 호출 / Places 3개 resolve) 가시화 X
- iOS Share Extension은 lifetime ~3s — synchronous 응답 못 기다림. fire-and-forget 필수

### 권장: Supabase Realtime Broadcast 채널

DB write 기반 (Postgres CDC)이 아니라 **Broadcast** (transient pub/sub) 사용.

> "Use cases include notifications, telemetry, **progress events**, ... and other transient signals that do not need to be stored durably in the database." — Supabase Realtime Broadcast 공식

```
┌──────────────────────────────────────────────────────────────┐
│ Client (iOS or Web)                                          │
│   const ch = supabase.channel(`extract:${link_id}`)          │
│   ch.on('broadcast', { event: 'progress' }, (msg) => {       │
│     setStatus(msg.payload)  // "Claude 호출 중..."             │
│   })                                                          │
│   ch.subscribe()                                              │
│   supabase.functions.invoke('extract-youtube', { link_id })  │
│     ↑ fire-and-forget                                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Edge Function: extract-youtube                               │
│   const ch = admin.channel(`extract:${link_id}`)             │
│   await ch.subscribe()                                        │
│                                                               │
│   await ch.send({ event:'progress',                          │
│                   payload:{ stage:'metadata', pct:10 }})     │
│   ... metadata fetch ...                                      │
│                                                               │
│   await ch.send({ event:'progress',                          │
│                   payload:{ stage:'transcript', pct:30 }})   │
│   ... transcript ...                                          │
│                                                               │
│   await ch.send({ event:'progress',                          │
│                   payload:{ stage:'llm', pct:50,             │
│                             message:'장소 후보 추출 중'}})    │
│   ... claude ...                                              │
│                                                               │
│   await ch.send({ event:'progress',                          │
│                   payload:{ stage:'places', pct:70,          │
│                             found: candidates.length }})     │
│   ... places resolve ...                                      │
│                                                               │
│   await ch.send({ event:'done',                              │
│                   payload:{ places_extracted:N }})           │
│                                                               │
│   // DB write — Realtime via Postgres CDC for places         │
│   await admin.from('places').upsert(rows)                    │
└──────────────────────────────────────────────────────────────┘
```

### 채널 설계

| 채널 이름 | 용도 | 누가 publish | 누가 subscribe |
|---|---|---|---|
| `extract:{link_id}` | 단일 링크 진행 상황 | Edge Function | 그 링크를 추가한 클라이언트 |
| `board:{board_id}:places` (Postgres CDC) | 새 place insert 알림 | DB (auto) | 그 보드를 보고 있는 모든 클라이언트 (Web SSR include) |

두 채널을 분리하는 이유:
- Broadcast = 진행 메시지 (저장 안 됨, 채널 dispose 후 fly away)
- Postgres CDC = 영속 데이터 (places 테이블 변경, web에서 도 알림 받음)

### Web의 invalidation 연결

`board:{board_id}:places` 채널에 subscribe하는 **server-side worker는 두지 말 것**. 대신:

- Edge Function이 `extract-youtube` 끝낼 때 **마지막 단계**로 Next.js `/api/revalidate?slug=...` 호출 (#3 참고)
- 또는 Supabase DB webhook (places insert → HTTP POST to Vercel)

### Build order implication

extract-youtube refactor는 backend track (WORKSTREAMS §3) — iOS·Web과 독립. **iOS 빌드 unblock(#1)과 병렬 진행 가능.** iOS에서 progress UI를 보기 전에 web의 dev tool form으로도 검증 가능 (현재 `apps/web/app/boards/[id]/page.tsx`에 add-link-form 존재).

---

## 5. Cost monitoring architecture — per-video 비용 추적

### 현재 상태

Anthropic 호출 (claude.ts) + Google Places 호출 (places.ts) — **로깅 없음**. Console.error만 있고 영속 저장 X.

### 권장: `extraction_costs` 테이블 (단일 진실)

```
┌──────────────────────────────────────────────────────────────┐
│ Edge Function: extract-youtube                               │
│                                                               │
│  ─ Claude call ─                                             │
│  const start = Date.now()                                    │
│  const resp = await fetch('https://api.anthropic.com/...')   │
│  costs.push({                                                 │
│    link_id, provider:'anthropic',                            │
│    model:'claude-sonnet-4-6',                                │
│    input_tokens: resp.usage.input_tokens,                    │
│    output_tokens: resp.usage.output_tokens,                  │
│    cost_usd: calcCost(usage),                                │
│    duration_ms: Date.now() - start                           │
│  })                                                           │
│                                                               │
│  ─ Places call (per candidate) ─                             │
│  costs.push({                                                 │
│    link_id, provider:'google_places',                        │
│    operation:'text_search',                                  │
│    fields_mask: 'id,displayName,location',                   │
│    cost_usd: 0.005, // FieldMask 기준                        │
│    duration_ms: ...                                          │
│  })                                                           │
│                                                               │
│  ─ 끝나기 직전: bulk insert ─                                 │
│  await admin.from('extraction_costs').insert(costs)          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Postgres: extraction_costs                                   │
│   id uuid PK                                                  │
│   link_id uuid FK → links                                    │
│   provider text  ('anthropic' | 'google_places')             │
│   operation text (provider-specific)                         │
│   model text                                                  │
│   input_tokens int, output_tokens int                        │
│   cost_usd numeric(10,6)                                     │
│   duration_ms int                                            │
│   created_at timestamptz default now()                       │
│                                                               │
│ RLS: SELECT for service_role only (no client access)         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Query (Supabase Studio 또는 별도 admin route):                │
│   select link_id, sum(cost_usd) as cost                      │
│   from extraction_costs                                      │
│   group by link_id                                           │
│   order by cost desc;                                        │
│                                                               │
│   → "영상당 평균 $0.003, p95 $0.008" 같은 baseline           │
└──────────────────────────────────────────────────────────────┘
```

### 왜 별도 테이블인가 (links에 컬럼 추가 X)

- 한 링크 = 여러 API call (Claude 1회 + Places N회) → row 분리가 자연
- 비용 모델 변경 시 (Anthropic 가격 인하 등) raw token 기록이 있으면 재계산 가능
- links 테이블 hot path (extract status check)에 영향 안 줌

### 모니터링은 v1에서 어디까지?

PROJECT.md "Out of Scope (v1)"에 "에러 트래킹·CI는 dogfooding 단계에선 수동 확인". **비용도 마찬가지로 v1은 raw 로깅까지만**. 대시보드 UI는 Phase 2:

- v1: 테이블 + insert 로직만. 본인이 Supabase Studio에서 SQL 돌려 확인
- v1.5: 보드별 비용 합산 RPC (`board_cost_summary`)
- v2: 어드민 라우트 (`/admin/costs`) 또는 Metabase 대시보드

### Build order implication

스키마 마이그레이션 (`0004_extraction_costs.sql`)은 backend track 독립 작업. **추출 파이프라인 observability(#4)와 같이 가는 게 자연** — 둘 다 extract-youtube/index.ts 수정을 요구. 한 PR로 묶을 수 있음.

---

## 6. Image asset pipeline — OG / icon / splash / 워드마크

### 자산 종류와 컨슈머

| 자산 | 누가 사용 | 어디서 생성 | 캐싱 |
|---|---|---|---|
| App icon (1024×1024) | iOS 빌드 | 디자인 (Figma 등) → `apps/ios/assets/icon.png` | 빌드 시점 (static) |
| Splash screen | iOS 빌드 | 동일 → `apps/ios/assets/splash.png` | 빌드 시점 |
| 워드마크 SVG | Web 헤더 + iOS 시작 | `packages/ui-tokens/src/brand/wordmark.svg` | static asset |
| 보드 OG 이미지 | 카톡 미리보기, X/페북 카드 | `apps/web/app/b/[slug]/opengraph-image.tsx` (런타임) | Edge cache 1년 |
| 정적 OG 기본 | `/`, `/discover` 등 | `apps/web/public/og-default.png` | static |

### 권장 컴포넌트 경계

```
┌─────────────────────────────────────────────────────────────┐
│ packages/ui-tokens/src/brand/                               │
│   ├─ wordmark.svg          (single source of truth)         │
│   ├─ icon.svg              (single source of truth)         │
│   └─ colors.ts             (이미 존재 — brand color 토큰)    │
└─────────────────────────────────────────────────────────────┘
        │                                    │
        │ import as React component          │ SVG → PNG export script
        │                                    │ (개발자가 1회 실행)
        ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────────┐
│ apps/web            │          │ apps/ios/assets/        │
│  - 헤더 워드마크     │          │  ├─ icon.png (1024²)    │
│  - 메타 favicon     │          │  ├─ icon-foreground.png │
│  - OG default       │          │  ├─ splash.png          │
└─────────────────────┘          │  └─ adaptive-icon.png   │
                                 └─────────────────────────┘
        │
        │ runtime
        ▼
┌─────────────────────────────────────────────────────────────┐
│ apps/web/app/b/[slug]/opengraph-image.tsx                   │
│   runtime = 'edge'                                          │
│   import { ImageResponse } from 'next/og'                   │
│   import { getPublicBoardBySlug } from '@moajoa/api'        │
│                                                              │
│   export default async function OG({ params }) {            │
│     const view = await getPublicBoardBySlug(slug)           │
│     return new ImageResponse(                               │
│       (<div style={{ display:'flex', ...}}>                 │
│          <Wordmark />                                        │
│          <h1>{view.board.title}</h1>                         │
│          <FirstPinSnippet places={view.places} />            │
│        </div>),                                              │
│       { width: 1200, height: 630 }                          │
│     )                                                        │
│   }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 핵심 결정

1. **단일 진실 = `packages/ui-tokens/src/brand/`** — SVG를 source로 두고, iOS PNG는 export script로 생성. design tokens 변경 시 한 곳만 수정
2. **OG 이미지는 런타임 생성 (build-time X)** — 보드는 동적이므로 build-time 불가. `@vercel/og`가 Edge에서 즉시 생성 + Vercel이 자동 캐싱
3. **iOS adaptive icon 분리** — Android 미래 대응까지 고려하면 foreground/background 분리. v1은 iOS only지만 export script에서 같이 뽑아두면 미래 비용 ↓
4. **워드마크는 SVG 그대로** — Web은 `<svg>` inline, iOS는 `react-native-svg`로 import. 같은 파일 공유

### Build order implication

**디자인 트랙 (WORKSTREAMS §4)의 P0**:
- App icon + splash가 **없으면 iOS 빌드가 Expo default 아이콘으로 빌드됨** (검증은 가능하나 dogfooding 시 거슬림)
- OG 이미지는 **공유 링크 acquisition의 핵심** (PROJECT.md Core Value) — Web 폴리시(#3)와 짝
- 워드마크는 **헤더·시작 화면**에 필요 — UI 첫인상

순서: icon/splash (iOS 빌드 unblock과 병렬) → 워드마크 (UI 셸 작업 중에) → OG 이미지 (Web SSR 폴리시 중에)

---

## 6개 영역 의존성 매트릭스

```
                  #1 iOS  #2 Share  #3 SSR  #4 Obs  #5 Cost  #6 Asset
#1 iOS 빌드        ─       BLOCKS    -       -       -        partial
#2 Share Ext       req     ─         -       depends -        -
#3 SSR 캐싱        -       -         ─       depends -        depends
#4 Observability   -       enables   enables ─       pairs    -
#5 Cost monitor    -       -         -       pairs   ─        -
#6 Asset pipeline  needs   -         needs   -       -        ─
   (icon for ios)          (OG for web)
```

**읽는 법:**
- "BLOCKS" — A가 B 시작 전에 끝나야 함
- "depends" — A의 산출이 B를 더 풍부하게 함 (없어도 진행 가능)
- "pairs" — 같은 파일/PR로 묶는 게 자연
- "enables" — A가 끝나야 B의 실제 UX가 의미 있어짐 (개발은 병렬 가능)

---

## 권장 Build Order (Phase 매핑 제안)

### Phase A: Unblock (직렬)
1. **iOS 빌드 통과 (#1)** — 다른 모든 iOS 작업의 prerequisite
2. **App icon + splash (#6 일부)** — #1과 같은 PR에 포함 가능 (Expo prebuild 시 적용)

### Phase B: 핵심 동작 검증 (병렬 가능)
3. iOS: login → boards → detail → 링크 추가 검증 (코드 이미 있음, 검증만)
4. Backend: 추출 observability (#4) + cost monitoring (#5) — 같은 PR
5. Web: SSR 캐싱 + revalidation hook (#3 일부)

### Phase C: Acquisition 폴리시 (병렬)
6. Web: OG 이미지 (#6+#3) + SEO meta + 모바일 반응형
7. iOS: Share Extension (#2) — Phase B 검증 후

### Phase D: 정리
8. Web: dev tool form 제거 또는 env flag 격리
9. 첫 보드 자동 생성 온보딩 (Auth track)
10. 추출 정확도 baseline 측정 (Eval — v2 본격화 전 baseline)

---

## Sources

- [Expo Monorepos 공식 가이드](https://docs.expo.dev/guides/monorepos/) — SDK 54의 isolated 의존성 지원, hoisted fallback 권장
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) — autolinking 개선, BackgroundTask Apple TV 지원
- [Callstack: RN Monorepo with pnpm](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces) — apps/ios 한정 hoist 패턴
- [Zn4rK gist: pnpm and expo without node-linker=hoisted](https://gist.github.com/Zn4rK/ed60c380e7b672e3089074f51792a2b8) — isolated 시도 시 워크어라운드
- [expo-share-intent (npm v6.1.0)](https://www.npmjs.com/package/expo-share-intent) — Share Sheet 핸들링
- [Expo Native Intent (`+native-intent.ts`)](https://docs.expo.dev/router/advanced/native-intent/) — Share Extension URL을 route로 라우팅
- [Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/) — "stopped if user kills the app" 제약
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) — progress events 공식 use case
- [Supabase Edge Functions broadcast (Discussion #17124)](https://github.com/orgs/supabase/discussions/17124) — Edge Function에서 channel send 패턴
- [Vercel OG Image Generation](https://vercel.com/docs/og-image-generation) — Edge runtime, 자동 캐싱
- [Next.js 15 dynamic OG with @vercel/og (buildwithmatija)](https://www.buildwithmatija.com/blog/complete-guide-dynamic-og-image-generation-for-next-js-15) — App Router 패턴
- [Next.js + Supabase Cache Helpers](https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers) — supabase-js와 fetch cache 통합
- [Enhancing Data Caching in Next.js with Supabase Webhooks](https://tylermarshall.medium.com/enhancing-data-caching-in-nextjs-14-with-supabase-webhooks-124524e4acdd) — revalidateTag webhook 패턴

**참고한 프로젝트 내부 파일:**
- `/Users/wcb/Documents/MOAJOA/.planning/PROJECT.md`
- `/Users/wcb/Documents/MOAJOA/docs/ARCHITECTURE.md`
- `/Users/wcb/Documents/MOAJOA/docs/WORKSTREAMS.md`
- `/Users/wcb/Documents/MOAJOA/supabase/functions/extract-youtube/index.ts`
- `/Users/wcb/Documents/MOAJOA/apps/web/app/b/[slug]/page.tsx`
- `/Users/wcb/Documents/MOAJOA/apps/ios/package.json` · `app.config.ts`
- `/Users/wcb/Documents/MOAJOA/.npmrc` · `pnpm-workspace.yaml`
