// apps/ios/app/trip/[id]/(tabs)/ledger.tsx
// Phase 17 (NAV-02) — the 가계부 tab, NEUTRAL "곧 제공" stub (Phase 21 fills it).
// D-11 / UI-SPEC color contract: NEUTRAL only — muted neutral.300 glyph +
// neutral.500 text, NO brand accent.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripLedgerScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-full bg-neutral-100 items-center justify-center mb-5">
          <Ionicons name="receipt-outline" size={36} color="#D1D5DB" />
        </View>
        <Text className="text-xl font-semibold text-neutral-500">가계부는 곧 제공돼요</Text>
        <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
          예약 메일을 전달하면 여행 경비가 자동으로 정리돼요.
        </Text>
      </View>
    </SafeAreaView>
  );
}
