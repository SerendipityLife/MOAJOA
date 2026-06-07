'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isDevToolsEnabled } from '@/lib/env';

/**
 * Bottom tab bar mirroring the iOS app's (tabs) group: 보드 / 둘러보기 / 내 정보.
 * Shows only on those three top-level screens (so a pushed /boards/[id] has none,
 * matching iOS) and only when dev tools are on (the web app shell is a dev tool —
 * the public production viewer stays chrome-free).
 */
const TABS = [
  { href: '/boards', label: '보드', Icon: BookmarkIcon },
  { href: '/discover', label: '둘러보기', Icon: CompassIcon },
  { href: '/me', label: '내 정보', Icon: PersonIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const onTab = TABS.some((t) => t.href === pathname);
  if (!onTab || !isDevToolsEnabled()) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={
                  'flex flex-col items-center gap-1 py-2.5 ' +
                  (active ? 'text-brand-500' : 'text-neutral-500')
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
