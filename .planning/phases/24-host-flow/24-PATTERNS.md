# Phase 24: Host Flow (온보딩·지도탭) - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 20 new/modified files
**Analogs found:** 17 / 20 (3 files have no close analog — see §No Analog Found)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/app/login/page.tsx` (modify) | route (client) | request-response | itself — `oauth()` L106-116 | exact |
| `apps/web/app/auth/callback/route.ts` (modify) | route handler | request-response | itself — default `next` L34-40 | exact |
| `apps/web/app/onboarding/page.tsx` | route (client wizard) | request-response | `apps/web/app/login/page.tsx` (mode-switch client page) | role-match |
| `apps/web/app/onboarding/_components/step-where.tsx` / `step-who.tsx` | component | request-response | `apps/web/components/chip.tsx` (selected chip idiom) | role-match |
| `apps/web/app/onboarding/_components/step-dates.tsx` | component | request-response | react-day-picker (new dep) — no repo analog | no-analog |
| `apps/web/app/onboarding/_components/step-seed.tsx` | component | CRUD (staged local) | `apps/web/app/boards/[id]/_components/add-link-form.tsx` | exact |
| `apps/web/app/moa/page.tsx` | route (RSC list + D-01 branch) | CRUD read | `apps/web/app/boards/page.tsx` | exact |
| `apps/web/app/moa/[id]/page.tsx` | route (RSC → island) | CRUD read | `apps/web/app/t/[slug]/page.tsx` + `apps/web/app/me/page.tsx` (auth gate) | exact |
| `apps/web/app/moa/[id]/_components/moa-map.tsx` | component | event-driven | `apps/web/app/t/[slug]/_components/public-board-map.tsx` (loader/options/markers만 — re-init은 안티패턴) | role-match |
| `apps/web/app/moa/[id]/_components/place-sheet.tsx` | component | event-driven (pointer) | `apps/web/components/bottom-sheet.tsx` (시각 언어만 — 드래그 물리는 신규) | partial |
| `apps/web/app/moa/[id]/_components/place-list.tsx` | component | CRUD + event-driven | `apps/web/app/t/[slug]/_components/vote-island.tsx` | exact |
| `apps/web/app/moa/[id]/_components/add-sheet.tsx` | component | request-response | `add-link-form.tsx` + `bottom-sheet.tsx` + `tabs.tsx` + resolve-place EF 계약 | exact |
| `apps/web/app/moa/[id]/_components/share-sheet.tsx` | component | CRUD (single UPDATE) | `bottom-sheet.tsx` + `packages/api/src/queries/trips.ts` `shareMoa` | exact |
| Realtime 구독 (moa-map 또는 전용 hook) | hook/effect | pub-sub (postgres_changes 최초) | `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` L143-174 (채널 lifecycle) | role-match |
| `apps/web/lib/member-color.ts` | utility (pure fn) | transform | `apps/web/lib/marker-svg.ts` (token-only pure fn) | exact |
| `apps/web/lib/place-sort.ts` (sortByLove) | utility (pure fn) | transform | `vote-island.tsx` L210-212 정렬 | exact |
| `apps/web/lib/marker-svg.ts` (modify — fill param) | utility | transform | itself | exact |
| `packages/api/src/queries/trips.ts` (modify — createMoaDraft) | typed query | CRUD | itself — `createTrip` L74-94 | exact |
| `packages/ui-tokens/src/index.ts` (modify — member palette) | config (design token) | — | itself — `colors.category` L64-70 (팔레트 append 형태) | exact |
| `supabase/migrations/0026_realtime_publication.sql` | migration | — | `supabase/migrations/0025_web_share.sql` (헤더·결정기록 스타일) | role-match |
| `apps/web/__tests__/*.test.{ts,tsx}` (7종) | test | — | `apps/web/__tests__/vote-island.test.tsx` | exact |
| `supabase/tests/realtime_publication_smoke.sh` | test (script) | — | 23-01/02 bash 하네스 선례 (`supabase/tests/`) | role-match |

## Pattern Assignments

### `apps/web/app/login/page.tsx` — 카카오 버튼 (AUTH-07, modify)

**Analog:** 자기 자신. 수정은 2곳뿐 — union 확장 + 버튼 1개 추가. Surgical diff.

**OAuth 패턴** (login/page.tsx L106-116) — union에 `'kakao'`만 추가:
```typescript
async function oauth(provider: 'google' | 'apple') {   // → 'google' | 'apple' | 'kakao'
  setError(null);
  const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl(),
    },
  });
  // On success the browser redirects away; an error means we never left.
  if (error) toast(error.message, { variant: 'error' });
}
```

**버튼 배치 패턴** (L227-240) — Google/Apple 버튼 블록에 카카오 버튼 1개 append. UI-SPEC A-9: `#FEE500` 배경 + 검정 텍스트는 카카오 브랜드 가이드 준수 목적의 유일한 토큰 외 색 허용:
```tsx
<button
  onClick={() => oauth('apple')}
  className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white transition-colors hover:bg-neutral-800"
>
  Apple로 계속
</button>
{/* 카카오: bg-[#FEE500] text-neutral-900, 문구 "카카오로 시작하기" */}
```

**로그인 후 목적지** (L17-21) — RESEARCH Pattern 3: 이 함수와 callback 기본값을 `/moa`로 변경(분기 자체는 /moa RSC가 담당):
```typescript
function postLoginDestination(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1' ? '/boards' : '/';  // '/' → '/moa'
}
```

---

### `apps/web/app/auth/callback/route.ts` — next 기본값 (modify)

**Analog:** 자기 자신 (L34-40). open-redirect 가드는 그대로, 기본 목적지만 `/moa`로:
```typescript
const rawNext = searchParams.get('next');
const next =
  rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1'
      ? '/boards'
      : '/';          // '/' → '/moa'
