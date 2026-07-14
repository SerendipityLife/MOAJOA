import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { getCachedPoll } from '@/lib/poll-cache';
import { PollGuestIsland } from './_components/poll-guest-island';

interface Props {
  params: Promise<{ code: string }>;
}

/**
 * Static metadata for the public poll page. Uses ONLY the cached static poll
 * shape (no votes/tally) — safe to cache (RESEARCH Pitfall 2). The poll has no
 * owner display name in the bearer-code view, so the title is generic.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const poll = await getCachedPoll(code);
  if (!poll) return { title: 'MOAJOA' };
  return {
    title: '날짜 투표 · MOAJOA',
    description: '가능한 날짜에 투표해 함께 여행 일정을 정해요.',
    robots: { index: false, follow: false }, // bearer-code page — not for search indexing
  };
}

/**
 * Public anonymous voting page (`/poll/[code]`, Phase 19 / POLL-02).
 *
 * Cookies-free cached SSR shell: only the static poll metadata is server-rendered
 * (header chrome + the island mount). ALL mutable state — nickname, votes, live
 * tally, presence, chat — hydrates client-side in <PollGuestIsland> (vote island +
 * unified chat wrapper) so the shared anon cache is never poisoned (RESEARCH
 * Pitfall 2 GOTCHA).
 */
export default async function PollPage({ params }: Props) {
  const { code } = await params;
  const poll = await getCachedPoll(code);

  if (!poll) {
    return (
      <main className="min-h-screen bg-banana-100">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-lg font-semibold text-neutral-900">투표를 찾을 수 없어요</p>
          <p className="mt-2 text-sm text-neutral-600">
            링크가 만료됐거나 잘못된 코드예요. 초대한 분께 다시 링크를 받아주세요.
          </p>
          <a
            href="/"
            className="mt-6 inline-block text-base font-semibold text-brand-600 hover:underline"
          >
            MOAJOA
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-banana-100">
      <div className="mx-auto max-w-xl px-4 py-5 md:py-8">
        {/* Brand line — answers "무엇인지" in 3 seconds (mirror /t/[slug] chrome). */}
        <a href="/" className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-md bg-brand-600 text-white">
            <MapPin className="size-3" strokeWidth={2.4} />
          </span>
          <span className="text-xs font-semibold text-brand-600">MOAJOA</span>
          <span className="text-xs text-neutral-600">함께 여행 날짜 정하기</span>
        </a>

        <header className="mt-4">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-neutral-900 md:text-2xl">
            언제 같이 떠날까요?
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 md:text-base">
            가능한 날짜에 투표해주세요. 많이 모인 날짜로 같이 정해요.
          </p>
        </header>

        {/* Static cached props ONLY — votes/tally/presence hydrate inside, and the
            unified chat (trip_messages · moa:{tripId}) hydrates client-side in the
            wrapper island so the anon SSR cache stays clean (D-03). */}
        <PollGuestIsland
          code={code}
          tripId={poll.trip_id}
          mode={poll.mode}
          status={poll.status}
          options={poll.options ?? []}
        />

        <footer className="mt-12 border-t border-neutral-200 py-8 text-center">
          <a
            href="/"
            className="inline-block text-base font-semibold text-brand-600 hover:underline"
          >
            MOAJOA
          </a>
          <p className="mt-2 text-sm text-neutral-600">이 투표는 MOAJOA로 만들었어요</p>
        </footer>
      </div>
    </main>
  );
}
