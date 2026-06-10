import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithApple, signInWithGoogle, type SignInResult } from '@/lib/auth';

/**
 * Welcome / onboarding entry — Mozi-style full-screen intro carousel with a
 * persistent social CTA pinned to the bottom (flow ref: Refero 4131).
 *
 * The carousel itself *is* the "quick tour": swipe through three value-prop
 * slides, sign in whenever. Social (Apple primary, Google secondary) lives
 * here; "이메일로 계속" routes to the existing email form (/login).
 *
 * Hero art is composed from RN primitives in the brand tone (no illustration
 * assets yet) — each `Hero*` block mocks the scene from its Stitch frame
 * (map of pins / overlapping calendar / friends voting). Swap for real
 * imagery when assets land.
 */

interface Slide {
  key: string;
  title: string;
  sub: string;
  Hero: () => React.JSX.Element;
}

// Floating tag pill — mimics Mozi's "New York / 3 Days / Overlap with…" chips.
function Tag({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View
      className="flex-row items-center bg-white rounded-full px-3 py-1.5"
      style={{
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      }}
    >
      <Ionicons name={icon} size={14} color="#2979FF" />
      <Text className="ml-1.5 text-sm font-semibold text-neutral-800">{label}</Text>
    </View>
  );
}

function HeroFrame({ children }: { children: React.ReactNode }) {
  return (
    <View className="w-full h-full rounded-3xl bg-brand-50 overflow-hidden items-center justify-center">
      {children}
    </View>
  );
}

// A dropped location pin — filled teardrop. Tone tracks pin-state semantics
// (brand = loved, green = confirmed, muted = freshly extracted, no votes).
function Pin({ tone, size = 30 }: { tone: 'brand' | 'green' | 'muted'; size?: number }) {
  const color = tone === 'brand' ? '#2979FF' : tone === 'green' ? '#16A34A' : '#B7C0CC';
  return <Ionicons name="location" size={size} color={color} />;
}

// Slide 1 — a thrown link lands as pins on a little map board.
function HeroLink() {
  return (
    <HeroFrame>
      <View
        className="w-3/4 h-1/2 rounded-2xl bg-white overflow-hidden"
        style={{
          shadowColor: '#1E293B',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        }}
      >
        {/* faux streets — soft brand tint */}
        <View className="absolute top-10 left-0 right-0 h-1.5 bg-brand-50" />
        <View className="absolute bottom-12 left-0 right-0 h-1.5 bg-brand-50" />
        <View className="absolute top-0 bottom-0 left-1/3 w-1.5 bg-brand-50" />
        {/* extracted places */}
        <View className="absolute left-4 top-3">
          <Pin tone="muted" size={26} />
        </View>
        <View className="absolute right-5 top-7">
          <Pin tone="brand" />
        </View>
        <View className="absolute left-1/2 bottom-4">
          <Pin tone="green" size={26} />
        </View>
      </View>

      {/* link feeds in from the top, a place pops out below */}
      <View className="absolute top-5 left-5">
        <Tag icon="link" label="youtu.be/seoul" />
      </View>
      <View className="absolute bottom-7 right-5">
        <Tag icon="location" label="성수동 카페" />
      </View>
    </HeroFrame>
  );
}

// A weekday cell on the mini calendar. `overlap` = both friends free that day.
function DateCell({ state }: { state: 'off' | 'mine' | 'friend' | 'overlap' }) {
  const bg =
    state === 'overlap'
      ? '#2979FF'
      : state === 'mine'
        ? '#E0EAFF'
        : state === 'friend'
          ? '#FCE6BD'
          : '#F1F3F6';
  return <View className="w-6 h-6 rounded-md" style={{ backgroundColor: bg }} />;
}

const CAL_ROWS: ('off' | 'mine' | 'friend' | 'overlap')[][] = [
  ['off', 'mine', 'mine', 'overlap', 'overlap', 'friend', 'off'],
  ['off', 'off', 'overlap', 'overlap', 'friend', 'friend', 'off'],
];

// Slide 2 — overlapping trip dates surface on a shared calendar.
function HeroOverlap() {
  return (
    <HeroFrame>
      <View
        className="w-3/4 rounded-2xl bg-white px-4 py-4"
        style={{
          shadowColor: '#1E293B',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        }}
      >
        <View className="flex-row justify-between mb-3">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <Text key={d} className="w-6 text-center text-xs text-neutral-400">
              {d}
            </Text>
          ))}
        </View>
        {CAL_ROWS.map((row, ri) => (
          <View key={ri} className="flex-row justify-between mb-2">
            {row.map((s, ci) => (
              <DateCell key={ci} state={s} />
            ))}
          </View>
        ))}
      </View>

      <View className="absolute top-5 left-5">
        <Tag icon="airplane" label="도쿄" />
      </View>
      <View className="absolute top-16 right-5">
        <Tag icon="calendar" label="3박 4일" />
      </View>
      <View className="absolute bottom-7 left-6">
        <Tag icon="sparkles" label="민지와 겹쳐요" />
      </View>
    </HeroFrame>
  );
}

