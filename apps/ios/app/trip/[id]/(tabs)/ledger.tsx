// apps/ios/app/trip/[id]/(tabs)/ledger.tsx
// Phase 21 (LEDGER-01/03/06, UI-SPEC Screen 1/3) — the 가계부 tab. Replaces the
// 17-04 placeholder stub entirely. This is the ONLY user surface over the data the
// mail-forwarding pipeline (21-04) auto-fills:
//   - 확인 섹션 (top): unassigned ∪ needs_review — the single confirm flow (D-05).
//     1-tap → LedgerEntrySheet: assign a trip, or fix a low-confidence parse.
//   - 확정 목록: ready entries assigned to this trip (paid_at desc) + a KRW total.
//   - FX-source trust is rendered per-row (LedgerRow 3-color badge, LEDGER-03).
// Early-return state machine mirrors book.tsx (loading → error → empty-onboarding
// → active list) + the AppState QUIET refetch (the pipeline fills rows in the
// background, so a foreground return silently pulls the new ones).
import { Ionicons } from '@expo/vector-icons';
import {
  assignTripToEntry,
  deleteLedgerEntry,
  getTrip,
  listLedger,
  listMyTrips,
  listNeedsReview,
  listUnassignedLedger,
  updateLedgerEntry,
} from '@moajoa/api';
import { deriveAmountKrw, type LedgerEntry, type Trip } from '@moajoa/core';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LedgerEntrySheet } from '@/components/ledger/ledger-entry-sheet';
import { LedgerRow } from '@/components/ledger/ledger-row';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

