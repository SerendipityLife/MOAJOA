# Phase 20: Affiliate Booking (딥링크 제휴 예약) - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 20 new/modified files
**Analogs found:** 18 / 20 (2 patterns have no codebase analog — RESEARCH patterns apply)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0021_booking.sql` (new) | migration | DDL + RLS | `supabase/migrations/0017_plans.sql` + `0016` L582-606 | exact |
| `packages/core/src/booking.ts` (modify) | utility (URL 조립) | transform | itself (17-02 locked shape) | exact |
| `packages/core/src/booking.test.ts` (extend) | test | — | itself (15 케이스 무파손) | exact |
| `packages/core/src/booking-map.ts` (new) | config/constants | static lookup | `packages/core/src/constants.ts` `CITY_KO_MAP` L148-158 | exact |
| `packages/core/src/checklist.ts` (new) | utility (schema + 순수 파생) | transform | `booking.ts` (Zod idiom) + `category.ts` (pure resolver) | role-match |
| `packages/core/src/checklist.test.ts` (new) | test | — | `packages/core/src/booking.test.ts` | exact |
| `packages/core/src/category.ts` (modify) | utility | transform | `placeVibe` in same file | exact |
| `packages/core/src/index.ts` (modify) | barrel | — | itself (surgical append) | exact |
| `packages/api/src/queries/bookings.ts` (new) | service (query wrapper) | CRUD | `packages/api/src/queries/plans.ts` + `date-polls.ts` | exact |
| `packages/api/src/queries/bookings.test.ts` (new) | test | — | `packages/api/src/queries/plans.test.ts` (makeChain) | exact |
| `packages/api/src/queries/index.ts` (modify) | barrel | — | itself (surgical append) | exact |
| `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (modify) | screen | request-response | 19-03 dateless 관리카드 분기, same file L533-739 | exact |
| `apps/ios/app/trip/[id]/(tabs)/book.tsx` (rewrite) | screen | CRUD | `plan.tsx` States A–F 상태머신 + 기존 stub 빈 상태 레이아웃 | role-match |
| `apps/ios/components/booking/compare-frame-card.tsx` (new) | component | request-response | `apps/ios/components/plan/plan-item-row.tsx` (`LegPill` = [보기] 버튼 스타일) | role-match |
| `apps/ios/components/booking/checklist-row.tsx` (new) | component | CRUD | `apps/ios/components/plan/plan-item-row.tsx` (row 전체 구조) | exact |
| `apps/ios/lib/booking.ts` or 인라인 클릭 핸들러 (new) | utility | event-driven (fire-and-forget) | `apps/ios/components/boards/pin-sheet.tsx` `onOpenSource` L82-99 | role-match |
| `apps/ios/app/me.tsx` (modify — 제휴 안내) | screen | static | itself (card section idiom L179-208) | exact |
| `apps/ios/__tests__/booking-*.test.tsx` (new) + `plan.test.tsx` (extend) | test | — | `apps/ios/__tests__/plan.test.tsx` (jest.mock 하네스 + 19-03 케이스) | exact |
| supabase-js wave: root `package.json` + `packages/api`/`apps/web`/`apps/ios` `package.json` | config | — | root `package.json` `pnpm.overrides` L32-37 | exact |
| env 배선: `apps/ios/app.config.ts` extra (+ `.env.local.example`) | config | — | `app.config.ts` L87-89 idiom | exact |

## Pattern Assignments

### `supabase/migrations/0021_booking.sql` (migration, DDL + RLS)

**Analog:** `supabase/migrations/0017_plans.sql` (신규 테이블 + RLS + trigger 재사용) + `supabase/migrations/0016_trips_baseline.sql` L582-606 (booking_clicks 원형)

