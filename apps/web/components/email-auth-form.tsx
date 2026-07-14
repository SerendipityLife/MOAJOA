'use client';

export type EmailAuthSurface = 'blue' | 'light';

interface EmailAuthFormProps {
  surface: EmailAuthSurface;
  getCallbackUrl: () => string;
  onAuthenticated: () => void;
  socialSlot?: React.ReactNode;
}

// RED stub — behavior lands in the GREEN commit.
export function EmailAuthForm(_props: EmailAuthFormProps) {
  return null;
}
