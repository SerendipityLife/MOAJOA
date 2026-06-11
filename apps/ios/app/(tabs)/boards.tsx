import { deleteBoard, listMyBoards, updateBoard } from '@moajoa/api';
import { Limits, type Board } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFailedPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';

// 시간대별 인사말. 같은 시간대 안에서도 매 방문마다 다른 문구가 나오도록 변형을 둠.
const GREETINGS: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: ['좋은 아침이에요!', '상쾌한 아침이에요!', '오늘도 좋은 하루 시작해요!'],
  afternoon: ['좋은 오후예요!', '나른한 오후네요!', '점심은 챙겨 드셨어요?'],
  evening: ['좋은 저녁이에요!', '오늘 하루도 수고 많았어요!', '노을이 예쁜 저녁이에요'],
  night: ['편안한 밤 되세요!', '오늘 하루도 고생 많았어요', '포근한 밤이에요'],
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "6월 7일 토요일" 형태의 오늘 날짜 라벨(디바이스 로컬 시간 기준).
function formatToday(): string {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

// 디바이스(=사용자) 로컬 시간 기준으로 시간대를 고르고, 그 시간대 변형 중 하나를 무작위로.
function pickGreeting(): string {
  const h = new Date().getHours();
  const band =
    h >= 5 && h < 12
      ? 'morning'
      : h >= 12 && h < 18
        ? 'afternoon'
        : h >= 18 && h < 22
          ? 'evening'
          : 'night';
  const variants = GREETINGS[band];
  return variants[Math.floor(Math.random() * variants.length)];
}

export default function BoardsTab() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [name, setName] = useState<string | null>(null);
  // 인사말은 화면 진입 시 한 번만 고정(리렌더로 문구가 깜빡이지 않게).
  const [greeting] = useState(pickGreeting);
  const dateLabel = formatToday();

  const load = useCallback(async () => {
    try {
      const data = await listMyBoards(supabase);
      setBoards(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 닉네임은 me.tsx와 동일하게 auth user_metadata에서 파생(폴백 '여행자').
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata ?? {};
      setName(meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : '여행자'));
    });
  }, []);

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

  // iOS-only Alert.prompt rename — pre-filled with the current title.
  const onRename = useCallback(
    (board: Board) => {
      Alert.prompt(
        '여행 이름 수정',
        undefined,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '저장',
            onPress: async (text?: string) => {
              const t = (text ?? '').trim();
              if (!t || t === board.title) return;
              try {
                await updateBoard(supabase, board.id, { title: t.slice(0, Limits.BoardTitleMax) });
                load();
              } catch (e) {
                Alert.alert('수정 실패', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
        'plain-text',
        board.title,
      );
    },
    [load],
  );

  const onDelete = useCallback(
    (board: Board) => {
      Alert.alert('여행 삭제', `"${board.title}"을(를) 삭제할까요?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBoard(supabase, board.id);
              load();
            } catch (e) {
              Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    },
    [load],
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-10 pb-3">
        {name ? (
          <Text className="text-4xl font-bold leading-tight text-neutral-900">
            <Text className="text-brand-500">{name}</Text>,{'\n'}
            {greeting}
          </Text>
        ) : (
          <Text className="text-4xl font-bold leading-tight text-neutral-900">{greeting}</Text>
        )}
        <View className="self-start mt-3 bg-neutral-100 rounded-full px-3 py-1">
          <Text className="text-sm text-neutral-500">{dateLabel}</Text>
        </View>
      </View>

      {failedCount > 0 && (
        <Pressable
          onPress={() => router.push('/boards/failed')}
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
        contentContainerClassName="px-6 pb-12 grow"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loaded ? (
            <View className="flex-1 items-center justify-center px-8 pt-16">
              <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
                <Ionicons name="map-outline" size={36} color="#2979FF" />
              </View>
              <Text className="text-xl font-bold text-neutral-900">아직 만든 여행이 없어요</Text>
              <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
                첫 여행을 만들고 유튜브·블로그 링크를 더하면{'\n'}영상 속 장소가 지도로 모여요
              </Text>
              <View className="flex-row items-center mt-6">
                <Text className="text-sm font-medium text-brand-500">아래 ＋ 를 눌러 시작하기</Text>
                <Ionicons name="arrow-down" size={16} color="#2979FF" style={{ marginLeft: 4 }} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center border border-neutral-200 rounded-lg mb-3 pl-1 pr-4">
            {/* 왼쪽: 수정 · 삭제 */}
            <View className="flex-row items-center">
              <Pressable
                onPress={() => onRename(item)}
                hitSlop={6}
                className="w-9 h-9 items-center justify-center rounded-full active:bg-brand-50"
              >
                <Ionicons name="create-outline" size={18} color="#2979FF" />
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                hitSlop={6}
                className="w-9 h-9 items-center justify-center rounded-full active:bg-danger/10"
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </Pressable>
            </View>
            {/* 본문: 탭하면 상세로 */}
            <Pressable
              onPress={() => router.push(`/boards/${item.id}`)}
              className="flex-1 py-4 pl-2 active:opacity-60"
            >
              <Text className="font-medium text-neutral-900">{item.title}</Text>
              {item.description && (
                <Text className="text-sm text-neutral-600 mt-1" numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
