'use client';

import { useState } from 'react';
import { AccountSheet } from './account-sheet';

/**
 * Moa-internal bottom tab bar ([모으기] [채팅] [마이]) for /moa/[id].
 *
 * Client state, NOT routing (D-02): the island owns activeTab and mounts once,
 * so the single moa:{tripId} realtime channel is never torn down on tab switch.
 * A route-per-tab split (like the app-shell bottom-nav) would remount the island
 * and churn the channel. TABS is an array so it extends trivially to 4
 * (플랜/예약/가계부 자리만, D-01).
 *
 * Shape is a floating dock (/design.md §4): a capsule inset from the screen
 * edges, not a bar flush to the bottom. It floats over the white PlaceSheet, so
 * a white capsule on white would vanish — the shadow + hairline border are what
 * make it read as a separate layer, not decoration.
 *
 * The wrapper is pointer-events-none so the transparent inset gutter doesn't eat
 * map drags near the bottom edge; only the capsule itself takes events (same
 * pattern as place-sheet).
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
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(12px_+_env(safe-area-inset-bottom))]">
        <ul className="pointer-events-auto mx-auto flex max-w-lg items-center rounded-full border border-white/70 bg-white/85 p-1.5 shadow-float backdrop-blur-md">
          {TABS.map(({ key, label, Icon }) => {
            // account는 탭이 아니라 시트 액션 — 절대 active가 되지 않는다.
            const active = key !== 'account' && key === activeTab;
            return (
              <li key={key} className="flex-1">
                <button
                  type="button"
                  onClick={() => (key === 'account' ? setAccountOpen(true) : onTabChange(key))}
                  aria-current={active ? 'page' : undefined}
                  aria-haspopup={key === 'account' ? 'dialog' : undefined}
                  className="flex w-full items-center justify-center transition-transform duration-150 ease-out active:scale-95"
                >
                  {/* Only the selected tab carries banana, and the pill hugs its
                      icon+label instead of filling the slot (/design.md §4). The
                      label is 11px, so it needs 4.5:1: brand-700 is 6.89:1 on the
                      white capsule and 5.5:1 on the banana-200 pill. brand-500
                      (Royal Blue) would be 3.62:1 — never a small-text color. */}
                  <span
                    className={
                      'flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 transition-colors duration-150 ease-out ' +
                      (active ? 'bg-banana-200 text-brand-700' : 'text-neutral-500')
                    }
                  >
                    <Icon />
                    <span className={'text-[11px] ' + (active ? 'font-semibold' : 'font-medium')}>
                      {label}
                    </span>
                  </span>
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
  width: 22,
  height: 22,
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
