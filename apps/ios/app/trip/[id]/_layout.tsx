// apps/ios/app/trip/[id]/_layout.tsx
// Phase 17 (NAV-03): trip-scoped Stack. The custom header (TripHeader) is owned
// by THIS Stack; the bottom tab bar is owned by the nested (tabs)/_layout. Never
// both in one layout, never double-nested (tabs) (RESEARCH Pitfall 1 — mixing
// makes the tab bar vanish).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TripKeys } from '@moajoa/core';
import { Stack, useGlobalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import TripHeader from './header';

export default function TripLayout() {
  const { id } = useGlobalSearchParams<{ id: string }>();

  // Persist last-viewed trip here — the single cleanest place for the NAV-01
  // N-case restore (index.tsx reads TripKeys.LastTripId on next cold launch).
  useEffect(() => {
    if (id) void AsyncStorage.setItem(TripKeys.LastTripId, id);
  }, [id]);

  return (
    <Stack screenOptions={{ header: () => <TripHeader tripId={id} /> }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
