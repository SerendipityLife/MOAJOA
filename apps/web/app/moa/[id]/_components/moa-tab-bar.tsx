'use client';

import { useState } from 'react';
import { AccountSheet } from './account-sheet';

/**
 * Moa-internal bottom tab bar ([모으기] [채팅] [마이]) for /moa/[id].
 *
 * Client state, NOT routing (D-02): the island owns activeTab and mounts once,
 * so the single moa:{tripId} realtime channel is never torn down on tab switch.
 * A route-per-tab split (like the app-shell bottom-nav) would remount the island
 * and churn the channel. Visuals mirror bottom-nav.tsx (fixed bottom, flex-1
 * items, banana bar with brand-700 active). TABS is an array so it extends
 * trivially to 4 (플랜/예약/가계부 자리만, D-01).
 *
 * [마이] is an ACTION, not a tab (D-A): it opens the account sheet and leaves
 * activeTab untouched, so closing the sheet drops the user back on whichever
 * tab they were already on. The sheet state lives here — it needs nothing from
 * the island (it reads its own session), so lifting it would be pure prop noise.
 */

export type MoaTab = 'moa' | 'chat';

export interface MoaTabBarProps {
  activeTab: MoaTab;
  onTabChange: (tab: MoaTab) => void;
}

const TABS = [
  { key: 'moa', label: '모으기', Icon: MapPinIcon },
  { key: 'chat', label: '채팅', Icon: ChatIcon },
  { key: 'account', label: '마이', Icon: PersonIcon },
] as const;

export function MoaTabBar({ activeTab, onTabChange }: MoaTabBarProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-banana-300 bg-banana-100/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg items-stretch">
          {TABS.map(({ key, label, Icon }) => {
            // account는 탭이 아니라 시트 액션 — 절대 active가 되지 않는다.
            const active = key !== 'account' && key === activeTab;
            return (
              <li key={key} className="flex-1">
                {/* Banana bar (see /design.md). The 11px label needs 4.5:1: brand-700
                    is 6.08:1 on banana, neutral-600 is 6.68:1. brand-500 (Royal Blue)
                    would be 3.19:1 — it is never a small-text color. */}
                <button
                  type="button"
                  onClick={() => (key === 'account' ? setAccountOpen(true) : onTabChange(key))}
                  aria-current={active ? 'page' : undefined}
                  aria-haspopup={key === 'account' ? 'dialog' : undefined}
                  className={
                    'flex w-full flex-col items-center gap-1 py-2.5 ' +
                    (active ? 'text-brand-700' : 'text-neutral-600')
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

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
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

function PersonIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
    </svg>
  );
}
