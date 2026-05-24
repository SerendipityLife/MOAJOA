import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Entry() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(!!data.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedIn(!!session?.user);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return signedIn ? <Redirect href="/(tabs)/boards" /> : <Redirect href="/login" />;
}
