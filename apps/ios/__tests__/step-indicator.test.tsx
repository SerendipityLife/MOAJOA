// Unit test for StepIndicator (Plan 05-02 _step-indicator.tsx).
//
// Why: the contract that matters to BoardDetailScreen is that the 4 Korean
// labels render unconditionally, and that the visual "current" reassignment
// (D-22) flips correctly as the broadcast advances metadata→transcript→llm→places.
// We verify rendered text + className tokens (NativeWind compiles className but
// jest-expo passes raw className through, so substring assert is robust).

import { render } from '@testing-library/react-native';
import { EXTRACT_STEP_KO } from '@moajoa/core';
import { StepIndicator } from '@/app/boards/_step-indicator';

const ALL_LABELS = [
  EXTRACT_STEP_KO.metadata,
  EXTRACT_STEP_KO.transcript,
  EXTRACT_STEP_KO.llm,
  EXTRACT_STEP_KO.places,
];

describe('StepIndicator', () => {
  test('renders all 4 Korean step labels when current is null', () => {
    const { getByText } = render(<StepIndicator current={null} />);
    for (const label of ALL_LABELS) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  test('current="metadata" highlights metadata label with brand-500 + font-semibold', () => {
    const { getByText } = render(<StepIndicator current="metadata" />);
    const node = getByText(EXTRACT_STEP_KO.metadata);
    const cls = node.props.className as string;
    expect(cls).toContain('text-brand-500');
    expect(cls).toContain('font-semibold');
    expect(cls).toContain('text-base');
  });

  test('current="llm" marks metadata+transcript as done (neutral-500 / text-sm)', () => {
    const { getByText } = render(<StepIndicator current="llm" />);
    const meta = getByText(EXTRACT_STEP_KO.metadata).props.className as string;
    const transcript = getByText(EXTRACT_STEP_KO.transcript).props.className as string;
    expect(meta).toContain('text-neutral-500');
    expect(meta).toContain('text-sm');
    expect(transcript).toContain('text-neutral-500');
    expect(transcript).toContain('text-sm');
  });

  test('current="metadata" leaves future steps (transcript/llm/places) at neutral-300/text-xs', () => {
    const { getByText } = render(<StepIndicator current="metadata" />);
    for (const futureLabel of [EXTRACT_STEP_KO.transcript, EXTRACT_STEP_KO.llm, EXTRACT_STEP_KO.places]) {
      const cls = getByText(futureLabel).props.className as string;
      expect(cls).toContain('text-neutral-300');
      expect(cls).toContain('text-xs');
      expect(cls).toContain('font-medium');
    }
  });

  test('current="places" marks all earlier steps as done; places stays current', () => {
    const { getByText } = render(<StepIndicator current="places" />);
    const places = getByText(EXTRACT_STEP_KO.places).props.className as string;
    expect(places).toContain('text-brand-500');
    expect(places).toContain('font-semibold');
    for (const doneLabel of [EXTRACT_STEP_KO.metadata, EXTRACT_STEP_KO.transcript, EXTRACT_STEP_KO.llm]) {
      const cls = getByText(doneLabel).props.className as string;
      expect(cls).toContain('text-neutral-500');
    }
  });
});