export default function TripLedgerScreen() {
  // Tab screens are reached via tab-press, not the initial URL match — the parent
  // [id] segment does NOT surface in useLocalSearchParams there (F-20-1: returns
  // undefined, stalls load() on `if (!id)`). useGlobalSearchParams reads the full
  // URL so id is always present (book.tsx/map.tsx fix, commit cd056cb).
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [unassigned, setUnassigned] = useState<LedgerEntry[]>([]);
  const [needsReviewList, setNeedsReviewList] = useState<LedgerEntry[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // 1-tap confirm sheet (assign / review).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'assign' | 'review'>('assign');
  const [activeEntry, setActiveEntry] = useState<LedgerEntry | null>(null);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      // F-20-1 defense: clear the spinner even when id is (transiently) missing,
      // so a tab-press that races the param never strands the loading state.
      if (!id) {
        setLoaded(true);
        return;
      }
      try {
        const [t, led, unassignedRows, review, myTrips] = await Promise.all([
          getTrip(supabase, id),
          listLedger(supabase, id),
          listUnassignedLedger(supabase),
          listNeedsReview(supabase, id),
          listMyTrips(supabase),
        ]);
        setTrip(t);
        setLedger(led);
        setUnassigned(unassignedRows);
        setNeedsReviewList(review);
        setTrips(myTrips);
        setError(false);
      } catch (err) {
        console.warn('[ledger load] failed:', err);
        // A QUIET foreground refetch never replaces good data with the error screen.
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

  // Foreground return: QUIET refetch — the pipeline fills rows in the background,
  // so a return silently pulls newly-parsed entries (book.tsx AppState idiom).
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
      sub.remove();
    };
  }, [load]);

  const openSheet = useCallback((entry: LedgerEntry) => {
    setActiveEntry(entry);
    setSheetMode(entry.trip_id === null ? 'assign' : 'review');
    setSheetOpen(true);
  }, []);

  const onAssign = useCallback(
    async (tripId: string) => {
      const entry = activeEntry;
      if (!entry) return;
      const prevUnassigned = unassigned;
      // Optimistic: drop from the inbox immediately (book rollback idiom).
      setUnassigned((cur) => cur.filter((e) => e.id !== entry.id));
      setSheetOpen(false);
      try {
        const updated = await assignTripToEntry(supabase, entry.id, tripId);
        if (tripId === id) setLedger((cur) => [updated, ...cur]);
        const tripName = trips.find((t) => t.id === tripId)?.title ?? '여행';
        showToast(`'${tripName}' 가계부에 추가했어요`, 'success');
      } catch (err) {
        console.warn('[assignTripToEntry] failed:', err);
        setUnassigned(prevUnassigned);
        showToast('배정에 실패했어요', 'error');
      }
    },
    [activeEntry, unassigned, trips, id],
  );

  const onReview = useCallback(
    async (patch: Partial<LedgerEntry>) => {
      const entry = activeEntry;
      if (!entry) return;
      const prevLedger = ledger;
      const prevReview = needsReviewList;
      const merged: LedgerEntry = { ...entry, ...patch, status: 'ready' };
      // Optimistic: clear the needs_review flag + reflect the fix.
      setNeedsReviewList((cur) => cur.filter((e) => e.id !== entry.id));
      setLedger((cur) => cur.map((e) => (e.id === entry.id ? merged : e)));
      setSheetOpen(false);
      try {
        await updateLedgerEntry(supabase, entry.id, { ...patch, status: 'ready' });
      } catch (err) {
        console.warn('[updateLedgerEntry] failed:', err);
        setLedger(prevLedger);
        setNeedsReviewList(prevReview);
        showToast('수정에 실패했어요', 'error');
      }
    },
    [activeEntry, ledger, needsReviewList],
  );

  const onDeleteEntry = useCallback((entry: LedgerEntry) => {
    Alert.alert('이 항목을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLedgerEntry(supabase, entry.id);
            setLedger((cur) => cur.filter((e) => e.id !== entry.id));
            setUnassigned((cur) => cur.filter((e) => e.id !== entry.id));
            setNeedsReviewList((cur) => cur.filter((e) => e.id !== entry.id));
          } catch (err) {
            console.warn('[deleteLedgerEntry] failed:', err);
            showToast('삭제에 실패했어요', 'error');
          }
        },
      },
    ]);
  }, []);

  // --- Render ----------------------------------------------------------------

  if (!loaded) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#2979FF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
          </View>
          <Text className="text-base text-neutral-500 text-center leading-relaxed">
            가계부를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
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

  // Empty onboarding — nothing in the ledger AND nothing unclassified (needs_review
  // is a subset of this trip's ledger, so ledger==0 already implies review==0).
  if (ledger.length === 0 && unassigned.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
            <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
          </View>
          <Text className="text-xl font-semibold text-neutral-500 text-center">
            아직 정리된 예약이 없어요
          </Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            예약·결제 메일을 내 주소로 전달하면 여기에 자동으로 쌓여요.
          </Text>
          <Pressable
            onPress={() => router.push('/me')}
            hitSlop={8}
            className="mt-6 items-center justify-center"
            style={{ minHeight: 44 }}
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-brand-600">내 주소 보기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Active list -----------------------------------------------------------

  const confirmEntries = [...unassigned, ...needsReviewList];
  const readyEntries = ledger.filter((e) => e.status === 'ready' && e.trip_id !== null);
  const totalKrw = readyEntries.reduce(
    (sum, e) => sum + (deriveAmountKrw(e.amount_foreign, e.fx_rate) ?? 0),
    0,
  );

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {/* Header: title + total caption */}
        <View className="pt-3 mb-4">
          <Text className="text-lg font-semibold text-neutral-900">가계부</Text>
          <Text className="text-xs text-neutral-400 mt-1">
            {totalKrw > 0 ? `₩${totalKrw.toLocaleString()}` : `${readyEntries.length}건`}
          </Text>
        </View>

        {/* 확인 섹션 — unassigned ∪ needs_review (D-05 single confirm flow) */}
        {confirmEntries.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-neutral-500 mb-2">
              어느 여행인지 확인해주세요
            </Text>
            {confirmEntries.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} onPress={() => openSheet(entry)} />
            ))}
          </View>
        )}

        {/* 확정 목록 — ready + trip-assigned (paid_at desc). Tap = no-op (UI-SPEC);
            long-press deletes (돈 쓴 기록은 실수 삭제 방지 위해 롱프레스). */}
        {readyEntries.map((entry) => (
          <LedgerRow
            key={entry.id}
            entry={entry}
            onPress={() => {}}
            onLongPress={() => onDeleteEntry(entry)}
          />
        ))}
      </ScrollView>

      <LedgerEntrySheet
        open={sheetOpen}
        mode={sheetMode}
        entry={activeEntry}
        trips={trips}
        onAssign={(tripId) => void onAssign(tripId)}
        onReview={(patch) => void onReview(patch)}
        onClose={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
