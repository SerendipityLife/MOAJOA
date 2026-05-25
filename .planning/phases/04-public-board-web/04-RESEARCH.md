# Phase 4: Public Board (Web) — Research

**Researched:** 2026-05-26
**Domain:** Next.js 15 App Router · Edge SSR cache · `next/og` ImageResponse · Google Static Maps · webhook revalidation
**Confidence:** HIGH (모든 핵심 API를 Next.js 15.5 공식 docs 또는 코드베이스에서 직접 verify)

---

## Summary

Phase 4의 6개 요구사항(VIEW-01~06)은 모두 Next.js 15 App Router의 stable API surface(`unstable_cache`, `revalidateTag`, `generateMetadata`, `generateViewport`, `opengraph-image.tsx` 파일 컨벤션 + `next/og` ImageResponse, `notFound`)와 기존 코드베이스 자산(`getPublicBoardBySlug`, `public_board_view` RPC, `PublicBoardMap`)으로 충분히 해결된다. CONTEXT.md D-01~D-20에서 결정 사항이 lock되어 있어 본 research는 **무엇을 쓸지가 아니라 어떻게 쓸지**에 초점이 맞춰져 있다.

3가지 비-trivial 발견:

1. **`unstable_cache`는 keyParts에 `[slug]`를 명시해야 안전하다** — 공식 docs는 "arguments + stringified function이 자동으로 cache key가 된다"고 하지만, `params`처럼 *외부 변수*를 closure로 잡으면 keyParts에 명시하라는 경고가 있다. Next.js 15 공식 예제도 `[userId]`를 keyParts로 넘긴다. D-03 lock과 일치.
2. **OG image의 권장 폰트 로딩 패턴은 `${origin}/fonts/...` self-fetch가 아니라 `readFile(join(process.cwd(), 'public/fonts/...'))`** — Next.js 15 docs 공식 예제가 Node.js `fs/promises`를 사용한다. Vercel 환경에서 `process.cwd()`는 `.next` 빌드 디렉토리가 아니라 프로젝트 루트로 보장. self-fetch는 cold start 시 자기 자신을 못 깨우는 deadlock 가능성 + redeploy 직후 race condition. UI-SPEC §"Open Items Resolved"의 self-fetch 권장은 **`readFile` 패턴으로 정정 권고**.
3. **Google Static Maps + interactive Maps JS는 동일 키 재사용이 안전하지 않다** — Google docs는 명시적으로 "서버 측 호출(Static Maps URL을 서버에서 빌드해 카카오 scraper에 노출)은 IP 제한 또는 별도 키, 브라우저 노출(`NEXT_PUBLIC_GOOGLE_MAPS_KEY`)은 HTTP referer 제한"으로 분리하라고 권장. v1 운영 부담을 고려하면 **별도 env var `GOOGLE_STATIC_MAPS_KEY` 신설 + 응용 API 제한(Static Maps API만 허용) + 무제한 origin(또는 IP allow 없음, 단 unsigned URL이라 enumeration 가능)** 또는 **기존 키 재사용 + Static Maps API enable + referer 제한 + 노출 위험 감수** 중 선택. CONTEXT.md D-19와 일관되게 v1은 후자(기존 키 재사용 + Static Maps API enable)로 시작 권장.

**Primary recommendation:** D-01~D-20을 그대로 따르되 OG image 폰트 로딩만 `readFile(join(process.cwd(), 'public/fonts/Pretendard-*.otf'))`로 정정, Static Maps 키는 v1에서 `NEXT_PUBLIC_GOOGLE_MAPS_KEY` 재사용(GCP Console에서 Maps Static API enable + 같은 referer 제한 유지).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 ~ D-20)

**Slug & 라우팅 (VIEW-01)**
- D-01: 기존 `boards.share_slug` + `public_board_view(p_slug)` RPC 그대로 사용 (새 마이그레이션 없음)
- D-02: 외부 공유 URL = `/b/[slug]` 단일 (`/boards/[id]`는 dev tool 게이트 뒤)

**SSR Cache (VIEW-01, VIEW-06)**
- D-03: Next.js 15 App Router `unstable_cache` + tag 기반 revalidation, fallback TTL 1시간, tag = `board:${slug}`
- D-04: Revalidate webhook = `POST /api/revalidate`, body `{ slug, secret }`, secret 환경변수 `REVALIDATE_SECRET`
- D-05: Edge Function → webhook = fire-and-forget (실패 시 재시도/DLQ 없음, 1시간 TTL이 자연 갱신)

**OG Image (VIEW-03)**
- D-06: `app/b/[slug]/opengraph-image.tsx`, 1200×630, 좌측 보드 제목 + 우측 Static Maps 미니맵, Pretendard 한글 ArrayBuffer 등록
- D-07: 미니맵 = Google Static Maps API, 최대 10 markers, URL signing 미적용(v1), 실패 시 텍스트-only fallback
- D-08: OG cache `revalidate: false` (의도적 long-cache, 카톡 scraper 캐시와 일관)

**SEO Meta (VIEW-04)**
- D-09: `generateMetadata()` 확장 — description 템플릿, openGraph.images, twitter:summary_large_image, alternates.canonical, robots.index=true
- D-10: sitemap.ts/robots.ts는 v2

**모바일 반응형 (VIEW-02)**
- D-11: mobile-first, `md` (768px) 한 단계 breakpoint, 지도 `h-[60vh]` (모바일) / `h-[520px]` (md+)
- D-12: 기존 Google Maps JS API 유지, `disableDefaultUI: true` + `zoomControl: true` + `gestureHandling: 'greedy'` + `clickableIcons: false`
- D-13: viewport meta = Next.js 15 `viewport` export, `maximumScale: 5` (접근성)

**타임스탬프 jump (VIEW-05)**
- D-14: 핀 탭 → YouTube 새 탭 (`window.open(..., '_blank', 'noopener')`), in-app iframe player 없음
- D-15: URL = `https://www.youtube.com/watch?v={video_id}&t={source_timestamp_sec}s` (timestamp null이면 `?t=` 생략)
- D-16: 핀→영상 매핑 = `places.link_id` FK → `links[link_id].url` lookup

**readonly / abuse (PROJECT lock)**
- D-17: 로그인 CTA 없음, 푸터 워드마크만
- D-18: 공개 보드 = 영구 readonly (anon, edit/comment/vote 모두 v1 X)
- D-19: v1 명시적 rate limit 없음 (Vercel 기본 + Supabase free tier + unguessable slug)
- D-20: webhook 인증 = `REVALIDATE_SECRET` (32-byte 랜덤), timing-safe 비교

### Claude's Discretion (researcher가 본 research에서 결정)

| Question | Resolution (this research) |
|----------|---------------------------|
| `unstable_cache` vs `fetch({ next })` API | **`unstable_cache`** — RPC 호출이라 `fetch` 옵션 사용 불가. Next.js 15.5 공식 stable API. |
| ImageResponse 폰트 로딩 방식 | **`readFile(join(process.cwd(), 'public/fonts/Pretendard-{Regular,SemiBold}.otf'))`** (Next.js 공식 패턴, self-fetch 회피) |
| Static Maps URL signing 활성화 | **v1 미적용** (D-07 lock 유지, D-19 일관) |
| 미니맵 marker 클러스터링 | **단순 truncate (places.slice(0, 10))** — 10개 초과는 OG 미리보기 용도라 v1 X |
| city_code → city_ko 매핑 위치 | **`packages/core/src/constants.ts`에 `CITY_KO_MAP` 추가** (web + iOS shared, UI-SPEC §"Open Items" 일관) |
| `/api/revalidate` segment config | **`export const runtime = 'nodejs'`** (`revalidateTag` 안정성, `node:crypto.timingSafeEqual` 사용 가능) |
| video_id 추출 정규식 | UI-SPEC §"Pin → YouTube tap"의 정규식 그대로: `/(?:youtube\.com\/(?:watch\?v=\|embed\/)\|youtu\.be\/)([\w-]{11})/` |
| Static Maps 키 분리 | **v1: 기존 `NEXT_PUBLIC_GOOGLE_MAPS_KEY` 재사용 + GCP Console에서 Maps Static API 활성화** (D-19 일관). 별도 `GOOGLE_STATIC_MAPS_KEY` 신설은 v2. |

### Deferred Ideas (OUT OF SCOPE)

