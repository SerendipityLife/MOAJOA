import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DiscoverTab() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-medium text-neutral-900 mb-2">둘러보기</Text>
        <Text className="text-neutral-500 text-center">
          공개된 보드를 찾아보는 기능이 들어올 자리예요.{'\n'}(Phase 2)
        </Text>
      </View>
    </SafeAreaView>
  );
}
