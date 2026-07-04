// RNTL test for the 예약 tab (Plan 20-07 app/trip/[id]/(tabs)/book.tsx).
//
// Why: book.tsx is a State-machine screen (loading / error / empty-dateless /
// empty-no-plan / active list + add-sheet). The contract that matters (BOOK-02):
//   1. dateless trip → 일정이 정해지면 예약을 시작할 수 있어요 (D-04).
//   2. dated + no draft plan → 먼저 플랜을 만들어주세요 + 플랜 탭으로 가기 (D-04).
//   3. active → 예약 체크리스트 title + progress caption + derived auto rows.
//   4. clicked row → '확인함' badge + the quiet inline hint (D-11/D-15).
//   5. 항목 추가 tap → the 예약 항목 추가 sheet content mounts (D-10).
//
// Mock harness copied from plan.test.tsx (18-05/20-06 precedent): @moajoa/api
// queries, @/lib/booking (system-Safari handlers), icons + bottom-sheet stubs.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@moajoa/api', () => ({
  getTrip: jest.fn(),
  listPlacesByTrip: jest.fn(),
  getPlanByTrip: jest.fn(),
  listChecklist: jest.fn(),
  listClickedChecklistItemIds: jest.fn(),
  reconcileChecklist: jest.fn(),
  addManualItem: jest.fn(),
  setItemStatus: jest.fn(),
  deleteChecklistItem: jest.fn(),
}));

// The click handlers open system Safari + read env; both are out of scope for
// this render-contract test, so stub the whole lib (plan.test.tsx precedent).
jest.mock('@/lib/booking', () => ({
  openBooking: jest.fn(),
  openDirectSearch: jest.fn(),
  kkdayAvailable: jest.fn(() => true),
}));

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// @gorhom/bottom-sheet pulls in reanimated worklets at import time, which jest
// can't initialize (18-05 precedent). Sheet content is gated on addOpen inside
// BottomSheetView, so a pass-through stub still exercises the open contract.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(
    ({ children }: { children: React.ReactNode }, _ref: unknown) => <View>{children}</View>,
  );
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  },
}));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'trip-1' }),
  router: { push: jest.fn() },
}));

import TripBookScreen from '@/app/trip/[id]/(tabs)/book';
import * as api from '@moajoa/api';

const getTrip = api.getTrip as jest.Mock;
const listPlacesByTrip = api.listPlacesByTrip as jest.Mock;
const getPlanByTrip = api.getPlanByTrip as jest.Mock;
const listChecklist = api.listChecklist as jest.Mock;
const listClickedChecklistItemIds = api.listClickedChecklistItemIds as jest.Mock;
const reconcileChecklist = api.reconcileChecklist as jest.Mock;

const TOKYO_TRIP = {
  id: 'trip-1',
  title: 'Tokyo',
  city_code: 'tokyo',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
};
const DATELESS_TRIP = { ...TOKYO_TRIP, start_date: null, end_date: null };

// Empty draft plan — enough to pass the D-04 gate (plan !== null).
const DRAFT_PLAN = {
  id: 'plan-1',
  trip_id: 'trip-1',
  status: 'draft',
  travel_mode: 'transit',
  collaborative: false,
  plan_items: [],
};

function checklistItem(over: Record<string, unknown> = {}) {
  return {
    id: 'cl-stay',
    trip_id: 'trip-1',
    place_id: null,
    kind: 'stay',
    title: '숙소 예약',
    status: 'todo',
    source: 'auto',
    ...over,
  };
}

// The full tokyo auto set — matches the derivation exactly, so reconcile no-ops.
const TOKYO_CHECKLIST = [
  checklistItem(),
  checklistItem({ id: 'cl-esim', kind: 'esim', title: '여행 유심' }),
  checklistItem({ id: 'cl-tr', kind: 'transport', title: 'JR 패스' }),
];

beforeEach(() => {
  getTrip.mockResolvedValue(TOKYO_TRIP);
  listPlacesByTrip.mockResolvedValue([]);
  getPlanByTrip.mockResolvedValue(DRAFT_PLAN);
  listChecklist.mockResolvedValue(TOKYO_CHECKLIST);
  listClickedChecklistItemIds.mockResolvedValue(new Set());
  reconcileChecklist.mockClear();
  reconcileChecklist.mockResolvedValue(undefined);
});

test('dateless trip: renders the 날짜 미정 empty state (D-04)', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  const { getByText, queryByText } = render(<TripBookScreen />);
  await waitFor(() => expect(getByText('일정이 정해지면 예약을 시작할 수 있어요')).toBeTruthy());
  expect(getByText('날짜 투표가 끝나면 예약 체크리스트가 열려요.')).toBeTruthy();
  expect(queryByText('예약 체크리스트')).toBeNull();
});

test('dated + no draft plan: renders 먼저 플랜을 만들어주세요 + the 플랜 탭 link (D-04)', async () => {
  getPlanByTrip.mockResolvedValue(null);
  const { getByText, queryByText } = render(<TripBookScreen />);
  await waitFor(() => expect(getByText('먼저 플랜을 만들어주세요')).toBeTruthy());
  expect(getByText('플랜 탭으로 가기')).toBeTruthy();
  expect(queryByText('예약 체크리스트')).toBeNull();
});

test('active: 예약 체크리스트 title + progress caption + derived auto rows render', async () => {
  const { getByText } = render(<TripBookScreen />);
  await waitFor(() => expect(getByText('예약 체크리스트')).toBeTruthy());
  expect(getByText('0/3 완료')).toBeTruthy();
  expect(getByText('숙소 예약')).toBeTruthy();
  expect(getByText('여행 유심')).toBeTruthy();
  expect(getByText('JR 패스')).toBeTruthy();
});

test("clicked row: '확인함' badge + the quiet inline hint render (D-11/D-15)", async () => {
  listChecklist.mockResolvedValue([
    checklistItem({ status: 'clicked' }),
    ...TOKYO_CHECKLIST.slice(1),
  ]);
  const { getByText } = render(<TripBookScreen />);
  await waitFor(() => expect(getByText('확인함')).toBeTruthy());
  expect(getByText('예약했으면 체크해주세요')).toBeTruthy();
});

test('항목 추가 tap opens the 예약 항목 추가 sheet (D-10)', async () => {
  const { getByText, queryByText } = render(<TripBookScreen />);
  await waitFor(() => expect(getByText('항목 추가')).toBeTruthy());
  // Sheet content is gated on addOpen — hidden until the button is tapped.
  expect(queryByText('예약 항목 추가')).toBeNull();
  fireEvent.press(getByText('항목 추가'));
  expect(getByText('예약 항목 추가')).toBeTruthy();
  expect(getByText('추가하기')).toBeTruthy();
});
