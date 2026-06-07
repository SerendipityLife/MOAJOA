import { Pressable, Text, View } from 'react-native';

interface Props {
  onDismiss: () => void;
}

/**
 * Phase 5 ONBOARD-02 dismissible banner (D-19).
 *
 * Rendered above the URL TextInput on empty boards. The parent ([id].tsx)
 * owns visibility logic (places=0 && links=0 && !dismissed) and the dismiss
 * persistence — this component is presentational + emits onDismiss only.
 *
 * Visual: UI-SPEC §"Component States" 6 — amber-50 fill with amber-200
 * border, leading 💡, headline + body Korean copy, trailing × pressable.
 */
export function OnboardCard({ onDismiss }: Props) {
  return (
    <View className="mx-6 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex-row items-start">
      <Text className="mr-3 mt-0.5 text-base">💡</Text>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-neutral-900">
          유튜브 링크를 붙여넣어 보세요
        </Text>
        <Text className="text-sm text-neutral-700 mt-1">
          영상 속 장소가 30초 안에 지도로 떠요
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="안내 카드 닫기"
        className="ml-3 w-8 h-8 items-center justify-center"
      >
        <Text className="text-base text-neutral-400">×</Text>
      </Pressable>
    </View>
  );
}
