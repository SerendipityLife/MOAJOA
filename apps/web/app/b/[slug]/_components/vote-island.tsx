'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicBoardView } from '@moajoa/core';
import {
  castVote,
  getMyBoardRole,
  getMyVotedPlaceIds,
  getVoteCounts,
  joinSharedBoard,
  retractVote,
} from '@moajoa/api';
import { Heart } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { categoryVisual } from '@/lib/category-icon';
import { buildYouTubeWatchUrl } from '@/lib/youtube';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps-url';
import { useToast } from '@/components';

type VotePlace = PublicBoardView['places'][number];
type ViewLink = PublicBoardView['links'][number];

interface Props {
  slug: string;
  boardId: string;
  places: VotePlace[];
  /** Source links from the same view — powers the per-place 출처 점프 button. */
  links?: ViewLink[];
  /** Test seam: render member view directly (skip session detect). */
  initialJoined?: boolean;
  /** Test seam: seed the current user's votes keyed by place_id. */
  initialMyVotes?: Record<string, boolean>;
}

/** `4:00` style label for the 출처 영상 jump. */
function tsLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The place's source jump: youtube → timestamped watch URL, blog/IG → the post. */
function sourceAction(
  place: VotePlace,
  linksById: Map<string, ViewLink>,
): { href: string; label: string } | null {
  if (!place.link_id) return null;
  const link = linksById.get(place.link_id);
  if (!link) return null;
  if (link.source_kind === 'youtube') {
    const href = buildYouTubeWatchUrl(link.url, place.source_timestamp_sec ?? null);
    if (!href) return null;
    const ts = place.source_timestamp_sec;
    return { href, label: ts != null && ts > 0 ? `▶ 영상 ${tsLabel(ts)}` : '▶ 영상 보기' };
  }
  return { href: link.url, label: link.source_kind === 'blog' ? '원문 보기' : '게시물 보기' };
}

/**
 * Unified place list + voting island for /b/[slug] (장소 상세 UX, 2026-06-12).
 * Replaces the old VoteIsland(투표 리스트) + PlaceSummaryList(장소 리스트) pair —
 * one list where a visitor reads the 해설, expands a row for the full detail
 * ([Google 지도] photos/ratings deep link + [영상 N:NN] source jump), and votes
 * right there. Inline-vote decision: 친구 투표자는 라이트 유저 — 본 자리에서
 * 즉시 ❤️ (별도 화면은 컨텍스트 스위치 = 참여율 하락).
 *
 * Hydration stays client-side so the public SSR cache (unstable_cache, anon,
 * cookies-free) is never touched (10-PATTERNS GOTCHA 3). Names/summaries/
 * detail buttons come from cached props and render for everyone (incl. SSR
 * first paint); counts/확정 hydrate for all visitors (anon-granted RPCs);
 * ❤️ affordances appear only for members.
 */
