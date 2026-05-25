# Phase 4: Public Board (Web) — Context

**Gathered:** 2026-05-26
**Mode:** smart-discuss (auto)
**Status:** Ready for planning

<domain>
## Phase Boundary

비로그인 사용자가 카톡으로 받은 `/b/[slug]` URL을 모바일 브라우저에서 즉시 열람하는 흐름(VIEW-01~06)을 완결한다:

1. **SSR + Edge cache** — p90 TTFB < 800ms, 두 번째 요청부터 cache hit
2. **모바일 viewport** — iPhone Safari에서 지도 핀치줌 + 핀 탭 + 가로 스크롤 없음
3. **OG image** — `/b/[slug]/opengraph-image` 동적 생성 (보드 제목 + 미니맵 + Pretendard 한글)
4. **SEO meta** — `<head>`에 title/description/og:*/twitter:* 완성
5. **타임스탬프 jump** — 핀 탭 → YouTube `?t=Xs` 새 탭 오픈
6. **Revalidate webhook** — Edge Function 추출 완료 → `/api/revalidate?slug=...` → 페이지 갱신

**Scope lock:**
- 파일 경계: `apps/web/**` 배타 (iOS·Edge Function 코드 변경 없음, Edge Function의 webhook POST 한 줄만 추가)
- Phase 4는 **열람 전용**. 회원 가입·보드 생성·링크 추가는 dev tool 게이트 뒤(Phase 1 D-WEB-01/02 lock)
- AI vs 수동 핀 시각 구분, low_confidence 음영, 진행 단계 progress bar는 **Phase 5 Trust UI**에서
- `/discover` 피드, 멤버 초대, 투표 UI는 v2

</domain>

<decisions>
## Implementation Decisions

### Slug & 라우팅 (VIEW-01)
- **D-01:** **기존 `boards.share_slug` 컬럼 + `public_board_view(p_slug)` RPC 그대로 사용.** 0001_init.sql에 이미 trigger로 8~12자 base64-derived slug 자동 생성 + RPC가 visibility='public'만 노출. 새 스키마 마이그레이션 없음. iOS가 보드 공유 시 visibility를 'public'으로 전환하면 trigger가 slug를 채움.
- **D-02:** **라우트 = `/b/[slug]` (이미 존재).** `/boards/[id]`는 dev tool 게이트 뒤로 격리(Phase 1 WEB-01/02). 외부 공유 URL은 항상 `/b/[slug]` 한 가지.

### SSR Cache 전략 (VIEW-01, VIEW-06)
- **D-03:** **Next.js 15 App Router `unstable_cache` + tag 기반 revalidation.** `getPublicBoardBySlug()` 호출을 `unstable_cache(fn, [slug], { tags: [\`board:${slug}\`], revalidate: 3600 })`로 wrap. fallback TTL 1시간(공유는 받지 못해도 stale-while-revalidate). webhook으로 명시적 invalidate.
- **D-04:** **Revalidate webhook = `POST /api/revalidate`**, body `{ slug, secret }`. Edge Function `extract-youtube`의 `done` broadcast 직후 fetch. secret은 `REVALIDATE_SECRET` env 양쪽 공유(Edge Function secrets + Vercel env). 미일치는 401. tag 무효화: `revalidateTag(\`board:${slug}\`)`.
- **D-05:** **Edge Function → webhook 호출은 fire-and-forget.** 실패해도 추출 자체는 성공으로 마감. 다음 사용자 방문 시 1시간 TTL이 만료되면 자연 갱신. 재시도·DLQ 없음(v1 sidearm).