- 회원 가입·로그인 CTA in /b/[slug] (v2)
- `/discover` 공개 보드 피드 (VIEW-07, v2)
- sitemap.xml · robots.txt 정형화 (v2)
- OG 미리보기 즉시 갱신 (v2 — 카카오 scraper 캐시 정책상 noop)
- in-app 영상 player iframe (v2)
- 공유 보드 멤버 초대 · ❤️ 투표 UI (v2)
- 다국어 (ja-JP, en-US — v2)
- 다크 모드 (v2)
- Sentry / 에러 트래킹 (v2)
- Rate limit / DDoS 대응 (Phase 6 dogfooding 후 결정)
- OG image marker clustering (v2)
- AMP, Lighthouse micro-opt (v1 mobile Lighthouse 80+면 합격)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | 공개 보드 URL `/b/[slug]`이 비로그인 SSR로 즉시 렌더링됨 (p90 TTFB < 800ms) | `unstable_cache` wrap (§"Cache Pattern"), Vercel Edge cache (§"Vercel deploy") |
| VIEW-02 | 모바일 viewport에서 정상 (지도 핀치줌, 핀 탭) | `generateViewport` (§"Viewport"), `gestureHandling: 'greedy'` (§"Map options") |
| VIEW-03 | `/b/[slug]/opengraph-image`가 보드 제목 + 미니맵 + Pretendard 한글 동적 생성 | `opengraph-image.tsx` + `ImageResponse` + Google Static Maps (§"OG Image") |
| VIEW-04 | `<head>`에 보드 제목·도시·핀 수 기반 SEO meta | `generateMetadata` 확장 (§"SEO Metadata") |
| VIEW-05 | 핀 탭 → YouTube `?t=Xs` 새 탭 | `window.open` + video_id helper (§"YouTube jump") |
| VIEW-06 | 추출 완료 시 `/api/revalidate?slug=...` webhook → 페이지 자동 갱신 | `revalidateTag('board:${slug}')` 라우트 핸들러 (§"Webhook") |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSR 보드 페이지 | Frontend Server (Next.js Node runtime) | API (Supabase RPC) | App Router의 server component가 `getPublicBoardBySlug()` 호출, anon Supabase client로 RPC SELECT |
| `unstable_cache` data cache | Frontend Server (Vercel data cache) | — | Next.js의 built-in Data Cache는 server-side 메모/디스크 (Vercel은 ISR + Edge cache) |
| `revalidateTag` invalidation | Frontend Server (Node runtime) | — | server-only API, route handler 안에서만 호출 가능 |
| `/api/revalidate` webhook | Frontend Server (Next.js route handler, Node) | — | timing-safe secret 검증 + `revalidateTag` 호출, `node:crypto` 사용 |
| OG image 생성 | Frontend Server (Next.js route handler, Node) | CDN/Static (Vercel CDN) | `opengraph-image.tsx`는 special route handler, 빌드 시 정적 최적화 + 카톡 scraper가 캐시 |
| Static Maps PNG fetch | Frontend Server (OG 생성 시) | API (Google Maps Platform) | OG image 안에서 `<img src="...staticmap?...">`, Satori가 URL 다운로드 |
| Google Maps JS API | Browser/Client | — | 클라이언트 컴포넌트 `PublicBoardMap`에서 동적 script tag로 로딩 |
| Pin click → YouTube jump | Browser/Client | — | `window.open` — 순수 클라이언트 동작 |
| Webhook 호출 (Edge → Web) | API (Supabase Edge Function Deno runtime) | Frontend Server (수신) | `extract-youtube/index.ts`의 done broadcast 직후 `fetch(WEB_BASE_URL + '/api/revalidate')` |
| Slug 발급 | Database / Storage (PG trigger) | — | `boards.share_slug`은 `ensure_share_slug` trigger가 INSERT/visibility UPDATE 시 자동 채움 — Phase 4가 만지지 않음 |

---

## Standard Stack

### Core

| Library | Version (verified) | Purpose | Why Standard |
|---------|--------|---------|--------------|
| `next` | 15.5.18 (latest stable, project uses `^15.0.0`) [VERIFIED: npm view next version, 2026-05-07 publish] | App Router · `unstable_cache` · `revalidateTag` · `generateMetadata` · `generateViewport` · `opengraph-image` 파일 컨벤션 | 이미 설치됨 (D-03 lock) |
| `next/og` (bundled with `next`) | 15.5.18 | `ImageResponse` (Satori + Resvg) | Next.js 13.3 이후 공식 OG 생성 API [CITED: nextjs.org/docs/15/app/api-reference/functions/image-response] |
| `@supabase/ssr` | ^0.5.1 (이미 설치) | SSR Supabase client (cookie-based) | 이미 사용 중 (lib/supabase/server.ts) |
| `@supabase/supabase-js` | ^2.45.4 (이미 설치) | RPC client (`getPublicBoardBySlug`) | 이미 사용 중 |
| `tailwindcss` | ^4.0.0-beta.2 (이미 설치) | 모바일 반응형 (mobile-first + `md` breakpoint) | 이미 사용 중 |
| `zod` | ^3.23.8 (이미 설치) | Webhook body validation | 이미 사용 중 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` (Node.js built-in) | — | `timingSafeEqual` for secret 비교 | `/api/revalidate` route handler [CITED: Node.js since v6, 2016] |
| `node:fs/promises` (Node.js built-in) | — | `readFile` for OG image 폰트 로딩 | `opengraph-image.tsx` [CITED: nextjs.org/docs/15 opengraph-image example] |
| `node:path` (Node.js built-in) | — | `join(process.cwd(), 'public/fonts/...')` | 같은 곳 |
| Google Static Maps API | (외부 service) | OG image 미니맵 PNG | `opengraph-image.tsx` 안 `<img src="https://maps.googleapis.com/maps/api/staticmap?...">` |
| Google Maps JS API | (외부, 이미 사용 중) | interactive 지도 | `PublicBoardMap` 클라이언트 컴포넌트 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `unstable_cache` | `use cache` directive | Next.js 15 canary에서 점진 도입 중, stable이 아님 (docs warning) | unstable_cache 유지 |
| `unstable_cache` | `fetch({ next: { tags, revalidate } })` | Supabase RPC는 `fetch` wrapper가 아니라 옵션 전달 불가 | unstable_cache 강제 |
| `next/og` self-fetch font | `readFile(process.cwd())` | self-fetch는 cold start deadlock 위험 + redeploy race | readFile 권장 |
| Google Static Maps | Mapbox Static Images / OpenStreetMap | 이미 Google Maps JS 사용 중, 동일 GCP project 비용 일관 | Static Maps 유지 (D-07 lock) |
| `next-test-server` / Playwright | Vitest + RTL | Phase 4 web에 테스트 인프라 없음 (Wave 0 신규) — Vitest가 Next 15 + React 19 호환 표준 | Vitest 도입 (§"Validation Architecture") |

**Installation (Wave 0 — 테스트 인프라):**

```bash
pnpm --filter @moajoa/web add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

**Version verification:** 본 research는 Next.js 15.5.18 (2026-05-07 npm publish, 6주 이전) 기준. 16.x는 canary 단계로 사용 권장 안 함. 프로젝트의 `^15.0.0` resolver는 자동으로 15.5.x로 올라간다.

---

## Architecture Patterns

### System Architecture Diagram

```
                  [카톡 채팅창 share]
                          │
                          ▼
   ┌──────────────────────────────────────────────────────┐
   │  카카오 scraper → GET /b/{slug} (HTML+OG 추출)        │
   │  사용자 모바일 Safari → GET /b/{slug} (SSR HTML)      │
   └──────────────────────────┬───────────────────────────┘
                              ▼
              ┌────────────────────────────────┐
              │ Vercel Edge (Next.js 15)       │
              │ ┌────────────────────────────┐ │
              │ │ /b/[slug]/page.tsx (SSR)   │ │
              │ │   ├─ generateMetadata()    │ │
              │ │   │   → unstable_cache     │ │
              │ │   │   → getPublicBoardBy   │ │
              │ │   │     Slug() ─┐          │ │
              │ │   └─ Page render            │ │
              │ │       PublicBoardMap (CSR)  │ │
              │ └─────────────────┬──────────┘ │
              │ ┌─────────────────▼──────────┐ │
              │ │ Data Cache (tag: board:N)  │ │
              │ └────────────────────────────┘ │
              │ ┌────────────────────────────┐ │
              │ │ /b/[slug]/opengraph-image  │ │
              │ │   → ImageResponse          │ │
              │ │   → readFile(Pretendard)   │ │
              │ │   → <img staticmap?...>    │ │ ──┐
              │ └────────────────────────────┘ │   │
              │ ┌────────────────────────────┐ │   │
              │ │ /api/revalidate (Node)     │ │   │
              │ │   ← POST {slug, secret}    │ │   │
              │ │   timing-safe compare      │ │   │
              │ │   → revalidateTag(board:N) │ │   │
              │ └────────────────┬───────────┘ │   │
              └──────────────────┼─────────────┘   │
                                 │                  │
              ┌──────────────────▼─────────────┐   │
              │ Supabase                       │   │
              │  · public_board_view(slug)     │   │
              │    (SECURITY DEFINER RPC)      │   │
              │  · Edge Function:              │   │
              │    extract-youtube             │   │
              │    └─ done broadcast 직후       │   │
              │       fetch(WEB_BASE_URL +     │   │
              │       /api/revalidate) ───────┘   │
              └────────────────────────────────┘   │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │ Google Static Maps API    │
                                    │ (PNG bytes, OG에 embed)   │
                                    └───────────────────────────┘
```

