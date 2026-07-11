'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * BottomSheet — MOAJOA Design System §Bottom Sheet.
 * White, 28dp top radius, visible drag handle, no surface tint. Slides up
 * 250ms ease-out (no bounce). On tablet/web it never covers the full
 * viewport (max-h 85vh) so the map/content stays visible behind the backdrop.
 */

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * 스크롤 영역 밖 고정 푸터(CTA 등). 내용이 길어도 시트 하단에 항상 노출 —
   * iOS 툴바/스크롤에 CTA가 잘리는 문제의 구조적 해법.
   */
  footer?: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'absolute inset-0 bg-neutral-900/40 transition-opacity duration-200 ease-out',
          shown ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          'relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white',
          'transition-transform duration-[250ms] ease-out',
          shown ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <span
            className="h-1.5 w-10 rounded-full bg-neutral-300"
            aria-hidden
          />
        </div>

        {title && (
          <h2 className="shrink-0 px-6 pt-2 pb-3 text-lg font-semibold text-neutral-900">
            {title}
          </h2>
        )}

        <div className="overflow-y-auto px-6 pb-8">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-neutral-100 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