**Header + table + RLS pattern** (`0017_plans.sql` lines 1-30):
```sql
-- 0017_plans.sql — Phase 18 Auto Plan (PLAN-01..05, CONTEXT D-12/D-14).
-- plans + plan_items. RLS REUSES 0016 can_read_trip/can_edit_trip DEFINER helpers
-- (no new direct cross-table EXISTS — 42P17 recursion guard, CLAUDE.md §4.4).
-- Append-only: 0016 is NEVER modified.

create table plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  status text not null default 'draft' check (status in ('generating', 'draft')),
  ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One draft plan per trip (Open Q4 / D-11 overwrite). Partial unique mirrors places_trip_idx.
create unique index plans_one_draft_per_trip on plans (trip_id) where status = 'draft';
create index plans_trip_idx on plans (trip_id);

-- set_updated_at() already defined in 0016 (L38-46) — reuse, do not redefine.
create trigger plans_set_updated_at
  before update on plans
  for each row execute function set_updated_at();

alter table plans enable row level security;
create policy "plans: read if can read trip"  on plans for select to authenticated using (can_read_trip(trip_id));
create policy "plans: insert if can edit trip" on plans for insert to authenticated with check (can_edit_trip(trip_id));
create policy "plans: update if can edit trip" on plans for update to authenticated using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));
create policy "plans: delete if can edit trip" on plans for delete to authenticated using (can_edit_trip(trip_id));
```
→ `booking_checklist_items`는 이 정책 4종을 그대로 복사 (SELECT=`can_read_trip`, write 3종=`can_edit_trip` — D-12). partial unique 2개(싱글턴 `(trip_id, kind)` / activity `(trip_id, place_id)`)는 `plans_one_draft_per_trip` 형태를 복사. **주의:** `plan_id`/`plan_item_id` FK 금지 (RESEARCH Pitfall 3).

**기존 테이블에 대한 additive 변경 pattern** (`0017_plans.sql` lines 61-66 — 0016 무수정, drop+add constraint):
```sql
-- ---- extraction_costs: allow Routes provider (additive, D-12) ----------------
-- 0016 L564 defines provider check (provider in ('anthropic', 'google_places')).
alter table extraction_costs drop constraint extraction_costs_provider_check;
alter table extraction_costs add constraint extraction_costs_provider_check
  check (provider in ('anthropic', 'google_places', 'google_routes'));
```
→ booking_clicks에 `click_token` NULLABLE 컬럼 + `checklist_item_id` nullable FK + INSERT/멤버 SELECT 정책 추가가 같은 결(0016 원본 무수정, 0021에서 alter/새 policy만).

**booking_clicks 원형** (`0016_trips_baseline.sql` lines 587-606 — 컬럼·정책명 스타일):
```sql
create table booking_clicks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  created_at timestamptz not null default now()
);
...
create policy "booking_clicks: trip owner can read"
  on booking_clicks for select
  to authenticated
  using (am_trip_owner(trip_id));
```
→ 0021 신규 INSERT 정책은 `with check (user_id = auth.uid() and can_read_trip(trip_id))`, 멤버 SELECT는 `using (can_read_trip(trip_id))` (RESEARCH Pitfall 4). 마이그레이션 후 `pnpm supabase:types` 재생성 (CLAUDE.md §4.3).

---

### `packages/core/src/booking.ts` (utility, transform) — 실규격 채움 + `buildDirectSearchUrl` 신설

**Analog:** itself — 17-02가 시그니처·토큰 가드를 락. PLACEHOLDER 분기만 교체.

**현재 형태 — 유지해야 할 가드** (`booking.ts` lines 23-36):
```typescript
export function buildAffiliateUrl(
  provider: AffiliateProviderType,
  productParams: Record<string, string>,
  subId: ClickToken,
): string {
  const token = ClickTokenSchema.parse(subId); // structurally guarantees a valid token is present
  if (provider === 'travelpayouts') {
    const sp = new URLSearchParams({ ...productParams, sub_id: token });
    return `https://tp.st/PLACEHOLDER?${sp.toString()}`;
  }
  // stay22: fixed aid (Phase 20 env) + campaign carries the token + claimed domain.
  const sp = new URLSearchParams({ ...productParams, campaign: token });
  return `https://www.stay22.com/allez/PLACEHOLDER?${sp.toString()}`;
}
```
→ travelpayouts 분기만 RESEARCH 실규격(marker-dot + redirect 엔드포인트 + `&sub_id={token}` 동시 주입)으로 교체. **시그니처·`ClickTokenSchema.parse` 첫 줄·stay22 분기 무수정.** 숙소 비제휴는 같은 파일에 `buildDirectSearchUrl(provider: 'agoda'|'booking', params)` 별도 export (booking.ts 밖 URL 리터럴 0 유지 — Pitfall 1 grep 가드).

**계약 테스트 — 깨지 말 것** (`booking.test.ts` lines 73-77, 91-95):
```typescript
it("travelpayouts: contains the subId AND 'sub_id'", () => {
  const url = buildAffiliateUrl('travelpayouts', { p: '1' }, 'c_aB3xY9zQ');
  expect(url).toContain('c_aB3xY9zQ');
  expect(url).toContain('sub_id');
});
...
it('rejects a non-ClickToken subId at runtime (parsed through ClickTokenSchema)', () => {
  expect(() => buildAffiliateUrl('travelpayouts', { p: '1' }, 'bad.token')).toThrow();
});
```
→ 신규 케이스(한글 장소명 인코딩, buildDirectSearchUrl 날짜 프리필)는 이 `describe`/`it` 스타일 + UUID fixture 상수(L9-11) idiom으로 추가.

---

### `packages/core/src/booking-map.ts` (config/constants, static lookup)

**Analog:** `packages/core/src/constants.ts` — `CITY_KO_MAP` 블록

**정적 매핑 pattern** (`constants.ts` lines 140-158):
```typescript
/**
 * city_code → Korean display name (ko-KR only — I18N-01 v2).
 * Shared between web (OG image, meta description) and iOS.
 * Per Phase 4 CONTEXT D-09 + UI-SPEC §"Open Items".
 *
 * If a board's city_code is missing from this map, callers should gracefully
 * omit the city line (per D-09 "city 없으면 omit").
 */
