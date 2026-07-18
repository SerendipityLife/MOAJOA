import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button — MOAJOA Design System §Buttons (see /design.md §6).
 * 12dp radius, weight 600, 14×24 padding. Keyboard focus ring per a11y.
 *
 * primary (brand-600, blue) is "add / commit". secondary (banana-400) is the
 * warm counterpart, used for the social "together" actions — the two read as
 * different kinds of act, not as a strong/weak pair. Banana carries ink text,
 * never white: white on banana-400 is 1.66:1.
 */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_2px_10px_-2px_rgba(47,39,206,0.45)] hover:bg-brand-700 hover:shadow-[0_5px_16px_-3px_rgba(47,39,206,0.5)] active:bg-brand-700 disabled:bg-brand-300 disabled:text-white/60 disabled:shadow-none',
  secondary:
    'bg-banana-400 text-neutral-900 shadow-[0_2px_10px_-3px_rgba(47,39,206,0.28)] hover:bg-banana-500 hover:shadow-[0_5px_16px_-3px_rgba(47,39,206,0.32)] active:bg-banana-500 disabled:bg-banana-200 disabled:text-neutral-900/40 disabled:shadow-none', // ink on lavender banana-400 ~11:1
  outline:
    'border border-neutral-300 text-neutral-900 hover:border-neutral-700 hover:bg-neutral-50 disabled:opacity-50',
  text: 'text-brand-600 hover:bg-brand-50 disabled:opacity-50',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'px-6 py-3.5 text-base',
  sm: 'px-3 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
        'transition-[background-color,box-shadow,transform,border-color] duration-150 ease-out',
        'active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
});
