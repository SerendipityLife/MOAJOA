// RNTL test for the 플랜 tab (Plan 18-05 app/trip/[id]/(tabs)/plan.tsx).
//
// Why: plan.tsx is a State-machine screen (A empty / B pre-gen button / C
// generating / D draft / F error). The contract that matters:
//   1. State A — no places → 아직 플랜이 없어요 (the shipped stub, verbatim).
//   2. State B — places exist, no draft plan → the 플랜 만들기 button renders.
//   3. Tapping 플랜 만들기 calls generatePlan (D-01: user-triggered, never auto;
//      the initial load NEVER calls generatePlan).
//   4. State D — a draft plan → the 초안 chip + a Day header render.
//
// We mock @moajoa/api (queries), @/lib/realtime (broadcast), @/lib/toast,
// @/lib/share-board, and expo-router so the SUT renders headlessly.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React, { act } from 'react';

jest.mock('@moajoa/api', () => ({
  generatePlan: jest.fn().mockResolvedValue({
    plan_id: 'plan-1',
    day_count: 1,
    placed_count: 0,
    unplaced_count: 0,
  }),
  getTrip: jest.fn(),
  listPlacesByTrip: jest.fn(),
  getPlanByTrip: jest.fn(),
  reorderPlanItem: jest.fn(),
  setTravelMode: jest.fn(),
  moveToPool: jest.fn(),
  moveToDay: jest.fn(),
  setAnchor: jest.fn(),
  setCollaborative: jest.fn(),
}));

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist;
// the icon glyph is irrelevant to this screen's behavior, so stub it.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// Reanimated 4 / gesture-handler need native worklets at import time, which
// jest can't initialize. The DaySection drag uses them only for the visual
// lift transform — the reorder LOGIC is exercised on device (Task 3 UAT), so
// mocking the animation primitives is sufficient for this render-contract test.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    runOnJS: (fn: unknown) => fn,
  };
});
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const chain = {
        activateAfterLongPress: () => chain,
        onStart: () => chain,
        onUpdate: () => chain,
        onEnd: () => chain,
      };
      return chain;
    },
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/lib/realtime', () => ({
  subscribePlanProgress: jest.fn(() => ({ name: 'plan:trip-1' })),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { removeChannel: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));
jest.mock('@/lib/share-board', () => ({ shareCurrentTrip: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'trip-1' }),
}));

import TripPlanScreen from '@/app/trip/[id]/(tabs)/plan';
import * as api from '@moajoa/api';

const generatePlan = api.generatePlan as jest.Mock;
const getTrip = api.getTrip as jest.Mock;
const listPlacesByTrip = api.listPlacesByTrip as jest.Mock;
const getPlanByTrip = api.getPlanByTrip as jest.Mock;

const TRIP = {
  id: 'trip-1',
  start_date: '2026-07-01',
  end_date: '2026-07-01',
  title: 'Tokyo',
};
const PLACE = {
  id: 'place-1',
  name_ko: '시부야',
  name_local: 'Shibuya',
  category: 'culture',
  address: 'Tokyo',
  lat: 35.6,
  lng: 139.7,
};

beforeEach(() => {
  generatePlan.mockClear();
  getTrip.mockResolvedValue(TRIP);
  listPlacesByTrip.mockResolvedValue([]);
  getPlanByTrip.mockResolvedValue(null);
});

test('State A: renders 아직 플랜이 없어요 when there are no places', async () => {
  listPlacesByTrip.mockResolvedValue([]);
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('아직 플랜이 없어요')).toBeTruthy());
  expect(generatePlan).not.toHaveBeenCalled();
});

test('State B: renders the 플랜 만들기 button when places exist but no draft plan', async () => {
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue(null);
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('장소가 모였어요')).toBeTruthy());
  expect(getByText('플랜 만들기')).toBeTruthy();
  // D-01: the initial load must NOT auto-generate.
  expect(generatePlan).not.toHaveBeenCalled();
});

test('tapping 플랜 만들기 calls generatePlan (D-01 user-triggered)', async () => {
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue(null);
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('플랜 만들기')).toBeTruthy());
  await act(async () => {
    fireEvent.press(getByText('플랜 만들기'));
  });
  expect(generatePlan).toHaveBeenCalledTimes(1);
  expect(generatePlan).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ trip_id: 'trip-1', anchor_place_ids: [] }),
  );
});

test('State D: a draft plan renders the 초안 chip and a Day header', async () => {
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue({
    id: 'plan-1',
    trip_id: 'trip-1',
    status: 'draft',
    travel_mode: 'transit',
    collaborative: false,
    plan_items: [
      {
        id: 'item-1',
        plan_id: 'plan-1',
        place_id: 'place-1',
        day_index: 0,
        sort_order: 0,
        leg_travel_seconds: null,
        is_anchor: false,
      },
    ],
  });
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('초안')).toBeTruthy());
  expect(getByText('Day 1')).toBeTruthy();
  expect(getByText('시부야')).toBeTruthy();
});
