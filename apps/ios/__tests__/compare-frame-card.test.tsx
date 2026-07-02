// RNTL contract tests for CompareFrameCard (Plan 20-05 Task 2, UI-SPEC Component 0).
//
// The contract that matters (D-06 비교 구도):
//   1. full variant — header (title) + 2 provider rows (name + injected label) +
//      a [보기] button per row.
//   2. [보기] press fires THAT row's onView callback only — the component never
//      sees a URL (assembly knowledge stays in lib/booking.ts + core).
//   3. compact variant — single '예약 비교' strip with per-provider mini [보기].
//   4. rows length 1 → exactly one row (유심/교통 single-provider shape).
//   5. footerVisible defaults false → 고지 문구 hidden; true → rendered (D-16).
//
// Labels are injected from @moajoa/core COMPARE_LABELS — the REAL constants —
// proving the injection seam (the component hardcodes no provider copy).

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist;
// glyphs are irrelevant to this contract, so stub it (plan.test.tsx precedent).
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { COMPARE_LABELS } from '@moajoa/core';
import { CompareFrameCard } from '@/components/booking/compare-frame-card';

function makeRows() {
  return [
    { providerName: 'Klook', labelKo: COMPARE_LABELS.klook, onView: jest.fn() },
    { providerName: 'KKday', labelKo: COMPARE_LABELS.kkday, onView: jest.fn() },
  ];
}

describe('CompareFrameCard — full variant (D-06 비교 구도)', () => {
  it('renders header title + both provider rows with injected labels + a [보기] per row', () => {
    const rows = makeRows();
    const { getByText, getAllByText } = render(
      <CompareFrameCard
        variant="full"
        icon="ticket-outline"
        title="액티비티 예약"
        caption="도쿄 · 08.01–08.05"
        rows={rows}
      />,
    );
    expect(getByText('액티비티 예약')).toBeTruthy();
    expect(getByText('도쿄 · 08.01–08.05')).toBeTruthy();
    expect(getByText('Klook')).toBeTruthy();
    expect(getByText('KKday')).toBeTruthy();
    expect(getByText(COMPARE_LABELS.klook)).toBeTruthy();
    expect(getByText(COMPARE_LABELS.kkday)).toBeTruthy();
    expect(getAllByText('보기')).toHaveLength(2);
  });

  it("[보기] press fires that row's onView only — component stays URL-blind", () => {
    const rows = makeRows();
    const { getByLabelText } = render(
      <CompareFrameCard variant="full" icon="ticket-outline" title="액티비티 예약" rows={rows} />,
    );
    fireEvent.press(getByLabelText('Klook에서 보기'));
    expect(rows[0]!.onView).toHaveBeenCalledTimes(1);
    expect(rows[1]!.onView).not.toHaveBeenCalled();
  });

  it('renders a single row when rows has 1 entry (유심/교통 single-provider shape)', () => {
    const onView = jest.fn();
    const { getAllByText, getByText } = render(
      <CompareFrameCard
        variant="full"
        icon="cellular-outline"
        title="여행 유심"
        rows={[{ providerName: 'Airalo', labelKo: COMPARE_LABELS.airalo, onView }]}
      />,
    );
    expect(getByText('Airalo')).toBeTruthy();
    expect(getAllByText('보기')).toHaveLength(1);
  });

  it('hides the affiliate disclosure by default and shows it when footerVisible (D-16)', () => {
    const rows = makeRows();
    const hidden = render(
      <CompareFrameCard variant="full" icon="ticket-outline" title="액티비티 예약" rows={rows} />,
    );
    expect(hidden.queryByText('예약 시 수수료를 받을 수 있어요')).toBeNull();

    const shown = render(
      <CompareFrameCard
        variant="full"
        icon="ticket-outline"
        title="액티비티 예약"
        rows={makeRows()}
        footerVisible
      />,
    );
    expect(shown.getByText('예약 시 수수료를 받을 수 있어요')).toBeTruthy();
  });
});

describe('CompareFrameCard — compact variant (plan-tab strip)', () => {
  it("renders the '예약 비교' label + per-provider mini [보기] buttons", () => {
    const rows = makeRows();
    const { getByText, getAllByText } = render(
      <CompareFrameCard variant="compact" rows={rows} />,
    );
    expect(getByText('예약 비교')).toBeTruthy();
    expect(getByText('Klook')).toBeTruthy();
    expect(getByText('KKday')).toBeTruthy();
    expect(getAllByText('보기')).toHaveLength(2);
  });

  it('mini [보기] press routes to the right onView', () => {
    const rows = makeRows();
    const { getByLabelText } = render(<CompareFrameCard variant="compact" rows={rows} />);
    fireEvent.press(getByLabelText('KKday에서 보기'));
    expect(rows[1]!.onView).toHaveBeenCalledTimes(1);
    expect(rows[0]!.onView).not.toHaveBeenCalled();
  });
});
