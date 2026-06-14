// Flat place list for the board screen (v1.3 / Phase 14, A 레이아웃).
//
// Replaces the old link-only list. Each card shows the place name, category, and
// a source ▶ chip (timestamp from source_timestamp_sec when the source is a
// youtube video). Tapping a card opens the existing PinBottomSheet, which (14-03)
// embeds the video seeked to that timestamp. Same place id is already deduped at
// the DB layer, so this is a plain flat render — no grouping.

import { type Link, type Place } from '@moajoa/core';
import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { vibeOf, VIBE_STYLE } from '@/lib/category';

// 행이 많으니 카드 그림자는 아주 옅게(테두리 대신 살짝 떠 보일 정도).
const ROW_SHADOW = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 1,
} as const;

function tsLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  places: Place[];
  links: Link[];
  /** Collapsed links + extraction progress + count, rendered above the list. */
  header?: ReactElement | null;
  refreshing: boolean;
  onRefresh: () => void;
  /** Open the place detail/video sheet. */
  onPressPlace: (place: Place) => void;
}

export function PlaceList({ places, links, header, refreshing, onRefresh, onPressPlace }: Props) {
  const linksById = new Map(links.map((l) => [l.id, l]));

  return (
    <FlatList
      data={places}
      keyExtractor={(p) => p.id}
      contentContainerClassName="px-6 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={header ?? undefined}
      renderItem={({ item }) => {
        const link = item.link_id ? linksById.get(item.link_id) : undefined;
        const isYoutube = link?.source_kind === 'youtube';
        const sourceLabel =
          isYoutube && item.source_timestamp_sec != null
            ? `${tsLabel(item.source_timestamp_sec)}`
            : link
              ? '영상'
              : null;
        // 카테고리 → 분위기(색·아이콘·한국어 라벨). raw 영어 카테고리 노출 제거.
        const vibe = VIBE_STYLE[vibeOf(item.category)];
        const subtitle = item.address ? `${vibe.labelKo} · ${item.address}` : vibe.labelKo;
        return (
          <Pressable
            onPress={() => onPressPlace(item)}
            style={ROW_SHADOW}
            className="bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center"
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: vibe.tint }}
            >
              <Ionicons name={vibe.icon} size={18} color={vibe.color} />
            </View>
            <View className="flex-1 px-3">
              <Text className="text-sm font-semibold text-neutral-900" numberOfLines={1}>
                {item.name_ko ?? item.name_local}
              </Text>
              <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            {sourceLabel && (
              <View className="flex-row items-center px-2.5 py-1 rounded-full bg-brand-50">
                <Ionicons name="play" size={10} color="#2563EB" />
                <Text className="text-xs text-brand-600 ml-1">{sourceLabel}</Text>
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}
