// apps/ios/app/trip/[id]/(tabs)/book.tsx
// Phase 17 (NAV-02) — the 예약 tab, NEUTRAL "곧 제공" stub (Phase 20 fills it).
// D-11 / UI-SPEC color contract: a disabled/준비-중 surface uses NEUTRAL only —
// muted neutral.300 glyph + neutral.500 text, NO brand accent.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripBookScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
          <Ionicons name="bed-outline" size={36} color="#D1D5DB" />
        </View>
        <Text className="text-xl font-semibold text-neutral-500">예약은 곧 제공돼요</Text>
        <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
          플랜이 정해지면 숙소·교통을 여기서 한 번에 예약할 수 있어요.
        </Text>
      </View>
    </SafeAreaView>
  );
}
