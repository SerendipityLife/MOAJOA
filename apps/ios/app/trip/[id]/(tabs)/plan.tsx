// apps/ios/app/trip/[id]/(tabs)/plan.tsx
// Phase 18 (PLAN-01..05) — the 플랜 tab. Phase 17 shipped the empty state (State A);
// this phase fills the full plan experience per UI-SPEC States A–F:
//   A empty (no places) — the shipped stub, verbatim.
//   B pre-generation (places, no draft) — 장소가 모였어요 + the 플랜 만들기 button
//     (D-01: USER-triggered, NEVER auto-generate on mount).
//   C generating — disabled button (플랜을 짜고 있어요…) + a step-indicator-style
//     progress card driven by the plan:{trip_id} broadcast (subscribePlanProgress).
//   D draft rendered — 초안 chip, travel-mode toggle, Day sections (ordered rows +
//     adjacent leg pills), 미배치 pool, 플랜 다시 만들기, 친구와 같이 정하기.
//   E editing — drag reorder (DaySection), 제거/일정에 추가 (explicit pool moves,
//     D-13), 필수 anchor star (D-10).
//   F error — error copy + 다시 시도 retry.
import { Ionicons } from '@expo/vector-icons';
import {
  generatePlan,
  getPlanByTrip,
  getTrip,
  listPlacesByTrip,
  moveToDay,
  moveToPool,
  reorderPlanItem,
  setAnchor,
  setCollaborative,
  setTravelMode,
  type PlanWithItems,
} from '@moajoa/api';
import {
  PLAN_STEP_KO,
  type Place,
  type PlanStepType,
  type TravelModeType,
  type Trip,
} from '@moajoa/core';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { subscribePlanProgress } from '@/lib/realtime';
import { showToast } from '@/lib/toast';
import { shareCurrentTrip } from '@/lib/share-board';
import { DaySection, type DayItem } from '@/components/plan/day-section';
import { UnplacedPool } from '@/components/plan/unplaced-pool';
import { TravelModeToggle } from '@/components/plan/travel-mode-toggle';

type ProgressStep = keyof typeof PLAN_STEP_KO; // loading | clustering | routing
const PROGRESS_ORDER: ProgressStep[] = ['loading', 'clustering', 'routing'];
const PROGRESS_PCT: Record<PlanStepType, number> = {
  loading: 10,
  clustering: 50,
  routing: 80,
  done: 100,
  error: 0,
};
const MODE_ICON: Record<TravelModeType, keyof typeof Ionicons.glyphMap> = {
  transit: 'subway',
  walk: 'walk',
  drive: 'car',
};

