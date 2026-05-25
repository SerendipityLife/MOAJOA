# Phase 5: Trust UI & Onboarding — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 11 (5 NEW + 6 MODIFIED)
**Analogs found:** 11 / 11
**Mode:** auto

> 모든 신규/수정 파일이 **이미 같은 레포 안에 강한 analog**를 갖고 있다. CONTEXT.md D-01~D-25가 결정 lock, UI-SPEC이 디자인 lock — 본 문서는 "각 파일이 어느 기존 파일의 어느 라인을 복사해야 하는가"를 명시한다. RESEARCH.md는 본 phase에서 생략 (auto 모드 + CONTEXT 완전 lock).

---

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `supabase/migrations/0006_trust_ui_onboarding.sql` | NEW | migration | transform (DDL + backfill) | `supabase/migrations/0004_extraction_hardening.sql` (columns alter) + `supabase/migrations/0002_fix_rls_recursion.sql` (SECURITY DEFINER trigger fn) + `0001_init.sql:62-88` (auth trigger + handle_new_auth_user) + `0001_init.sql:487-551` (public_board_view RPC) | exact (4 anchors) |
| `supabase/functions/extract-youtube/index.ts` | MODIFIED (~1 line) | edge function | request-response | (self: `index.ts:191-215` places upsert block) | exact (in-file) |
| `packages/core/src/constants.ts` | MODIFIED (~15 lines) | config / constants | static-export | (self: `constants.ts:122-131` SharedDefaultsKeys + `:96-104` ExtractionStep + `:8-23` Limits) | exact (in-file) |
| `apps/ios/app/boards/[id].tsx` | MODIFIED (~80 lines) | screen / route | event-driven + CRUD | (self: `[id].tsx:69-84` broadcast subscribe + `:202-220` overlay + `:174-200` link list FlatList) | exact (in-file) |
| `apps/ios/app/boards/_pin-sheet.tsx` | MODIFIED (~40 lines) | component (bottom sheet) | CRUD (mutation) | (self: `_pin-sheet.tsx:75-94` onDelete + `:128-130` badge + `:132-154` action stack) | exact (in-file) |
| `apps/ios/components/StepIndicatorOverlay.tsx` | NEW | component (presentational) | render-only (props in, no IO) | `apps/ios/app/boards/[id].tsx:202-220` analyzing overlay (현재 inline JSX) | role-match (extraction) |
| `apps/ios/components/InfoCard.tsx` | NEW | component (presentational + dismiss callback) | render + 1 callback | `apps/ios/app/(tabs)/boards.tsx:56-65` failedCount Pressable banner | exact (banner shape) |
| `apps/ios/lib/onboarding.ts` | NEW | utility (AsyncStorage wrapper) | file-I/O (key-value) | `apps/ios/lib/shared-defaults.ts` (typed key wrapper around storage) + `apps/ios/lib/pending.ts` (state read pattern) | exact (wrapper idiom) |
| `apps/ios/app/(tabs)/boards.tsx` | MODIFIED (minimal — likely 0 lines per UI-SPEC §7) | screen | CRUD | (self) | exact (in-file) — 변경 없을 가능성 |
| `packages/api/src/queries/places.ts` | MODIFIED (+2 functions) | query helper | CRUD (mutation) | `packages/api/src/queries/places.ts:73-90` renamePlace + `:50-56` hidePlace | exact (in-file siblings) |
| `apps/web/app/b/[slug]/_components/public-board-map.tsx` | MODIFIED (~15 lines) | component (web map) | render | (self: `public-board-map.tsx:49-68` Marker loop) | exact (in-file) |

**Coverage breakdown:**
- Files with exact analog (same file or same role+flow): **11 / 11**
- Files with no analog: **0**

---

## Pattern Assignments

### 1. `supabase/migrations/0006_trust_ui_onboarding.sql` (migration, DDL + trigger + backfill)

> CONTEXT D-01, D-02, D-03, D-16, D-17, D-18 — 4-part migration in 1 file (append-only).

**Analog #1 — Column ADD with CHECK (`0004_extraction_hardening.sql:15-22`):**
```sql
alter table places
  add column if not exists source_kind text not null default 'ai'
    check (source_kind in ('ai', 'manual'));

alter table places
  add column if not exists inferred_city text;
```
→ Phase 5 Part 1 (confidence column) copy this shape verbatim, swap to:
```sql
alter table places
  add column if not exists confidence numeric(3,2)
    check (confidence is null or confidence between 0 and 1);
```
(nullable — no `not null default` because legacy rows have no confidence.)

