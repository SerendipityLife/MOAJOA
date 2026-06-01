import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Input — MOAJOA Design System §Input.
 * 12dp radius, gray-100 fill, 14×16 padding. Focus = 2px brand border,
 * invalid = 2px danger border. Box-sizing keeps height stable across the
 * 1px→2px border swap (no layout jump).
 */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'block w-full rounded-lg border bg-neutral-100 px-4 py-3.5 text-sm text-neutral-900',
          'placeholder:text-neutral-500',
          'transition-colors duration-150 ease-out outline-none',
          'focus:border-2 focus:border-brand-500 focus:bg-white',
          'disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400',
          invalid
            ? 'border-2 border-danger focus:border-danger'
            : 'border-neutral-300',
          className,
        )}
        {...props}
      />
    );
  },
);
