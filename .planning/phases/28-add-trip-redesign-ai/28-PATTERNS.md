# Phase 28: Add-Trip Redesign (트리플 룩 위저드 + 웹 AI 일정) - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 16 (신규 7 · 수정 9)
**Analogs found:** 15 / 16

---

## File Classification

| 신규/수정 파일 | Role | Data Flow | 최근접 Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/0031_trip_day_count.sql` (신규) | migration | schema-DDL | `supabase/migrations/0025_*.sql` (companion/share_mode additive column) | exact |
| `packages/core/src/schemas/trip.ts` (수정) | model/schema | validation | 동일 파일 내 `companion` 필드 선례 (0025 짝) | exact |
| `packages/core/src/schemas/plan.ts` (수정, D-21 시) | model/schema | validation | 동일 파일 `GeneratePlanRequestSchema` (`.default([])` idiom) | exact |
| `packages/api/src/queries/trips.ts` (수정) | service/query | CRUD | 동일 파일 `updateTrip` 조건부 spread 패턴 | exact |
| `packages/api/src/types/database.ts` (재생성) | types | typegen | `pnpm supabase:types` (수기 편집 금지) | n/a |
| `supabase/functions/generate-plan/index.ts` (수정 2줄) | edge function | request-response | 동일 파일 L104-108 select · L158 dayCount | exact |
| `apps/web/app/onboarding/page.tsx` (수정) | page/orchestrator | 상태소유 wizard | 자기 자신(구조 유지, 렌더만 교체) | exact |
| `apps/web/app/onboarding/_components/step-where.tsx` (수정) | component | props-driven | `step-who.tsx`(동일 Chip 패턴) | exact |
| `apps/web/app/onboarding/_components/step-who.tsx` (수정) | component | props-driven | `step-where.tsx` | exact |
| `apps/web/app/onboarding/_components/step-dates.tsx` (수정) | component | props-driven | 자기 자신(캘린더 유지, pill 추가) | exact |
| `apps/web/app/onboarding/_components/duration-pills.tsx` (신규) | component | props-driven | `step-who.tsx` COMPANION_PRESETS 맵 렌더 | role-match |
| `apps/web/components/select-pill.tsx` (신규) | component | props-driven | `apps/web/components/chip.tsx` (anatomy만 참조, 확장 아님) | role-match |
| `apps/web/app/moa/[id]/_components/plan-section.tsx` (신규) | component | CRUD + 상태기계 | **`apps/ios/app/trip/[id]/(tabs)/plan.tsx`** (READ-ONLY) + `place-list.tsx` | role-match |
| `apps/web/app/moa/[id]/_components/duration-gate-sheet.tsx` (신규) | component | request-response | `add-sheet.tsx` (BottomSheet + 콘텐츠 + mutation) | exact |
| `apps/web/app/moa/[id]/_components/day-select-sheet.tsx` (신규) | component | request-response | `add-sheet.tsx` | role-match |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` (수정) | island/state hub | event-driven + CRUD | 자기 자신(채널·reconcile 구조 유지) | exact |
| `apps/web/app/moa/[id]/_components/moa-map.tsx` (수정, additive) | component | render-diff | 자기 자신 L76-82 fitBounds | exact |
| `apps/web/app/moa/[id]/_components/place-list.tsx` (수정, additive prop) | component | props-driven | 자기 자신 L96-111 판별식 | exact |
| `apps/web/lib/marker-svg.ts` (수정, additive) | utility | pure fn | 자기 자신 `fill?` 확장 선례 | exact |
| `apps/web/app/moa/[id]/page.tsx` (수정 — `getPlanByTrip` seed) | RSC page | request-response | 자기 자신 `Promise.all` seed | exact |
| `apps/web/__tests__/plan-section.test.tsx` 등 (신규) | test | unit(jsdom) | `apps/web/__tests__/onboarding.test.tsx` (모듈 mock 레시피) | exact |

**무수정 대상(재사용만):** `apps/web/components/add-content-tabs.tsx`(HC-3), `place-sheet.tsx`(HC-5 — children 주입), `button.tsx`, `bottom-sheet.tsx`, `share-sheet.tsx`, `moa-tab-bar.tsx`.

