'use client';

import { X } from 'lucide-react';
import { AddContentTabs, type PickedPlace } from '@/components';

/**
 * Step 4 — "봐둔 곳이 있나요?" (D-08, ONBOARD-05). AddContentTabs(D-11)로 링크/장소를
 * 로컬 스테이징 리스트에 담아둔다. DB 접촉 0 — 실제 생성/시드는 모아 완료 시 일괄(D-03).
 * 건너뛰기 허용(CTA는 page.tsx). 상태는 page.tsx 소유.
 */

interface StepSeedProps {
  seedLinks: string[];
  seedPlaces: PickedPlace[];
  onAddLink: (url: string) => void;
  onPickPlace: (place: PickedPlace) => void;
  onRemoveLink: (index: number) => void;
  onRemovePlace: (index: number) => void;
}

export function StepSeed({
  seedLinks,
  seedPlaces,
  onAddLink,
  onPickPlace,
  onRemoveLink,
  onRemovePlace,
}: StepSeedProps) {
  const hasItems = seedLinks.length > 0 || seedPlaces.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        유튜브·블로그 링크를 붙여넣거나 장소를 검색해 담아 두세요
      </p>

      <AddContentTabs onAddLink={onAddLink} onPickPlace={onPickPlace} />

      {hasItems && (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-surface-raised">
          {seedLinks.map((link, i) => (
            <li key={`link-${i}`} className="flex min-h-[44px] items-center gap-2 px-3 py-2">
              <span className="flex-1 truncate text-sm text-neutral-900">{link}</span>
              <button
                type="button"
                aria-label="링크 제거"
                onClick={() => onRemoveLink(i)}
                className="grid size-8 place-items-center text-neutral-400 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
          {seedPlaces.map((place, i) => (
            <li key={`place-${i}`} className="flex min-h-[44px] items-center gap-2 px-3 py-2">
              <span className="flex-1 truncate text-sm text-neutral-900">{place.name}</span>
              <button
                type="button"
                aria-label="장소 제거"
                onClick={() => onRemovePlace(i)}
                className="grid size-8 place-items-center text-neutral-400 hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
