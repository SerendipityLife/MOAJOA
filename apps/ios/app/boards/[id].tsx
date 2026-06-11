import {
  addLink,
  listLinksByBoard,
  listPlacesByBoard,
  getBoard,
  triggerExtraction,
} from '@moajoa/api';
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
import { FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { subscribeExtractProgress, type ExtractProgress } from '@/lib/realtime';
import { showToast } from '@/lib/toast';
import { SharedDefaults } from '@/lib/shared-defaults';
import { isLinkCardDismissed, dismissLinkCard } from '@/lib/onboarding';
import { PinBottomSheet } from '@/components/boards/pin-sheet';
import { PinAddModal } from '@/components/boards/pin-add-modal';
import { StepIndicator, type Step } from '@/components/boards/step-indicator';
import { OnboardCard } from '@/components/boards/onboard-card';

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
  // pendingUrl: set when the user added a link on the "새 여행" screen — the
  // board was just created and we replay the exact same add-link + extract path
  // here so the flow is identical to typing a link on this screen.
  const { id, pendingUrl } = useLocalSearchParams<{ id: string; pendingUrl?: string }>();
  const pendingConsumed = useRef(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [url, setUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
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
        // D-10/D-12: capture linkId before clearing analyzing so the retry
        // closure has a stable reference. No automatic retry — user-explicit
        // [재시도] tap only.
        const linkId = analyzing;
        setAnalyzing(null);
        setCurrentStep(null);
        showToast(`분석 실패: ${mapErrorReason(p.error)}`, 'error', {
          action: linkId
            ? {
                label: '재시도',
                onPress: () => {
                  setAnalyzing(linkId);
                  triggerExtraction(supabase, linkId).catch((err) => {
                    console.warn('[retry] failed:', err);
                    setAnalyzing(null);
                    showToast('재시도 실패: 잠시 후 다시 시도', 'error');
                  });
                },
              }
            : undefined,
        });
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
      // and rides the existing TRUST-03 failed-row retry UI.
      const addedKind = detectSourceKind(link.url);
      if (addedKind !== null && addedKind !== 'manual') {
        setAnalyzing(link.id);
        triggerExtraction(supabase, link.id).catch((err) => {
          console.warn('[triggerExtraction] failed:', err);
          setAnalyzing(null);
          // D-10: immediate trigger failure (network/RPC) also gets retry
          // affordance. linkId is captured in closure from outer scope.
          showToast('분석 실패: 잠시 후 다시 시도', 'error', {
            action: {
              label: '재시도',
              onPress: () => {
                setAnalyzing(link.id);
                triggerExtraction(supabase, link.id).catch(() => {
                  setAnalyzing(null);
                  showToast('재시도 실패', 'error');
                });
              },
            },
          });
        });
      }
      await load();
    } catch (err) {
      console.warn('[addLink] failed:', err);
      showToast('링크 추가 실패', 'error');
    }
  }

  // Replay a link handed off from the "새 여행" screen exactly once. Guarded by
  // a ref so re-renders don't re-add it, and the param is cleared after use.
  useEffect(() => {
    if (!pendingUrl || pendingConsumed.current || !id) return;
    pendingConsumed.current = true;
    void onAddLink(pendingUrl);
    router.setParams({ pendingUrl: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUrl, id]);

  const region = places[0]
    ? {
        latitude: places[0].lat,
        longitude: places[0].lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : { latitude: 35.68, longitude: 139.69, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  const detected = url ? detectSourceKind(url) : null;

  // Phase 5 ONBOARD-02 (D-19/D-21): only render when explicitly known not
  // dismissed AND the board is empty on both axes (links and places). null
  // (loading) is excluded so users who already dismissed never see a flash.
  const showOnboardCard = linkCardDismissed === false && places.length === 0 && links.length === 0;

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

      <View className="h-64 mx-6 rounded-lg overflow-hidden mb-3">
        <MapView style={{ flex: 1 }} initialRegion={region}>
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
            return (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                title={p.name_local}
                description={p.name_ko ?? p.address ?? undefined}
                pinColor={pinColor}
                opacity={opacity}
                onPress={() => setSelectedPlace(p)}
              >
                {isLowConf ? (
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

      <FlatList
        data={links}
        keyExtractor={(l) => l.id}
        contentContainerClassName="px-6 pb-12"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <Text className="text-sm font-medium text-neutral-700 mb-2">
            링크 {links.length}개 · 장소 {places.length}개
          </Text>
        }
        renderItem={({ item }) => {
          // D-11: 5 status copy fixture + failed-row tap retry.
          // Only `failed` rows are interactive; others render as inert info.
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
          const onRowPress = () => {
            if (!isFailed) return;
            setAnalyzing(item.id);
            triggerExtraction(supabase, item.id).catch((err) => {
              console.warn('[row-retry] failed:', err);
              setAnalyzing(null);
              showToast('재시도 실패', 'error');
            });
          };
          return (
            <Pressable
              onPress={onRowPress}
              disabled={!isFailed}
              className="p-3 border border-neutral-200 rounded-lg mb-2"
            >
              <Text className="text-sm font-medium" numberOfLines={1}>
                {item.title ?? item.url}
              </Text>
              <Text className="text-xs text-neutral-500 mt-1">
                {item.source_kind} ·{' '}
                <Text className={isFailed ? 'text-danger' : 'text-neutral-500'}>{statusKo}</Text>
              </Text>
            </Pressable>
          );
        }}
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
        {id && <PinAddModal boardId={id} onClose={() => setAddPinOpen(false)} onAdded={load} />}
      </Modal>
    </SafeAreaView>
  );
}
