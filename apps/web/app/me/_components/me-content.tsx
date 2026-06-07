'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components';

/**
 * Web '내 정보' tab — mirrors the moajoa_total Flutter MY tab layout:
 * editorial title → profile hero card → menu section cards → red logout.
 * Badges/gamification are intentionally omitted. The menu targets (profile
 * edit, settings, help, legal) don't exist on web yet, so those rows show a
 * "coming soon" toast; only logout is wired.
 */
interface Props {
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Section {
  header: string;
  items: { icon: ReactNode; label: string }[];
}

export function MeContent({ name, email, avatarUrl }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const soon = (label: string) => toast(`${label} — 곧 추가될 기능이에요`, { variant: 'info' });

  async function logout() {
    if (!window.confirm('정말 로그아웃 하시겠습니까?')) return;
    await getSupabaseBrowser().auth.signOut();
    router.replace('/login');
  }

  const sections: Section[] = [
    {
      header: '계정',
      items: [
        { icon: <PersonIcon />, label: '내 프로필' },
        { icon: <SettingsIcon />, label: '앱 설정' },
      ],
    },
    {
      header: '지원',
      items: [{ icon: <HelpIcon />, label: '도움말' }],
    },
    {
      header: '약관',
      items: [
        { icon: <DocIcon />, label: '이용약관' },
        { icon: <ShieldIcon />, label: '개인정보처리방침' },
      ],
    },
  ];

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-5 pt-16 pb-28">
      <h1 className="px-2 mb-4 text-lg font-extrabold tracking-tight">내 프로필</h1>

      {/* Profile hero card */}
      <div className="relative rounded-3xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-4">
          <Avatar name={name} avatarUrl={avatarUrl} />
          <div className="min-w-0">
            <p className="text-xl font-extrabold tracking-tight truncate">{name}</p>
            <p className="text-sm text-neutral-500 truncate">{email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => soon('프로필 편집')}
          aria-label="프로필 편집"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand-500"
        >
          <EditIcon />
        </button>
      </div>

      {/* Menu sections */}
      <div className="mt-7 flex flex-col gap-7">
        {sections.map((section) => (
          <section key={section.header}>
            <p className="px-2 mb-2.5 text-[11px] font-extrabold tracking-[0.15em] text-neutral-400">
              {section.header}
            </p>
            <div className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => soon(item.label)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-brand-50/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                    {item.icon}
                  </span>
                  <span className="flex-1 text-[15px] font-bold">{item.label}</span>
                  <ChevronRightIcon />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={logout}
        className="mt-5 flex w-full items-center justify-center gap-2 py-4 text-[13px] font-extrabold tracking-widest text-danger"
      >
        <LogoutIcon />
        로그아웃
      </button>
    </main>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-100">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-brand-500 text-3xl font-bold text-white">
          {initial}
        </div>
      )}
    </div>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function PersonIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5V5M12 19v2.5M21.5 12H19M5 12H2.5M18.36 5.64l-1.77 1.77M7.41 16.59l-1.77 1.77M18.36 18.36l-1.77-1.77M7.41 7.41 5.64 5.64" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.4c-.8.4-1.4 1-1.4 2" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M10 13h5M10 16.5h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...iconProps} width={16} height={16}>
      <path d="M4 20l4-1L18.5 8.5l-3-3L5 16z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps} width={16} height={16}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg {...iconProps} width={22} height={22} className="text-neutral-300">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
