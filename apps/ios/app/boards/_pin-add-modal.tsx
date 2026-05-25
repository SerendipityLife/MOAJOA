// PinAddModal — D-07/D-08 manual pin add via text search.
// Renders inside a parent <Modal presentationStyle="pageSheet"> from boards/[id].tsx.
// 300ms debounce → supabase.functions.invoke('resolve-place', ...) → max 5 results
// (UI-SPEC §4 lock) → tap result → add_manual_place RPC.

import { addManualPlace } from '@moajoa/api';
import type { ResolvedPlace } from '@moajoa/core';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';

interface Props {
  boardId: string;
  onClose: () => void;
  onAdded: () => void;
}

export function PinAddModal({ boardId, onClose, onAdded }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResolvedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // D-07/D-08: debounce 300ms. Min query length 2 to avoid noisy 1-char calls.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('resolve-place', {
          body: { query: query.trim(), language: 'ko' },
        });
        if (error) throw error;
        setResults(((data?.places ?? []) as ResolvedPlace[]).slice(0, 5));
      } catch (e) {
        console.warn('[resolve-place] failed:', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function onTapResult(result: ResolvedPlace) {
    if (adding) return;
    setAdding(true);
    try {
      await addManualPlace(supabase, {
        board_id: boardId,
        google_place_id: result.google_place_id,
      });
      showToast('핀 추가됨');
      onAdded();
      onClose();
    } catch (e) {
      console.warn('[addManualPlace] failed:', e);
      showToast('핀 추가 실패: 잠시 후 다시 시도', 'error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
          <Pressable onPress={onClose}>
            <Text className="text-base text-brand-500">취소</Text>
          </Pressable>
          <Text className="text-lg font-semibold">핀 추가</Text>
          <View style={{ width: 32 }} />
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="장소명, 주소, 지하철역..."
          className="mx-6 border border-neutral-300 rounded-lg px-3 py-2 text-base"
          placeholderTextColor="#9CA3AF"
        />

        {loading && (
          <View className="mx-6 mt-2 flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-sm text-neutral-500">검색 중...</Text>
          </View>
        )}

        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <View className="mx-6 mt-4 items-center py-8">
            <Text className="text-sm text-neutral-500 text-center">
              검색 결과가 없어요. 다른 키워드로 시도해 보세요.
            </Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.google_place_id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onTapResult(item)}
              disabled={adding}
              className="flex-row items-start px-6 py-3 border-b border-neutral-100 active:bg-neutral-50"
            >
              <Text className="mr-3 mt-1">📍</Text>
              <View style={{ flex: 1 }}>
                <Text className="text-base text-neutral-900">{item.displayName}</Text>
                {item.formattedAddress && (
                  <Text className="text-sm text-neutral-500 mt-0.5">
                    {item.formattedAddress}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
