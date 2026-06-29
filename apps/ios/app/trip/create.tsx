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
import { createDatelessTrip, createTrip } from '@moajoa/api';
import { TripCreateDatelessSchema, TripCreateSchema } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
  // Phase 19 (POLL-01) — the dateless variant. ?dateless=1 (from the onboarding
  // 미정 card) hides the date card + date picker and creates a trip with null
  // dates + an open poll, landing on the plan-tab management card.
  const { dateless } = useLocalSearchParams<{ dateless?: string }>();
  const isDateless = dateless === '1';

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
  // end). canSave gates the CTA on city AND a full range (D-09); the dateless
  // variant drops the date gate (city-only).
  const hasDateRange = !!start && !!end;
  const canSave = !!cityCode && !!cityKo && (isDateless || hasDateRange) && !saving;
  // Helper shown when only the start date is chosen — nudges the day-trip case.
  const needsEnd = !isDateless && !!start && !end;

  async function submit() {
    if (!cityCode || !cityKo || saving) return;
    if (!isDateless && (!start || !end)) return;
    setSaving(true);
    try {
      if (isDateless) {
        // Dateless create (D-04): no dates, an explicit default mode 'grid'
        // (the when2meet-style default — NOT a silently-final choice; the host
        // switches range↔grid on the plan-tab management card before the first
        // vote/share, D-07). create_dateless_trip_with_poll mints trip + open poll.
        const payload = TripCreateDatelessSchema.parse({
          title: autoBoardTitle(cityKo, null, null),
          city_code: cityCode,
          poll_mode: 'grid',
        });
        const res = (await createDatelessTrip(supabase, {
          title: payload.title,
          cityCode: payload.city_code,
          mode: payload.poll_mode,
        })) as { trip_id: string };
        router.replace(`/trip/${res.trip_id}/plan`);
        return;
      }
      // Validate through TripCreateSchema (required dates, end >= start refine)
      // before hitting the network — T-17-13 input integrity (city/date).
      const payload = TripCreateSchema.parse({
        title: autoBoardTitle(cityKo, start, end),
        city_code: cityCode,
        start_date: toYMD(start!),
        end_date: toYMD(end!),
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
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro copy (onboarding tone) — headline + body above the form fields.
            Subtitle drops "날짜" in the dateless variant since the date card is
            hidden (dates are decided later by the poll). */}
        <Text className="text-4xl font-semibold leading-tight text-neutral-900">
          어디로 떠나볼까요?
        </Text>
        <Text
          className="mt-2 text-base leading-relaxed text-neutral-500"
          style={{ marginBottom: 20 }}
        >
          {isDateless
            ? '여행지만 정하면 바로 시작할 수 있어요.'
            : '여행지와 날짜만 정하면 바로 시작할 수 있어요.'}
        </Text>

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

        {/* 여행 날짜 (required this phase, D-09) — HIDDEN in the dateless variant
            (POLL-01); the date is decided later by the poll. */}
        {!isDateless && (
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
        )}

        {/* Inline helper when only the start date is chosen (day-trip nudge). */}
        {needsEnd && (
          <Text className="text-xs text-neutral-500 mb-4 ml-1">
            종료 날짜도 골라주세요 (당일치기면 같은 날 한 번 더 탭)
          </Text>
        )}
        {!needsEnd && <View className="mb-6" />}

        {/* CTA — 여행 만들기 / 날짜 투표 시작하기 (dateless variant) */}
        <Pressable
          onPress={submit}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel={isDateless ? '날짜 투표 시작하기' : '여행 만들기'}
          className={`rounded-2xl py-4 items-center ${canSave ? 'bg-brand-500' : 'bg-neutral-200'}`}
        >
          <Text className={`text-base font-semibold ${canSave ? 'text-white' : 'text-neutral-400'}`}>
            {isDateless ? '날짜 투표 시작하기' : '여행 만들기'}
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

      {!isDateless && (
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
      )}
    </SafeAreaView>
  );
}