**핵심 흐름 (한 use-case):**
1. iOS에서 보드를 'public'으로 전환 → trigger가 `share_slug` 발급
2. iOS가 카톡으로 `https://moajoa.app/b/abc123def456` 공유
3. 카카오 scraper가 그 URL fetch → Next.js Edge가 HTML+OG meta 반환
4. 친구가 모바일 Safari에서 link tap → SSR HTML 즉시 표시 (data cache hit이면 RPC 호출 skip)
5. 클라이언트 hydration → Google Maps JS load → 핀 표시
6. 친구가 핀 tap → `window.open(youtube_url, '_blank')` → 새 탭에서 영상 timestamp jump

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx               # viewport export 추가 (D-13)
│   ├── b/
│   │   └── [slug]/
│   │       ├── page.tsx          # generateMetadata 확장 + unstable_cache wrap (D-03, D-09)
│   │       ├── opengraph-image.tsx  # 신규 (D-06, D-07)
│   │       ├── not-found.tsx     # 신규 (UI-SPEC §5)
│   │       ├── error.tsx         # 신규 'use client' (UI-SPEC §6)
│   │       └── _components/
│   │           └── public-board-map.tsx  # gestureHandling + clickableIcons + onClick 추가 (D-12, D-14)
│   └── api/
│       └── revalidate/
│           └── route.ts          # 신규 (D-04, D-20)
├── lib/
│   ├── env.ts                    # REVALIDATE_SECRET 등록
│   ├── og/
│   │   └── pretendard.ts         # 신규: readFile 한 번만, 캐싱
│   ├── og/
│   │   └── static-maps.ts        # 신규: URL builder + size/markers/style 옵션
│   └── youtube.ts                # 신규: extractYouTubeVideoId + buildWatchUrlWithTimestamp
├── public/
│   └── fonts/                    # 이미 존재 — Pretendard 4 weight .otf
└── __tests__/                    # 신규 (Wave 0)
    ├── api-revalidate.test.ts
    ├── youtube-id.test.ts
    └── static-maps-url.test.ts

packages/core/src/
└── constants.ts                  # CITY_KO_MAP 추가 (UI-SPEC §"Open Items")

supabase/functions/extract-youtube/
└── index.ts                      # done broadcast 직후 fire-and-forget POST 한 줄 (D-04)
```

### Pattern 1: `unstable_cache` for RPC

**What:** Supabase RPC 호출(`getPublicBoardBySlug`)을 server-side data cache에 저장하고 tag로 무효화한다.

**When to use:** SSR data fetching에서 동일 입력이 반복 요청될 때 (slug별로 캐시 hit 기대).

**Example (Pattern recommended for `app/b/[slug]/page.tsx`):**

```typescript
// Source: https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache (verified 2026-05-26)
import { unstable_cache } from 'next/cache';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';

// 캐시된 fetcher — slug마다 개별 cache key + tag
const getCachedPublicBoard = (slug: string) =>
  unstable_cache(
    async () => {
      const supabase = await getSupabaseServer();
      return getPublicBoardBySlug(supabase, slug);
    },
    ['public-board', slug],     // keyParts — slug를 명시 (closure capture 안전)
    {
      tags: [`board:${slug}`],   // revalidateTag로 무효화하는 키
      revalidate: 3600,          // 1시간 TTL fallback (D-03)
    },
  )();

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const view = await getCachedPublicBoard(slug);
  if (!view) notFound();
  // ...
}
```

**중요한 디테일:**
- **keyParts에 `slug`를 반드시 포함.** 공식 docs: "It is important to add closures used within the function if you do not pass them as parameters." Slug는 closure variable이므로 keyParts에 명시.
- **`'public-board'` 같은 namespace prefix 권장** — 다른 cached function과 충돌 방지.
- **`getSupabaseServer()`을 cached fn 내부에서 호출** — `cookies()` 같은 dynamic API는 cache scope 밖에서 부르면 build error, 안에서 부르면 cached value에 cookie 상태가 박힘. 공개 보드는 anon이므로 OK이지만, RPC가 RLS bypass이라 cookie와 무관 — 더 깔끔하게는 supabase server client 자체를 cache scope 밖에서 만들고 RPC 호출만 cache에 넣기:

```typescript
// 더 안전한 변형 — RPC만 cache, supabase client는 매번 신선
export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();

  const view = await unstable_cache(
    async () => getPublicBoardBySlug(supabase, slug),
    ['public-board', slug],
    { tags: [`board:${slug}`], revalidate: 3600 },
  )();

  if (!view) notFound();
  // ...
}
```

**[ASSUMED]** 두 변형 모두 동작하지만 `cookies()`/`headers()`를 cache scope 안에서 호출하지 않는 것이 안전 — 첫 plan에서 build error 발생 시 후자로 전환.

**같은 캐시를 `generateMetadata`와 page render가 공유:** Next.js 15는 같은 request 안의 같은 keyParts cache call을 자동 dedupe — `generateMetadata`에서 한 번, page render에서 한 번 호출해도 RPC는 한 번만 [CITED: nextjs.org/docs/15 generateMetadata Good to know section: "fetch requests inside generateMetadata are automatically memoized"]. RPC는 fetch가 아니지만 `unstable_cache` 자체가 이 역할을 한다.

### Pattern 2: Route Handler for Revalidate Webhook

**What:** Supabase Edge Function이 추출 완료 후 호출하는 POST endpoint. timing-safe secret 검증 후 tag 무효화.

**When to use:** D-04 webhook 그대로.

**Example (`app/api/revalidate/route.ts`):**

```typescript
// Source: https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag (verified 2026-05-26)
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs'; // node:crypto 사용

const BodySchema = z.object({
  slug: z.string().min(8).max(32),
  secret: z.string().min(16),
});

function safeEqual(a: string, b: string): boolean {
  // 길이가 다르면 timingSafeEqual이 throw — 미리 길이 다르면 false 반환
  // (단, 길이 비교는 자체 정보 leak이 있지만 secret 길이는 고정 32 byte 가정)
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // 환경변수 미설정은 500 (운영 사고)
    return Response.json({ ok: false, error: 'misconfigured' }, { status: 500 });
  }

  if (!safeEqual(parsed.data.secret, secret)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag(`board:${parsed.data.slug}`);

  return Response.json({ ok: true, slug: parsed.data.slug });
}

// 405 for other methods
export async function GET() {
  return Response.json({ ok: false, error: 'method not allowed' }, { status: 405 });
}
```

**핵심 디테일:**
- **`runtime = 'nodejs'`** — `node:crypto.timingSafeEqual`은 Node.js native. Edge runtime은 WebCrypto만 있어 `crypto.subtle.timingSafeEqual`이 없음 (web standards). v1은 Node로 시작 [VERIFIED: Node.js v6+, 2016].
- **`revalidateTag`는 동기 호출** — 리턴값 없음, 즉시 표시만 변경 [CITED: Next.js 15 docs]. 다음 페이지 방문 시 stale 마크가 보여서 RPC가 다시 호출됨.
- **fire-and-forget 호환** — D-05 lock대로 Edge Function이 실패해도 무시. webhook은 두 번 와도 idempotent (tag 무효화는 멱등).
- **Length-prefix 비교는 leak이 미미** — secret 길이는 32 byte 고정이므로 알려진 정보 (D-20).

### Pattern 3: Dynamic OG Image with `opengraph-image.tsx`

**What:** Next.js 파일 컨벤션 — `opengraph-image.tsx`이 자동으로 `<meta property="og:image">` 생성 + 라우트로 노출.

**When to use:** VIEW-03 그대로.

**Example (`app/b/[slug]/opengraph-image.tsx`):**

```typescript
// Source: https://nextjs.org/docs/15/app/api-reference/file-conventions/metadata/opengraph-image (verified 2026-05-26)
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { buildStaticMapsUrl } from '@/lib/og/static-maps';
import { CITY_KO_MAP } from '@moajoa/core';

