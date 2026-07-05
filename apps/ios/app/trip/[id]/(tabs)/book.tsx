// apps/ios/app/trip/[id]/(tabs)/book.tsx
// Phase 20 (BOOK-02, UI-SPEC Screen 3) — the 예약 체크리스트 홈. Replaces the
// 17-04 neutral stub entirely. This tab is the MANAGEMENT surface of the one
// checklist dataset the plan tab also feeds (D-03: 데이터는 하나, 표면만 둘):
//   - auto-derived rows (stay/esim/transport/activity) via core's pure derivation
//     mirrored into the DB on load (reconcile is invisible — no spinner),
//   - manual rows the user adds (D-10),
//   - the 3-state progression todo → clicked('확인함') → done (D-11: 완료의
//     원천은 사용자 — no confirmation on check),
//   - checked rows that fell out of the plan stay, badged render-time via
//     isDesynced (D-13: 돈 쓴 기록 보존),
//   - foreground return = QUIET refetch — the clicked row flips to 확인함 with
//     an inline hint only; no popup, no banner, no toast (D-15).
// Early-return state machine mirrors plan.tsx: loading → error(State F mirror)
// → empty-dateless / empty-no-plan (D-04) → active list.
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  addManualItem,
  deleteChecklistItem,
  getPlanByTrip,
  getTrip,
  listChecklist,
  listClickedChecklistItemIds,
  listPlacesByTrip,
  reconcileChecklist,
  setItemStatus,
  type PlanWithItems,
} from '@moajoa/api';
import {
  BOOKING_REGION_MAP,
  buildAiraloDestUrl,
  buildSearchDestUrl,
  type ChecklistItem,
  type ChecklistStatusType,
  CITY_KO_MAP,
  COMPARE_LABELS,
  deriveChecklistAutos,
  isBookableActivity,
  isDesynced,
  ManualItemTitleSchema,
  type Place,
  type Trip,
} from '@moajoa/core';
import { router, useGlobalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { kkdayAvailable, openBooking, openDirectSearch } from '@/lib/booking';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { CompareFrameCard, type CompareRow } from '@/components/booking/compare-frame-card';
import { ChecklistRow } from '@/components/booking/checklist-row';

/** Display names for BOOKING_REGION_MAP transport providers (copy stays in core). */
const PROVIDER_NAME = { klook: 'Klook', kkday: 'KKday' } as const;

/** Singleton render order: 숙소 → 유심 → 교통 (UI-SPEC Screen 3). */
const SINGLETON_ORDER: Record<string, number> = { stay: 0, esim: 1, transport: 2 };

/**
 * Mirror the core-derived auto checklist into the DB (same seam as plan.tsx —
 * D-03 one dataset). Reconcile is INVISIBLE (no spinner, UI-SPEC): failure is
 * supplementary-data quiet — the list still renders from `existing`.
 */
async function reconcileTripChecklist(
  tripId: string,
  trip: Trip | null,
  places: Place[],
  plan: PlanWithItems | null,
  existing: ChecklistItem[],
): Promise<ChecklistItem[]> {
  // D-04 gate — dateless / no-draft trips keep every booking surface off.
  if (!plan || !trip?.start_date) return existing;
  const region = trip.city_code ? BOOKING_REGION_MAP[trip.city_code] : undefined;
  const placedIds = new Set(plan.plan_items.map((it) => it.place_id));
  const bookablePlaces = places
    .filter((p) => placedIds.has(p.id) && isBookableActivity(p.category))
    .map((p) => ({ placeId: p.id, title: p.name_ko ?? p.name_local }));
  const diff = deriveChecklistAutos({
    covered: {
      esimSlug: region?.esimSlug ?? null,
      transportLabel: region?.transport?.labelKo ?? null,
    },
    bookablePlaces,
    existing,
  });
  if (diff.toInsert.length === 0 && diff.toDeleteIds.length === 0) return existing;
  try {
    await reconcileChecklist(supabase, tripId, diff);
    return await listChecklist(supabase, tripId);
  } catch (err) {
    console.warn('[book reconcile] failed:', err);
    return existing;
  }
}

export default function TripBookScreen() {
  // Tab screens are reached via tab-press, not the initial URL match — the
  // parent [id] segment does NOT surface in useLocalSearchParams there (returns
  // undefined), which stalls load() on `if (!id) return` before the spinner can
  // clear. useGlobalSearchParams reads the full URL so id is always present.
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [plan, setPlan] = useState<PlanWithItems | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Manual-add sheet (D-10) — content gated on addOpen (19-03 confirm-sheet idiom).
  const addSheetRef = useRef<BottomSheet>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!id) return;
      try {
        const [t, ps, pl, cl, clicked, auth] = await Promise.all([
          getTrip(supabase, id),
          listPlacesByTrip(supabase, id),
          getPlanByTrip(supabase, id),
          listChecklist(supabase, id),
          // Un-check landing judgment only (clicked vs todo) — soft-fail to ∅.
          listClickedChecklistItemIds(supabase, id).catch((err) => {
            console.warn('[listClickedChecklistItemIds] failed:', err);
            return new Set<string>();
          }),
          supabase.auth.getUser(),
        ]);
        setTrip(t);
        setPlaces(ps);
        setPlan(pl);
        setClickedIds(clicked);
        setUserId(auth.data.user?.id ?? null);
        setChecklist(await reconcileTripChecklist(id, t, ps, pl, cl));
        setError(false);
      } catch (err) {
        console.warn('[book load] failed:', err);
        // D-15: a QUIET foreground refetch never replaces good data with an
        // error screen — only the initial/retry load surfaces State F.
        if (!opts?.quiet) setError(true);
      } finally {
        setLoaded(true);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // D-15 — foreground return: QUIET refetch. The row a click transitioned flips
  // to '확인함' with the inline hint only — no popup/banner/toast. Mirrors the
  // _layout.tsx AppState idiom (inFlight ref guard + arrow-wrapped sub.remove()).
  const inFlight = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active' || inFlight.current) return;
      inFlight.current = true;
      void load({ quiet: true }).finally(() => {
        inFlight.current = false;
      });
    });
    return () => {
      // Pitfall 4: arrow-wrap sub.remove() so `this` binding on the emitter
      // is preserved during hot reload + unmount.
      sub.remove();
    };
  }, [load]);

  // Status control tap: todo/clicked → done; un-checking done lands on clicked
  // if a click record exists, else todo (UI-SPEC Screen 3). Optimistic + revert.
  const onToggleDone = useCallback(
    async (item: ChecklistItem) => {
      const next: ChecklistStatusType =
        item.status === 'done' ? (clickedIds.has(item.id) ? 'clicked' : 'todo') : 'done';
      const prev = checklist;
      setChecklist((cur) => cur.map((c) => (c.id === item.id ? { ...c, status: next } : c)));
      try {
        await setItemStatus(supabase, item.id, next);
      } catch (err) {
        console.warn('[setItemStatus] failed:', err);
        setChecklist(prev);
        showToast('상태 변경 실패', 'error');
      }
    },
    [checklist, clickedIds],
  );

  const onDeleteItem = useCallback((item: ChecklistItem) => {
    Alert.alert('이 항목을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChecklistItem(supabase, item.id);
            setChecklist((cur) => cur.filter((c) => c.id !== item.id));
            setExpandedId((cur) => (cur === item.id ? null : cur));
          } catch (err) {
            console.warn('[deleteChecklistItem] failed:', err);
            showToast('삭제 실패', 'error');
          }
        },
      },
    ]);
  }, []);

  const openAddSheet = useCallback(() => {
    setAddTitle('');
    setAddOpen(true);
    addSheetRef.current?.snapToIndex(0);
  }, []);
  const closeAddSheet = useCallback(() => {
    addSheetRef.current?.close();
    setAddOpen(false);
  }, []);

  const onSubmitManual = useCallback(async () => {
    if (!id || adding) return;
    // Zod boundary validation before the write (CLAUDE.md §4.5, T-20-15).
    const parsed = ManualItemTitleSchema.safeParse(addTitle.trim());
    if (!parsed.success) return;
    setAdding(true);
    try {
      const created = await addManualItem(supabase, { trip_id: id, title: parsed.data });
      setChecklist((cur) => [...cur, created]);
      closeAddSheet();
    } catch (err) {
      console.warn('[addManualItem] failed:', err);
      showToast('항목 추가 실패', 'error');
    } finally {
      setAdding(false);
    }
  }, [id, adding, addTitle, closeAddSheet]);

  // --- Render ----------------------------------------------------------------

  if (!loaded) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2979FF" />
      </SafeAreaView>
    );
  }

  // State F mirror — load failed (plan.tsx error idiom, retry = load 재실행).
  if (error) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
          </View>
          <Text className="text-base text-neutral-500 text-center leading-relaxed">
            체크리스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </Text>
          <Pressable
            onPress={() => void load()}
            className="bg-brand-500 mt-6 px-6 py-3 rounded-lg items-center justify-center"
            style={{ minHeight: 44 }}
          >
            <Text className="text-sm font-semibold text-white">다시 시도</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // D-04 empty state 1 — dateless trip (날짜 투표 미완).
  if (trip && !trip.start_date) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="calendar-outline" size={36} color="#D1D5DB" />
          </View>
          <Text className="text-xl font-semibold text-neutral-500 text-center">
            일정이 정해지면 예약을 시작할 수 있어요
          </Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            날짜 투표가 끝나면 예약 체크리스트가 열려요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // D-04 empty state 2 — dated but no draft plan yet.
  if (!plan) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="map-outline" size={36} color="#D1D5DB" />
          </View>
          <Text className="text-xl font-semibold text-neutral-500 text-center">
            먼저 플랜을 만들어주세요
          </Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            플랜 탭에서 플랜을 만들면 예약할 항목이 자동으로 정리돼요.
          </Text>
          <Pressable
            onPress={() => router.push(`/trip/${id}/plan`)}
            hitSlop={8}
            className="mt-6 items-center justify-center"
            style={{ minHeight: 44 }}
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-brand-600">플랜 탭으로 가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Active list -------------------------------------------------------------

  const region = trip?.city_code ? BOOKING_REGION_MAP[trip.city_code] : undefined;
  const cityKo = trip?.city_code ? CITY_KO_MAP[trip.city_code] : undefined;
  const stayCity = cityKo ?? trip?.title ?? '';
  const stayCheckIn = trip?.start_date ?? '';
  const stayCheckOut = trip?.end_date ?? trip?.start_date ?? '';
  const placesById = new Map(places.map((p) => [p.id, p]));
  const bookingCtx = { tripId: id ?? '', userId: userId ?? '' };

  // Current plan's bookable place ids — the render-time isDesynced input (D-13).
  const placedIds = new Set(plan.plan_items.map((it) => it.place_id));
  const currentBookableIds = new Set(
    places.filter((p) => placedIds.has(p.id) && isBookableActivity(p.category)).map((p) => p.id),
  );

  // Order: singletons (숙소→유심→교통) → activities (plan order) → manual.
  const planOrder = new Map(
    [...plan.plan_items]
      .sort((a, b) => a.day_index - b.day_index || a.sort_order - b.sort_order)
      .map((it, idx) => [it.place_id, idx]),
  );
  const ordered = [...checklist].sort((a, b) => {
    const groupOf = (c: ChecklistItem) =>
      c.source === 'manual' ? 2 : c.kind === 'activity' ? 1 : 0;
    const ga = groupOf(a);
    const gb = groupOf(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return (SINGLETON_ORDER[a.kind] ?? 9) - (SINGLETON_ORDER[b.kind] ?? 9);
    if (ga === 1) {
      const pa = a.place_id != null ? (planOrder.get(a.place_id) ?? Infinity) : Infinity;
      const pb = b.place_id != null ? (planOrder.get(b.place_id) ?? Infinity) : Infinity;
      if (pa !== pb) return pa - pb;
    }
    return 0; // manual rows / desynced ties keep listChecklist's oldest-first order
  });

  const doneCount = checklist.filter((c) => c.status === 'done').length;

  // Expanded-row provider frame per kind (borderless CompareFrameCard embedded).
  // Completed rows keep working [보기] buttons — re-open allowed (UI-SPEC).
  const expandedContent = (item: ChecklistItem) => {
    if (item.kind === 'custom') return null; // manual rows: no provider rows
    if (item.kind === 'stay') {
      const rows: CompareRow[] = (['agoda', 'booking'] as const).map((provider) => ({
        providerName: provider === 'agoda' ? 'Agoda' : 'Booking.com',
        labelKo: COMPARE_LABELS[provider],
        onView: () =>
          void openDirectSearch({
            provider,
            params: { city: stayCity, checkIn: stayCheckIn, checkOut: stayCheckOut },
            ctx: bookingCtx,
            checklistItemId: item.id,
          }),
      }));
      return <CompareFrameCard variant="full" embedded rows={rows} />;
    }
    if (item.kind === 'esim') {
      const esimSlug = region?.esimSlug ?? null;
      if (esimSlug === null) return null; // D-09: uncovered → no provider row
      return (
        <CompareFrameCard
          variant="full"
          embedded
          rows={[
            {
              providerName: 'Airalo',
              labelKo: COMPARE_LABELS.airalo,
              onView: () =>
                void openBooking({
                  program: 'airalo',
                  destUrl: buildAiraloDestUrl(esimSlug),
                  ctx: bookingCtx,
                  checklistItemId: item.id,
                  providerLabel: 'Airalo',
                }),
            },
          ]}
        />
      );
    }
    if (item.kind === 'transport') {
      const transport = region?.transport ?? null;
      if (transport === null) return null;
      return (
        <CompareFrameCard
          variant="full"
          embedded
          rows={[
            {
              providerName: PROVIDER_NAME[transport.provider],
              labelKo: COMPARE_LABELS[transport.provider],
              onView: () =>
                void openBooking({
                  program: transport.provider,
                  destUrl: buildSearchDestUrl(transport.provider, transport.searchQuery),
                  ctx: bookingCtx,
                  checklistItemId: item.id,
                  providerLabel: PROVIDER_NAME[transport.provider],
                }),
            },
          ]}
        />
      );
    }
    // activity — Klook/KKday full rows, 장소 타깃 검색 (D-07).
    const place = item.place_id != null ? placesById.get(item.place_id) : undefined;
    const query = place ? (place.name_ko ?? place.name_local) : item.title;
    const ctx = { ...bookingCtx, placeId: item.place_id };
    const rows: CompareRow[] = [
      {
        providerName: 'Klook',
        labelKo: COMPARE_LABELS.klook,
        onView: () =>
          void openBooking({
            program: 'klook',
            destUrl: buildSearchDestUrl('klook', query),
            ctx,
            checklistItemId: item.id,
            providerLabel: 'Klook',
          }),
      },
    ];
    if (kkdayAvailable()) {
      rows.push({
        providerName: 'KKday',
        labelKo: COMPARE_LABELS.kkday,
        onView: () =>
          void openBooking({
            program: 'kkday',
            destUrl: buildSearchDestUrl('kkday', query),
            ctx,
            checklistItemId: item.id,
            providerLabel: 'KKday',
          }),
      });
    }
    return <CompareFrameCard variant="full" embedded rows={rows} />;
  };

  const canSubmit = addTitle.trim().length > 0 && !adding;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {/* Header: title + progress caption */}
        <View className="pt-3 mb-4">
          <Text className="text-lg font-semibold text-neutral-900">예약 체크리스트</Text>
          <Text className="text-xs text-neutral-400 mt-1">
            {doneCount}/{checklist.length} 완료
          </Text>
        </View>

        {ordered.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            desynced={isDesynced(item, currentBookableIds)}
            expanded={expandedId === item.id}
            onToggleDone={() => void onToggleDone(item)}
            onToggleExpand={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
            onDelete={() => onDeleteItem(item)}
          >
            {expandedId === item.id ? expandedContent(item) : null}
          </ChecklistRow>
        ))}

        {/* 항목 추가 (D-10) */}
        <Pressable
          onPress={openAddSheet}
          className="flex-row items-center justify-center py-3.5 rounded-xl bg-neutral-100 mt-8 active:opacity-70"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={18} color="#2979FF" />
          <Text className="text-base font-semibold text-neutral-700 ml-2">항목 추가</Text>
        </Pressable>
      </ScrollView>

      {/* Manual-add sheet (D-10) — 19-03 확정 시트 idiom. */}
      <BottomSheet
        ref={addSheetRef}
        index={-1}
        snapPoints={['45%']}
        enablePanDownToClose
        onClose={() => setAddOpen(false)}
        backgroundStyle={{ backgroundColor: '#fff' }}
      >
        <BottomSheetView>
          {addOpen && (
            <View className="px-6 pt-2 pb-8 bg-white">
              <Text className="text-lg font-semibold text-neutral-900">예약 항목 추가</Text>
              <TextInput
                value={addTitle}
                onChangeText={setAddTitle}
                placeholder="예: 항공권, 레스토랑 예약"
                placeholderTextColor="#9CA3AF"
                maxLength={80}
                autoFocus
                className="border border-neutral-200 rounded-lg px-3 py-3 mt-4 text-sm text-neutral-900"
                accessibilityLabel="예약 항목 이름"
              />
              <Pressable
                onPress={() => void onSubmitManual()}
                disabled={!canSubmit}
                className={`items-center justify-center rounded-xl py-3.5 mt-4 ${
                  canSubmit ? 'bg-brand-500 active:opacity-90' : 'bg-neutral-200'
                }`}
                style={{ minHeight: 44 }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
              >
                <Text
                  className={`text-sm font-semibold ${canSubmit ? 'text-white' : 'text-neutral-400'}`}
                >
                  추가하기
                </Text>
              </Pressable>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}
