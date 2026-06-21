'use client';

import { TriangleAlert } from 'lucide-react';

export default function PublicBoardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <div className="animate-fade-up flex flex-col items-center text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-400">
          <TriangleAlert className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-lg font-semibold text-neutral-900">문제가 생겼어요</h1>
        <p className="mt-2 max-w-xs text-sm text-neutral-500">
          잠시 후 새로고침해 주세요
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 text-base font-semibold text-brand-600 hover:underline"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
