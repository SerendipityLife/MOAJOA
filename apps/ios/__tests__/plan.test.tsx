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
  // Phase 19 date-poll wrappers (only fire on the dateless management branch).
  getPollByTrip: jest.fn(),
  getPollTally: jest.fn(),
  setPollMode: jest.fn(),
  confirmPollDate: jest.fn(),
  getPollOptions: jest.fn(),
  addPollOption: jest.fn(),
  removePollOption: jest.fn(),
  // Phase 20 booking checklist wrappers (plan-tab cluster wiring).
  listChecklist: jest.fn(),
  reconcileChecklist: jest.fn(),
}));

// Phase 20 — the click handlers open system Safari + read env; both are out of
// scope for this render-contract test, so stub the whole lib. kkdayAvailable
// true keeps the KKday mini button visible in the 예약 비교 strip cases.
jest.mock('@/lib/booking', () => ({
  openBooking: jest.fn(),
  openDirectSearch: jest.fn(),
  kkdayAvailable: jest.fn(() => true),
}));

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist;
// the icon glyph is irrelevant to this screen's behavior, so stub it.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// @gorhom/bottom-sheet pulls in react-native-reanimated worklets at import time,
// which jest can't initialize (same constraint as the gesture/reanimated mocks
// below; 18-05 precedent). The confirm-sheet interaction is exercised on device
// (Task 3 UAT) — here we only assert the management-card render contract, so a
// pass-through stub of the sheet primitives is sufficient.
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
  subscribePollChannel: jest.fn(() => ({ name: 'poll:trip-1' })),
}));
// The candidate-window picker is a device-driven sheet (Task 3 UAT); stub it so
// this render-contract test doesn't pull in the calendar/Modal internals.
jest.mock('@/components/boards/date-picker-sheet', () => ({
  DatePickerSheet: () => null,
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    removeChannel: jest.fn(),
    // Phase 20: load() reads the auth user for click attribution (bookingCtx).
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  },
}));
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
const getPollByTrip = api.getPollByTrip as jest.Mock;
const getPollTally = api.getPollTally as jest.Mock;
const getPollOptions = api.getPollOptions as jest.Mock;
const listChecklist = api.listChecklist as jest.Mock;
const reconcileChecklist = api.reconcileChecklist as jest.Mock;

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

// A dateless trip (no start_date) → the Phase 19 management card branch.
const DATELESS_TRIP = { id: 'trip-1', start_date: null, end_date: null, title: 'Tokyo' };

beforeEach(() => {
  generatePlan.mockClear();
  getTrip.mockResolvedValue(TRIP);
  listPlacesByTrip.mockResolvedValue([]);
  getPlanByTrip.mockResolvedValue(null);
  getPollByTrip.mockResolvedValue(null);
  getPollTally.mockResolvedValue({ mode: 'grid', status: 'open', tally: [] });
  getPollOptions.mockResolvedValue([]);
  listChecklist.mockResolvedValue([]);
  reconcileChecklist.mockResolvedValue(undefined);
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

// --- Phase 19: 날짜 투표 management card (D-05 dateless branch) -----------------

test('dateless + open poll renders the 날짜 투표 management card with the empty-state summary', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'grid',
    status: 'open',
  });
  getPollTally.mockResolvedValue({ mode: 'grid', status: 'open', tally: [] });
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('날짜 투표 진행 중')).toBeTruthy());
  expect(getByText('아직 아무도 투표하지 않았어요')).toBeTruthy();
  // Mode toggle (D-07) + share + confirm affordances are present.
  expect(getByText('범위형')).toBeTruthy();
  expect(getByText('그리드')).toBeTruthy();
  expect(getByText('초대 링크 복사')).toBeTruthy();
  expect(getByText('확정')).toBeTruthy();
});

test('with votes the summary line shows 참여 {N}명 + 최다 후보', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'grid',
    status: 'open',
  });
  getPollTally.mockResolvedValue({
    mode: 'grid',
    status: 'open',
    tally: [
      { vote_date: '2026-07-01', available_count: 2, nicknames: ['윤', '소'] },
      { vote_date: '2026-07-02', available_count: 1, nicknames: ['윤'] },
    ],
  });
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('참여 2명 · 최다 후보 2026-07-01')).toBeTruthy());
});

test('range poll with no candidates: shows the empty-candidate hint + gates sharing (GAP-19A)', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'range',
    status: 'open',
  });
  getPollTally.mockResolvedValue({ mode: 'range', status: 'open', tally: [] });
  getPollOptions.mockResolvedValue([]);
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('날짜 투표 진행 중')).toBeTruthy());
  expect(getByText('후보 날짜')).toBeTruthy();
  expect(getByText('투표할 후보 날짜를 2개 이상 추가해주세요')).toBeTruthy();
  expect(getByText('후보 날짜 추가')).toBeTruthy();
  // Share is gated until ≥2 candidates exist.
  expect(getByText('후보 날짜를 2개 이상 추가하면 친구를 초대할 수 있어요')).toBeTruthy();
});

