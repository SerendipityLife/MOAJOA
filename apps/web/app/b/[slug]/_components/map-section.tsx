'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PublicBoardView } from '@moajoa/core';
import { PublicBoardMap } from './public-board-map';

/**
 * Collapsible map for the public board (A안 리디자인 2026-06-12).
 * The old 60vh map owned the first mobile screen while the actual action
 * (가고싶어 voting) hid below the fold — default to a preview height and let
 * the visitor expand on demand.
 */
export function MapSection({
  places,
  links,
}: {
  places: PublicBoardView['places'];
  links: PublicBoardView['links'];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="animate-fade-in mt-5 [animation-delay:80ms]">
      <div
        className={`w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 transition-all ${
          expanded ? 'h-[60vh] md:h-[520px]' : 'h-52 md:h-72'
        }`}
      >
        <PublicBoardMap places={places} links={links} />
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-brand-600 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="size-4" strokeWidth={2} /> 지도 접기
          </>
        ) : (
          <>
            <ChevronDown className="size-4" strokeWidth={2} /> 지도 크게 보기
          </>
        )}
      </button>
    </div>
  );
}
