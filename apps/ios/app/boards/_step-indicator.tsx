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
 * Replaces Phase 3 single-spinner overlay content with a 4-row Korean step
 * list driven by broadcast `metadata|transcript|llm|places` step names.
 * Visual reassignment audit (UI-SPEC D-22):
 *   - current : text-base / font-semibold / brand-500 + filled dot ●
 *   - done    : text-sm  / regular         / neutral-500 + filled dot ●
 *   - future  : text-xs  / font-medium     / neutral-300 + outline dot ○
 *
 * When `current` is null (idle / pre-metadata), every row is "future" and the
 * spinner alone communicates that work has started.
 */
export function StepIndicator({ current }: Props) {
  const currentIdx = current ? ORDER.indexOf(current) : -1;

  return (
    <View className="items-center" style={{ gap: 12 }}>
      <ActivityIndicator size="large" color="#F97316" />
      <View style={{ gap: 8 }} className="items-start">
        {ORDER.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const labelClass = isCurrent
            ? 'text-base font-semibold text-brand-500'
            : isDone
              ? 'text-sm text-neutral-500'
              : 'text-xs font-medium text-neutral-300';
          const dotChar = isDone || isCurrent ? '●' : '○';
          const dotColor = isCurrent
            ? 'text-brand-500'
            : isDone
              ? 'text-neutral-500'
              : 'text-neutral-300';
          return (
            <View key={step} className="flex-row items-center" style={{ gap: 8 }}>
              <Text className={`text-base ${dotColor}`}>{dotChar}</Text>
              <Text className={labelClass}>{EXTRACT_STEP_KO[step]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
