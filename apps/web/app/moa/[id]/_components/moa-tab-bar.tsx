'use client';

/**
 * Moa-internal bottom tab bar ([모으기] [채팅]) for /moa/[id].
 *
 * Client state, NOT routing (D-02): the island owns activeTab and mounts once,
 * so the single moa:{tripId} realtime channel is never torn down on tab switch.
 * A route-per-tab split (like the app-shell bottom-nav) would remount the island
 * and churn the channel. Visuals mirror bottom-nav.tsx (fixed bottom, flex-1
 * items, brand-500 active). TABS is an array so it extends trivially to 4
 * (플랜/예약/가계부 자리만, D-01) — only these two render now.
 */

export type MoaTab = 'moa' | 'chat';

export interface MoaTabBarProps {
  activeTab: MoaTab;
  onTabChange: (tab: MoaTab) => void;
}

const TABS = [
  { key: 'moa', label: '모으기', Icon: MapPinIcon },
  { key: 'chat', label: '채팅', Icon: ChatIcon },
] as const;

export function MoaTabBar({ activeTab, onTabChange }: MoaTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => onTabChange(key)}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex w-full flex-col items-center gap-1 py-2.5 ' +
                  (active ? 'text-brand-500' : 'text-neutral-500')
                }
              >
                <Icon />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
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

function MapPinIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.8-5.8A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}
