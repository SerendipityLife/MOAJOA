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
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  addPollOption,
  confirmPollDate,
  generatePlan,
  getPlanByTrip,
  getPollByTrip,
  getPollOptions,
  getPollTally,
  getTrip,
  listChecklist,
  listPlacesByTrip,
  moveToDay,
  moveToPool,
  type PollOption,
  reconcileChecklist,
  removePollOption,
  reorderPlanItem,
  setAnchor,
  setCollaborative,
  setPollMode,
  setTravelMode,
  updateTrip,
  type PlanWithItems,
} from '@moajoa/api';
import {
  BOOKING_REGION_MAP,
  buildAiraloDestUrl,
  buildSearchDestUrl,
  type ChecklistItem,
  CITY_KO_MAP,
  COMPARE_LABELS,
  contiguousBlock,
  type DatePollModeType,
  deriveChecklistAutos,
  isBookableActivity,
  PLAN_STEP_KO,
  type Place,
  type PlanStepType,
  POLL_GRID_WINDOW_MAX_DAYS,
  POLL_RANGE_OPTIONS_MAX,
  type TravelModeType,
  type Trip,
} from '@moajoa/core';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { kkdayAvailable, openBooking, openDirectSearch } from '@/lib/booking';
import { subscribePlanProgress, subscribePollChannel } from '@/lib/realtime';
import { showToast } from '@/lib/toast';
import { shareCurrentTrip } from '@/lib/share-board';
import { CompareFrameCard, type CompareRow } from '@/components/booking/compare-frame-card';
import { DaySection, type DayItem } from '@/components/plan/day-section';
import { UnplacedPool } from '@/components/plan/unplaced-pool';
import { TravelModeToggle } from '@/components/plan/travel-mode-toggle';
import { DatePickerSheet } from '@/components/boards/date-picker-sheet';
import { autoBoardTitle, toYMD } from '@/lib/trip-format';

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

// --- Booking cluster (Phase 20) ----------------------------------------------
// Same opacity-light row shadow as plan-item-row.tsx (visual continuity).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

/** Display names for BOOKING_REGION_MAP transport providers (copy stays in core). */
const PROVIDER_NAME = { klook: 'Klook', kkday: 'KKday' } as const;

/** 'YYYY-MM-DD' → 'MM.DD' (stay-card prefill caption, UI-SPEC Screen 1). */
function mmdd(ymd: string): string {
  return `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`;
}

/**
 * Phase 20 (D-03/D-11) — mirror the core-derived auto checklist into the DB so
 * a plan-tab [보기] tap carries a checklist item id and flips the SAME item the
 * book tab shows (one dataset, two surfaces). Failure is supplementary-data
 * quiet (console.warn): the cluster still renders, clicks still open — only
 * the '확인함' linkage degrades until the next load.
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
    console.warn('[reconcileTripChecklist] failed:', err);
    return existing;
  }
}

// --- Date-poll (Phase 19) ----------------------------------------------------
// Host-readable poll metadata (getPollByTrip — no voter PII, T-19-07).
type PollMeta = {
  id: string;
  poll_code: string | null;
  mode: DatePollModeType;
  status: 'open' | 'closed';
};
// One range-mode tally entry: a candidate option + its available count + voters.
type RangeTally = {
  option_id: string;
  start_date: string;
  end_date: string;
  available_count: number;
  nicknames: string[];
};
// One grid-mode tally entry: a single day's available count + voters.
type GridTally = {
  vote_date: string;
  available_count: number;
  nicknames: string[];
};
type PollTally = {
  mode: DatePollModeType;
  status: 'open' | 'closed';
  tally: (RangeTally | GridTally)[];
};

/** Distinct voter nicknames across all tally entries = participation count N. */
function tallyVoterCount(tally: PollTally | null): number {
  if (!tally) return 0;
  const names = new Set<string>();
  for (const t of tally.tally) for (const n of t.nicknames ?? []) names.add(n);
  return names.size;
}

