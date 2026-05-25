# Phase 4 — Validation Architecture

**Created:** 2026-05-26
**Source:** 04-RESEARCH.md §"Validation Architecture" + 04-CONTEXT.md D-03/D-04/D-06/D-09/D-15/D-20

본 phase는 `apps/web`에 **테스트 인프라가 없는 상태**에서 시작한다. Wave 0(04-01-PLAN)에서 Vitest + RTL을 도입하고, 그 이후 wave가 같은 인프라 위에서 unit/integration test를 작성한다.

Phase 6 dogfooding은 실기기/실브라우저 UAT — Phase 4 범위에서는 manual checklist만 정의.

---

## Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (Vite-native, Next.js 15 + React 19 호환) |
| DOM env | `jsdom` (PublicBoardMap snapshot용) |
| Config file | `apps/web/vitest.config.ts` |
| Setup file | `apps/web/__tests__/setup.ts` (`@testing-library/jest-dom` matchers) |
| Quick run | `pnpm --filter @moajoa/web test -- --run <pattern>` |
| Full suite | `pnpm --filter @moajoa/web test -- --run` |
| Coverage | `pnpm --filter @moajoa/web test -- --run --coverage` (선택) |

**Install command (Wave 0):**
```bash
pnpm --filter @moajoa/web add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

---

## Requirements → Tests Map

| Req ID | Behavior | Test Type | File | Plan |
|--------|----------|-----------|------|------|
| VIEW-01 | `/b/[slug]` SSR p90 TTFB < 800ms | manual (Vercel Analytics) | (Phase 6 dogfooding) | — |
| VIEW-01 | `unstable_cache` key per slug — slug A의 cache가 slug B로 leak 안 됨 | unit | `apps/web/__tests__/cache-key.test.ts` | 04-02 |
| VIEW-02 | Mobile viewport 핀치줌 동작 | manual (실기기) | (Phase 6) | — |
| VIEW-02 | `gestureHandling: 'greedy'` + `clickableIcons: false` 적용 | unit (snapshot init args) | `apps/web/__tests__/map-options.test.ts` | 04-03 |
| VIEW-03 | OG image default export 정상 동작 (throw 없음, ImageResponse 반환) | integration | `apps/web/__tests__/og-image.test.ts` | 04-04 |
| VIEW-03 | Static Maps URL 생성 (markers, size, scale, max 10 truncate, brand color) | unit | `apps/web/__tests__/static-maps-url.test.ts` | 04-04 |
| VIEW-04 | `generateMetadata` description 템플릿 (city 있음/없음) | unit | `apps/web/__tests__/metadata.test.ts` | 04-03 |
| VIEW-04 | `twitter.card === 'summary_large_image'`, `alternates.canonical`, `robots.index=true` | unit | (same) | 04-03 |
| VIEW-05 | `extractYouTubeVideoId` (youtube.com/watch, youtu.be, embed) | unit | `apps/web/__tests__/youtube-id.test.ts` | 04-01 |
| VIEW-05 | `buildYouTubeWatchUrl` (timestamp 있음/없음/0) | unit | (same) | 04-01 |
| VIEW-06 | `/api/revalidate` POST body validation (zod) | integration | `apps/web/__tests__/api-revalidate.test.ts` | 04-02 |
| VIEW-06 | `/api/revalidate` secret 검증 (valid → 200, invalid → 401, length mismatch → 401) | integration | (same) | 04-02 |
| VIEW-06 | `/api/revalidate` → `revalidateTag` 호출 (mock spy) | integration | (same) | 04-02 |
| VIEW-06 | `/api/revalidate` GET → 405 | integration | (same) | 04-02 |
| VIEW-06 | Edge Function fire-and-forget webhook 실제 호출 | manual (Deno test 별도) | (Phase 6 e2e) | — |

---

## Mock Patterns

**`next/cache`:**
```ts
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn), // identity for unit tests
}));
```

**`@moajoa/api`:**
```ts
vi.mock('@moajoa/api', () => ({
  getPublicBoardBySlug: vi.fn().mockResolvedValue({
    board: { title: '도쿄 라멘 투어', city_code: 'tokyo', description: null, cover_image_url: null },
    owner_display_name: '테스트',
    places: [{ lat: 35.68, lng: 139.69, link_id: 'L1', source_timestamp_sec: 120 }],
    links: [{ id: 'L1', url: 'https://www.youtube.com/watch?v=ABC123_def-1', title: '라멘', author_name: '채널' }],
  }),
}));
```

**`node:fs/promises`** (OG image test):
```ts
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-font-bytes')),
}));
```

**Google Maps JS** (map-options test):
```ts
const mapCtor = vi.fn();
const markerCtor = vi.fn();
(window as any).google = {
  maps: {
    Map: mapCtor,
    Marker: vi.fn(() => ({ addListener: vi.fn() })),
  },
};
```

---

## Sampling Rate

- **Per task commit:** 변경된 파일과 관련된 spec만 (`pnpm --filter @moajoa/web test -- --run <pattern>`)
- **Per wave merge:** 전체 web suite (`pnpm --filter @moajoa/web test -- --run`)
- **Phase gate (verify-work):** Full suite green + manual UAT checklist 통과

---

## Manual UAT Checklist (Phase 6 dogfooding 또는 end-of-phase batch)

`/b/{slug}` 모바일 실측 시나리오:

1. **SSR + cold load** — production URL을 incognito mobile Safari에서 열기. p90 TTFB < 800ms 확인 (Network tab).
2. **반복 방문 cache** — 같은 URL을 두 번째 열 때 RPC 호출 없는지 (Vercel Analytics 또는 Supabase metrics).
3. **모바일 viewport** — iPhone Safari에서 가로 스크롤 없음, 핀치줌 동작, 핀 탭 → YouTube 새 탭 (앱 deeplink 우선).
4. **카톡 미리보기** — production URL을 카카오톡 채팅창에 붙여넣어 OG 카드 노출 (보드 제목 + 미니맵 + 핀 수). 미니맵 회색톤·핀 brand 색 확인.
5. **SEO 검증** — `view-source:` 또는 Lighthouse SEO 100점. `<head>`에 og:image, twitter:card, alternates.canonical 모두 존재.
6. **타임스탬프 jump** — 핀 탭 → `?t=Xs` 새 탭 (YouTube 앱 deeplink가 정확한 시점으로 이동).
7. **Revalidate webhook** — iOS에서 새 링크 추가 → 추출 완료 broadcast → 친구 mobile Safari에서 페이지 reload 시 새 핀 보임 (1시간 미만에).

각 시나리오는 docs/manual-uat-phase4.md 로 별도 기록 (Phase 6 단계에서 실행).

---

## Out-of-Scope Validation

- **Lighthouse CI** (mobile LCP < 3s, SEO 100점) — v2 (CI-01과 함께)
- **Playwright E2E** — v2 (testing infra가 web에 처음 도입되는 상황이라 v1은 Vitest로 충분)
- **Visual regression (OG image PNG diff)** — v2
- **Load test (Vercel Edge cache hit ratio 자동 측정)** — Phase 6 dogfooding metric 수집으로 충분
