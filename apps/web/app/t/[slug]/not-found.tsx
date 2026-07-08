import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <div className="animate-fade-up flex flex-col items-center text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-400">
          <MapPinOff className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-lg font-semibold text-neutral-900">
          모아를 찾을 수 없어요
        </h1>
        <p className="mt-2 max-w-xs text-sm text-neutral-500">
          링크가 잘못되었거나 모아가 비공개로 변경되었어요.
        </p>
        <a
          href="/"
          className="mt-8 text-base font-semibold text-brand-600 hover:underline"
        >
          MOAJOA
        </a>
      </div>
    </main>
  );
}
