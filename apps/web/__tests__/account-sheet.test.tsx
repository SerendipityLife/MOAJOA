import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * AccountSheet — /moa/[id] [마이] 계정 시트 (QUICK-01a).
 * 목 구성은 share-sheet.test.tsx 헤더를 미러(같은 BottomSheet 소비자).
 */

type MockUser = {
  id: string;
  is_anonymous?: boolean;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null;

const getUser = vi.fn(async (): Promise<{ data: { user: MockUser } }> => ({
  data: { user: null },
}));
const signOut = vi.fn(async () => undefined);
vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getUser: () => getUser(), signOut: () => signOut() } }),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/moa/trip-1',
}));

// 앱 라우터 컨텍스트가 없는 jsdom에서 Link를 순수 anchor로 — 단위 대상은 href 계약.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

vi.mock('@/components', () => ({
  BottomSheet: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="sheet" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  },
}));

// Import AFTER mocks.
import { AccountSheet } from '@/app/moa/[id]/_components/account-sheet';

const SIGNED_IN: MockUser = {
  id: 'u-1',
  is_anonymous: false,
  email: 'a@b.com',
  user_metadata: { full_name: '김와이디', avatar_url: 'https://x/a.png' },
};

beforeEach(() => {
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: null } });
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  replace.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AccountSheet', () => {
  it('비로그인: /login?next=<현재경로> CTA 렌더 + 로그아웃 부재', async () => {
    render(<AccountSheet open onClose={vi.fn()} />);

    const cta = await screen.findByRole('link', { name: '로그인' });
    expect(cta.getAttribute('href')).toBe('/login?next=%2Fmoa%2Ftrip-1');
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();
  });

  it('D-C: 익명 게스트도 게스트 취급 — 로그인 CTA, 프로필·로그아웃 부재', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'anon-1', is_anonymous: true, email: null, user_metadata: {} } },
    });
    render(<AccountSheet open onClose={vi.fn()} />);

    const cta = await screen.findByRole('link', { name: '로그인' });
    expect(cta.getAttribute('href')).toBe('/login?next=%2Fmoa%2Ftrip-1');
    expect(screen.queryByRole('button', { name: '로그아웃' })).toBeNull();
  });

  it('로그인 사용자: 이름·이메일 렌더 + 로그아웃 버튼, 로그인 CTA 부재', async () => {
    getUser.mockResolvedValue({ data: { user: SIGNED_IN } });
    render(<AccountSheet open onClose={vi.fn()} />);

    expect(await screen.findByText('김와이디')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '로그인' })).toBeNull();
  });

  it('로그아웃 확정: confirm true → signOut 1회 + replace(/login) 1회', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getUser.mockResolvedValue({ data: { user: SIGNED_IN } });
    render(<AccountSheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('로그아웃 취소: confirm false → signOut·replace 미호출', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    getUser.mockResolvedValue({ data: { user: SIGNED_IN } });
    render(<AccountSheet open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('닫힌 시트는 세션을 캐지 않는다 — open=false면 getUser 미호출', () => {
    render(<AccountSheet open={false} onClose={vi.fn()} />);

    expect(getUser).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
});
