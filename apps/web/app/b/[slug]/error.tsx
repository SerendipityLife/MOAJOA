'use client';

export default function PublicBoardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <h1 className="text-lg font-semibold text-neutral-900">문제가 생겼어요</h1>
      <p className="text-sm text-neutral-500 mt-2 text-center max-w-xs">
        잠시 후 새로고침해 주세요
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 text-base font-semibold text-brand-500 hover:underline"
      >
        다시 시도
      </button>
    </main>
  );
}
