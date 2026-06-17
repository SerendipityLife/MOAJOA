// apps/ios/app/share-handler.tsx
// Phase 16, D-05 "A안" — piece 2 of 2: the MOUNTED handler (has auth + Supabase).
// Reads the App Group share payload (event-based via expo-share-intent provider —
// reader ONLY, NOT B안 auto-navigation), Zod-validates the URL (V5), decides the
// route (decideShareRoute), then enqueues-and-lingers (D-02) OR auto-adds +
// startExtraction + navigates so the pin visibly forms (D-03). 2+ boards → picker
// (sheet wired in Plan 16-03).
//
// The async decision body is exported as `handleSharedUrl` so it unit-tests
// directly (testable seam) — the effect below is a thin caller.
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { listMyBoards, addLink } from '@moajoa/api';
import { detectSourceKind, SharedDefaultsKeys } from '@moajoa/core';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { SharedDefaults } from '@/lib/shared-defaults';
import { enqueuePendingLink } from '@/lib/pending';
import { startExtraction } from '@/lib/extraction-store';
import { decideShareRoute, extractSharedUrl } from '@/lib/share-routing';

/**
 * Decide what to do with a freshly-shared URL and act on it (Phase 16 core).
 * V5-guards the URL, awaits auth (Pitfall 4 — launch-from-share races auth
 * bootstrap), then routes: linger (D-02), auto-add + startExtraction + navigate
 * (D-03), or picker (2+ boards — sheet in Plan 16-03). Returns early (no-op) for
 * non-http(s) input so nothing is ever enqueued/added.
 */
export async function handleSharedUrl(rawUrl: string | null | undefined): Promise<void> {
  const url = extractSharedUrl(rawUrl); // V5 guard
  if (!url) return;

  // Pitfall 4: await the session before deciding so an authed 1-board user
  // never wrongly lingers because auth hadn't resolved yet.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const boards = session ? await listMyBoards(supabase) : [];
  const route = decideShareRoute(!!session, boards.length, boards[0]?.id ?? null);

  if (route.kind === 'linger') {
    await enqueuePendingLink(url, null); // D-02 reuse AS-IS
    router.replace('/');
  } else if (route.kind === 'auto') {
    const link = await addLink(supabase, { board_id: route.boardId, url }); // D-03
    SharedDefaults.set(SharedDefaultsKeys.LastBoardId, route.boardId);
    const kind = detectSourceKind(link.url);
    if (kind !== null && kind !== 'manual') {
      startExtraction({ linkId: link.id, boardId: route.boardId, boardTitle: null });
    }
    router.replace(`/boards/${route.boardId}`);
  }
  // else route.kind === 'picker' — Plan 16-03 opens board-picker-sheet with
  // `url` in state. For 16-02 do NOT auto-add or linger (handoff only).
}

export default function ShareHandler() {
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const handled = useRef(false); // dedup within this mount (Pitfall 2 / clear-after-read)

  useEffect(() => {
    if (!shareIntent?.webUrl || handled.current) return;
    handled.current = true;
    handleSharedUrl(shareIntent.webUrl).finally(() => {
      resetShareIntent(); // dedup: clear the App Group key so the share never re-fires
    });
  }, [shareIntent?.webUrl, resetShareIntent]);

  // Brief loading state while we decide (launch-from-share has no other UI yet).
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