export const CITY_KO_MAP: Readonly<Record<string, string>> = {
  tokyo: '도쿄',
  osaka: '오사카',
  kyoto: '교토',
  seoul: '서울',
  busan: '부산',
  jeju: '제주',
  fukuoka: '후쿠오카',
  sapporo: '삿포로',
  okinawa: '오키나와',
} as const;
```
→ `BOOKING_REGION_MAP`은 이 9개 city_code 키와 정합해야 함(커버 안 되는 도시 = 카드 숨김, D-09 "missing → omit" 동일 계약). 비교 라벨 상수(Klook/KKday/Agoda/Booking 정적 문구)도 이 파일 소유 — UI가 provider copy를 하드코딩하지 않게 (UI-SPEC Cross-Screen note). why-주석 + `as const` + `Readonly<Record<...>>` idiom 복사.

---

### `packages/core/src/checklist.ts` (utility, schema + 순수 파생)

**Analog:** `packages/core/src/booking.ts` (Zod schema 모듈 shape) + `packages/core/src/category.ts` (순수 판정 함수)

**Zod schema 모듈 pattern** (`booking.ts` lines 1-16):
```typescript
import { z } from 'zod';

/** Trip-scoped click context — Phase 20 mints this into booking_clicks. placeId optional (D-04). */
export const BookingClickContextSchema = z.object({
  tripId: z.string().uuid(),
  placeId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
});
export type BookingClickContext = z.infer<typeof BookingClickContextSchema>;

export const AffiliateProvider = ['travelpayouts', 'stay22'] as const;
export type AffiliateProviderType = (typeof AffiliateProvider)[number];
```
→ `ChecklistItemSchema`(kind/status/source enum은 0021 CHECK와 짝) + `deriveChecklistAutos` 순수함수. enum은 `['todo','clicked','done'] as const` + indexed-access type idiom.

---

### `packages/core/src/category.ts` (modify) — `isBookableActivity` surgical append

**Analog:** `placeVibe` in same file (lines 23-31):
```typescript
export function placeVibe(category: string | null | undefined): Vibe {
  if (!category) return 'other';
  const c = category.toLowerCase();
  if (VIBE_KEYS.has(c as Vibe)) return c as Vibe;
  for (const [vibe, needles] of RULES) {
    if (needles.some((n) => c.includes(n))) return vibe;
  }
  return 'other';
}
```
→ `isBookableActivity(category)`는 `placeVibe` 결과 기반이 가장 단순 (D-08: culture 계열 = 관광명소·테마파크; food/cafe 제외). **기존 `RULES`/`placeVibe`/`VIBE_META` 무수정 — 파일 하단 append만.** 참고: iOS 렌더는 `@/lib/category`의 `vibeOf`를 쓰지만(plan-item-row L15), 판정 함수는 core 소유 (RESEARCH Responsibility Map — web 재사용 대비).

**Barrel append** (`packages/core/src/index.ts` — 전체 6줄):
```typescript
export * from './schemas/index';
export * from './types/index';
export * from './constants';
export * from './category';
export * from './entry-route';
export * from './booking';
```
→ `export * from './booking-map';` + `export * from './checklist';` 2줄 append.

---

### `packages/api/src/queries/bookings.ts` (service, CRUD)

**Analog:** `packages/api/src/queries/plans.ts` — house 계약의 정본 (client-first arg, `{ error } throw`, RLS-only, 클라 측 멤버십 중복 체크 금지)

**Imports + 헤더 주석 pattern** (`plans.ts` lines 1-9 + doc 스타일 L14-24):
```typescript
import type {
  Plan,
  PlanItem,
  ...
} from '@moajoa/core';
import type { MoajoaSupabaseClient } from '../client';

