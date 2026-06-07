// Unit tests for OnboardCard (Plan 05-06, ONBOARD-02, D-19).
//
// Contract for [id].tsx wiring:
// - Both Korean copy lines render (headline + body).
// - The 💡 emoji icon renders (zero-dep visual signal per UI-SPEC default).
// - The amber palette tokens (bg-amber-50 / border-amber-200) are present on
//   the root — design contract from UI-SPEC §"Component States" 6.
// - Tapping the × button invokes onDismiss exactly once.

import { fireEvent, render } from '@testing-library/react-native';
import { OnboardCard } from '@/components/boards/onboard-card';

describe('OnboardCard', () => {
  test('renders both Korean copy lines + 💡 icon', () => {
    const { getByText } = render(<OnboardCard onDismiss={() => {}} />);
    expect(getByText('유튜브 링크를 붙여넣어 보세요')).toBeTruthy();
    expect(getByText('영상 속 장소가 30초 안에 지도로 떠요')).toBeTruthy();
    expect(getByText('💡')).toBeTruthy();
  });

  test('root view uses amber-50/amber-200 palette tokens (UI-SPEC §6)', () => {
    const { getByText } = render(<OnboardCard onDismiss={() => {}} />);
    // The headline Text is nested inside a flex-1 wrapper inside the root
    // amber View. Walk up via parent until we hit a className containing the
    // amber background — the root.
    let node: any = getByText('유튜브 링크를 붙여넣어 보세요');
    let amberClass: string | undefined;
    while (node) {
      const cls = node.props?.className as string | undefined;
      if (cls && cls.includes('bg-amber-50')) {
        amberClass = cls;
        break;
      }
      node = node.parent;
    }
    expect(amberClass).toBeDefined();
    expect(amberClass).toContain('bg-amber-50');
    expect(amberClass).toContain('border-amber-200');
    expect(amberClass).toContain('mx-6');
    expect(amberClass).toContain('mb-3');
  });

  test('tapping × invokes onDismiss exactly once', () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(<OnboardCard onDismiss={onDismiss} />);
    const closeBtn = getByLabelText('안내 카드 닫기');
    fireEvent.press(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
