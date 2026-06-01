import { cn } from '@/lib/cn';

/**
 * Card — MOAJOA Design System §Card.
 * White surface, 16dp radius, neutral-200 border, 16dp padding. Flat — no
 * shadow on static surfaces.
 */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section';
}

export function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-4',
        className,
      )}
      {...props}
    />
  );
}
