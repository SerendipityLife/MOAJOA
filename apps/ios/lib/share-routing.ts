// apps/ios/lib/share-routing.ts
// Pure routing decision for an inbound shared link (Phase 16, D-01/D-02).
// Inbound shares carry NO board_id (share starts outside MOAJOA), so MOAJOA
// decides the target board from the user's board count. Kept side-effect-free
// so it unit-tests without auth/Supabase/native (mirrors lib/pending.ts purity).
export type ShareRoute =
  | { kind: 'linger' }                 // D-02: !authed OR 0 boards → enqueue(url, null), item lingers
  | { kind: 'auto'; boardId: string }  // D-01/D-03: exactly 1 board → auto-add + navigate
  | { kind: 'picker' };                // D-01/D-04: 2+ boards → in-app bottom-sheet picker

export function decideShareRoute(
  authed: boolean,
  boardCount: number,
  firstBoardId: string | null,
): ShareRoute {
  if (!authed || boardCount === 0) return { kind: 'linger' };
  if (boardCount === 1 && firstBoardId) return { kind: 'auto', boardId: firstBoardId };
  return { kind: 'picker' };
}