export const alt = 'MOAJOA 공유 보드';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// export const runtime = 'nodejs';  // default — Edge로 강제할 필요 없음 (D-06 'Edge runtime' 표현은 history 잔재, Node가 더 안정)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const view = await getPublicBoardBySlug(supabase, slug);

  // 폰트 로딩 (Next.js 공식 패턴 — process.cwd() = 프로젝트 루트)
  const [regularFont, semiboldFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Regular.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ]);

  // Fallback: board를 못 찾으면 generic 카드
  if (!view) {
    return new ImageResponse(
      <FallbackCard />,
      {
        ...size,
        fonts: [
          { name: 'Pretendard', data: regularFont, weight: 400, style: 'normal' },
          { name: 'Pretendard', data: semiboldFont, weight: 600, style: 'normal' },
        ],
      },
    );
  }

  const title = view.board.title;
  const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;
  const pinCount = view.places.length;
  const cityCode = view.board.city_code;
  const mapUrl = view.places.length > 0
    ? buildStaticMapsUrl({
        places: view.places.slice(0, 10),
        size: { width: 600, height: 630 },
        scale: 2,
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
      })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'Pretendard',
          background: '#FFFFFF',
        }}
      >
        {/* 좌측 600 — 텍스트 stack */}
        <div
          style={{
            width: 600,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 48, fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
              {title}
            </div>
            {cityKo && (
              <div style={{ fontSize: 28, fontWeight: 400, color: '#475569', marginTop: 24 }}>
                {cityKo}
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 400, color: '#475569', marginTop: cityKo ? 16 : 24 }}>
              핀 {pinCount}개
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#F97316' }}>
            MOAJOA
          </div>
        </div>
        {/* 우측 600 — Static Maps PNG 또는 fallback */}
        <div
          style={{
            width: 600,
            height: 630,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
          }}
        >
          {mapUrl ? (
            <img src={mapUrl} width={600} height={630} style={{ objectFit: 'cover' }} alt="" />
          ) : (
            <div style={{ fontSize: 20, fontWeight: 400, color: '#64748B' }}>
              지도 미리보기 준비 중
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Pretendard', data: regularFont, weight: 400, style: 'normal' },
        { name: 'Pretendard', data: semiboldFont, weight: 600, style: 'normal' },
      ],
    },
  );
}
```

**중요한 디테일:**
- **`process.cwd()` = 프로젝트 루트** (Next.js docs 명시). Vercel deploy 시 그대로 `apps/web/public/fonts/...`로 resolve.
- **bundle 한도 500KB** — Pretendard `.otf` 2개 (SemiBold ~250KB, Regular ~270KB 추정) = ~520KB 위험. **첫 plan에서 실제 파일 크기 확인 필수** (`ls -la apps/web/public/fonts/`). 초과 시 woff2 변환 또는 한글 subset (한국 KS X 1001 commonly used 2350자).
- **CSS subset**: flexbox만 [CITED: nextjs.org/docs/15 ImageResponse "Only flexbox and a subset of CSS properties are supported"]. `display: grid`, `margin: auto` (절대값으로) 안 됨. 본 예제는 flexbox만 사용.
- **Caching**: 기본 statically optimized, 단 `params` + `await getPublicBoardBySlug` (dynamic) 사용으로 동적 렌더. D-08 lock(`revalidate: false`)을 강제하려면 `export const revalidate = false` 추가 또는 nothing — dynamic 라우트라 자동으로 첫 호출 후 메모.
- **OG image size limit: 8MB** (twitter-image는 5MB) [CITED: Next.js 15 docs]. 1200×630 PNG는 보통 100~500KB라 무관.
- **`<img src={mapUrl}>`은 빌드 타임에 Satori가 URL fetch + raster** — Static Maps 호출이 OG 생성 시 1번 발생. 카카오 scraper가 OG URL을 cache하므로 첫 호출 후 재호출 거의 없음 (D-08).

### Pattern 4: viewport export (D-13)

**Example (`apps/web/app/layout.tsx`에 추가):**

```typescript
// Source: https://nextjs.org/docs/15/app/api-reference/functions/generate-viewport (verified 2026-05-26)
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // userScalable 미설정 — 기본 true (D-13 접근성 lock)
};
```

**중요한 디테일:**
- **`maximumScale: 1` + `userScalable: false`는 접근성 위반** (WCAG 1.4.4 Resize Text) — D-13 lock대로 `maximumScale: 5`.
- **iOS Safari toolbar 이슈**: `100vh`가 toolbar 포함된 viewport 높이라 콘텐츠 잘림. D-11이 `h-[60vh]` 대신 `h-[420px]` 또는 절대값을 쓰라고 권장했지만, 60vh는 60% so 약간 잘려도 손상 적음. UI-SPEC §"Spacing Scale"의 `h-[60vh] (모바일) / h-[520px] (md+)`이 lock. 대안: CSS `dvh` (dynamic viewport height) — Tailwind v4의 `h-[60dvh]` 사용 가능하지만 일부 구형 브라우저 미지원. v1은 `h-[60vh]`로 시작, Phase 6 dogfooding에서 카카오 in-app browser 잘림 발견 시 `dvh`로 전환.

### Pattern 5: SEO Metadata Extension (D-09)

**Example (`app/b/[slug]/page.tsx`의 `generateMetadata` 확장):**

```typescript
// Source: https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata (verified 2026-05-26)
import type { Metadata } from 'next';
import { CITY_KO_MAP } from '@moajoa/core';

