// apps/ios/app/trip/[id]/(tabs)/map.tsx
// Phase 17 (NAV-02) — the 지도 tab. Surgical port of the old boards/[id].tsx map
// content (MapView + Marker + PROVIDER_GOOGLE + PlaceList + PinBottomSheet +
// PinAddModal + broadcast-driven extraction refresh). Data calls renamed to trip
// vocab (getTrip / listLinksByTrip / listPlacesByTrip). addLink/addManualPlace
// keep their `board_id` INPUT field (the api maps it to the trip_id DB column —
// the core LinkAdd/PlaceAddManual field rename is owned by a later plan). The pin
// `confidence` read survives (places.confidence column folded into 0016).
import { addLink, listLinksByTrip, listPlacesByTrip, getTrip } from '@moajoa/api';
import {
  detectSourceKind,
  SharedDefaultsKeys,
  LOW_CONFIDENCE_THRESHOLD,
  type Trip,
  type Link,
  type Place,
} from '@moajoa/core';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { SharedDefaults } from '@/lib/shared-defaults';
import {
  useActiveExtractions,
  onExtractionComplete,
  startExtraction,
} from '@/lib/extraction-store';
import { isLinkCardDismissed, dismissLinkCard } from '@/lib/onboarding';
import { PinBottomSheet } from '@/components/boards/pin-sheet';
import { PinAddModal } from '@/components/boards/pin-add-modal';
import { StepIndicator } from '@/components/boards/step-indicator';
import { OnboardCard } from '@/components/boards/onboard-card';
import { PlaceList } from '@/components/boards/place-list';
import { shareCurrentTrip } from '@/lib/share-board';

