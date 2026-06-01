import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button — MOAJOA Design System §Buttons.
 * 12dp radius, weight 600, 14×24 padding. Variants: primary (brand-600),
 * outline, text. Keyboard focus ring per a11y.
 */

type ButtonVariant = 'primary' | 'outline' | 'text';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-300 disabled:text-white/60',
  outline:
    'border border-neutral-300 text-neutral-900 hover:border-neutral-700 disabled:opacity-50',
  text: 'text-brand-600 hover:bg-brand-50 disabled:opacity-50',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'px-6 py-3.5 text-base',
  sm: 'px-3 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className, type, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
          'transition-colors duration-150 ease-out',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
          'disabled:cursor-not-allowed',
          VARIANT[variant],
          SIZE[size],
          className,
        )}
        {...props}
      />
    );
  },
);
