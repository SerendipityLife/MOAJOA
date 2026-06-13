// Flat place list for the board screen (v1.3 / Phase 14, A 레이아웃).
//
// Replaces the old link-only list. Each card shows the place name, category, and
// a source ▶ chip (timestamp from source_timestamp_sec when the source is a
// youtube video). Tapping a card opens the existing PinBottomSheet, which (14-03)
// embeds the video seeked to that timestamp. Same place id is already deduped at
// the DB layer, so this is a plain flat render — no grouping.

import { type Link, type Place } from '@moajoa/core';
import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

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
            ? `▶ ${tsLabel(item.source_timestamp_sec)}`
            : link
              ? '▶ 영상'
              : null;
        return (
          <Pressable
            onPress={() => onPressPlace(item)}
            className="p-3 border border-neutral-200 rounded-lg mb-2 flex-row items-center justify-between"
          >
            <View className="flex-1 pr-2">
              <Text className="text-sm font-medium" numberOfLines={1}>
                {item.name_ko ?? item.name_local}
              </Text>
              {(item.category || item.address) && (
                <Text className="text-xs text-neutral-500 mt-1" numberOfLines={1}>
                  {item.category ?? item.address}
                </Text>
              )}
            </View>
            {sourceLabel && (
              <View className="px-2 py-1 rounded bg-neutral-100">
                <Text className="text-xs text-brand-500">{sourceLabel}</Text>
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}
