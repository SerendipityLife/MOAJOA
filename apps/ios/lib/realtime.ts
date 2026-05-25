import { extractChannelName } from '@moajoa/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface ExtractProgress {
  step: 'metadata' | 'transcript' | 'llm' | 'places' | 'done' | 'error';
  progress_pct?: number;
  places_extracted?: number;
  error?: string;
}

/**
 * Subscribe to the extract:{link_id} Realtime broadcast channel that Phase 2's
 * extract-youtube Edge Function emits to. Per Phase 3 D-10, Phase 3 UI ONLY
 * reacts to 'done' / 'error' steps (spinner + toast). Intermediate steps
 * are still delivered to onProgress, but the UI ignores them; Phase 5 Trust UI
 * will surface the 5-step messages.
 *
 * Caller MUST clean up the channel in useEffect return:
 *   const ch = subscribeExtractProgress(linkId, handler);
 *   return () => { supabase.removeChannel(ch); }
 * (Pitfall 5 — leak across link.id changes.)
 */
export function subscribeExtractProgress(
  linkId: string,
  onProgress: (p: ExtractProgress) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(extractChannelName(linkId))
    .on('broadcast', { event: 'progress' }, (msg) => {
      onProgress(msg.payload as ExtractProgress);
    })
    .subscribe();
  return channel;
}
