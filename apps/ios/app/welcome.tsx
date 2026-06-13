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
 * Every slide is an edge-to-edge travel photo with a dark scrim. The brand
 * wordmark and the per-slide copy sit together as one vertically-centered group
 * over the scrim (Mozi-style) — wordmark largest, since it's the service name.
 * Only the dots + social CTA float as fixed chrome pinned to the bottom. Each
 * photo lives inside its own slide, so swiping between them stays in sync (no
 * shared-backdrop pop).
 */

interface Slide {
  key: string;
  title: string;
  photo: ImageSourcePropType;
}

const SLIDES: Slide[] = [
  {
    key: 'link',
    title: '유튜브 링크 하나로\n여행 지도 완성',
    photo: require('../assets/onboarding/travel-photo.jpg'),
  },
  {
    key: 'share',
    title: '완성된 여행 지도를\n친구와 공유하세요',
    photo: require('../assets/onboarding/lake-photo.jpg'),
  },
  {
    key: 'vote',
    title: '친구랑 투표로\n어디 갈지 정해요',
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
          // Photo fills the screen behind the chrome; the wordmark + copy group
          // sits vertically centered in white over the scrim.
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
            {/* Brand wordmark + per-slide copy as one vertically-centered group
                (Mozi-style). The wordmark is the largest type since it's the
                service name — it should outrank the value-prop copy below it. */}
            <View
              style={{ paddingTop: insets.top, paddingBottom: botH }}
              className="flex-1 justify-center px-8"
            >
              <Text
                className="text-4xl font-extrabold tracking-wider text-white"
                style={WORDMARK_SHADOW}
              >
                MOAJOA
              </Text>
              <Text
                className="mt-5 text-3xl font-extrabold leading-tight text-white"
                style={TITLE_SHADOW}
              >
                {item.title}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Chrome overlay — dots + CTA pinned to the bottom. box-none lets swipes
          pass through to the carousel; only the CTA buttons capture touches. The
          wordmark now lives inside each slide (centered with the copy), so the
          only fixed chrome here is the bottom band. */}
      <View className="absolute inset-0 justify-end" pointerEvents="box-none">
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
