import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import LandingCarousel from './_components/landing-carousel';

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect('/moa');
  }

  return <LandingCarousel />;
}
