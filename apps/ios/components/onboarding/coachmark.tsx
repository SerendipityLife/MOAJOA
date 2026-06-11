import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { completeWalkthrough, isWalkthroughDone } from '@/lib/onboarding';

/**
 * First-run tab walkthrough (Mozi flow 4131 "feature walkthrough"). A dimmed
 * overlay with a bottom card that steps through the four tabs, highlighting one
 * at a time in a faux nav strip. Self-contained: reads/writes its own
 * AsyncStorage flag, so the tabs layout just mounts <Coachmark /> unconditionally.
 *
 * We render a *faux* nav strip rather than measuring the real native tab bar —
 * pixel-anchoring to the navigator is fragile across devices; a labelled strip
 * communicates "this tab does X" just as clearly.
 */

// Bottom-nav slots in render order (index 2 is the center ＋ FAB, never a step target).
const SLOTS: ({ icon: keyof typeof Ionicons.glyphMap; label: string } | 'fab')[] = [
  { icon: 'bookmarks-outline', label: '내 여행' },
  { icon: 'compass-outline', label: '둘러보기' },
  'fab',
  { icon: 'people-outline', label: '내 친구' },
  { icon: 'person-outline', label: '내 정보' },
];

interface Step {
  slot: number; // index into SLOTS to highlight
  title: string;
  sub: string;
}

const STEPS: Step[] = [
  {
    slot: 0,
    title: '내 여행에 다 모여요',
    sub: '만든 여행 보드가 여기 쌓여요. 가운데 ＋로 새 여행을 시작해요.',
  },
  {
    slot: 1,
    title: '둘러보기로 영감 얻기',
    sub: '다른 사람들이 공개한 여행 보드를 구경할 수 있어요.',
  },
  {
    slot: 3,
    title: '친구와 함께 정해요',
    sub: '친구를 초대해 같이 보고 투표로 행선지를 결정해요.',
  },
  { slot: 4, title: '내 정보', sub: '프로필과 설정은 여기에서 관리해요.' },
];

export function Coachmark() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    isWalkthroughDone().then((done) => {
      if (!done) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      completeWalkthrough();
      setVisible(false);
    } else {
      setStep((s) => s + 1);
    }
  }

  function skip() {
    completeWalkthrough();
    setVisible(false);
  }

  return (
    // Absolute-fill overlay (not RN <Modal>) — a Modal mounted as a sibling of the
    // expo-router navigator does not reliably present; an inset-0 view does.
    <View className="absolute inset-0 z-50 bg-black/60 justify-end" style={{ elevation: 50 }}>
      {/* Skip */}
      <Pressable onPress={skip} className="absolute top-16 right-6" hitSlop={8}>
        <Text className="text-sm font-medium text-white/80">건너뛰기</Text>
      </Pressable>

      <View className="bg-white rounded-t-3xl px-6 pt-7 pb-10">
        <Text className="text-2xl font-extrabold text-neutral-900">{current.title}</Text>
        <Text className="mt-2 text-base text-neutral-500 leading-relaxed">{current.sub}</Text>

        {/* Faux nav strip with the current slot highlighted */}
        <View className="flex-row items-end justify-between mt-7 mb-1">
          {SLOTS.map((slot, i) => {
            if (slot === 'fab') {
              return (
                <View
                  key="fab"
                  className="w-12 h-12 rounded-full bg-brand-500 items-center justify-center"
                >
                  <Ionicons name="add" size={26} color="#FFFFFF" />
                </View>
              );
            }
            const active = i === current.slot;
            return (
              <View key={slot.label} className="items-center flex-1">
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center ${
                    active ? 'bg-brand-50' : ''
                  }`}
                >
                  <Ionicons name={slot.icon} size={24} color={active ? '#2979FF' : '#C4CAD2'} />
                </View>
                <Text
                  className={`mt-1 text-xs ${
                    active ? 'font-bold text-brand-500' : 'text-neutral-400'
                  }`}
                >
                  {slot.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Dots */}
        <View className="flex-row items-center justify-center gap-2 mt-6 mb-5">
          {STEPS.map((s, i) => (
            <View
              key={s.slot}
              className={
                i === step
                  ? 'h-2 w-5 rounded-full bg-brand-500'
                  : 'h-2 w-2 rounded-full bg-neutral-300'
              }
            />
          ))}
        </View>

        <Pressable onPress={next} className="bg-neutral-900 rounded-2xl py-4 items-center">
          <Text className="text-base font-semibold text-white">{isLast ? '시작하기' : '다음'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
