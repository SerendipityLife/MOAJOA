# Phase 4: Public Board (Web) — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 5 / 8 (3 files are net-new patterns the codebase has never used — `unstable_cache`, route handler, `next/og`, Edge Function `fetch` out)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/app/b/[slug]/page.tsx` (MODIFY) | server component (SSR page + generateMetadata) | request-response, cached read | self (already exists — extend in place) | exact (same file) |
| `apps/web/app/b/[slug]/opengraph-image.tsx` (NEW) | route (file-convention OG image, Node runtime) | request-response → PNG transform | `apps/web/app/b/[slug]/page.tsx` (closest: same params signature, same RPC call) | role-partial (no `next/og` in repo) |
| `apps/web/app/api/revalidate/route.ts` (NEW) | route handler (POST webhook) | request-response, side-effect (cache invalidate) | `supabase/functions/extract-youtube/index.ts` (only request-validating handler in repo — Deno, not Next; transferable structure) | role-partial (no Next.js route handler exists yet) |
| `apps/web/app/b/[slug]/_components/public-board-map.tsx` (MODIFY) | component (client, Google Maps JS) | event-driven (marker click → window.open) | self (already exists — extend options + add click listener) | exact (same file) |
| `apps/web/app/b/[slug]/_components/pin-list.tsx` (NEW, optional — UI-SPEC keeps list inline in page.tsx) | component (server, list render) | request-response (props only) | `apps/web/app/b/[slug]/page.tsx` lines 52-74 (existing inline list to be extracted or kept inline) | exact-inline (UI-SPEC §1 keeps as inline section, no separate component needed) |
| `apps/web/lib/cache.ts` (NEW) | utility (cache key + tag builder) | transform (string→string) | `packages/core/src/constants.ts` `extractChannelName(linkId)` line 137-139 (pattern: namespace prefix + id) | role-match |
| `apps/web/lib/og/static-maps.ts` (NEW) | utility (URL builder) | transform (params → URL) | none in repo (closest by spirit: `packages/api/src/queries/links.ts` `detectSourceKind`) | role-no-match |
| `apps/web/lib/og/pretendard.ts` (NEW) | utility (font loader, memoized) | file-I/O (readFile once, cache) | `apps/web/app/layout.tsx` lines 5-14 (`next/font/local` — different API but same fonts) | role-partial |
| `apps/web/lib/youtube.ts` (NEW) | utility (video_id regex + URL builder) | transform (string → string \| null) | `packages/core/src/schemas/link.ts` `detectSourceKind` (regex-based URL classifier) | role-match |
| `apps/web/lib/env.ts` (MODIFY) | config (env getters) | transform (env → typed value) | self lines 1-12 (`isDevToolsEnabled`) | exact (same file) |
| `apps/web/app/layout.tsx` (MODIFY) | layout (root + viewport + metadataBase) | request-response (static config) | self lines 16-24 (existing root `metadata` export) | exact (same file) |
| `apps/web/app/b/[slug]/not-found.tsx` (NEW) | server component (404 page) | request-response (static render) | `apps/web/app/auth/callback/page.tsx` lines 64-83 (centered error UI shape) | role-match |
| `apps/web/app/b/[slug]/error.tsx` (NEW, `'use client'`) | component (error boundary) | event-driven (React error → render) | `apps/web/app/auth/callback/page.tsx` (closest `'use client'` error UI in repo) | role-partial |
| `supabase/functions/extract-youtube/index.ts` (MODIFY) | service (Deno Edge Function) | request-response + side-effect (post webhook) | self lines 220-242 (existing `broadcastStep` pattern — add `fireRevalidate` next to it) | exact (same file) |
| `packages/core/src/constants.ts` (MODIFY) | config (domain constants) | transform (lookup) | self lines 25-50 (existing `as const` arrays + types) | exact (same file) |

---

## Pattern Assignments

### `apps/web/app/b/[slug]/page.tsx` (MODIFY — server component, cached request-response)

**Analog:** self (extend) — already implements `generateMetadata` + RPC fetch. Phase 4 wraps the RPC with `unstable_cache` and extends metadata per D-09.