```
PKCE exchange·쿠키 배선(L61-80)은 무수정 — Phase 23-07에서 카카오 포함 프로덕션 실증 완료.

---

### `apps/web/app/moa/page.tsx` — 모아 리스트 + D-01 진입 분기 (RSC)

**Analog:** `apps/web/app/boards/page.tsx` (auth-gated RSC 리스트 — exact) + `apps/web/app/me/page.tsx` (redirect 게이트)

**Imports + auth 게이트 패턴** (boards/page.tsx L1-6, L45-49):
```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMyTrips } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';

export default async function BoardsPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const boards = await listMyTrips(supabase);
```
D-01 분기는 이 뒤에: `trips.length === 0 → redirect('/onboarding')`, `1 → redirect(`/moa/${trips[0].id}`)`, `2+ → 리스트 렌더`.

**카드 데이터:** D-12 카드(이름·도시·날짜·장소 수)는 `listMyTripsWithPreview` (packages/api/src/queries/trips.ts L29-66)가 이미 place_count 포함 1 round-trip 제공 — 신규 쿼리 불필요. 도시 표기는 `CITY_KO_MAP[trip.city_code]` (t/[slug]/page.tsx L19 idiom).

**카드 리스트 렌더 패턴** (boards/page.tsx L68-99) — `<li>` + `<Link>` + animate-fade-up staggered delay 그대로 미러. **주의:** boards/page.tsx 상단의 `isDevToolsEnabled()` 게이트(L19-43)는 복사 금지 (RESEARCH 안티패턴).

---

### `apps/web/app/moa/[id]/page.tsx` — 지도탭 RSC 셸

**Analog:** `apps/web/app/t/[slug]/page.tsx` (RSC 데이터 로드 → 클라이언트 island 전달 — exact 구조)

**RSC → island 패턴** (t/[slug]/page.tsx L62-131 요약):
```typescript
export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;                  // Next 15: params는 Promise
  const view = await getCachedPublicTrip(slug);
  if (!view) notFound();
  // ...
  <VoteIsland slug={slug} tripId={view.board.id} places={view.places} links={view.links} />
