import { EXTRACT_STEP_KO } from '@moajoa/core';
import { ActivityIndicator, Text, View } from 'react-native';

export type Step = 'metadata' | 'transcript' | 'llm' | 'places';

const ORDER: Step[] = ['metadata', 'transcript', 'llm', 'places'];

interface Props {
  current: Step | null;
}

/**
 * Phase 5 TRUST-02 step indicator overlay (D-07/D-08/D-09).
 *
 * Presented inside a clean white card (MOAJOA tone: Toss blue/neutral, no
 * orange) so it reads above the dimmed map without underlying text bleeding
 * through. Spinner + step list communicate that work is in progress.
 *
 * Visual reassignment audit (UI-SPEC D-22) — label tokens are a tested
 * contract, do not change:
 *   - current : text-base / font-semibold / brand-500 + filled brand dot
 *   - done    : text-sm  / regular         / neutral-500 + filled neutral dot
 *   - future  : text-xs  / font-medium     / neutral-300 + outline dot
 *
 * When `current` is null (idle / pre-metadata), every row is "future" and the
 * spinner alone communicates that work has started.
 */
export function StepIndicator({ current }: Props) {
  const currentIdx = current ? ORDER.indexOf(current) : -1;

  return (
    <View
      className="bg-white rounded-3xl px-7 py-6 items-center"
      style={{
        gap: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      }}
    >
      <ActivityIndicator size="large" color="#2979FF" />
      <Text className="text-base font-bold text-neutral-900">링크에서 장소를 찾고 있어요</Text>
      <View style={{ gap: 12 }} className="items-start self-stretch">
        {ORDER.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const labelClass = isCurrent
            ? 'text-base font-semibold text-brand-500'
            : isDone
              ? 'text-sm text-neutral-500'
              : 'text-xs font-medium text-neutral-300';
          return (
            <View key={step} className="flex-row items-center" style={{ gap: 10 }}>
              <View
                className="rounded-full"
                style={{
                  width: isCurrent ? 10 : 8,
                  height: isCurrent ? 10 : 8,
                  backgroundColor: isCurrent ? '#2979FF' : isDone ? '#9CA3AF' : 'transparent',
                  borderWidth: isDone || isCurrent ? 0 : 1.5,
                  borderColor: '#D1D5DB',
                }}
              />
              <Text className={labelClass}>{EXTRACT_STEP_KO[step]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
