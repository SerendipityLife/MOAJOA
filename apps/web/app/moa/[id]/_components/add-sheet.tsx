'use client';

import { useState } from 'react';
import { addLink, addManualPlace, triggerExtraction } from '@moajoa/api';
import { AddContentTabs, BottomSheet, useToast, type PickedPlace } from '@/components';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { DaySelectSheet } from './day-select-sheet';

/**
 * AddSheet — FAB [+] 추가 시트 (MOA-03/04, D-11).
 *
 * BottomSheet + AddContentTabs(24-04 재사용 — 자체 탭 재구현 금지) 조합. 링크 탭은
 * addLink 후 비-manual이면 triggerExtraction을 fire-and-forget(D-13 — reconcile이
 * '분석 중…' 행을 즉시 띄운다). 검색 탭은 addManualPlace 후 onAdded()로 즉시 reconcile —
 * places INSERT realtime 경로에만 의존하지 않는다(realtime 지연/누락 시 방금 담은 장소가
 * 안 보이는 버그 방지). realtime이 함께 발화해도 M-02 reconcile 가드가 중복 토스트를 막는다.
 *
 * **Phase 28 — 검색 추가 Day 배치 분기 (D-19/D-20).** 장소를 담은 뒤 플랜이 있으면 며칠차에
 * 넣을지 묻고, 없으면 묻지 않는다. 묻지 않는 이유는 UX 취향이 아니라 물리적 제약이다 —
 * 플랜이 없으면 `moveToDay`가 필요로 하는 `plan_id`가 존재하지 않는다. 대신 D-24 토스트로
 * "일정을 만들면 AI가 정해준다"는 규칙을 그 자리에서 알려준다.
 *
 * 링크 경로는 Day를 묻지 않는다 — 추출이 비동기라 담는 시점에 장소가 아직 없다.
 */
export interface AddSheetProps {
  tripId: string;
  open: boolean;
  onClose: () => void;
  /** island reconcile — links INSERT는 구독 대상이 아니라 즉시 반영 필요. */
  onAdded: () => void;
  /** 플랜 유무 (D-19/D-20 분기). 미전달 = 플랜 없음. */
  planExists?: boolean;
  /** Day 선택 시트의 Day 수 — PlanSection과 같은 파생값을 island이 내려준다. */
  dayCount?: number;
  /**
   * Day 배치 위임 (0-based day_index). 실제 `moveToDay`는 plan을 소유한 island이 실행한다 —
   * 이 시트는 `addManualPlace`까지만 하고 배치는 콜백으로 넘긴다.
   */
  onPlacePickedForDay?: (placeId: string, dayIndex: number) => void;
}

export function AddSheet({
  tripId,
  open,
  onClose,
  onAdded,
  planExists,
  dayCount,
  onPlacePickedForDay,
}: AddSheetProps) {
  const { toast } = useToast();
  // 방금 담았지만 아직 Day를 안 정한 장소 (플랜 있음 경로에서만 세팅).
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);

  async function handleAddLink(url: string) {
    const client = getSupabaseBrowser();
    try {
      const link = await addLink(client, { board_id: tripId, url });
      // fire-and-forget — 진행 상태는 realtime reconcile이 반영(D-13).
      if (link.source_kind !== 'manual') {
        triggerExtraction(client, link.id).catch(console.error);
      }
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  async function handlePickPlace(place: PickedPlace) {
    const client = getSupabaseBrowser();
    try {
      const added = await addManualPlace(client, {
        board_id: tripId,
        google_place_id: place.id,
        name_local: place.name,
        lat: place.location?.lat,
        lng: place.location?.lng,
        address: place.address,
      });
      onAdded();
      onClose();
      if (planExists) {
        // D-20 — 며칠차에 넣을지 묻는다. 시트는 AddSheet가 닫힌 뒤에도 떠 있어야 하므로
        // BottomSheet 바깥(형제)에 렌더한다.
        setPendingPlaceId(added.id);
        return;
      }
      // D-24/D-19 — Day를 물을 수 없는 이유(플랜 없음)를 규칙으로 안내한다.
      toast('지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요');
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="추가하기">
        <AddContentTabs onAddLink={handleAddLink} onPickPlace={handlePickPlace} />
      </BottomSheet>

      <DaySelectSheet
        open={pendingPlaceId !== null}
        onClose={() => setPendingPlaceId(null)}
        dayCount={dayCount ?? 1}
        onSelectDay={(dayIndex) => {
          const placeId = pendingPlaceId;
          setPendingPlaceId(null);
          if (placeId) onPlacePickedForDay?.(placeId, dayIndex);
        }}
        // D-20 '아직 모르겠다' — 배치하지 않는다. 장소는 이미 담겼으므로 미배치 풀에 남고,
        // 다음 재생성 때 AI가 넣거나 사용자가 나중에 옮긴다. 즉시 재생성·자동 append 없음.
        onSkip={() => setPendingPlaceId(null)}
      />
    </>
  );
}
