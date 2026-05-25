// PinBottomSheet — D-09 single sheet UI for AI + manual pins.
// Marker tap → snap[0]=25% peek → swipe up → snap[1]=50%.
// Actions: 이름 수정 (inline edit) / 영상에서 위치 보기 (AI only) / 삭제 (destructive).
//
// Per RESEARCH Pitfall 3, NativeWind className on BottomSheetView can silently
// fail (Animated wrap doesn't transform className → style on all versions).
// Workaround: BottomSheetView gets inline backgroundStyle, all visible content
// lives in an inner <View className="..."> for reliable styling.

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { renamePlace, deletePlace } from '@moajoa/api';
import type { Place } from '@moajoa/core';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { showToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';

interface Props {
  place: Place | null;
  onClose: () => void;
  onChanged: () => void; // reload places after rename/delete
}

export function PinBottomSheet({ place, onClose, onChanged }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    if (place) {
      setEditing(false);
      setDraftName(place.name_local);
      sheetRef.current?.snapToIndex(1);
    } else {
      sheetRef.current?.close();
    }
  }, [place]);

  if (!place) return null;

  // Phase 3 source_kind detection: link_id != null → AI; link_id == null → manual.
  // (The places.source_kind column from migration 0004 may not be populated
  // consistently for legacy Phase 2 inserts. link_id is the more reliable
  // signal — manual pins go through add_manual_place RPC which leaves link_id null.)
  const isAI = place.link_id !== null;

  async function onSaveName() {
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === place!.name_local) {
      setEditing(false);
      return;
    }
    try {
      await renamePlace(supabase, place!.id, trimmed);
      showToast('이름이 수정되었어요');
      setEditing(false);
      onChanged();
    } catch (e) {
      console.warn('[rename] failed:', e);
      showToast('이름 수정 실패', 'error');
    }
  }

  function onOpenYoutube() {
    // Phase 3 deferred #1: minimal jump. Phase 5 will refine to in-app player
    // with direct timestamp jump (place.source_timestamp_sec → &t=Xs). For v1
    // we open a youtube.com search by place name — gives the user some way to
    // verify the AI-suggested location against the source video.
    if (!place) return;
    Linking.openURL(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(place.name_local)}`,
    ).catch(() => {});
  }

  function onDelete() {
    Alert.alert('핀 삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlace(supabase, place!.id);
            showToast('삭제됨');
            onChanged();
            onClose();
          } catch (e) {
            console.warn('[delete] failed:', e);
            showToast('삭제 실패', 'error');
          }
        },
      },
    ]);
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['25%', '50%']}
      enablePanDownToClose
      onClose={onClose}
      handleStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      backgroundStyle={{ backgroundColor: '#fff' }}
    >
      <BottomSheetView>
        <View className="px-6 pt-2 pb-6 bg-white">
          {editing ? (
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              onBlur={onSaveName}
              autoFocus
              className="text-lg font-semibold text-neutral-900 mt-3 border-b border-neutral-300 pb-1"
            />
          ) : (
            <Pressable onPress={() => setEditing(true)}>
              <Text className="text-lg font-semibold text-neutral-900 mt-3">
                {place.name_local}
              </Text>
            </Pressable>
          )}

          {place.address && (
            <Text className="text-sm text-neutral-600 mt-1">{place.address}</Text>
          )}

          <View className="self-start mt-2 px-1.5 py-0.5 rounded-md bg-neutral-100">
            <Text className="text-sm text-neutral-700">{isAI ? 'AI' : '수동'}</Text>
          </View>

          <Pressable
            onPress={() => setEditing(true)}
            className="bg-neutral-100 px-4 py-3 rounded-lg mt-4"
          >
            <Text className="text-base text-neutral-800 text-center">이름 수정</Text>
          </Pressable>

          {isAI && (
            <Pressable
              onPress={onOpenYoutube}
              className="bg-neutral-100 px-4 py-3 rounded-lg mt-2"
            >
              <Text className="text-base text-neutral-800 text-center">영상에서 위치 보기</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onDelete}
            className="bg-white border border-danger px-4 py-3 rounded-lg mt-2"
          >
            <Text className="text-base text-danger text-center">삭제</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
