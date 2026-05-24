import { addLink, listLinksByBoard, listPlacesByBoard, getBoard, triggerExtraction } from '@moajoa/api';
import { detectSourceKind, type Board, type Link, type Place } from '@moajoa/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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

  async function onAddLink() {
    if (!url.trim() || !id) return;
    try {
      const link = await addLink(supabase, { board_id: id, url: url.trim() });
      if (link.source_kind === 'youtube') {
        triggerExtraction(supabase, link.id).catch((err) => console.error(err));
      }
      setUrl('');
      await load();
    } catch (err) {
      Alert.alert('링크 추가 실패', err instanceof Error ? err.message : String(err));
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
    </SafeAreaView>
  );
}
