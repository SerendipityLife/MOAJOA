import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FriendsTab() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-medium text-neutral-900 mb-2">내 친구</Text>
        <Text className="text-neutral-500 text-center">
          친구를 초대하고 보드를 함께 보는 기능이 들어올 자리예요.
        </Text>
      </View>
    </SafeAreaView>
  );
}
