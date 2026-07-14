import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
// The barrel is deliberately NOT mocked here: EmailAuthForm pulls the real
// Button/Input, which is what /login and the landing modal actually render.
// It never touches useToast (errors are a role="alert" node it owns), so no
// ToastProvider wrapper is needed either.
type AuthResult = { error: { message: string } | null };

const signInWithPassword = vi.fn(async (_a: { email: string; password: string }): Promise<AuthResult> => ({
  error: null,
}));
const signUp = vi.fn(
  async (_a: {
    email: string;
    password: string;
    options: { emailRedirectTo: string };
  }): Promise<AuthResult> => ({ error: null }),
);
const signInWithOtp = vi.fn(
  async (_a: { email: string; options: { emailRedirectTo: string } }): Promise<AuthResult> => ({
    error: null,
  }),
);

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowser: () => ({ auth: { signInWithPassword, signUp, signInWithOtp } }),
}));

// Import AFTER mocks so the component picks them up.
import { EmailAuthForm } from '@/components/email-auth-form';

const CALLBACK = 'https://moajoa.test/auth/callback';
const getCallbackUrl = vi.fn(() => CALLBACK);
const onAuthenticated = vi.fn();

function renderForm(props: Partial<React.ComponentProps<typeof EmailAuthForm>> = {}) {
  return render(
    <EmailAuthForm
      surface="light"
      getCallbackUrl={getCallbackUrl}
      onAuthenticated={onAuthenticated}
      {...props}
    />,
  );
}

/** Fill both credential fields with a valid pair. */
function fillCredentials(email = 'a@b.com', password = 'secret1') {
  fireEvent.change(screen.getByPlaceholderText('이메일 주소'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('비밀번호 (6자 이상)'), {
    target: { value: password },
  });
}

beforeEach(() => {
  signInWithPassword.mockClear();
  signInWithPassword.mockResolvedValue({ error: null });
  signUp.mockClear();
  signUp.mockResolvedValue({ error: null });
  signInWithOtp.mockClear();
  signInWithOtp.mockResolvedValue({ error: null });
  getCallbackUrl.mockClear();
  onAuthenticated.mockClear();
});

describe('EmailAuthForm', () => {
  it('renders the password mode surface (both fields, 로그인, 회원가입, magic-link toggle)', () => {
    renderForm();
    expect(screen.getByPlaceholderText('이메일 주소')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('비밀번호 (6자 이상)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메일 링크로 로그인' })).toBeInTheDocument();
  });

  it('signs in with the typed credentials and hands control back to the caller', async () => {
    renderForm();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledTimes(1));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1' });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it('surfaces a sign-in error in role=alert and does not authenticate', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: '로그인 실패' } });
    renderForm();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('로그인 실패'));
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('signs up against the caller-owned callback URL', async () => {
    renderForm();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret1',
      options: { emailRedirectTo: CALLBACK },
    });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it('sends a magic link, shows the sent screen, and returns to password mode', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '메일 링크로 로그인' }));

    fireEvent.change(screen.getByPlaceholderText('이메일 주소'), {
      target: { value: 'magic@b.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '메일로 로그인 링크 받기' }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'magic@b.com',
      options: { emailRedirectTo: CALLBACK },
    });

    // magicSent screen names the address the link went to.
    const sent = await screen.findByText('magic@b.com');
    expect(sent).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '비밀번호로 로그인' }));
    expect(screen.getByPlaceholderText('비밀번호 (6자 이상)')).toBeInTheDocument();
  });

  it('renders socialSlot only when the caller passes one', () => {
    const { unmount } = renderForm({ socialSlot: <button type="button">소셜 슬롯</button> });
    expect(screen.getByRole('button', { name: '소셜 슬롯' })).toBeInTheDocument();
    unmount();

    renderForm();
    expect(screen.queryByRole('button', { name: '소셜 슬롯' })).toBeNull();
  });
});
