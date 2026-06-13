import { deleteBoard, listMyBoardsWithPreview, updateBoard, type BoardPreview } from '@moajoa/api';
import { EXTRACT_STEP_KO, Limits, type Board } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFailedPending } from '@/lib/pending';
import { useActiveExtractions, onExtractionComplete } from '@/lib/extraction-store';
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
  const [boards, setBoards] = useState<BoardPreview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [name, setName] = useState<string | null>(null);
  // 인사말은 화면 진입 시 한 번만 고정(리렌더로 문구가 깜빡이지 않게).
  const [greeting] = useState(pickGreeting);
  const dateLabel = formatToday();

  // Live background extractions, grouped by board so each row can show its
  // in-progress state. Latest-started entry per board drives the badge label.
  const activeExtractions = useActiveExtractions();
  const extractionsByBoard = new Map<string, typeof activeExtractions>();
  for (const e of activeExtractions) {
    const list = extractionsByBoard.get(e.boardId);
    if (list) list.push(e);
    else extractionsByBoard.set(e.boardId, [e]);
  }

  const load = useCallback(async () => {
    try {
      const data = await listMyBoardsWithPreview(supabase);
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

  // An extraction finishing in the background may add pins / bump updated_at —
  // refresh the list so counts and ordering stay fresh while we're on this tab.
  useEffect(() => onExtractionComplete(() => load()), [load]);

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

  // 카드 면을 깨끗하게 유지 — 수정/삭제는 롱프레스 액션시트로 (스와이프 UI는 이후 phase).
  const onCardMenu = useCallback(
    (board: BoardPreview) => {
      Alert.alert(board.title, undefined, [
        { text: '이름 수정', onPress: () => onRename(board) },
        { text: '삭제', style: 'destructive', onPress: () => onDelete(board) },
        { text: '취소', style: 'cancel' },
      ]);
    },
    [onRename, onDelete],
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
              <Text className="text-xl font-bold text-neutral-900">아직 추가한 여행이 없어요</Text>
              <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
                유튜브 링크로 영상 속 장소를 불러올 수 있어요
              </Text>
              <View className="flex-row items-center mt-6">
                <Text className="text-sm font-medium text-brand-500">아래 ＋ 를 눌러 시작하기</Text>
                <Ionicons name="arrow-down" size={16} color="#2979FF" style={{ marginLeft: 4 }} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          // 추출 진행 중인 보드는 메타 대신 진행 상태를 보여준다.
          const list = extractionsByBoard.get(item.id);
          const latest = list && list.length > 0 ? list[list.length - 1] : null;
          const stepKo = latest
            ? `${latest.step ? EXTRACT_STEP_KO[latest.step] : '시작하는 중'}${
                list!.length > 1 ? ` 외 ${list!.length - 1}개` : ''
              }`
            : null;
          const extra = item.place_count - item.place_names.length;

          // 사진 커버(B) — 대표 이미지가 있으면 히어로 + 반투명 오버레이.
          if (item.cover_image_url) {
            return (
              <Pressable
                onPress={() => router.push(`/boards/${item.id}`)}
                onLongPress={() => onCardMenu(item)}
                className="mb-3 rounded-xl border border-neutral-200 bg-white overflow-hidden active:opacity-90"
              >
                <Image
                  source={{ uri: item.cover_image_url }}
                  className="h-32 w-full"
                  resizeMode="cover"
                />
                <View className="absolute inset-x-0 bottom-0 bg-black/55 px-4 py-3">
                  <Text className="text-base font-semibold text-white" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-neutral-100 mt-1" numberOfLines={1}>
                    {stepKo ? `분석 중 · ${stepKo}` : `장소 ${item.place_count}곳`}
                  </Text>
                </View>
              </Pressable>
            );
          }

          // 제목 중심(C) — 장소명 칩이 보드 식별을 담당(미니지도는 서로 비슷해 구분 안 됨).
          return (
            <Pressable
              onPress={() => router.push(`/boards/${item.id}`)}
              onLongPress={() => onCardMenu(item)}
              className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-4 active:opacity-90"
            >
              <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
                {item.title}
              </Text>
              {item.place_names.length > 0 && (
                <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
                  {item.place_names.map((n, i) => (
                    <View key={i} className="bg-neutral-100 rounded-full px-2.5 py-1">
                      <Text className="text-xs text-neutral-700" numberOfLines={1}>
                        {n}
                      </Text>
                    </View>
                  ))}
                  {extra > 0 && (
                    <View className="bg-neutral-50 rounded-full px-2.5 py-1">
                      <Text className="text-xs text-neutral-400">+{extra}</Text>
                    </View>
                  )}
                </View>
              )}
              {stepKo ? (
                <View className="flex-row items-center mt-2.5">
                  <ActivityIndicator size="small" color="#2979FF" />
                  <Text className="text-xs font-medium text-brand-500 ml-2">분석 중 · {stepKo}</Text>
                </View>
              ) : (
                <Text className="text-sm text-neutral-500 mt-2.5">장소 {item.place_count}곳</Text>
              )}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