---

## Pattern Assignments

### `supabase/migrations/0031_trip_day_count.sql` (migration, schema-DDL)

**Analog:** `supabase/migrations/0025_share_mode_companion.sql` L19-26
⚠ **번호는 0031** — `0030_poll_write_hardening.sql`이 이미 점유(RESEARCH Pitfall 1). 0016~0030 무수정.

```sql
-- Append-only: 0016..0024 are NEVER modified.
-- 1) trips 확장 (nullable = 레거시 안전, §4.3)
alter table trips add column share_mode text
  check (share_mode in ('dates','places','both'));
alter table trips add column companion text
  check (char_length(companion) <= 20);
```
→ 그대로 미러: `alter table trips add column day_count int check (day_count is null or (day_count between 1 and 30));`
헤더 주석 스타일도 `0029_public_trip_poll.sql` L1-10(목적·append-only 선언·§참조) 미러.

---

### `packages/core/src/schemas/trip.ts` (model, validation)

**Analog:** 동일 파일 — `companion`(0025 짝) 3곳 선례.

**TripSchema** (L22-24) — required-nullable 필드 idiom:
```ts
  /** What the moa share link exposes (migration 0025). Null = never moa-shared (legacy). */
  share_mode: z.enum(ShareMode).nullable(),
  /** 동행 자유 텍스트, <= 20자 (migration 0025, A3). */
  companion: z.string().max(20).nullable(),
```

**TripCreateDraftSchema** (L49-62) — 위저드 전용 계약 + refine 게이트:
```ts
export const TripCreateDraftSchema = z
  .object({
    title: z.string().min(1).max(Limits.TripTitleMax),
    city_code: z.string().max(20),
    start_date: z.string().date().nullable(),
    end_date: z.string().date().nullable(),
    companion: z.string().max(20).nullable(), // 0025 trips.companion 미러
  })
  .refine((v) => (v.start_date === null) === (v.end_date === null), { ... })
```
→ `day_count: z.number().int().min(1).nullable()` 추가.

