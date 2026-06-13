import 'react-native-gesture-handler';
import '../global.css';
import '@/lib/fonts'; // Pretendard app-wide default — must run before any Text renders

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { drainPendingLinks } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { ToastHost } from '@/lib/toast';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);

  // Phase 3 D-04: drain on cold launch AND on every AppState 'active' transition.
  // The module-level guard in pending.ts also blocks concurrency, but this local
  // ref avoids even queueing the async call when one is already running.
  const runDrain = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await drainPendingLinks();
    } catch (e) {
      console.warn('[drain] error:', e);
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Cold launch drain.
    runDrain();

    // Foreground drain.
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') runDrain();
    });
    return () => {
      // Pitfall 4: arrow-wrap sub.remove() so `this` binding on the emitter
      // is preserved during hot reload + unmount.
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
