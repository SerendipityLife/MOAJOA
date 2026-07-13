'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BottomSheet } from '@/components';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

/**
 * AccountSheet — /moa/[id] 탭바 [마이]가 여는 계정 시트 (QUICK-01).
 *
 * 세션을 스스로 조회한다(D-B): 같은 탭바가 호스트(/moa/[id], RSC seed)와
 * 게스트(/t/[slug], 익명 세션) 양쪽에서 뜨는데, prop 드릴링하면 두 진입점을 다
 * 손대야 하고 게스트 경로엔 email·avatar가 아예 없다. ShareSheet가 open에서 poll을
 * 자체 조회하는 선례를 따른다.
 *
 * 게스트 판정은 `!user || user.is_anonymous`(D-C) — /t/[slug] join은 익명 세션을
 * 태우므로 "세션 있음"만으론 로그인 사용자와 구분되지 않는다. 익명 유저는
 * 이름·이메일이 비어 있어 프로필 대신 로그인 CTA를 보여줄 대상이다.
 */

export interface AccountSheetProps {
  open: boolean;
  onClose: () => void;
}

/** undefined = 조회 전, null = 게스트(비로그인·익명). */
type Account = { name: string; email: string; avatarUrl: string | null };

export function AccountSheet({ open, onClose }: AccountSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);

  // open일 때만 조회 — 닫힌 시트가 세션을 캐지 않는다.
  useEffect(() => {
    if (!open) return;
    let active = true; // 언마운트 후 setState 방지 (share-sheet 가드 패턴)
    (async () => {
      try {
        const { data } = await getSupabaseBrowser().auth.getUser();
        if (!active) return;
        const user = data.user;
        setAccount(user && !user.is_anonymous ? toAccount(user.user_metadata, user.email) : null);
      } catch {
        // 조회 실패는 게스트로 폴백 — 시트가 빈 화면으로 죽는 것보다 낫다.
        if (active) setAccount(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  async function logout() {
    if (!window.confirm('정말 로그아웃 하시겠습니까?')) return;
    await getSupabaseBrowser().auth.signOut();
    router.replace('/login');
  }

  // 로그인 CTA의 next는 usePathname()이 만든 앱 내부 경로만 — 사용자 입력 미사용.
  // 소비측 login/page.tsx가 `/` 시작 && `//` 아님을 재검증한다(오픈 리다이렉트 차단).
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  const footer =
    account === undefined ? undefined : account ? (
      <button
        type="button"
        onClick={() => void logout()}
        className="flex w-full items-center justify-center py-3 text-[13px] font-extrabold tracking-widest text-danger"
      >
        로그아웃
      </button>
    ) : (
      <Link
        href={loginHref}
        className="flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3.5 text-base font-semibold text-white"
      >
        로그인
      </Link>
    );

  return (
    <BottomSheet open={open} onClose={onClose} title="마이" footer={footer}>
      {account === undefined ? null : account ? (
        <div className="flex items-center gap-4 py-1">
          <Avatar name={account.name} avatarUrl={account.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold tracking-tight text-neutral-900">
              {account.name}
            </p>
            <p className="truncate text-sm text-neutral-500">{account.email}</p>
          </div>
        </div>
      ) : (
        <p className="py-1 text-sm text-neutral-500">
          로그인하면 내가 담은 장소를 어디서든 이어서 볼 수 있어요.
        </p>
      )}
    </BottomSheet>
  );
}

/** me/page.tsx의 서버 파생 로직을 클라이언트에서 미러(그쪽은 RSC라 공유 불가). */
function toAccount(meta: Record<string, unknown> | undefined, email: string | undefined): Account {
  const m = meta ?? {};
  const name =
    (typeof m.full_name === 'string' && m.full_name.trim()) ||
    (typeof m.name === 'string' && m.name.trim()) ||
    '사용자';
  const avatarUrl =
    (typeof m.avatar_url === 'string' && m.avatar_url) ||
    (typeof m.picture === 'string' && m.picture) ||
    null;
  return { name, email: email ?? '', avatarUrl };
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-brand-500 text-2xl font-bold text-white">
          {initial}
        </div>
      )}
    </div>
  );
}
