'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerExtraction } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, useToast } from '@/components';

/**
 * Re-run extraction for a link that's stuck (pending/failed/manual_review).
 * Edge Function is idempotent — it re-checks status — so a retry is safe.
 * Dev-tool only: the whole board detail page is gated behind isDevToolsEnabled.
 */
export function RetryExtractionButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function onRetry() {
    setPending(true);
    try {
      const result = await triggerExtraction(getSupabaseBrowser(), linkId);
      if (result.status === 'ready') {
        toast(`장소 ${result.places_extracted}개를 찾았어요.`, { variant: 'success' });
      } else if (result.status === 'manual_review') {
        toast('장소를 찾지 못했어요. 영상 더보기란에 장소가 적혀 있는지 확인해 주세요.', {
          variant: 'info',
        });
      } else {
        toast('분석에 실패했어요. 잠시 후 다시 시도해 주세요.', { variant: 'error' });
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      toast('재분석을 시작하지 못했어요.', { variant: 'error' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onRetry} disabled={pending}>
      {pending ? '...' : '재분석'}
    </Button>
  );
}
