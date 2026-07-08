// apps/ios/app/trip/[id]/header.tsx
// Phase 17 (NAV-03) — trip-scoped header (UI-SPEC Screen 5). Left = "현재 여행 ▾"
// trip switcher (current trip title + brand chevron) → opens the 여행 전환 sheet
// (list of trips + "+ 새 여행" + per-row 삭제). Right = profile glyph → /me.
// There is NO FAB and NO new-trip tab — new-trip is a header action only.
//
// Brand accent is rationed (UI-SPEC color contract): only the chevron tints
// brand.500; the trip title stays neutral.900. Every glyph-only control carries
// an accessibilityLabel and a ≥44×44 hit area (hitSlop).
import { deleteTrip, getTrip, listMyTrips } from '@moajoa/api';
import { type Trip } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function TripHeader({ tripId }: { tripId: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  // Current tab segment (map | plan | book | ledger). The header persists across
  // tab switches; this hook keeps it in sync so a trip switch stays on the tab
  // the user is actually viewing.
  const segments = useSegments();

  // Current trip title for the switcher label.
  useEffect(() => {
    let mounted = true;
    if (!tripId) return;
    getTrip(supabase, tripId)
      .then((t) => {
        if (mounted) setTitle(t?.title ?? null);
      })
      .catch(() => {
        if (mounted) setTitle(null);
      });
    return () => {
      mounted = false;
    };
  }, [tripId]);

  const loadTrips = useCallback(async () => {
    try {
      setTrips(await listMyTrips(supabase));
    } catch {
      setTrips([]);
    }
  }, []);

  function openSwitcher() {
    void loadTrips();
    setSwitcherOpen(true);
  }

  function switchTo(id: string) {
    setSwitcherOpen(false);
    if (id === tripId) return;
    // Preserve the current tab on switch — switching from 지도 stays on 지도
    // (previously this hardcoded /plan, so a switch from the map tab bounced
    // the user to 플랜 and never showed the new trip's places on the map).
    // Ternary stays inline so typed-routes contextual typing keeps each branch
    // a valid Href literal (an intermediate const widens to string).
    const tab = segments[segments.length - 1];
    router.replace(
      tab === 'map'
        ? `/trip/${id}/map`
        : tab === 'book'
          ? `/trip/${id}/book`
          : tab === 'ledger'
            ? `/trip/${id}/ledger`
            : `/trip/${id}/plan`,
    );
  }

  const onDelete = useCallback(
    (trip: Trip) => {
      // Shared Patterns §4 delete Alert (reused from boards.tsx).
      Alert.alert('여행 삭제', `"${trip.title}"을(를) 삭제할까요?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip(supabase, trip.id);
              await loadTrips();
            } catch (e) {
              Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    },
    [loadTrips],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.bar}>
      <View className="flex-row items-center px-4 h-12">
        {/* Left — "현재 여행 ▾" switcher. Title neutral.900; chevron brand.500. */}
        <Pressable
          onPress={openSwitcher}
          hitSlop={10}
          accessibilityLabel="여행 전환"
          className="flex-row items-center flex-1 active:opacity-70"
          style={{ minHeight: 44 }}
        >
          <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
            {title ?? '현재 여행'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#2979FF" style={{ marginLeft: 4 }} />
        </Pressable>

        {/* Right — profile glyph → /me. */}
        <Pressable
          onPress={() => router.push('/me')}
          hitSlop={10}
          accessibilityLabel="내 정보"
          className="w-11 h-11 items-center justify-center active:opacity-70"
        >
          <Ionicons name="person-circle-outline" size={28} color="#374151" />
        </Pressable>
      </View>

      {/* 여행 전환 sheet — list of trips + "+ 새 여행" + per-row 삭제. */}
      <Modal
        visible={switcherOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSwitcherOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/30 justify-end"
          onPress={() => setSwitcherOpen(false)}
        >
          <Pressable className="bg-white rounded-t-3xl pb-8" onPress={() => {}}>
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-neutral-200" />
            </View>
            <Text className="text-xl font-semibold text-neutral-900 px-6 pt-3 pb-2">
              여행 전환
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {trips.map((t) => {
                const active = t.id === tripId;
                return (
                  <View key={t.id} className="flex-row items-center px-6 py-3">
                    <Pressable
                      onPress={() => switchTo(t.id)}
                      className="flex-1 flex-row items-center active:opacity-70"
                      style={{ minHeight: 44 }}
                    >
                      <Text
                        className={`text-base flex-1 ${active ? 'font-semibold text-brand-500' : 'text-neutral-900'}`}
                        numberOfLines={1}
                      >
                        {t.title}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark" size={20} color="#2979FF" />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => onDelete(t)}
                      hitSlop={8}
                      accessibilityLabel="여행 삭제"
                      className="w-11 h-11 items-center justify-center active:opacity-70"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                );
              })}

              {/* + 새 여행 row → /trip/create (created by Plan 05). */}
              <Pressable
                onPress={() => {
                  setSwitcherOpen(false);
                  router.push('/trip/create');
                }}
                accessibilityLabel="새 여행 만들기"
                className="flex-row items-center px-6 py-4 active:opacity-70"
                style={{ minHeight: 44 }}
              >
                <View className="w-8 h-8 rounded-full bg-brand-50 items-center justify-center mr-3">
                  <Ionicons name="add" size={20} color="#2979FF" />
                </View>
                <Text className="text-base font-semibold text-brand-500">새 여행</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#F3F4F6', // neutral.100 hairline (UI-SPEC Screen 5)
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
