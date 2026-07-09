'use client';

import { useEffect, useState } from 'react';
import type { Link, Place } from '@moajoa/core';
import { AlertCircle, ExternalLink, Heart, Loader2 } from 'lucide-react';
import { sortByLove } from '@/lib/place-sort';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps-url';
import { buildYouTubeWatchUrl } from '@/lib/youtube';

export interface PlaceListProps {
  /** hidden 제외 상태로 전달됨. */
  places: Place[];
  links: Link[];
  /** placeId → 찜 수. */
  counts: Record<string, number>;
  myVotes: Record<string, boolean>;
  votePending: Record<string, boolean>;
  /** userId → display_name. */
  profileNames: Record<string, string>;
  /** island이 memberColor를 바인딩해 전달 (MOA-06). */
  colorFor: (userId: string) => string;
  /** controlled — 마커 탭 연동 (MOA-05). */
  openPlaceId: string | null;
  onOpenPlace: (id: string | null) => void;
  onToggleVote: (placeId: string) => void;
  onRetry: (linkId: string) => void;
  onDelete: (placeId: string) => void;
  /** D-10 답장 — 채팅 탭 전환 + reply_to_place_id 프리필(island이 배선). */
  onReply: (placeId: string) => void;
}

/** `4:00` 스타일 라벨 (vote-island tsLabel 미러 — m:ss zero-pad). */
function tsLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * PlaceList — /moa/[id] 지도탭 시트 본문 (MOA-02/05/06 + D-13/15).
 *
 * props-driven 프레젠테이션: 정렬·아코디언·찜 하트·분석중/실패 행만 그린다.
 * 상태·mutation(찜 토글·재시도 네트워크)은 24-06 island이 소유 — 여기선 콜백만.
 * vote-island(/t/[slug])의 아코디언·출처 액션·하트 idiom을 미러하되 join/anon
 * 분기는 복사하지 않는다(익명 참여 로직은 island 책임).
 */
