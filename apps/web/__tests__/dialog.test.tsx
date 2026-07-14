import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Dialog } from '@/components/dialog';

/** Two focusables so the trap has a first *and* a last to wrap between. */
function Body() {
  return (
    <>
      <input placeholder="첫 필드" />
      <button type="button">마지막 버튼</button>
    </>
  );
}

/** A trigger outside the dialog — focus must return here on close, and must
 *  never be reachable by Tab while the dialog is open. */
function Harness({ open }: { open: boolean }) {
  return (
    <>
      <button type="button">트리거</button>
      <Dialog open={open} onClose={() => {}} title="이메일로 로그인">
        <Body />
      </Dialog>
    </>
  );
}

describe('Dialog — modal a11y', () => {
  it('renders nothing while closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus to the first focusable inside the panel on open', () => {
    const { rerender } = render(<Harness open={false} />);
    rerender(<Harness open />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText('첫 필드'));
  });

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Harness open />);
    const first = screen.getByPlaceholderText('첫 필드');
    const last = screen.getByRole('button', { name: '마지막 버튼' });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    render(<Harness open />);
    const first = screen.getByPlaceholderText('첫 필드');
    const last = screen.getByRole('button', { name: '마지막 버튼' });

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to whatever was focused before it opened', () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole('button', { name: '트리거' });
    trigger.focus();

    rerender(<Harness open />);
    expect(document.activeElement).not.toBe(trigger);

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });
});
