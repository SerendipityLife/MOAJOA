import { extractChannelName, planChannelName, pollChannelName } from '@moajoa/core';
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

export interface PlanProgress {
  step: 'loading' | 'clustering' | 'routing' | 'done' | 'error';
  progress_pct?: number;
  error?: string;
}

/**
 * Phase 18 — subscribe to the trip-scoped plan:{trip_id} Realtime broadcast
 * channel that the generate-plan Edge Function emits to during AI plan
 * generation (D-02). Mirrors subscribeExtractProgress; the plan UI (State C)
 * maps the broadcast steps to PLAN_STEP_KO and reacts to done/error terminals.
 *
 * Caller MUST clean up the channel in useEffect return:
 *   const ch = subscribePlanProgress(tripId, handler);
 *   return () => { supabase.removeChannel(ch); }
 * (same leak guard as subscribeExtractProgress).
 */
export function subscribePlanProgress(
  tripId: string,
  onProgress: (p: PlanProgress) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(planChannelName(tripId))
    .on('broadcast', { event: 'progress' }, (msg) => {
      onProgress(msg.payload as PlanProgress);
    })
    .subscribe();
  return channel;
}

/**
 * One poll-channel event. The single poll:{trip_id} channel (D-11) carries
 * vote/comment broadcasts + presence; the management card (Plan 03) only
 * refetches the tally on 'vote'/'presence', while the web island (Plan 04)
 * also reacts to 'comment'.
 */
export type PollEvent =
  | { kind: 'vote'; payload: unknown }
  | { kind: 'comment'; payload: unknown }
  | { kind: 'presence'; viewers: number };

/**
 * Phase 19 — subscribe to the trip-scoped poll:{trip_id} Realtime channel.
 * Mirrors subscribePlanProgress: a thin wiring layer over supabase.channel(...).
 * One channel carries date-vote + comment broadcasts and presence (D-11).
 *
 * Caller MUST clean up the channel in useEffect return:
 *   const ch = subscribePollChannel(tripId, handler);
 *   return () => { supabase.removeChannel(ch); }
 * (same leak guard as subscribeExtractProgress / subscribePlanProgress).
 */
export function subscribePollChannel(
  tripId: string,
  onEvent: (e: PollEvent) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(pollChannelName(tripId))
    .on('broadcast', { event: 'vote' }, (msg) => onEvent({ kind: 'vote', payload: msg.payload }))
    .on('broadcast', { event: 'comment' }, (msg) =>
      onEvent({ kind: 'comment', payload: msg.payload }),
    )
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onEvent({ kind: 'presence', viewers: Object.keys(state).length });
    })
    .subscribe();
  return channel;
}
