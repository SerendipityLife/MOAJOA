'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBoard } from '@moajoa/api';
import { isDevToolsEnabled } from '@/lib/env';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input } from '@/components';

export function CreateBoardButton() {
  // D-09 defense in depth — page gate 우회 시에도 컴포넌트가 차단
  if (!isDevToolsEnabled()) return null;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      const board = await createBoard(getSupabaseBrowser(), {
        title: title.trim(),
        description: null,
        visibility: 'private',
        city_code: null,
      });
      router.push(`/boards/${board.id}`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`보드 생성 실패: ${message}`);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        새 보드
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="보드 이름 (예: 도쿄 5월)"
        maxLength={60}
        className="w-56"
      />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        만들기
      </Button>
      <Button type="button" variant="text" size="sm" onClick={() => setOpen(false)}>
        취소
      </Button>
    </form>
  );
}
