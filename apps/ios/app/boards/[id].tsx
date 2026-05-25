import { addLink, listLinksByBoard, listPlacesByBoard, getBoard, triggerExtraction } from '@moajoa/api';
import { detectSourceKind, SharedDefaultsKeys, type Board, type Link, type Place } from '@moajoa/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { subscribeExtractProgress, type ExtractProgress } from '@/lib/realtime';
import { showToast } from '@/lib/toast';
import { SharedDefaults } from '@/lib/shared-defaults';
import { PinBottomSheet } from './_pin-sheet';
import { PinAddModal } from './_pin-add-modal';
import { StepIndicator, type Step } from './_step-indicator';

// UI-SPEC §1 error reason mapping fixture. Broadcast 'error' payloads from
// Phase 2 extract-youtube carry a raw error string; we map a few known prefixes
// to user-facing copy and fall back to the default for anything unrecognized.
function mapErrorReason(raw?: string): string {
  if (!raw) return '잠시 후 다시 시도';
  if (raw.includes('transcript')) return '자막이 없는 영상';
  if (raw.includes('no_place') || raw.includes('places_empty')) return '장소를 찾지 못함';
  if (raw.includes('quota') || raw.includes('429')) return '오늘 할당량 초과';
  return '잠시 후 다시 시도';
}

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [addPinOpen, setAddPinOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [b, ls, ps] = await Promise.all([
        getBoard(supabase, id),
        listLinksByBoard(supabase, id),
        listPlacesByBoard(supabase, id),
      ]);
      setBoard(b);
      setLinks(ls);
      setPlaces(ps);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // D-10 + Phase 5 TRUST-02: subscribe to extract:{link_id} broadcast.
  // - done/error: terminal — dismiss overlay + clear step + toast (Phase 3 behavior)
  // - metadata/transcript/llm/places: advance StepIndicator current step (D-07/D-08)
  // Pitfall 5: cleanup via supabase.removeChannel(ch) on link_id change/unmount.
  useEffect(() => {
    if (!analyzing) return;
    const ch = subscribeExtractProgress(analyzing, (p: ExtractProgress) => {
      if (p.step === 'done') {
        setAnalyzing(null);
        setCurrentStep(null);
        load();
        showToast(`${p.places_extracted ?? 0}개 핀 추가됨`);
      } else if (p.step === 'error') {
        setAnalyzing(null);
        setCurrentStep(null);
        showToast(`분석 실패: ${mapErrorReason(p.error)}`, 'error');
      } else if (
        p.step === 'metadata' ||
        p.step === 'transcript' ||
        p.step === 'llm' ||
        p.step === 'places'
      ) {
        setCurrentStep(p.step);
      }
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [analyzing, load]);

  async function onAddLink() {
    if (!url.trim() || !id) return;
    try {
      const link = await addLink(supabase, { board_id: id, url: url.trim() });
      setUrl('');
      // D-02: mirror last_board_id to App Group SharedDefaults so the Share
      // Extension knows where to enqueue subsequent shares.
      SharedDefaults.set(SharedDefaultsKeys.LastBoardId, id);
      if (detectSourceKind(link.url) === 'youtube') {
        setAnalyzing(link.id);
        triggerExtraction(supabase, link.id).catch((err) => {
          console.warn('[triggerExtraction] failed:', err);
          setAnalyzing(null);
          showToast('분석 실패: 잠시 후 다시 시도', 'error');
        });
      }
      await load();
    } catch (err) {
      console.warn('[addLink] failed:', err);
      showToast('링크 추가 실패', 'error');
    }
  }

  const region = places[0]
    ? { latitude: places[0].lat, longitude: places[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 35.68, longitude: 139.69, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  const detected = url ? detectSourceKind(url) : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="px-2 py-1">
          <Text className="text-brand-500">← 뒤로</Text>
        </Pressable>
        <Text className="ml-2 text-lg font-semibold flex-1" numberOfLines={1}>
          {board?.title ?? '...'}
        </Text>
        <Pressable onPress={() => setAddPinOpen(true)} className="px-3 py-2">
          <Text className="text-brand-500 text-base">+ 핀</Text>
        </Pressable>
      </View>

      <View className="px-6 mb-3">
        <View className="flex-row gap-2">
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="유튜브 / 블로그 / 인스타 링크"
            autoCapitalize="none"
            keyboardType="url"
            className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
          />
          <Pressable
            onPress={onAddLink}
            disabled={!url.trim()}
            className="bg-brand-500 px-4 rounded-lg justify-center disabled:opacity-50"
          >
            <Text className="text-white text-sm font-medium">추가</Text>
          </Pressable>
        </View>
        {detected && (
          <Text className="text-xs text-neutral-500 mt-1">
            {detected === 'youtube'
              ? '유튜브 — 자동 분석 시작'
              : detected === 'blog'
                ? '블로그 — 큐레이션 대기열'
                : detected === 'instagram'
                  ? '인스타 — 큐레이션 대기열'
                  : '수동 — 저장만 됩니다'}
          </Text>
        )}
      </View>

      <View className="h-64 mx-6 rounded-lg overflow-hidden mb-3">
        <MapView style={{ flex: 1 }} initialRegion={region}>
          {places.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={p.name_local}
              description={p.name_ko ?? p.address ?? undefined}
              onPress={() => setSelectedPlace(p)}
            />
          ))}
        </MapView>
      </View>

      <FlatList
        data={links}
        keyExtractor={(l) => l.id}
        contentContainerClassName="px-6 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />
        }
        ListHeaderComponent={
          <Text className="text-sm font-medium text-neutral-700 mb-2">
            링크 {links.length}개 · 장소 {places.length}개
          </Text>
        }
        renderItem={({ item }) => (
          <View className="p-3 border border-neutral-200 rounded-lg mb-2">
            <Text className="text-sm font-medium" numberOfLines={1}>
              {item.title ?? item.url}
            </Text>
            <Text className="text-xs text-neutral-500 mt-1">
              {item.source_kind} · {item.extraction_status}
            </Text>
          </View>
        )}
      />

      {analyzing && (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.7)',
            zIndex: 50,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <StepIndicator current={currentStep} />
        </View>
      )}

      <PinBottomSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        onChanged={load}
      />

      <Modal
        visible={addPinOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddPinOpen(false)}
      >
        {id && (
          <PinAddModal
            boardId={id}
            onClose={() => setAddPinOpen(false)}
            onAdded={load}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
