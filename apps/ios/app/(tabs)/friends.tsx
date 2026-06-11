import { Ionicons } from '@expo/vector-icons';
import { Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO(invite-backend): swap for a real per-user invite deep link + token once
// the invite/accept endpoint exists. Until then we share the landing URL so the
// Share-sheet flow is wired and testable without new native deps.
const INVITE_URL = 'https://moajoa.app';

/**
 * Friends tab — invite entry (Mozi "Connect" pattern, link-only for now).
 * Per scope decision, friend discovery is invite-link/QR only (no contacts
 * matching). QR needs react-native-svg and lands with the native-rebuild slice.
 */
export default function FriendsTab() {
  async function onInvite() {
    try {
      await Share.share({
        message: `MOAJOA에서 같이 여행 정해요! 링크 속 장소를 모아 지도로 보고 투표로 정해요 👇\n${INVITE_URL}`,
      });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-10 pb-3">
        <Text className="text-4xl font-bold text-neutral-900">내 친구</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8 -mt-10">
        <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
          <Ionicons name="people-outline" size={36} color="#2979FF" />
        </View>
        <Text className="text-xl font-bold text-neutral-900">함께 여행할 친구를 초대해요</Text>
        <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
          친구를 초대하면 같은 보드를 보고{'\n'}어디 갈지 투표로 함께 정할 수 있어요
        </Text>

        <Pressable
          onPress={onInvite}
          className="mt-7 flex-row items-center justify-center bg-neutral-900 rounded-2xl py-4 px-7"
        >
          <Ionicons name="share-outline" size={18} color="#FFFFFF" />
          <Text className="ml-2 text-base font-semibold text-white">초대 링크 공유</Text>
        </Pressable>

        <Text className="mt-4 text-sm text-neutral-400">QR 코드 초대는 곧 추가돼요</Text>
      </View>
    </SafeAreaView>
  );
}
