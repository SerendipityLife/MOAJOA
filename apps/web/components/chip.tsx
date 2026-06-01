import { cn } from '@/lib/cn';

/**
 * Chip — MOAJOA Design System §Chips.
 * Stadium (fully pill), 6×12 padding, 12px/500. Selected = brand-tinted fill,
 * transparent border, brand-700 text. Renders as a button when interactive.
 */

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, type, children, ...props }: ChipProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-selected={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
        'transition-colors duration-150 ease-out',
        selected
          ? 'border-transparent bg-brand-100 text-brand-700'
          : 'border-neutral-300 bg-transparent text-neutral-700 hover:border-neutral-400',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
