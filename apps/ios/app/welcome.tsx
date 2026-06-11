import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Image,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithApple, signInWithGoogle, type SignInResult } from '@/lib/auth';

/**
 * Welcome / onboarding entry — Mozi-style full-screen intro carousel with a
 * persistent social CTA pinned to the bottom (flow ref: Refero 4131).
 *
 * The carousel itself *is* the "quick tour": swipe through three value-prop
 * slides, sign in whenever. Social only (Apple primary, Google secondary) —
 * the email/password screen was dropped, so this is the sole auth entry.
 *
 * Every slide is an edge-to-edge travel photo with a dark scrim; the chrome
 * (wordmark, dots, CTA) floats on top in white and the per-slide copy sits just
 * above the CTA. Each photo lives inside its own slide, so swiping between them
 * stays in sync (no shared-backdrop pop).
 */

interface Slide {
  key: string;
  title: string;
  sub: string;
  photo: ImageSourcePropType;
}

const SLIDES: Slide[] = [
  {
    key: 'link',
    title: '유튜브 링크 하나로\n여행 지도 완성',
    sub: '영상 속 장소들을 AI가 자동으로 찾아\n지도에 콕콕 찍어드려요',
    photo: require('../assets/onboarding/travel-photo.jpg'),
  },
  {
    key: 'share',
    title: '완성된 여행 지도를\n친구와 공유하세요',
    sub: '유튜브에서 찾은 맛집과 명소를 공유하고\n함께 여행을 계획해보세요',
    photo: require('../assets/onboarding/lake-photo.jpg'),
  },
  {
    key: 'vote',
    title: '친구랑 투표로\n어디 갈지 정해요',
    sub: '같이 고르고 바로 결정 — 단톡 스크롤은 이제 그만',
    photo: require('../assets/onboarding/fuji-photo.jpg'),
  },
];

// Smooth top+bottom darkening for the photo slides. RN has no CSS gradient and we
// avoid a native gradient dep, so we stack many thin slices — the small per-slice
// alpha steps read as a continuous gradient instead of hard bands.
const SCRIM_SLICES = Array.from({ length: 30 }, (_, i) => {
  const t = i / 29; // 0 (top) → 1 (bottom)
  const top = 0.35 * Math.max(0, 1 - t / 0.28);
  const bottom = 0.45 * Math.max(0, (t - 0.45) / 0.55);
  return Math.round(Math.min(0.7, 0.12 + top + bottom) * 1000) / 1000;
});

const TITLE_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

const WORDMARK_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.35)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

export default function Welcome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [screenH, setScreenH] = useState(0);
  const [topH, setTopH] = useState(0); // wordmark band height (incl. top inset)
  const [botH, setBotH] = useState(0); // dots + CTA band height (incl. bottom inset)
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  async function run(signIn: () => Promise<SignInResult>) {
    setError(null);
    setPending(true);
    const res = await signIn();
    if (res.ok) router.replace('/');
    else if (res.error) setError(res.error);
    setPending(false);
  }

  return (
    <View className="flex-1 bg-white" onLayout={(e) => setScreenH(e.nativeEvent.layout.height)}>
      {/* Full-screen paged carousel — each slide paints its own photo background */}
      <FlatList
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
        renderItem={({ item }) => (
          // Photo fills the screen behind the chrome; copy sits just above the
          // overlaid dots/CTA band, in white over the scrim.
          <View style={{ width, height: screenH || undefined }}>
            <Image
              source={item.photo}
              resizeMode="cover"
              className="absolute inset-0 h-full w-full"
              accessibilityIgnoresInvertColors
            />
            <View className="absolute inset-0">
              {SCRIM_SLICES.map((a, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${a})` }} />
              ))}
            </View>
            <View
              style={{ paddingTop: topH, paddingBottom: botH }}
              className="flex-1 justify-end px-8"
            >
              <Text
                className="text-3xl font-extrabold leading-tight text-white"
                style={TITLE_SHADOW}
              >
                {item.title}
              </Text>
              <Text className="mt-2 text-base leading-relaxed text-white/90">{item.sub}</Text>
            </View>
          </View>
        )}
      />

      {/* Chrome overlay — floats above the carousel. box-none lets swipes through
          to the list; only the CTA buttons capture touches. White throughout
          since every slide is a photo. */}
      <View className="absolute inset-0" pointerEvents="box-none">
        {/* Wordmark */}
        <View
          onLayout={(e) => setTopH(e.nativeEvent.layout.height)}
          style={{ paddingTop: insets.top }}
          className="items-center pt-4 pb-2"
          pointerEvents="none"
        >
          <Text
            className="text-2xl font-extrabold tracking-wider text-white"
            style={WORDMARK_SHADOW}
          >
            MOAJOA
          </Text>
        </View>

        <View className="flex-1" pointerEvents="none" />

        {/* Dots + CTA */}
        <View
          onLayout={(e) => setBotH(e.nativeEvent.layout.height)}
          style={{ paddingBottom: insets.bottom }}
          pointerEvents="box-none"
        >
          {/* Dots */}
          <View className="flex-row items-center justify-center gap-2 py-4" pointerEvents="none">
            {SLIDES.map((s, i) => (
              <View
                key={s.key}
                className={
                  i === index ? 'h-2 w-5 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white/40'
                }
              />
            ))}
          </View>

          {/* CTA */}
          <View className="px-8 pb-4">
            {error && <Text className="mb-3 text-sm text-danger text-center">{error}</Text>}

            {/* Apple — primary */}
            <Pressable
              onPress={() => run(signInWithApple)}
              disabled={pending}
              style={{ opacity: pending ? 0.6 : 1 }}
              className="flex-row items-center justify-center bg-neutral-900 rounded-2xl py-4"
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-base font-semibold text-white">Apple로 계속</Text>
            </Pressable>

            {/* Google — secondary (solid white over the photo) */}
            <Pressable
              onPress={() => run(signInWithGoogle)}
              disabled={pending}
              style={{ opacity: pending ? 0.6 : 1 }}
              className="mt-3 flex-row items-center justify-center rounded-2xl bg-white py-4"
            >
              <Ionicons name="logo-google" size={18} color="#111827" />
              <Text className="ml-2 text-base font-medium text-neutral-800">Google로 계속</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
