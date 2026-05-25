// apps/ios/app/index.tsx
// Phase 1 (BUILD-02) smoke screen. Replaced by auth-gated redirect in Phase 3 (SAVE-01).
// D-13: visual verification gate = splash + this screen + NativeWind className applied.
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-500">
      <View className="px-6 py-4 bg-white rounded-2xl shadow-lg">
        <Text className="text-2xl font-bold text-brand-700">NativeWind OK</Text>
        <Text className="text-sm text-neutral-600 mt-2">
          오렌지 화면 + 흰 카드 + 진한 오렌지 텍스트가 보이면 className 적용됨
        </Text>
      </View>
    </View>
  );
}
