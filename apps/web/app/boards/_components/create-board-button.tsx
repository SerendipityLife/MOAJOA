'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBoard } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function CreateBoardButton() {
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
      alert('보드 생성 실패');
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium text-sm"
      >
        새 보드
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="보드 이름 (예: 도쿄 5월)"
        maxLength={60}
        className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !title.trim()}
        className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm disabled:opacity-50"
      >
        만들기
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-3 py-2 text-neutral-500 text-sm"
      >
        취소
      </button>
    </form>
  );
}
