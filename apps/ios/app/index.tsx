// apps/ios/app/index.tsx
// Phase 3 (SAVE-01): auth-gated redirect — Phase 1 D-13 restoration.
// Session present → /(tabs)/boards. No session → /login. Re-evaluates on
// auth state changes so sign-out from anywhere redirects back here.
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const [authed, setAuthed] = useState<boolean | null>(null);

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

  if (authed === null) return null;
  return authed ? <Redirect href="/(tabs)/boards" /> : <Redirect href="/welcome" />;
}
