import { createBoard } from '@moajoa/api';
import { detectSourceKind, Limits } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CityPicker } from '@/components/boards/city-picker';
import { DatePickerSheet } from '@/components/boards/date-picker-sheet';
import { supabase } from '@/lib/supabase';
import { autoBoardTitle, formatDateRangeKo, toYMD } from '@/lib/trip-format';

// Soft ambient card shadow (matches the my-screen design-system cards) so each
// field lifts off the tinted scaffold instead of blending into it.
const cardShadow = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
};

// 필수/선택 badge shown next to each field label. Required = brand-tinted,
// optional = neutral — so the user can tell at a glance what they must fill.
function FieldTag({ required }: { required?: boolean }) {
  return (
    <View
      className={`ml-2 px-1.5 py-0.5 rounded-md ${required ? 'bg-brand-50' : 'bg-neutral-100'}`}
    >
      <Text className={`text-xs font-bold ${required ? 'text-brand-500' : 'text-neutral-400'}`}>
        {required ? '필수' : '선택'}
      </Text>
    </View>
  );
}

// "새 여행" creation flow — Mozi "New plan" sheet, in MOAJOA's tone.
// Fields: 여행지(city) · 여행 날짜(date range) · 메모(description) · 공개 여부.
// The board title is auto-derived from city + dates (editable later from the
// list). Save enables once a city is chosen.
export default function NewBoardScreen() {
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [cityKo, setCityKo] = useState<string | null>(null);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const [cityOpen, setCityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = !!cityCode && !saving;
  const rangeLabel = formatDateRangeKo(start, end);
  const isYoutube = url.trim() ? detectSourceKind(url.trim()) === 'youtube' : false;

  async function submit() {
    if (!cityCode || !cityKo || saving) return;
    setSaving(true);
    try {
      const board = await createBoard(supabase, {
        title: autoBoardTitle(cityKo, start, end),
        description: desc.trim() || null,
        visibility: isPublic ? 'public' : 'private',
        city_code: cityCode,
        start_date: start ? toYMD(start) : null,
        end_date: end ? toYMD(end) : null,
      });
      // If a link was entered, hand it to the detail screen via pendingUrl —
      // it replays the same add-link + extraction path, so a YouTube link gets
      // its places extracted in one shot. No link → land on the empty board
      // where the link input is waiting.
      const trimmedUrl = url.trim();
      if (trimmedUrl) {
        router.replace({
          pathname: '/boards/[id]',
          params: { id: board.id, pendingUrl: trimmedUrl },
        });
      } else {
        router.replace(`/boards/${board.id}`);
      }
    } catch (err) {
      Alert.alert('여행 만들기 실패', err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      {/* Header: 취소 / 새 여행 / 저장 */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-base text-neutral-700">취소</Text>
        </Pressable>
        <Text className="text-lg font-bold text-neutral-900">새 여행</Text>
        <Pressable
          onPress={submit}
          disabled={!canSave}
          hitSlop={8}
          className={`rounded-full px-4 py-1.5 ${canSave ? 'bg-brand-500' : 'bg-neutral-200'}`}
        >
          <Text
            className={`text-base font-semibold ${canSave ? 'text-white' : 'text-neutral-400'}`}
          >
            저장
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-2 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {/* 여행지 */}
          <Pressable
            onPress={() => setCityOpen(true)}
            style={cardShadow}
            className="bg-white rounded-2xl px-4 py-4 mb-3 flex-row items-center active:bg-neutral-50"
          >
            <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
              <Ionicons name="location" size={20} color="#2979FF" />
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-sm font-bold tracking-[0.5px] text-neutral-500">여행지</Text>
                <FieldTag required />
              </View>
              <Text
                className={`text-lg mt-0.5 ${cityKo ? 'font-bold text-neutral-900' : 'text-neutral-400'}`}
              >
                {cityKo ?? '어디로 떠나세요?'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>

          {/* 여행 날짜 */}
          <Pressable
            onPress={() => setDateOpen(true)}
            style={cardShadow}
            className="bg-white rounded-2xl px-4 py-4 mb-3 flex-row items-center active:bg-neutral-50"
          >
            <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
              <Ionicons name="calendar" size={20} color="#2979FF" />
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-sm font-bold tracking-[0.5px] text-neutral-500">
                  여행 날짜
                </Text>
                <FieldTag />
              </View>
              <Text
                className={`text-lg mt-0.5 ${rangeLabel ? 'font-bold text-neutral-900' : 'text-neutral-400'}`}
              >
                {rangeLabel || '날짜를 선택하세요'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </Pressable>

          {/* 메모 (description) */}
          <View className="bg-white rounded-2xl px-4 py-4 mb-3" style={cardShadow}>
            <View className="flex-row items-center mb-3">
              <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
                <Ionicons name="reader-outline" size={20} color="#2979FF" />
              </View>
              <Text className="ml-3 text-sm font-bold tracking-[0.5px] text-neutral-500">메모</Text>
              <FieldTag />
            </View>
            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder="이번 여행에서 뭘 할 예정인가요?"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={Limits.BoardDescMax}
              className="text-lg text-neutral-900 min-h-[60px]"
              style={{ textAlignVertical: 'top' }}
            />
            <Text className="text-xs text-neutral-400 text-right mt-1">
              {desc.length}/{Limits.BoardDescMax}
            </Text>
          </View>

          {/* 장소 가져오기 (선택) */}
          <View className="bg-white rounded-2xl px-4 py-4 mb-3" style={cardShadow}>
            <View className="flex-row items-center mb-3">
              <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
                <Ionicons name="link" size={20} color="#2979FF" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-sm font-bold tracking-[0.5px] text-neutral-500">
                    장소 가져오기
                  </Text>
                  <FieldTag />
                </View>
                <Text className="text-sm text-neutral-400 mt-0.5">영상 속 장소 자동 추출</Text>
              </View>
            </View>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="유튜브 / 블로그 / 인스타 링크"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="text-lg text-neutral-900"
            />
            {isYoutube && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="sparkles" size={14} color="#2979FF" />
                <Text className="text-sm font-medium text-brand-500 ml-1">
                  저장하면 영상 속 장소를 자동으로 찾아드려요
                </Text>
              </View>
            )}
          </View>

          {/* 공개 여부 (Mozi "Is the plan tentative?" 대체) */}
          <View
            className="bg-white rounded-2xl px-4 py-4 mb-3 flex-row items-center"
            style={cardShadow}
          >
            <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center">
              <Ionicons name={isPublic ? 'earth' : 'lock-closed'} size={20} color="#2979FF" />
            </View>
            <View className="flex-1 ml-3 pr-3">
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-neutral-900">이 여행을 공개할까요?</Text>
                <FieldTag required />
              </View>
              <Text className="text-base text-neutral-400 mt-0.5">
                {isPublic ? '링크가 있는 누구나 볼 수 있어요' : '나만 볼 수 있어요'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: '#E5E7EB', true: '#2979FF' }}
              ios_backgroundColor="#E5E7EB"
            />
          </View>

          <Text className="text-center text-sm text-neutral-400 mt-2">
            여행을 만들고 링크를 더하면 장소가 지도에 모여요
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <CityPicker
        visible={cityOpen}
        selectedCode={cityCode}
        onClose={() => setCityOpen(false)}
        onSelect={(code, ko) => {
          setCityCode(code);
          setCityKo(ko);
          setCityOpen(false);
        }}
      />

      <DatePickerSheet
        visible={dateOpen}
        initialStart={start}
        initialEnd={end}
        onClose={() => setDateOpen(false)}
        onConfirm={(s, e) => {
          setStart(s);
          setEnd(e);
          setDateOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