export function VoteIsland({ slug, boardId, places, links, initialJoined, initialMyVotes }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  // null = session not yet resolved; '' = logged out; otherwise user id.
  const [userId, setUserId] = useState<string | null>(initialJoined ? 'seed' : null);
  const [resolved, setResolved] = useState<boolean>(Boolean(initialJoined));
  const [joined, setJoined] = useState<boolean>(Boolean(initialJoined));

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsReady, setCountsReady] = useState(false);
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>(initialMyVotes ?? {});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [sortByLove, setSortByLove] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const linksById = new Map((links ?? []).map((l) => [l.id, l]));

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
      }
      // Counts/확정 are public social proof — hydrate for anon visitors too
      // (both RPCs are granted to anon; see 0009/0001 grants).
      await hydrateCounts(uid ?? undefined);
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
    const [vc, mine] = await Promise.all([
      getVoteCounts(client, placeIds),
      uid ? getMyVotedPlaceIds(client, placeIds, uid).catch(() => []) : Promise.resolve([]),
    ]);
    setCounts(vc);
    setCountsReady(true);
    if (uid && mine.length > 0) {
      setMyVotes((v) => ({ ...v, ...Object.fromEntries(mine.map((id) => [id, true])) }));
    }
  }

  async function onToggleVote(placeId: string) {
    // Hearts render for every visitor (가시성 피드백 2026-06-12). The tap
    // resolves the missing prerequisite instead of hiding the affordance:
    //   logged-out  → /login?next= back to this board
    //   non-member  → auto-join (slug = bearer invite, D-22) then vote
    if (!resolved) return;
    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/b/${slug}`)}` as never);
      return;
    }
    const client = getSupabaseBrowser();
    if (!joined) {
      setPending((p) => ({ ...p, [placeId]: true }));
      try {
        await joinSharedBoard(client, slug);
        setJoined(true);
        void hydrateCounts(userId);
      } catch (err) {
        console.error(err);
        setPending((p) => ({ ...p, [placeId]: false }));
        toast('참여하지 못했어요.', { variant: 'error' });
        return;
      }
    }
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

  if (places.length === 0) return null;

  const totalLove = Object.values(counts).reduce((a, n) => a + n, 0);
  // Relative-popularity bar scale. Widths are love/maxLove so the leading place
  // fills the track — at-a-glance "어디부터 갈까" without reintroducing the
  // removed 확정 verdict (denominator stays the max vote, not member count).
  const maxLove = Math.max(1, ...Object.values(counts));

  // 확정 뱃지/필터 제거 (2026-06-12 사용자 결정): 멤버가 공유링크로 수시 합류해
  // 분모가 불안정 → 수식 확정 대신 ❤️ 개수 + 정렬로 사람이 결정한다.
  // (v2 후보: 주인이 직접 '확정' 마킹 — .planning/dogfooding/v2-backlog.md)
  const visible = sortByLove
    ? [...places].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    : places;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          장소 {places.length}곳
          {countsReady && totalLove > 0 && (
            <span className="ml-2 text-sm font-medium text-neutral-400">
              가고싶어 {totalLove}개
            </span>
          )}
        </h2>
        <button
          type="button"
          aria-pressed={sortByLove}
          onClick={() => setSortByLove((v) => !v)}
          className={`text-sm font-semibold px-3 py-1 rounded-lg border transition-colors ${
            sortByLove
              ? 'text-brand-600 border-brand-300 bg-brand-50'
              : 'text-neutral-600 border-neutral-200 hover:border-brand-300 hover:bg-brand-50'
          }`}
        >
          가고싶어 순
        </button>
      </div>
      <ul className="space-y-2">
        {visible.map((p) => {
          const love = counts[p.id] ?? 0;
          const voted = myVotes[p.id] ?? false;
          const isOpen = open[p.id] ?? false;
          const source = sourceAction(p, linksById);
          const toggleOpen = () => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }));
          const cat = categoryVisual(p.category);
          const CatIcon = cat.icon;
          return (
            <li
              key={p.id}
              className={`border rounded-lg transition-colors ${
                isOpen ? 'border-brand-300 bg-brand-50/30' : 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50/40'
              }`}
            >
              {/* Whole card header toggles (affordance 피드백: 탭 영역을 넓게).
                  The heart is a sibling with stopPropagation so voting never
                  accidentally expands/collapses. */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={toggleOpen}
              >
                <span
                  aria-hidden
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${cat.tone}`}
                >
                  <CatIcon className="size-4" strokeWidth={2} />
                </span>
                <button
                  type="button"
                  data-testid={`place-row-${p.id}`}
                  aria-expanded={isOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen();
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="text-base font-semibold text-neutral-900 line-clamp-2">
                    {p.name_ko ?? p.name_local}
                  </span>
                  {p.summary_ko && !isOpen && (
                    <span
                      data-testid="place-summary"
                      className="text-sm text-neutral-600 mt-1 line-clamp-2"
                    >
                      {p.summary_ko}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  data-testid={`vote-toggle-${p.id}`}
                  aria-pressed={voted}
                  aria-label="가고싶어"
                  disabled={pending[p.id]}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleVote(p.id);
                  }}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors border ${
                    voted
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  <Heart
                    className="size-3.5"
                    strokeWidth={2.2}
                    fill={voted ? 'currentColor' : 'none'}
                  />
                  가고싶어
                  {countsReady && (
                    <span data-testid={`love-count-${p.id}`} className={voted ? 'text-white/90' : 'text-neutral-400'}>
                      {love}
                    </span>
                  )}
                </button>
                <span
                  aria-hidden
                  className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                >
                  ▾
                </span>
              </div>
              {countsReady && totalLove > 0 && (
                // 상대 인기 막대 — 가장 많이 받은 곳이 꽉 참. 선두는 진하게.
                <div className="px-3 pb-2.5 -mt-1" aria-hidden>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        love > 0 && love === maxLove ? 'bg-brand-600' : 'bg-brand-300'
                      }`}
                      style={{ width: `${Math.round((love / maxLove) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {isOpen && (
                // Tapping the expanded body also collapses (닫기 피드백) —
                // the action links stopPropagation so they still open.
                <div
                  data-testid={`place-detail-${p.id}`}
                  className="px-3 pb-3 cursor-pointer"
                  onClick={toggleOpen}
                >
                  {p.summary_ko && (
                    <p data-testid="place-summary" className="text-sm text-neutral-600">
                      {p.summary_ko}
                    </p>
                  )}
                  {p.address && (
                    <p className="text-xs text-neutral-500 mt-2">{p.address}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <a
                      href={buildGoogleMapsPlaceUrl(p.name_local, p.google_place_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`maps-link-${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                    >
                      📍 Google 지도
                    </a>
                    {source && (
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`source-link-${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                      >
                        {source.label}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
