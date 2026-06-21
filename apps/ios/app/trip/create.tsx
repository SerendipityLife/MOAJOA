// apps/ios/app/trip/create.tsx
// Phase 17 (SETUP-01/02, D-08/09/10) — "일정 정해짐" trip creation (UI-SPEC Screen 3).
// Ported from the retired new-board creation screen structure with these deltas:
//   - trip vocab throughout: createTrip + TripCreate (TripCreateSchema)
//   - 여행 날짜 FieldTag flips 선택 → 필수 (D-09): range required, end ≥ start,
//     day-trip = end == start
//   - canSave requires city AND a valid date range
//   - representative caption (D-10) — no input; representative_id is set by the
//     `trips_default_representative` trigger (Plan 03) to the creator (SETUP-02)
//   - success → router.replace(`/trip/${trip.id}/plan`)
//
// Ownership (BLOCKER 1): createTrip here is the only path that mints a user's
// first trip — the auto-first-board trigger is gone (Plan 03). It must work for a
// brand-new 0-trip account, so there is no precondition on an existing trip.
import { createTrip } from '@moajoa/api';
import { TripCreateSchema } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CityPicker } from '@/components/boards/city-picker';
import { DatePickerSheet } from '@/components/boards/date-picker-sheet';
import { supabase } from '@/lib/supabase';
import { autoBoardTitle, formatDateRangeKo, toYMD } from '@/lib/trip-format';

// Soft ambient card shadow (Shared Patterns §6) — each field lifts off the
// tinted scaffold instead of blending into it. No new tokens.
const cardShadow = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
};

// 필수/선택 badge next to each field label. Required = brand-tinted (rationed
// accent), optional = neutral. This phase both fields are required.
function FieldTag({ required }: { required?: boolean }) {
  return (
    <View
      className={`ml-2 px-1.5 py-0.5 rounded-md ${required ? 'bg-brand-50' : 'bg-neutral-100'}`}
    >
      <Text className={`text-xs font-semibold ${required ? 'text-brand-500' : 'text-neutral-400'}`}>
        {required ? '필수' : '선택'}
      </Text>
    </View>
  );
}

export default function NewTripScreen() {
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [cityKo, setCityKo] = useState<string | null>(null);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);

  const [cityOpen, setCityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const rangeLabel = formatDateRangeKo(start, end);
  // A complete date range = start chosen AND an end (day-trip = same day, which
  // the picker stores as end == null after a single tap — so require an explicit
  // end). canSave gates the CTA on city AND a full range (D-09).
  const hasDateRange = !!start && !!end;
  const canSave = !!cityCode && !!cityKo && hasDateRange && !saving;
  // Helper shown when only the start date is chosen — nudges the day-trip case.
  const needsEnd = !!start && !end;

  async function submit() {
    if (!cityCode || !cityKo || !start || !end || saving) return;
    setSaving(true);
    try {
      // Validate through TripCreateSchema (required dates, end >= start refine)
      // before hitting the network — T-17-13 input integrity (city/date).
      const payload = TripCreateSchema.parse({
        title: autoBoardTitle(cityKo, start, end),
        city_code: cityCode,
        start_date: toYMD(start),
        end_date: toYMD(end),
      });
      const trip = await createTrip(supabase, payload);
      // representative_id was set to the creator by the DB trigger (SETUP-02).
      // Land on the plan tab — the trip's default surface.
      router.replace(`/trip/${trip.id}/plan`);
    } catch (err) {
      Alert.alert('여행 만들기 실패', err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top', 'bottom']}>
      {/* Header: 취소 / 새 여행 / spacer */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-base text-neutral-700">취소</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900">새 여행</Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-2 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* 여행지 (required) */}
        <Pressable
          onPress={() => setCityOpen(true)}
          style={cardShadow}
          accessibilityRole="button"
          accessibilityLabel="여행지 선택"
          className="bg-white rounded-2xl px-4 py-4 mb-4 flex-row items-center active:bg-neutral-50"
        >
          <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
            <Ionicons name="location" size={20} color="#2979FF" />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold tracking-[0.5px] text-neutral-500">여행지</Text>
              <FieldTag required />
            </View>
            <Text
              className={`text-base mt-0.5 ${cityKo ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}
            >
              {cityKo ?? '어디로 떠나세요?'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </Pressable>

        {/* 여행 날짜 (required this phase, D-09) */}
        <Pressable
          onPress={() => setDateOpen(true)}
          style={cardShadow}
          accessibilityRole="button"
          accessibilityLabel="여행 날짜 선택"
          className="bg-white rounded-2xl px-4 py-4 mb-2 flex-row items-center active:bg-neutral-50"
        >
          <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
            <Ionicons name="calendar" size={20} color="#2979FF" />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold tracking-[0.5px] text-neutral-500">
                여행 날짜
              </Text>
              <FieldTag required />
            </View>
            <Text
              className={`text-base mt-0.5 ${rangeLabel ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}
            >
              {rangeLabel || '날짜를 선택하세요'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </Pressable>

        {/* Inline helper when only the start date is chosen (day-trip nudge). */}
        {needsEnd && (
          <Text className="text-xs text-neutral-500 mb-4 ml-1">
            종료 날짜도 골라주세요 (당일치기면 같은 날 한 번 더 탭)
          </Text>
        )}
        {!needsEnd && <View className="mb-2" />}

        {/* Representative caption (D-10, SETUP-02) — no input field. */}
        <View className="flex-row items-center mb-6 ml-1">
          <Ionicons name="person-circle-outline" size={16} color="#9CA3AF" />
          <Text className="text-sm text-neutral-500 ml-1.5">만든 사람이 대표(결제자)예요</Text>
        </View>

        {/* CTA — 여행 만들기 */}
        <Pressable
          onPress={submit}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="여행 만들기"
          className={`rounded-2xl py-4 items-center ${canSave ? 'bg-brand-500' : 'bg-neutral-200'}`}
        >
          <Text className={`text-base font-semibold ${canSave ? 'text-white' : 'text-neutral-400'}`}>
            여행 만들기
          </Text>
        </Pressable>
      </ScrollView>

      <CityPicker
        visible={cityOpen}
        selectedCode={cityCode}
        onClose={() => setCityOpen(false)}
        onSelect={(code, ko) => {
          setCityCode(code);
          setCityKo(ko);
          setCityOpen(false);
        }}
      />

      <DatePickerSheet
        visible={dateOpen}
        initialStart={start}
        initialEnd={end}
        onClose={() => setDateOpen(false)}
        onConfirm={(s, e) => {
          setStart(s);
          // Day-trip: a single tap leaves end null. Coerce to start so the range
          // is complete (end == start), satisfying the required-range gate (D-09).
          setEnd(e ?? s);
          setDateOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