export function PlaceList({
  places,
  links,
  counts,
  myVotes,
  votePending,
  profileNames,
  colorFor,
  openPlaceId,
  onOpenPlace,
  onToggleVote,
  onRetry,
  onDelete,
  onReply,
}: PlaceListProps) {
  // MOA-05 마커 탭: openPlaceId 외부 변경 시 해당 행으로 스크롤.
  useEffect(() => {
    if (!openPlaceId) return;
    document
      .querySelector(`[data-place-id="${openPlaceId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openPlaceId]);

  // CHAT-03 하이라이트 (D-10): openPlaceId가 바뀌면(칩·마커 탭) 해당 행에 짧은 링 큐를
  // 켜고 ~1.5s 후 끈다. scroll만으론 "어디로 갔는지" 안 보여 요구된 시각 큐를 추가.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (!openPlaceId) return;
    setHighlightId(openPlaceId);
    const t = setTimeout(() => setHighlightId(null), 1500);
    return () => clearTimeout(t);
  }, [openPlaceId]);

  // 정렬(MOA-02): 찜 desc·동률 seq_no asc — 렌더 순서만. 배지는 항상 place.seq_no.
  const sorted = sortByLove(places, counts);

  // D-13 분석 중 행 — 추출 진행 링크. manual 링크는 추출 대상이 아니므로 제외
  // (H-01: manual은 pending에서 벗어날 트리거가 없어 영구 스피너가 됨 → 실패 행으로 취급).
  const analyzing = links.filter(
    (l) =>
      l.source_kind !== 'manual' &&
      (l.extraction_status === 'pending' || l.extraction_status === 'processing'),
  );

  // D-15 실패 행 (Pitfall 8): 실패·수동검토 + '완료인데 장소 0개' + 미지원(manual) 링크.
  const failed = links.filter(
    (l) =>
      l.source_kind === 'manual' ||
      l.extraction_status === 'failed' ||
      l.extraction_status === 'manual_review' ||
      (l.extraction_status === 'ready' && places.every((p) => p.link_id !== l.id)),
  );

  const isEmpty = places.length === 0 && analyzing.length === 0 && failed.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-lg font-semibold text-neutral-900">아직 담은 장소가 없어요</p>
        <p className="text-sm font-normal text-neutral-500">
          아래 + 버튼으로 링크를 붙여넣거나 장소를 검색해 보세요
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {/* D-13 분석 중 행 — 리스트 상단, 스피너는 neutral-400(브랜드색 아님). */}
      {analyzing.map((l) => (
        <li
          key={`analyzing-${l.id}`}
          className="flex min-h-[44px] items-center gap-3 border-b border-neutral-100 py-4"
        >
          <Loader2 className="size-5 shrink-0 animate-spin text-neutral-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-normal text-neutral-700">
            {l.title ?? l.url}
          </span>
          <span className="shrink-0 text-xs font-normal text-neutral-500">분석 중…</span>
        </li>
      ))}

      {/* 장소 행 (MOA-02/05/06). */}
      {sorted.map((p) => {
        const love = counts[p.id] ?? 0;
        const voted = myVotes[p.id] ?? false;
        const isOpen = openPlaceId === p.id;
        const link = p.link_id ? links.find((l) => l.id === p.link_id) : undefined;

        // 출처 액션: youtube → 타임스탬프 watch URL, blog/IG → 원문. manual → 생략.
        let source: { href: string; label: string } | null = null;
        if (link) {
          if (link.source_kind === 'youtube') {
            const href = buildYouTubeWatchUrl(link.url, p.source_timestamp_sec);
            const ts = p.source_timestamp_sec;
            if (href) {
              source = { href, label: ts && ts > 0 ? `출처 ${tsLabel(ts)}` : '출처 보기' };
            }
          } else {
            source = { href: link.url, label: '출처 보기' };
          }
        }

        return (
          <li
            key={p.id}
            data-place-id={p.id}
            data-highlighted={highlightId === p.id ? 'true' : undefined}
            className={`border-b border-neutral-100${
              highlightId === p.id ? ' rounded-lg ring-2 ring-brand-300' : ''
            }`}
          >
            {/* 행 헤더 — 탭 시 아코디언 토글. 하트는 stopPropagation sibling. */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => onOpenPlace(isOpen ? null : p.id)}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 px-6 py-4"
            >
              {/* 좌: 추가자 색 순번 배지 (MOA-06) — 표기는 seq_no 그대로 (MOA-02). */}
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-semibold leading-none text-white"
                style={{ backgroundColor: colorFor(p.added_by) }}
              >
                {p.seq_no}
              </span>

              {/* 중: 장소명 + '{닉네임}님이 담음' (MOA-06). */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-900">
                  {p.name_local}
                </p>
                <p className="truncate text-xs font-normal text-neutral-500">
                  {profileNames[p.added_by] ?? '알 수 없음'}님이 담음
                </p>
              </div>

              {/* 우: 찜 하트 토글 — 행 토글과 분리(stopPropagation). */}
              <button
                type="button"
                aria-label="찜"
                aria-pressed={voted}
                disabled={votePending[p.id]}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVote(p.id);
                }}
                className="flex shrink-0 items-center gap-1 disabled:opacity-50"
              >
                <Heart
                  className={voted ? 'size-5 text-brand-500' : 'size-5 text-neutral-400'}
                  strokeWidth={2}
                  fill={voted ? 'currentColor' : 'none'}
                />
                <span className="text-xs font-normal text-neutral-500">{love}</span>
              </button>
            </div>

            {/* 아코디언 (MOA-05, A-7 순서). 한 번에 하나만 — vote-island 조건부 마운트 미러. */}
            {isOpen && (
              <div className="flex flex-col gap-2 px-6 pb-4">
                {p.address && (
                  <p className="text-sm font-normal text-neutral-700">{p.address}</p>
                )}
                <a
                  href={buildGoogleMapsPlaceUrl(p.name_local, p.google_place_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700"
                >
                  구글맵에서 보기
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                {source && (
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700"
                  >
                    {source.label}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
                {/* A-4 답장 (D-10) — 채팅 탭 전환 + reply_to_place_id 프리필. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(p.id);
                  }}
                  className="self-start text-sm font-medium text-neutral-700"
                >
                  답장
                </button>
                {/* 삭제 (soft-delete via hidden_at) — island이 optimistic 제거 + hidePlace. */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                  className="self-start text-sm font-medium text-[#EF4444]"
                >
                  삭제
                </button>
              </div>
            )}
          </li>
        );
      })}

      {/* D-15 실패 행 — 재시도(재추출 트리거)는 island 콜백. */}
      {failed.map((l) => (
        <li
          key={`failed-${l.id}`}
          className="flex min-h-[44px] items-center gap-3 border-b border-neutral-100 py-4"
        >
          <AlertCircle className="size-5 shrink-0 text-[#EF4444]" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-normal text-neutral-700">
            {l.source_kind === 'manual' ? '지원하지 않는 링크예요' : '장소를 찾지 못했어요'}
          </span>
          {/* manual 링크는 재추출 불가 — 재시도 버튼 생략(H-01). */}
          {l.source_kind !== 'manual' && (
            <button
              type="button"
              onClick={() => onRetry(l.id)}
              className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-brand-300 hover:bg-brand-50"
            >
              재시도
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
