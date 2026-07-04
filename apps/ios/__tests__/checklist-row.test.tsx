// RNTL contract tests for ChecklistRow (Plan 20-07 Task 1, UI-SPEC Screen 3 항목 2·3).
//
// The contract that matters (D-11/D-13/D-15):
//   1. status 'todo' — neutral circle, no badge, kind label sub-line.
//   2. status 'clicked' — '확인함' brand badge + the quiet inline hint
//      '예약했으면 체크해주세요' replaces the kind sub-line (D-15 — never a popup).
//   3. status 'done' — checkbox checked; tapping the status control fires
//      onToggleDone directly (no confirmation dialog — D-11 완료의 원천은 사용자).
//   4. desynced — '플랜에 없음' neutral chip (D-13, render-time computed).
//   5. expanded — children slot + '항목 삭제' render; body tap toggles expand.
//   6. delete-hide rule — source 'auto' && status 'done' hides 항목 삭제
//      (돈 쓴 기록 보존 — D-13); a manual done item keeps delete.

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist;
// glyphs are irrelevant to this contract, so stub it (plan.test.tsx precedent).
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import type { ChecklistItem } from '@moajoa/core';
import { ChecklistRow } from '@/components/booking/checklist-row';

function makeItem(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    trip_id: '22222222-2222-4222-8222-222222222222',
    place_id: null,
    kind: 'stay',
    title: '숙소 예약',
    status: 'todo',
    source: 'auto',
    ...over,
  };
}

const noop = () => {};

function renderRow(
  item: ChecklistItem,
  extra: Partial<React.ComponentProps<typeof ChecklistRow>> = {},
) {
  return render(
    <ChecklistRow
      item={item}
      onToggleDone={noop}
      onToggleExpand={noop}
      onDelete={noop}
      {...extra}
    />,
  );
}

test("todo: renders title + kind label, no '확인함' badge, checkbox unchecked", () => {
  const { getByText, queryByText, getByRole } = renderRow(makeItem());
  expect(getByText('숙소 예약')).toBeTruthy();
  expect(getByText('숙소')).toBeTruthy(); // kind label sub-line
  expect(queryByText('확인함')).toBeNull();
  expect(queryByText('예약했으면 체크해주세요')).toBeNull();
  const checkbox = getByRole('checkbox');
  expect(checkbox.props.accessibilityState.checked).toBe(false);
});

test("clicked: '확인함' badge + the quiet hint replaces the kind sub-line (D-15)", () => {
  const { getByText, queryByText } = renderRow(makeItem({ status: 'clicked' }));
  expect(getByText('확인함')).toBeTruthy();
  expect(getByText('예약했으면 체크해주세요')).toBeTruthy();
  expect(queryByText('숙소')).toBeNull(); // hint replaced the kind label
});

test('done: checkbox checked; tapping the status control fires onToggleDone with NO dialog (D-11)', () => {
  const onToggleDone = jest.fn();
  const { getByRole } = renderRow(makeItem({ status: 'done' }), { onToggleDone });
  const checkbox = getByRole('checkbox');
  expect(checkbox.props.accessibilityState.checked).toBe(true);
  fireEvent.press(checkbox);
  expect(onToggleDone).toHaveBeenCalledTimes(1);
});

test("desynced: '플랜에 없음' neutral chip renders only when desynced (D-13)", () => {
  const item = makeItem({ kind: 'activity', title: '센소지' });
  const off = renderRow(item);
  expect(off.queryByText('플랜에 없음')).toBeNull();
  off.unmount();

  const on = renderRow(item, { desynced: true });
  expect(on.getByText('플랜에 없음')).toBeTruthy();
});

test('expanded: children slot + 항목 삭제 render; delete fires onDelete; body tap toggles expand', () => {
  const onDelete = jest.fn();
  const onToggleExpand = jest.fn();
  const collapsed = renderRow(makeItem(), { onToggleExpand });
  expect(collapsed.queryByText('항목 삭제')).toBeNull();
  fireEvent.press(collapsed.getByLabelText('항목 펼치기'));
  expect(onToggleExpand).toHaveBeenCalledTimes(1);
  collapsed.unmount();

  const { getByText } = renderRow(makeItem(), {
    expanded: true,
    onDelete,
    children: <Text>임베디드 비교 카드</Text>,
  });
  expect(getByText('임베디드 비교 카드')).toBeTruthy();
  fireEvent.press(getByText('항목 삭제'));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("delete-hide rule: auto+done hides 항목 삭제 (돈 쓴 기록 보존), manual done keeps it (D-13)", () => {
  const autoDone = renderRow(makeItem({ status: 'done', source: 'auto' }), { expanded: true });
  expect(autoDone.queryByText('항목 삭제')).toBeNull();
  autoDone.unmount();

  const manualDone = renderRow(
    makeItem({ kind: 'custom', source: 'manual', status: 'done', title: '항공권' }),
    { expanded: true },
  );
  expect(manualDone.getByText('항목 삭제')).toBeTruthy();
});
