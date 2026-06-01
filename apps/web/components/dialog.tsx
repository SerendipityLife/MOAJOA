'use client';

import { useEffect, useState } from 'react';

/**
 * Dialog — MOAJOA Design System §Dialog.
 * White surface, 24dp radius, no elevation (border instead of shadow),
 * fade + scale 95%→100% entrance (200ms ease-out, no bounce). Map/content
 * stays visible behind a dimmed backdrop.
 *
 * Controlled: parent owns `open`. Closes on backdrop click, Escape, or the
 * provided action buttons.
 */

interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'text';
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: DialogAction[];
}

const ACTION_CLASS: Record<NonNullable<DialogAction['variant']>, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  outline:
    'border border-neutral-300 text-neutral-900 hover:border-neutral-700',
  text: 'text-brand-600 hover:bg-brand-50',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
}: DialogProps) {
  const [shown, setShown] = useState(false);

  // Drive the enter/exit transition from the `open` prop.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Escape to close while open.
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
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop — dims but keeps the map/content visible behind. */}
      <div
        className={`absolute inset-0 bg-neutral-900/40 transition-opacity duration-200 ease-out ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <div
        className={[
          'relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6',
          'transition-all duration-200 ease-out',
          shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        ].join(' ')}
      >
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}

        {actions && actions.length > 0 && (
          <div className="mt-6 flex justify-end gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  ACTION_CLASS[a.variant ?? 'text']
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