### OG Image (VIEW-03)
- **D-06:** **`app/b/[slug]/opengraph-image.tsx` (Next.js 15 ImageResponse) + Edge runtime.** 1200×630, 좌측 보드 제목 + 도시 + 핀 수, 우측 Static Maps API 미니맵 PNG fetch 후 임베드. Pretendard 한글은 `next/og` ArrayBuffer로 폰트 등록.
- **D-07:** **미니맵 = Google Static Maps API.** 핀 좌표를 zoom auto-fit으로 marker 표시 (max 10개, 초과 시 첫 10개). URL signing은 v1 미적용(쿼터 모니터링으로 충분). 호출 실패·키 미설정 시 미니맵 없이 텍스트-only fallback ImageResponse 반환.
- **D-08:** **OG 캐싱은 Next.js 기본값(`revalidate: false`).** OG는 보드 내용이 바뀌어도 카톡 캐시가 우선. v1은 의도적으로 board update 시 OG 재생성 안 함 — `revalidateTag`가 페이지만 무효화하고 OG는 그대로(URL이 같으므로 Kakao/Slack scraper도 stale 그대로). 보드 제목 변경이 즉시 미리보기 반영되는 건 v2.

### SEO Meta (VIEW-04)
- **D-09:** **`generateMetadata()` 확장으로 충분.** 기존 page.tsx에 이미 title/og:title/og:description 있음. 추가:
  - `description` = "{owner}님의 {city} 여행 · 핀 N개" (city_code는 정적 매핑 테이블 ko-KR, 없으면 omit)
  - `openGraph.images` = `/b/{slug}/opengraph-image` 절대 URL
  - `twitter` block (`card: 'summary_large_image'`, `title`, `description`, `images`)
  - `alternates.canonical` = `${BASE_URL}/b/{slug}`
  - `robots` = `{ index: true, follow: true }` (공개 보드는 검색 허용)
- **D-10:** **sitemap.ts·robots.ts는 v1 범위 아님.** 공개 보드 인덱싱은 자연 발견(공유 → 크롤러)로 충분. `/discover` 피드(v2)와 함께 sitemap 도입.

### 모바일 반응형 (VIEW-02)
- **D-11:** **모바일 우선(mobile-first), `md` breakpoint 1단계만.** Tailwind 기본값 사용:
  - 기본(< 768px): 지도 height `h-[60vh]`, 단일 컬럼, 패딩 `px-4`
  - `md` 이상: 지도 `h-[520px]`, max-w-5xl 중앙 정렬, `px-6`
- **D-12:** **지도 = 기존 Google Maps JS API 유지 (PublicBoardMap 컴포넌트).** Mapbox·Leaflet 대안 도입 안 함. `disableDefaultUI: true` + `zoomControl: true`로 모바일 정돈. 핀치줌은 `gestureHandling: 'greedy'` 추가 권장(researcher 확인).
- **D-13:** **viewport meta = Next.js 15 `viewport` export로 `width=device-width, initialScale=1, maximumScale=5`.** maximum-scale=1로 잠그지 않음(접근성).

### 타임스탬프 jump (VIEW-05)
- **D-14:** **핀 탭 → YouTube 새 탭 (`window.open(url, '_blank', 'noopener')`).** in-app iframe player 도입 안 함:
  1. YouTube iframe은 모바일 카톡 in-app browser에서 제한 많음(autoplay/inline 정책)
  2. 정확한 timestamp jump는 native YouTube 앱이 가장 안정적 (deeplink가 자동으로 앱 → 웹 fallback)
  3. v1은 "장소 확인" 용도이지 영상 재생 용도가 아님
- **D-15:** **URL 형식 = `https://www.youtube.com/watch?v={video_id}&t={source_timestamp_sec}s`.** `link.url`에서 video_id 추출 helper 신규(`packages/api/src/queries/links.ts` 또는 web 로컬). source_timestamp_sec null이면 `?t=` 생략.
- **D-16:** **핀 → 영상 매핑은 `places.link_id` FK 사용.** 이미 RPC가 link_id 반환 중. 클라이언트에서 `places.find(...).link_id` → `links[link_id].url` lookup.

### 비로그인 readonly (PROJECT lock)
- **D-17:** **로그인 CTA 없음 in /b/[slug].** v1은 acquisition surface가 아니라 "친구 보여주기" 용도. 로그인 유도는 dogfooding 게이트(Phase 6) 이후 v2 결정. 푸터에 작은 "MOAJOA로 만들었어요" 텍스트 링크(`/`)만.
- **D-18:** **공개 보드 = 영구 readonly (anon).** Edit/comment/vote 모두 v1 X. 카카오 in-app 브라우저 fingerprint도 추적 안 함.