export default function TripMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // Extractions run in the global store (background), so this list survives
  // navigating away. Filter to the ones belonging to this trip. (The store key
  // is still `boardId` — the extraction-store field rename is out of scope.)
  const tripExtractions = useActiveExtractions().filter((e) => e.boardId === id);
  const [addPinOpen, setAddPinOpen] = useState(false);
  // Phase 5 ONBOARD-02 (D-20): tri-state — null = loading from AsyncStorage,
  // false = not dismissed (card may show), true = dismissed (card never shows).
  const [linkCardDismissed, setLinkCardDismissed] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [t, ls, ps] = await Promise.all([
        getTrip(supabase, id),
        listLinksByTrip(supabase, id),
        listPlacesByTrip(supabase, id),
      ]);
      setTrip(t);
      setLinks(ls);
      setPlaces(ps);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Phase 5 ONBOARD-02: load dismiss flag once per mount (global key D-20).
  useEffect(() => {
    isLinkCardDismissed().then(setLinkCardDismissed);
  }, []);

  // The extraction lifecycle (progress steps, done/error toast, retry) lives in
  // the global store. Here we only refresh this trip's map/links when its own
  // extraction reaches a terminal state.
  useEffect(() => {
    return onExtractionComplete((tripId) => {
      if (tripId === id) load();
    });
  }, [id, load]);

  async function onAddLink(explicitUrl?: string) {
    const value = (explicitUrl ?? url).trim();
    if (!value || !id) return;
    try {
      const link = await addLink(supabase, { board_id: id, url: value });
      setUrl('');
      // D-02: mirror last_board_id to App Group SharedDefaults so the Share
      // Extension knows where to enqueue subsequent shares.
      SharedDefaults.set(SharedDefaultsKeys.LastBoardId, id);
      // 09-05: fire for any auto-extractable kind (youtube|blog|instagram).
      const addedKind = detectSourceKind(link.url);
      if (addedKind !== null && addedKind !== 'manual') {
        startExtraction({ linkId: link.id, boardId: id, boardTitle: trip?.title ?? null });
      }
      await load();
    } catch (err) {
      console.warn('[addLink] failed:', err);
      showToast('링크 추가 실패', 'error');
    }
  }

  async function onShare() {
    if (!id) return;
    try {
      await shareCurrentTrip(id);
    } catch (err) {
      console.warn('[shareTrip] failed:', err);
      showToast('공유 준비 실패', 'error');
    }
  }

  const mapRef = useRef<MapView>(null);

  // 목록의 한 장소를 탭하면 지도를 그 핀으로 확대 이동(+바텀시트 열기).
  const onSelectPlace = useCallback((p: Place) => {
    mapRef.current?.animateToRegion(
      { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      350,
    );
    setSelectedPlace(p);
  }, []);

  // Fit the camera to ALL pins whenever places load/change.
  useEffect(() => {
    if (places.length === 0) return;
    mapRef.current?.fitToCoordinates(
      places.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true },
    );
  }, [places]);

  // First-mount fallback only — fitToCoordinates takes over once pins exist.
  const region = { latitude: 35.68, longitude: 139.69, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  const detected = url ? detectSourceKind(url) : null;

  // Phase 5 ONBOARD-02 (D-19/D-21): only render when explicitly known not
  // dismissed AND the trip is empty on both axes (links and places).
  const showOnboardCard = linkCardDismissed === false && places.length === 0 && links.length === 0;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-white">
      {showOnboardCard && (
        <OnboardCard
          onDismiss={() => {
            setLinkCardDismissed(true);
            void dismissLinkCard();
          }}
        />
      )}

      <View className="px-6 pt-3 mb-3">
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
            onPress={() => onAddLink()}
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

      <View className="h-64 mx-6 rounded-2xl overflow-hidden mb-3">
        <MapView ref={mapRef} style={{ flex: 1 }} provider={PROVIDER_GOOGLE} initialRegion={region}>
          {places.map((p) => {
            // TRUST-01 (D-05) + TRUST-04 (D-13/D-15): marker visual is a pure
            // function of (source_kind, confidence). manual/legacy AI pins
            // (confidence === null) render as high-confidence.
            const isAi = p.source_kind === 'ai';
            const isLowConf =
              isAi && p.confidence !== null && p.confidence < LOW_CONFIDENCE_THRESHOLD;
            const pinColor = isAi ? '#F97316' : '#0F172A';
            const opacity = isLowConf ? 0.5 : 1.0;
            const isSelected = selectedPlace?.id === p.id;
            return (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={p.name_local}
                description={p.name_ko ?? p.address ?? undefined}
                pinColor={pinColor}
                opacity={opacity}
                zIndex={isSelected ? 999 : 0}
                onPress={() => onSelectPlace(p)}
              >
                {isSelected ? (
                  <View className="w-12 h-12 items-center justify-center">
                    <View
                      className="w-11 h-11 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: '#2979FF',
                        borderWidth: 3,
                        borderColor: '#fff',
                        shadowColor: '#000',
                        shadowOpacity: 0.3,
                        shadowOffset: { width: 0, height: 2 },
                        shadowRadius: 4,
                        elevation: 5,
                      }}
                    >
                      <Ionicons name="location" size={22} color="#fff" />
                    </View>
                  </View>
                ) : isLowConf ? (
                  // RESEARCH Pitfall 3: react-native-maps `opacity` may be ignored
                  // on Apple Maps. Pair it with a children View that self-renders
                  // the low-confidence ? badge at the same alpha.
                  <View className="w-7 h-9 items-center justify-center">
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(249,115,22,0.5)' }}
                    >
                      <Text className="text-xs font-medium text-white">?</Text>
                    </View>
                  </View>
                ) : null}
              </Marker>
            );
          })}
        </MapView>
      </View>

      {places.length > 0 && (
        <View className="px-6 mb-3">
          <Pressable
            onPress={onShare}
            style={{
              shadowColor: '#2979FF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
            className="bg-brand-500 flex-row gap-2 px-4 py-3.5 rounded-xl items-center justify-center active:opacity-90"
          >
            <Ionicons name="people" size={18} color="#FFFFFF" />
            <Text className="text-base font-semibold text-white">친구와 정하기</Text>
          </Pressable>
        </View>
      )}

      {places.length === 0 && links.length === 0 && !showOnboardCard && (
        // Map-tab empty state (UI-SPEC Screen 6 map).
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-brand-50 items-center justify-center mb-5">
            <Ionicons name="location-outline" size={36} color="#2979FF" />
          </View>
          <Text className="text-xl font-semibold text-neutral-900">아직 장소가 없어요</Text>
          <Text className="mt-2 text-base text-neutral-500 text-center leading-relaxed">
            유튜브·블로그 링크를 공유하면 영상 속 장소가 여기 모여요.
          </Text>
        </View>
      )}

      {(places.length > 0 || links.length > 0) && (
        <PlaceList
          places={places}
          links={links}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          onPressPlace={onSelectPlace}
          header={
            <View>
              {tripExtractions.map((e) => (
                <View key={e.linkId} className="mb-3">
                  <StepIndicator current={e.step} />
                </View>
              ))}
              {tripExtractions.length > 0 && (
                <Text className="text-xs text-neutral-400 text-center mb-3">
                  다른 화면으로 이동해도 장소를 불러와요.
                </Text>
              )}
              {/* Links collapsed to a compact strip; failed rows stay tappable. */}
              {links.map((item) => {
                const status = item.extraction_status;
                const isFailed = status === 'failed';
                const statusKo =
                  status === 'pending'
                    ? '분석 대기'
                    : status === 'processing'
                      ? '분석 중...'
                      : status === 'ready'
                        ? '분석 완료'
                        : status === 'failed'
                          ? '분석 실패 — 탭하여 재시도'
                          : status === 'manual_review'
                            ? '재추출 필요'
                            : status;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (status === 'failed')
                        startExtraction({ linkId: item.id, boardId: id, boardTitle: trip?.title ?? null });
                    }}
                    disabled={!isFailed}
                    className="flex-row items-center justify-between py-1.5"
                  >
                    <Text className="text-xs text-neutral-500 flex-1 pr-2" numberOfLines={1}>
                      {item.title ?? item.url}
                    </Text>
                    <Text
                      className={isFailed ? 'text-xs text-danger' : 'text-xs text-neutral-400'}
                      numberOfLines={1}
                    >
                      {statusKo}
                    </Text>
                  </Pressable>
                );
              })}
              <Text className="text-sm font-medium text-neutral-700 mt-2 mb-2">
                장소 {places.length}개
              </Text>
            </View>
          }
        />
      )}

      <PinBottomSheet
        place={selectedPlace}
        links={links}
        onClose={() => setSelectedPlace(null)}
        onChanged={load}
      />

      <Modal
        visible={addPinOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddPinOpen(false)}
      >
        {id && <PinAddModal boardId={id} onClose={() => setAddPinOpen(false)} onAdded={load} />}
      </Modal>
    </SafeAreaView>
  );
}