```
`/moa/[id]`용 변형: `getSupabaseServer()` + `getTrip`/`listPlacesByTrip`/`listLinksByTrip`/`getVoteCounts`로 초기 데이터 로드(캐시 없음 — 로그인 사용자 화면), null이면 `notFound()`, auth 없으면 `redirect('/login?next=...')` (me/page.tsx L5-9 게이트 idiom). 접근 권한은 RLS가 자연 게이트(RESEARCH Open Q4).

---

### `apps/web/app/onboarding/page.tsx` + step 컴포넌트 4종

**Analog:** `apps/web/app/login/page.tsx` (클라이언트 단일 라우트 + `useState<Mode>` 모드 전환 — D-02 스텝 상태의 직접 선례)

**모드/스텝 상태 패턴** (login/page.tsx L34-42):
```typescript
'use client';
export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('password');   // → const [step, setStep] = useState(1)
  const [pending, setPending] = useState(false);
```

**칩 선택 패턴** (step-where·step-who) — `apps/web/components/chip.tsx` L13-30:
```tsx
<Chip selected={selected} onClick={...}>{label}</Chip>
// selected → 'border-transparent bg-brand-100 text-brand-700'
```
도시 9칩은 `CITY_KO_MAP` (packages/core/src/constants.ts L148-158) entries를 map. '기타' 칩 선택 시 `Input` 노출 (login/page.tsx L150-166 Input 사용 idiom).

**제출 (D-03 일괄 시드)** — 검증·시드 계약 (RESEARCH Pattern 4 + 실코드 확인):
```typescript
// TripCreateDraftSchema (packages/core/src/schemas/trip.ts L49-62):
//   dates both-or-null refine + end>=start refine + companion ≤20 — 클라 재검증 금지, parse만
const draft = TripCreateDraftSchema.parse({ title, city_code, start_date, end_date, companion });
const trip = await createMoaDraft(client, draft);            // 신규 typed query (아래)
for (const url of seedLinks) {
  const link = await addLink(client, { board_id: trip.id, url });   // links.ts L29-44
  if (link.source_kind !== 'manual') {
    triggerExtraction(client, link.id).catch(console.error);        // fire-and-forget idiom
  }
}
for (const g of seedPlaces) {
  await addManualPlace(client, { board_id: tripId, google_place_id: g.placeId }); // places.ts L37-50
}
router.replace(`/moa/${trip.id}`);
```
주의: `addLink`/`addManualPlace` 입력 필드는 아직 `board_id` (core rename은 후속 plan 소유 — links.ts L24-27 주석). `seq_no`는 절대 전송하지 않음(0024 트리거 채번).

---

### `packages/api/src/queries/trips.ts` — `createMoaDraft` 추가 (modify)

**Analog:** 같은 파일 `createTrip` (L74-94). 기존 함수 무수정, companion 포함 신규 함수 append (23-06 "기존 함수 무수정" 선례 = `shareTrip` 옆에 `shareMoa` 추가된 방식 그대로):
```typescript
export async function createTrip(client: MoajoaSupabaseClient, input: TripCreate): Promise<Trip> {
  // visibility defaults to 'private' at the DB level and representative_id is
  // set by the `trips_default_representative` trigger (0016) — no client field.
  const { data, error } = await client
    .from('trips')
    .insert({
      title: input.title,
      city_code: input.city_code,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Trip;
}
// createMoaDraft: 동일 shape + companion: input.companion, input 타입은 TripCreateDraft
```

---

### `apps/web/app/moa/[id]/_components/moa-map.tsx`

**Analog:** `apps/web/app/t/[slug]/_components/public-board-map.tsx` — **스크립트 로딩·맵 옵션·마커 생성만 복사. useEffect deps 재init 구조는 복사 금지** (Pitfall 4).

**스크립트 로딩 idiom** (public-board-map.tsx L85-101) — 그대로 복사:
```typescript
if (winAny.google?.maps) { init(); return; }
const existing = document.querySelector<HTMLScriptElement>('script[data-moajoa-gmaps]');
if (existing) { existing.addEventListener('load', init, { once: true }); return; }
const script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker`;
script.async = true;
script.defer = true;
script.dataset.moajoaGmaps = '1';
script.addEventListener('load', init, { once: true });
document.head.appendChild(script);
```

**맵 옵션** (L38-45) — greedy·clickableIcons false 계승:
```typescript
const map = new g.Map(ref.current, {
  center,
  zoom: places.length > 0 ? 13 : 11,
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  clickableIcons: false,
});
```

**마커 생성** (L59-68) — icon URL은 `buildMarkerIconUrl` fill 확장판으로:
```typescript
const marker = new g.Marker({
  map,
  position: { lat: p.lat, lng: p.lng },
  title: p.name_local,
  icon: { url: iconUrl, scaledSize: new g.Size(32, 40), anchor: new g.Point(16, 40) },
});
marker.addListener('click', () => { /* D-09: 행 스크롤+펼침 콜백 (window.open 아님) */ });
```

**키 부재 fallback** (L18-23): `ref.current.innerHTML = '<div class="text-sm text-neutral-500 p-4">지도를 불러올 수 없어요</div>'` — 정적 문구만 (XSS 표면 없음 유지).

**구조 차이 (신규 발명):** map·markers를 `useRef`로 1회 생성 유지, places 변경 시 마커 diff(add/remove)만. fitBounds는 장소 수 증가 시에만 (D-16).

---

### Realtime postgres_changes 구독 (레포 최초 — moa-map 또는 `/moa/[id]` island 내)

**Analog:** `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` L143-174 — 채널 lifecycle만 미러 (바인딩은 broadcast → postgres_changes로 교체, presence 금지 D-14):
```typescript
// poll-vote-island.tsx L144-174 (실코드)
useEffect(() => {
  const client = getSupabaseBrowser();
  const channel = client.channel(pollChannelName(tripId), { config: { presence: { key: deviceToken } } });
  channel
    .on('broadcast', { event: 'vote' }, () => {
      void refetchTally();               // ← payload 패치 아님, refetch reconcile
    })
    .subscribe(/* ... */);
  return () => {
    void client.removeChannel(channel);  // cleanup idiom
  };
}, [tripId, code]);
```
Phase 24 변형 (RESEARCH Pattern 1): `moaChannelName(tripId)` (constants.ts L266-268, `moa:${tripId}`) 하나에 places INSERT + links UPDATE 바인딩:
```typescript
const channel = client
  .channel(moaChannelName(tripId))
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
    () => void reconcile())
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'links', filter: `trip_id=eq.${tripId}` },
    () => void reconcile())
  .subscribe();
```
poll-vote-island L102-105 주석의 교훈이 계약: **한 토픽에 채널 2개 금지** — 같은 화면의 다른 컴포넌트가 채널이 필요하면 이 인스턴스를 prop/context로 공유.

---

### `apps/web/app/moa/[id]/_components/place-list.tsx`

**Analog:** `apps/web/app/t/[slug]/_components/vote-island.tsx` — 이 phase의 최대 재사용원 (아코디언·찜 토글·출처 액션·optimistic 전부 실존).

**Imports 패턴** (vote-island.tsx L1-19):
```typescript
'use client';
import { useEffect, useState } from 'react';
import { castVote, getMyVotedPlaceIds, getVoteCounts, retractVote } from '@moajoa/api';
import { Heart } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { buildYouTubeWatchUrl } from '@/lib/youtube';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps-url';
import { useToast } from '@/components';
```

**찜 optimistic+rollback 패턴** (L177-197) — 그대로 복사 (호스트 찜 토글, UI-SPEC A-5):
```typescript
const wasVoted = myVotes[placeId] ?? false;
setPending((p) => ({ ...p, [placeId]: true }));
setMyVotes((v) => ({ ...v, [placeId]: !wasVoted }));
setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? -1 : 1) }));
try {
  if (wasVoted) await retractVote(client, placeId);
  else await castVote(client, { place_id: placeId, kind: 'love' });
} catch (err) {
  console.error(err);
  setMyVotes((v) => ({ ...v, [placeId]: wasVoted }));                                  // rollback
  setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? 1 : -1) }));
  toast('투표를 저장하지 못했어요.', { variant: 'error' });
} finally {
  setPending((p) => ({ ...p, [placeId]: false }));
}
```
호스트 화면 단순화: `/moa/[id]`는 로그인+owner 전제이므로 vote-island의 join/anon 분기(L153-176)는 복사하지 않음.

**counts/myVotes hydration** (L139-151):
```typescript
const [vc, mine] = await Promise.all([
  getVoteCounts(client, placeIds),
  uid ? getMyVotedPlaceIds(client, placeIds, uid).catch(() => []) : Promise.resolve([]),
]);
```

**아코디언 행 패턴** (L244-378 구조): `open: Record<string, boolean>` 상태 + 행 헤더 탭 toggle + `stopPropagation`으로 하트/액션 링크 분리 + `aria-expanded` + `data-testid`. **한 번에 하나만 펼침**(UI-SPEC)이라 `Record` 대신 `openId: string | null`로 단순화 가능.

**출처 액션 헬퍼** (L39-60) — `tsLabel` + `sourceAction` 함수를 거의 그대로 복사 (UI-SPEC 문구 "출처 {mm:ss}"로만 교체):
```typescript
function tsLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
// youtube → buildYouTubeWatchUrl(link.url, place.source_timestamp_sec), blog → link.url
```

**구글맵 딥링크** (L354-360):
```tsx
<a href={buildGoogleMapsPlaceUrl(p.name_local, p.google_place_id)}
   target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
```

**분석 중·실패 행 (D-13/15):** links의 `extraction_status`(constants.ts L75-82: pending→processing→ready|failed|manual_review)로 분기. 재시도는 `retry-extraction-button.tsx` L19-39 로직 복사 — 단 `router.refresh()` 대신 reconcile, dev-tools 문구 제거:
```typescript
// retry-extraction-button.tsx L22-31 (재시도 결과 분기 — 문구 재사용 가능)
const result = await triggerExtraction(getSupabaseBrowser(), linkId);
if (result.status === 'ready') {
  toast(`장소 ${result.places_extracted}개를 찾았어요.`, { variant: 'success' });
} else if (result.status === 'manual_review') { /* 실패 행 유지 */ }
```

---

### `apps/web/lib/place-sort.ts` — sortByLove (MOA-02)

**Analog:** vote-island.tsx L210-212 (정렬 실코드 — tiebreak만 추가):
```typescript
// 기존: const visible = [...places].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
// Phase 24 (RESEARCH Pattern 5): seq_no asc tiebreak 추가한 순수함수 — 단위 테스트 대상
export function sortByLove(places: Place[], loveCounts: Record<string, number>): Place[] {
  return [...places].sort((a, b) =>
    (loveCounts[b.id] ?? 0) - (loveCounts[a.id] ?? 0) || a.seq_no - b.seq_no,
  );
}
```
순번 배지는 항상 `place.seq_no` 표기 (정렬 인덱스 넘버링 금지 — Pitfall 9).

---

### `apps/web/lib/member-color.ts` + `packages/ui-tokens/src/index.ts` (D-20)

**Analog (토큰 append):** ui-tokens `colors.category` (L64-70) — named 팔레트 객체 append 형태. member는 순환 배정용이라 배열:
```typescript
// packages/ui-tokens/src/index.ts — colors에 append (기존 키 무수정). UI-SPEC A-2 확정 6색:
member: [
  '#FF7043', // orange
  '#AB47BC', // purple
  '#26A69A', // teal
  '#FFB300', // amber
  '#EC407A', // pink
  '#7CB342', // green
] as const,
```

**Analog (순수함수):** `apps/web/lib/marker-svg.ts` — 토큰만 참조하는 순수함수 + 상세 doc comment 스타일 (L24-35):
```typescript
import { colors } from '@moajoa/ui-tokens';
// marker-svg.ts L33-34: "Single source: ui-tokens — palette changes propagate without touching this file."
const fill = isAi ? colors.brand[500] : colors.neutral[900];
```
member-color 계약 (RESEARCH Pattern 6): owner는 memberships 행이 없음(설계상) → `userId === trip.owner_id`면 `colors.brand[500]`, 참여자는 `created_at` asc 정렬 인덱스 `% colors.member.length`.

---

### `apps/web/lib/marker-svg.ts` — fill 파라미터 확장 (modify)

**Analog:** 자기 자신 (L24-47). 시그니처에 `fill?: string` 추가, 기존 호출 무영향(기본값 = 현행 분기). **user 문자열을 SVG에 삽입하지 않는 계약(T-05-05-01) 유지** — fill은 ui-tokens 리터럴만:
```typescript
export function buildMarkerIconUrl(input: {
  source_kind: 'ai' | 'manual';
  confidence: number | null | undefined;
  // + fill?: string  — 토큰 리터럴만 (member palette / brand.500)
}): string {
  // L38-44 SVG 조립: 정적 리터럴 interpolation만 — 이 구조 유지
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">` +
    `<path d="M16 0C7.16 0 0 7.16 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.16 24.84 0 16 0z" fill="${fill}" fill-opacity="${fillOpacity}"/>` + ...
```
기존 단위 테스트 `apps/web/__tests__/marker-svg.test.ts` 실존 — fill 확장 케이스를 거기에 추가.

---

### `apps/web/app/moa/[id]/_components/place-sheet.tsx` (드래그 시트 — 신규 발명)

**Analog (시각 언어만):** `apps/web/components/bottom-sheet.tsx` — non-modal이므로 컴포넌트 재사용 불가, white·rounded-t-3xl·핸들·250ms 타이밍을 미러:
```tsx
// bottom-sheet.tsx L59-72 (시각 계약)
<div className={cn(
  'relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white',
  'transition-transform duration-[250ms] ease-out',
  shown ? 'translate-y-0' : 'translate-y-full',
)}>
  {/* Drag handle */}
  <div className="flex shrink-0 justify-center pt-3 pb-1">
    <span className="h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />
  </div>
```
드래그 물리(pointer capture·2단 앵커 30vh/85vh·플릭)는 레포에 선례 없음 — RESEARCH Pattern 7 + UI-SPEC §Interaction Contract가 스펙. 백드롭(L50-57)은 복사하지 않음(상시 표시).

---

### `apps/web/app/moa/[id]/_components/add-sheet.tsx` + 온보딩 step-seed (D-11 공유)

**Analog:** `apps/web/app/boards/[id]/_components/add-link-form.tsx` (링크 탭) + `components/tabs.tsx` + `components/bottom-sheet.tsx` (모달 시트로 사용) + resolve-place EF 계약 (검색 탭)

**링크 추가 패턴** (add-link-form.tsx L39-70) — **첫 줄 `if (!isDevToolsEnabled()) return null;`(L13)은 절대 복사 금지**:
```typescript
const client = getSupabaseBrowser();
const link = await addLink(client, { board_id: boardId, url: url.trim() });
if (link.source_kind !== 'manual') {
  // Fire and forget — user sees "processing" status
  triggerExtraction(client, link.id).catch((err) => {
    console.error(err);
    toast('자동 분석을 시작하지 못했어요. 잠시 후 다시 시도해주세요.', { variant: 'error' });
  });
}
```
`detectSourceKind` 힌트 패턴(L21-37)도 재사용 가능. `router.refresh()`(L63)는 realtime reconcile로 대체.

**장소 검색 패턴** (resolve-place EF 계약 — supabase/functions/resolve-place/index.ts L1-37):
```typescript
// POST { query?, lat?, lng?, language? } → { places: ResolvedPlace[] } (max 5)
// RequestSchema: query 1..200자, language default 'ko'. Bearer JWT(anon 허용) 필수.
const { data, error } = await client.functions.invoke('resolve-place', {
  body: { query, language: 'ko' },
});
// 선택 → addManualPlace(client, { board_id: tripId, google_place_id: picked.id })
//   (places.ts L37-50 — 좌표는 add_manual_place RPC가 서버에서 해석)
```

**탭 패턴** (tabs.tsx L12-70): Radix `Tabs/TabsList/TabsTrigger/TabsContent` — `@/components` barrel에서 import.

**모달 시트 사용법** (bottom-sheet.tsx L13-20 props 계약): `<BottomSheet open={open} onClose={...} title="...">` — add-sheet·share-sheet 둘 다 이걸로 감쌈.

---

### `apps/web/app/moa/[id]/_components/share-sheet.tsx` (SHARE-01)

**Analog:** `components/bottom-sheet.tsx` (셸) + `packages/api/src/queries/trips.ts` `shareMoa` (L163-178 실코드 계약):
```typescript
/**
 * Share a moa with an explicit share_mode ('dates' | 'places' | 'both') and
 * return its share_slug for the /t/{slug} link. Single UPDATE — re-calling
 * with a different mode UPDATES share_mode on an already-shared moa (Open Q3:
 * mode change allowed; hiding 'dates' for date-confirmed moas is client-side).
 */
export async function shareMoa(client, tripId, shareMode: ShareModeType): Promise<string> {
  const { data, error } = await client
    .from('trips')
    .update({ visibility: 'shared', share_mode: shareMode })
    .eq('id', tripId)
    .select('share_slug')
    .single();
```
클라이언트 흐름 (RESEARCH Code Examples + Pitfall 5):
```typescript
const slug = await shareMoa(client, tripId, mode);
const url = `${process.env.NEXT_PUBLIC_APP_URL}/t/${slug}`;
await navigator.clipboard.writeText(url);
toast('링크를 복사했어요');
if (navigator.share) {
  try { await navigator.share({ url }); }
  catch (e) { if ((e as Error).name !== 'AbortError') throw e; }
}
```
- D-17: `trip.start_date != null`이면 'dates' 카드 미렌더 → 2택. `ShareMode` 3값은 constants.ts L257.
- D-19: 시트 열 때 `trip.share_mode`를 선택 상태로 프리셋 (TripSchema L22에 share_mode 필드 실존).
- 모드 카드 선택 스타일은 UI-SPEC(border brand-500 + bg brand-50) — 기존 Card(L13-23) 변형.

---

### `supabase/migrations/0026_realtime_publication.sql`

**Analog:** `supabase/migrations/0025_web_share.sql` L1-20 헤더 스타일 — 목적·결정 기록·append-only 명시 주석 블록 미러:
```sql
-- 0025_web_share.sql — Phase 23 Web-First Foundation (...)
-- 결정 기록:
--   D-A1: ...
-- Append-only: 0016..0024 are NEVER modified.
```
본문 (RESEARCH Pattern 1 — publication 등록. grep 0건 확인, 레포 최초):
```sql
alter publication supabase_realtime add table places;
alter publication supabase_realtime add table links;
```
votes 포함 여부는 RESEARCH Open Q3 — 플래너 결정 (D-14는 places/links만 잠금). 적용 후 `pnpm supabase:types` 재생성 관례(CLAUDE.md §4.3 — 이 마이그레이션은 스키마 무변경이라 diff 0 예상이지만 관례 준수).

---

### `apps/web/__tests__/*.test.{ts,tsx}` (7종 신규)

**Analog:** `apps/web/__tests__/vote-island.test.tsx` — 이 레포의 컴포넌트 테스트 표준 idiom.

**Mock 배선 패턴** (vote-island.test.tsx L27-88) — 4종 mock 세트를 그대로 복사:
```typescript
// 1) supabase browser client mock (L29-34)
let mockUser: { id: string } | null = null;
const authGetUser = vi.fn(async () => ({ data: { user: mockUser } }));
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getUser: authGetUser } }),
}));

// 2) @moajoa/api 쿼리 mock (L36-65) — 함수별 vi.fn 래핑
vi.mock('@moajoa/api', () => ({
  castVote: (client: unknown, input: { place_id: string; kind: string }) => castVote(client, input),
  // ...
}));

// 3) next/navigation mock (L67-72)
const refresh = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));

// 4) @/components mock — Button은 DOM prop strip, useToast는 swallow (L75-85)
vi.mock('@/components', () => ({
  Button: ({ children, ...props }) => { /* variant/size strip 후 <button> */ },
  useToast: () => ({ toast: vi.fn() }),
}));

