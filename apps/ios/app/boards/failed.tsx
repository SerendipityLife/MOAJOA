import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteFailedPending,
  drainPendingLinks,
  listFailedPending,
  restoreFailedPending,
  retryFailedPending,
  type FailedPendingLink,
} from '@/lib/pending';
import { mapFailReason, formatRelativeTime } from '@/lib/failed-format';
import { showToast } from '@/lib/toast';

/**
 * 저장 실패 링크 목록 화면 (Phase 7, D-01 풀스크린 라우트).
 *
 * boards 탭 "저장 실패 N개" 배너의 목적지. drain이 4회 재시도 후 failed 큐로
 * 보낸 항목을 보여주고, 행별/전체 재시도(재큐잉 + 즉시 drain) · 스와이프 삭제 ·
 * 실행취소를 lib/pending.ts 함수에 배선한다. 신규 도메인 로직 없음 — UI 배선.
 */
export default function FailedLinksScreen() {
  const [items, setItems] = useState<FailedPendingLink[]>([]);

  // boards.tsx와 동일 패턴 — focus 시 SharedDefaults 재읽기. 재시도/삭제 후에도
  // setItems(listFailedPending())로 화면 재진입 없이 즉시 갱신.
  useFocusEffect(
    useCallback(() => {
      setItems(listFailedPending());
    }, []),
  );

  // 단일 재시도(D-05/D-06): 재큐잉 후 즉시 drain. 사용자 명시 행동이라 자동
  // 재시도 0 정책(D-06) 위배 아님.
  const onRetry = useCallback((url: string) => {
    retryFailedPending(url);
    void drainPendingLinks();
    showToast('다시 시도 중', 'info');
    setItems(listFailedPending());
  }, []);

  // 전체 재시도(D-05): 모든 항목 재큐잉 후 drain 1회.
  const onRetryAll = useCallback(() => {
    for (const item of items) retryFailedPending(item.url);
    void drainPendingLinks();
    showToast('다시 시도 중', 'info');
    setItems(listFailedPending());
  }, [items]);

  // 삭제(D-07/D-08): 삭제 직전 객체를 캡처해 실행취소에 사용. restoreFailedPending만
  // 호출 — 화면은 SharedDefaults/constants를 직접 import하지 않는다.
  const onDelete = useCallback((item: FailedPendingLink) => {
    deleteFailedPending(item.url);
    setItems(listFailedPending());
    showToast('삭제됨', 'info', {
      action: {
        label: '실행취소',
        onPress: () => {
          restoreFailedPending(item);
          setItems(listFailedPending());
        },
      },
    });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-6 pt-2 pb-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          className="w-8 h-8 items-center justify-center -ml-1 mr-2"
        >
          <Text className="text-2xl text-neutral-700">‹</Text>
        </Pressable>
        <Text className="text-2xl font-semibold flex-1">저장 실패</Text>
        {items.length > 0 && (
          <Pressable
            onPress={onRetryAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="전체 재시도"
            className="bg-brand-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-medium">전체 재시도</Text>
          </Pressable>
        )}
      </View>

      <GestureHandlerRootView className="flex-1">
        <FlatList
          data={items}
          keyExtractor={(item) => item.url}
          contentContainerClassName="px-6 pb-12"
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-neutral-500 text-center">저장 실패한 링크가 없어요</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => (
                <Pressable
                  onPress={() => onDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel="삭제"
                  className="bg-danger justify-center items-center px-6 my-2 rounded-lg"
                >
                  <Text className="text-white text-sm font-medium">삭제</Text>
                </Pressable>
              )}
            >
              <View className="flex-row items-center bg-white py-3 border-b border-neutral-100">
                <View className="flex-1 mr-3">
                  <Text className="text-sm text-neutral-900" numberOfLines={1} ellipsizeMode="tail">
                    {item.url}
                  </Text>
                  <View className="flex-row items-center mt-1.5">
                    <Text className="bg-danger/10 text-danger text-xs rounded px-2 py-0.5">
                      {mapFailReason(item.reason)}
                    </Text>
                    <Text className="text-neutral-400 text-xs ml-2">
                      {formatRelativeTime(item.failed_at)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onRetry(item.url)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="재시도"
                  className="border border-neutral-300 px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-sm text-neutral-700">재시도</Text>
                </Pressable>
              </View>
            </Swipeable>
          )}
        />
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}