**TripUpdateSchema** (L65-72) — pick 리스트:
```ts
export const TripUpdateSchema = TripSchema.pick({
  title: true, description: true, visibility: true,
  city_code: true, start_date: true, end_date: true,
}).partial();
```
→ `day_count: true` 추가. ⚠ TripSchema에 required 필드가 늘면 core/web/api/**ios** 픽스처 일괄 갱신 필요(Pitfall 9, 23-05 선례).

---

### `packages/api/src/queries/trips.ts` (service, CRUD)

**Analog:** 동일 파일 `updateTrip` L127-147 + `createMoaDraft` L108-125.

**조건부 spread passthrough** (L132-141) — day_count 추가 지점:
```ts
  const { data, error } = await client
    .from('trips')
    .update({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.start_date !== undefined && { start_date: patch.start_date }),
      ...(patch.end_date !== undefined && { end_date: patch.end_date }),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Trip;
```
**createMoaDraft INSERT 필드 목록** (L113-120):
```ts
    .insert({
      title: input.title,
      city_code: input.city_code,
      start_date: input.start_date,
      end_date: input.end_date,
      companion: input.companion,
    })
```
→ 두 곳 모두 `day_count` 추가(짝지어). ⚠ trips UPDATE RLS는 owner 전용(0016) — D-13 게이트는 owner에게만 노출(A-9).

---

### `supabase/functions/generate-plan/index.ts` (edge function, request-response) — 2줄

**Analog:** 자기 자신.

**select** (L104-108):
```ts
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, owner_id, start_date, end_date')
    .eq('id', trip_id)
    .maybeSingle();
```
→ `.select('id, owner_id, start_date, end_date, day_count')`

**dayCount 결정자** (L158):
```ts
    const dayCount = computeDayCount(trip.start_date, trip.end_date);
```
→ `const dayCount = trip.day_count ?? computeDayCount(trip.start_date, trip.end_date);`

**computeDayCount 원본** (L289-298 — 무수정, fallback 대상):
```ts
// Missing dates → default to 1 day (a single-day plan) so clustering still runs.
function computeDayCount(start: string | null, end: string | null): number {
  if (!start || !end) return 1;
  ...
}
```
**RequestSchema는 day_count 무추가** — 서버가 trips에서 읽는다(스푸핑 표면 0). D-21 `pinned_placements`만 RequestSchema(+ core `GeneratePlanRequestSchema` L30-35 `.default([])` idiom) 확장 대상:
```ts
export const GeneratePlanRequestSchema = z.object({
  trip_id: z.string().uuid(),
  travel_mode: z.enum(TravelMode).default('transit'),
  anchor_place_ids: z.array(z.string().uuid()).default([]),
  removed_place_ids: z.array(z.string().uuid()).default([]),
});
```
`validatePlanIds`(index.ts L184)로 사후 강제 — 기존 T-18-12 idiom 그대로.
⚠ 멱등 덮어쓰기 지점: L237 `await admin.from('plans').delete().eq('trip_id', trip_id).eq('status','draft');`

---

### `apps/web/components/select-pill.tsx` (신규 component)

**Analog(anatomy 참조만, 확장 금지 — A-2):** `apps/web/components/chip.tsx` 전문:
```tsx
export function Chip({ selected, className, type, children, ...props }: ChipProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-selected={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
        'transition-colors duration-150 ease-out',
        selected
          ? 'border-transparent bg-brand-100 text-brand-700'
          : 'border-neutral-300 bg-transparent text-neutral-700 hover:border-neutral-400',
        className,
      )}
      {...props}
    />
  );
}
```
**포커스 링 idiom은 `button.tsx` L43에서 복사:**
```tsx
'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
```
**신규 계약(UI-SPEC §SelectPill):** `min-h-14 rounded-full border-2 text-base font-semibold` · unselected `bg-neutral-100 border-transparent text-neutral-600` · selected `bg-white border-brand-500 text-brand-600` · `aria-pressed`(Chip의 `aria-selected` 아님) · `active:scale-[0.98]`.
`components/index.ts`에 export 추가(배럴 패턴):
```ts
export { Chip } from './chip';
```

---

### `apps/web/app/onboarding/page.tsx` (수정 — orchestrator)

**Analog:** 자기 자신. **상태 소유 구조 불변**(Phase 24 D-02) — 렌더 트리만 교체.

**교체 대상: 점 인디케이터** (L110-134) → chevron + `N/4` 카운터. chevron은 이미 존재하므로 유지:
```tsx
      <div className="relative flex h-14 items-center justify-center px-4">
        {step > 1 && (
          <button type="button" aria-label="뒤로" onClick={goBack}
            className="absolute left-2 grid size-11 place-items-center text-neutral-700">
            <ChevronLeft className="size-6" strokeWidth={2} />
          </button>
        )}
        <div className="flex items-center gap-1.5" aria-hidden>
          {([1, 2, 3, 4] as Step[]).map((s) => ( ... ))}   {/* ← 제거, 우측 1/4 카운터로 */}
        </div>
      </div>
```
**HEADINGS Record 확장 지점** (L24-29) → `{icon, title, subtitle}` Record:
```tsx
const HEADINGS: Record<Step, string> = {
  1: '어디로 떠나요?', 2: '언제 가요?', 3: '누구랑 가요?', 4: '봐둔 곳이 있나요?',
};
```
**canProceed** (L68-75) — step 2에 duration 분기 추가:
```tsx
  const canProceed =
    step === 1 ? city !== null && city.trim().length > 0
    : step === 2 ? dateMode === 'unset' || (dateMode === 'fixed' && range?.from != null)
    : step === 3 ? companion !== null && companion.trim().length > 0
    : true;
```
**CTA 컨테이너 무수정** (L186-196) — `disabled:bg-brand-300`은 Button primary에 이미 존재. D-05는 `className="w-full disabled:text-white"` 오버라이드로만(A-4):
```tsx
      <div className="sticky bottom-0 bg-surface-background px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <Button className="w-full" disabled={!canProceed} onClick={goNext}>다음</Button>
