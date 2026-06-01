'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind } from '@moajoa/core';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input, useToast } from '@/components';

export function AddLinkForm({ boardId }: { boardId: string }) {
  // D-09 defense in depth — page gate 우회 시에도 컴포넌트가 차단
  if (!isDevToolsEnabled()) return null;

  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  function onChange(value: string) {
    setUrl(value);
    if (!value) {
      setHint(null);
      return;
    }
    const kind = detectSourceKind(value);
    setHint(
      kind === 'youtube'
        ? '유튜브 — 분석을 자동 시작합니다.'
        : kind === 'blog'
          ? '블로그 — 큐레이션 대기열에 추가됩니다.'
          : kind === 'instagram'
            ? '인스타 — 큐레이션 대기열에 추가됩니다.'
            : '링크 인식 불가 — 그래도 저장 가능합니다.',
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPending(true);
    try {
      const client = getSupabaseBrowser();
      const link = await addLink(client, { board_id: boardId, url: url.trim() });
      if (link.source_kind === 'youtube') {
        // Fire and forget — user sees "processing" status, page refreshes when done.
        triggerExtraction(client, link.id).catch((err) => {
          console.error(err);
          toast('자동 분석을 시작하지 못했어요. 잠시 후 다시 시도해주세요.', {
            variant: 'error',
          });
        });
        toast('링크를 추가했어요 — 장소를 분석 중이에요.', { variant: 'success' });
      } else {
        toast('링크를 추가했어요.', { variant: 'success' });
      }
      setUrl('');
      setHint(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast('링크 추가에 실패했어요.', { variant: 'error' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="유튜브 / 블로그 / 인스타 링크 붙여넣기"
          className="flex-1"
        />
        <Button type="submit" disabled={pending || !url.trim()}>
          {pending ? '...' : '추가'}
        </Button>
      </div>
      {hint && <p className="text-xs text-neutral-500 mt-2">{hint}</p>}
    </form>
  );
}
