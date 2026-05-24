import 'react-native-gesture-handler';
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
