import { listMyBoards } from '@moajoa/api';
import type { Board } from '@moajoa/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFailedPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';

export default function BoardsTab() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await listMyBoards(supabase);
      setBoards(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-read failed-pending count whenever this screen gains focus — covers
  // the case where a drain finishes while the user is on another tab and
  // surfaces the result without requiring pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      setFailedCount(listFailedPending().length);
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setFailedCount(listFailedPending().length);
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
        <Text className="text-2xl font-semibold">내 보드</Text>
        <Pressable
          onPress={() => router.push('/boards/new')}
          className="bg-brand-500 px-4 py-2 rounded-lg"
        >
          <Text className="text-white text-sm font-medium">새 보드</Text>
        </Pressable>
      </View>

      {failedCount > 0 && (
        <Pressable
          onPress={() => router.push('/boards/_failed')}
          className="mx-6 mb-4 bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 flex-row items-center"
        >
          <View className="w-2 h-2 rounded-full bg-danger mr-3" />
          <Text className="text-sm text-neutral-800 flex-1">{`저장 실패 ${failedCount}개 — 탭하여 확인`}</Text>
          <Text className="text-neutral-400 text-sm">›</Text>
        </Pressable>
      )}

      <FlatList
        data={boards}
        keyExtractor={(b) => b.id}
        contentContainerClassName="px-6 pb-12"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-neutral-500 text-center">
              아직 보드가 없어요.{'\n'}새 보드를 만들고 유튜브 링크를 던져보세요.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/boards/${item.id}`)}
            className="p-4 border border-neutral-200 rounded-lg mb-3 active:bg-brand-50"
          >
            <Text className="font-medium text-neutral-900">{item.title}</Text>
            {item.description && (
              <Text className="text-sm text-neutral-600 mt-1" numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