```
**pushState/popstate**(L46-66)·`handleSubmit`(L77-106) 무수정 — buildDraft 호출 인자에 duration만 추가.

---

### `apps/web/app/onboarding/_components/duration-pills.tsx` (신규) + `step-dates.tsx` (수정)

**Analog(맵 렌더 + 단일 선택):** `step-who.tsx` L11-37:
```tsx
const COMPANION_PRESETS = ['혼자', '연인', '친구', '가족', '동료'] as const;

export function StepWho({ value, custom, onChange }: StepWhoProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {COMPANION_PRESETS.map((label) => (
          <Chip key={label} selected={!custom && value === label}
            onClick={() => onChange(label, false)}>{label}</Chip>
        ))}
```
→ `Chip` → `SelectPill`, `flex-wrap` → `grid grid-cols-2 gap-2`. 상수:
```ts
const DURATION_OPTIONS = [
  { label: '당일치기', dayCount: 1 }, { label: '1박 2일', dayCount: 2 },
  { label: '2박 3일', dayCount: 3 }, { label: '3박 4일', dayCount: 4 },
  { label: '4박 5일', dayCount: 5 }, { label: '5박 6일', dayCount: 6 },
] as const;
```
**캘린더 보존 (D-07 — 폐기 아님, 진입점 이동):** `step-dates.tsx` L45-95 `DAY_PICKER_CLASS_NAMES` + DayPicker 블록 **그대로 유지**, `mode==='fixed'` 대신 '정확한 날짜 고르기' 버튼 뒤로 이동:
```tsx
      {mode === 'fixed' && (
        <div className="rounded-xl border border-neutral-200 bg-surface-raised p-3">
          <DayPicker mode="range" locale={ko} selected={range} onSelect={onRangeChange}
            disabled={{ before: new Date() }} classNames={DAY_PICKER_CLASS_NAMES} />
        </div>
      )}
```
`ModeCard`(L20-43)는 pill로 대체되며 orphan → 제거(내 변경이 만든 orphan만, §3.3).

---

### `apps/web/app/onboarding/_lib/build-draft.ts` (수정 — 순수 매퍼)

**Analog:** 자기 자신 전문 (L10-35). 스키마 parse가 제출 게이트(T-24-10):
```ts
export function buildDraft(input: { city: string; cityCustom: boolean; dateMode: 'fixed'|'unset'; range?: DateRange; companion: string|null; }): TripCreateDraft {
  const cityLabel = input.cityCustom ? input.city : (CITY_KO_MAP[input.city] ?? input.city);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const start = input.dateMode === 'fixed' && input.range?.from ? fmt(input.range.from) : null;
  ...
  return TripCreateDraftSchema.parse({ title: `${cityLabel} 모아`, city_code: input.city, start_date: start, end_date: end, companion: input.companion });
}
```
→ 입력에 `dayCount: number | null` 추가, 반환에 `day_count`. **정합 규칙(Pitfall 7 확정):** 캘린더로 범위 확정 시 day_count를 **파생값으로 함께 저장**(EF fallback이 day_count 우선이므로 드리프트 0). 기간 pill 저장 시 start/end는 null. 로컬 타임존 `fmt` 유지(UTC 변환 금지).

---

### `apps/web/app/moa/[id]/_components/plan-section.tsx` (신규 — [일정] 영역)

#### ⚠️ READ-ONLY ANALOG — DO NOT MODIFY: `apps/ios/app/trip/[id]/(tabs)/plan.tsx`
> **iOS는 v2.1 전면 동결(CLAUDE.md §5 · HC-1 · SC-6). 이 파일의 diff는 반드시 0이어야 한다.**
> 아래 excerpt는 **웹 재구현의 참고 자료일 뿐, 복사·수정·import 대상이 아니다.**
> (`@/components/plan/*`, `@/lib/realtime` 등 iOS 모듈은 웹에서 import 불가.)

**상태기계 A~F** (iOS L852-975 — 웹 UI-SPEC 상태표에 그대로 매핑):
```tsx
// State A — empty (no places). / State C — generating (progress card).
// State F — error. / State B — pre-generation. / State D/E — draft rendered.
if (places.length === 0) { ... }
if (generating) { ... }
if (error) { ... }
if (!plan) { ... /* 플랜 만들기 버튼 */ }
```

**미배치 풀 + Day 버킷 파생** (iOS L975-1061 — 쿼리 0, 클라 파생. 웹도 동일):
```tsx
const placedIds = new Set(plan.plan_items.map((it) => it.place_id));
const pool = places.filter((p) => !placedIds.has(p.id));
const placesById = new Map(places.map((p) => [p.id, p]));
const dayBuckets: DayItem[][] = Array.from({ length: days }, () => []);
for (const it of [...plan.plan_items].sort((a, b) => a.sort_order - b.sort_order)) {
  const place = placesById.get(it.place_id);
  if (!place) continue; // FK-safety: skip an item whose place was deleted.
  const di = it.day_index < days ? it.day_index : days - 1;
  dayBuckets[di].push({ itemId: it.id, place, isAnchor: it.is_anchor, legSeconds: it.leg_travel_seconds });
}
```
⚠ iOS의 로컬 `dayCount(trip)`(L100-106)는 **미러 금지** — Day 수 결정자는 EF/plan_items(max day_index+1). 웹 타임라인 번호는 `sort_order + 1`(place-list의 `seq_no`와 다른 체계).

**생성 트리거 + 연타 가드 + 에러 카피** (iOS L352-381):
```tsx
  const runGenerate = useCallback(async (anchorPlaceIds: string[]) => {
      if (!id || generating) return; // Pitfall 5 double-tap guard.
      setError(null); setGenerating(true); setProgressStep('loading');
      try {
        await generatePlan(supabase, { trip_id: id, travel_mode: plan?.travel_mode ?? 'transit',
          anchor_place_ids: anchorPlaceIds, removed_place_ids: [] });
        await load(); setGenerating(false); setProgressStep(null);
      } catch (err: unknown) { ... msg.includes('no_placeable') ? '자동 배치할 장소가 없어요...' : '플랜을 만들지 못했어요...' }
  }, [id, generating, plan?.travel_mode, load]);
