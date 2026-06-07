import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { MeContent } from './_components/me-content';

export default async function MePage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login');

  // OAuth (e.g. Google) populates these; fall back gracefully otherwise.
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '사용자';
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;

  return <MeContent name={name} email={user.email ?? ''} avatarUrl={avatarUrl} />;
}