/**
 * ... RLS: `can_read_trip()` SECURITY DEFINER helper (0016) gates the select and
 * additionally filters rows the user can't read — the wrapper does no extra
 * client-side membership check (T-18-17, mirrors listPlacesByTrip).
 */
```

**Read pattern** (`plans.ts` lines 25-37 — `maybeSingle` + null 반환):
```typescript
export async function getPlanByTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<PlanWithItems | null> {
  const { data, error } = await client
    .from('plans')
    .select('*, plan_items(*)')
    .eq('trip_id', tripId)
    .eq('status', 'draft')
    .maybeSingle();
  if (error) throw error;
  return (data as PlanWithItems | null) ?? null;
}
```

**Write pattern** (`plans.ts` lines 118-129 — insert + `.select('*').single()` 반환):
```typescript
export async function moveToDay(
  client: MoajoaSupabaseClient,
  input: { plan_id: string; place_id: string; day_index: number; sort_order: number },
): Promise<PlanItem> {
  const { data, error } = await client
    .from('plan_items')
    .insert({ ...input, is_anchor: false, leg_travel_seconds: null })
    .select('*')
    .single();
  if (error) throw error;
  return data as PlanItem;
}
```

**List + delete pattern** (`date-polls.ts` lines 166-201 — `.order()` 목록, `.delete().eq()`):
```typescript
export async function getPollOptions(client, pollId): Promise<PollOption[]> {
  const { data, error } = await client
    .from('date_poll_options')
    .select('id, start_date, end_date')
    .eq('poll_id', pollId)
    .order('start_date');
  if (error) throw error;
  return (data as PollOption[] | null) ?? [];
}

export async function removePollOption(client, optionId): Promise<void> {
  const { error } = await client.from('date_poll_options').delete().eq('id', optionId);
  if (error) throw error;
}
```
→ `listChecklist`/`setItemStatus`/`addManualItem`/`deleteItem`/`reconcileChecklist`가 전부 이 4가지 shape 조합. `logBookingClick`만 예외 — 호출부가 `.catch(() => {})` fire-and-forget이지만 **wrapper 자체는 다른 함수와 동일하게 `{ error } throw`** (삼키는 쪽은 iOS 호출부, Pattern 아래 참조). barrel `queries/index.ts`(7줄)에 `export * from './bookings';` append.

---

### `packages/api/src/queries/bookings.test.ts` (test)

**Analog:** `packages/api/src/queries/plans.test.ts` — makeChain 하네스 복사 (RESEARCH Wave 0 지시)

**하네스** (`plans.test.ts` lines 30-55):
```typescript
type MockChain = Record<string, any>;

function makeChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {};
  const methods = ['select', 'eq', 'is', 'order', 'update', 'insert', 'delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return chain;
}

function makeClient(opts?) {
  const result = opts?.result ?? { data: {}, error: null };
  const chain = makeChain(result);
  const from = vi.fn(() => chain);
  const invoke = vi.fn(() => Promise.resolve(invokeResult));
  const client = { from, functions: { invoke } } as unknown as MoajoaSupabaseClient;
  return { client, from, chain, invoke };
}
```

**케이스 shape** (`plans.test.ts` lines 57-73 — 쿼리 shape 단언 + `{ error }` throw 단언):
```typescript
it("reads from('plans'), selects plan_items, scopes by trip_id and draft status", async () => {
  const { client, from, chain } = makeClient({ result: { data: {...}, error: null } });
  await getPlanByTrip(client, TRIP);
  expect(from).toHaveBeenCalledWith('plans');
  expect(chain.eq).toHaveBeenCalledWith('trip_id', TRIP);
});

