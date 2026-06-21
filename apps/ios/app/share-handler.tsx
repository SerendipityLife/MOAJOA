// apps/ios/app/share-handler.tsx
// Phase 16, D-05 "A안" — piece 2 of 2: the MOUNTED handler (has auth + Supabase).
// Reads the App Group share payload (event-based via expo-share-intent provider —
// reader ONLY, NOT B안 auto-navigation), Zod-validates the URL (V5), decides the
// route (decideShareRoute), then enqueues-and-lingers (D-02) OR auto-adds +
// startExtraction + navigates so the pin visibly forms (D-03). 2+ trips → picker.
// (17-04: repointed to trip vocab — /trip/{id}/plan, listMyTrips, TripPickerSheet.)
//
// The async decision body is exported as `handleSharedUrl` so it unit-tests
// directly (testable seam) — the effect below is a thin caller.
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMyTrips, addLink } from '@moajoa/api';
import { detectSourceKind, TripKeys } from '@moajoa/core';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { enqueuePendingLink } from '@/lib/pending';
import { startExtraction } from '@/lib/extraction-store';
import { decideShareRoute, extractSharedUrl } from '@/lib/share-routing';
import { TripPickerSheet } from '@/components/boards/trip-picker-sheet';

/**
 * Add the shared url to the chosen trip and navigate so the pin visibly forms
 * (D-03). The SINGLE source of the add+extract+navigate behavior — both the auto
 * branch (1 trip) and the picker select (2+ trips) call it, so the two paths
 * cannot drift (Karpathy §3.2). `url` has already been V5-validated upstream.
 *
 * NOTE: addLink's `LinkAdd` input field is still named `board_id` (the api maps
 * it onto the trip_id DB column; the core field rename is owned by a later plan).
 */
export async function addAndNavigate(tripId: string, url: string): Promise<void> {
  const link = await addLink(supabase, { board_id: tripId, url });
  await AsyncStorage.setItem(TripKeys.LastTripId, tripId);
  const kind = detectSourceKind(link.url);
  if (kind !== null && kind !== 'manual') {
    startExtraction({ linkId: link.id, boardId: tripId, boardTitle: null });
  }
  router.replace(`/trip/${tripId}/plan`);
}

/**
 * Decide what to do with a freshly-shared URL and act on it (Phase 16 core).
 * V5-guards the URL, awaits auth (Pitfall 4 — launch-from-share races auth
 * bootstrap), then routes: linger (D-02), auto-add + startExtraction + navigate
 * (D-03), or picker (2+ trips). Returns early (no-op) for non-http(s) input so
 * nothing is ever enqueued/added.
 */
export async function handleSharedUrl(
  rawUrl: string | null | undefined,
  onPicker?: (url: string) => void,
): Promise<void> {
  const url = extractSharedUrl(rawUrl); // V5 guard
  if (!url) return;

  // Pitfall 4: await the session before deciding so an authed 1-trip user
  // never wrongly lingers because auth hadn't resolved yet.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const trips = session ? await listMyTrips(supabase) : [];
  const route = decideShareRoute(!!session, trips.length, trips[0]?.id ?? null);

  if (route.kind === 'linger') {
    await enqueuePendingLink(url, null); // D-02 reuse AS-IS
    router.replace('/');
  } else if (route.kind === 'auto') {
    await addAndNavigate(route.tripId, url); // D-03 (shared path)
  } else {
    // route.kind === 'picker' (D-04): 2+ trips. Hold the validated url in screen
    // state and open the in-app TripPickerSheet. Do NOT add or linger here —
    // addAndNavigate runs on select (same path as auto).
    onPicker?.(url);
  }
}

export default function ShareHandler() {
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const handled = useRef(false); // dedup within this mount (Pitfall 2 / clear-after-read)
  // D-04: when the route is 'picker', the validated url is held here and drives
  // the TripPickerSheet open. Null = sheet closed (but it stays MOUNTED — Pitfall 6).
  const [pickerUrl, setPickerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!shareIntent?.webUrl || handled.current) return;
    handled.current = true;
    handleSharedUrl(shareIntent.webUrl, setPickerUrl).finally(() => {
      resetShareIntent(); // dedup: clear the App Group key so the share never re-fires
    });
  }, [shareIntent?.webUrl, resetShareIntent]);

  function onPickTrip(tripId: string) {
    if (!pickerUrl) return;
    void addAndNavigate(tripId, pickerUrl); // same path as auto branch
    setPickerUrl(null);
  }

  // Brief loading state while we decide (launch-from-share has no other UI yet).
  // TripPickerSheet stays mounted (driven by `pickerUrl`) so the FIRST open is
  // not a no-op — Pitfall 6, mirroring pin-sheet.tsx.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
      <TripPickerSheet
        url={pickerUrl}
        onSelect={onPickTrip}
        onClose={() => setPickerUrl(null)}
      />
    </View>
  );
}