// 루트 layout.tsx에 metadataBase 추가 권장 (절대 URL 변환)
// export const metadata: Metadata = { metadataBase: new URL('https://moajoa.app'), ... };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = await getCachedPublicBoard(slug); // 같은 cache 재사용 (자동 dedupe)

  if (!view) return { title: 'MOAJOA' };

  const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;
  const pinCount = view.places.length;
  const owner = view.owner_display_name;

  const description = cityKo
    ? `${owner}님의 ${cityKo} 여행 · 핀 ${pinCount}개 · MOAJOA`
    : `${owner}님의 여행 보드 · 핀 ${pinCount}개 · MOAJOA`;

  const ogImageUrl = `/b/${slug}/opengraph-image`; // metadataBase가 절대화

  return {
    title: `${view.board.title} · MOAJOA`,
    description,
    openGraph: {
      title: view.board.title,
      description,
      type: 'website',
      images: [ogImageUrl], // file convention이 자동 등록하지만 명시 권장
    },
    twitter: {
      card: 'summary_large_image',
      title: view.board.title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `/b/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

**중요한 디테일:**
- **`metadataBase: new URL('https://moajoa.app')`을 루트 layout.tsx에 추가** — 절대 URL 변환을 위해 필수. 없으면 build warning + 일부 scraper에서 og:image 누락.
- **`opengraph-image.tsx` 파일 컨벤션이 자동으로 og:image 등록** — `images` 명시는 중복이지만 일부 SEO 도구에서 명시 우선시. file-based가 더 높은 우선순위라 결과는 동일 [CITED: nextjs.org/docs/15 generateMetadata "File-based metadata has the higher priority"].
- **`generateMetadata`와 `page` 사이 RPC dedupe** — 같은 `unstable_cache` 함수를 양쪽에서 호출하면 1번만 실행 (request memoization). 위 예제처럼 `getCachedPublicBoard(slug)` 호출만 일관되게 하면 OK.
- **`alternates.canonical`은 상대경로 OK** (metadataBase로 절대화).

### Pattern 6: Google Maps JS gestureHandling (D-12)

**Example (`apps/web/app/b/[slug]/_components/public-board-map.tsx` 수정):**

```typescript
// 현 코드 line 25-30 변경
const map = new g.Map(ref.current, {
  center,
  zoom: places.length > 0 ? 13 : 11,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',    // 추가 (D-12)
  clickableIcons: false,         // 추가 (D-12)
});

// Marker click handler — D-14, D-15, D-16
for (const p of places) {
  const marker = new g.Marker({
    map,
    position: { lat: p.lat, lng: p.lng },
    title: p.name_local,
  });

  // 핀 → YouTube jump
  const link = links.find((l) => l.id === p.link_id);
  if (link?.url) {
    const youtubeUrl = buildYouTubeWatchUrl(link.url, p.source_timestamp_sec);
    if (youtubeUrl) {
      marker.addListener('click', () => {
        window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
      });
    }
  }
}
```

`links` props 추가 필요 — 현재 컴포넌트는 `places`만 받지만 `link.url`이 필요. signature 변경:

```typescript
export function PublicBoardMap({
  places,
  links,
}: {
  places: PublicBoardView['places'];
  links: PublicBoardView['links'];
}) { ... }
```

### Pattern 7: YouTube video_id Helper (D-15)

**Example (`apps/web/lib/youtube.ts`):**

```typescript
/**
 * Extract YouTube video_id from various URL formats.
 * Returns null for non-YouTube or malformed URLs.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/**
 * Build a YouTube watch URL with optional timestamp.
 * If videoId can't be extracted, returns null.
 * If timestampSec is null, omits ?t=.
 */
export function buildYouTubeWatchUrl(linkUrl: string, timestampSec: number | null): string | null {
  const videoId = extractYouTubeVideoId(linkUrl);
  if (!videoId) return null;
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return timestampSec != null && timestampSec > 0 ? `${base}&t=${Math.floor(timestampSec)}s` : base;
}
```

**Edge cases (테스트 필요):**
- `https://www.youtube.com/watch?v=ABC123_def-1` → `ABC123_def-1` ✓
- `https://youtu.be/ABC123_def-1` → `ABC123_def-1` ✓
- `https://www.youtube.com/embed/ABC123_def-1` → `ABC123_def-1` ✓
- `https://www.youtube.com/watch?v=ABC123_def-1&list=PL...` → `ABC123_def-1` ✓ (정규식이 첫 11자만 캡처)
- `https://www.youtube.com/shorts/ABC123_def-1` → null (현 정규식 미지원) — Phase 4 scope 외 (manual review 필요)
- `https://m.youtube.com/watch?v=ABC123_def-1` → null (`m.youtube.com` 미매치) — 정규식 보강 권장: `(?:m\.)?youtube\.com`
- `timestampSec = 0.5` → `Math.floor` 거쳐 `0` → 빈 timestamp로 처리 (`> 0` 조건)
- `timestampSec = null/undefined/NaN` → 빈 timestamp

### Pattern 8: Google Static Maps URL Builder

**Example (`apps/web/lib/og/static-maps.ts`):**

```typescript
// Source: https://developers.google.com/maps/documentation/maps-static/start (verified 2026-05-26)
// + UI-SPEC §"OG Image" specs

interface MarkerLatLng {
  lat: number;
  lng: number;
}

interface BuildStaticMapsOpts {
  places: MarkerLatLng[];   // up to 10 (D-07)
  size: { width: number; height: number };
  scale?: 1 | 2;            // Retina = 2
  apiKey: string;
  styleParams?: string[];   // optional grayscale 등
}

/**
 * Build a Google Static Maps URL with multiple markers in MOAJOA brand-500 color.
 * - Single `markers=` parameter (all same color/size) keeps URL short.
 * - max URL length: 16384 chars (Google docs) — 10 markers ≈ 500 chars, 충분.
 * - No URL signing (D-07 lock, v1).
 */
export function buildStaticMapsUrl(opts: BuildStaticMapsOpts): string {
  const { places, size, scale = 2, apiKey, styleParams = [] } = opts;
  if (places.length === 0) {
    throw new Error('buildStaticMapsUrl: at least 1 place required');
  }

  const truncated = places.slice(0, 10);
  const markerStr =
    `color:0xF97316|size:mid|` +
    truncated.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');

  const params = new URLSearchParams({
    size: `${size.width}x${size.height}`,
    scale: scale.toString(),
    maptype: 'roadmap',
    key: apiKey,
  });
  params.append('markers', markerStr);

  // Auto-fit zoom: omit center+zoom, Google auto-fits to markers bbox
  // (https://developers.google.com/maps/documentation/maps-static/start#Locations)

  // Optional gray-tone styling (UI-SPEC §"Color")
  for (const s of styleParams) {
    params.append('style', s);
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Preset: subtle gray-tone style for OG image.
 * (Removes label clutter + desaturates POI/road colors.)
 */
export const OG_GRAYSCALE_STYLE = [
  'feature:poi|element:labels|visibility:off',
  'feature:road|element:labels|visibility:simplified',
  'feature:all|element:geometry|saturation:-60',
];
```

### Pattern 9: Edge Function Webhook Trigger (D-04, D-05)

**Example (`supabase/functions/extract-youtube/index.ts` 끝부분, broadcast done 직후 추가):**

```typescript
// 기존 코드 line 234:
await broadcastStep(admin, link_id, 'done', 100, { places_extracted: resolved.length });

// 새로 추가 — board의 share_slug lookup + webhook fire-and-forget
try {
  // board lookup — link.board_id 이미 in-scope
  const { data: board } = await admin
    .from('boards')
    .select('share_slug, visibility')
    .eq('id', link.board_id)
    .maybeSingle();

  // visibility='public' + share_slug 있을 때만 webhook
  if (board?.visibility === 'public' && board.share_slug) {
    const webBase = Deno.env.get('WEB_BASE_URL'); // e.g. https://moajoa.app
    const revalidateSecret = Deno.env.get('REVALIDATE_SECRET');
    if (webBase && revalidateSecret) {
      // fire-and-forget — D-05 lock
      fetch(`${webBase}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: board.share_slug, secret: revalidateSecret }),
      }).catch((err) => console.warn('[revalidate-webhook] failed:', err));
    }
  }
} catch (err) {
  console.warn('[revalidate-webhook] lookup failed:', err);
}
```

**중요한 디테일:**
- **WEB_BASE_URL 미설정 시 skip** — dev (Supabase local) → web (localhost) 호출 불필요한 경우 깔끔히 noop. Production은 Supabase Edge Function secrets에 `WEB_BASE_URL=https://moajoa.app`, `REVALIDATE_SECRET=...` 설정.
- **`await` 없이 fire-and-forget** — `fetch()` 자체는 비동기지만 `.catch()`로 unhandled rejection 방지. Edge Function 라이프사이클은 response 후에도 fetch 완료까지 기다리지만 fire-and-forget 의도라 OK.
- **`visibility='public'` 체크** — private/shared 보드의 추출 완료는 web revalidate 불필요. 호출 비용 절감.
- **N+1 query 회피** — 이미 `link.board_id` in-scope이라 `boards` 1번만 SELECT.

---

### Anti-Patterns to Avoid

- **`'use client'`에서 `revalidateTag` 호출** — server-only API. 빌드 에러 또는 런타임 fail.
- **`unstable_cache` 안에서 `cookies()`/`headers()` 사용** — Next.js 15 "Accessing dynamic data sources inside a cache scope is not supported" [CITED: nextjs.org/docs/15 unstable_cache]. 위 Pattern 1 후자 변형 사용.
- **OG image에 `display: grid` 또는 `position: fixed`** — Satori 미지원, 빈 영역으로 렌더링.
- **`process.env.NEXT_PUBLIC_*`을 server-only 코드에서 인라인 비교** — Next.js가 빌드 타임에 string replace하므로 typo가 silent. `lib/env.ts` 통과 권장.
- **secret을 `===`로 비교** — timing attack에 노출. `timingSafeEqual` 사용.
- **OG image 폰트를 `${origin}/fonts/...` self-fetch** — cold start deadlock, redeploy race. `readFile(process.cwd())` 사용.
- **`window.open(url, '_blank')`에 `noopener` 누락** — opener 노출 → reverse tabnabbing. `'_blank', 'noopener,noreferrer'` 필수.
- **Marker 클릭 listener를 useEffect 외부에서 등록** — hot reload 또는 places prop 변경 시 listener 누수. 현 코드는 useEffect 안이므로 OK이지만 cleanup function에서 `map.unbindAll()` 또는 마커 dispose 명시 권장.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC secret 비교 | `secret === expected` | `node:crypto.timingSafeEqual` | Timing attack (Node.js v6+ built-in) |
| Body parsing | `JSON.parse(rawBody)` 후 ad-hoc validation | `zod` (이미 의존성) | 이미 사용 패턴 — validation + 타입 추론 |
| OG image 생성 | Puppeteer / canvas | `next/og` ImageResponse | Satori는 Edge-friendly, Vercel 환경 검증됨 |
| Cache key construction | 직접 stringify | `unstable_cache` keyParts | Next.js가 hash + tag invalidation 관리 |
| Slug 발급 | 클라이언트에서 nanoid | PG `ensure_share_slug` trigger | 이미 lock된 패턴 (0001_init.sql) |
| YouTube URL parsing | URL parsing 후 query.get('v') | 단일 정규식 | youtu.be, embed, watch 다양한 형식 한 번에 |
| Static Maps marker icons | base64 SVG | Google `markers=` query param | URL 단축 + Google 인프라 |
| Mobile detection | UA sniffing | CSS `md:` breakpoint | mobile-first Tailwind 패턴 |

**Key insight:** Phase 4는 Next.js 15의 빌트인 + 기존 자산(PG trigger, RPC, Google Maps)로 거의 완결. 신규 라이브러리 도입 0개. 코드의 정직한 길이는 약 200~300 LOC.

---

## Common Pitfalls

### Pitfall 1: `unstable_cache` keyParts 누락으로 모든 slug가 동일 캐시 공유
**What goes wrong:** `unstable_cache(fn, [], { tags: [...] })`처럼 keyParts 비우면, closure에서 캡처한 slug에 따라 cache key가 분리되지 않음. 한 boards의 데이터가 다른 slug에 노출.
**Why it happens:** Docs의 "arguments and stringified function이 자동 cache key"가 헷갈리기 쉬움. `arguments`는 호출 시 넘긴 args를 의미하지 closure 변수가 아님.
**How to avoid:** keyParts에 모든 closure dependency 명시. `['public-board', slug]` 처럼 namespace prefix + 동적 key.
**Warning signs:** dev 모드에서 보드 A 열고 → 보드 B 열면 → A 데이터 표시. p90 TTFB는 측정되지만 보안 사고.