// A friend avatar in the voting cluster — white-ringed brand-tinted disc.
function Avatar({ bg }: { bg: string }) {
  return (
    <View
      className="w-14 h-14 rounded-full items-center justify-center border-2 border-white"
      style={{ backgroundColor: bg }}
    >
      <Ionicons name="person" size={26} color="#FFFFFF" />
    </View>
  );
}

// Slide 3 — friends gather and vote, hearts floating up.
function HeroVote() {
  return (
    <HeroFrame>
      {/* floating votes */}
      <View className="absolute top-10 flex-row items-end gap-4">
        <Ionicons name="heart" size={18} color="#93B4FF" />
        <Ionicons name="heart" size={30} color="#EF4444" />
        <Ionicons name="heart" size={20} color="#2979FF" />
      </View>

      {/* overlapping friend cluster */}
      <View className="flex-row items-center mt-6">
        <View style={{ marginRight: -14 }}>
          <Avatar bg="#93B4FF" />
        </View>
        <View style={{ marginRight: -14, zIndex: 2 }}>
          <Avatar bg="#2979FF" />
        </View>
        <View>
          <Avatar bg="#5C93FF" />
        </View>
      </View>

      <View className="absolute top-8 right-5">
        <Tag icon="heart" label="3표" />
      </View>
      <View className="absolute bottom-9 left-5">
        <Tag icon="checkmark-circle" label="여기로 결정!" />
      </View>
    </HeroFrame>
  );
}

const SLIDES: Slide[] = [
  {
    key: 'link',
    title: '링크만 던지면\n지도 보드가 완성돼요',
    sub: '유튜브·블로그·인스타 속 장소를 자동으로 모아드려요',
    Hero: HeroLink,
  },
  {
    key: 'overlap',
    title: '겹치는 날짜·도시를\n한눈에',
    sub: '함께 갈 친구가 언제 어디로 가는지 모여요',
    Hero: HeroOverlap,
  },
  {
    key: 'vote',
    title: '친구랑 투표로\n어디 갈지 정해요',
    sub: '같이 고르고 바로 결정 — 단톡 스크롤은 이제 그만',
    Hero: HeroVote,
  },
];

export default function Welcome() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [listH, setListH] = useState(0);
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
    <SafeAreaView className="flex-1 bg-white">
      {/* Wordmark */}
      <View className="items-center pt-4 pb-2">
        <Text className="text-2xl font-extrabold tracking-wider text-brand-500">MOAJOA</Text>
      </View>

      {/* Swipeable value-prop carousel */}
      <FlatList
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
        onLayout={(e) => setListH(e.nativeEvent.layout.height)}
        renderItem={({ item }) => (
          <View style={{ width, height: listH || undefined }} className="px-8 py-3">
            <View className="flex-1 min-h-0">
              <item.Hero />
            </View>
            <Text className="mt-5 text-3xl font-extrabold leading-tight text-neutral-900">
              {item.title}
            </Text>
            <Text className="mt-2 text-base text-neutral-500 leading-relaxed">{item.sub}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View className="flex-row items-center justify-center gap-2 py-4">
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            className={
              i === index
                ? 'h-2 w-5 rounded-full bg-brand-500'
                : 'h-2 w-2 rounded-full bg-neutral-300'
            }
          />
        ))}
      </View>

      {/* Persistent CTA */}
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

        {/* Google — secondary */}
        <Pressable
          onPress={() => run(signInWithGoogle)}
          disabled={pending}
          style={{ opacity: pending ? 0.6 : 1 }}
          className="mt-3 flex-row items-center justify-center border border-neutral-300 rounded-2xl py-4"
        >
          <Ionicons name="logo-google" size={18} color="#111827" />
          <Text className="ml-2 text-base font-medium text-neutral-800">Google로 계속</Text>
        </Pressable>

        {/* Email fallback */}
        <Pressable onPress={() => router.push('/login')} className="mt-5 items-center" hitSlop={8}>
          <Text className="text-sm text-neutral-500">이메일로 계속하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