// Import AFTER mocks so the component picks them up. (L87-88)
import { VoteIsland } from '@/app/t/[slug]/_components/vote-island';
```
**Fixture factory** (L7-25): `makePlace(overrides: Partial<ViewPlace>)` 패턴. **beforeEach 전체 mockClear** (L90-103). 테스트 seam: 컴포넌트가 `initialJoined`/`initialCounts` 같은 seed prop을 받아 네트워크 hydration을 건너뜀 (vote-island.tsx L30-35) — 신규 island도 같은 seam 설계.

**배치 규칙:** `apps/web/__tests__/`에만 (co-located `_components/*.test.tsx`는 vitest include 글롭이 못 잡음 — 19-04 실측). 순수함수 테스트(place-sort·member-color)는 mock 없이 직접 import.

---

## Shared Patterns

### Supabase 클라이언트 접근
**Source:** `apps/web/lib/supabase/browser.ts` (`getSupabaseBrowser()`) / `apps/web/lib/supabase/server.ts` (`getSupabaseServer()`)
**Apply to:** 모든 클라이언트 컴포넌트는 browser, 모든 RSC는 server. anon 키만 — 서비스 롤 클라이언트 금지.

### 에러 처리 — try/catch + toast
**Source:** `add-link-form.tsx` L39-70, `retry-extraction-button.tsx` L19-39
**Apply to:** 모든 mutation 핸들러
```typescript
setPending(true);
try {
  /* mutation */
  toast('...했어요.', { variant: 'success' });
} catch (err) {
  console.error(err);
  toast('...하지 못했어요.', { variant: 'error' });
} finally {
  setPending(false);
}
```
문구는 해요체 + UI-SPEC Copywriting Contract가 단일 출처.

### Optimistic + reconcile
**Source:** `vote-island.tsx` L177-197 (rollback), poll-vote-island L155-157 (peer 이벤트 → refetch)
**Apply to:** 찜 토글, realtime 이벤트 수신. **payload로 상태 패치 금지 — refetch reconcile.**

### open-redirect 가드 (?next=)
**Source:** login/page.tsx L18-19 · auth/callback/route.ts L35-36 (양쪽 동일)
**Apply to:** 신규 진입 분기·login next 전달 전부
```typescript
next && next.startsWith('/') && !next.startsWith('//')
```

### fire-and-forget 추출 트리거
**Source:** `add-link-form.tsx` L51-56
**Apply to:** 온보딩 시드, add-sheet 링크 탭 — `triggerExtraction(client, link.id).catch(...)`, await 안 함. 완료 반영은 postgres_changes가 담당.

### 컴포넌트 barrel import
**Source:** `apps/web/components/index.ts`
**Apply to:** `import { Button, Input, Chip, BottomSheet, Card, Tabs, useToast } from '@/components'` — 개별 파일 import 대신 barrel. 워크스페이스 import에 `.js` extension 금지.

### RSC 페이지 auth 게이트
**Source:** `me/page.tsx` L5-9, `boards/page.tsx` L45-47
**Apply to:** `/moa`, `/moa/[id]`
```typescript
const supabase = await getSupabaseServer();
const { data } = await supabase.auth.getUser();
if (!data.user) redirect('/login');
```

## No Analog Found

Files/mechanisms with no close match in the codebase (planner should use RESEARCH.md/UI-SPEC patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `step-dates.tsx` 캘린더 | component | request-response | 레포에 캘린더 없음 — react-day-picker 9.14.0 신규 dep (RESEARCH §Calendar, UI-SPEC A-8: classNames Tailwind 매핑) |
| `place-sheet.tsx` 드래그 물리 | component | pointer events | non-modal 드래그 시트 선례 없음 — RESEARCH Pattern 7 + UI-SPEC §Interaction Contract가 스펙. 시각 언어만 bottom-sheet.tsx 미러 |
| 온보딩 브라우저 뒤로가기 (D-02) | hook | — | history.pushState/popstate 처리 선례 없음 — RESEARCH Pitfall 6 최소 구현 권고(과설계 금지) |

postgres_changes도 레포 최초지만 poll-vote-island의 채널 lifecycle이 partial analog로 커버 — 위 §Realtime 참조.

## Metadata

**Analog search scope:** `apps/web/app`, `apps/web/components`, `apps/web/lib`, `apps/web/__tests__`, `packages/api/src/queries`, `packages/core/src`, `packages/ui-tokens/src`, `supabase/migrations`, `supabase/functions/resolve-place`
**Files scanned:** 26 read (targeted), 60+ listed
**Pattern extraction date:** 2026-07-08