### Pitfall 2: Next.js 15 default가 dynamic으로 변경 — 명시적 cache 없으면 매 요청 SSR
**What goes wrong:** App Router default가 Next.js 14에서 15로 가면서 변경. `unstable_cache` 또는 `force-static`/`cache: 'force-cache'` 없으면 매 요청 server-side render. p90 TTFB < 800ms 못 맞춤.
**Why it happens:** 14 → 15 마이그레이션에서 default cache behavior 변경 [CITED: CONTEXT.md Known Pitfalls].
**How to avoid:** `unstable_cache` wrap (D-03 lock). 또는 segment config `export const revalidate = 3600`로 page-level cache.
**Warning signs:** Vercel Analytics에서 TTFB가 매 요청 200~500ms (RPC latency 포함). 두 번째 방문이 첫 번째와 동일하면 cache 미적용.

### Pitfall 3: ImageResponse bundle 500KB 초과
**What goes wrong:** Pretendard Regular + SemiBold 두 `.otf` 합산이 500KB 한도를 넘으면 ImageResponse가 build 실패 또는 runtime throw.
**Why it happens:** 한글 폰트는 보통 250~400KB. 두 weight 등록만으로도 한계 근접.
**How to avoid:** 첫 plan에서 `ls -la apps/web/public/fonts/Pretendard-*.otf` 확인. 초과 시:
1. `woff2` 변환 (한글 폰트 woff2는 약 30~40% 작음)
2. 한글 subset (KS X 1001 commonly used 2350자 — 작 100~150KB)
3. Bold(700)·Medium(500) `.otf`는 OG에 사용 안 함 — `fonts: [Regular, SemiBold]`만 등록 (UI-SPEC §"Typography").
**Warning signs:** `pnpm web:build`에서 `[opengraph-image]` error: "The page exceeds the bundle size limit of 500KB".

### Pitfall 4: Static Maps API 미활성화로 403
**What goes wrong:** Google Cloud project에서 Maps JavaScript API는 활성화되어 있지만 Maps Static API가 별도 활성화 필요. 첫 OG 생성 시 PNG 자리가 403 페이지.
**Why it happens:** GCP는 API 별로 enable 필요. 키는 동일해도.
**How to avoid:** 첫 plan 또는 deploy 시 GCP Console > APIs & Services > Library > "Maps Static API" 활성화. v1은 같은 키 재사용(D-19 consistency).
**Warning signs:** OG image의 우측에 회색 박스 + Satori 콘솔에 "failed to fetch image" 또는 403 status.

### Pitfall 5: 카카오 in-app browser viewport `100vh` 잘림
**What goes wrong:** iOS Safari와 다르게 카카오톡 in-app browser는 `100vh`를 toolbar 포함 높이로 계산. `h-[100vh]` 콘텐츠 하단 잘림.
**Why it happens:** 카카오 WebView는 Safari WebKit 기반이지만 in-app UI(상단 X 버튼, 하단 share bar)가 viewport에 포함되는 timing 다름.
**How to avoid:** UI-SPEC § "Spacing"에 lock된 `h-[60vh]` (60%라 잘려도 손상 적음) 또는 절대 `h-[420px]`. Tailwind v4의 `h-[60dvh]` (dynamic viewport)도 옵션 — 카카오 WebKit이 `dvh` 지원하면 더 정확.
**Warning signs:** dogfooding 중 카톡으로 보드 공유 후 친구가 "지도 잘려보여" 보고.

### Pitfall 6: Edge Function `WEB_BASE_URL` 미설정 또는 잘못된 URL
**What goes wrong:** Supabase Edge Function secrets에 `WEB_BASE_URL`이 dev/preview/prod 환경별로 다른데 dev에서 prod URL을 호출하면 prod 데이터에 영향. 또는 미설정이면 webhook noop = 1시간 stale.
**Why it happens:** Supabase Edge Function은 환경 분리가 약함. Vercel preview/production은 자동 URL 분리되지만 Supabase는 단일 project.
**How to avoid:** Local dev에서는 `WEB_BASE_URL`을 unset (위 Pattern 9의 if 조건이 skip). Production deploy 시 supabase secrets set으로 prod URL만 설정. Preview branch 사용 시 Vercel preview URL은 동적이라 별도 처리 필요 (v1 X — D-05 lock).
**Warning signs:** local에서 추출 완료 후 prod 데이터 일부 갱신되거나, prod에서 자동 revalidate 안 됨.

### Pitfall 7: `revalidateTag`가 즉시 fetch trigger 안 함
**What goes wrong:** D-04 의도는 "추출 완료 → 즉시 사용자에게 보임"이지만 `revalidateTag`는 *stale 마크*만 한다. 다음 요청 시 비로소 fresh data fetch. 카카오 scraper는 OG cache라 무관, 실제 사용자가 다음에 방문할 때 갱신.
**Why it happens:** Next.js docs 명시: "revalidateTag marks tagged data as stale, but fresh data is only fetched when pages using that tag are next visited." 즉시 broadcast 같은 효과 아님.
**How to avoid:** 본 phase는 그게 의도된 동작. 사용자 expectation 관리는 UI 차원(empty state "아직 분석 중이에요" — UI-SPEC §4)에서 처리. D-04와 일치.
**Warning signs:** 추출 완료 webhook 후 같은 사용자가 같은 페이지를 refresh했는데 안 갱신 — Vercel CDN edge cache가 별도로 캐싱 중이면 발생. `Cache-Control: s-maxage=...` 헤더 조정 필요 (Phase 6 dogfooding에서 확인).

### Pitfall 8: opengraph-image 라우트가 page보다 자주 호출되어 RPC 비용 폭주
**What goes wrong:** OG image 라우트는 카카오/Slack/Twitter scraper가 페이지보다 더 자주 fetch (preview 갱신, 캐시 무효화 등). page용 cache + OG용 cache가 분리되면 RPC 호출이 2배.
**Why it happens:** `opengraph-image.tsx`은 별개의 route handler. page의 `unstable_cache`와 별도.
**How to avoid:** OG image도 같은 `getCachedPublicBoard(slug)` helper 호출. `tags: [`board:${slug}`]` 공유로 같은 invalidation에 묶임. 추가로 OG는 D-08 lock대로 `revalidate: false`이라 카카오가 캐시 안 깨면 한 번만 호출.
**Warning signs:** `extraction_costs`나 Supabase project metrics에서 `public_board_view` RPC 호출 카운트가 페이지 view보다 큼.

### Pitfall 9: `runtime = 'edge'`로 강제 시 `node:crypto`/`node:fs` import 실패
**What goes wrong:** D-06 CONTEXT.md "Edge runtime"이 잔재 표현. 실제로는 `opengraph-image`도, `/api/revalidate`도 Node runtime이 더 안정 (fs 사용 + timingSafeEqual).
**Why it happens:** Next.js docs 트렌드는 Edge에서 Node로 회귀 — `node:` import가 Node runtime에서만 동작.
**How to avoid:** 명시적으로 `export const runtime = 'nodejs'` 또는 생략 (Node가 default). CONTEXT.md D-06의 "Edge runtime"은 본 research에서 Node로 정정.
**Warning signs:** 빌드 에러 "Module not found: Can't resolve 'node:fs/promises'" 또는 "timingSafeEqual is not defined".

---

## Code Examples

위 Pattern 1~9에 모두 verified 예제 포함. 추가 예제는 §"Validation Architecture" 참조.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `getServerSideProps` + manual cache headers | App Router `unstable_cache` + `revalidateTag` | Next.js 13.4 (2023) | 본 코드베이스는 처음부터 App Router |
| Page-based metadata (`<Head>`) | `generateMetadata` export | Next.js 13.2 | 이미 사용 중 |
| `viewport` in `<head>` 수동 | `generateViewport` export | Next.js 14.0 (deprecated old) | D-13 신규 적용 |
| `next/image`로 OG 카드 만들기 | `next/og` `ImageResponse` (Satori) | Next.js 13.3 | D-06 신규 |
| Self-built revalidate endpoint with custom token | Built-in `revalidateTag` + route handler | Next.js 14.0 (`revalidatePath`도) | D-04 신규 |
| `unstable_cache` | (future) `use cache` directive | Next.js 16+ canary | unstable_cache는 안정적, "use cache" stable 되면 마이그레이션 |

