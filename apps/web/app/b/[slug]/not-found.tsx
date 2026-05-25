export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-white">
      <h1 className="text-lg font-semibold text-neutral-900">보드를 찾을 수 없어요</h1>
      <p className="text-sm text-neutral-500 mt-2 text-center max-w-xs">
        링크가 잘못되었거나 보드가 비공개로 변경되었어요.
      </p>
      <a
        href="/"
        className="mt-8 text-base font-semibold text-brand-500 hover:underline"
      >
        MOAJOA
      </a>
    </main>
  );
}
