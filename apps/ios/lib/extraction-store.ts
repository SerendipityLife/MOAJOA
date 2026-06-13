import { triggerExtraction } from '@moajoa/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import type { Step } from '@/components/boards/step-indicator';
import { subscribeExtractProgress, type ExtractProgress } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

export interface ActiveExtraction {
  linkId: string;
  boardId: string;
  boardTitle: string | null;
  /** null = trigger fired but no broadcast step has arrived yet. */
  step: Step | null;
  startedAt: number;
}

export interface StartExtractionParams {
  linkId: string;
  boardId: string;
  boardTitle: string | null;
}

type Listener = () => void;
type CompletionListener = (boardId: string) => void;

// Module-level singletons so an extraction keeps streaming progress while the
// user navigates away from the board (the whole point of background extraction).
// Mirrors the existing toast.tsx / pending.ts module-store pattern.
const active = new Map<string, ActiveExtraction>();
const channels = new Map<string, RealtimeChannel>();
const listeners = new Set<Listener>();
const completionListeners = new Set<CompletionListener>();

// useSyncExternalStore needs a referentially-stable snapshot — recompute the
// frozen array only inside emit(), never per getSnapshot() call (else infinite loop).
let snapshot: ActiveExtraction[] = [];

function emit(): void {
  snapshot = Array.from(active.values());
  for (const l of listeners) l();
}

function notifyComplete(boardId: string): void {
  for (const l of completionListeners) l(boardId);
}

function teardown(linkId: string): void {
  const ch = channels.get(linkId);
  if (ch) {
    supabase.removeChannel(ch);
    channels.delete(linkId);
  }
  active.delete(linkId);
  emit();
}

// UI-SPEC §1 error reason mapping — broadcast 'error' payloads carry a raw error
// string; map a few known prefixes to user copy, fall back to the default.
function mapErrorReason(raw?: string): string {
  if (!raw) return '잠시 후 다시 시도';
  if (raw.includes('transcript')) return '자막이 없는 영상';
  if (raw.includes('no_place') || raw.includes('places_empty')) return '장소를 찾지 못함';
  if (raw.includes('quota') || raw.includes('429')) return '오늘 할당량 초과';
  return '잠시 후 다시 시도';
}

function handleProgress(linkId: string, p: ExtractProgress): void {
  const entry = active.get(linkId);
  if (!entry) return;

  if (p.step === 'done') {
    teardown(linkId);
    showToast(`${entry.boardTitle ?? '여행'} · ${p.places_extracted ?? 0}개 핀 추가됨`);
    notifyComplete(entry.boardId);
  } else if (p.step === 'error') {
    teardown(linkId);
    showToast(`분석 실패: ${mapErrorReason(p.error)}`, 'error', {
      action: {
        label: '재시도',
        onPress: () =>
          startExtraction({
            linkId: entry.linkId,
            boardId: entry.boardId,
            boardTitle: entry.boardTitle,
          }),
      },
    });
    notifyComplete(entry.boardId);
  } else {
    active.set(linkId, { ...entry, step: p.step });
    emit();
  }
}

/**
 * Begin (or restart, for retry) background tracking of a link extraction:
 * register it, open the realtime channel, then fire the Edge Function. Safe to
 * call again for the same linkId — a stale channel is torn down first.
 */
export function startExtraction(params: StartExtractionParams): void {
  const { linkId } = params;
  if (channels.has(linkId)) teardown(linkId);

  active.set(linkId, { ...params, step: null, startedAt: Date.now() });
  const ch = subscribeExtractProgress(linkId, (p) => handleProgress(linkId, p));
  channels.set(linkId, ch);
  emit();

  triggerExtraction(supabase, linkId).catch((err) => {
    console.warn('[extraction-store] trigger failed:', err);
    teardown(linkId);
    showToast('분석 실패: 잠시 후 다시 시도', 'error', {
      action: { label: '재시도', onPress: () => startExtraction(params) },
    });
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Non-hook accessor for the current snapshot (used by tests + the hook). */
export function getActiveExtractions(): ActiveExtraction[] {
  return snapshot;
}

/** Live list of in-flight extractions across the whole app. */
export function useActiveExtractions(): ActiveExtraction[] {
  return useSyncExternalStore(subscribe, getActiveExtractions, getActiveExtractions);
}

/**
 * Register a callback fired when any extraction reaches a terminal state (done
 * OR error), with the affected boardId — screens use it to reload that board's
 * pins/links. Returns an unsubscribe for useEffect cleanup.
 */
export function onExtractionComplete(cb: CompletionListener): () => void {
  completionListeners.add(cb);
  return () => {
    completionListeners.delete(cb);
  };
}