```
**재생성 anchor 수집**(iOS L383-395) — D-21 계약의 웹 대응 지점:
```tsx
    const anchorIds = (plan?.plan_items ?? []).filter((it) => it.is_anchor).map((it) => it.place_id);
```
⚠ 웹은 여기서 `{place_id, day_index}` 쌍(`pinned_placements`)을 수집한다(D-21). iOS의 `onChangeMode`(L397-412)는 setTravelMode 후 **즉시 재생성**하지만, 웹은 A-10에 따라 **저장만** 하고 자동 재생성하지 않는다(유료 API 이중 지출 방지).
— *(END READ-ONLY ANALOG)*

#### 웹 쪽 실제 복사 대상

**리스트/행 렌더·추출 대기 판별식:** `place-list.tsx` L96-111 (D-14 게이트가 이 판별식을 그대로 재사용):
```tsx
  const analyzing = links.filter(
    (l) => l.source_kind !== 'manual' &&
      (l.extraction_status === 'pending' || l.extraction_status === 'processing'),
  );
  const failed = links.filter(
    (l) => l.source_kind === 'manual' || l.extraction_status === 'failed' ||
      l.extraction_status === 'manual_review' ||
      (l.extraction_status === 'ready' && places.every((p) => p.link_id !== l.id)),
  );
```
**행 배지 + 아코디언 anatomy:** `place-list.tsx` L180-218 (번호 배지는 24px `bg-brand-500`로, 값은 `sort_order+1`):
```tsx
              <span aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-semibold leading-none text-white"
                style={{ backgroundColor: colorFor(p.added_by) }}>
                {p.seq_no}
              </span>
```
**빈 상태 카피 블록:** `place-list.tsx` L115-124 (D-23 [일정] 빈 상태가 미러):
```tsx
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-lg font-semibold text-neutral-900">아직 담은 장소가 없어요</p>
        <p className="text-sm font-normal text-neutral-500">아래 + 버튼으로 ...</p>
      </div>
