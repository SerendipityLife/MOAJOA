// apps/ios/app/trip/[id]/(tabs)/plan.tsx
// Phase 17 (NAV-02) — the 플랜 tab, default landing (UI-SPEC Screen 4/6). This
// phase ships the empty state ONLY; Phase 18 fills the plan content. Mirrors the
// boards.tsx ListEmptyComponent idiom: brand-50 circle + Ionicons + heading 20/600
// + body 16/400 neutral.500 + a brand-500 action accent line.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripPlanScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
          <Ionicons name="sparkles" size={36} color="#2979FF" />
        </View>
        <Text className="text-xl font-semibold text-neutral-900">아직 플랜이 없어요</Text>
        <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
          유튜브 링크를 추출하면 영상 속 장소로 플랜이 자동으로 생겨요.
        </Text>
        <View className="flex-row items-center mt-6">
          <Ionicons name="share-outline" size={16} color="#2979FF" style={{ marginRight: 4 }} />
          <Text className="text-sm font-semibold text-brand-500">링크를 공유해 시작하기</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
