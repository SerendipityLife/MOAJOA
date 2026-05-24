import { createBoard } from '@moajoa/api';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function NewBoardScreen() {
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setPending(true);
    try {
      const board = await createBoard(supabase, {
        title: title.trim(),
        description: null,
        visibility: 'private',
        city_code: null,
      });
      router.replace(`/boards/${board.id}`);
    } catch (err) {
      Alert.alert('보드 생성 실패', err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-6">
        <Text className="text-2xl font-semibold mb-6">새 보드</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="보드 이름 (예: 도쿄 5월)"
          maxLength={60}
          autoFocus
          className="border border-neutral-300 rounded-lg px-4 py-3 text-base mb-4"
        />
        <Pressable
          onPress={submit}
          disabled={!title.trim() || pending}
          className="bg-brand-500 rounded-lg py-3 items-center disabled:opacity-50"
        >
          <Text className="text-white font-medium">{pending ? '...' : '만들기'}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="py-3 items-center mt-2">
          <Text className="text-neutral-500">취소</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
