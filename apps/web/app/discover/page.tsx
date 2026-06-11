import { Compass } from 'lucide-react';

export default function DiscoverPage() {
  return (
    <main className="min-h-screen px-6 py-8 pb-24 max-w-3xl mx-auto flex flex-col items-center justify-center text-center">
      <div className="animate-fade-up flex flex-col items-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <Compass className="size-8" strokeWidth={1.7} />
        </div>
        <span className="mt-5 inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
          Phase 2
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-neutral-900">
          둘러보기
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">
          공개된 보드를 찾아보는 기능이 곧 여기에 들어옵니다.
        </p>
      </div>
    </main>
  );
}
