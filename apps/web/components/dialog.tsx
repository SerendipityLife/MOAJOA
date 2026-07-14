'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Dialog — MOAJOA Design System §Dialog.
 * White surface, 24dp radius, no elevation (border instead of shadow),
 * fade + scale 95%→100% entrance (200ms ease-out, no bounce). Map/content
 * stays visible behind a dimmed backdrop.
 *
 * Controlled: parent owns `open`. Closes on backdrop click, Escape, or the
 * provided action buttons. While open it traps focus, focuses the first field,
 * and restores focus to the trigger on close.
 *
 * Deliberately does NOT lock body scroll. Its first caller (the landing
 * carousel) scrolls an inner `overflow-x-auto` track, not the body — the body
 * there cannot scroll at all. A body lock would fix nothing while planting a
 * global side effect in a shared component. What actually keeps the carousel
 * still is structural: the caller renders this Dialog as a *sibling* of the
 * track (so backdrop wheel/touch never bubbles into it), the focus trap keeps
 * arrow keys out of the track, and focus restore uses preventScroll.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Drive the enter/exit transition from the `open` prop.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Remember the trigger, focus the first field, and hand focus back on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    triggerRef.current = previous instanceof HTMLElement ? previous : null;

    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      const trigger = triggerRef.current;
      triggerRef.current = null;
      // Nothing meaningful to return to (open on mount) — leave focus alone.
      if (!trigger || trigger === document.body) return;
      // preventScroll is load-bearing, not polish: without it the browser may
      // scroll an ancestor (e.g. the landing's carousel track) to bring the
      // trigger back into view.
      trigger.focus({ preventScroll: true });
    };
  }, [open]);

  // Escape to close, Tab to cycle within the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Re-query every keystroke: 회원가입 flips between disabled and enabled as
      // the user types, so a cached list would trap focus on a stale node.
      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
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
        ref={panelRef}
        className={[
          'relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6',
          // The panel — not the page — absorbs overflow on short viewports.
          // 3rem = the container's p-6, top + bottom.
          'max-h-[calc(100dvh-3rem)] overflow-y-auto',
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
