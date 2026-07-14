import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// No mocks: SocialAuthButtons is pure presentation. It takes an onProvider
// handler and owns no supabase client — that boundary is what lets /login keep
// its ?next=-carrying callbackUrl() while the landing uses a query-less one.
import { SocialAuthButtons } from '@/components/social-auth-buttons';

const onProvider = vi.fn();

beforeEach(() => {
  onProvider.mockClear();
});

describe('SocialAuthButtons', () => {
  it('renders the three social buttons with their accessible names', () => {
    render(<SocialAuthButtons onProvider={onProvider} />);
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apple로 계속하기' })).toBeInTheDocument();
  });

  it.each([
    ['카카오로 시작하기', 'kakao'],
    ['Google로 계속하기', 'google'],
    ['Apple로 계속하기', 'apple'],
  ])('clicking %s calls onProvider once with %s', (name, provider) => {
    render(<SocialAuthButtons onProvider={onProvider} />);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(onProvider).toHaveBeenCalledTimes(1);
    expect(onProvider).toHaveBeenCalledWith(provider);
  });

  it('merges buttonClassName onto all three buttons', () => {
    render(<SocialAuthButtons onProvider={onProvider} buttonClassName="ring-2 ring-white/80" />);
    for (const name of ['카카오로 시작하기', 'Google로 계속하기', 'Apple로 계속하기']) {
      expect(screen.getByRole('button', { name })).toHaveClass('ring-2', 'ring-white/80');
    }
  });
});
