// apps/ios/components/ledger/ledger-entry-sheet.tsx
// Phase 21 (LEDGER-06, UI-SPEC Component 1) — the 1-tap confirm sheet for an
// ambiguous ledger entry. Mirrors book.tsx's @gorhom/bottom-sheet idiom (['55%']
// snap, enablePanDownToClose, content gated on `open` inside BottomSheetView so
// the reanimated worklets never mount closed). Two modes:
//   assign — an unclassified entry (trip_id null): pick which trip it belongs to
//            (each row → onAssign(tripId)) or leave it unassigned.
//   review — a needs_review entry: fix amount/currency/paid_at, then 확인 →
//            onReview(patch). The PARENT composes status='ready' + the optimistic
//            reflect/rollback (book idiom) — this sheet only collects the patch.
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import type { LedgerEntry, Trip } from '@moajoa/core';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

interface Props {
  open: boolean;
  mode: 'assign' | 'review';
  entry: LedgerEntry | null;
  trips: Trip[];
  onAssign: (tripId: string) => void;
  onReview: (patch: Partial<LedgerEntry>) => void;
  onClose: () => void;
}

export function LedgerEntrySheet({
  open,
  mode,
  entry,
  trips,
  onAssign,
  onReview,
  onClose,
}: Props) {
  // Review fields — seeded from the entry each time the sheet opens on a new one.
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [paidAt, setPaidAt] = useState('');

  useEffect(() => {
    if (!open || !entry) return;
    setAmount(entry.amount_foreign !== null ? String(entry.amount_foreign) : '');
    setCurrency(entry.currency ?? '');
    setPaidAt(entry.paid_at ? entry.paid_at.slice(0, 10) : '');
  }, [open, entry]);

  const onConfirmReview = () => {
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    onReview({
      amount_foreign: Number.isFinite(parsedAmount) ? parsedAmount : null,
      currency: currency.trim().length === 3 ? currency.trim().toUpperCase() : null,
      paid_at: paidAt.trim().length > 0 ? paidAt.trim() : null,
    });
  };

  return (
    <BottomSheet
      index={open ? 0 : -1}
      snapPoints={['55%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <BottomSheetView>
        {open && entry && (
          <View className="px-6 pt-2 pb-8 bg-white">
            {mode === 'assign' ? (
              <>
                <Text className="text-lg font-semibold text-neutral-900">
                  어느 여행의 예약인가요?
                </Text>
                <ScrollView className="mt-4" style={{ maxHeight: 320 }}>
                  {trips.map((trip) => (
                    <Pressable
                      key={trip.id}
                      onPress={() => onAssign(trip.id)}
                      className="flex-row items-center px-4 py-4 rounded-xl bg-neutral-50 mb-2 active:opacity-70"
                      style={{ minHeight: 44 }}
                      accessibilityRole="button"
                    >
                      <Text
                        className="flex-1 text-sm font-semibold text-neutral-900"
                        numberOfLines={1}
                      >
                        {trip.title}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={onClose}
                    className="items-center justify-center py-3.5 mt-1"
                    style={{ minHeight: 44 }}
                    accessibilityRole="button"
                  >
                    <Text className="text-sm font-semibold text-neutral-400">여행 없이 두기</Text>
                  </Pressable>
                </ScrollView>
              </>
            ) : (
              <>
                <Text className="text-lg font-semibold text-neutral-900">
                  결제 정보를 확인해주세요
                </Text>
                <View className="mt-4">
                  <Text className="text-xs text-neutral-400 mb-1">금액</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    className="border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-900"
                    accessibilityLabel="금액"
                  />
                </View>
                <View className="mt-3">
                  <Text className="text-xs text-neutral-400 mb-1">통화 (3자)</Text>
                  <TextInput
                    value={currency}
                    onChangeText={setCurrency}
                    autoCapitalize="characters"
                    maxLength={3}
                    placeholder="USD"
                    placeholderTextColor="#9CA3AF"
                    className="border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-900"
                    accessibilityLabel="통화"
                  />
                </View>
                <View className="mt-3">
                  <Text className="text-xs text-neutral-400 mb-1">결제일</Text>
                  <TextInput
                    value={paidAt}
                    onChangeText={setPaidAt}
                    placeholder="2026-07-05"
                    placeholderTextColor="#9CA3AF"
                    className="border border-neutral-200 rounded-lg px-3 py-3 text-sm text-neutral-900"
                    accessibilityLabel="결제일"
                  />
                </View>
                <Pressable
                  onPress={onConfirmReview}
                  className="items-center justify-center rounded-xl py-3.5 mt-5 bg-brand-500 active:opacity-90"
                  style={{ minHeight: 44 }}
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-semibold text-white">확인</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
