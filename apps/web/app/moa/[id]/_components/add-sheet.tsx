'use client';

import { addLink, addManualPlace, triggerExtraction } from '@moajoa/api';
import { AddContentTabs, BottomSheet, useToast, type PickedPlace } from '@/components';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * AddSheet — FAB [+] 추가 시트 (MOA-03/04, D-11).
 *
 * BottomSheet + AddContentTabs(24-04 재사용 — 자체 탭 재구현 금지) 조합. 링크 탭은
 * addLink 후 비-manual이면 triggerExtraction을 fire-and-forget(D-13 — reconcile이
 * '분석 중…' 행을 즉시 띄운다). 검색 탭은 addManualPlace 후 onAdded()로 즉시 reconcile —
 * places INSERT realtime 경로에만 의존하지 않는다(realtime 지연/누락 시 방금 담은 장소가
 * 안 보이는 버그 방지). realtime이 함께 발화해도 M-02 reconcile 가드가 중복 토스트를 막는다.
 */
export interface AddSheetProps {
  tripId: string;
  open: boolean;
  onClose: () => void;
  /** island reconcile — links INSERT는 구독 대상이 아니라 즉시 반영 필요. */
  onAdded: () => void;
}

export function AddSheet({ tripId, open, onClose, onAdded }: AddSheetProps) {
  const { toast } = useToast();

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
      await addManualPlace(client, {
        board_id: tripId,
        google_place_id: place.id,
        name_local: place.name,
        lat: place.location?.lat,
        lng: place.location?.lng,
        address: place.address,
      });
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요', { variant: 'error' });
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="추가하기">
      <AddContentTabs onAddLink={handleAddLink} onPickPlace={handlePickPlace} />
    </BottomSheet>
  );
}
