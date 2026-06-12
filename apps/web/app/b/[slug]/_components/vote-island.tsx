'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicBoardView } from '@moajoa/core';
import { isPlaceConfirmed } from '@moajoa/core';
import {
  castVote,
  getAcceptedMemberCount,
  getMyBoardRole,
  getMyVotedPlaceIds,
  getVoteCounts,
  joinSharedBoard,
  retractVote,
} from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, useToast } from '@/components';

type VotePlace = PublicBoardView['places'][number];

interface Props {
  slug: string;
  boardId: string;
  places: VotePlace[];
  /** Test seam: render member view directly (skip session detect). */
  initialJoined?: boolean;
  /** Test seam: seed the current user's votes keyed by place_id. */
  initialMyVotes?: Record<string, boolean>;
}

/**
 * Web voting island for /b/[slug]. Hydrates client-side so the public SSR cache
 * (unstable_cache, anon, cookies-free) is never touched — all session reads run
 * in the browser via auth.getUser() (10-PATTERNS GOTCHA 3).
 *
 * Branches:
 *  - logged-out         → "참여해서 투표하기" CTA → /login (magic-link flow).
 *  - logged-in non-member → "이 보드에 참여하기" → joinSharedBoard(slug) (idempotent).
 *  - logged-in member   → per-place ❤️ toggle + love count + 확정 filter.
 *
 * 확정 uses the shared isPlaceConfirmed(loveCount, memberCount) rule — never
 * re-implemented here (single source: @moajoa/core/vote.ts).
 */
export function VoteIsland({ slug, boardId, places, initialJoined, initialMyVotes }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  // null = session not yet resolved; '' = logged out; otherwise user id.
  const [userId, setUserId] = useState<string | null>(initialJoined ? 'seed' : null);
  const [resolved, setResolved] = useState<boolean>(Boolean(initialJoined));
  const [joined, setJoined] = useState<boolean>(Boolean(initialJoined));
  const [joining, setJoining] = useState(false);

  const [memberCount, setMemberCount] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>(initialMyVotes ?? {});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [confirmedOnly, setConfirmedOnly] = useState(false);

  // Session + membership + count hydration (skipped when a test seeds initialJoined).
  // 10-03 live finding: without the role check, a returning member (or the
  // owner) was re-prompted with 참여하기 on every visit; without my-vote
  // hydration, an existing ❤️ rendered as 🤍 and the toggle re-inserted.
  useEffect(() => {
    if (initialJoined) {
      void hydrateCounts();
      return;
    }
    let active = true;
    (async () => {
      const client = getSupabaseBrowser();
      const { data } = await client.auth.getUser();
      if (!active) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const role = await getMyBoardRole(client, boardId, uid).catch(() => null);
        if (!active) return;
        if (role) setJoined(true);
        await hydrateCounts(uid);
      }
      if (active) setResolved(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hydrateCounts(uid?: string) {
    const client = getSupabaseBrowser();
    const placeIds = places.map((p) => p.id);
    const [mc, vc, mine] = await Promise.all([
      getAcceptedMemberCount(client, boardId),
      getVoteCounts(client, placeIds),
      uid ? getMyVotedPlaceIds(client, placeIds, uid).catch(() => []) : Promise.resolve([]),
    ]);
    setMemberCount(mc);
    setCounts(vc);
    if (uid && mine.length > 0) {
      setMyVotes((v) => ({ ...v, ...Object.fromEntries(mine.map((id) => [id, true])) }));
    }
  }

  async function onJoin() {
    setJoining(true);
    try {
      await joinSharedBoard(getSupabaseBrowser(), slug);
      setJoined(true);
      await hydrateCounts(userId ?? undefined);
      toast('보드에 참여했어요.', { variant: 'success' });
      router.refresh();
    } catch (err) {
      console.error(err);
      toast('참여하지 못했어요.', { variant: 'error' });
    } finally {
      setJoining(false);
    }
  }

  async function onToggleVote(placeId: string) {
    const client = getSupabaseBrowser();
    const wasVoted = myVotes[placeId] ?? false;
    setPending((p) => ({ ...p, [placeId]: true }));
    // Optimistic local update; server truth reconciled below.
    setMyVotes((v) => ({ ...v, [placeId]: !wasVoted }));
    setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? -1 : 1) }));
    try {
      if (wasVoted) {
        await retractVote(client, placeId);
      } else {
        await castVote(client, { place_id: placeId, kind: 'love' });
      }
    } catch (err) {
      console.error(err);
      // Roll back optimistic update.
      setMyVotes((v) => ({ ...v, [placeId]: wasVoted }));
      setCounts((c) => ({ ...c, [placeId]: (c[placeId] ?? 0) + (wasVoted ? 1 : -1) }));
      toast('투표를 저장하지 못했어요.', { variant: 'error' });
    } finally {
      setPending((p) => ({ ...p, [placeId]: false }));
    }
  }

  // --- Branch: session not resolved yet → render nothing (no flicker). ---
  if (!resolved && !joined) return null;

  // --- Branch: logged-out → login CTA. ---
  if (!joined && !userId) {
    return (
      <section className="mt-8">
        <a
          href="/login"
          className="inline-block p-3 text-base font-semibold text-brand-500 border border-neutral-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 transition-colors"
        >
          참여해서 투표하기
        </a>
      </section>
    );
  }

  // --- Branch: logged-in non-member → join CTA (read-only counts shown). ---
  if (!joined) {
    return (
      <section className="mt-8">
        <Button onClick={onJoin} disabled={joining}>
          {joining ? '...' : '이 보드에 참여하기'}
        </Button>
      </section>
    );
  }

  // --- Branch: member → per-place ❤️ toggle + count + 확정 filter. ---
  const visible = confirmedOnly
    ? places.filter((p) => isPlaceConfirmed(counts[p.id] ?? 0, memberCount))
    : places;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-neutral-900">투표 {places.length}곳</h2>
        <button
          type="button"
          aria-pressed={confirmedOnly}
          onClick={() => setConfirmedOnly((v) => !v)}
          className={`text-sm font-semibold px-3 py-1 rounded-lg border transition-colors ${
            confirmedOnly
              ? 'text-brand-500 border-brand-300 bg-brand-50'
              : 'text-neutral-600 border-neutral-200 hover:border-brand-300 hover:bg-brand-50'
          }`}
        >
          확정만 보기
        </button>
      </div>
      <ul className="space-y-2">
        {visible.map((p) => {
          const love = counts[p.id] ?? 0;
          const voted = myVotes[p.id] ?? false;
          const confirmed = isPlaceConfirmed(love, memberCount);
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg"
            >
              <button
                type="button"
                data-testid={`vote-toggle-${p.id}`}
                aria-pressed={voted}
                disabled={pending[p.id]}
                onClick={() => onToggleVote(p.id)}
                className="text-xl leading-none shrink-0"
              >
                {voted ? '❤️' : '🤍'}
              </button>
              <span data-testid={`love-count-${p.id}`} className="text-sm text-neutral-600 w-6">
                {love}
              </span>
              <span className="text-base font-semibold text-neutral-900 line-clamp-2 min-w-0">
                {p.name_ko ?? p.name_local}
              </span>
              {confirmed && (
                <span
                  data-testid={`confirmed-badge-${p.id}`}
                  className="ml-auto text-sm font-semibold text-brand-500 shrink-0"
                >
                  확정
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