```
**데이터 소스:** `packages/api/src/queries/plans.ts` — `getPlanByTrip`(L25-37, `PlanWithItems`) · `moveToDay`(L118-129) · `moveToPool` · `setTravelMode` · `setAnchor`. ⚠ D-21 계약 확장 시 `moveToDay`의 `is_anchor:false` → `true` 전환이 대상:
```ts
    .insert({ ...input, is_anchor: false, leg_travel_seconds: null })
```

**Day 탭 스트립 제스처 (HC-5 · Pitfall 5):** `place-sheet.tsx` L116-133이 소유권 계약. 시트 무수정, Day 스트립은 **본문(children) 안**에서 `sticky top-0 overflow-x-auto touch-pan-x`만:
```tsx
        {/* 핸들 + 헤더 = 드래그 전용 표면 (시트 앵커를 바꾸는 유일한 곳). */}
        <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} ...>
        {/* 본문 — 스크롤 전용. overscroll-contain: ... */}
        <div className="flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 pb-8">
          {children}
        </div>
```
**금지:** 스트립에 `onPointerDown`/`setPointerCapture`/`touch-none`.

---

### `apps/web/app/moa/[id]/_components/duration-gate-sheet.tsx` · `day-select-sheet.tsx` (신규)

**Analog:** `add-sheet.tsx` 전문 — BottomSheet + 콘텐츠 컴포넌트 + mutation + 토스트 + onClose:
```tsx
export function AddSheet({ tripId, open, onClose, onAdded }: AddSheetProps) {
  const { toast } = useToast();
  async function handlePickPlace(place: PickedPlace) {
    const client = getSupabaseBrowser();
    try {
      await addManualPlace(client, { board_id: tripId, google_place_id: place.id, ... });
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="추가하기">
      <AddContentTabs onAddLink={handleAddLink} onPickPlace={handlePickPlace} />
    </BottomSheet>
  );
}
```
**footer CTA 슬롯**(고정 CTA가 스크롤에 안 잘림) — `bottom-sheet.tsx` L93-97 · 사용 선례 `share-sheet.tsx` L250:
```tsx
    <BottomSheet open={open} onClose={onClose} title="함께 정하기" footer={footer}>
```
→ DurationGateSheet: `title="여행 기간을 알려주세요"` + `<DurationPills/>` + footer CTA `이 기간으로 일정 만들기`(미선택 시 disabled) → `updateTrip(day_count)`. **owner 전용**(A-9).
→ DaySelectSheet: `title="며칠차에 넣을까요?"` + Day pill 1..N(`SelectPill` 소형) + `아직 모르겠다` text 버튼(풀 잔류).

---

### `apps/web/app/moa/[id]/_components/moa-island.tsx` (수정 — 상태 허브)

**Analog:** 자기 자신. **moa 채널 구조 무수정**(L164-201) — plan 진행은 **별도 임시 broadcast 채널**(postgres_changes 사후 바인딩 no-op #1917과 무관):
```tsx
  useEffect(() => {
    const client = getSupabaseBrowser();
    const channel = client.channel(moaChannelName(trip.id), { config: { presence: { key: currentUserId } } });
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'places', filter: `trip_id=eq.${trip.id}` }, () => void reconcile())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'links', filter: `trip_id=eq.${trip.id}` }, () => void reconcile())
      ...
      .subscribe(async (s) => { ... });
    return () => { void client.removeChannel(channel); };
  }, [trip.id]);
```
→ 신규 plan 진행 구독(생성 중에만 열고 done/error에서 `removeChannel`)은 이 체이닝-then-subscribe idiom을 그대로 미러하되 채널명은 `planChannelName(trip.id)`(@moajoa/core), 이벤트는 `broadcast`/`progress`. 카피는 `PLAN_STEP_KO`(core L220) — 신규 문자열 금지.

**optimistic + rollback + 토스트 idiom** (L204-224 `onToggleVote`) — moveToDay/moveToPool 배선에 미러:
```tsx
    try { ... } catch (err) {
      console.error(err);
      /* rollback */
      toast('투표를 저장하지 못했어요.', { variant: 'error' });
    } finally { setVotePending((p) => ({ ...p, [placeId]: false })); }
