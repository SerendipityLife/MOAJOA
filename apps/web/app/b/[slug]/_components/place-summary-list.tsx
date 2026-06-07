import type { PublicBoardView } from '@moajoa/core';

/**
 * VIEW-08 (Phase 8): read-only place commentary section for the public board.
 * Each place shows its name + a 1~2 sentence Korean summary when present.
 * summary_ko is rendered as JSX text (React default escaping) — never as raw
 * HTML — so LLM-generated text cannot inject markup (T-08-06).
 * Display-only: no create/add UI (CLAUDE.md §5 hard rule).
 */
export function PlaceSummaryList({ places }: { places: PublicBoardView['places'] }) {
  if (places.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">장소 {places.length}곳</h2>
      <ul className="space-y-2">
        {places.map((p) => (
          <li key={p.id} className="p-3 border border-neutral-200 rounded-lg">
            <p className="text-base font-semibold text-neutral-900 line-clamp-2">
              {p.name_ko ?? p.name_local}
            </p>
            {p.summary_ko && (
              <p data-testid="place-summary" className="text-sm text-neutral-600 mt-1">
                {p.summary_ko}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