/** Inclusive day count from a trip's start/end date (default 1). */
function dayCount(trip: Trip | null): number {
  if (!trip?.start_date || !trip?.end_date) return 1;
  const start = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

/** YYYY-MM-DD label for day N from the trip's start_date, or null. */
function dayDateLabel(trip: Trip | null, dayIndex: number): string | null {
  if (!trip?.start_date) return null;
  const d = new Date(trip.start_date);
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

export default function TripPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [plan, setPlan] = useState<PlanWithItems | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<PlanStepType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [t, ps, pl] = await Promise.all([
        getTrip(supabase, id),
        listPlacesByTrip(supabase, id),
        getPlanByTrip(supabase, id),
      ]);
      setTrip(t);
      setPlaces(ps);
      setPlan(pl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, [id]);

  // D-01: initial load ONLY fetches; it NEVER calls generatePlan. Generation is
  // user-triggered by the 플랜 만들기 button.
  useEffect(() => {
    load();
  }, [load]);

  // State C: drive the progress card + terminal transitions from the
  // plan:{trip_id} broadcast. Subscribed only while generating; cleaned up on
  // unmount / generating flip (leak guard).
  useEffect(() => {
    if (!id || !generating) return;
    const channel = subscribePlanProgress(id, ({ step }) => {
      if (step === 'done') {
        setProgressStep(null);
        setGenerating(false);
        void load();
      } else if (step === 'error') {
        setProgressStep(null);
        setGenerating(false);
        setError('플랜을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      } else {
        setProgressStep(step);
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, generating, load]);

  const runGenerate = useCallback(
    async (anchorPlaceIds: string[]) => {
      if (!id || generating) return; // Pitfall 5 double-tap guard.
      setError(null);
      setGenerating(true);
      setProgressStep('loading');
      try {
        await generatePlan(supabase, {
          trip_id: id,
          travel_mode: plan?.travel_mode ?? 'transit',
          anchor_place_ids: anchorPlaceIds,
          removed_place_ids: [],
        });
        // The broadcast 'done' refetches; but if broadcast is missed, refetch here.
        await load();
        setGenerating(false);
        setProgressStep(null);
      } catch (err: unknown) {
        setGenerating(false);
        setProgressStep(null);
        const msg = (err as { message?: string })?.message ?? '';
        setError(
          msg.includes('no_placeable') || msg.includes('placeable')
            ? '자동 배치할 장소가 없어요. 위치가 있는 장소를 먼저 모아주세요.'
            : '플랜을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      }
    },
    [id, generating, plan?.travel_mode, load],
  );

  const onRegenerate = useCallback(() => {
    const anchorIds = (plan?.plan_items ?? [])
      .filter((it) => it.is_anchor)
      .map((it) => it.place_id);
    Alert.alert(
      '플랜을 다시 만들까요?',
      '초안을 다시 만들면 지금까지 편집한 내용이 사라져요. 필수로 표시한 장소는 그대로 반영돼요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '다시 만들기', style: 'destructive', onPress: () => void runGenerate(anchorIds) },
      ],
    );
  }, [plan, runGenerate]);

  const onChangeMode = useCallback(
    async (mode: TravelModeType) => {
      if (!plan) return;
      try {
        await setTravelMode(supabase, plan.id, mode);
        // Persist the flag, then regenerate with same anchors so legs re-ground
        // in the new mode (D-08 — the EF re-grounds legs per mode).
        const anchorIds = plan.plan_items.filter((it) => it.is_anchor).map((it) => it.place_id);
        await runGenerate(anchorIds);
      } catch (err) {
        console.warn('[setTravelMode] failed:', err);
        showToast('이동수단 변경 실패', 'error');
      }
    },
    [plan, runGenerate],
  );

  const onReorder = useCallback(
    async (itemId: string, toIndex: number) => {
      const item = plan?.plan_items.find((it) => it.id === itemId);
      if (!item) return;
      try {
        await reorderPlanItem(supabase, itemId, {
          day_index: item.day_index,
          sort_order: toIndex,
        });
        await load();
      } catch (err) {
        console.warn('[reorder] failed:', err);
      }
    },
    [plan, load],
  );

  const onToggleAnchor = useCallback(
    async (itemId: string, next: boolean) => {
      try {
        await setAnchor(supabase, itemId, next);
        await load();
      } catch (err) {
        console.warn('[setAnchor] failed:', err);
      }
    },
    [load],
  );

  const onRemove = useCallback(
    async (itemId: string) => {
      try {
        await moveToPool(supabase, itemId);
        showToast('미배치로 옮겼어요.', 'success');
        await load();
      } catch (err) {
        console.warn('[moveToPool] failed:', err);
      }
    },
    [load],
  );

  const onAddToDay = useCallback(
    async (placeId: string) => {
      if (!plan) return;
      const days = dayCount(trip);
      const lastDay = days - 1;
      const sameDay = plan.plan_items.filter((it) => it.day_index === lastDay);
      try {
        await moveToDay(supabase, {
          plan_id: plan.id,
          place_id: placeId,
          day_index: lastDay,
          sort_order: sameDay.length,
        });
        await load();
      } catch (err) {
        console.warn('[moveToDay] failed:', err);
      }
    },
    [plan, trip, load],
  );

  const onToggleCollaborative = useCallback(async () => {
    if (!plan || !id) return;
    try {
      await setCollaborative(supabase, plan.id, id);
      await shareCurrentTrip(id);
      await load();
    } catch (err) {
      console.warn('[setCollaborative] failed:', err);
      showToast('공유 준비 실패', 'error');
    }
  }, [plan, id, load]);

  // --- Render ----------------------------------------------------------------

  if (!loaded) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2979FF" />
      </SafeAreaView>
    );
  }

  // State A — empty (no places). Shipped stub, verbatim.
  if (places.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
            <Ionicons name="sparkles" size={36} color="#2979FF" />
          </View>
          <Text className="text-xl font-semibold text-neutral-900">아직 플랜이 없어요</Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            유튜브 링크를 추출하면 영상 속 장소로 플랜을 만들 수 있어요.
          </Text>
          <View className="flex-row items-center mt-6">
            <Ionicons name="share-outline" size={16} color="#2979FF" style={{ marginRight: 4 }} />
            <Text className="text-sm font-semibold text-brand-500">링크를 공유해 시작하기</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // State C — generating (progress card). Takes precedence over B/D.
  if (generating) {
    const currentIdx = progressStep
      ? PROGRESS_ORDER.indexOf(progressStep as ProgressStep)
      : -1;
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="bg-white rounded-3xl px-7 py-6 items-center self-stretch"
            style={{
              gap: 16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
            }}
          >
            <ActivityIndicator size="large" color="#2979FF" />
            <Text className="text-base font-bold text-neutral-900">플랜을 짜고 있어요</Text>
            <View style={{ gap: 12 }} className="items-start self-stretch">
              {PROGRESS_ORDER.map((step, idx) => {
                const isDone = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const labelClass = isCurrent
                  ? 'text-base font-semibold text-brand-500'
                  : isDone
                    ? 'text-sm text-neutral-500'
                    : 'text-xs font-medium text-neutral-300';
                return (
                  <View key={step} className="flex-row items-center" style={{ gap: 10 }}>
                    <View
                      className="rounded-full"
                      style={{
                        width: isCurrent ? 10 : 8,
                        height: isCurrent ? 10 : 8,
                        backgroundColor: isCurrent ? '#2979FF' : isDone ? '#9CA3AF' : 'transparent',
                        borderWidth: isDone || isCurrent ? 0 : 1.5,
                        borderColor: '#D1D5DB',
                      }}
                    />
                    <Text className={labelClass}>{PLAN_STEP_KO[step]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View className="flex-row items-center mt-6 opacity-50">
            <ActivityIndicator color="#2979FF" style={{ marginRight: 8 }} />
            <Text className="text-sm text-neutral-500">플랜을 짜고 있어요…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // State F — error.
  if (error) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
          </View>
          <Text className="text-base text-neutral-500 text-center leading-relaxed">{error}</Text>
          <Pressable
            onPress={() => void runGenerate([])}
            className="bg-brand-500 mt-6 px-6 py-3 rounded-lg items-center justify-center"
            style={{ minHeight: 44 }}
          >
            <Text className="text-sm font-semibold text-white">다시 시도</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // State B — pre-generation (places exist, no draft plan).
  if (!plan) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
            <Ionicons name="sparkles" size={36} color="#2979FF" />
          </View>
          <Text className="text-xl font-semibold text-neutral-900">장소가 모였어요</Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            모은 장소로 동선과 날짜별 일정을 짜드릴게요. 아래 버튼을 눌러보세요.
          </Text>
          <Pressable
            onPress={() => void runGenerate([])}
            className="bg-brand-500 mt-8 self-stretch py-3.5 rounded-lg items-center justify-center active:opacity-90"
            style={{ minHeight: 44 }}
          >
            <Text className="text-sm font-semibold text-white">플랜 만들기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // State D/E — draft rendered + editing.
  const placedIds = new Set(plan.plan_items.map((it) => it.place_id));
  const pool = places.filter((p) => !placedIds.has(p.id));
  const placesById = new Map(places.map((p) => [p.id, p]));
  const days = dayCount(trip);
  const modeIcon = MODE_ICON[plan.travel_mode];

  // Group placed items into ordered day buckets.
  const dayBuckets: DayItem[][] = Array.from({ length: days }, () => []);
  for (const it of [...plan.plan_items].sort((a, b) => a.sort_order - b.sort_order)) {
    const place = placesById.get(it.place_id);
    if (!place) continue; // FK-safety: skip an item whose place was deleted.
    const di = it.day_index < days ? it.day_index : days - 1;
    dayBuckets[di].push({
      itemId: it.id,
      place,
      isAnchor: it.is_anchor,
      legSeconds: it.leg_travel_seconds,
    });
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {/* Header: 초안 chip + regenerate + collaborative */}
        <View className="flex-row items-center justify-between pt-3">
          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-brand-50">
            <Ionicons name="document-text-outline" size={11} color="#2563EB" />
            <Text className="text-xs text-brand-600 ml-1">초안</Text>
          </View>
          <Pressable
            onPress={onRegenerate}
            hitSlop={8}
            className="flex-row items-center"
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={14} color="#2979FF" style={{ marginRight: 4 }} />
            <Text className="text-sm font-semibold text-brand-500">플랜 다시 만들기</Text>
          </Pressable>
        </View>

        {/* Travel-mode toggle (plan scope) */}
        <View className="mt-4">
          <TravelModeToggle mode={plan.travel_mode} onChange={onChangeMode} />
        </View>

        {/* Day sections */}
        {dayBuckets.map((items, di) => (
          <DaySection
            key={di}
            dayIndex={di}
            dateLabel={dayDateLabel(trip, di)}
            items={items}
            modeIcon={modeIcon}
            onReorder={onReorder}
            onToggleAnchor={onToggleAnchor}
            onRemove={onRemove}
          />
        ))}

        {/* 미배치 pool */}
        <UnplacedPool places={pool} onAddToDay={onAddToDay} />

        {/* 친구와 같이 정하기 */}
        <Pressable
          onPress={onToggleCollaborative}
          className={`flex-row items-center justify-center mt-8 py-3.5 rounded-xl ${
            plan.collaborative ? 'bg-brand-500' : 'bg-neutral-100'
          }`}
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Ionicons
            name="people"
            size={18}
            color={plan.collaborative ? '#FFFFFF' : '#6B7280'}
            style={{ marginRight: 8 }}
          />
          <Text
            className={`text-base font-semibold ${
              plan.collaborative ? 'text-white' : 'text-neutral-700'
            }`}
          >
            친구와 같이 정하기
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
