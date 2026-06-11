import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind, SharedDefaultsKeys } from '@moajoa/core';
import { supabase } from '@/lib/supabase';
import { SharedDefaults } from '@/lib/shared-defaults';

interface PendingLink {
  url: string;
  board_id: string | null;
  queued_at: string;
  retry_count: number;
}

export interface FailedPendingLink extends PendingLink {
  failed_at: string;
  reason: 'network' | 'auth' | 'api' | 'unknown';
}

export interface DrainResult {
  ok: number;
  failed: number;
  skipped?: boolean;
}

// Module-level guard: prevent concurrent drain (D-04 cold launch + foreground
// can fire near-simultaneously; concurrent execution would double-INSERT links).
// Per RESEARCH §"Pattern 3" (in-flight ref) — module ref equivalent for non-React caller.
let inFlight = false;

export async function enqueuePendingLink(url: string, boardId: string | null): Promise<void> {
  const queue = SharedDefaults.get<PendingLink[]>(SharedDefaultsKeys.PendingLinks) ?? [];
  queue.push({
    url,
    board_id: boardId,
    queued_at: new Date().toISOString(),
    retry_count: 0,
  });
  SharedDefaults.set(SharedDefaultsKeys.PendingLinks, queue);
}

/**
 * Drain the pending_links queue. Per CONTEXT.md D-04:
 *   - Called on cold launch (mount in _layout.tsx)
 *   - Called on AppState 'active' transition
 *
 * Per D-06: silent retry while retry_count ≤ 3; on the 4th failure the entry
 * moves to pending_links_failed (surfaced via boards.tsx banner).
 *
 * Per RESEARCH §"Pitfall 7": each entry gets exactly ONE attempt per drain turn.
 * Failed entries are written back with retry_count+1 immediately; the next
 * drain trigger retries them.
 */
export async function drainPendingLinks(): Promise<DrainResult> {
  if (inFlight) return { ok: 0, failed: 0, skipped: true };
  inFlight = true;
  try {
    const queue = SharedDefaults.get<PendingLink[]>(SharedDefaultsKeys.PendingLinks) ?? [];
    if (queue.length === 0) return { ok: 0, failed: 0 };

    const stillPending: PendingLink[] = [];
    const newFailed: FailedPendingLink[] = [];
    let ok = 0;

    for (const item of queue) {
      // D-03 case: board picker required — keep in queue. The "+ 핀" main-app
      // flow (Plan 03-05) is the eventual surface for resolving these; for
      // now they linger until the user opens main app and explicitly assigns.
      if (!item.board_id) {
        stillPending.push(item);
        continue;
      }

      try {
        const link = await addLink(supabase, { board_id: item.board_id, url: item.url });
        // 09-05: drain triggers any auto-extractable kind (youtube|blog|instagram).
        const drainKind = detectSourceKind(item.url);
        if (drainKind !== null && drainKind !== 'manual') {
          // Fire-and-forget — UI subscribes to extract:{id} broadcast (Plan 03-05).
          triggerExtraction(supabase, link.id).catch((e) =>
            console.warn('[drain] triggerExtraction failed:', e),
          );
        }
        ok++;
      } catch (e) {
        const nextRetry = item.retry_count + 1;
        if (nextRetry > 3) {
          newFailed.push({
            ...item,
            retry_count: nextRetry,
            failed_at: new Date().toISOString(),
            reason: classifyError(e),
          });
        } else {
          stillPending.push({ ...item, retry_count: nextRetry });
        }
      }
    }

    SharedDefaults.set(SharedDefaultsKeys.PendingLinks, stillPending);

    if (newFailed.length > 0) {
      const existingFailed =
        SharedDefaults.get<FailedPendingLink[]>(SharedDefaultsKeys.PendingLinksFailed) ?? [];
      SharedDefaults.set(SharedDefaultsKeys.PendingLinksFailed, [
        ...existingFailed,
        ...newFailed,
      ]);
    }

    return { ok, failed: newFailed.length };
  } finally {
    inFlight = false;
  }
}

export function listFailedPending(): FailedPendingLink[] {
  return SharedDefaults.get<FailedPendingLink[]>(SharedDefaultsKeys.PendingLinksFailed) ?? [];
}

export function retryFailedPending(url: string): void {
  const failed = listFailedPending();
  const idx = failed.findIndex((f) => f.url === url);
  if (idx === -1) return;
  const [item] = failed.splice(idx, 1);
  SharedDefaults.set(SharedDefaultsKeys.PendingLinksFailed, failed);
  // Re-enqueue with retry_count reset to 0 (explicit user action — new attempt).
  void enqueuePendingLink(item.url, item.board_id);
}

export function deleteFailedPending(url: string): void {
  const failed = listFailedPending();
  SharedDefaults.set(
    SharedDefaultsKeys.PendingLinksFailed,
    failed.filter((f) => f.url !== url),
  );
}

/**
 * Re-add a previously deleted failed entry (D-08 실행취소). Symmetric with
 * deleteFailedPending — single entry point so the screen never imports
 * SharedDefaults/constants directly to undo a swipe-delete.
 */
export function restoreFailedPending(item: FailedPendingLink): void {
  const failed = listFailedPending();
  failed.push(item);
  SharedDefaults.set(SharedDefaultsKeys.PendingLinksFailed, failed);
}

function classifyError(e: unknown): FailedPendingLink['reason'] {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) return 'network';
  if (msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('auth')) return 'auth';
  if (msg.includes('places') || msg.includes('extraction') || msg.includes('api')) return 'api';
  return 'unknown';
}
