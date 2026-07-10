import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
// linkIdentity 승격(D-03) — login.test.tsx signInWithOAuth mock 미러.
const mockLink = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { linkIdentity: mockLink } }),
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
  useToast: () => ({ toast }),
}));

// Import AFTER mocks so the component picks them up.
import { GuestPromote } from '@/app/t/[slug]/_components/guest-promote';

beforeEach(() => {
  mockLink.mockClear();
  mockLink.mockResolvedValue({ error: null });
  toast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GuestPromote — 계정 승격 최소 심 (D-03, AUTH-08)', () => {
  it('renders the 로그인하고 내 여행에 담기 entry point', () => {
    render(<GuestPromote />);
    expect(screen.getByText('로그인하고 내 여행에 담기')).toBeInTheDocument();
  });

  it('tapping the entry point calls linkIdentity once with provider kakao', async () => {
    render(<GuestPromote />);
    fireEvent.click(screen.getByText('로그인하고 내 여행에 담기'));
    await waitFor(() => expect(mockLink).toHaveBeenCalledTimes(1));
    expect(mockLink).toHaveBeenCalledWith({ provider: 'kakao' });
  });

  it('surfaces an error toast when linkIdentity returns an error', async () => {
    mockLink.mockResolvedValueOnce({ error: { message: '승격에 실패했어요' } });
    render(<GuestPromote />);
    fireEvent.click(screen.getByText('로그인하고 내 여행에 담기'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('승격에 실패했어요', { variant: 'error' }),
    );
  });
});