**Deprecated/outdated:**
- `next/server`의 `ImageResponse` (now `next/og` since v14)
- `themeColor` / `colorScheme` / `viewport` in metadata (now `generateViewport`)
- Pages Router (apps/web는 처음부터 App Router라 무관)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pretendard SemiBold + Regular `.otf` 합산 < 500KB | Pitfall 3 | OG image 빌드 실패 — woff2 변환 필요 (첫 plan에서 `ls -la` 확인) |
| A2 | `unstable_cache` 안에서 `getSupabaseServer()` 호출이 `cookies()` 때문에 build error 발생 | Pattern 1 | 빌드 실패 시 후자 변형 (RPC만 cache, client는 outside) — research에 양쪽 다 명시함 |
| A3 | Google Cloud project의 `NEXT_PUBLIC_GOOGLE_MAPS_KEY`로 Maps Static API 활성화 가능 (별도 키 불필요) | §"Standard Stack", Pitfall 4 | Static Maps만 별도 키 필요 → `GOOGLE_STATIC_MAPS_KEY` env 신설 + GCP 콘솔에서 신규 키 생성. D-19와 일관성 위해 v1은 같은 키로 시작 권장이지만, GCP 정책상 strict하면 분리. **첫 plan 시 GCP 콘솔 확인 필수.** |
| A4 | iOS Safari + 카카오 in-app browser 모두 `gestureHandling: 'greedy'`로 한 손가락 panning 동작 | Pattern 6 (D-12) | 일부 in-app browser에서 page scroll과 충돌 — dogfooding에서 발견 시 `cooperative`로 fallback |
| A5 | OG image의 `<img src={mapUrl}>` Satori가 빌드 타임에 fetch 성공 (Google Static Maps가 CORS 또는 referrer로 막지 않음) | Pattern 3 | Satori 콘솔에 "failed to load image" — fallback 텍스트로 자동 처리 (D-07 lock) |
| A6 | Supabase Edge Function의 Deno runtime에서 `fetch()` fire-and-forget이 response 후에도 완료까지 실행됨 | Pattern 9 | Deno가 response 후 즉시 cleanup하면 webhook 미발사 — `EdgeRuntime.waitUntil(promise)` 패턴 필요 (Deno Deploy의 Cloudflare Workers 패턴). **첫 plan 시 Deno 문서 확인.** |
| A7 | Next.js 15 build가 `import 'node:crypto'`를 server-only로 인식하고 client bundle에서 제거 | Pattern 2 | 빌드 시 webpack warning — `runtime = 'nodejs'` 명시 + route handler 안에서만 사용으로 회피 |
| A8 | `metadataBase`를 `https://moajoa.app`으로 가정 — 실제 production 도메인 미확정 | Pattern 5 | env var `NEXT_PUBLIC_BASE_URL`로 분리 + dev/preview/prod에서 다른 값 설정 |

**A3, A6은 첫 plan에서 검증 필요 (blocking이 아닌 detail level).**

---

## Open Questions (RESOLVED)

CONTEXT.md `<open_questions>`의 3개 모두 본 research에서 결정:

| Question | RESOLVED Decision |
|----------|--------|
| `unstable_cache` vs `fetch({ next: { tags } })` | **`unstable_cache` (RPC는 fetch wrapper 아님)** — Pattern 1, line 1. |
| ImageResponse Pretendard 폰트 로딩 방식 | **`readFile(join(process.cwd(), 'public/fonts/...'))`** — UI-SPEC §"Open Items"의 self-fetch 권장은 본 research에서 정정. Pattern 3 line 11. |
| Static Maps URL signing 활성화 | **v1 미적용** (D-07 lock, A3 첫 plan 시 GCP 콘솔 검증). |
| `/api/revalidate` runtime | **`nodejs`** (`node:crypto.timingSafeEqual` 사용) — Pattern 2 line 4. |
| video_id 정규식 | **CONTEXT.md `<specifics>` 그대로 + edge case 테스트 (m.youtube.com, shorts는 v1 X)** — Pattern 7. |
| city_code → city_ko 매핑 위치 | **`packages/core/src/constants.ts`에 `CITY_KO_MAP` export 추가** — UI-SPEC §"Open Items" 일관. |
| Static Maps 키 분리 | **v1: 기존 `NEXT_PUBLIC_GOOGLE_MAPS_KEY` 재사용 + GCP 콘솔에서 Maps Static API enable** — A3 첫 plan 시 검증. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | Next.js 15 SSR, `node:crypto` | ✓ | engines.node >= 22 (root package.json) | — |
| pnpm 9+ | Workspace | ✓ | 9.12.0 (packageManager) | — |
| Next.js 15.x | App Router + APIs | ✓ | ^15.0.0 → 15.5.18 latest | — |
| Vercel deployment | Edge cache + ISR + OG image hosting | (Production env) | — | Self-host with `next start` (no Edge cache, page-level revalidate만) |
| Google Maps JS API key | Interactive map | ✓ | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (이미 dev env) | 미설정 시 PublicBoardMap이 "지도를 불러올 수 없어요" 표시 (UI-SPEC §6) |
| Google Static Maps API enabled | OG 미니맵 | ? | GCP 콘솔 확인 필요 (A3) | OG image의 우측 텍스트-only fallback "지도 미리보기 준비 중" (D-07) |
| Supabase Edge Function deployment | `extract-youtube` (기존) + webhook 호출 추가 | ✓ | 이미 배포됨 | — |
| `REVALIDATE_SECRET` env (32-byte random) | webhook 인증 (D-20) | ✗ | (신규 생성) | — |
| `WEB_BASE_URL` env in Supabase secrets | Edge Function → Web | ✗ | (production deploy 시 설정) | dev에선 unset → webhook skip (Pattern 9 if 조건) |
| `NEXT_PUBLIC_BASE_URL` env (web) | `metadataBase` 절대 URL | ✗ (lib/env.ts에 등록 신규) | (production deploy 시 설정) | dev에선 `http://localhost:3000`으로 hardcode 또는 process.env.VERCEL_URL 사용 |
| Pretendard `.otf` 폰트 | OG image fontset | ✓ | `apps/web/public/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.otf` 존재 | — |

**Missing dependencies with fallback:**
- Google Static Maps API enable (A3): OG image fallback이 자동 처리 — v1 첫 launch는 가능하지만 OG 미리보기가 텍스트-only.

**Missing dependencies blocking:**
- `REVALIDATE_SECRET`: webhook을 사용하려면 양쪽 env에 같은 값. 신규 plan task 필요.
- `NEXT_PUBLIC_BASE_URL` / `WEB_BASE_URL`: 절대 URL 변환 + Edge → Web 호출. 신규 plan task 필요.

---

## Validation Architecture