**Analog #2 — SECURITY DEFINER trigger function (`0001_init.sql:62-88` handle_new_auth_user):**
```sql
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name)
  values (...)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
```
→ Phase 5 Part 3 (first board trigger) copy this shape exactly, attach to `profiles` not `auth.users` (CONTEXT code_context Pitfall: profiles trigger 권장 — auth schema 보호). Use **`if not exists` guard** instead of `on conflict` (boards has no natural unique on owner_id):
```sql
create or replace function profiles_create_first_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from boards where owner_id = NEW.id) then
    insert into boards (owner_id, title, visibility)
    values (NEW.id, '내 첫 여행', 'private');
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_first_board_trigger on profiles;
create trigger profiles_first_board_trigger
  after insert on profiles
  for each row execute function profiles_create_first_board();
```
**Trigger ordering note (CONTEXT open Q #3):** `handle_new_auth_user` fires `after insert on auth.users` → inserts into `profiles` → `profiles_first_board_trigger` fires `after insert on profiles`. Same auth.users transaction → safe chain. Verify by checking that `profiles` has no other trigger that might rollback.

**Analog #3 — RPC redefinition appending one field (`0001_init.sql:487-551` public_board_view):**
The RPC builds `jsonb_agg(jsonb_build_object(...))` for places. Phase 5 Part 2 = redefine the RPC adding `'confidence', p.confidence` inside the places jsonb_build_object. **Drop in `create or replace function public_board_view(...)` from 0001 verbatim**, change only the places sub-select object:
```sql
'places', coalesce(
  (select jsonb_agg(jsonb_build_object(
    'id', p.id,
    'link_id', p.link_id,
    'name_local', p.name_local,
    'name_ko', p.name_ko,
    'name_en', p.name_en,
    'lat', p.lat,
    'lng', p.lng,
    'category', p.category,
    'source_timestamp_sec', p.source_timestamp_sec,
    'source_kind', p.source_kind,     -- NEW: web TRUST-01 needs this for marker color
    'confidence', p.confidence         -- NEW: web TRUST-01 needs this for low-conf opacity
  ) order by p.created_at)
  from places p where p.board_id = v_board.id and p.hidden_at is null),
  '[]'::jsonb
)
```
**Pitfall (from CONTEXT code_context):** "places.confidence 컬럼 추가 후 RPC 재정의 누락" — 한 파일에서 묶음 처리. `source_kind`도 함께 추가 (web에 marker color 분기 필요 — UI-SPEC §8).

**Analog #4 — Idempotent migration pattern (`0005_extraction_costs_link_id_nullable.sql:12-23`):**
```sql
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where ...
  ) then
    alter ...
  end if;
end $$;
```
→ Phase 5 backfill (Part 4) wraps backfill INSERT in similar guard or uses `where not exists`:
```sql
-- Part 4: backfill — existing dogfooders get "내 첫 여행" if they have no boards
insert into boards (owner_id, title, visibility)
select p.id, '내 첫 여행', 'private'
from profiles p
where not exists (select 1 from boards where owner_id = p.id);
```

**Append-only rule (CLAUDE.md §4.3):** number = 0006 (verified — `ls supabase/migrations/` shows 0001~0005). Filename = `0006_trust_ui_onboarding.sql` (combines confidence + first_board per CONTEXT D-01 / D-16, Claude's Discretion allows split but combine = simpler).

**Type regen post-migration (CONTEXT code_context Pitfall):** `pnpm supabase:types` MUST run after this migration — `packages/api/src/types/database.ts` gets `places.confidence: number | null`.

---

### 2. `supabase/functions/extract-youtube/index.ts` (edge function, single-line addition)

> CONTEXT D-02 — wire LLM confidence to places insert.

**Analog (self, lines 191-215):**
```typescript
if (resolved.length > 0) {
  const rows = resolved.map((r) => ({
    board_id: link.board_id,
    link_id: link.id,
    added_by: link.added_by,
    google_place_id: r.place.placeId,
    name_local: r.place.displayName,
    name_ko: r.cand.name_ko ?? null,
    name_en: r.place.displayNameEn ?? null,
    lat: r.place.lat,
    lng: r.place.lng,
    category: r.place.primaryType ?? null,
    address: r.place.formattedAddress ?? null,
    source_timestamp_sec: r.cand.source_timestamp_sec ?? null,
    source_quote: r.cand.source_quote ?? null,
    source_kind: 'ai',
    inferred_city: r.cand.inferred_city ?? null,
  }));
  const { error: insertErr } = await admin
    .from('places')
    .upsert(rows, { onConflict: 'board_id,google_place_id', ignoreDuplicates: true });
  if (insertErr) throw insertErr;
}
```
**Change:** add **one line** to the object literal:
```typescript
confidence: r.cand.confidence ?? null,
```
That's the whole edit. `r.cand.confidence` is already in the Zod schema (`pipeline/claude.ts` — confirmed in CONTEXT code_context "LLM `confidence` 출력" — `confidence: z.number().min(0).max(1).default(0.5)`). No other Edge Function changes.

---

### 3. `packages/core/src/constants.ts` (config, append exports)

> CONTEXT D-09 (EXTRACT_STEP_KO), D-15 (LOW_CONFIDENCE_THRESHOLD), D-20 (OnboardKeys).

**Analog #1 — Frozen Record/object export (`constants.ts:122-131` SharedDefaultsKeys):**
```typescript
export const SharedDefaultsKeys = {
  /** JSON array of {url, board_id, queued_at, retry_count} — D-05. */
  PendingLinks: 'pending_links',
  /** UUID string — last board the user saved to. */
  LastBoardId: 'last_board_id',
  ...
} as const;
```
→ Phase 5 `OnboardKeys` copies this shape exactly:
```typescript
/**
 * AsyncStorage keys for onboarding state (iOS app local persistence).
 * Single source of truth between lib/onboarding.ts wrapper and any callers.
 * Phase 5 D-20.
 */
export const OnboardKeys = {
  /** Boolean string ('true' | absent) — ONBOARD-02 link-card global dismiss. */
  LinkCardDismissed: '@moajoa/onboard:link_card_dismissed',
} as const;
```

**Analog #2 — Korean fixture map (`constants.ts:149-159` CITY_KO_MAP):**
```typescript
export const CITY_KO_MAP: Readonly<Record<string, string>> = {
  tokyo: '도쿄',
  osaka: '오사카',
  ...
} as const;
```
→ Phase 5 `EXTRACT_STEP_KO` follows same idiom (constrained keys — use `Record<ExtractionStepType, string>` minus done/error):
```typescript
/**
 * Step name (Phase 2 broadcast) → Korean user-facing label (UI-SPEC §1 fixture).
 * D-09: 'done' / 'error' are control signals (overlay dismiss) — no label.
 * Phase 5 only — fixture, i18n is v2 (I18N-01).
 */
export const EXTRACT_STEP_KO = {
  metadata: '영상 정보 가져오는 중',
  transcript: '자막 읽는 중',
  llm: '장소 찾는 중',
  places: '지도에 표시하는 중',
} as const;
```

**Analog #3 — Numeric domain constant (`constants.ts:8-23` Limits):**
```typescript
export const Limits = {
  BoardsPerUser: 20,
  ...
} as const;
```
→ Phase 5 `LOW_CONFIDENCE_THRESHOLD` as a single-value export (not wrapped — D-15 lock + single use site means object wrapper is overkill, Karpathy §3.2):
```typescript
/**
 * AI place is considered "low confidence" if confidence < this threshold.
 * Both UIs (iOS marker opacity + bottom sheet badge, web SVG opacity) read this.
 * D-15 lock. confidence = null → NOT low (treated as legacy/manual = trusted).
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7 as const;
```

All three exports go in the same file (append at bottom). Re-export via `packages/core/src/index.ts` barrel if pattern requires (check existing exports there).

---

### 4. `apps/ios/app/boards/[id].tsx` (screen, multi-region edit)

> CONTEXT D-08 (step indicator), D-10 (retry toast), D-11 (link row retry), D-19/D-20 (info card), D-05 (marker conf分岐).

#### 4a. Broadcast subscribe — handle metadata/transcript/llm/places (D-08)

**Analog (self, lines 69-84):**
```typescript
useEffect(() => {
  if (!analyzing) return;
  const ch = subscribeExtractProgress(analyzing, (p: ExtractProgress) => {
    if (p.step === 'done') {
      setAnalyzing(null);
      load();
      showToast(`${p.places_extracted ?? 0}개 핀 추가됨`);
    } else if (p.step === 'error') {
      setAnalyzing(null);
      showToast(`분석 실패: ${mapErrorReason(p.error)}`, 'error');
    }
  });
  return () => {
    supabase.removeChannel(ch);
  };
}, [analyzing, load]);
```
**Change:** add state `currentStep` (typed `ExtractionStepType | null`), extend callback to track step transitions:
```typescript
const [currentStep, setCurrentStep] = useState<ExtractionStepType | null>(null);

useEffect(() => {
  if (!analyzing) return;
  const ch = subscribeExtractProgress(analyzing, (p: ExtractProgress) => {
    if (p.step === 'done') {
      setAnalyzing(null);
      setCurrentStep(null);
      load();
      showToast(`${p.places_extracted ?? 0}개 핀 추가됨`);
    } else if (p.step === 'error') {
      const linkIdForRetry = analyzing;
      setAnalyzing(null);
      setCurrentStep(null);
      showToast(
        `분석 실패: ${mapErrorReason(p.error)}`,
        'error',
        { label: '재시도', onPress: () => onRetry(linkIdForRetry) },
      );
    } else {
      // metadata | transcript | llm | places — drive step indicator
      setCurrentStep(p.step);
    }
  });
  return () => {
    supabase.removeChannel(ch);
  };
}, [analyzing, load]);
```

Also: when starting `setAnalyzing(linkId)` (in onAddLink at line 95 + new onRetry), reset `setCurrentStep('metadata')` as the optimistic initial state (so overlay shows immediately before first broadcast).

#### 4b. Overlay replacement — use StepIndicatorOverlay (D-08)

**Analog (self, lines 202-220):**
```jsx
{analyzing && (
  <View
    pointerEvents="auto"
    style={{
      position: 'absolute',
      left: 0, right: 0, top: 0, bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.7)',
      zIndex: 50,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <ActivityIndicator size="large" color="#F97316" />
    <Text className="text-base text-neutral-700 mt-3">분석 중...</Text>
  </View>
)}
```
**Change:** replace inline JSX with the new `<StepIndicatorOverlay visible={!!analyzing} currentStep={currentStep} />`. The component encapsulates layout + step list rendering (see file #6 below). Keep overlay zIndex=50 + pointerEvents='auto' per CONTEXT code_context Pitfall ("step indicator overlay와 사용자 인터랙션" — block interaction during extraction).

#### 4c. Link list FlatList renderItem — status display + failed retry (D-11)

**Analog (self, lines 190-199):**
```jsx
renderItem={({ item }) => (
  <View className="p-3 border border-neutral-200 rounded-lg mb-2">
    <Text className="text-sm font-medium" numberOfLines={1}>
      {item.title ?? item.url}
    </Text>
    <Text className="text-xs text-neutral-500 mt-1">
      {item.source_kind} · {item.extraction_status}
    </Text>
  </View>
)}
```
**Change:** map `extraction_status` → Korean copy + danger color for failed, wrap whole row in `<Pressable>` only when failed (UI-SPEC §4 lock):
```jsx
renderItem={({ item }) => {
  const statusKo = {
    pending: '분석 대기',
    processing: '분석 중...',
    ready: '분석 완료',
    failed: '분석 실패 — 탭하여 재시도',
    manual_review: '재추출 필요',
  }[item.extraction_status] ?? item.extraction_status;
  const isFailed = item.extraction_status === 'failed';

  const inner = (
    <View className="p-3 border border-neutral-200 rounded-lg mb-2">
      <Text className="text-base font-semibold" numberOfLines={2}>
        {item.title ?? item.url}
      </Text>
      <Text className="text-sm text-neutral-500 mt-1">
        {item.source_kind} · <Text className={isFailed ? 'text-danger' : 'text-neutral-500'}>{statusKo}</Text>
      </Text>
    </View>
  );

  return isFailed ? (
    <Pressable onPress={() => onRetry(item.id)}>{inner}</Pressable>
  ) : inner;
}}
```
**onRetry helper** (top-level in component):
```typescript
const onRetry = useCallback((linkId: string) => {
  setAnalyzing(linkId);
  setCurrentStep('metadata');
  triggerExtraction(supabase, linkId).catch((err) => {
    console.warn('[triggerExtraction-retry] failed:', err);
    setAnalyzing(null);
    setCurrentStep(null);
    showToast('분석 실패: 잠시 후 다시 시도', 'error');
  });
}, []);
```

#### 4d. Marker rendering — confidence分岐 (D-05)

**Analog (self, lines 161-171 MapView Marker map):**
```jsx
{places.map((p) => (
  <Marker
    key={p.id}
    coordinate={{ latitude: p.lat, longitude: p.lng }}
    title={p.name_local}
    description={p.name_ko ?? p.address ?? undefined}
    onPress={() => setSelectedPlace(p)}
  />
))}
```
**Change:** add `pinColor` + `opacity` + optional children badge (UI-SPEC §2 contract):
```jsx
{places.map((p) => {
  const isAILowConf =
    p.source_kind === 'ai' &&
    p.confidence !== null &&
    p.confidence < LOW_CONFIDENCE_THRESHOLD;
  return (
    <Marker
      key={p.id}
      coordinate={{ latitude: p.lat, longitude: p.lng }}
      title={p.name_local}
      description={p.name_ko ?? p.address ?? undefined}
      pinColor={p.source_kind === 'ai' ? '#F97316' : '#0F172A'}
      opacity={isAILowConf ? 0.5 : 1.0}
      onPress={() => setSelectedPlace(p)}
    >
      {isAILowConf ? (
        <View className="w-6 h-6 items-center justify-center rounded-full bg-brand-500/50">
          <Text className="text-xs font-medium text-white">?</Text>
        </View>
      ) : null}
    </Marker>
  );
})}
```
**Pitfall verification (CONTEXT open Q #2 + UI-SPEC color contract note):** opacity prop may be ignored on Apple Maps provider. If children View is provided react-native-maps replaces the default pin → custom view IS the marker (works on Apple Maps). The above pattern only renders custom view for low-conf, so high-conf uses default pin. Acceptable; if opacity prop is silently ignored on high-conf state, no visible regression. First plan task should verify on device.

#### 4e. InfoCard mount above URL TextInput (D-19/D-20)

**Insert location:** between line 128 (`<View className="px-6 mb-3">`) wrapper and the TextInput row at line 130. The card sits ABOVE the URL input row.

```jsx
<InfoCard
  visible={places.length === 0 && links.length === 0}
  onDismiss={() => {}}
/>
```
InfoCard internally reads AsyncStorage on mount + writes on dismiss (see file #7). Parent supplies the `visible` boolean precondition (D-20 — `places.length === 0 && links.length === 0`); card's own AsyncStorage check ANDs with it. Empty `onDismiss` callback OK — parent doesn't need to react to dismiss (card unmounts itself by internal state).

#### 4f. Imports added

```typescript
import { EXTRACT_STEP_KO, LOW_CONFIDENCE_THRESHOLD, OnboardKeys, type ExtractionStepType } from '@moajoa/core';
import { StepIndicatorOverlay } from '@/components/StepIndicatorOverlay';
import { InfoCard } from '@/components/InfoCard';
```

(CLAUDE.md §4.5: no `.js` extension on workspace imports.)

---

### 5. `apps/ios/app/boards/_pin-sheet.tsx` (component, low_confidence variant)

> CONTEXT D-13 (badge + 안내 한 줄), D-14 (확인/잘못됨 액션 insert), D-04 (state via source_kind 전환).

**Analog #1 — Badge layout (self, lines 128-130):**
```jsx
<View className="self-start mt-2 px-1.5 py-0.5 rounded-md bg-neutral-100">
  <Text className="text-sm text-neutral-700">{isAI ? 'AI' : '수동'}</Text>
</View>
```
**Change:** wrap existing badge + new low_conf badge in flex row (UI-SPEC §5 lock — `gap-1`):
```jsx
const isLowConf =
  isAI &&
  place.confidence !== null &&
  place.confidence < LOW_CONFIDENCE_THRESHOLD;

<View className="flex-row items-center gap-1 mt-2">
  <View className="px-1.5 py-0.5 rounded-md bg-neutral-100">
    <Text className="text-sm text-neutral-700">{isAI ? 'AI' : '수동'}</Text>
  </View>
  {isLowConf && (
    <View className="px-2 py-0.5 rounded-full bg-amber-50">
      <Text className="text-xs font-medium text-amber-700">신뢰도 낮음</Text>
    </View>
  )}
</View>
{isLowConf && (
  <Text className="text-sm text-neutral-600 mt-2">
    AI가 자신 없어해요. 맞으면 확인, 아니면 삭제해 주세요.
  </Text>
)}
```

**Analog #2 — Pressable action button (self, lines 132-153):**
```jsx
<Pressable
  onPress={() => setEditing(true)}
  className="bg-neutral-100 px-4 py-3 rounded-lg mt-4"
>
  <Text className="text-base text-neutral-800 text-center">이름 수정</Text>
</Pressable>
```
**Change:** insert two new actions ABOVE the existing 이름 수정 stack when `isLowConf` true (UI-SPEC §5 button stack order: 확인 → 잘못됨 → 이름 수정 → 영상에서 위치 → 삭제):
```jsx
{isLowConf && (
  <>
    <Pressable
      onPress={onConfirm}
      className="bg-brand-500 px-4 py-3 rounded-lg mt-4"
    >
      <Text className="text-base font-semibold text-white text-center">확인</Text>
    </Pressable>
    <Pressable
      onPress={onReject}
      className="bg-white border border-danger px-4 py-3 rounded-lg mt-2"
    >
      <Text className="text-base text-danger text-center">잘못됨</Text>
    </Pressable>
  </>
)}
{/* existing 이름 수정 below — but change its mt-4 → mt-2 when isLowConf true so the spacing stays consistent */}
<Pressable
  onPress={() => setEditing(true)}
  className={`bg-neutral-100 px-4 py-3 rounded-lg ${isLowConf ? 'mt-2' : 'mt-4'}`}
>
  <Text className="text-base text-neutral-800 text-center">이름 수정</Text>
</Pressable>
```

**Analog #3 — Mutation handler with try/catch + toast (self, onDelete at lines 75-94):**
```jsx
function onDelete() {
  Alert.alert('핀 삭제', '정말 삭제할까요?', [
    { text: '취소', style: 'cancel' },
    {
      text: '삭제',
      style: 'destructive',
      onPress: async () => {
        try {
          await deletePlace(supabase, place!.id);
          showToast('삭제됨');
          onChanged();
          onClose();
        } catch (e) {
          console.warn('[delete] failed:', e);
          showToast('삭제 실패', 'error');
        }
      },
    },
  ]);
}
```
**Change — confirm handler (no Alert per UI-SPEC §"Destructive actions" — `[확인]` is non-destructive, `[잘못됨]` is reversible v2 undo so no Alert either; toast omitted per UI-SPEC §"Copywriting Contract"):**
```jsx
async function onConfirm() {
  try {
    await confirmAiPlace(supabase, place!.id);
    onChanged();
    onClose();
  } catch (e) {
    console.warn('[confirmAi] failed:', e);
    showToast('확인 실패', 'error');
  }
}

async function onReject() {
  try {
    await rejectAiPlace(supabase, place!.id);
    onChanged();
    onClose();
  } catch (e) {
    console.warn('[rejectAi] failed:', e);
    showToast('숨김 실패', 'error');
  }
}
```

**Imports added (top of file):**
```typescript
import { confirmAiPlace, rejectAiPlace } from '@moajoa/api';
import { LOW_CONFIDENCE_THRESHOLD } from '@moajoa/core';
```

**Note (D-04 source_kind transition):** confirm = `source_kind: 'ai' → 'manual'` + `confidence: null`. After reload, `isAI` becomes false (because `link_id != null` still — but `isAI` is derived from `link_id`, not source_kind, in current Phase 3 code). **Audit:** current `isAI = place.link_id !== null` (line 46) won't change post-confirm. **Decision needed in planner:** either (a) keep `isAI` derived from `link_id` (then confirmed AI pins still show 'AI' badge — D-04 lock says "더 이상 옅게 표시 X" via marker, badge unaffected — acceptable interpretation), or (b) switch derivation to `source_kind === 'ai'` post Phase 5 (since Phase 5 wires confidence column properly, source_kind should now be the canonical signal). UI-SPEC §5 shows post-confirm marker becomes high-conf (opacity 1.0) which only works if marker reads `source_kind` and `confidence` — not `link_id`. **Recommendation:** marker code (file 4d) reads `source_kind` + `confidence` (already done above). Bottom sheet `isAI` MAY stay as `link_id !== null` for backward compat with legacy Phase 2 data (CONTEXT code_context: "places.source_kind 컬럼이 일관되지 않을 수 있음"). Either way safe.

---

### 6. `apps/ios/components/StepIndicatorOverlay.tsx` (NEW, presentational)

> CONTEXT D-07/D-08/D-09 — extract `[id].tsx` inline overlay into reusable component, add 5-step list.

**Analog — inline overlay from `[id].tsx:202-220` (file 4b above).** That entire JSX block becomes the component body. Props:
```typescript
interface Props {
  visible: boolean;
  currentStep: ExtractionStepType | null; // 'metadata' | 'transcript' | 'llm' | 'places' | 'done' | 'error' | null
}
```

**Core pattern (assembly from CONTEXT specifics + UI-SPEC §1):**
```typescript
import { ActivityIndicator, Text, View } from 'react-native';
import { EXTRACT_STEP_KO, type ExtractionStepType } from '@moajoa/core';

interface Props {
  visible: boolean;
  currentStep: ExtractionStepType | null;
}

const ORDER: Array<keyof typeof EXTRACT_STEP_KO> = ['metadata', 'transcript', 'llm', 'places'];

export function StepIndicatorOverlay({ visible, currentStep }: Props) {
  if (!visible) return null;
  // done/error are control signals — parent dismisses overlay (sets visible=false)
  const currentIdx = currentStep && (ORDER as string[]).includes(currentStep)
    ? ORDER.indexOf(currentStep as typeof ORDER[number])
    : 0; // optimistic: before first broadcast, treat as "metadata"

  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.7)',
        zIndex: 50,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size="large" color="#F97316" />
      <View className="mt-3 items-start">
        {ORDER.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const dot = isDone || isCurrent ? '●' : '○';
          const label = EXTRACT_STEP_KO[step];

          if (isCurrent) {
            return (
              <View key={step} className="flex-row items-center mt-2">
                <Text className="text-base text-brand-500 mr-2">{dot}</Text>
                <Text className="text-base font-semibold text-brand-500">{label}</Text>
              </View>
            );
          }
          if (isDone) {
            return (
              <View key={step} className="flex-row items-center mt-2">
                <Text className="text-base text-neutral-500 mr-2">{dot}</Text>
                <Text className="text-sm text-neutral-500">{label}</Text>
              </View>
            );
          }
          return (
            <View key={step} className="flex-row items-center mt-2">
              <Text className="text-base text-neutral-300 mr-2">{dot}</Text>
              <Text className="text-xs font-medium text-neutral-300">{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

**Why `apps/ios/components/` (new dir):** Phase 3 kept all components co-located in `app/boards/_*.tsx` underscores (route-private convention). Phase 5 introduces `apps/ios/components/` for **truly reusable** UI primitives (StepIndicatorOverlay used in [id].tsx; InfoCard in [id].tsx and possibly future onboarding screens). Per CLAUDE.md §3.2 (Simplicity First) — only create the dir if 2+ components actually share home; both Phase 5 NEW components qualify. **Planner verification:** confirm `apps/ios/components/` doesn't exist (verified by `ls` — does not exist), create with these 2 files.

---

### 7. `apps/ios/components/InfoCard.tsx` (NEW, dismissible banner)

> CONTEXT D-19/D-20/D-21 — generic dismissible info banner with AsyncStorage-backed persistence.

**Analog — failedCount banner (`apps/ios/app/(tabs)/boards.tsx:56-65`):**
```jsx
{failedCount > 0 && (
  <Pressable
    onPress={() => router.push('/boards/_failed')}
    className="mx-6 mb-4 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 flex-row items-center"
  >
    <View className="w-2 h-2 rounded-full bg-danger mr-3" />
    <Text className="text-sm text-neutral-800 flex-1">{`저장 실패 ${failedCount}개 — 탭하여 확인`}</Text>
    <Text className="text-neutral-400 text-sm">›</Text>
  </Pressable>
)}
```
This shape is the structural template — outer Pressable (or View) with `mx-6 mb-3 rounded-lg px-4 py-3 flex-row items-start`, left icon, flex-1 text stack, right action.

**Phase 5 InfoCard adaptation (UI-SPEC §6):**
```typescript
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isLinkCardDismissed, dismissLinkCard } from '@/lib/onboarding';

interface Props {
  /**
   * External precondition controlled by parent (e.g. places.length===0 && links.length===0).
   * AsyncStorage dismissed-state is ANDed internally.
   */
  visible: boolean;
  onDismiss?: () => void;
}

export function InfoCard({ visible, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    isLinkCardDismissed().then((v) => {
      if (!cancelled) setDismissed(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render anything until we know the dismiss state (avoid flash).
  if (dismissed === null || dismissed || !visible) return null;

  async function handleDismiss() {
    await dismissLinkCard();
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <View className="mx-6 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex-row items-start">
      <Text className="mr-3 mt-0.5 text-base">💡</Text>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-neutral-900">
          유튜브 링크를 붙여넣어 보세요
        </Text>
        <Text className="text-sm text-neutral-700 mt-1">
          영상 속 장소가 30초 안에 지도로 떠요
        </Text>
      </View>
      <Pressable
        onPress={handleDismiss}
        hitSlop={8}
        className="ml-3 w-8 h-8 items-center justify-center"
      >
        <Text className="text-base text-neutral-400">×</Text>
      </Pressable>
    </View>
  );
}
```

**Key patterns copied:**
- `mx-6 mb-3 ... rounded-lg px-4 py-3 flex-row items-start` outer container (UI-SPEC §"Spacing Scale") — identical shape family to boards.tsx failedCount banner
- Left icon `mr-3 mt-0.5` (UI-SPEC §"Spacing" lock)
- `Text className="flex-1"` for body stack
- Right action (close button) at `ml-3` with explicit `w-8 h-8` for hit area

**Lifecycle:** mounts → reads AsyncStorage async → if dismissed=true OR external visible=false → renders null. Tap × → writes AsyncStorage → state update → unmounts. Per UI-SPEC §6: dismiss persistence is GLOBAL (one key shared across all boards), not per-board.

---

### 8. `apps/ios/lib/onboarding.ts` (NEW, AsyncStorage wrapper)

> CONTEXT D-20 — typed wrapper around AsyncStorage `OnboardKeys.LinkCardDismissed`.

**Analog #1 — typed key wrapper (`apps/ios/lib/shared-defaults.ts:28-44`):**
```typescript
export const SharedDefaults = {
  get<T>(key: string): T | null {
    const raw = Native.getString(APP_GROUP_ID, key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    Native.setString(APP_GROUP_ID, key, JSON.stringify(value));
  },
  remove(key: string): void {
    Native.remove(APP_GROUP_ID, key);
  },
};

export { SharedDefaultsKeys };
```
That's the **idiom** — wrap an untyped storage primitive, re-export the keys constant for ergonomic call sites.

**Phase 5 adaptation** (much simpler — single boolean key per D-20, no generics needed):
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardKeys } from '@moajoa/core';

/**
 * Phase 5 ONBOARD-02 (D-19/D-20).
 * Single-flag onboarding state — global "user has dismissed the link-paste banner".
 * AsyncStorage is async (unlike SharedDefaults which is sync via native UserDefaults),
 * so wrapper returns Promises.
 *
 * Why a wrapper: callers should not import AsyncStorage + OnboardKeys directly —
 * keeps key names + serialization centralized (SharedDefaults pattern,
 * `apps/ios/lib/shared-defaults.ts`).
 */

export async function isLinkCardDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(OnboardKeys.LinkCardDismissed);
    return raw === 'true';
  } catch {
    // Storage error = treat as "not dismissed" (show card — fail safe to onboarding visibility)
    return false;
  }
}

export async function dismissLinkCard(): Promise<void> {
  try {
    await AsyncStorage.setItem(OnboardKeys.LinkCardDismissed, 'true');
  } catch (e) {
    // Best-effort — log but don't throw. The card unmounts via state regardless.
    console.warn('[onboarding] dismissLinkCard storage failed:', e);
  }
}

// Re-exported for ergonomic imports alongside the helpers.
export { OnboardKeys };
```

**Dep verification (CONTEXT open Q #4):** First plan task should `grep -r "async-storage" apps/ios/package.json packages/*/package.json` — if absent, add to `apps/ios/package.json` + run `pnpm install` at root (hoist via pnpm workspace). SDK 54 compatible version: `@react-native-async-storage/async-storage@^2.0.0` (Expo SDK 54 official support).

---

### 9. `apps/ios/app/(tabs)/boards.tsx` (likely 0-line change)

> UI-SPEC §7 explicitly states "보드 목록 변경 없음 — Phase 3 시스템 banner 그대로". CONTEXT also: "안내 카드는 보드 상세에만". File listed in scope only as a possible touch point — verify in plan that **no edit is required**.

**Existing relevant pattern (no change to copy — just acknowledged):**
- Lines 73-78 show ListEmptyComponent `"아직 보드가 없어요"` — D-16 first-board trigger means this empty state is no longer reached for new users (UI-SPEC §7 note). No code change; copy retained for users who delete all boards.

**Recommendation to planner:** **omit this file from the file-change list** unless investigation surfaces a need. Listed here for completeness only.

---

### 10. `packages/api/src/queries/places.ts` (extend with 2 helpers)

> CONTEXT D-04, D-14 — `confirmAiPlace` (source_kind 전환) + `rejectAiPlace` (soft delete).

**Analog #1 — Mutation with select+single return (`places.ts:73-90` renamePlace):**
```typescript
export async function renamePlace(
  client: MoajoaSupabaseClient,
  id: string,
  newName: string,
): Promise<Place> {
  const trimmed = newName.trim();
  if (trimmed.length === 0) throw new Error('name_local cannot be empty');
  if (trimmed.length > 200) throw new Error('name_local exceeds 200 chars');

  const { data, error } = await client
    .from('places')
    .update({ name_local: trimmed })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}
```
→ **`confirmAiPlace`** copies this shape (mutation + `select('*').single()` return — caller gets updated row), no input validation needed (id is the only arg):
```typescript
/**
 * D-04/D-14: user accepted a low-confidence AI pin.
 * Transition: source_kind 'ai' → 'manual', confidence → null.
 * Effect: marker re-renders as a manual (neutral-900, opacity 1.0) pin;
 *   isLowConf becomes false → bottom sheet no longer shows confirm/reject actions.
 *
 * RLS: `can_edit_board()` (via places UPDATE policy in 0001_init.sql:397-401).
 * Non-members get RLS denial.
 *
 * Per Phase 5 PinBottomSheet `[확인]` action.
 */
export async function confirmAiPlace(
  client: MoajoaSupabaseClient,
  id: string,
): Promise<Place> {
  const { data, error } = await client
    .from('places')
    .update({ source_kind: 'manual', confidence: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}
```

**Analog #2 — Soft delete (`places.ts:50-56` hidePlace + `:102` deletePlace alias):**
```typescript
export async function hidePlace(client: MoajoaSupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from('places')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export const deletePlace = hidePlace;
```
→ **`rejectAiPlace`** is again an alias of `hidePlace` (Karpathy §3.2 Simplicity — same semantics, intent-distinct name; existing pattern `deletePlace = hidePlace` is the precedent):
```typescript
/**
 * D-04/D-14: user rejected a low-confidence AI pin as wrong.
 * Implementation = soft delete via hidden_at. Per CONTEXT D-04, no separate
 * `rejected_at` column — confirm/reject lifecycle is encoded by source_kind
 * (confirm) + hidden_at (reject), no v1 audit columns.
 *
 * Aliased to hidePlace because semantics are identical at the SQL layer;
 * the rename gives the bottom sheet `[잘못됨]` action an intent-aligned helper
 * name without duplicating logic (Karpathy §3.2; same precedent as deletePlace).
 *
 * Per Phase 5 PinBottomSheet `[잘못됨]` action.
 */
export const rejectAiPlace = hidePlace;
```

**Place these two exports at the bottom of the file** (after `deletePlace`). Re-export via barrel `packages/api/src/queries/index.ts` if existing helpers like `deletePlace` / `renamePlace` are re-exported (verify in plan).

---

### 11. `apps/web/app/b/[slug]/_components/public-board-map.tsx` (web parity — TRUST-01 only)

> CONTEXT D-06/D-24 — marker color分岐 only, ~10 lines. Click handler unchanged.

**Analog (self, lines 49-68 Marker loop):**
```typescript
for (const p of places) {
  const marker = new g.Marker({
    map,
    position: { lat: p.lat, lng: p.lng },
    title: p.name_local,
  });

  // Pin click → YouTube new tab (D-14, D-15)
  if (p.link_id) {
    const link = linksById.get(p.link_id);
    if (link?.url) {
      const youtubeUrl = buildYouTubeWatchUrl(link.url, p.source_timestamp_sec);
      if (youtubeUrl) {
        marker.addListener('click', () => {
          window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
        });
      }
    }
  }
}
```
**Change:** build SVG data URL icon per UI-SPEC §2 Web code block before the `new g.Marker(...)` call:
```typescript
import { LOW_CONFIDENCE_THRESHOLD } from '@moajoa/core';

for (const p of places) {
  const isAI = p.source_kind === 'ai';
  const isLowConf =
    isAI && p.confidence !== null && p.confidence < LOW_CONFIDENCE_THRESHOLD;
  const fill = isAI ? '#F97316' : '#0F172A';
  const opacity = isLowConf ? 0.45 : 1.0;
  const qBadge = isLowConf
    ? `<text x="16" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" fill="white">?</text>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.16 24.84 0 16 0z" fill="${fill}" fill-opacity="${opacity}"/>${qBadge}</svg>`;

  const marker = new g.Marker({
    map,
    position: { lat: p.lat, lng: p.lng },
    title: p.name_local,
    icon: {
      url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
      scaledSize: new g.Size(32, 40),
    },
  });

  // Click handler — UNCHANGED from Phase 4 D-14
  if (p.link_id) {
    const link = linksById.get(p.link_id);
    if (link?.url) {
      const youtubeUrl = buildYouTubeWatchUrl(link.url, p.source_timestamp_sec);
      if (youtubeUrl) {
        marker.addListener('click', () => {
          window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
        });
      }
    }
  }
}
```

**Type pass-through (D-06 dependency):** `PublicBoardView['places']` (from `@moajoa/core`) must include `source_kind` and `confidence` after schema regen. The migration (file 1) adds them to RPC; **`packages/core/src/schemas/`** (PublicBoardView Zod schema, if it exists) needs the two fields added. Planner: search for `PublicBoardView` schema definition and add `source_kind: z.enum(['ai','manual'])` + `confidence: z.number().nullable()` to the places sub-schema.

**No other web changes** — InfoWindow / empty state / footer / OG image (D-25) all unchanged from Phase 4. D-17 lock: no web confirm/reject, no step indicator, no info card.

---

## Shared Patterns

### Pattern A: Korean-fixture-driven UI labels

**Sources:**
- `packages/core/src/constants.ts:149-159` (CITY_KO_MAP)
- New: `EXTRACT_STEP_KO`

**Apply to:** any UI surface that maps an internal enum/code to a user-facing Korean string. The fixture lives in `@moajoa/core` so iOS and Web read identical labels. No inline string literals in components — always import from the fixture map.

**Phase 5 use sites:** step indicator labels (StepIndicatorOverlay reads `EXTRACT_STEP_KO`). Link list row statuses are short enough that an inline map (file 4c) is acceptable — but planner may opt to add `EXTRACT_STATUS_KO` to constants.ts for symmetry. Recommendation: **inline OK for status** (single use site = 5 entries, Karpathy §3.2 simplicity > premature centralization). EXTRACT_STEP_KO IS centralized because UI-SPEC explicitly D-09 locks it.

### Pattern B: SECURITY DEFINER + `set search_path = public`

**Source:** `supabase/migrations/0002_fix_rls_recursion.sql:18-29` (am_board_owner), `0001_init.sql:62-88` (handle_new_auth_user)

**Apply to:** any SQL function that needs to bypass RLS (triggers writing across schemas, helpers checking membership). CLAUDE.md §4.4 explicitly mandates this. Phase 5 new trigger function `profiles_create_first_board` (file 1, Analog #2) follows this pattern: `security definer` + explicit `set search_path = public, auth` (or just `public` if no auth schema access needed — first board trigger only writes to public.boards, so `set search_path = public` suffices). Mismatch = silent injection vector.

### Pattern C: Soft-delete via `hidden_at = now()` + index `where hidden_at is null`

**Source:** `places.ts:50-56` (hidePlace) + `0001_init.sql:369` (`places_board_idx ... where hidden_at is null`)

**Apply to:** any "remove from view but keep history" mutation. Phase 5 `rejectAiPlace` (file 10) aliases hidePlace because the index already filters hidden rows from all list queries (`listPlacesByBoard`, `public_board_view` RPC). No new index, no new column. v2 undo possible because data is retained.

### Pattern D: Storage-key constant + typed wrapper

**Source:** `apps/ios/lib/shared-defaults.ts` (sync UserDefaults wrapper) + `packages/core/src/constants.ts:122-131` (SharedDefaultsKeys)

**Apply to:** any client-side persistent storage. Phase 5 `apps/ios/lib/onboarding.ts` (file 8) + `OnboardKeys` in constants.ts (file 3) replicates this duo:
- Key constants live in `@moajoa/core` (single source of truth)
- Wrapper module in `apps/ios/lib/` exposes typed get/set helpers
- Callers import wrapper, not the underlying storage primitive

This prevents key-name drift (CONTEXT code_context Pitfall 2 echo from Phase 3).

### Pattern E: Migration column ADD + RPC redefine in one file

**Source:** Phase 5 is establishing this pattern (no prior phase did both at once because earlier migrations only added columns OR redefined RPC, not both)

**Apply to:** any migration that adds a places/boards/links column the public_board_view RPC must surface. Phase 5 `0006_trust_ui_onboarding.sql` (file 1) bundles:
1. `alter table places add column confidence ...`
2. `create or replace function public_board_view ...` (with new field in jsonb_build_object)
3. Trigger function + trigger
4. Backfill INSERT

Reason for bundling (CONTEXT code_context Pitfall): partial migration = web SSR sees stale jsonb shape → TRUST-01 web parity (D-06) broken. **Single file, single deploy, atomic on push.**

### Pattern F: Try/catch + console.warn + showToast (error UX uniform)

**Source:** Phase 3 mutation handlers throughout `_pin-sheet.tsx`, `[id].tsx`, `_pin-add-modal.tsx`

**Apply to:** all Phase 5 new mutation handlers (`onRetry`, `onConfirm`, `onReject`, `handleDismiss`). Form:
```typescript
try {
  await mutation(...);
  onChanged?.();
} catch (e) {
  console.warn('[<context>] failed:', e);
  showToast('<korean failure copy>', 'error');
}
```
Phase 5 toast extension: error toasts can now carry an action `{ label, onPress }` (D-10) — third arg to `showToast`. Toast.tsx itself (file `apps/ios/lib/toast.tsx`) needs a small extension (props addition); not in the file scope above but **implicitly required** for D-10 retry action. Planner should add `apps/ios/lib/toast.tsx` to the file list as a 4th MODIFIED file in the iOS workstream.

---

## No Analog Found

None — every Phase 5 file has a strong codebase analog.

---

## Files Implicitly Required But Not in Scope List

Planner: please verify these are added to the implementation plan if missing:

| File | Why required |
|------|--------------|
| `apps/ios/lib/toast.tsx` (MODIFIED) | D-10 retry action button (`showToast(msg, 'error', { label, onPress })`). Current toast.tsx (`apps/ios/lib/toast.tsx:21-33`) accepts only `(message, kind, durationMs)`. Needs 4th optional arg `action?: { label: string; onPress: () => void }` + ToastHost renders inline Pressable when present. UI-SPEC §3 specifies layout (`flex-row items-center justify-between gap-2`). Also: bump `kind === 'error'` default duration from 5000 → 8000 (UI-SPEC §3 D-10 lock). |
| `packages/core/src/schemas/*.ts` (MODIFIED) | If `PublicBoardView` Zod schema exists (referenced by web's `PublicBoardMap` Props type), it must gain `source_kind` + `confidence` on the place sub-schema. Type-check fails otherwise post-migration. Planner: `grep -rn "PublicBoardView" packages/core/src/schemas/`. |
| `apps/ios/package.json` (MODIFIED, conditional) | Only if `@react-native-async-storage/async-storage` not already a dep. First plan task to verify (CONTEXT open Q #4). |

---

## Metadata

**Analog search scope:**
- `supabase/migrations/` (all 5 files scanned, 3 read deeply: 0001, 0002, 0004)
- `apps/ios/app/boards/` (all 5 files listed, 3 read deeply: [id].tsx, _pin-sheet.tsx, _pin-add-modal.tsx skim)
- `apps/ios/lib/` (all 5 files listed, 3 read deeply: toast.tsx, realtime.ts, shared-defaults.ts)
- `apps/ios/app/(tabs)/` (boards.tsx read)
- `apps/web/app/b/[slug]/_components/` (public-board-map.tsx read)
- `packages/core/src/constants.ts` read
- `packages/api/src/queries/places.ts` read
- `supabase/functions/extract-youtube/index.ts` targeted read (places upsert block, lines 180-270)

**Files scanned:** ~14 source files, ~3000 LOC
**Pattern extraction date:** 2026-05-26
**Analog match quality:** 11 / 11 exact (all in-file or sibling-file matches — Phase 5 is dominantly extension/augmentation of Phase 2/3/4 surfaces, no greenfield)