test('range poll with ≥2 candidates: lists them + lifts the share gate (GAP-19A)', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'range',
    status: 'open',
  });
  getPollTally.mockResolvedValue({ mode: 'range', status: 'open', tally: [] });
  getPollOptions.mockResolvedValue([
    { id: 'o1', start_date: '2026-04-03', end_date: '2026-04-05' },
    { id: 'o2', start_date: '2026-04-10', end_date: '2026-04-12' },
  ]);
  const { getByText, queryByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('2026-04-03 ~ 2026-04-05')).toBeTruthy());
  expect(getByText('2026-04-10 ~ 2026-04-12')).toBeTruthy();
  expect(queryByText('후보 날짜를 2개 이상 추가하면 친구를 초대할 수 있어요')).toBeNull();
});

test('a closed poll does NOT render the management card (card unmounts after 확정)', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  listPlacesByTrip.mockResolvedValue([]);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'grid',
    status: 'closed',
  });
  const { queryByText, getByText } = render(<TripPlanScreen />);
  // Falls through to State A (no places) — the management card never shows.
  await waitFor(() => expect(getByText('아직 플랜이 없어요')).toBeTruthy());
  expect(queryByText('날짜 투표 진행 중')).toBeNull();
});

// --- Phase 20: 여행 준비 booking cluster + 예약 비교 strip (D-04/D-08/D-09) ----

const TOKYO_TRIP = { ...TRIP, city_code: 'tokyo' };
const SEOUL_TRIP = { ...TRIP, city_code: 'seoul' };

// One-item draft plan placing `placeId` on Day 1 (State D shape).
function draftPlanWith(placeId: string) {
  return {
    id: 'plan-1',
    trip_id: 'trip-1',
    status: 'draft',
    travel_mode: 'transit',
    collaborative: false,
    plan_items: [
      {
        id: 'item-1',
        plan_id: 'plan-1',
        place_id: placeId,
        day_index: 0,
        sort_order: 0,
        leg_travel_seconds: null,
        is_anchor: false,
      },
    ],
  };
}

test('dated + draft plan + tokyo renders the 여행 준비 cluster (stay card + esim + transport rows)', async () => {
  getTrip.mockResolvedValue(TOKYO_TRIP);
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue(draftPlanWith(PLACE.id));
  const { getByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('여행 준비')).toBeTruthy());
  expect(getByText('숙소 예약')).toBeTruthy();
  expect(getByText('여행 유심')).toBeTruthy();
  expect(getByText('JR 패스')).toBeTruthy();
});

test('uncovered city (seoul): cluster renders WITHOUT esim/transport rows — not disabled, absent (D-09)', async () => {
  getTrip.mockResolvedValue(SEOUL_TRIP);
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue(draftPlanWith(PLACE.id));
  const { getByText, queryByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('여행 준비')).toBeTruthy());
  expect(getByText('숙소 예약')).toBeTruthy();
  expect(queryByText('여행 유심')).toBeNull();
  expect(queryByText('JR 패스')).toBeNull();
});

test('no draft plan (State B): the 여행 준비 cluster does not render (D-04)', async () => {
  getTrip.mockResolvedValue(TOKYO_TRIP);
  listPlacesByTrip.mockResolvedValue([PLACE]);
  getPlanByTrip.mockResolvedValue(null);
  const { getByText, queryByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('장소가 모였어요')).toBeTruthy());
  expect(queryByText('여행 준비')).toBeNull();
});

test('dateless + open poll: management card renders and the cluster stays off (mutual exclusion)', async () => {
  getTrip.mockResolvedValue(DATELESS_TRIP);
  getPollByTrip.mockResolvedValue({
    id: 'poll-1',
    poll_code: 'abcd1234',
    mode: 'grid',
    status: 'open',
  });
  const { getByText, queryByText } = render(<TripPlanScreen />);
  await waitFor(() => expect(getByText('날짜 투표 진행 중')).toBeTruthy());
  expect(queryByText('여행 준비')).toBeNull();
  expect(queryByText('예약 비교')).toBeNull();
});

test('예약 비교 strip renders under bookable items only — never under 맛집 (D-08)', async () => {
  const attraction = {
    ...PLACE,
    id: 'place-a',
    name_ko: '센소지',
    category: 'tourist_attraction',
  };
  getTrip.mockResolvedValue(TOKYO_TRIP);
  listPlacesByTrip.mockResolvedValue([attraction]);
  getPlanByTrip.mockResolvedValue(draftPlanWith(attraction.id));
  const positive = render(<TripPlanScreen />);
  await waitFor(() => expect(positive.getByText('예약 비교')).toBeTruthy());
  expect(positive.getByText('Klook')).toBeTruthy();
  expect(positive.getByText('KKday')).toBeTruthy();
  positive.unmount();

  const ramen = { ...PLACE, id: 'place-r', name_ko: '이치란', category: 'ramen_restaurant' };
  listPlacesByTrip.mockResolvedValue([ramen]);
  getPlanByTrip.mockResolvedValue(draftPlanWith(ramen.id));
  const negative = render(<TripPlanScreen />);
  // The cluster still shows (dated + plan) — only the strip must be absent.
  await waitFor(() => expect(negative.getByText('여행 준비')).toBeTruthy());
  expect(negative.queryByText('예약 비교')).toBeNull();
});
