import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
const mockSignIn = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { signInWithOAuth: mockSignIn } }),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

const toast = vi.fn();
vi.mock('@/components', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    const { variant: _v, size: _s, ...rest } = props as Record<string, unknown>;
    return (
      <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    );
  },
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  useToast: () => ({ toast }),
}));

// Import AFTER mocks so the component picks them up.
import LoginPage from '@/app/login/page';

beforeEach(() => {
  mockSignIn.mockClear();
  mockSignIn.mockResolvedValue({ error: null });
  replace.mockClear();
  toast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginPage — Kakao OAuth (AUTH-07)', () => {
  it('renders the 카카오로 시작하기 button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
  });

  it('tapping the button calls signInWithOAuth once with provider kakao + /auth/callback redirect', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    expect(mockSignIn).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });

  it('surfaces an error toast (no redirect) when signInWithOAuth returns an error', async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: '카카오 로그인 실패' } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('카카오 로그인 실패', { variant: 'error' }),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