```
**children 주입 지점** (L311-343) — PlaceSheet 무수정, `<PlanSection/>`을 `pollSlot` 아래·`<PlaceList/>` 위에 삽입:
```tsx
        <PlaceSheet anchor={sheetAnchor} onAnchorChange={setSheetAnchor} header={...}>
          {pollSlot}
          <PlaceList places={places} links={links} ... />
        </PlaceSheet>
```
⚠ `plan_items`는 realtime 구독 대상 아님 — mutation 후 로컬 갱신/refetch(Pitfall 11).

---

### `apps/web/app/moa/[id]/_components/moa-map.tsx` (수정 — additive props)

**Analog:** 자기 자신 L38-83. **지도 재생성 금지, 마커 diff만.** fitBounds가 "증가 시만"이라 Day 전환(핀 감소)에 미발동 → `fitKey` 추가:
```tsx
    // fitBounds (D-16): 장소 수가 증가했을 때만 — 0→N 초기 로드도 이 경로.
    if (current.length > prevCountRef.current && current.length > 0) {
      const bounds = new g.LatLngBounds();
      for (const p of current) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds);
    }
    prevCountRef.current = current.length;
```
**마커 생성부** (L56-74) — `labels?: Record<placeId, number>` 주입 지점:
```tsx
      const marker = new g.Marker({
        map, position: { lat: p.lat, lng: p.lng }, title: p.name_local,
        icon: {
          url: buildMarkerIconUrl({ source_kind: p.source_kind, confidence: p.confidence,
            fill: colorForRef.current(p.added_by) }),
          scaledSize: new g.Size(32, 40), anchor: new g.Point(16, 40),
        },
      });