/** The leader entry (most 가능) — the 최다 후보 the summary line surfaces. */
function tallyLeaderLabel(tally: PollTally | null): string | null {
  if (!tally || tally.tally.length === 0) return null;
  const leader = [...tally.tally].sort(
    (a, b) => (b.available_count ?? 0) - (a.available_count ?? 0),
  )[0];
  if (!leader || (leader.available_count ?? 0) === 0) return null;
  return 'vote_date' in leader ? leader.vote_date : leader.start_date;
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

  // Phase 20 (D-03): booking checklist rows — plan-tab clicks carry these ids
  // so the book tab's '확인함' transition points at the SAME item. userId feeds
  // the click-attribution context (booking_clicks WITH CHECK user_id=auth.uid()).
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Date-poll (Phase 19): host-readable poll meta + live tally for the 날짜 투표
  // management card. Only loaded for a dateless trip (D-05 branch).
  const [poll, setPoll] = useState<PollMeta | null>(null);
  const [tally, setTally] = useState<PollTally | null>(null);
  // Phase 19 (GAP-19A, D-07): host candidate windows voters vote on. range =
  // several ranges; grid = one wide window. Empty until the host adds them.
  const [options, setOptions] = useState<PollOption[]>([]);
  const [optionSheetOpen, setOptionSheetOpen] = useState(false);
  const confirmSheetRef = useRef<BottomSheet>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [t, ps, pl, cl, auth] = await Promise.all([
        getTrip(supabase, id),
        listPlacesByTrip(supabase, id),
        getPlanByTrip(supabase, id),
        // Checklist is supplementary data (D-03): a failed read only degrades
        // the '확인함' linkage — the plan render never blocks on it.
        listChecklist(supabase, id).catch((err) => {
          console.warn('[listChecklist] failed:', err);
          return [] as ChecklistItem[];
        }),
        supabase.auth.getUser(),
      ]);
      setTrip(t);
      setPlaces(ps);
      setPlan(pl);
      setUserId(auth.data.user?.id ?? null);
      setChecklist(await reconcileTripChecklist(id, t, ps, pl, cl));
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, [id]);

  // D-05: load the poll meta + tally ONLY when the trip is dateless (no start_date).
  // A dated trip never reads the poll seam (keeps the dated path identical).
  const isDateless = !!trip && !trip.start_date;
  const refetchTally = useCallback(async () => {
    if (!poll?.poll_code) return;
    try {
      setTally((await getPollTally(supabase, poll.poll_code)) as PollTally);
    } catch (err) {
      console.warn('[getPollTally] failed:', err);
    }
  }, [poll?.poll_code]);

  const loadPoll = useCallback(async () => {
    if (!id) return;
    try {
      const p = (await getPollByTrip(supabase, id)) as PollMeta | null;
      setPoll(p);
      if (p) {
        setOptions(await getPollOptions(supabase, p.id));
        if (p.poll_code) {
          setTally((await getPollTally(supabase, p.poll_code)) as PollTally);
        }
      }
    } catch (err) {
      console.warn('[loadPoll] failed:', err);
    }
  }, [id]);

  useEffect(() => {
    if (isDateless) void loadPoll();
  }, [isDateless, loadPoll]);

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

  // Phase 19: while the 날짜 투표 management card is showing (dateless + open poll),
  // subscribe to poll:{trip_id}; refetch the tally on every vote / presence sync so
  // the summary line stays live. Same leak guard as the plan-progress effect.
  useEffect(() => {
    if (!id || !isDateless || poll?.status === 'closed') return;
    const channel = subscribePollChannel(id, (e) => {
      if (e.kind === 'vote' || e.kind === 'presence') void refetchTally();
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, isDateless, poll?.status, refetchTally]);

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

  // --- Date-poll handlers (Phase 19) -----------------------------------------

  // D-07: host switches range↔grid on the management card, gated to the pre-share /
  // 0-vote window. setPollMode is owner-guarded by date_polls_write RLS (T-19-04).
  const onChangePollMode = useCallback(
    async (mode: DatePollModeType) => {
      if (!poll || poll.mode === mode) return;
      try {
        await setPollMode(supabase, poll.id, mode);
        await loadPoll(); // refetch so the card + confirm flow reflect the new mode
      } catch (err) {
        Alert.alert('모드 변경 실패', err instanceof Error ? err.message : String(err));
      }
    },
    [poll, loadPoll],
  );

  // GAP-19A: host adds the candidate windows voters vote on (date_poll_options,
  // owner-gated RLS). range = append up to POLL_RANGE_OPTIONS_MAX discrete ranges;
  // grid = ONE window (re-setting replaces it) ≤ POLL_GRID_WINDOW_MAX_DAYS days.
  // Editing is locked once the first vote lands (canEditOptions, mirrors the mode
  // toggle's 0-vote gate) so a change can't strand cast votes.
  const onAddOption = useCallback(
    async (start: Date, end: Date | null) => {
      if (!poll) return;
      const startYMD = toYMD(start);
      const endYMD = toYMD(end ?? start);
      const spanDays = Math.round((new Date(endYMD).getTime() - new Date(startYMD).getTime()) / 86400000) + 1;
      try {
        if (poll.mode === 'grid') {
          if (spanDays > POLL_GRID_WINDOW_MAX_DAYS) {
            Alert.alert('기간이 너무 길어요', `투표 기간은 최대 ${POLL_GRID_WINDOW_MAX_DAYS}일까지예요.`);
            return;
          }
          // Single window — replace any existing window.
          for (const o of options) await removePollOption(supabase, o.id);
          await addPollOption(supabase, poll.id, { startDate: startYMD, endDate: endYMD });
        } else {
          if (options.length >= POLL_RANGE_OPTIONS_MAX) {
            Alert.alert('후보가 너무 많아요', `후보 날짜는 최대 ${POLL_RANGE_OPTIONS_MAX}개까지예요.`);
            return;
          }
          await addPollOption(supabase, poll.id, { startDate: startYMD, endDate: endYMD });
        }
        setOptions(await getPollOptions(supabase, poll.id));
        // F-19-1: the confirm sheet lists candidates from `tally` (per-option
        // counts), not `options` — refetch it so a just-added candidate shows up
        // in 확정 without an app restart.
        if (poll.poll_code) setTally((await getPollTally(supabase, poll.poll_code)) as PollTally);
      } catch (err) {
        Alert.alert('후보 날짜 추가 실패', err instanceof Error ? err.message : String(err));
      }
    },
    [poll, options],
  );

  const onRemoveOption = useCallback(
    async (optionId: string) => {
      if (!poll) return;
      try {
        await removePollOption(supabase, optionId);
        setOptions(await getPollOptions(supabase, poll.id));
        // F-19-1: keep the tally-based confirm sheet in sync with the options.
        if (poll.poll_code) setTally((await getPollTally(supabase, poll.poll_code)) as PollTally);
      } catch (err) {
        Alert.alert('후보 날짜 삭제 실패', err instanceof Error ? err.message : String(err));
      }
    },
    [poll],
  );

  const pollUrl = useCallback((code: string) => {
    const base =
      (Constants.expoConfig?.extra?.webUrl as string | undefined)?.replace(/\/+$/, '') ??
      'https://moajoa.app';
    return `${base}/poll/${code}`;
  }, []);

  const onShareInvite = useCallback(async () => {
    if (!poll?.poll_code) return;
    const url = pollUrl(poll.poll_code);
    await Share.share({
      message: `MOAJOA에서 같이 날짜 정해요! 가능한 날짜에 투표해 주세요 👇\n${url}`,
    });
  }, [poll?.poll_code, pollUrl]);

  const onShareCode = useCallback(async () => {
    if (!poll?.poll_code) return;
    await Share.share({ message: poll.poll_code });
  }, [poll?.poll_code]);

  // D-09: open the inline confirm sheet (range options or grid block) on 확정.
  const openConfirm = useCallback(() => {
    setConfirmOpen(true);
    confirmSheetRef.current?.snapToIndex(0);
  }, []);
  const closeConfirm = useCallback(() => {
    confirmSheetRef.current?.close();
    setConfirmOpen(false);
  }, []);

  // Destructive confirm (UI-SPEC) → confirmPollDate → refetch the trip so
  // start_date is now set (the card unmounts, normal plan renders).
  const onConfirmPick = useCallback(
    (startDate: string, endDate: string) => {
      if (!poll) return;
      Alert.alert(
        '이 날짜로 확정하면 투표가 마감돼요.',
        '다시 투표를 받으려면 새 투표를 만들어야 해요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '확정하기',
            style: 'destructive',
            onPress: async () => {
              try {
                await confirmPollDate(supabase, { pollId: poll.id, startDate, endDate });
                // C-19-1: a dateless-created trip baked a date-less title
                // (autoBoardTitle(city, null, null)). Now that the dates are
                // confirmed, refresh the title so the header shows the range —
                // matching a directly dated-created trip. (T00:00:00 forces local
                // midnight so the KO month/day don't shift under UTC parsing.)
                if (trip?.city_code) {
                  const cityKoName = CITY_KO_MAP[trip.city_code] ?? trip.city_code;
                  await updateTrip(supabase, id, {
                    title: autoBoardTitle(
                      cityKoName,
                      new Date(`${startDate}T00:00:00`),
                      new Date(`${endDate}T00:00:00`),
                    ),
                  });
                }
                closeConfirm();
                await load(); // trip.start_date now set → card unmounts
              } catch (err) {
                Alert.alert('확정 실패', err instanceof Error ? err.message : String(err));
              }
            },
          },
        ],
      );
    },
    [poll, trip, id, closeConfirm, load],
  );

  // --- Render ----------------------------------------------------------------

  if (!loaded) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2979FF" />
      </SafeAreaView>
    );
  }

  // Phase 19 (D-05) — 날짜 투표 management card. Rendered ONLY when the trip is
  // dateless (no start_date) AND the poll is still open. After 확정, the trip gets
  // dates → !isDateless → this branch falls through to the normal plan render.
  if (isDateless && poll && poll.status !== 'closed') {
    const N = tallyVoterCount(tally);
    const canChangeMode = N === 0; // T-19-11: lock the toggle once a vote exists
    const canEditOptions = N === 0; // GAP-19A: lock candidates once a vote exists
    // Share is meaningful only once there is something to vote on (D-07 decision):
    // range needs ≥2 candidate ranges, grid needs its 1 window.
    const hasCandidates = poll.mode === 'range' ? options.length >= 2 : options.length >= 1;
    const leaderDate = tallyLeaderLabel(tally);
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 }}>
          <View
            className="bg-white rounded-2xl px-4 py-4"
            style={{
              shadowColor: '#1E293B',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
                <Ionicons name="calendar" size={20} color="#2979FF" />
              </View>
              <Text className="ml-3 text-base font-semibold text-neutral-900">
                날짜 투표 진행 중
              </Text>
            </View>

            {/* Mode toggle (D-07) — 범위형 / 그리드. Locked once any vote exists. */}
            <View className="flex-row rounded-xl bg-neutral-100 p-1 mt-4">
              {(['range', 'grid'] as const).map((m) => {
                const active = poll.mode === m;
                const labelKo = m === 'range' ? '범위형' : '그리드';
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      if (canChangeMode && !active) void onChangePollMode(m);
                    }}
                    disabled={!canChangeMode}
                    className={`flex-1 items-center justify-center rounded-lg py-2 ${
                      active ? 'bg-brand-50' : ''
                    }`}
                    style={{ minHeight: 44, opacity: canChangeMode ? 1 : 0.6 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !canChangeMode }}
                  >
                    <Text
                      className={`text-xs ${
                        active ? 'font-semibold text-brand-600' : 'text-neutral-500'
                      }`}
                    >
                      {labelKo}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Candidate windows (GAP-19A, D-07). range = several ranges; grid = 1
                window. Editable only before the first vote; share is gated on these. */}
            <Text className="text-sm font-semibold text-neutral-700 mt-4">
              {poll.mode === 'range' ? '후보 날짜' : '투표 기간'}
            </Text>
            {options.length === 0 ? (
              <Text className="text-xs text-neutral-400 mt-1">
                {poll.mode === 'range'
                  ? '투표할 후보 날짜를 2개 이상 추가해주세요'
                  : '투표할 기간을 정해주세요'}
              </Text>
            ) : (
              <View className="mt-2" style={{ gap: 6 }}>
                {options.map((o) => (
                  <View
                    key={o.id}
                    className="flex-row items-center justify-between rounded-lg bg-neutral-50 px-3 py-2"
                  >
                    <Text className="text-sm text-neutral-800">
                      {o.start_date === o.end_date
                        ? o.start_date
                        : `${o.start_date} ~ ${o.end_date}`}
                    </Text>
                    {canEditOptions && (
                      <Pressable
                        onPress={() => void onRemoveOption(o.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="후보 날짜 삭제"
                      >
                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
            {canEditOptions && (poll.mode === 'range' || options.length === 0) && (
              <Pressable
                onPress={() => setOptionSheetOpen(true)}
                disabled={poll.mode === 'range' && options.length >= POLL_RANGE_OPTIONS_MAX}
                className="flex-row items-center justify-center rounded-lg border border-dashed border-brand-200 py-2.5 mt-2 active:bg-brand-50"
                style={{
                  minHeight: 44,
                  opacity: poll.mode === 'range' && options.length >= POLL_RANGE_OPTIONS_MAX ? 0.5 : 1,
                }}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={16} color="#2979FF" />
                <Text className="text-sm text-brand-600 ml-1">
                  {poll.mode === 'range' ? '후보 날짜 추가' : '투표 기간 설정'}
                </Text>
              </Pressable>
            )}

            {/* Summary line */}
            <Text className="text-sm text-neutral-500 mt-3">
              {N === 0
                ? '아직 아무도 투표하지 않았어요'
                : `참여 ${N}명${leaderDate ? ` · 최다 후보 ${leaderDate}` : ''}`}
            </Text>

            {/* Share row — gated until there is something to vote on (D-07). */}
            <View className="flex-row mt-4" style={{ gap: 8 }}>
              <Pressable
                onPress={onShareInvite}
                disabled={!hasCandidates}
                className="flex-1 items-center justify-center rounded-lg border border-neutral-200 py-2.5 active:bg-brand-50"
                style={{ minHeight: 44, opacity: hasCandidates ? 1 : 0.5 }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasCandidates }}
              >
                <Text className="text-sm text-neutral-700">초대 링크 복사</Text>
              </Pressable>
              <Pressable
                onPress={onShareCode}
                disabled={!hasCandidates}
                className="flex-1 items-center justify-center rounded-lg border border-neutral-200 py-2.5 active:bg-brand-50"
                style={{ minHeight: 44, opacity: hasCandidates ? 1 : 0.5 }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasCandidates }}
              >
                <Text className="text-sm text-neutral-700">코드 공유</Text>
              </Pressable>
            </View>
            {!hasCandidates && (
              <Text className="text-xs text-neutral-400 mt-1.5 text-center">
                {poll.mode === 'range'
                  ? '후보 날짜를 2개 이상 추가하면 친구를 초대할 수 있어요'
                  : '투표 기간을 정하면 친구를 초대할 수 있어요'}
              </Text>
            )}

            {/* Confirm */}
            <Pressable
              onPress={openConfirm}
              className="items-center justify-center rounded-lg bg-brand-500 py-3 mt-3 active:opacity-90"
              style={{ minHeight: 44 }}
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-white">확정</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Confirm sheet (D-09, INLINE). range → option list; grid → 연속 블록 추천. */}
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
                {poll.mode === 'range' ? (
                  <RangeConfirmList tally={tally} onPick={onConfirmPick} />
                ) : (
                  <GridConfirmBlock tally={tally} onPick={onConfirmPick} />
                )}
              </View>
            )}
          </BottomSheetView>
        </BottomSheet>

        {/* Candidate-window picker (GAP-19A). range = a candidate range; grid = the
            voting window. Reuses the create-flow DatePickerSheet. */}
        <DatePickerSheet
          visible={optionSheetOpen}
          initialStart={null}
          initialEnd={null}
          onClose={() => setOptionSheetOpen(false)}
          onConfirm={(s, e) => {
            setOptionSheetOpen(false);
            void onAddOption(s, e);
          }}
        />
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

  // Phase 20 (D-04) — booking cluster gate: draft plan + confirmed dates. The
  // exact inverse of the 19-03 dateless management card gate (mutually
  // exclusive: no state renders both).
  const showBookingCluster = !!plan && !!trip?.start_date;
  const region = trip?.city_code ? BOOKING_REGION_MAP[trip.city_code] : undefined;
  // D-09: mapping null → the row simply doesn't exist (never disabled/준비중).
  const esimSlug = region?.esimSlug ?? null;
  const transport = region?.transport ?? null;
  const cityKo = trip?.city_code ? CITY_KO_MAP[trip.city_code] : undefined;
  const stayCity = cityKo ?? trip?.title ?? '';
  const stayCheckIn = trip?.start_date ?? '';
  const stayCheckOut = trip?.end_date ?? trip?.start_date ?? '';
  const stayCaption =
    trip?.start_date != null
      ? `${cityKo ? `${cityKo} · ` : ''}${mmdd(trip.start_date)}–${mmdd(trip.end_date ?? trip.start_date)}`
      : undefined;
  const bookingCtx = { tripId: id ?? '', userId: userId ?? '' };
  const autoItemId = (kind: 'stay' | 'esim' | 'transport') =>
    checklist.find((c) => c.source === 'auto' && c.kind === kind)?.id;

  // Phase 20 (D-07/D-08) — per-item 예약 비교 compact strip, injected into
  // DaySection so its drag/reorder internals stay untouched. Bookable
  // categories only — 맛집/카페 NEVER get a strip. No expanded state in the
  // plan tab (the full labeled frame lives in the book tab, D-03).
  const renderBookingStrip = (placeId: string) => {
    if (!showBookingCluster) return null;
    const place = placesById.get(placeId);
    if (!place || !isBookableActivity(place.category)) return null;
    const query = place.name_ko ?? place.name_local;
    const itemId = checklist.find((c) => c.kind === 'activity' && c.place_id === placeId)?.id;
    const stripCtx = { ...bookingCtx, placeId };
    const rows: CompareRow[] = [
      {
        providerName: 'Klook',
        labelKo: COMPARE_LABELS.klook,
        onView: () =>
          void openBooking({
            program: 'klook',
            destUrl: buildSearchDestUrl('klook', query),
            ctx: stripCtx,
            checklistItemId: itemId,
            providerLabel: 'Klook',
          }),
      },
    ];
    // KKday env unwired → graceful hide (Klook-only strip, never a dead button).
    if (kkdayAvailable()) {
      rows.push({
        providerName: 'KKday',
        labelKo: COMPARE_LABELS.kkday,
        onView: () =>
          void openBooking({
            program: 'kkday',
            destUrl: buildSearchDestUrl('kkday', query),
            ctx: stripCtx,
            checklistItemId: itemId,
            providerLabel: 'KKday',
          }),
      });
    }
    return (
      // ml-11 clears the drag-handle column; mb-2.5 keeps the row rhythm (Screen 2).
      <View className="ml-11 mb-2.5">
        <CompareFrameCard variant="compact" rows={rows} />
      </View>
    );
  };

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

        {/* Phase 20 (D-01/D-02) — booking prep cluster: exactly 1 big stay card
            + ≤2 compact rows, once per trip, above the day list. Brand color
            appears only on [보기] (광고판 금지). */}
        {showBookingCluster && (
          <View className="mt-6">
            <Text className="text-sm font-semibold text-neutral-500 mb-2">여행 준비</Text>
            <CompareFrameCard
              variant="full"
              icon="bed-outline"
              title="숙소 예약"
              caption={stayCaption}
              rows={[
                {
                  providerName: 'Agoda',
                  labelKo: COMPARE_LABELS.agoda,
                  onView: () =>
                    void openDirectSearch({
                      provider: 'agoda',
                      params: { city: stayCity, checkIn: stayCheckIn, checkOut: stayCheckOut },
                      ctx: bookingCtx,
                      checklistItemId: autoItemId('stay'),
                    }),
                },
                {
                  providerName: 'Booking.com',
                  labelKo: COMPARE_LABELS.booking,
                  onView: () =>
                    void openDirectSearch({
                      provider: 'booking',
                      params: { city: stayCity, checkIn: stayCheckIn, checkOut: stayCheckOut },
                      ctx: bookingCtx,
                      checklistItemId: autoItemId('stay'),
                    }),
                },
              ]}
            />
            {esimSlug !== null && (
              <BookingRowCard
                icon="cellular-outline"
                title="여행 유심"
                providerName="Airalo"
                labelKo={COMPARE_LABELS.airalo}
                onView={() =>
                  void openBooking({
                    program: 'airalo',
                    destUrl: buildAiraloDestUrl(esimSlug),
                    ctx: bookingCtx,
                    checklistItemId: autoItemId('esim'),
                    providerLabel: 'Airalo',
                  })
                }
              />
            )}
            {transport !== null && (
              <BookingRowCard
                icon="train-outline"
                title={transport.labelKo}
                providerName={PROVIDER_NAME[transport.provider]}
                labelKo={COMPARE_LABELS[transport.provider]}
                onView={() =>
                  void openBooking({
                    program: transport.provider,
                    destUrl: buildSearchDestUrl(transport.provider, transport.searchQuery),
                    ctx: bookingCtx,
                    checklistItemId: autoItemId('transport'),
                    providerLabel: PROVIDER_NAME[transport.provider],
                  })
                }
              />
            )}
          </View>
        )}

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
            renderBookingStrip={renderBookingStrip}
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

/**
 * Phase 20 (UI-SPEC Screen 1) — single-provider compact booking row (여행 유심 /
 * 교통 패스). plan-item-row anatomy: neutral icon chip + title block + [보기]
 * CTA (the only brand element, ≥44px hit via hitSlop). Rendered ONLY when the
 * region mapping covers the affordance (D-09).
 */
function BookingRowCard({
  icon,
  title,
  providerName,
  labelKo,
  onView,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  providerName: string;
  labelKo: string;
  onView: () => void;
}) {
  return (
    <View
      style={ROW_SHADOW}
      className="bg-white rounded-2xl px-4 py-3 mt-2.5 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-xl bg-neutral-100 items-center justify-center">
        <Ionicons name={icon} size={18} color="#4B5563" />
      </View>
      <View className="flex-1 px-3">
        <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
          {providerName} ─ {labelKo}
        </Text>
      </View>
      <Pressable
        onPress={onView}
        hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
        className="bg-brand-50 rounded-full px-3 py-1.5 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={`${providerName}에서 보기`}
      >
        <Text className="text-xs font-semibold text-brand-600">보기</Text>
      </Pressable>
    </View>
  );
}

/**
 * range-mode confirm list (D-09) — each candidate option with its 가능 count;
 * tapping an option confirms that range. Advisory tally only (T-19-02 — the
 * authoritative count lives server-side; the host still picks).
 */
function RangeConfirmList({
  tally,
  onPick,
}: {
  tally: PollTally | null;
  onPick: (startDate: string, endDate: string) => void;
}) {
  const options = (tally?.tally ?? []).filter((t): t is RangeTally => 'option_id' in t);
  if (options.length === 0) {
    return <Text className="text-sm text-neutral-500 mt-3">후보 날짜가 아직 없어요.</Text>;
  }
  return (
    <View className="mt-3" style={{ gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o.option_id}
          onPress={() => onPick(o.start_date, o.end_date)}
          className="flex-row items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 active:bg-brand-50"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Text className="text-base text-neutral-900">
            {o.start_date === o.end_date ? o.start_date : `${o.start_date} – ${o.end_date}`}
          </Text>
          <Text className="text-sm text-neutral-500">{o.available_count}명 가능</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * grid-mode confirm block (D-09) — surfaces the best 연속 블록(N박) per run length
 * via contiguousBlock (advisory only); the host taps one to confirm. Also lists
 * single days so a 당일치기 is reachable.
 */
function GridConfirmBlock({
  tally,
  onPick,
}: {
  tally: PollTally | null;
  onPick: (startDate: string, endDate: string) => void;
}) {
  const perDay = (tally?.tally ?? [])
    .filter((t): t is GridTally => 'vote_date' in t)
    .map((t) => ({ date: t.vote_date, count: t.available_count }));
  if (perDay.length === 0) {
    return <Text className="text-sm text-neutral-500 mt-3">아직 투표가 없어요.</Text>;
  }
  // Suggest the best contiguous window for 1~3 days (skip lengths that don't fit).
  const suggestions = [1, 2, 3]
    .map((runLength) => ({ runLength, block: contiguousBlock(perDay, runLength) }))
    .filter((s): s is { runLength: number; block: { start: string; end: string } } => !!s.block);
  return (
    <View className="mt-3" style={{ gap: 8 }}>
      {suggestions.map(({ runLength, block }) => (
        <Pressable
          key={runLength}
          onPress={() => onPick(block.start, block.end)}
          className="flex-row items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 active:bg-brand-50"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
        >
          <Text className="text-base text-neutral-900">
            {block.start === block.end ? block.start : `${block.start} – ${block.end}`}
          </Text>
          <Text className="text-sm text-neutral-500">
            {runLength === 1 ? '당일' : `${runLength - 1}박`} 추천
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