### Rate limit / abuse
- **D-19:** **v1은 명시적 rate limit 없음.** `public_board_view` RPC가 RLS bypass이지만 anon 키로만 호출 가능 + slug가 unguessable(8자 base64) → enumeration 비용 충분히 높음. Vercel 기본 protection + Supabase free tier limits로 충분. 대응은 Phase 6 dogfooding에서 실측 후.

### Webhook 인증 (VIEW-06)
- **D-20:** **`REVALIDATE_SECRET` env (32 byte 랜덤).** Edge Function이 POST body에 secret 포함, web `/api/revalidate` route handler가 timing-safe 비교. 누출 시 secret rotation(env 갱신 + Edge Function deploy)만 하면 됨. JWT 등 과한 인증 없음.

### Claude's Discretion (researcher/planner가 정함)
- `unstable_cache` vs `fetch({ next: { tags } })` 정확한 패턴 선택 (Next.js 15 stable API 기준)
- ImageResponse Pretendard 폰트 로딩 방식 (public/fonts에서 fetch vs base64 inline)
- Static Maps URL signing 활성화 여부 (쿼터 노출 vs 복잡도)
- 미니맵 marker 클러스터링 (10개 초과 시 cluster icon)
- city_code → 한글 도시명 매핑 테이블 위치 (`packages/core/constants.ts` 확장)
- `/api/revalidate` route segment config (`export const runtime = 'edge'` vs node)
- video_id 추출 정규식 (youtube.com/watch · youtu.be · embed 모두 처리)

</decisions>

<deferred_ideas>
## Deferred Ideas (out of Phase 4 scope)

- **회원 가입·로그인 CTA in /b/[slug]:** acquisition surface는 v2 결정. dogfooding 게이트 통과 후.
- **`/discover` 공개 보드 피드 (VIEW-07):** v2.
- **sitemap.xml · robots.txt 정형화:** `/discover`와 짝지어 v2.
- **OG 미리보기 즉시 갱신 (보드 제목 변경 시):** v2. 카카오/Slack scraper 캐시 정책상 noop에 가까움.
- **in-app 영상 player (iframe):** D-14 lock. v2에서 별도 phase.
- **공유 보드 멤버 초대·❤️ 투표 UI (COLLAB-01/02):** v2.
- **다국어 (ja-JP, en-US):** I18N-01 v2. 현재 ko-KR 단일.
- **다크 모드 (THEME-01):** v2.
- **Sentry / 에러 트래킹 (OBS-01):** v2. Phase 1 D-15와 일관.
- **Rate limit / DDoS 대응:** Phase 6 dogfooding 실측 후 결정.
- **OG image marker clustering · 다양한 zoom 휴리스틱:** v2 polish.
- **AMP · 페이지 속도 micro-opt:** v1 mobile Lighthouse 80+ 정도면 합격.

</deferred_ideas>

<specifics>
## Specific Ideas

- **`generateMetadata()`의 description 템플릿:**
  - city_code 있음 → `"{owner_display_name}님의 {city_ko} 여행 · 핀 {N}개 · MOAJOA"`
  - city_code 없음 → `"{owner_display_name}님의 여행 보드 · 핀 {N}개 · MOAJOA"`
- **OG image 레이아웃 가이드 (1200×630):**
  - 좌측 600×630: 흰 배경, 보드 제목(48px bold, 2줄까지), 도시(24px medium gray), 핀 수(20px), 워드마크
  - 우측 600×630: Static Maps PNG (스타일 styled map id로 정돈 — 회색 톤 권장)
  - 폰트: Pretendard SemiBold + Regular ArrayBuffer 등록
- **revalidate route:** `app/api/revalidate/route.ts`. body 파싱 후 secret 검증 → `revalidateTag(\`board:${slug}\`)` → `Response.json({ revalidated: true, slug })`. POST 외 405.
- **Edge Function의 webhook 호출:** `extract-youtube/index.ts`의 done broadcast 직후. `await fetch(WEB_BASE_URL + '/api/revalidate', { method: 'POST', body: JSON.stringify({ slug, secret }) }).catch(noop)`. board의 slug는 link의 board_id로 lookup(이미 admin client 있음).
- **video_id 추출 helper:**
  ```ts
  // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  ```
