// apps/ios/app/index.tsx
// Phase 17 (NAV-01): auth-gated 0/1/N entry branch — Phase 1 D-13 auth scaffold
// PRESERVED (getSession + onAuthStateChange). No session → /welcome. Session
// present → decideEntryRoute(trips, lastTripId): 0 trips → /onboarding (the real,
// reachable path — Plan 03 retired the auto-first-board trigger, BLOCKER 1;
// onboarding/Plan 05 owns first-trip creation), 1 → that trip's plan tab, N →
// last-viewed trip's plan tab. Renders null while resolving (UI-SPEC Screen 1).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMyTrips } from '@moajoa/api';
import { decideEntryRoute, TripKeys } from '@moajoa/core';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type Resolved =
  | { kind: 'onboarding' }
  | { kind: 'trip'; tripId: string };

export default function Index() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  // Entry route once trips load. null = still resolving, 'error' = load failed.
  const [route, setRoute] = useState<Resolved | 'error' | null>(null);
  // Bumping this re-runs the trip resolve effect (inline retry, UI-SPEC line 132).
  const [attempt, setAttempt] = useState(0);

  // Auth scaffold (Phase 1 D-13) — re-evaluates on auth changes so sign-out from
  // anywhere redirects back here.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(data.session !== null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setAuthed(session !== null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Once authed, resolve the 0/1/N entry route (NAV-01). Re-runs on retry.
  useEffect(() => {
    if (authed !== true) return;
    let mounted = true;
    setRoute(null);
    (async () => {
      try {
        const [trips, lastTripId] = await Promise.all([
          listMyTrips(supabase),
          AsyncStorage.getItem(TripKeys.LastTripId),
        ]);
        if (mounted) setRoute(decideEntryRoute(trips, lastTripId));
      } catch (err) {
        console.error(err);
        if (mounted) setRoute('error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authed, attempt]);

  if (authed === null) return null;
  if (!authed) return <Redirect href="/welcome" />;

  // Authed but trips not resolved yet — render nothing (no flash, UI-SPEC Screen 1).
  if (route === null) return null;

  if (route === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-base text-neutral-500 text-center leading-relaxed">
          여행을 불러오지 못했어요. 다시 시도해 주세요.
        </Text>
        <Pressable
          onPress={() => setAttempt((n) => n + 1)}
          className="mt-5 bg-brand-500 px-6 py-3 rounded-2xl active:opacity-90"
        >
          <Text className="text-base font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (route.kind === 'onboarding') return <Redirect href="/onboarding" />;
  return <Redirect href={`/trip/${route.tripId}/plan`} />;
}