```
기존 증가-시-fit 경로·미전달 시 렌더는 **무변경**(전체 뷰 회귀 차단).

---

### `apps/web/lib/marker-svg.ts` (수정 — additive `label?: number`)

**Analog:** 자기 자신 — `fill?` 확장 선례(24-02: "미전달 시 출력 바이트 동일", T-24-04 인젝션 계약):
```ts
export function buildMarkerIconUrl(input: {
  source_kind: 'ai' | 'manual';
  confidence: number | null | undefined;
  fill?: string;
}): string {
  ...
  const svg =
    `<svg ... viewBox="0 0 32 40">` +
    `<path d="M16 0C7.16 ..." fill="${fill}" fill-opacity="${fillOpacity}"/>` +
    (showQ
      ? `<text x="16" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#ffffff">?</text>`
      : '') +
    `</svg>`;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
}
```
→ `label?: number`는 `String(input.label)`만 삽입(HC-6). label과 `?` 배지 동시 시 label 우선. 색은 `colors` 토큰만(신규 hex 0).

---

### `apps/web/__tests__/*.test.tsx` (신규 — plan-section / select-pill / duration-gate-sheet)

**Analog:** `apps/web/__tests__/onboarding.test.tsx` L1-70. ⚠ **반드시 `apps/web/__tests__/`** — co-located는 vitest include 글롭이 못 잡는다.
```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const createMoaDraft = vi.fn(async (_client: unknown, _draft: unknown) => ({ id: 'trip-1' }));
vi.mock('@moajoa/api', () => ({ createMoaDraft: (c: unknown, d: unknown) => createMoaDraft(c, d), ... }));
vi.mock('@/lib/supabase/browser', () => ({ getSupabaseBrowser: () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/components', () => ({ Button: ..., Chip: ..., useToast: () => ({ toast: vi.fn() }) }));
// Import AFTER mocks.
import OnboardingPage from '@/app/onboarding/page';
```
plan-section 테스트는 `@moajoa/api`의 `getPlanByTrip`/`generatePlan`/`moveToDay` mock + `PlanWithItems` 픽스처로 Day 그룹·풀 파생·D-13/D-14 게이트를 검증.

---

## Shared Patterns

### 1. 색·토큰 (HC-2)
**Source:** `packages/ui-tokens/src/index.ts` (brand 300 `#93B4FF` · 500 `#2979FF` · 600 `#2563EB`)
**Apply to:** SelectPill · CTA · Day 탭 · 번호 배지·핀 · 카운터
**계약:** Tailwind 클래스(`bg-brand-500` 등) 또는 `colors` import만. **신규 hex 리터럴 0.**

### 2. 에러 → 토스트
**Source:** `add-sheet.tsx` L36-40 / `moa-island.tsx` L246-250
**Apply to:** 모든 신규 mutation(updateTrip·moveToDay·moveToPool·setTravelMode)
```tsx
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
```

### 3. 시트 = BottomSheet(모달) vs PlaceSheet(상시)
**Source:** `bottom-sheet.tsx`(portal to body + backdrop + footer) / `place-sheet.tsx`(제스처 배타 소유)
**Apply to:** DurationGateSheet·DaySelectSheet = BottomSheet · [일정] Day UI = PlaceSheet children

### 4. 워크스페이스 import 규약 (§4.5)
**Source:** 전 파일 — `import { CITY_KO_MAP, TripCreateDraftSchema } from '@moajoa/core';`
**Apply to:** 전 신규 파일. **`.js` 확장자 금지.** 외부 입력은 Zod parse 경유.

### 5. props-driven 프레젠테이션 + 상태는 부모 소유
**Source:** `place-list.tsx` L46-53 doc / `onboarding/page.tsx` L16-20 doc
**Apply to:** `plan-section.tsx`(상태·mutation은 moa-island 소유) · `duration-pills.tsx`(상태는 page.tsx/게이트 시트 소유)

### 6. RSC seed → island
**Source:** `apps/web/app/moa/[id]/page.tsx` L52-58
```tsx
  const [places, links, members, initialMessages] = await Promise.all([
    listPlacesByTrip(supabase, id), listLinksByTrip(supabase, id),
    listTripMembers(supabase, id), listTripMessages(supabase, id),
  ]);
```
**Apply to:** `getPlanByTrip(supabase, id)` 추가(Pitfall 11 — 안 넣으면 [일정]이 항상 빈 상태).

---

## 재사용 전용 (재구현·수정 금지)

| 파일 | 근거 |
|---|---|
| `apps/web/components/add-content-tabs.tsx` | **HC-3 / D-10 — as-is 재사용. 포크·재구현 금지.** 계약: `onAddLink(url)` / `onPickPlace(PickedPlace)` 콜백형, DB 미접촉. 위저드 step 4 · AddSheet 양쪽에서 이미 사용 중 |
| `apps/web/app/moa/[id]/_components/place-sheet.tsx` | HC-5 — 제스처 소유권 계약. children 주입만 |
| `apps/web/components/button.tsx` | 신규 variant 금지(A-4) — className 오버라이드로 D-05 충족 |
| `apps/web/app/moa/[id]/_components/share-sheet.tsx` + `shareMoa` | D-18 '일정 공유하기' 그대로 |
| `apps/ios/**` (특히 `app/trip/[id]/(tabs)/plan.tsx`) | **READ-ONLY ANALOG — DO NOT MODIFY.** diff 0 (SC-6) |
| `supabase/migrations/0016~0030` | append-only — 무수정 |

---

## No Analog Found

| File | Role | Data Flow | 이유 |
|---|---|---|---|
| plan 진행 broadcast 구독 헬퍼 (web) | utility | event-driven | 웹에 broadcast 구독 선례 없음(moa 채널은 postgres_changes+presence 전용). iOS `subscribePlanProgress`는 `apps/ios/lib/realtime.ts` 소속으로 **import 불가**(동결) → RESEARCH §Code Examples의 인라인 임시 구독 스니펫을 사용. 대안(promise-only 대기)도 허용 |

---

## Metadata

**Analog search scope:** `apps/web/app/onboarding/**`, `apps/web/app/moa/[id]/**`, `apps/web/components/**`, `apps/web/lib/**`, `apps/web/__tests__/**`, `packages/core/src/schemas/**`, `packages/api/src/queries/**`, `supabase/migrations/**`, `supabase/functions/generate-plan/**`, `apps/ios/app/trip/[id]/(tabs)/plan.tsx`(읽기 전용)
**Files read:** 20
**Pattern extraction date:** 2026-07-13