- **모바일 viewport 추가:** `app/layout.tsx`에 `export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5 }`.
- **gestureHandling:** PublicBoardMap의 `g.Map(...)` options에 `gestureHandling: 'greedy'` 추가하여 모바일 한 손가락 스크롤이 지도 panning이 되도록.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (필수)
- `CLAUDE.md` — Karpathy 4 원칙, NO `.js` extension §4.5, RLS SECURITY DEFINER 패턴, web 역할 분리 (열람 only)
- `.planning/PROJECT.md` — Core Value, Out of Scope, "Web 역할 분리" Key Decision
- `.planning/REQUIREMENTS.md` §"Public Board Viewing (VIEW)" — VIEW-01~06 falsifiable acceptance criteria
- `.planning/ROADMAP.md` §"Phase 4: Public Board (Web)" — phase goal + 6 success criteria + Phase 2 dependency
- `docs/WORKSTREAMS.md` §"Web" — 파일 경계 `apps/web/**` 배타

### Prior phase decisions (lock 유지)
- `.planning/phases/01-build-unblock-hygiene/01-CONTEXT.md` — D-WEB-01/02 (NEXT_PUBLIC_ENABLE_DEV_TOOLS 게이트), Pretendard local font 결정
- `.planning/phases/01-build-unblock-hygiene/01-03-PLAN.md` — `lib/env.ts` 패턴, dev-tool 이중 게이트
- `.planning/phases/02-extraction-pipeline-hardening/02-CONTEXT.md` — D-01/02 (broadcast 5단계 채널 — done 단계에 places_extracted 수 포함), D-12 (Places API FieldMask 명시 — Static Maps와 별개지만 동일 GCP project 비용 고려)
- `.planning/phases/03-ios-save-flow/03-CONTEXT.md` — D-01 (Share Extension 1탭 저장 패턴 — 공유 URL이 `/b/[slug]` 인입 경로)

### Schema + types (구현 시 import)
- `supabase/migrations/0001_init.sql` lines 100~141 — `boards.share_slug` + `ensure_share_slug` trigger
- `supabase/migrations/0001_init.sql` lines 487~551 — `public_board_view(p_slug)` RPC (jsonb 반환 구조)
- `packages/api/src/queries/boards.ts` — `getPublicBoardBySlug(client, slug)` helper (이미 존재)
- `packages/api/src/types/database.ts` — 생성된 TypeScript 타입 (RPC return type)
- `packages/core/src/schemas/*.ts` — `PublicBoardView` Zod schema (이미 정의)

### Web scaffold (수정 시작점)
- `apps/web/app/b/[slug]/page.tsx` — SSR 페이지 (이미 존재 — generateMetadata 확장 + cache wrap)
- `apps/web/app/b/[slug]/_components/public-board-map.tsx` — Google Maps client component (gestureHandling + pin onClick 추가)
- `apps/web/app/layout.tsx` — viewport export 추가 위치
- `apps/web/next.config.ts` — transpilePackages 이미 설정됨, 추가 변경 거의 없음
- `apps/web/lib/env.ts` — REVALIDATE_SECRET, GOOGLE_STATIC_MAPS_KEY env 등록 위치
- `apps/web/lib/supabase/server.ts` — anon SSR client (이미 존재)

