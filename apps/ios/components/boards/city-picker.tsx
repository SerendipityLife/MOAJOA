// CityPicker — Mozi "Plan location" screen, adapted to MOAJOA's extraction
// scope. MOAJOA only extracts places for a fixed set of cities (CITY_KO_MAP),
// so instead of a paid geocoding/autocomplete API we offer a typeahead filter
// over that list. Same search experience, zero API cost, and the user can't
// pick a city we can't process. Cities are grouped under collapsible country
// headers so the list stays scannable as the supported set grows.

import { Ionicons } from '@expo/vector-icons';
import { CITY_KO_MAP } from '@moajoa/core';
import { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  selectedCode: string | null;
  onClose: () => void;
  onSelect: (code: string, ko: string) => void;
}

// city_code → country. CITY_KO_MAP has no country dimension and this grouping
// is only needed here, so the map stays local rather than touching the shared
// core constants. A city missing from this map falls back to '기타' so a new
// CITY_KO_MAP entry never silently disappears from the picker.
const CITY_COUNTRY: Record<string, string> = {
  tokyo: '일본',
  osaka: '일본',
  kyoto: '일본',
  fukuoka: '일본',
  sapporo: '일본',
  okinawa: '일본',
  seoul: '한국',
  busan: '한국',
  jeju: '한국',
};

// Country → flag emoji for the group header. Emoji renders natively on iOS, so
// no icon asset/dependency is needed. '기타' (unmapped) falls back to a globe.
const COUNTRY_FLAG: Record<string, string> = {
  일본: '🇯🇵',
  한국: '🇰🇷',
};

type City = { code: string; ko: string };

// Country groups, with both country order and within-group city order derived
// from CITY_KO_MAP's insertion order — single source of truth, no drift.
const COUNTRY_GROUPS: { country: string; cities: City[] }[] = (() => {
  const groups = new Map<string, City[]>();
  for (const [code, ko] of Object.entries(CITY_KO_MAP)) {
    const country = CITY_COUNTRY[code] ?? '기타';
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country)!.push({ code, ko });
  }
  return Array.from(groups, ([country, cities]) => ({ country, cities }));
})();

export function CityPicker({ visible, selectedCode, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const searching = query.trim().length > 0;

  // While searching we ignore collapse state and expand every matching group;
  // otherwise each group honours its toggle (data: [] keeps the header visible
  // but hides its cities).
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRY_GROUPS.map(({ country, cities }) => {
      const matched = q
        ? cities.filter((c) => c.ko.includes(q) || c.code.includes(q))
        : cities;
      return {
        country,
        cities: matched,
        data: q || !collapsed[country] ? matched : [],
      };
    }).filter((s) => s.cities.length > 0);
  }, [query, collapsed]);

  const toggle = (country: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => ({ ...prev, [country]: !prev[country] }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
        {/* Header: X / 여행지 선택 / 초기화 */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-neutral-200 items-center justify-center"
          >
            <Ionicons name="close" size={20} color="#374151" />
          </Pressable>
          <Text className="text-lg font-bold text-neutral-900">여행지 선택</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setQuery('');
              onClose();
            }}
          >
            <Text className="text-base text-neutral-500">초기화</Text>
          </Pressable>
        </View>

        {/* Search field */}
        <View className="px-5 pt-2 pb-3">
          <View className="flex-row items-center bg-neutral-200/70 rounded-full px-4 h-12">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="도시 검색"
              placeholderTextColor="#9CA3AF"
              autoFocus
              className="flex-1 ml-2 text-base text-neutral-900"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerClassName="px-3 pb-10"
          ListEmptyComponent={
            <Text className="px-3 pt-6 text-neutral-500">검색 결과가 없어요</Text>
          }
          renderSectionHeader={({ section }) => {
            const isCollapsed = !searching && collapsed[section.country];
            return (
              <Pressable
                onPress={() => toggle(section.country)}
                disabled={searching}
                className="flex-row items-center justify-between px-3 pt-5 pb-2 active:opacity-60"
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-2">
                    {COUNTRY_FLAG[section.country] ?? '🌏'}
                  </Text>
                  <Text className="text-xl font-extrabold text-neutral-900">
                    {section.country}
                  </Text>
                </View>
                {!searching && (
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    color="#6B7280"
                  />
                )}
              </Pressable>
            );
          }}
          renderItem={({ item }) => {
            const active = item.code === selectedCode;
            return (
              <Pressable
                onPress={() => onSelect(item.code, item.ko)}
                className="flex-row items-center px-3 py-3 rounded-2xl active:bg-brand-50"
              >
                <View className="w-9 h-9 rounded-xl bg-brand-50 items-center justify-center">
                  <Ionicons name="location-outline" size={18} color="#2979FF" />
                </View>
                <Text className="flex-1 ml-3 text-base font-medium text-neutral-900">
                  {item.ko}
                </Text>
                {active && <Ionicons name="checkmark" size={20} color="#2979FF" />}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