**Existing skeleton to extend** (lines 1-32):
```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { PublicBoardMap } from './_components/public-board-map';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const view = await getPublicBoardBySlug(supabase, slug);
  if (!view) return { title: 'MOAJOA' };
  // ... metadata ...
}

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();
  const view = await getPublicBoardBySlug(supabase, slug);
  if (!view) notFound();
  // ... render ...
}
```

**Pattern to apply (from RESEARCH.md §"Pattern 1" + lib/cache.ts):**
- Replace bare `await getPublicBoardBySlug(...)` with the shared cached fetcher `getCachedPublicBoard(slug)` from `lib/cache.ts` — call site is identical in both `generateMetadata` and `PublicBoardPage` so Next request dedupe + tag cache both kick in.
- `params` is already `Promise<{ slug }>` (Next 15) — keep `await params` pattern.
- `notFound()` import from `next/navigation` already in place.

**Auth pattern (existing line 13, line 30):** anon SSR client only — `getSupabaseServer()`. No bearer token, no `auth.uid()` check. Public RPC bypasses RLS via `SECURITY DEFINER` (per migration 0001 lines 487-551). **Keep as-is.**

**Typography reassignments to apply (UI-SPEC §Typography reassignment audit):**
- Line 37: `text-xs uppercase tracking-wide text-neutral-500 mb-1` → `text-sm text-neutral-500 mb-1`
- Line 40: `text-3xl font-semibold` → `text-2xl font-semibold text-neutral-900 leading-tight`
- Line 42: `text-neutral-600 mt-2` → `text-base text-neutral-600 mt-2`
- Line 49: `text-sm font-medium text-neutral-700 mb-3` → `text-lg font-semibold text-neutral-900 mb-3`
- Line 50: copy `"영상 출처 ({view.links.length})"` → `"영상 출처 {N}개"` (UI-SPEC Copywriting Contract)
- Line 54: `p-3 border border-neutral-200 rounded-lg` → `block p-3 border border-neutral-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-colors`
- Line 65: `text-sm font-medium truncate` → `text-base font-semibold text-neutral-900 line-clamp-2`
- Line 67: `text-xs text-neutral-500 mt-1` → `text-sm text-neutral-500 mt-1`
- Line 35: `min-h-screen px-6 py-8 max-w-5xl mx-auto` → `min-h-screen bg-white px-4 md:px-6 py-6 md:py-8 max-w-5xl mx-auto`
- Add meta row after title: `<p className="text-sm text-neutral-600 mt-2">{cityKo ? `${cityKo} · 핀 ${pinCount}개` : `핀 ${pinCount}개`}</p>`
- Add footer (UI-SPEC §1 Footer row): `<footer className="mt-12 py-8 border-t border-neutral-200 text-center">…</footer>`

**`PublicBoardMap` props signature change:** add `links` prop (pin→video lookup needs `link.url`). New invocation: `<PublicBoardMap places={view.places} links={view.links} />`.

**Empty state:** if `view.places.length === 0`, render the empty-state block (UI-SPEC §4) instead of the map.

---

### `apps/web/app/b/[slug]/opengraph-image.tsx` (NEW — route file-convention)

**Analog:** `apps/web/app/b/[slug]/page.tsx` (only file in repo that takes `params: Promise<{ slug }>` and calls `getPublicBoardBySlug`). No prior `next/og` usage anywhere — pattern comes from RESEARCH.md §"Pattern 3".

**Imports (mirror page.tsx + add next/og + node:fs):**
```typescript
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { buildStaticMapsUrl } from '@/lib/og/static-maps';
import { loadPretendardFonts } from '@/lib/og/pretendard';
import { CITY_KO_MAP } from '@moajoa/core';
```

**File-convention exports (from RESEARCH.md lines 416-419):**
```typescript
export const alt = 'MOAJOA 공유 보드';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// runtime: default 'nodejs' (D-06's 'edge runtime' phrasing is reconciled to Node in RESEARCH §"Pattern 3" — Node is more stable for readFile + node:crypto consistency)
```