> Nyquist validation enabled in `.planning/config.json`. `apps/web`에는 현재 테스트 인프라 없음 — Wave 0에서 Vitest + RTL 도입.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (Vite-native, Next.js 15 + React 19 호환 표준) |
| Config file | `apps/web/vitest.config.ts` (Wave 0 신규) |
| Quick run command | `pnpm --filter @moajoa/web test -- --run <pattern>` |
| Full suite command | `pnpm --filter @moajoa/web test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEW-01 | `/b/[slug]` SSR 즉시 렌더 | manual-only (p90 TTFB < 800ms은 Vercel Analytics) | (Vercel Analytics 모니터링) | manual — Phase 6 dogfooding |
| VIEW-01 | `unstable_cache` cache key per slug | unit | `pnpm --filter @moajoa/web test -- --run cache-key.test` | ❌ Wave 0 |
| VIEW-02 | Mobile viewport 지도 핀치줌·핀 탭 | manual-only (실기기) | (Phase 6 dogfooding) | manual |
| VIEW-02 | `gestureHandling: 'greedy'` + `clickableIcons: false` options 적용됨 | unit (snapshot of init call args) | `pnpm --filter @moajoa/web test -- --run map-options.test` | ❌ Wave 0 |
| VIEW-03 | OG image generation 정상 동작 | integration (call default export, snapshot ImageResponse properties) | `pnpm --filter @moajoa/web test -- --run og-image.test` | ❌ Wave 0 |
| VIEW-03 | Static Maps URL 생성 (markers, size, scale) | unit | `pnpm --filter @moajoa/web test -- --run static-maps-url.test` | ❌ Wave 0 |
| VIEW-04 | `generateMetadata` description 템플릿 (city 있음/없음) | unit | `pnpm --filter @moajoa/web test -- --run metadata.test` | ❌ Wave 0 |
| VIEW-05 | YouTube URL 생성 (timestamp 있음/없음, 다양한 input 형식) | unit | `pnpm --filter @moajoa/web test -- --run youtube-id.test` | ❌ Wave 0 |
| VIEW-06 | `/api/revalidate` secret 검증 (valid/invalid/missing) | integration (route handler) | `pnpm --filter @moajoa/web test -- --run api-revalidate.test` | ❌ Wave 0 |
| VIEW-06 | `/api/revalidate` → `revalidateTag` 호출 (mock spy) | integration | (same) | ❌ Wave 0 |
| VIEW-06 | Edge Function fire-and-forget webhook 호출 | manual-only (Deno test infra 별도) | (Phase 6 e2e) | manual |

### Sampling Rate
- **Per task commit:** `pnpm --filter @moajoa/web test -- --run <pattern>` (변경된 파일과 관련된 spec만)
- **Per wave merge:** `pnpm --filter @moajoa/web test -- --run` (전체 web suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/vitest.config.ts` — Vitest config + jsdom env + `~`/`@/` path alias
- [ ] `apps/web/__tests__/setup.ts` — `@testing-library/jest-dom` matchers
- [ ] Framework install: `pnpm --filter @moajoa/web add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `apps/web/__tests__/youtube-id.test.ts` — covers VIEW-05 (Pattern 7 edge cases)
- [ ] `apps/web/__tests__/static-maps-url.test.ts` — covers VIEW-03 (URL params, marker count truncate)
- [ ] `apps/web/__tests__/metadata.test.ts` — covers VIEW-04 (city 있음/없음 description, twitter card)
- [ ] `apps/web/__tests__/api-revalidate.test.ts` — covers VIEW-06 (POST body validation, secret valid/invalid, revalidateTag spy)
- [ ] `apps/web/__tests__/cache-key.test.ts` — covers VIEW-01 (slug A의 cache가 slug B로 leak 안 됨 — mock unstable_cache)
- [ ] `apps/web/__tests__/map-options.test.ts` — covers VIEW-02 (PublicBoardMap render → snapshot map init options)
- [ ] `apps/web/__tests__/og-image.test.ts` — covers VIEW-03 (opengraph-image default export runs without throw, returns ImageResponse instance)

Mock 패턴:
- `next/cache`의 `revalidateTag`, `unstable_cache`는 vitest `vi.mock('next/cache')`로 spy/stub
- `@moajoa/api`의 `getPublicBoardBySlug`는 vitest mock 반환값 fixture (1 board, 12 places, city='tokyo')
- `node:fs/promises`의 `readFile`은 OG image 테스트에서 Buffer.from('fake-font-bytes')로 stub
- Google Maps JS는 jsdom 환경에서 `window.google.maps` 객체를 직접 mock — `g.Map`/`g.Marker` constructor만 stub하고 addListener는 spy

p95 LCP < 3s on mobile (VIEW-04 success criteria 3): out-of-scope for v1 automation — Lighthouse CI 별도 setup 필요 (v2). v1은 Vercel Analytics 또는 PageSpeed Insights 수동 측정으로 충분 (Phase 6 dogfooding 검증).

---

## Project Constraints (from CLAUDE.md)

다음은 본 phase 모든 plan과 task가 반드시 준수해야 할 CLAUDE.md 지침:

- **§2.7 Karpathy 4 — Surgical Changes**: 기존 `apps/web/app/b/[slug]/page.tsx`, `_components/public-board-map.tsx`, `layout.tsx`는 *최소한*만 수정. UI-SPEC의 reassignment audit (text-3xl → text-2xl 등)을 같은 PR에 넣지 말 것 — 별도 task로 분리.
- **§4.2 충돌 위험 영역**: `packages/core/constants.ts`에 `CITY_KO_MAP` 추가는 web + iOS 모두 import 가능. 둘 다 빌드 통과 확인.
- **§4.3 마이그레이션 규칙**: Phase 4는 신규 SQL 마이그레이션 **없음** (D-01 lock). 기존 0001~0005 수정 금지.
- **§4.4 인증·RLS**: `/api/revalidate`는 user JWT 사용 안 함 — secret으로 자체 인증. `getSupabaseServer()` 안 호출. `public_board_view` RPC는 `security definer`이므로 RLS bypass 정상.
- **§4.5 코드 스타일**: 워크스페이스 패키지 import 시 **`.js` extension 금지**. `import { CITY_KO_MAP } from '@moajoa/core'` (X: `'@moajoa/core/dist/constants.js'`).
- **§4.5 외부 입력 validation**: webhook body는 Zod로 validate (Pattern 2의 `BodySchema`).
- **§4.6 Git**: 커밋 메시지 `feat(04-NN): ...` (Conventional Commits + phase prefix).
- **§4.7 환경변수**: `REVALIDATE_SECRET`, `WEB_BASE_URL`, `NEXT_PUBLIC_BASE_URL`은 `.env.local.example`에 placeholder만, 실제 값은 1Password.
- **§5 절대 하지 말 것**:
  - ❌ 기존 마이그레이션 SQL 수정 (해당 없음)
  - ❌ 워크스페이스 import에 `.js` extension
  - ❌ Web에 *새로운* "보드 생성"/"링크 추가" UI 추가 — Phase 1.5에서 정리
  - ❌ RLS 정책에서 다른 테이블 직접 EXISTS — 해당 없음 (RPC가 SECURITY DEFINER)
  - ❌ 서비스 롤 키를 클라이언트 번들에 노출 — `REVALIDATE_SECRET`은 server-only env (NEXT_PUBLIC_ X)

---

## Sources

### Primary (HIGH confidence)
- [Next.js 15 — unstable_cache](https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache) — keyParts, tags, revalidate (verified 2026-05-26)
- [Next.js 15 — revalidateTag](https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag) — route handler example, stale semantics (verified 2026-05-26)
- [Next.js 15 — opengraph-image](https://nextjs.org/docs/15/app/api-reference/file-conventions/metadata/opengraph-image) — file convention, ImageResponse + readFile pattern, 8MB limit (verified 2026-05-26)
- [Next.js 15 — ImageResponse](https://nextjs.org/docs/15/app/api-reference/functions/image-response) — 500KB bundle limit, Satori CSS subset, ttf/otf/woff (verified 2026-05-26)
- [Next.js 15 — generateMetadata](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata) — full Metadata fields, twitter card, metadataBase, alternates (verified 2026-05-26)
- [Next.js 15 — generateViewport](https://nextjs.org/docs/15/app/api-reference/functions/generate-viewport) — Viewport type, maximumScale 접근성 (verified 2026-05-26)
- [Google Maps Static API — Get Started](https://developers.google.com/maps/documentation/maps-static/start) — URL syntax, marker syntax, 16384 char limit, signing (verified 2026-05-26)
- [Google Maps Platform Security Best Practices](https://developers.google.com/maps/api-security-best-practices) — referrer vs IP restriction, server-side vs browser exposure (verified 2026-05-26)
- 기존 코드베이스 직접 read:
  - `/Users/wcb/Documents/MOAJOA/supabase/migrations/0001_init.sql` (boards trigger + public_board_view RPC)
  - `/Users/wcb/Documents/MOAJOA/supabase/functions/extract-youtube/index.ts` (done broadcast 위치)
  - `/Users/wcb/Documents/MOAJOA/apps/web/app/b/[slug]/page.tsx`, `_components/public-board-map.tsx`
  - `/Users/wcb/Documents/MOAJOA/packages/api/src/queries/boards.ts` (getPublicBoardBySlug)
  - `/Users/wcb/Documents/MOAJOA/packages/core/src/constants.ts` (CITY_KO_MAP 추가 위치)

### Secondary (MEDIUM confidence)
- [DEV — Webhook Security in Next.js: Signatures, Idempotency, Avoiding Common Mistakes](https://dev.to/whoffagents/webhook-security-in-nextjs-signatures-idempotency-and-avoiding-common-mistakes-4g6) — timingSafeEqual 패턴
- [GitHub — advename/web-timing-safe-equal](https://github.com/advename/web-timing-safe-equal) — Edge runtime용 webcrypto 패턴 (v1은 Node runtime이라 미사용)
- [npm — next@15.5.18](https://www.npmjs.com/package/next) version verification (published 2026-05-07)
- [Sanity Learn — Path-based revalidation in Next.js](https://www.sanity.io/learn/course/controlling-cached-content-in-next-js/path-based-revalidation) — revalidate 패턴 일반

### Tertiary (LOW confidence — 운영 시 verify)
- [Bubble Forum — API keys with referer restrictions cannot be used with this API](https://forum.bubble.io/t/how-do-resolve-the-google-map-error-api-keys-with-referer-restrictions-cannot-be-used-with-this-api/48846) — Static Maps의 referrer 제한이 일부 사용 사례에서 실패 가능성 — A3와 일관

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js 15 stable APIs, all verified via official docs 2026-05-26
- Architecture: HIGH — 코드베이스 read + CONTEXT.md D-01~D-20 lock 일치 검증
- Pitfalls: MEDIUM-HIGH — Pitfall 1~5는 docs 또는 코드 read로 직접 확인, Pitfall 6~9는 패턴 추론 (Vercel/Supabase Edge runtime 동작)
- Test strategy: MEDIUM — Vitest 도입은 표준이지만 web 첫 도입이라 첫 plan 실제 setup 시 미세조정 가능
- Environment availability: MEDIUM — Google Static Maps enable 상태(A3), production base URL(A8)은 첫 plan 시 verify 필요

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (Next.js 15.x 안정 — 약 30일). 16.x stable 출시 시 재확인.

---

**Next:** `/gsd-plan-phase 4` — 본 RESEARCH.md + 04-CONTEXT.md + 04-UI-SPEC.md를 입력으로 planner가 04-NN-PLAN.md 시리즈 작성.