### Edge Function (작은 수정만)
- `supabase/functions/extract-youtube/index.ts` — done broadcast 직후 webhook POST 추가 위치 (라인 끝부분)
- `supabase/functions/extract-youtube/lib/env.ts` (또는 동등) — WEB_BASE_URL, REVALIDATE_SECRET 읽기 추가

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getPublicBoardBySlug()` 이미 동작 (`packages/api/src/queries/boards.ts:64`) — `unstable_cache`로 wrap만 하면 됨
- `public_board_view` RPC가 board + owner + links + places(좌표·source_timestamp_sec 포함) 한 방에 반환 — 추가 SQL 불필요
- `apps/web/app/b/[slug]/page.tsx` 이미 generateMetadata 골격 + 보드 헤더 + 영상 목록 렌더 — 확장만
- `PublicBoardMap` 이미 Google Maps JS API 로드 + 마커 렌더 — onClick handler + gestureHandling 추가
- `apps/web/app/layout.tsx` Pretendard variable 이미 활성 — OG image의 폰트 로딩에도 같은 .otf 파일 재사용 가능
- Phase 2의 broadcast done 단계 — Edge Function에 webhook POST 코드 1줄 삽입할 자연스러운 위치
- `boards.share_slug` trigger 자동 채움 — Phase 4가 slug 발급 로직 작성 안 함

### Established Patterns
- Web SSR은 anon client만 사용 (`lib/supabase/server.ts`)
- `lib/env.ts` 패턴으로 env 변수 일괄 validate (Phase 1 D-WEB-03)
- Next.js 15 `generateMetadata` async — params Promise unwrap 필요
- `transpilePackages: ['@moajoa/core', '@moajoa/api', '@moajoa/ui-tokens']` — 워크스페이스 import 시 `.js` extension 금지
- `places.source_timestamp_sec` 컬럼이 정답(Phase 2 D-07 lock) — `video_offset_sec`로 rename 금지

### Known Pitfalls (재발 방지)
- **Next.js 15 caching default가 변경됨:** App Router default가 dynamic으로 바뀌어서 명시적 `unstable_cache` 또는 `cache: 'force-cache'` 없으면 매 요청 SSR. p90 TTFB < 800ms 못 맞춤. D-03 lock.
- **`next/og` Edge runtime ko 폰트:** 기본 system fallback이 한글 깨짐. `<font>` ArrayBuffer 등록 누락 시 Pretendard 미적용 → 영문/숫자만 보임.
- **Static Maps quota:** Google Maps API 와 동일 GCP project. Phase 2 D-13의 $5/$20/$50 billing alert에 같이 잡힘. 와일드카드는 Static Maps에 해당 없지만 OG가 카카오 scraper의 반복 호출에 노출되면 비용 폭주 가능 → D-08처럼 OG 자체는 long-cache 처리.
- **카카오 in-app browser viewport:** iOS Safari와 다르게 `100vh`가 toolbar 포함 높이로 측정됨. `h-[60vh]` 또는 `h-[420px]` 절대값 권장. D-11.
- **`revalidateTag` import path:** Next.js 15에서 `next/cache`. server-only 함수 — `'use client'` 컴포넌트에서 호출 금지.
- **Edge Function fetch → web:** Vercel preview/production 둘 다 다른 URL. `WEB_BASE_URL` env로 분기. dev에서는 localhost ngrok 또는 webhook 비활성(env unset 시 skip).
- **Google Maps JS API 로딩 중복:** PublicBoardMap이 script tag을 직접 추가. 같은 페이지 두 번 mount되면 중복 로드. 현 코드는 `data-moajoa-gmaps` flag로 방어 — 패턴 유지.

</code_context>

<open_questions>
## Open Questions (RESOLVED)

모든 grey area는 D-01~D-20으로 lock됨. 다음 항목은 plan 단계에서 researcher의 1차 확인 사항이지만 blocking 아님:

- Next.js 15 `unstable_cache` vs `fetch({ next })` 정확한 stable API 선택 — 두 패턴 모두 D-03 의도 충족 가능, researcher가 docs 확인 후 결정
- Google Static Maps API key는 기존 `NEXT_PUBLIC_GOOGLE_MAPS_KEY`와 동일 키 재사용 가능 여부 (HTTP referer 제한 vs server-side IP 제한) — 별도 키 필요 시 첫 plan에서 env 추가
- ImageResponse Pretendard 폰트 fetch URL (Vercel deploy 환경에서 자기 자신 fetch — `${origin}/fonts/...` 안정성) vs 빌드 시점 `import font from '...'` ArrayBuffer

위 3개는 plan-checker가 blocking으로 잡지 않음 — 모두 실행 단계 detail.

---

**Next:** `/gsd-plan-phase 4` — researcher가 위 결정에 기반해 RESEARCH.md, planner가 PLAN.md 작성.

</open_questions>