it('throws when the mock returns { error }', async () => {
  const { client } = makeClient({ result: { data: null, error: { message: 'boom' } } });
  await expect(getPlanByTrip(client, TRIP)).rejects.toBeTruthy();
});
```
→ upsert를 쓰면 makeChain `methods` 배열에 `'upsert'` 추가.

---

### `apps/ios/app/trip/[id]/(tabs)/plan.tsx` (screen, modify) — 여행 준비 클러스터 + 액티비티 strip

**Analog:** 같은 파일의 19-03 dateless 관리카드 분기 — "기존 상태머신 무수정 조건 분기 삽입"의 검증된 선례

**조건 분기 + 상호배타 게이트 pattern** (`plan.tsx` lines 188-190, 533-544):
```typescript
// D-05: load the poll meta + tally ONLY when the trip is dateless (no start_date).
const isDateless = !!trip && !trip.start_date;
...
// Phase 19 (D-05) — 날짜 투표 management card. Rendered ONLY when the trip is
// dateless (no start_date) AND the poll is still open. After 확정, the trip gets
// dates → !isDateless → this branch falls through to the normal plan render.
if (isDateless && poll && poll.status !== 'closed') {
```
→ Phase 20 게이트는 정반대 조건: `plan !== null && trip.start_date` (D-04) — 19 카드와 상호배타라 충돌 없음.

**삽입 지점 — UI-SPEC이 지정한 seam** (`plan.tsx` lines 904-921, State D/E render):
```tsx
{/* Travel-mode toggle (plan scope) */}
<View className="mt-4">
  <TravelModeToggle mode={plan.travel_mode} onChange={onChangeMode} />
</View>
                                          {/* ← 여행 준비 클러스터는 여기 (L907과 L910 사이) */}
{/* Day sections */}
{dayBuckets.map((items, di) => (
  <DaySection key={di} dayIndex={di} ... />
))}
```
액티비티 compact strip은 day 목록 안 예약성 항목 아래 — `DaySection`(`components/plan/day-section.tsx`) 또는 map 콜백에 `isBookableActivity(place.category)` 분기 (planner가 seam 선택, UI-SPEC Screen 2).

**병렬 load + 상태 세팅 pattern** (`plan.tsx` lines 170-186 — 체크리스트 fetch를 끼울 자리):
```typescript
const load = useCallback(async () => {
  if (!id) return;
  try {
    const [t, ps, pl] = await Promise.all([
      getTrip(supabase, id),
      listPlacesByTrip(supabase, id),
      getPlanByTrip(supabase, id),
    ]);
    setTrip(t); setPlaces(ps); setPlan(pl);
  } catch (err) {
    console.error(err);
  } finally {
    setLoaded(true);
  }
}, [id]);
```

---

### `apps/ios/app/trip/[id]/(tabs)/book.tsx` (screen, rewrite) — 체크리스트 홈

**Analog:** `plan.tsx` States A–F 상태머신 (early-return 분기 사슬) + 기존 `book.tsx` stub (빈 상태 레이아웃 재사용)

**빈 상태 레이아웃 — 그대로 재사용** (`book.tsx` lines 10-22, 현 stub 전문):
```tsx
<SafeAreaView edges={['bottom']} className="flex-1 bg-white">
  <View className="flex-1 items-center justify-center px-8">
    <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
      <Ionicons name="bed-outline" size={36} color="#D1D5DB" />
    </View>
    <Text className="text-xl font-semibold text-neutral-500">예약은 곧 제공돼요</Text>
    <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
      플랜이 정해지면 숙소·교통을 여기서 한 번에 예약할 수 있어요.
    </Text>
  </View>
</SafeAreaView>
```
→ empty-dateless / empty-no-plan 두 상태가 이 레이아웃 + UI-SPEC 카피. 로딩/에러/목록 분기는 `plan.tsx`의 early-return 사슬(L525-531 로딩 → L819-837 에러 State F → 본 렌더) 순서를 복사.

**로딩 상태** (`plan.tsx` lines 525-531):
```tsx
if (!loaded) {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator color="#2979FF" />
    </SafeAreaView>
  );
}
```

**에러 + 다시 시도 (State F)** (`plan.tsx` lines 819-837):
```tsx
if (error) {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
          <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
        </View>
        <Text className="text-base text-neutral-500 text-center leading-relaxed">{error}</Text>
        <Pressable onPress={...} className="bg-brand-500 mt-6 px-6 py-3 rounded-lg items-center justify-center" style={{ minHeight: 44 }}>
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

**수동 추가 시트 — @gorhom/bottom-sheet idiom** (`plan.tsx` lines 703-723, 19-03 확정 시트):
```tsx
<BottomSheet
  ref={confirmSheetRef}
  index={-1}
  snapPoints={['55%']}
  enablePanDownToClose
  onClose={() => setConfirmOpen(false)}
  backgroundStyle={{ backgroundColor: '#fff' }}
>
  <BottomSheetView>
    {confirmOpen && (
      <View className="px-6 pt-2 pb-8 bg-white">
        <Text className="text-lg font-semibold text-neutral-900">날짜 확정</Text>
        ...
      </View>
    )}
  </BottomSheetView>
</BottomSheet>
```
(ref 열기/닫기 콜백 idiom은 L485-492 `openConfirm`/`closeConfirm`.)

**삭제 destructive confirm** (`plan.tsx` lines 297-305 `onRegenerate`):
```typescript
Alert.alert(
  '플랜을 다시 만들까요?',
  '초안을 다시 만들면 지금까지 편집한 내용이 사라져요. ...',
  [
    { text: '취소', style: 'cancel' },
    { text: '다시 만들기', style: 'destructive', onPress: () => void runGenerate(anchorIds) },
  ],
);
```
→ "이 항목을 삭제할까요?" (UI-SPEC)가 같은 shape.

---

### `apps/ios/components/booking/compare-frame-card.tsx` + `checklist-row.tsx` (components)

**Analog:** `apps/ios/components/plan/plan-item-row.tsx` — 리스트 row 카드의 정본

**파일 헤더 + ROW_SHADOW + row 골격** (`plan-item-row.tsx` lines 17-24, 40-71):
```typescript
// Same opacity-light card shadow as place-list.tsx (visual continuity).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;
```
```tsx
<View style={ROW_SHADOW} className="bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center">
  {/* leading icon chip */}
  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: vibe.tint }}>
    <Ionicons name={vibe.icon} size={18} color={vibe.color} />
  </View>
  {/* title block */}
  <View className="flex-1 px-3">
    <View className="flex-row items-center">
      <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
        {place.name_ko ?? place.name_local}
      </Text>
      {isAnchor && (
        <View className="flex-row items-center ml-2 px-1.5 py-0.5 rounded-full bg-brand-50">
          <Ionicons name="star" size={9} color="#2563EB" />
          <Text className="text-[10px] text-brand-600 ml-0.5">필수</Text>
        </View>
      )}
    </View>
    <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>{subtitle}</Text>
  </View>
  {/* trailing 44px hit controls */}
  <Pressable onPress={onToggleAnchor} hitSlop={8} className="w-11 h-11 items-center justify-center"
    accessibilityRole="button" accessibilityLabel={...}>
    <Ionicons name={isAnchor ? 'star' : 'star-outline'} size={20} color={isAnchor ? '#2979FF' : '#9CA3AF'} />
  </Pressable>
</View>
```
→ checklist-row = 이 골격 그대로 (status control이 drag handle 자리, kind chip은 `bg-neutral-100` + `neutral-600` glyph — UI-SPEC은 vibe tint가 아닌 neutral chip 지정). '확인함'/'플랜에 없음' 배지 = 위 `필수` 태그 chip idiom (`bg-brand-50 text-[10px] text-brand-600` / neutral 변형).

**[보기] 버튼 = LegPill stadium chip idiom** (`plan-item-row.tsx` lines 117-135):
```tsx
<View className={`flex-row items-center px-2.5 py-1 rounded-full ${present ? 'bg-brand-50' : 'bg-neutral-100'}`}>
  <Ionicons name={...} size={11} color={present ? '#2563EB' : '#9CA3AF'} />
  <Text className={`text-xs ml-1 ${present ? 'text-brand-600' : 'text-neutral-400'}`}>
    {present ? `${minutes}분` : '이동시간 —'}
  </Text>
</View>
```
→ `bg-brand-50 rounded-full` + `text-xs font-semibold text-brand-600` + `hitSlop`(≥44px) + `accessibilityRole="button"` (UI-SPEC Component 0). 가격 슬롯 = 라벨과 [보기] 사이 `<View className="flex-1" />`.

**Props 인터페이스 + 콜백 doc 스타일** (`plan-item-row.tsx` lines 26-33):
```typescript
interface Props {
  place: Place;
  isAnchor: boolean;
  /** Toggle 필수 anchor (D-10) — does NOT recluster until regenerate. */
  onToggleAnchor: () => void;
  /** 제거 → return to 미배치 pool (D-13, reversible). */
  onRemove: () => void;
}
```

---

### 클릭 핸들러 (mint → open → log, D-14)

**Analog (오픈 + fire-and-forget):** `apps/ios/components/boards/pin-sheet.tsx` lines 82-99 — 코드베이스 유일의 `Linking.openURL` 사용처:
```typescript
function onOpenSource() {
  if (videoId) {
    Linking.openURL(
      `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startSec)}s`,
    ).catch(() => {});
    return;
  }
  if (link) {
    Linking.openURL(link.url).catch(() => {});
    return;
  }
  Linking.openURL(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(shown!.name_local)}`,
  ).catch(() => {});
}
```
→ `.catch(() => {})` 삼키기 idiom이 이미 하우스 스타일. Phase 20 핸들러는 `Linking.openURL(url)` **뒤에** `logBookingClick(...).catch(() => {})` — 절대 await로 오픈을 블록하지 않음 (RESEARCH Pattern 1이 전체 개념 코드 제공; 토큰 mint는 아래 "No Analog" 참조).

**Analog (복귀 refetch, D-15):** `apps/ios/app/_layout.tsx` lines 39-54 — AppState 'active' 전이 리스너:
```typescript
useEffect(() => {
  if (!ready) return;
  runDrain(); // cold launch
  const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') runDrain();
  });
  return () => {
    // Pitfall 4: arrow-wrap sub.remove() so `this` binding on the emitter
    // is preserved during hot reload + unmount.
    sub.remove();
  };
}, [ready]);
```
→ book 탭의 "앱 복귀 시 조용한 refetch"가 이 리스너 idiom (inFlight ref 가드 L18-33 포함).

---

### `apps/ios/app/me.tsx` (modify) — 제휴 안내 섹션

**Analog:** 같은 파일 카드 섹션 idiom (lines 179, 213):
```tsx
<View className="bg-white rounded-3xl p-5 mb-4" style={cardShadow}>
  ...
