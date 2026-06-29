// apps/ios/app/onboarding.tsx
// Phase 17 (SETUP-01, D-11) — "일정 정해졌나요?" 분기 (UI-SPEC Screen 2). A fresh
// (0-trip) account lands here from index.tsx (decideEntryRoute([]) → /onboarding).
// Plan 03 retired the auto-first-board trigger, so the 정해짐 card is the SOLE
// entry into first-trip creation (BLOCKER 1) — there is no auto-created board.
//
// Two stacked path cards (Phase 19 — POLL-01 activated the 미정 card):
//   - 정해짐  (ENABLED, brand-accented) → /trip/create
//   - 미정    (ENABLED, brand-accented) → /trip/create?dateless=1 (날짜 투표)
// Color contract (UI-SPEC Screen 1): both path cards now carry brand; the dateless
// path routes to a date-vote trip the host shares for friends to vote on.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Soft ambient card shadow (Shared Patterns §6) so the enabled card lifts off
// the tinted scaffold. Same const used across the trip-creation field cards.
const cardShadow = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
};

export default function Onboarding() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Warm intro (welcome.tsx tone) — display headline + body. */}
        <Text className="text-4xl font-semibold leading-tight text-neutral-900">
          귀찮은 여행 장소 추가{'\n'}이제 맡겨주세요✈️
        </Text>
        <Text className="mt-4 text-base leading-relaxed text-neutral-500">
          유튜브 링크를 넣으면 영상 속 장소가 지도에 자동으로 추가돼요.
        </Text>

        {/* Branch heading */}
        <Text className="mt-10 text-xl font-semibold text-neutral-900">일정이 정해졌나요?</Text>

        {/* 정해짐 card — ENABLED, brand-accented. Tap → /trip/create. */}
        <Pressable
          onPress={() => router.push('/trip/create')}
          accessibilityRole="button"
          style={cardShadow}
          className="mt-4 bg-white rounded-2xl px-4 py-4 flex-row items-center active:bg-neutral-50"
        >
          <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
            <Ionicons name="calendar" size={22} color="#2979FF" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-neutral-900">네, 날짜가 정해졌어요</Text>
            <Text className="mt-0.5 text-sm text-neutral-500">
              날짜·여행지를 입력하고 바로 시작해요
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </Pressable>

        {/* 미정 card — Phase 19 (POLL-01): ENABLED, brand-accented. Tap → dateless
            create (?dateless=1). Mirrors the 정해짐 card structure; brand accent now
            extends to both path cards (UI-SPEC Screen 1). */}
        <Pressable
          onPress={() => router.push('/trip/create?dateless=1')}
          accessibilityRole="button"
          accessibilityLabel="날짜 투표로 일정 정하기"
          style={cardShadow}
          className="mt-4 bg-white rounded-2xl px-4 py-4 flex-row items-center active:bg-neutral-50"
        >
          <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
            <Ionicons name="calendar-outline" size={22} color="#2979FF" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-neutral-900">아직 미정이에요</Text>
            <Text className="mt-0.5 text-sm text-neutral-500">친구, 가족, 연인과 함께 투표로 정해요</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </Pressable>

        {/* Base primary CTA — routes the same as the 정해짐 card. */}
        <Pressable
          onPress={() => router.push('/trip/create')}
          accessibilityRole="button"
          accessibilityLabel="여행 만들기"
          className="mt-8 rounded-2xl py-4 items-center bg-brand-500 active:opacity-90"
        >
          <Text className="text-base font-semibold text-white">여행 만들기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
