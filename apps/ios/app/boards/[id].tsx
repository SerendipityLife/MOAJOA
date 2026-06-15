import { addLink, listLinksByBoard, listPlacesByBoard, getBoard } from '@moajoa/api';
import {
  detectSourceKind,
  SharedDefaultsKeys,
  LOW_CONFIDENCE_THRESHOLD,
  type Board,
  type Link,
  type Place,
} from '@moajoa/core';
import { router, useLocalSearchParams } from 'expo-router';
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
import { shareCurrentBoard } from '@/lib/share-board';

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  // Extractions run in the global store (background), so this list survives
  // navigating away. Filter to the ones belonging to this board.
  const boardExtractions = useActiveExtractions().filter((e) => e.boardId === id);
  const [addPinOpen, setAddPinOpen] = useState(false);
  // Phase 5 ONBOARD-02 (D-20): tri-state — null = loading from AsyncStorage,
  // false = not dismissed (card may show), true = dismissed (card never shows).
  // Loading null prevents a 1-frame flicker for users who already dismissed.
  const [linkCardDismissed, setLinkCardDismissed] = useState<boolean | null>(null);

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

  // Phase 5 ONBOARD-02: load dismiss flag once per mount. Global key (D-20),
  // so a single read covers every board the user navigates to.
  useEffect(() => {
    isLinkCardDismissed().then(setLinkCardDismissed);
  }, []);

  // The extraction lifecycle (progress steps, done/error toast, retry) now lives
  // in the global store so it keeps running after the user leaves this screen.
  // Here we only need to refresh this board's map/links when its own extraction
  // reaches a terminal state.
  useEffect(() => {
    return onExtractionComplete((boardId) => {
      if (boardId === id) load();
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
      // manual/null stay untriggered; instagram resolves to failed server-side
      // and rides the existing TRUST-03 failed-row retry UI. Extraction runs in
      // the global store (background) — the user is free to leave this screen.
      const addedKind = detectSourceKind(link.url);
      if (addedKind !== null && addedKind !== 'manual') {
        startExtraction({ linkId: link.id, boardId: id, boardTitle: board?.title ?? null });
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
      await shareCurrentBoard(id);
    } catch (err) {
      console.warn('[shareBoard] failed:', err);
      showToast('공유 준비 실패', 'error');
    }
  }

  const mapRef = useRef<MapView>(null);

  // 목록의 한 장소를 탭하면 지도를 그 핀으로 확대 이동(+바텀시트 열기). 목록만으로는
  // 위치 감이 안 오던 문제 해결 — fitToCoordinates(전체 보기)와 별개의 단일 핀 줌인.
  const onSelectPlace = useCallback((p: Place) => {
    mapRef.current?.animateToRegion(
      { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      350,
    );
    setSelectedPlace(p);
  }, []);

  // Fit the camera to ALL pins whenever places load/change. initialRegion only
  // applies on first mount (places still empty → city default), so without this
  // the map stays on the default region even after pins arrive (도쿄 고정 버그).
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
  // dismissed AND the board is empty on both axes (links and places). null
  // (loading) is excluded so users who already dismissed never see a flash.
  const showOnboardCard = linkCardDismissed === false && places.length === 0 && links.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로"
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#374151" />
        </Pressable>
        <Text className="ml-1 text-lg font-bold flex-1 text-neutral-900" numberOfLines={1}>
          {board?.title ?? '...'}
        </Text>
        <Pressable
          onPress={onShare}
          hitSlop={8}
          accessibilityLabel="공유하기"
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="share-outline" size={22} color="#2979FF" />
        </Pressable>
        <Pressable
          onPress={() => setAddPinOpen(true)}
          hitSlop={8}
          accessibilityLabel="핀 추가"
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="add" size={26} color="#2979FF" />
        </Pressable>
      </View>

      {showOnboardCard && (
        <OnboardCard
          onDismiss={() => {
            // Optimistic UI: hide immediately, then persist. The await is
            // intentionally not blocking the close — write failure only logs
            // a warn (see lib/onboarding.ts) so reopening the screen would
            // simply show the card again, never a crash.
            setLinkCardDismissed(true);
            void dismissLinkCard();
          }}
        />
      )}

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
            // (confidence === null) render as high-confidence — D-15 explicitly
            // excludes null from the low-confidence branch.
            const isAi = p.source_kind === 'ai';
            const isLowConf =
              isAi && p.confidence !== null && p.confidence < LOW_CONFIDENCE_THRESHOLD;
            const pinColor = isAi ? '#F97316' : '#0F172A';
            const opacity = isLowConf ? 0.5 : 1.0;
            // 목록/마커로 고른 핀은 다른 핀과 섞이지 않게 크게·파랗게·맨 위로.
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
                  // RESEARCH Pitfall 3: react-native-maps `opacity` prop may be
                  // ignored on Apple Maps. We pair it with a children View that
                  // self-renders the low-confidence ? badge at the same alpha,
                  // so the visual signal degrades gracefully on either provider.
                  // Children-present semantics: react-native-maps replaces the
                  // default pin with the View — intended trade-off (D-13 "low
                  // conf = 의도적으로 약한 시각").
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
            {boardExtractions.map((e) => (
              <View key={e.linkId} className="mb-3">
                <StepIndicator current={e.step} />
              </View>
            ))}
            {boardExtractions.length > 0 && (
              <Text className="text-xs text-neutral-400 text-center mb-3">
                다른 화면으로 이동해도 장소를 불러와요.
              </Text>
            )}
            {/* Links collapsed to a compact strip; failed rows stay tappable (TRUST-03 retry). */}
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
                      startExtraction({ linkId: item.id, boardId: id, boardTitle: board?.title ?? null });
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