</View>
```
→ 신규 static 섹션: heading `text-base font-semibold text-neutral-900` + body `text-sm text-neutral-500 leading-relaxed` (UI-SPEC Screen 5). 기존 프로필 카드들 아래 surgical append — 다른 섹션 무수정.

---

### iOS 테스트 (extend `plan.test.tsx` + 신규 booking 컴포넌트 테스트)

**Analog:** `apps/ios/__tests__/plan.test.tsx` — jest.mock 하네스 + 19-03 조건 렌더 케이스 선례

**Mock 하네스** (`plan.test.tsx` lines 17, 45-106 — 복사 대상 mock 목록):
```typescript
jest.mock('@moajoa/api', () => ({ ... }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@gorhom/bottom-sheet', () => { ... });
jest.mock('react-native-reanimated', () => { ... });
jest.mock('react-native-gesture-handler', () => ({ ... }));
jest.mock('@/lib/realtime', () => ({ ... }));
jest.mock('@/lib/supabase', () => ({ supabase: { removeChannel: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));
```

**조건 렌더 케이스 shape** (`plan.test.tsx` lines 210, 220, 299):
```typescript
test('dateless + open poll renders the 날짜 투표 management card with the empty-state summary', async () => {
  ...
  await waitFor(() => expect(getByText('날짜 투표 진행 중')).toBeTruthy());
});
...
expect(queryByText('날짜 투표 진행 중')).toBeNull();
```
→ 인라인 카드 게이트(D-04) 케이스가 같은 positive/negative 쌍. ATTR-02 오픈-선행 계약 테스트는 `expo-linking` mock + `expect(openURL).toHaveBeenCalledBefore/without awaiting log` 방식 — `jest.mock('expo-linking', ...)` 추가. 실행: `pnpm --filter @moajoa/ios test -- --watchman=false`.

---

### supabase-js 업그레이드 wave (독립 plan — 예약 코드와 커플링 금지)

**Analog:** root `package.json` lines 32-37 — 정확 핀 override가 함정의 원천 (RESEARCH Pitfall 5):
```json
"pnpm": {
  "overrides": {
    "@supabase/supabase-js": "2.45.4",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
```
**접점 4 + 1 파일 (실측 라인):**
- root `package.json` L34 — override `2.45.4` → `2.110.0` (미갱신 시 조용한 no-op)
- `packages/api/package.json` L21 — `"@supabase/supabase-js": "^2.45.4"` → `^2.110.0`
- `apps/web/package.json` L23-24 — `"@supabase/ssr": "^0.5.1"` → `^0.12.0` + supabase-js `^2.110.0` (peer 짝, Pitfall 6)
- `apps/ios/package.json` L27 — `^2.45.4` → `^2.110.0`
- `pnpm-lock.yaml` — `pnpm install` 재생성. Acceptance: `pnpm why @supabase/supabase-js`가 2.110.0 해석 + 기존 테스트 베이스라인(core 77/api 35/web 65/ios 87) green.

---

### env 배선 (Travelpayouts marker/trs)

**Analog:** `apps/ios/app.config.ts` lines 87-89 — `EXPO_PUBLIC_*` → `extra` idiom:
```typescript
supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://moajoa.app',
```
**소비 측 analog** (`plan.tsx` lines 464-469):
```typescript
const base =
  (Constants.expoConfig?.extra?.webUrl as string | undefined)?.replace(/\/+$/, '') ??
  'https://moajoa.app';
```
→ `EXPO_PUBLIC_TP_MARKER`/`EXPO_PUBLIC_TP_TRS`를 같은 결로 (marker는 공개값 — 클라 노출 OK가 CONTEXT 판단 사항). `.env.local.example`에 placeholder 추가 (실값 커밋 금지, CLAUDE.md §4.7). 프로그램 구조 상수(promo_id 4110 / p 8310 / campaign_id 541)는 env가 아니라 core 상수 (RESEARCH Anti-pattern 5).

## Shared Patterns

### RLS — SECURITY DEFINER 헬퍼 경유
**Source:** `supabase/migrations/0017_plans.sql` lines 27-30
**Apply to:** 0021의 모든 정책 (booking_checklist_items 4종 + booking_clicks 신규 2종)
```sql
create policy "plans: read if can read trip"  on plans for select to authenticated using (can_read_trip(trip_id));
create policy "plans: insert if can edit trip" on plans for insert to authenticated with check (can_edit_trip(trip_id));
```
trip_id 직참조 테이블이므로 헬퍼 직호출 (plan_items의 EXISTS-경유 shape 불필요 — Pitfall 3의 trip-scoped 설계 덕).

### 쿼리 래퍼 house 계약 — `{ error } throw`, client-first, 중복 체크 금지
**Source:** `packages/api/src/queries/plans.ts` (전 함수 동일 shape)
**Apply to:** bookings.ts 모든 함수
```typescript
const { data, error } = await client.from('...').…;
if (error) throw error;
return data as T;
```
RLS가 유일한 게이트 — 클라 측 멤버십 검사 추가 금지 (T-18-17 선례, RESEARCH Don't Hand-Roll).

### 에러 삼키기 vs 표출 구분
**Source:** `plan.tsx` L181 (`console.error` + 표면 유지), L196 (`console.warn` 보조 데이터), `pin-sheet.tsx` L89 (`.catch(() => {})` 논블로킹 오픈)
**Apply to:** 체크리스트 로드 실패 = State F 에러 표면 / 클릭 로깅 실패 = 완전 침묵 (D-14, UI-SPEC "Error state NONE — silent")

### 44px 터치 타깃 + accessibility
**Source:** `plan-item-row.tsx` L74-86 (`w-11 h-11` + `hitSlop={8}` + `accessibilityRole`/`accessibilityLabel`), `plan.tsx` L581 (`style={{ minHeight: 44 }}`)
**Apply to:** status control, [보기], chevron, 삭제 — 모든 탭 가능 요소

### Barrel surgical append
**Source:** `packages/core/src/index.ts` (6줄), `packages/api/src/queries/index.ts` (7줄)
**Apply to:** 신규 core 모듈 2개 + api bookings.ts — 기존 줄 무수정, 하단 append만

### 상수 why-주석 + `as const` idiom
**Source:** `constants.ts` CITY_KO_MAP·PollKeys·PLAN_STEP_KO 블록 (기존 상수 무수정, phase별 하단 append 이력이 곧 컨벤션)
**Apply to:** booking-map.ts 상수, TP_PROGRAMS 상수, checklist enum

## No Analog Found

Files/patterns with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File/Pattern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| 클릭 토큰 mint (`expo-crypto` `getRandomValues` → base62) | utility | transform | 코드베이스에 expo-crypto 사용처 0건 (패키지는 설치됨 — `apps/ios/package.json` L32). RESEARCH Pattern 1의 `mintClickToken` 개념 코드가 정본 |
| Travelpayouts redirect URL 규격 (marker-dot, c137/tp.media) | — | — | 신규 외부 계약 — RESEARCH "검증된 딥링크 규격" 섹션이 라이브 실측 정본 (marker 745749) |

## Metadata

**Analog search scope:** `packages/core/src`, `packages/api/src/queries`, `supabase/migrations`, `apps/ios/app`, `apps/ios/components`, `apps/ios/lib`, `apps/ios/__tests__`, root/워크스페이스 package.json
**Files scanned:** 22 read (plan.tsx 전문 포함), 4 grep/glob 배치
**Pattern extraction date:** 2026-07-02
