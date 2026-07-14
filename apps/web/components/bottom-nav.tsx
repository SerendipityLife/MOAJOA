'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Bottom tab bar mirroring the iOS app's (tabs) group: 모아 / 둘러보기 / 내 정보.
 * Shows only on those three top-level screens (so a pushed /moa/[id] has none,
 * matching iOS).
 *
 * It used to render only when dev tools were on, back when the web app shell was
 * itself a dev tool and the public surface was a chrome-free viewer. The v2.1
 * web-first pivot reversed that: the web IS the product surface now, so gating
 * the shell off in production stranded users with no route to 내 정보 — and thus
 * no way to log out. The path check alone decides.
 */
const TABS = [
  { href: '/moa', label: '모아', Icon: BookmarkIcon },
  { href: '/discover', label: '둘러보기', Icon: CompassIcon },
  { href: '/me', label: '내 정보', Icon: PersonIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const onTab = TABS.some((t) => t.href === pathname);
  if (!onTab) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-banana-300 bg-banana-100/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              {/* Banana bar (see /design.md). The 11px label needs 4.5:1: brand-700
                  is 6.08:1 on banana, neutral-600 is 6.68:1. brand-500 (Royal Blue)
                  would be 3.19:1 — it is never a small-text color. */}
              <Link
                href={href}
                className={
                  'flex flex-col items-center gap-1 py-2.5 ' +
                  (active ? 'text-brand-700' : 'text-neutral-600')
                }
              >
                <Icon />
                <span className="text-[11px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function BookmarkIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16 8 13.5 13.5 8 16 10.5 10.5" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
    </svg>
  );
}
