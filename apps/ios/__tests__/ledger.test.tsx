// RNTL test for the 가계부 tab (Plan 21-05 app/trip/[id]/(tabs)/ledger.tsx).
//
// Why: ledger.tsx is a state-machine screen (loading / error / empty-onboarding /
// active list) whose contract (LEDGER-01/03/06) is:
//   1. everything empty → 아직 정리된 예약이 없어요 (empty onboarding).
//   2. unassigned inbox → 어느 여행인지 확인해주세요 label + the row renders.
//   3. needs_review row 1-tap → the review sheet (결제 정보를 확인해주세요) opens.
//   4. optimistic assign that rejects → the inbox row is restored + error toast.
//
// Mock harness copied from book.test.tsx (20-07 precedent): @moajoa/api queries,
// @/lib/supabase, @/lib/toast, expo-router (BOTH useLocalSearchParams AND
// useGlobalSearchParams — the screen uses the global one for the F-20-1 fix),
// icons + bottom-sheet stubs.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { LedgerEntry, Trip } from '@moajoa/core';

jest.mock('@moajoa/api', () => ({
  getTrip: jest.fn(),
  listLedger: jest.fn(),
  listUnassignedLedger: jest.fn(),
  listNeedsReview: jest.fn(),
  listMyTrips: jest.fn(),
  assignTripToEntry: jest.fn(),
  updateLedgerEntry: jest.fn(),
  deleteLedgerEntry: jest.fn(),
}));

// @expo/vector-icons ships untranspiled ESM not in the transform allowlist.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

// @gorhom/bottom-sheet pulls in reanimated worklets at import time (jest can't
// init). Sheet content is gated on `open` inside BottomSheetView, so a
// pass-through stub still exercises the open contract (book.test.tsx precedent).
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

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/toast', () => ({ showToast: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'trip-1' }),
  useGlobalSearchParams: () => ({ id: 'trip-1' }),
  router: { push: jest.fn() },
}));

import TripLedgerScreen from '@/app/trip/[id]/(tabs)/ledger';
import * as api from '@moajoa/api';
import { showToast } from '@/lib/toast';

const getTrip = api.getTrip as jest.Mock;
const listLedger = api.listLedger as jest.Mock;
const listUnassignedLedger = api.listUnassignedLedger as jest.Mock;
const listNeedsReview = api.listNeedsReview as jest.Mock;
const listMyTrips = api.listMyTrips as jest.Mock;
const assignTripToEntry = api.assignTripToEntry as jest.Mock;

const TOKYO_TRIP = {
  id: 'trip-1',
  owner_id: 'user-1',
  representative_id: 'user-1',
  title: '도쿄 여행',
  description: null,
  visibility: 'private',
  share_slug: null,
  city_code: 'tokyo',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  cover_image_url: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
} as unknown as Trip;

function ledgerEntry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-1',
    owner_user_id: 'user-1',
    trip_id: null,
    status: 'ready',
    platform: '스타벅스',
    merchant: '스타벅스',
    card_last4: '1234',
    amount_foreign: 12.5,
    currency: 'USD',
    fx_rate: 1350,
    fx_source: 'frankfurter',
    fx_as_of: '2026-07-01',
    amount_krw: 16875,
    paid_at: '2026-07-01',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getTrip.mockResolvedValue(TOKYO_TRIP);
  listLedger.mockResolvedValue([]);
  listUnassignedLedger.mockResolvedValue([]);
  listNeedsReview.mockResolvedValue([]);
  listMyTrips.mockResolvedValue([TOKYO_TRIP]);
});

test('empty onboarding: 아직 정리된 예약이 없어요 renders when everything is empty', async () => {
  const { getByText } = render(<TripLedgerScreen />);
  await waitFor(() => expect(getByText('아직 정리된 예약이 없어요')).toBeTruthy());
  expect(getByText('내 주소 보기')).toBeTruthy();
});

test('unassigned inbox: 어느 여행인지 확인해주세요 label + the row render', async () => {
  listUnassignedLedger.mockResolvedValue([ledgerEntry()]);
  const { getByText } = render(<TripLedgerScreen />);
  await waitFor(() => expect(getByText('어느 여행인지 확인해주세요')).toBeTruthy());
  expect(getByText('스타벅스')).toBeTruthy();
  expect(getByText('미분류')).toBeTruthy();
});

test('WR-01: an email-sourced row displays the STORED amount_krw, not the re-derived value', async () => {
  // Mail billed JPY 3,400 as ₩32,000 (rate 9.41). round(3400 × 9.41) = 31,994 —
  // the '실청구' badge promises the real charge, so the stored 32,000 must win.
  const emailRow = ledgerEntry({
    fx_source: 'email',
    currency: 'JPY',
    amount_foreign: 3400,
    fx_rate: 9.41,
    amount_krw: 32000,
  });
  listUnassignedLedger.mockResolvedValue([emailRow]);
  const { getByText, queryByText } = render(<TripLedgerScreen />);
  await waitFor(() => expect(getByText('≈ ₩32,000')).toBeTruthy());
  expect(queryByText('≈ ₩31,994')).toBeNull();
});

test('needs_review row 1-tap opens the review sheet (결제 정보를 확인해주세요)', async () => {
  const review = ledgerEntry({ id: 'entry-2', status: 'needs_review', trip_id: 'trip-1' });
  listLedger.mockResolvedValue([review]);
  listNeedsReview.mockResolvedValue([review]);
  const { getByText, queryByText } = render(<TripLedgerScreen />);
  await waitFor(() => expect(getByText('확인 필요')).toBeTruthy());
  // Sheet content is gated on open — hidden until the row is tapped.
  expect(queryByText('결제 정보를 확인해주세요')).toBeNull();
  fireEvent.press(getByText('스타벅스'));
  await waitFor(() => expect(getByText('결제 정보를 확인해주세요')).toBeTruthy());
});

test('optimistic assign that rejects restores the inbox row + shows an error toast', async () => {
  listUnassignedLedger.mockResolvedValue([ledgerEntry()]);
  assignTripToEntry.mockRejectedValue(new Error('rls'));
  const { getByText } = render(<TripLedgerScreen />);
  await waitFor(() => expect(getByText('스타벅스')).toBeTruthy());
  // Open the assign sheet, then pick the trip.
  fireEvent.press(getByText('스타벅스'));
  await waitFor(() => expect(getByText('어느 여행의 예약인가요?')).toBeTruthy());
  fireEvent.press(getByText('도쿄 여행'));
  // The reject rolls back → the inbox row returns + the error toast fires.
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('배정에 실패했어요', 'error'));
  expect(getByText('스타벅스')).toBeTruthy();
});
