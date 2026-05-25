'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind } from '@moajoa/core';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function AddLinkForm({ boardId }: { boardId: string }) {
  // D-09 defense in depth — page gate 우회 시에도 컴포넌트가 차단
  if (!isDevToolsEnabled()) return null;

  const router = useRouter();
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
        triggerExtraction(client, link.id).catch((err) => console.error(err));
      }
      setUrl('');
      setHint(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('링크 추가 실패');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="유튜브 / 블로그 / 인스타 링크 붙여넣기"
          className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {pending ? '...' : '추가'}
        </button>
      </div>
      {hint && <p className="text-xs text-neutral-500 mt-2">{hint}</p>}
    </form>
  );
}
