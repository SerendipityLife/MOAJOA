// Share the current trip (v1.3 / Phase 14-04, repointed to trip vocab in 17-04).
//
// Flips the trip to 'shared' (server generates share_slug on first share) and
// opens the native share sheet with the public /b/{slug} URL so friends can vote
// on web without an app. The "빠진 다리": iOS extraction → web voting.

import { shareTrip } from '@moajoa/api';
import Constants from 'expo-constants';
import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function shareCurrentTrip(tripId: string): Promise<void> {
  const slug = await shareTrip(supabase, tripId);
  const base =
    (Constants.expoConfig?.extra?.webUrl as string | undefined)?.replace(/\/+$/, '') ??
    'https://moajoa.app';
  const url = `${base}/b/${slug}`;
  await Share.share({
    message: `MOAJOA에서 같이 정해요! 영상 속 장소를 모아 투표해요 👇\n${url}`,
  });
}
