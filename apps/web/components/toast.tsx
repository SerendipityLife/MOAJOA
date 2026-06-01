'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * Snackbar/Toast — MOAJOA Design System §Snackbar.
 * Dark surface, light text, 10dp radius, floating, slide-up entrance
 * (250ms ease-out, no bounce). App-wide via <ToastProvider> + useToast().
 */

type ToastVariant = 'default' | 'success' | 'error' | 'info';

interface ToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss after ms. 0 = sticky (manual dismiss only). Default 4000. */
  duration?: number;
}

interface ToastItem extends Required<ToastOptions> {
  id: number;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// Accent dot color per variant — brand blue / semantic tokens.
const ACCENT: Record<ToastVariant, string> = {
  default: 'bg-brand-400',
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current++;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        variant: options?.variant ?? 'default',
        duration: options?.duration ?? 4000,
      },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-6"
        role="region"
        aria-label="알림"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  // Mount in hidden state, flip to shown next frame so the CSS transition runs.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'pointer-events-auto flex w-full max-w-sm items-center gap-3',
        'rounded-[10px] bg-neutral-900 px-4 py-3 text-neutral-50 shadow-lg',
        'transition-all duration-[250ms] ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      ].join(' ')}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${ACCENT[item.variant]}`}
        aria-hidden
      />
      <p className="flex-1 text-sm leading-normal">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-1 text-neutral-400 transition-colors hover:text-neutral-50"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