**Core pattern — fetch view + render ImageResponse** (RESEARCH lines 421-527 verbatim is the planner's source). Key decisions locked:
- Fonts via `readFile(join(process.cwd(), 'public/fonts/Pretendard-{Regular,SemiBold}.otf'))` — NOT self-fetch. RESEARCH explicitly overrides UI-SPEC §"Open Items" self-fetch hint.
- Fallback: `view == null` → return `FallbackCard` ImageResponse with same font registration (RESEARCH lines 433-444).
- Static Maps URL via `buildStaticMapsUrl({ places: view.places.slice(0, 10), size: { width: 600, height: 630 }, scale: 2, apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY! })` — fall back to text-only right panel if `view.places.length === 0`.
- D-08 lock: do NOT set `revalidate: <number>`. Either omit (Next will treat as dynamic given async params + RPC) or `export const revalidate = false`.

**Layout (from UI-SPEC §"OG Image typography" + RESEARCH lines 459-526):**
- 600px left text panel (`padding: 64`) with title 48/600, optional cityKo 28/400 neutral-600, pinCount 24/400, wordmark 24/600 brand-500
- 600px right panel (`background: #F8FAFC`) with `<img src={mapUrl} width={600} height={630} style={{ objectFit: 'cover' }} alt="" />` or fallback text

**No `'use client'`.** Server-only by file convention.

---

### `apps/web/app/api/revalidate/route.ts` (NEW — Node route handler)

**Analog:** `supabase/functions/extract-youtube/index.ts` lines 41-72 (only request-validating handler in repo). It is Deno, but the **structure** is transferable:
1. method check → 405
2. parse JSON body → 400 on throw
3. Zod validate → 400 on failure
4. env check → 500 if misconfigured
5. auth check → 401
6. do the work → 200

**Existing structure to mirror (extract-youtube/index.ts lines 42-67):**
```typescript
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  }
  // env check
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl /* ... */) {
    return jsonError(500, 'server misconfigured');
  }
  // auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'unauthorized');
  }
  // body parse + zod
  let body: unknown;
  try { body = await req.json(); } catch { return jsonError(400, 'invalid json body'); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid body: ' + parsed.error.message);
  // ...
});
```

**Translated to Next.js Node route handler (from RESEARCH.md §"Pattern 2" lines 336-389):**
```typescript
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs'; // node:crypto needs Node, not Edge

const BodySchema = z.object({
  slug: z.string().min(8).max(32),
  secret: z.string().min(16),
});

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: 'invalid json' }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: 'invalid body' }, { status: 400 });

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'misconfigured' }, { status: 500 });
  if (!safeEqual(parsed.data.secret, secret)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag(`board:${parsed.data.slug}`);
  return Response.json({ ok: true, slug: parsed.data.slug });
}

export async function GET() {
  return Response.json({ ok: false, error: 'method not allowed' }, { status: 405 });
}
```

**Differences from Deno analog:**
- Auth check is **not** `Authorization: Bearer` — it's body-embedded `secret` with timing-safe compare (D-20 lock).
- `Response.json(...)` (Next 15 standard) instead of `new Response(JSON.stringify(...))`.
- `runtime = 'nodejs'` segment config so `node:crypto.timingSafeEqual` is available (Edge runtime only has WebCrypto).
- Zod schema is local to the file (no shared schema needed for v1).

---

### `apps/web/app/b/[slug]/_components/public-board-map.tsx` (MODIFY — client component, event-driven)

**Analog:** self (lines 1-66). Already loads Google Maps JS with `data-moajoa-gmaps` flag (idempotent). Phase 4 changes are surgical:

**Existing options block (lines 25-30) — change:**
```typescript
const map = new g.Map(ref.current, {
  center,
  zoom: places.length > 0 ? 13 : 11,
  disableDefaultUI: true,
  zoomControl: true,
});
```

**After (D-12 + UI-SPEC §3):**
```typescript
const map = new g.Map(ref.current, {
  center,
  zoom: places.length > 0 ? 13 : 11,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',     // D-12 — mobile single-finger pan
  clickableIcons: false,          // D-12 — disable POI clicks
});
```

**Existing marker loop (lines 32-38) — extend:**
```typescript
for (const p of places) {
  new g.Marker({ map, position: { lat: p.lat, lng: p.lng }, title: p.name_local });
}
```

**After (D-14, D-15, D-16):**
```typescript
for (const p of places) {
  const marker = new g.Marker({
    map,
    position: { lat: p.lat, lng: p.lng },
    title: p.name_local,
  });
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

**Props signature change (line 6):**
```typescript
// Before
export function PublicBoardMap({ places }: { places: PublicBoardView['places'] }) {

// After
export function PublicBoardMap({
  places,
  links,
}: {
  places: PublicBoardView['places'];
  links: PublicBoardView['links'];
}) {
```

**Container className (line 63) — D-11 lock:**
- Before: `w-full h-[420px] md:h-[520px] rounded-lg border border-neutral-200 bg-neutral-50`
- After: `w-full h-[60vh] md:h-[520px] rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden`

**Keep the `data-moajoa-gmaps` script de-dup pattern (lines 46-57) — already correct per Known Pitfalls.**

**Add `import { buildYouTubeWatchUrl } from '@/lib/youtube';`** at top.

---

### `apps/web/lib/cache.ts` (NEW — utility)

**Analog (closest by spirit):** `packages/core/src/constants.ts` lines 81-83 + lines 137-139:
```typescript
// Existing pattern: namespace prefix + builder fn for a channel name
export const EXTRACT_CHANNEL_PREFIX = 'extract:';

export function extractChannelName(linkId: string): string {
  return `extract:${linkId}`;
}
```

**Apply same shape to cache tag + cached fetcher (RESEARCH §"Pattern 1" lines 282-294, locked variant lines 311-323):**
```typescript
import { unstable_cache } from 'next/cache';
import { getPublicBoardBySlug } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { PublicBoardView } from '@moajoa/core';

export const BOARD_TAG_PREFIX = 'board:';
export function boardTag(slug: string): string {
  return `${BOARD_TAG_PREFIX}${slug}`;
}

/**
 * Cached fetch of public board by slug. Same call site in `generateMetadata`
 * and the page component triggers per-request dedupe; tag-based invalidation
 * via /api/revalidate.
 */
export async function getCachedPublicBoard(slug: string): Promise<PublicBoardView | null> {
  const supabase = await getSupabaseServer();
  return unstable_cache(
    async () => getPublicBoardBySlug(supabase, slug),
    ['public-board', slug],
    { tags: [boardTag(slug)], revalidate: 3600 }, // D-03 lock
  )();
}
```

**Note:** RESEARCH lines 305-326 flag a "supabase client inside cache scope" ambiguity. The above variant (client created outside, RPC inside) is the safer one — use that.

---

### `apps/web/lib/og/static-maps.ts` (NEW — utility, no analog)

**No analog in repo.** Pattern is pure URL building. Take RESEARCH.md §"Pattern 8" lines 705-756 verbatim — it has the URL signing decision (off, D-07), color (`0xF97316` brand-500), marker truncation (`.slice(0, 10)` per D-07), and `URLSearchParams` builder.

**Key decisions baked in:**
- Single `markers=` param with all-same-color/size syntax (`color:0xF97316|size:mid|lat,lng|lat,lng|...`)
- `scale: 2` (Retina default)
- No `center` / `zoom` — Google auto-fits to markers bbox
- Throw on `places.length === 0` so caller (opengraph-image) explicitly chooses fallback path

---

### `apps/web/lib/og/pretendard.ts` (NEW — utility, font loader)

**Analog:** `apps/web/app/layout.tsx` lines 5-14 (uses same `.otf` files via `next/font/local`). The OG image needs a different API (`fonts: [...]` for `ImageResponse`) but **the file paths and weights are identical**:

```typescript
// layout.tsx already loads these for the browser:
src: [
  { path: '../public/fonts/Pretendard-Regular.otf',  weight: '400', style: 'normal' },
  { path: '../public/fonts/Pretendard-Medium.otf',   weight: '500', style: 'normal' },
  { path: '../public/fonts/Pretendard-SemiBold.otf', weight: '600', style: 'normal' },
  { path: '../public/fonts/Pretendard-Bold.otf',     weight: '700', style: 'normal' },
],
```

**OG-side pattern (RESEARCH §"Pattern 3" lines 427-430, OG only uses Regular + SemiBold per UI-SPEC):**
```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let cache: { regular: Buffer; semibold: Buffer } | null = null;

export async function loadPretendardFonts() {
  if (cache) return cache;
  const [regular, semibold] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Pretendard-Regular.otf')),
    readFile(join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf')),
  ]);
  cache = { regular, semibold };
  return cache;
}
```

Module-level memo so repeated OG invocations don't re-read the disk.

---

### `apps/web/lib/youtube.ts` (NEW — utility, regex transform)

**Analog:** `packages/core/src/schemas/link.ts` `detectSourceKind` (regex-based URL classifier, mentioned in `packages/api/src/queries/links.ts:25`). Same pattern: pure function, regex match, return narrowed type or null.

**Pattern (RESEARCH.md §"Pattern 7" lines 675-690 + UI-SPEC §"Pin → YouTube tap" + D-15):**
```typescript
/**
 * Extract YouTube video_id from various URL formats. Returns null for malformed.
 */
export function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/**
 * Build watch URL with optional `?t=Xs` timestamp.
 * Returns null if video_id can't be extracted.
 * Returns base URL (no ?t=) if timestampSec is null/0/NaN.
 */
export function buildYouTubeWatchUrl(linkUrl: string, timestampSec: number | null): string | null {
  const videoId = extractYouTubeVideoId(linkUrl);
  if (!videoId) return null;
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return timestampSec != null && timestampSec > 0
    ? `${base}&t=${Math.floor(timestampSec)}s`
    : base;
}
```

**Test fixtures (RESEARCH lines 694-701) — apply in `__tests__/youtube-id.test.ts`:**
- `https://www.youtube.com/watch?v=ABC123_def-1` → `ABC123_def-1`
- `https://youtu.be/ABC123_def-1` → `ABC123_def-1`
- `https://www.youtube.com/embed/ABC123_def-1` → `ABC123_def-1`
- `https://www.youtube.com/watch?v=ABC123_def-1&list=PL...` → `ABC123_def-1`
- timestampSec = 0.5 → `Math.floor → 0` → base URL (no `?t=`)
- timestampSec = null/undefined → base URL

---

### `apps/web/lib/env.ts` (MODIFY)

**Analog:** self lines 1-12. The pattern is a per-key boolean/string getter with strict literal check.

**Existing pattern (lines 9-11):**
```typescript
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1';
}
```

**Add (no Zod validation — keep file lightweight per existing style; runtime checks live in route handler / opengraph-image where they fail loudly):**
```typescript
export function getBaseUrl(): string {
  // Prefer Vercel-provided VERCEL_URL fallback; consumers (generateMetadata.metadataBase) pass explicit override at root.
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'https://moajoa.app';
}
```

`REVALIDATE_SECRET` and `GOOGLE_STATIC_MAPS_KEY` are read **at use site** (route handler / OG image) — not centralized here, matching the existing pattern of "read where it matters." This also keeps NEXT_PUBLIC_* (build-time inlined) separate from server-only secrets (which would leak if exported through this file).

---

### `apps/web/app/layout.tsx` (MODIFY)

**Analog:** self lines 16-24 (existing `metadata` export). Add a `viewport` export and `metadataBase`.

**Existing (lines 16-24):**
```typescript
export const metadata: Metadata = {
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description: '...',
  openGraph: { title: 'MOAJOA', description: '여행 정보를 모아두는 지도', type: 'website' },
};
```

**After (RESEARCH §"Pattern 4" + D-13):**
```typescript
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,        // D-13 — accessibility (WCAG 1.4.4)
  // userScalable: default true
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://moajoa.app'),
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description: '...',
  openGraph: { title: 'MOAJOA', description: '여행 정보를 모아두는 지도', type: 'website' },
};
```

`metadataBase` is what lets `/b/[slug]` page metadata use relative `/b/${slug}/opengraph-image` and `/b/${slug}` and have Next absolutize them.

---

### `apps/web/app/b/[slug]/not-found.tsx` (NEW)

**Analog:** `apps/web/app/auth/callback/page.tsx` lines 64-83 (centered text UI with brand-500 link).

**Existing shape to mirror:**
```typescript
<main className="min-h-screen flex items-center justify-center px-6">
  <div className="max-w-sm text-center">
    <h1 className="text-xl font-semibold mb-3">로그인 실패</h1>
    <p className="text-neutral-600 mb-4">{error}</p>
    <a href="/login" className="text-brand-500 underline">다시 로그인하기</a>
  </div>
</main>
```

**Phase 4 version (UI-SPEC §5 + Copywriting Contract):**
```typescript
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <h1 className="text-lg font-semibold text-neutral-900">보드를 찾을 수 없어요</h1>
      <p className="text-sm text-neutral-500 mt-2 text-center max-w-xs">
        링크가 잘못되었거나 보드가 비공개로 변경되었어요.
      </p>
      <a href="/" className="inline-block text-base font-semibold text-brand-500 hover:underline mt-8">
        MOAJOA
      </a>
    </main>
  );
}
```

No `'use client'` — pure server component (Next.js routes `notFound()` → this file automatically).

---

### `apps/web/app/b/[slug]/error.tsx` (NEW, `'use client'`)

**Analog:** `apps/web/app/auth/callback/page.tsx` lines 1, 64-83 (only `'use client'` error-display component in repo).

**Next.js error boundary signature (Next 15 standard):**
```typescript
'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <h1 className="text-lg font-semibold text-neutral-900">문제가 생겼어요</h1>
      <p className="text-sm text-neutral-500 mt-2">잠시 후 새로고침해 주세요</p>
      <button
        onClick={() => reset()}
        className="mt-6 text-base font-semibold text-brand-500 hover:underline"
      >
        다시 시도
      </button>
      <a href="/" className="inline-block text-sm text-neutral-500 hover:underline mt-8">
        MOAJOA
      </a>
    </main>
  );
}
```

Copy per UI-SPEC §6 + Copywriting Contract.

---

### `supabase/functions/extract-youtube/index.ts` (MODIFY — Deno, side-effect addition)

**Analog:** self lines 220-242 (existing done broadcast + return). Phase 4 adds a fire-and-forget `fetch` between the broadcastStep('done') and the `return jsonOk(...)`.

**Existing block (lines 218-242):**
```typescript
const avgConfidence = validPlaces.reduce(/*...*/);

await admin
  .from('links')
  .update({
    extraction_status: resolved.length > 0 ? 'ready' : 'manual_review',
    title: meta.title,
    /* ... */
  })
  .eq('id', link_id);

await broadcastStep(admin, link_id, 'done', 100, { places_extracted: resolved.length });

return jsonOk({ link_id, status: resolved.length > 0 ? 'ready' : 'manual_review', /* ... */ });
```

**After (D-04 + D-05 — fire-and-forget, board slug lookup via link.board_id):**
```typescript
await broadcastStep(admin, link_id, 'done', 100, { places_extracted: resolved.length });

// Fire-and-forget revalidate webhook (D-04, D-05). Failure does not affect extraction result.
await fireRevalidate(admin, link.board_id).catch((err) => {
  console.warn('[revalidate] webhook failed:', err);
});

return jsonOk({ /* ... */ });
```

**New helper (mirror `broadcastStep` shape lines 257-275):**
```typescript
async function fireRevalidate(
  admin: ReturnType<typeof createClient>,
  boardId: string,
): Promise<void> {
  const baseUrl = Deno.env.get('WEB_BASE_URL');
  const secret = Deno.env.get('REVALIDATE_SECRET');
  if (!baseUrl || !secret) return; // dev / unconfigured = no-op (D-05)

  // Lookup slug from board_id (board may be private — only public boards have served slug)
  const { data: board } = await admin
    .from('boards')
    .select('share_slug, visibility')
    .eq('id', boardId)
    .maybeSingle();
  if (!board?.share_slug || board.visibility !== 'public') return;

  await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: board.share_slug, secret }),
  });
}
```

**Error path (lines 246-251) — also fire revalidate?** No. D-04/05 lock: webhook only on success done. Error path leaves the link in `failed` and viewer sees Empty state until natural TTL refresh.

---

### `packages/core/src/constants.ts` (MODIFY — domain config)

**Analog:** self lines 25-83 (existing `as const` arrays + types pattern).

**Existing pattern shape (lines 32-33):**
```typescript
export const SourceKind = ['youtube', 'blog', 'instagram', 'manual'] as const;
export type SourceKindType = (typeof SourceKind)[number];
```

**Add (D-09 city_ko mapping — UI-SPEC §"Open Items Resolved"):**
```typescript
/**
 * city_code → 한글 도시명 map. Used by /b/[slug] page generateMetadata,
 * OG image left panel city label, and (future) /discover filters.
 *
 * Single source of truth shared by web + iOS + Edge (avoid drift).
 * Add ja-JP / en-US maps in v2 (I18N-01).
 */
export const CITY_KO_MAP: Record<string, string> = {
  tokyo: '도쿄',
  osaka: '오사카',
  kyoto: '교토',
  fukuoka: '후쿠오카',
  seoul: '서울',
  busan: '부산',
  // ... (planner / first-plan expands per project city_code values in DB)
} as const;
```

**Also add (UI-SPEC §"Cross-phase Consistency" + cache tag namespace):**
```typescript
/**
 * Next.js cache tag prefix for the public board page (Phase 4). The web app
 * fires revalidateTag(`${BOARD_TAG_PREFIX}${slug}`) on the /api/revalidate
 * webhook. Exposed from core so the Edge Function and the web route can
 * use the same string (currently only web uses it, but it lives here to
 * prevent string drift when v2 Edge → web webhook payloads expand).
 */
export const BOARD_TAG_PREFIX = 'board:';
```

(If the planner decides to keep tag building inside `apps/web/lib/cache.ts` only — fine, then skip the constant here. The shared constant is the conservative choice given the existing `EXTRACT_CHANNEL_PREFIX` precedent at line 82.)

---

## Shared Patterns

### Anon SSR Supabase Client
**Source:** `apps/web/lib/supabase/server.ts` lines 11-40
**Apply to:** `app/b/[slug]/page.tsx`, `app/b/[slug]/opengraph-image.tsx`, `lib/cache.ts`
**Rule:** every SSR data fetch in Phase 4 calls `getSupabaseServer()`. No service role on the web side. RPC `public_board_view` uses `SECURITY DEFINER` so anon is sufficient.

### Public RPC with `notFound()` short-circuit
**Source:** `apps/web/app/b/[slug]/page.tsx` line 32
```typescript
const view = await getPublicBoardBySlug(supabase, slug);
if (!view) notFound();
```
**Apply to:** any new server component fetching board by slug. `opengraph-image.tsx` returns a fallback ImageResponse instead of throwing (carousel scrapers must still get a valid PNG).

### Request-validating handler structure
**Source:** `supabase/functions/extract-youtube/index.ts` lines 42-72
**Apply to:** `app/api/revalidate/route.ts`
**Order:** method → JSON parse → Zod validate → env check → auth check → work → success response. Each guard returns early with appropriate status code and `{ error: '...' }` body.

### Idempotent script-tag injection (Google Maps JS)
**Source:** `apps/web/app/b/[slug]/_components/public-board-map.tsx` lines 46-57 (`data-moajoa-gmaps` flag)
**Apply to:** keep as-is. Known Pitfall in CONTEXT.md §"Code Context" calls out this pattern explicitly — do not regress to plain `<script>` insertion.

### Localized constant lookup with omit-on-missing
**Source:** UI-SPEC Copywriting Contract — city missing means *omit the city line entirely*, never render `"undefined · 핀 N개"` or fallback like "여행".
**Apply to:** page meta row, generateMetadata description, OG image city label. Always branch:
```typescript
const cityKo = view.board.city_code ? CITY_KO_MAP[view.board.city_code] : null;
// then render cityKo only when truthy
```

### `'use client'` boundary discipline
**Source:** CLAUDE.md §4.5 + `apps/web/app/b/[slug]/_components/public-board-map.tsx` line 1
**Apply to:** `error.tsx` (must be client per Next), `public-board-map.tsx`. **Do not** add `'use client'` to `opengraph-image.tsx`, `not-found.tsx`, `route.ts`, `page.tsx`, `layout.tsx`.

### No `.js` extension in workspace imports
**Source:** CLAUDE.md §4.5 + existing files (every import in `page.tsx`, `links.ts`, etc.)
**Apply to:** every new file. `import { CITY_KO_MAP } from '@moajoa/core'` not `'@moajoa/core/index.js'` or similar.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/web/app/b/[slug]/opengraph-image.tsx` | `next/og` ImageResponse | request-response → PNG | Repo has zero prior `next/og` usage. Planner uses RESEARCH.md §"Pattern 3" lines 404-527 as primary reference. |
| `apps/web/app/api/revalidate/route.ts` | Next.js route handler | request-response | Repo has zero prior Next route handlers (only `page.tsx` server components + Deno Edge Functions). Structure transferable from Deno handler in `extract-youtube/index.ts`; surface from RESEARCH.md §"Pattern 2". |
| `apps/web/lib/og/static-maps.ts` | URL builder | transform | No URL-building helper in repo. Pure new code per RESEARCH.md §"Pattern 8". |
| `apps/web/lib/cache.ts` (unstable_cache) | cache wrapper | cached read | No prior `unstable_cache` usage. Namespace pattern borrowed from `EXTRACT_CHANNEL_PREFIX` in core/constants. |

---

## Metadata

**Analog search scope:** `apps/web/app/**`, `apps/web/lib/**`, `packages/api/src/queries/**`, `packages/core/src/**`, `supabase/functions/extract-youtube/**`

**Files scanned (read):** 9
- `apps/web/app/b/[slug]/page.tsx` (78 lines)
- `apps/web/app/b/[slug]/_components/public-board-map.tsx` (67 lines)
- `apps/web/app/layout.tsx` (33 lines)
- `apps/web/app/auth/callback/page.tsx` (99 lines)
- `apps/web/lib/env.ts` (12 lines)
- `apps/web/lib/supabase/server.ts` (40 lines)
- `packages/api/src/queries/boards.ts` (72 lines)
- `packages/api/src/queries/links.ts` (60 lines)
- `packages/core/src/constants.ts` (140 lines)
- `supabase/functions/extract-youtube/index.ts` (318 lines)

**Pattern extraction date:** 2026-05-26

---

## PATTERN MAPPING COMPLETE

**Phase:** 4 — Public Board Web
**Files classified:** 15
**Analogs found:** 11 / 15 (4 net-new patterns)

### Coverage
- Files with exact analog (same file extend): 6 (page.tsx, public-board-map.tsx, layout.tsx, env.ts, constants.ts, extract-youtube/index.ts)
- Files with role-match analog: 5 (cache.ts, pretendard.ts, youtube.ts, not-found.tsx, error.tsx)
- Files with no analog (use RESEARCH.md primary): 4 (opengraph-image.tsx, route.ts, static-maps.ts, unstable_cache wrapper inside cache.ts)

### Key Patterns Identified
- All SSR fetching goes through `getSupabaseServer()` anon client → RPC `public_board_view` (RLS bypass via SECURITY DEFINER, no auth needed)
- Public board fetch is cached via `unstable_cache` with `['public-board', slug]` keyParts and `board:${slug}` tag; both `generateMetadata` and page render call the same cached fetcher to leverage per-request dedupe (RESEARCH §"Pattern 1")
- Request-validating handlers follow the Deno extract-youtube structure: method → JSON parse → Zod validate → env/auth check → work → response (route.ts is the Next.js translation)
- Edge Function fires fire-and-forget webhooks (`fireRevalidate`) the same way it fires `broadcastStep` — both wrapped in try/catch, both leave extraction success untouched on failure
- Typography active scale (24/18/16/14, weights 400+600) drives a sweep across existing page.tsx — every `text-xs`, `text-3xl`, `font-medium` site reassigned per UI-SPEC audit table
- City code lookups always branch on truthy `CITY_KO_MAP[code]` and omit the line entirely if missing (no `"undefined"` strings reach the user)
- Pretendard `.otf` files are shared between `next/font/local` (browser) and `readFile` (OG image Node runtime) — single fonts directory, two loading mechanisms

### File Created
`/Users/wcb/Documents/MOAJOA/.planning/phases/04-public-board-web/04-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns + concrete excerpts in PLAN.md files.
